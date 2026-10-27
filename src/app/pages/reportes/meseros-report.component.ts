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
import { RendimientoMeseroReporteDTO } from './services/reportes.service';

/**
 * Reporte 4.4 - Rendimiento por Mesero.
 *
 * Evalúa las ventas totales, ticket promedio, platillos movilizados y propinas
 * asignadas a cada miembro del equipo de servicio.
 */
@Component({
  selector: 'app-meseros-report',
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
  templateUrl: './meseros-report.component.html',
  styleUrls: ['./meseros-report.component.scss'],
})
export class MeserosReportComponent extends ReporteBaseComponent {
  protected readonly claveArchivo = '4.4_rendimiento_meseros';

  readonly reporte = signal<RendimientoMeseroReporteDTO | null>(null);

  /** Filtro de búsqueda en la tabla de meseros */
  filtroMeseros: string = '';

  /** Gráfica de ranking de ventas por mesero */
  readonly ventasChartData = computed(() => {
    const puntos = this.reporte()?.ventasPorMesero ?? [];
    return {
      labels: puntos.map(p => p.etiqueta || p.label || ''),
      datasets: [
        {
          label: 'Ventas Totales ($)',
          data: puntos.map(p => p.valor),
          backgroundColor: '#3b82f6',
          borderRadius: 6,
        },
      ],
    };
  });

  readonly ventasChartOptions = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${this.moneda(Number(ctx.parsed.x))}`,
        },
      },
    },
    scales: {
      x: {
        ticks: {
          callback: (val: any) => `$${Number(val).toLocaleString()}`,
        },
        grid: { color: 'rgba(0, 0, 0, 0.04)' },
      },
      y: {
        grid: { display: false },
      },
    },
  };

  /** Gráfica de distribución de tickets por mesero */
  readonly ticketsChartData = computed(() => {
    const puntos = this.reporte()?.ticketsPorMesero ?? [];
    return {
      labels: puntos.map(p => p.etiqueta || p.label || ''),
      datasets: [
        {
          data: puntos.map(p => p.valor),
          backgroundColor: [
            '#3b82f6',
            '#10b981',
            '#8b5cf6',
            '#f59e0b',
            '#ec4899',
            '#06b6d4',
            '#64748b',
          ],
          borderWidth: 0,
        },
      ],
    };
  });

  readonly ticketsChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right' as const, labels: { usePointStyle: true, boxWidth: 8 } },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${Number(ctx.parsed).toLocaleString()} comandas`,
        },
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
      .obtenerRendimientoMeseros(this.tenantId(), this.params())
      .subscribe({
        next: (respuesta) => {
          if (respuesta?.code && respuesta.code >= 400) {
            this.loading.set(false);
            this.reporte.set(null);
            this.error.set(respuesta.message || 'No se pudo cargar el rendimiento de meseros');
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
          this.error.set(err?.error?.message ?? err?.message ?? 'No se pudo cargar el rendimiento de meseros');
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
      .exportarRendimientoMeseros(this.tenantId(), this.params())
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
