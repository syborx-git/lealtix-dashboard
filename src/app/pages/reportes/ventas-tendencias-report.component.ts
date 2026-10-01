import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { ReporteBaseComponent } from './reportes-base.component';
import { KpiGridComponent } from './kpi-grid.component';
import { ReportesFiltrosService } from './services/reportes-filtros.service';
import { TipoColumna, VentasTendenciasDTO } from './services/reportes.service';

/**
 * Reporte 1.1 - Dashboard de Ventas y Tendencias.
 *
 * Solo presenta: los KPIs comparativos, la serie temporal y los desgloses ya
 * vienen calculados por el backend con la comparativa contra el periodo
 * anterior equivalente. Aqui no se recalcula ningun porcentaje.
 */
@Component({
  selector: 'app-ventas-tendencias-report',
  standalone: true,
  imports: [
    CommonModule,
    ChartModule,
    TableModule,
    ButtonModule,
    SkeletonModule,
    TooltipModule,
    KpiGridComponent,
  ],
  templateUrl: './ventas-tendencias-report.component.html',
  styleUrls: ['./ventas-tendencias-report.component.scss'],
})
export class VentasTendenciasReportComponent extends ReporteBaseComponent {
  protected readonly claveArchivo = '1.1_ventas';

  readonly reporte = signal<VentasTendenciasDTO | null>(null);

  readonly granularidadEtiqueta = computed(() => {
    switch (this.filtros.granularidad()) {
      case 'day':
        return 'dia';
      case 'week':
        return 'semana';
      case 'month':
        return 'mes';
      default:
        return this.reporte()?.meta?.granularidad ?? 'dia';
    }
  });

  /** Serie de ingresos netos: periodo actual vs periodo anterior. */
  readonly serieChartData = computed(() => {
    const serie = this.reporte()?.serie ?? [];
    return {
      labels: serie.map((punto) => punto.etiqueta),
      datasets: [
        {
          label: 'Periodo actual',
          data: serie.map((punto) => punto.valor),
          borderColor: '#7c3aed',
          backgroundColor: 'rgba(124, 58, 237, 0.12)',
          fill: true,
          tension: 0.35,
          pointRadius: serie.length > 40 ? 0 : 3,
          borderWidth: 2,
        },
        {
          label: 'Periodo anterior',
          data: serie.map((punto) => punto.valorAnterior),
          borderColor: '#94a3b8',
          backgroundColor: 'transparent',
          borderDash: [6, 4],
          fill: false,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    };
  });

  readonly serieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { position: 'top' as const, labels: { usePointStyle: true, boxWidth: 8 } },
      tooltip: {
        callbacks: {
          label: (contexto: any) =>
            ` ${contexto.dataset.label}: ${this.moneda(Number(contexto.parsed.y ?? contexto.parsed))}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { callback: (valor: any) => this.moneda(Number(valor)) },
        grid: { color: 'rgba(148, 163, 184, 0.18)' },
      },
      x: { grid: { display: false } },
    },
  };

  /** Participacion de cada categoria en el ingreso neto del periodo. */
  readonly categoriaChartData = computed(() => {
    const filas = this.reporte()?.porCategoria?.filas ?? [];
    return {
      labels: filas.map((fila: any) => fila['categoria']),
      datasets: [
        {
          data: filas.map((fila: any) => Number(fila['ingresos'] ?? 0)),
          backgroundColor: [
            '#7c3aed',
            '#a78bfa',
            '#0891b2',
            '#22d3ee',
            '#db2777',
            '#f472b6',
            '#ea580c',
            '#facc15',
          ],
          borderWidth: 0,
        },
      ],
    };
  });

  readonly categoriaChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right' as const, labels: { usePointStyle: true, boxWidth: 8 } },
      tooltip: {
        callbacks: {
          label: (contexto: any) => ` ${this.moneda(Number(contexto.parsed))}`,
        },
      },
    },
  };

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);

    this.reportesService
      .obtenerVentasTendencias(this.tenantId(), this.params())
      .subscribe({
        next: (respuesta) => {
          if (respuesta?.code && respuesta.code >= 400) {
            this.loading.set(false);
            this.reporte.set(null);
            this.error.set(respuesta.message || 'No se pudo cargar el reporte de ventas');
            this.messageService.add({
              severity: 'error',
              summary: 'Error al cargar el reporte',
              detail: this.error() ?? 'Ocurrió un error inesperado al cargar el reporte',
              life: 4000,
            });
            return;
          }
          const obj = respuesta?.object;
          if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
            this.reporte.set(obj);
          } else {
            this.reporte.set(null);
          }
          this.loading.set(false);
        },
        error: (error) => {
          this.loading.set(false);
          this.reporte.set(null);
          this.error.set(error?.error?.message ?? error?.message ?? 'No se pudo cargar el reporte de ventas');
          this.messageService.add({
            severity: 'error',
            summary: 'Error al cargar el reporte',
            detail: this.error() ?? 'Ocurrio un error inesperado al cargar el reporte',
            life: 4000,
          });
        },
      });
  }

  exportar(): void {
    this.exportando.set(true);

    this.reportesService
      .exportarVentasTendencias(this.tenantId(), this.params())
      .subscribe({
        next: (blob) => {
          this.exportando.set(false);
          this.descargar(blob, this.nombreArchivo());
        },
        error: (error) => {
          this.exportando.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'No se pudo exportar',
            detail: error?.error?.message ?? 'El archivo Excel no pudo generarse',
            life: 4000,
          });
        },
      });
  }

  recargar(): void {
    this.cargar();
  }

  protected rangoArchivo(): { from: string; to: string } | null {
    const rango = this.reporte()?.meta?.rangoActual;
    return rango ? { from: rango.from, to: rango.to } : null;
  }
}
