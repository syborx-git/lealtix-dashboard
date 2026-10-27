import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { ReporteBaseComponent } from './reportes-base.component';
import { KpiGridComponent } from './kpi-grid.component';
import { CampanasReporteDTO } from './services/reportes.service';

/**
 * Reporte 3.2 - Rendimiento de Campañas y Cupones.
 *
 * Mide el impacto financiero de las promociones y cupones de lealtad: redenciones,
 * descuentos concedidos, ventas totales asociadas y retorno de inversión.
 */
@Component({
  selector: 'app-campanas-report',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ChartModule,
    TableModule,
    ButtonModule,
    SkeletonModule,
    TooltipModule,
    TagModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    KpiGridComponent,
  ],
  templateUrl: './campanas-report.component.html',
  styleUrls: ['./campanas-report.component.scss'],
})
export class CampanasReportComponent extends ReporteBaseComponent {
  protected readonly claveArchivo = '3.2_rendimiento_campanas';

  readonly reporte = signal<CampanasReporteDTO | null>(null);

  /** Filtro de búsqueda en la tabla de cupones */
  filtroCupones: string = '';

  /** Gráfica de canjes por campaña */
  readonly canjesChartData = computed(() => {
    const puntos = this.reporte()?.canjesPorCampana ?? [];
    return {
      labels: puntos.map(p => p.etiqueta || p.label || ''),
      datasets: [
        {
          data: puntos.map(p => p.valor),
          backgroundColor: [
            '#db2777',
            '#ec4899',
            '#f43f5e',
            '#8b5cf6',
            '#06b6d4',
            '#10b981',
            '#f59e0b',
          ],
          borderWidth: 0,
        },
      ],
    };
  });

  readonly canjesChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right' as const, labels: { usePointStyle: true, boxWidth: 8 } },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${Number(ctx.parsed).toLocaleString()} canjes`,
        },
      },
    },
  };

  /** Gráfica comparativa de Descuento otorgado vs Ventas generadas */
  readonly comparativaChartData = computed(() => {
    const puntos = this.reporte()?.comparativaDescuentoVenta ?? [];
    return {
      labels: puntos.map(p => p.etiqueta || p.label || ''),
      datasets: [
        {
          label: 'Descuento Otorgado ($)',
          data: puntos.map(p => p.valor),
          backgroundColor: '#ef4444',
          borderRadius: 6,
        },
        {
          label: 'Ventas Generadas ($)',
          data: puntos.map(p => p.valorMoneda ?? 0),
          backgroundColor: '#10b981',
          borderRadius: 6,
        },
      ],
    };
  });

  readonly comparativaChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${ctx.dataset.label}: ${this.moneda(Number(ctx.parsed.y))}`,
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback: (val: any) => `$${Number(val).toLocaleString()}`,
        },
        grid: { color: 'rgba(0, 0, 0, 0.04)' },
      },
      x: {
        grid: { display: false },
      },
    },
  };

  protected rangoArchivo(): { from: string; to: string } | null {
    const meta = this.reporte()?.meta;
    if (!meta) return null;
    return { from: meta.rangoActual.from, to: meta.rangoActual.to };
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);

    this.reportesService
      .obtenerCampanas(this.tenantId(), this.params())
      .subscribe({
        next: (respuesta) => {
          if (respuesta?.code && respuesta.code >= 400) {
            this.loading.set(false);
            this.reporte.set(null);
            this.error.set(respuesta.message || 'No se pudo cargar el reporte de campañas');
            this.messageService.add({
              severity: 'error',
              summary: 'Error al cargar reporte',
              detail: this.error() ?? 'Ocurrió un error inesperado',
              life: 4000,
            });
            return;
          }
          const obj = respuesta?.object;
          if (obj && typeof obj === 'object') {
            this.reporte.set(obj);
          } else {
            this.reporte.set(null);
          }
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.reporte.set(null);
          this.error.set(err?.error?.message ?? err?.message ?? 'No se pudo cargar el reporte de campañas');
          this.messageService.add({
            severity: 'error',
            summary: 'Error al cargar reporte',
            detail: this.error() ?? 'Ocurrió un error inesperado',
            life: 4000,
          });
        },
      });
  }

  exportar(): void {
    this.exportando.set(true);

    this.reportesService
      .exportarCampanas(this.tenantId(), this.params())
      .subscribe({
        next: (blob) => {
          this.exportando.set(false);
          this.descargar(blob, this.nombreArchivo());
        },
        error: (err) => {
          this.exportando.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'No se pudo exportar',
            detail: err?.message ?? 'Error generando el archivo Excel',
            life: 4000,
          });
        },
      });
  }

  recargar(): void {
    this.cargar();
  }
}
