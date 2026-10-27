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
import { RfmReporteDTO } from './services/reportes.service';

/**
 * Reporte 3.1 - Análisis RFM de Clientes.
 *
 * Clasifica la base de comensales en segmentos estratégicos según Recencia (última visita),
 * Frecuencia (visitas acumuladas) y Valor Monetario (gasto total).
 */
@Component({
  selector: 'app-rfm-report',
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
  templateUrl: './rfm-report.component.html',
  styleUrls: ['./rfm-report.component.scss'],
})
export class RfmReportComponent extends ReporteBaseComponent {
  protected readonly claveArchivo = '3.1_analisis_rfm_clientes';

  readonly reporte = signal<RfmReporteDTO | null>(null);

  /** Filtro de búsqueda en la tabla de clientes */
  filtroClientes: string = '';

  /** Gráfica de distribución de clientes por segmento */
  readonly segmentosChartData = computed(() => {
    const puntos = this.reporte()?.distribucionSegmentos ?? [];
    return {
      labels: puntos.map(p => p.etiqueta || p.label || ''),
      datasets: [
        {
          data: puntos.map(p => p.valor),
          backgroundColor: [
            '#10b981', // Campeones
            '#3b82f6', // Leales
            '#8b5cf6', // Prometedores
            '#f59e0b', // En Riesgo
            '#ef4444', // Hibernando / Dormidos
            '#64748b', // Perdidos / Otros
          ],
          borderWidth: 0,
        },
      ],
    };
  });

  readonly segmentosChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right' as const, labels: { usePointStyle: true, boxWidth: 8 } },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${Number(ctx.parsed).toLocaleString()} clientes`,
        },
      },
    },
  };

  /** Gráfica de ingresos por segmento */
  readonly ingresosChartData = computed(() => {
    const puntos = this.reporte()?.ingresosPorSegmento ?? [];
    return {
      labels: puntos.map(p => p.etiqueta || p.label || ''),
      datasets: [
        {
          label: 'Ingresos Totales ($)',
          data: puntos.map(p => p.valor),
          backgroundColor: '#8b5cf6',
          borderRadius: 6,
        },
      ],
    };
  });

  readonly ingresosChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${this.moneda(Number(ctx.parsed.y))}`,
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
      .obtenerRfm(this.tenantId(), this.params())
      .subscribe({
        next: (respuesta) => {
          if (respuesta?.code && respuesta.code >= 400) {
            this.loading.set(false);
            this.reporte.set(null);
            this.error.set(respuesta.message || 'No se pudo cargar el análisis RFM');
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
          this.error.set(err?.error?.message ?? err?.message ?? 'No se pudo cargar el análisis RFM');
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
      .exportarRfm(this.tenantId(), this.params())
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

  segmentoTag(segmento: string): { label: string; severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' } {
    const s = (segmento || '').toUpperCase();
    if (s.includes('CAMPEON')) return { label: segmento, severity: 'success' };
    if (s.includes('LEAL')) return { label: segmento, severity: 'info' };
    if (s.includes('PROMETEDOR') || s.includes('POTENCIAL')) return { label: segmento, severity: 'warn' };
    if (s.includes('RIESGO') || s.includes('DORMIDO') || s.includes('HIBERNANDO')) return { label: segmento, severity: 'danger' };
    return { label: segmento || 'General', severity: 'secondary' };
  }
}
