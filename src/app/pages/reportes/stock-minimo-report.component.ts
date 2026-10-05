import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { SelectButtonModule } from 'primeng/selectbutton';
import { FormsModule } from '@angular/forms';
import { ReporteBaseComponent } from './reportes-base.component';
import { KpiGridComponent } from './kpi-grid.component';
import { StockMinimoReporteDTO } from './services/reportes.service';

/**
 * Reporte 2.4 - Alertas de Stock Mínimo y Crítico.
 *
 * Muestra el estado del inventario en tiempo real, artículos con nivel bajo o agotados,
 * sugerencia de reabastecimiento y costo estimado de reposición con exportación a Excel.
 */
@Component({
  selector: 'app-stock-minimo-report',
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
    SelectButtonModule,
    KpiGridComponent,
  ],
  templateUrl: './stock-minimo-report.component.html',
  styleUrls: ['./stock-minimo-report.component.scss'],
})
export class StockMinimoReportComponent extends ReporteBaseComponent {
  protected readonly claveArchivo = '2.4_alertas_stock_minimo';

  readonly reporte = signal<StockMinimoReporteDTO | null>(null);

  /** Vista seleccionada para alternar entre Alertas, Lista de Compras e Inventario */
  vistaActual: 'alertas' | 'compras' | 'general' = 'alertas';

  readonly opcionesVista = [
    { label: 'Alertas Activas', value: 'alertas', icon: 'pi pi-exclamation-triangle' },
    { label: 'Lista de Compras', value: 'compras', icon: 'pi pi-shopping-cart' },
    { label: 'Inventario General', value: 'general', icon: 'pi pi-box' },
  ];

  /** Gráfica de distribución de estados */
  readonly stockChartData = computed(() => {
    const kpis = this.reporte()?.kpis ?? [];
    const agotadosKpi = kpis.find((k) => k.key === 'articulos_agotados');
    const criticosKpi = kpis.find((k) => k.key === 'articulos_criticos');
    const totalKpi = kpis.find((k) => k.key === 'total_monitoreados');

    const agotados = Number(agotadosKpi?.actual ?? 0);
    const criticos = Number(criticosKpi?.actual ?? 0);
    const total = Number(totalKpi?.actual ?? 0);
    const normales = Math.max(0, total - agotados - criticos);

    return {
      labels: ['Agotados (Stock 0)', 'Nivel Crítico (<= Mínimo)', 'Stock Saludable'],
      datasets: [
        {
          data: [agotados, criticos, normales],
          backgroundColor: ['#ef4444', '#f59e0b', '#10b981'],
          borderWidth: 0,
        },
      ],
    };
  });

  readonly stockChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right' as const, labels: { usePointStyle: true, boxWidth: 8 } },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${ctx.parsed} artículos`,
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

    this.reportesService.obtenerStockMinimo(this.tenantId()).subscribe({
      next: (respuesta) => {
        if (respuesta?.code && respuesta.code >= 400) {
          this.loading.set(false);
          this.reporte.set(null);
          this.error.set(respuesta.message || 'No se pudieron cargar las alertas de stock');
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
        this.error.set(err?.error?.message ?? err?.message ?? 'No se pudieron cargar las alertas de stock');
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

    this.reportesService.exportarStockMinimo(this.tenantId()).subscribe({
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

  badgeSeverity(estado: string): 'danger' | 'warn' | 'success' | 'info' {
    switch (estado) {
      case 'AGOTADO':
        return 'danger';
      case 'CRITICO':
        return 'warn';
      default:
        return 'success';
    }
  }
}
