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
import { ReporteBaseComponent } from './reportes-base.component';
import { KpiGridComponent } from './kpi-grid.component';
import { AuditoriaMermasDTO } from './services/reportes.service';

/**
 * Reporte 2.3 - Auditoria de Mermas.
 *
 * Visualiza el costo total de salidas no-venta, KPIs comparativos, desglose
 * por motivo de merma, trazabilidad por responsable y detalle cronológico completo.
 */
@Component({
  selector: 'app-mermas-auditoria-report',
  standalone: true,
  imports: [
    CommonModule,
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
  templateUrl: './mermas-auditoria-report.component.html',
  styleUrls: ['./mermas-auditoria-report.component.scss'],
})
export class MermasAuditoriaReportComponent extends ReporteBaseComponent {
  protected readonly claveArchivo = '2.3_auditoria_mermas';

  readonly reporte = signal<AuditoriaMermasDTO | null>(null);

  /** Distribución de pérdidas por motivo en el periodo actual. */
  readonly motivoChartData = computed(() => {
    const filas = this.reporte()?.porMotivo?.filas ?? [];
    return {
      labels: filas.map((f: any) => f['motivo']),
      datasets: [
        {
          data: filas.map((f: any) => Number(f['costoTotal'] ?? 0)),
          backgroundColor: [
            '#ef4444',
            '#f59e0b',
            '#8b5cf6',
            '#06b6d4',
            '#ec4899',
            '#10b981',
            '#64748b',
          ],
          borderWidth: 0,
        },
      ],
    };
  });

  readonly motivoChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right' as const, labels: { usePointStyle: true, boxWidth: 8 } },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${this.moneda(Number(ctx.parsed))}`,
          afterLabel: (ctx: any) => {
            const filas = this.reporte()?.porMotivo?.filas ?? [];
            const fila = filas[ctx.dataIndex];
            return fila ? ` ${fila['eventos']} registros (${fila['participacion']}%)` : '';
          },
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
      .obtenerMermas(this.tenantId(), this.params())
      .subscribe({
        next: (respuesta) => {
          if (respuesta?.code && respuesta.code >= 400) {
            this.loading.set(false);
            this.reporte.set(null);
            this.error.set(respuesta.message || 'No se pudo cargar la auditoría de mermas');
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
          this.error.set(err?.error?.message ?? err?.message ?? 'No se pudo cargar la auditoría de mermas');
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
      .exportarMermas(this.tenantId(), this.params())
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
