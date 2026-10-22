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
import { KardexReporteDTO } from './services/reportes.service';

/**
 * Reporte 2.2 - Kardex de Insumos.
 *
 * Muestra el balance integral de movimientos de inventario: entradas de compras,
 * consumo derivado de ventas en comanda y mermas operativas/administrativas.
 */
@Component({
  selector: 'app-kardex-report',
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
  templateUrl: './kardex-report.component.html',
  styleUrls: ['./kardex-report.component.scss'],
})
export class KardexReportComponent extends ReporteBaseComponent {
  protected readonly claveArchivo = '2.2_kardex_insumos';

  readonly reporte = signal<KardexReporteDTO | null>(null);

  /** Filtro de búsqueda en la tabla de insumos */
  filtroInsumos: string = '';
  /** Filtro de búsqueda en el detalle cronológico */
  filtroDetalle: string = '';
  /** Filtro de búsqueda en las transferencias a áreas */
  filtroTransferencias: string = '';

  /** Gráfica de distribución de movimientos */
  readonly distribucionChartData = computed(() => {
    const puntos = this.reporte()?.distribucionMovimientos ?? [];
    return {
      labels: puntos.map(p => p.etiqueta || p.label || ''),
      datasets: [
        {
          data: puntos.map(p => p.valor),
          backgroundColor: ['#10b981', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6'],
          borderWidth: 0,
        },
      ],
    };
  });

  readonly distribucionChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right' as const, labels: { usePointStyle: true, boxWidth: 8 } },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${this.moneda(Number(ctx.parsed))}`,
        },
      },
    },
  };

  /** Gráfica de top insumos por rotación / consumo */
  readonly topInsumosChartData = computed(() => {
    const puntos = this.reporte()?.topInsumosRotacion ?? [];
    return {
      labels: puntos.map(p => p.etiqueta || p.label || ''),
      datasets: [
        {
          label: 'Valor monetario ($)',
          data: puntos.map(p => p.valor),
          backgroundColor: '#06b6d4',
          borderRadius: 6,
        },
      ],
    };
  });

  readonly topInsumosChartOptions = {
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

  protected rangoArchivo(): { from: string; to: string } | null {
    const meta = this.reporte()?.meta;
    if (!meta) return null;
    return { from: meta.rangoActual.from, to: meta.rangoActual.to };
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);

    this.reportesService
      .obtenerKardex(this.tenantId(), this.params())
      .subscribe({
        next: (respuesta) => {
          if (respuesta?.code && respuesta.code >= 400) {
            this.loading.set(false);
            this.reporte.set(null);
            this.error.set(respuesta.message || 'No se pudo cargar el Kardex de insumos');
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
          this.error.set(err?.error?.message ?? err?.message ?? 'No se pudo cargar el Kardex de insumos');
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
      .exportarKardex(this.tenantId(), this.params())
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

  tipoMovimientoBadge(tipo: string): { label: string; severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' } {
    const t = (tipo || '').toUpperCase();
    if (t.includes('ENTRADA') || t.includes('RESTOCK') || t.includes('COMPRA')) {
      return { label: 'Entrada / Restock', severity: 'success' };
    }
    if (t.includes('VENTA') || t.includes('CONSUMO')) {
      return { label: 'Consumo Venta', severity: 'info' };
    }
    if (t.includes('MERMA')) {
      return { label: 'Merma', severity: 'danger' };
    }
    return { label: tipo || 'Movimiento', severity: 'secondary' };
  }

  areaTransferenciaBadge(destino: string): { label: string; severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' } {
    const d = (destino || '').toUpperCase();
    if (d.includes('COCINA')) {
      return { label: 'Cocina', severity: 'info' };
    }
    if (d.includes('BARRA')) {
      return { label: 'Barra', severity: 'warn' };
    }
    return { label: destino || 'Área', severity: 'secondary' };
  }
}
