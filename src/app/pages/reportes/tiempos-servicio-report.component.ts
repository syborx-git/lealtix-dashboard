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
import { TiemposServicioReporteDTO } from './services/reportes.service';

/**
 * Reporte 4.3 - Tiempos de Servicio y Preparación.
 *
 * Mide el desempeño operativo en cocina y barra, controlando los minutos transcurridos
 * desde el levantamiento de la comanda hasta la entrega del platillo.
 */
@Component({
  selector: 'app-tiempos-servicio-report',
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
  templateUrl: './tiempos-servicio-report.component.html',
  styleUrls: ['./tiempos-servicio-report.component.scss'],
})
export class TiemposServicioReportComponent extends ReporteBaseComponent {
  protected readonly claveArchivo = '4.3_tiempos_servicio';

  readonly reporte = signal<TiemposServicioReporteDTO | null>(null);

  /** Filtro de búsqueda en el detalle de comandas */
  filtroComandas: string = '';

  /** Gráfica de distribución por rangos de tiempo */
  readonly rangosChartData = computed(() => {
    const puntos = this.reporte()?.distribucionRangos ?? [];
    return {
      labels: puntos.map(p => p.etiqueta || p.label || ''),
      datasets: [
        {
          data: puntos.map(p => p.valor),
          backgroundColor: [
            '#10b981', // < 10 min (Excelente)
            '#3b82f6', // 10-20 min (Aceptable)
            '#f59e0b', // 20-30 min (Alerta)
            '#ef4444', // > 30 min (Retraso crítico)
          ],
          borderWidth: 0,
        },
      ],
    };
  });

  readonly rangosChartOptions = {
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

  /** Gráfica de promedio por estación (Cocina vs Barra) */
  readonly estacionesChartData = computed(() => {
    const puntos = this.reporte()?.promedioPorEstacion ?? [];
    return {
      labels: puntos.map(p => p.etiqueta || p.label || ''),
      datasets: [
        {
          label: 'Tiempo Promedio (minutos)',
          data: puntos.map(p => p.valor),
          backgroundColor: '#ea580c',
          borderRadius: 6,
        },
      ],
    };
  });

  readonly estacionesChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${Number(ctx.parsed.y).toFixed(1)} minutos`,
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback: (val: any) => `${val} min`,
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
      .obtenerTiemposServicio(this.tenantId(), this.params())
      .subscribe({
        next: (respuesta) => {
          if (respuesta?.code && respuesta.code >= 400) {
            this.loading.set(false);
            this.reporte.set(null);
            this.error.set(respuesta.message || 'No se pudo cargar el reporte de tiempos de servicio');
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
          this.error.set(err?.error?.message ?? err?.message ?? 'No se pudo cargar el reporte de tiempos de servicio');
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
      .exportarTiemposServicio(this.tenantId(), this.params())
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

  estadoTiempoTag(minutos: number): { label: string; severity: 'success' | 'info' | 'warn' | 'danger' } {
    if (minutos <= 12) return { label: 'Rápido', severity: 'success' };
    if (minutos <= 20) return { label: 'A tiempo', severity: 'info' };
    if (minutos <= 30) return { label: 'Alerta', severity: 'warn' };
    return { label: 'Demora', severity: 'danger' };
  }
}
