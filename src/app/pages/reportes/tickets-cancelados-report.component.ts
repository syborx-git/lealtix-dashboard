import { Component, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DividerModule } from 'primeng/divider';
import { ReporteBaseComponent } from './reportes-base.component';
import { KpiGridComponent } from './kpi-grid.component';
import { AuditoriaTicketsCanceladosDTO } from './services/reportes.service';
import { OrderService } from '@/pages/comandix/services/order.service';

/**
 * Reporte 4.1 - Auditoría de Tickets Cancelados.
 *
 * Muestra el registro histórico y métricas clave de cancelaciones de comandas/tickets:
 * - KPIs de tickets cancelados, monto cancelado, ticket promedio cancelado y tasa de cancelación %.
 * - Distribución por motivo de cancelación con gráfica de dona.
 * - Conciliación por responsable/cajero que ejecutó la cancelación.
 * - Detalle cronológico auditable con buscador y botón de inspección modal con desglose completo de platillos.
 */
@Component({
  selector: 'app-tickets-cancelados-report',
  standalone: true,
  imports: [
    CommonModule,
    ChartModule,
    TableModule,
    ButtonModule,
    SkeletonModule,
    TooltipModule,
    TagModule,
    DialogModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    ProgressSpinnerModule,
    DividerModule,
    KpiGridComponent,
  ],
  templateUrl: './tickets-cancelados-report.component.html',
  styleUrls: ['./tickets-cancelados-report.component.scss'],
})
export class TicketsCanceladosReportComponent extends ReporteBaseComponent {
  protected readonly claveArchivo = '4.1_auditoria_tickets_cancelados';

  private orderService = inject(OrderService);

  readonly reporte = signal<AuditoriaTicketsCanceladosDTO | null>(null);

  // Estado del modal de detalle de ticket
  readonly detalleModalVisible = signal<boolean>(false);
  readonly ticketSeleccionado = signal<any | null>(null);
  readonly cargandoDetalleTicket = signal<boolean>(false);
  readonly ordenDetalleCompleto = signal<any | null>(null);

  /** Distribución de cancelaciones por motivo (Gráfica de Dona). */
  readonly motivoChartData = computed(() => {
    const filas = this.reporte()?.porMotivo?.filas ?? [];
    return {
      labels: filas.map((f: any) => f['motivo']),
      datasets: [
        {
          data: filas.map((f: any) => Number(f['total'] ?? 0)),
          backgroundColor: [
            '#ef4444', // Red
            '#f59e0b', // Amber
            '#8b5cf6', // Violet
            '#06b6d4', // Cyan
            '#ec4899', // Pink
            '#64748b', // Slate
            '#10b981', // Emerald
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
            return fila ? ` ${fila['operaciones']} tickets (${fila['pct']}%)` : '';
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
      .obtenerTicketsCancelados(this.tenantId(), this.params())
      .subscribe({
        next: (respuesta) => {
          if (respuesta?.code && respuesta.code >= 400) {
            this.loading.set(false);
            this.reporte.set(null);
            this.error.set(respuesta.message || 'No se pudo cargar la auditoría de tickets cancelados');
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
          this.error.set(err?.error?.message ?? err?.message ?? 'No se pudo cargar la auditoría de tickets cancelados');
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
      .exportarTicketsCancelados(this.tenantId(), this.params())
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

  /**
   * Abre el modal de auditoría detallada de un ticket cancelado.
   * Carga el desglose completo de platillos consumidos desde el servicio de órdenes.
   */
  abrirDetalle(fila: any): void {
    this.ticketSeleccionado.set(fila);
    this.ordenDetalleCompleto.set(null);
    this.detalleModalVisible.set(true);

    const orderId = fila?.['id'];
    if (!orderId) return;

    this.cargandoDetalleTicket.set(true);
    this.orderService.getOrderById(orderId).subscribe({
      next: (resp) => {
        this.cargandoDetalleTicket.set(false);
        const order = resp?.object || resp;
        this.ordenDetalleCompleto.set(order);
      },
      error: (err) => {
        this.cargandoDetalleTicket.set(false);
        console.warn('No se pudo cargar el detalle individual de la orden:', err);
      },
    });
  }

  cerrarDetalle(): void {
    this.detalleModalVisible.set(false);
    this.ticketSeleccionado.set(null);
    this.ordenDetalleCompleto.set(null);
  }

  recargar(): void {
    this.cargar();
  }
}
