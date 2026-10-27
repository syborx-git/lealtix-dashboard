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
import { CorteInsumosDTO, ReportesParams } from './services/reportes.service';

/**
 * Reporte 2.1 - Corte Diario de Insumos (Cocina / Barra).
 *
 * Muestra el desplazamiento de platillos vendidos, consumo de materia prima (recetas y subrecetas)
 * y el inventario disponible al cierre, con separación entre Cocina y Barra,
 * comparativas gráficas de movimiento y exportación completa a Excel.
 */
@Component({
  selector: 'app-corte-insumos-report',
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
  templateUrl: './corte-insumos-report.component.html',
  styleUrls: ['./corte-insumos-report.component.scss'],
})
export class CorteInsumosReportComponent extends ReporteBaseComponent {
  protected readonly claveArchivo = '2.1_corte_insumos';

  readonly reporte = signal<CorteInsumosDTO | null>(null);
  readonly areaFiltro = signal<'TODOS' | 'COCINA' | 'BARRA'>('TODOS');
  readonly pestanaActiva = signal<'platillos' | 'insumos' | 'stock'>('platillos');

  // Filtros de búsqueda para tablas
  searchPlatillos = '';
  searchInsumos = '';
  searchStock = '';

  /** Gráfica Horizontal de Top Platillos Más Desplazados (por volumen) */
  readonly platillosChartData = computed(() => {
    const data = this.reporte()?.topPlatillos ?? [];
    return {
      labels: data.map(d => d.etiqueta || d.label || 'Platillo'),
      datasets: [
        {
          label: 'Unidades Vendidas',
          data: data.map(d => Number(d.valor ?? 0)),
          backgroundColor: '#8b5cf6',
          borderRadius: 6,
          barThickness: 20,
        },
      ],
    };
  });

  readonly platillosChartOptions = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const data = this.reporte()?.topPlatillos ?? [];
            const item = data[ctx.dataIndex];
            const unidades = ctx.parsed.x;
            const extra = item?.valorMoneda ? ` (${this.moneda(Number(item.valorMoneda))} en ventas)` : '';
            return ` ${unidades} unidades vendidas${extra}`;
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: '#f1f5f9' },
        ticks: { color: '#64748b' },
      },
      y: {
        grid: { display: false },
        ticks: { color: '#334155', font: { weight: '600' as const } },
      },
    },
  };

  /** Gráfica Horizontal de Top Insumos Más Movidos / Consumidos */
  readonly insumosChartData = computed(() => {
    const data = this.reporte()?.topInsumos ?? [];
    const tieneCosto = data.some(d => Number(d.valorMoneda ?? 0) > 0);
    return {
      labels: data.map(d => d.etiqueta || d.label || 'Insumo'),
      datasets: [
        {
          label: tieneCosto ? 'Costo Total Consumido ($)' : 'Consumo Total',
          data: data.map(d => (tieneCosto ? Number(d.valorMoneda ?? 0) : Number(d.valor ?? 0))),
          backgroundColor: '#06b6d4',
          borderRadius: 6,
          barThickness: 20,
        },
      ],
    };
  });

  readonly insumosChartOptions = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const data = this.reporte()?.topInsumos ?? [];
            const item = data[ctx.dataIndex];
            if (!item) return '';
            const unidad = item.unidad || item.subtexto || 'pz';
            const cantidad = `${this.numero(Number(item.valor ?? 0))} ${unidad}`;
            const costo = Number(item.valorMoneda ?? 0) > 0 ? ` · Costo: ${this.moneda(Number(item.valorMoneda))}` : '';
            return ` Consumo: ${cantidad}${costo}`;
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: '#f1f5f9' },
        ticks: {
          color: '#64748b',
          callback: (value: any) => {
            const data = this.reporte()?.topInsumos ?? [];
            const tieneCosto = data.some(d => Number(d.valorMoneda ?? 0) > 0);
            return tieneCosto ? `$${value}` : `${value}`;
          },
        },
      },
      y: {
        grid: { display: false },
        ticks: { color: '#334155', font: { weight: '600' as const } },
      },
    },
  };

  protected override params(): ReportesParams {
    return {
      ...super.params(),
      area: this.areaFiltro(),
    };
  }

  protected rangoArchivo(): { from: string; to: string } | null {
    const meta = this.reporte()?.meta;
    if (!meta) return null;
    return { from: meta.rangoActual.from, to: meta.rangoActual.to };
  }

  cambiarArea(area: 'TODOS' | 'COCINA' | 'BARRA'): void {
    if (this.areaFiltro() === area) return;
    this.areaFiltro.set(area);
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);

    this.reportesService
      .obtenerCorteInsumos(this.tenantId(), this.params())
      .subscribe({
        next: (respuesta) => {
          if (respuesta?.code && respuesta.code >= 400) {
            this.loading.set(false);
            this.reporte.set(null);
            this.error.set(respuesta.message || 'No se pudo cargar el corte de insumos');
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
          this.error.set(err?.error?.message ?? err?.message ?? 'No se pudo cargar el corte de insumos');
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
      .exportarCorteInsumos(this.tenantId(), this.params())
      .subscribe({
        next: (blob) => {
          this.exportando.set(false);
          this.descargar(blob, this.nombreArchivo());
          this.messageService.add({
            severity: 'success',
            summary: 'Exportación completada',
            detail: 'Se descargó el reporte de corte de insumos correctamente.',
            life: 3500,
          });
        },
        error: (err) => {
          this.exportando.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Error al exportar',
            detail: err?.message ?? 'No se pudo generar el archivo Excel.',
            life: 4500,
          });
        },
      });
  }

  recargar(): void {
    this.cargar();
  }
}
