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
import { ReporteBaseComponent } from './reportes-base.component';
import { KpiGridComponent } from './kpi-grid.component';
import { MapaCalorReporteDTO } from './services/reportes.service';

/**
 * Reporte 4.5 - Mapa de Calor de Afluencia.
 *
 * Mapea las horas y días de mayor concurrencia de clientes para optimizar
 * turnos de personal, compras e intensidad de producción.
 */
@Component({
  selector: 'app-mapa-calor-report',
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
    KpiGridComponent,
  ],
  templateUrl: './mapa-calor-report.component.html',
  styleUrls: ['./mapa-calor-report.component.scss'],
})
export class MapaCalorReportComponent extends ReporteBaseComponent {
  protected readonly claveArchivo = '4.5_mapa_calor_afluencia';

  readonly reporte = signal<MapaCalorReporteDTO | null>(null);

  /** Gráfica de línea de afluencia por hora */
  readonly horasChartData = computed(() => {
    const puntos = this.reporte()?.afluenciaPorHora ?? [];
    return {
      labels: puntos.map(p => p.etiqueta || p.label || ''),
      datasets: [
        {
          label: 'Comandas',
          data: puntos.map(p => p.valor),
          borderColor: '#f97316',
          backgroundColor: 'rgba(249, 115, 22, 0.12)',
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#ea580c',
          pointRadius: 4,
        },
      ],
    };
  });

  readonly horasChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${Number(ctx.parsed.y).toLocaleString()} comandas`,
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback: (val: any) => `${val}`,
        },
        grid: { color: 'rgba(0, 0, 0, 0.04)' },
      },
      x: {
        grid: { color: 'rgba(0, 0, 0, 0.04)' },
      },
    },
  };

  /** Gráfica de barras de afluencia por día de la semana */
  readonly diasChartData = computed(() => {
    const puntos = this.reporte()?.afluenciaPorDia ?? [];
    return {
      labels: puntos.map(p => p.etiqueta || p.label || ''),
      datasets: [
        {
          label: 'Comandas Totales',
          data: puntos.map(p => p.valor),
          backgroundColor: '#3b82f6',
          borderRadius: 6,
        },
      ],
    };
  });

  readonly diasChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${Number(ctx.parsed.y).toLocaleString()} comandas`,
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback: (val: any) => `${val}`,
        },
        grid: { color: 'rgba(0, 0, 0, 0.04)' },
      },
      x: {
        grid: { display: false },
      },
    },
  };

  /** Calcula la clase CSS para el nivel de calor de la celda */
  claseCeldaCalor(valor: any): string {
    const v = Number(valor || 0);
    if (!v || v === 0) return 'celda-calor celda-calor--vacia';
    if (v < 3) return 'celda-calor celda-calor--baja';
    if (v < 8) return 'celda-calor celda-calor--media';
    if (v < 15) return 'celda-calor celda-calor--alta';
    return 'celda-calor celda-calor--pico';
  }

  protected rangoArchivo(): { from: string; to: string } | null {
    const meta = this.reporte()?.meta;
    if (!meta) return null;
    return { from: meta.rangoActual.from, to: meta.rangoActual.to };
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);

    this.reportesService
      .obtenerMapaCalor(this.tenantId(), this.params())
      .subscribe({
        next: (respuesta) => {
          if (respuesta?.code && respuesta.code >= 400) {
            this.loading.set(false);
            this.reporte.set(null);
            this.error.set(respuesta.message || 'No se pudo cargar el mapa de calor');
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
          this.error.set(err?.error?.message ?? err?.message ?? 'No se pudo cargar el mapa de calor');
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
      .exportarMapaCalor(this.tenantId(), this.params())
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
