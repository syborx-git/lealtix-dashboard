import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, firstValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// PrimeNG
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { InputTextModule } from 'primeng/inputtext';
import { DividerModule } from 'primeng/divider';

// Componentes
import { SplitOrderModalComponent } from '@/pages/comandix/components/split-order-modal/split-order-modal.component';

// Servicios y Modelos
import { CajaService } from './services/caja.service';
import { OrderService } from '@/pages/comandix/services/order.service';
import { AuthService } from '@/auth/auth.service';
import {
  TurnoDTO,
  ComandaCajaRow,
  TableroCaja,
  TicketPrecuenta,
  ResumenTurnoCorte,
  CorteMesero,
  MeseroSimple
} from './models/caja.model';
import { PendingOrder, PendingOrderItem, OrderStatus, ReporteVentaRow, TipInfo } from '@/pages/comandix/models/order.model';

@Component({
  selector: 'app-caja',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ToastModule,
    DialogModule,
    ButtonModule,
    TagModule,
    TooltipModule,
    TableModule,
    ProgressSpinnerModule,
    InputTextModule,
    DividerModule,
    SplitOrderModalComponent
  ],
  providers: [MessageService],
  templateUrl: './caja.component.html',
  styleUrls: ['./caja.component.scss']
})
export class CajaComponent implements OnInit, OnDestroy {
  private cajaService = inject(CajaService);
  private orderService = inject(OrderService);
  private authService = inject(AuthService);
  private messageService = inject(MessageService);

  private destroy$ = new Subject<void>();
  private pollingTimer: any = null;

  tenantId = 0;
  userId = 0;
  userName = '';
  userRole = '';

  // Estados principales
  vistaActiva = signal<'tablero' | 'cerradas' | 'canceladas' | 'cortes_propinas' | 'reporte'>('tablero');
  loading = signal<boolean>(false);
  procesando = signal<boolean>(false);

  turnoActivo = signal<TurnoDTO | null>(null);
  tablero = signal<TableroCaja>({ cuentasAbiertas: [], cuentasPorCobrar: [] });

  // Historial de Comandas (Cerradas / Canceladas)
  todasComandas = signal<PendingOrder[]>([]);
  loadingHistorial = signal<boolean>(false);
  busquedaCerradas = signal<string>('');
  busquedaCanceladas = signal<string>('');

  comandasCerradas = computed(() =>
    this.todasComandas().filter(o => (o.estado || '').toUpperCase() === 'PAGADA')
  );

  comandasCanceladas = computed(() =>
    this.todasComandas().filter(o => {
      const st = (o.estado || '').toUpperCase();
      return st === 'CANCELADA' || st === 'RECHAZADO';
    })
  );

  cerradasFiltradas = computed(() => {
    const q = this.busquedaCerradas().toLowerCase().trim();
    if (!q) return this.comandasCerradas();
    return this.comandasCerradas().filter(o =>
      (o.id || '').toLowerCase().includes(q) ||
      (o.mesaNombre || '').toLowerCase().includes(q) ||
      (o.meseroNombre || '').toLowerCase().includes(q) ||
      (o.customerName || o.nombre || '').toLowerCase().includes(q)
    );
  });

  canceladasFiltradas = computed(() => {
    const q = this.busquedaCanceladas().toLowerCase().trim();
    if (!q) return this.comandasCanceladas();
    return this.comandasCanceladas().filter(o =>
      (o.id || '').toLowerCase().includes(q) ||
      (o.mesaNombre || '').toLowerCase().includes(q) ||
      (o.meseroNombre || '').toLowerCase().includes(q) ||
      (o.customerName || o.nombre || '').toLowerCase().includes(q)
    );
  });

  // Reporte General de Ventas y Comandas
  reporteFiltroFecha = signal<'hoy' | 'semana' | 'todos'>('hoy');
  reporteFiltroBusqueda = signal<string>('');

  reporteComandas = computed<ReporteVentaRow[]>(() => {
    const orders = this.todasComandas();
    const filtroFecha = this.reporteFiltroFecha();
    const busqueda = (this.reporteFiltroBusqueda() || '').toLowerCase().trim();

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const semanaAtras = new Date(hoy);
    semanaAtras.setDate(semanaAtras.getDate() - 7);

    return orders
      .filter((o) => {
        if (filtroFecha === 'hoy') {
          const f = o.horaApertura || o.fechaCreacion;
          if (!f) return true;
          const d = new Date(f);
          d.setHours(0, 0, 0, 0);
          return d.getTime() === hoy.getTime();
        } else if (filtroFecha === 'semana') {
          const f = o.horaApertura || o.fechaCreacion;
          if (!f) return true;
          const d = new Date(f);
          return d >= semanaAtras;
        }
        return true;
      })
      .map((o) => {
        const clienteNombre = o.customerName || o.nombre || (o.customerId ? 'Cliente #' + o.customerId : 'Cliente no registrado');
        const mesaLabel = o.mesaNombre ? `${o.mesaNombre}${o.mesaNumero ? ' (M-' + o.mesaNumero + ')' : ''}` : 'Mesa General';
        const meseroLabel = o.meseroNombre || (o.payment?.paidBy ? String(o.payment.paidBy) : 'Mesero General');
        const horaApertura = o.horaApertura || o.fechaCreacion || new Date().toISOString();
        const horaCierre = o.horaCierre || (o.payment?.paidAt ? o.payment.paidAt : null);
        const totalPagado = o.totalFinal ?? o.subtotal ?? 0;

        return {
          id_comanda: o.id,
          folio_comanda: o.id.length > 8 ? o.id.slice(0, 8).toUpperCase() : o.id,
          hora_apertura: horaApertura,
          hora_cierre: horaCierre,
          mesa_nombre: mesaLabel,
          mesa_numero: o.mesaNumero,
          mesero_nombre: meseroLabel,
          cliente_nombre: clienteNombre,
          total_pagado: totalPagado,
          estado_comanda: o.estado,
          subcomandas: o.subcomandas
        };
      })
      .filter((row) => {
        if (!busqueda) return true;
        return (
          row.folio_comanda.toLowerCase().includes(busqueda) ||
          row.cliente_nombre.toLowerCase().includes(busqueda) ||
          row.mesero_nombre.toLowerCase().includes(busqueda) ||
          row.mesa_nombre.toLowerCase().includes(busqueda)
        );
      });
  });

  reporteTotalVendido = computed(() => {
    return this.reporteComandas()
      .filter((r) => (r.estado_comanda || '').toUpperCase() === 'PAGADA')
      .reduce((sum, r) => sum + (r.total_pagado || 0), 0);
  });

  reporteTotalComandas = computed(() => {
    return this.reporteComandas().length;
  });

  reporteTicketPromedio = computed(() => {
    const pagadas = this.reporteComandas().filter((r) => (r.estado_comanda || '').toUpperCase() === 'PAGADA');
    return pagadas.length > 0 ? this.reporteTotalVendido() / pagadas.length : 0;
  });

  // Modal Abrir Turno
  modalAbrirTurnoVisible = signal<boolean>(false);
  fondoInicialInput = 0;
  observacionesApertura = '';

  // Modal Cerrar Turno (Corte de Turno)
  modalCerrarTurnoVisible = signal<boolean>(false);
  resumenCorte = signal<ResumenTurnoCorte | null>(null);
  efectivoDeclaradoInput = 0;
  observacionesCierre = '';

  // Modal Ticket Pre-cuenta
  modalTicketVisible = signal<boolean>(false);
  ticketActual = signal<TicketPrecuenta | null>(null);

  // Modal de Pago / Cobro
  modalPagoVisible = signal<boolean>(false);
  comandaSeleccionada = signal<ComandaCajaRow | null>(null);
  metodoPagoSeleccionado = 'EFECTIVO';
  montoCuentaInput = 0;
  montoPropinaInput = 0;
  referenciaPagoInput = '';
  efectivoRecibidoInput = 0;

  // Modal Detalle de Orden
  modalDetalleVisible = signal<boolean>(false);
  selectedOrderDetalle = signal<PendingOrder | null>(null);

  // Modal Cancelar Comanda
  modalCancelarVisible = signal<boolean>(false);
  comandaACancelar = signal<{ id: string; folio: string; mesaNombre?: string; total: number } | null>(null);
  motivoCancelacion = '';

  // Modal Dividir Comanda (Split)
  modalSplitVisible = signal<boolean>(false);
  orderParaSplit = signal<PendingOrder | null>(null);
  splitOrderTip = signal<TipInfo | null>(null);

  // Vista Corte Meseros & Propinas
  meseros = signal<MeseroSimple[]>([]);
  meseroSeleccionadoId: number | null = null;
  corteMesero = signal<CorteMesero | null>(null);
  retencionPropinasPorc = 15; // 15% retención por defecto para cocina/barra

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    this.tenantId = user?.tenantId || 0;
    this.userId = user?.id || 0;
    this.userName = user?.nombre || user?.userName || user?.email || 'Cajero';
    this.userRole = (user?.rol || user?.role || '').toUpperCase();

    if (this.tenantId > 0) {
      this.cargarDatosIniciales();
      this.iniciarPolling();
    }
  }

  ngOnDestroy(): void {
    this.detenerPolling();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private iniciarPolling(): void {
    this.pollingTimer = setInterval(() => {
      if (this.vistaActiva() === 'tablero') {
        this.cargarTablero(false);
      }
    }, 20000);
  }

  private detenerPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  async cargarDatosIniciales(): Promise<void> {
    this.loading.set(true);
    try {
      await Promise.all([
        this.cargarTurnoActivo(),
        this.cargarTablero(false),
        this.cargarMeseros(),
        this.cargarHistorialComandas(false)
      ]);
    } catch (error) {
      console.error('Error cargando datos de caja:', error);
    } finally {
      this.loading.set(false);
    }
  }

  async cargarTurnoActivo(): Promise<void> {
    try {
      const resp = await firstValueFrom(this.cajaService.getTurnoActivo(this.tenantId, this.userId));
      this.turnoActivo.set(resp.object || resp.data || null);
    } catch (e) {
      console.warn('Sin turno activo o error:', e);
      this.turnoActivo.set(null);
    }
  }

  async cargarTablero(showLoading = true): Promise<void> {
    if (showLoading) this.loading.set(true);
    try {
      const resp = await firstValueFrom(this.cajaService.getTablero(this.tenantId));
      this.tablero.set(resp.object || resp.data || { cuentasAbiertas: [], cuentasPorCobrar: [] });
    } catch (e) {
      console.error('Error cargando tablero de caja:', e);
    } finally {
      if (showLoading) this.loading.set(false);
    }
  }

  async cargarMeseros(): Promise<void> {
    try {
      const resp = await firstValueFrom(this.cajaService.getMeseros(this.tenantId));
      this.meseros.set(resp.object || resp.data || []);
    } catch (e) {
      console.warn('Error cargando meseros:', e);
    }
  }

  // ==================== APERTURA DE TURNO ====================

  abrirModalApertura(): void {
    this.fondoInicialInput = 0;
    this.observacionesApertura = '';
    this.modalAbrirTurnoVisible.set(true);
  }

  async confirmarAbrirTurno(): Promise<void> {
    if (this.fondoInicialInput < 0) {
      this.messageService.add({ severity: 'warn', summary: 'Fondo Inválido', detail: 'El fondo inicial no puede ser negativo' });
      return;
    }

    this.procesando.set(true);
    try {
      const resp = await firstValueFrom(this.cajaService.abrirTurno({
        tenantId: this.tenantId,
        cajeroId: this.userId,
        fondoInicial: this.fondoInicialInput,
        observaciones: this.observacionesApertura
      }));

      const nuevoTurno = resp.object || resp.data;
      this.turnoActivo.set(nuevoTurno || null);
      this.modalAbrirTurnoVisible.set(false);

      this.messageService.add({
        severity: 'success',
        summary: 'Turno Abierto',
        detail: `Turno de caja iniciado con fondo de $${this.fondoInicialInput.toFixed(2)}`
      });
      await this.cargarTablero();
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Error al abrir turno';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.procesando.set(false);
    }
  }

  // ==================== CIERRE DE TURNO (CORTE) ====================

  async abrirModalCierre(): Promise<void> {
    const turno = this.turnoActivo();
    if (!turno) return;

    this.procesando.set(true);
    try {
      const resp = await firstValueFrom(this.cajaService.getResumenTurno(turno.idTurno, this.tenantId));
      const resumen = resp.object || resp.data || null;
      this.resumenCorte.set(resumen);
      this.efectivoDeclaradoInput = resumen?.efectivoEsperadoEnCaja || 0;
      this.observacionesCierre = '';
      this.modalCerrarTurnoVisible.set(true);
    } catch (e: any) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo generar el arqueo del turno' });
    } finally {
      this.procesando.set(false);
    }
  }

  get diferenciaCorte(): number {
    const esperado = this.resumenCorte()?.efectivoEsperadoEnCaja || 0;
    return (this.efectivoDeclaradoInput || 0) - esperado;
  }

  async confirmarCerrarTurno(): Promise<void> {
    const turno = this.turnoActivo();
    if (!turno) return;

    this.procesando.set(true);
    try {
      await firstValueFrom(this.cajaService.cerrarTurno({
        tenantId: this.tenantId,
        idTurno: turno.idTurno,
        totalEfectivoDeclarado: this.efectivoDeclaradoInput,
        observaciones: this.observacionesCierre
      }));

      this.modalCerrarTurnoVisible.set(false);
      this.turnoActivo.set(null);
      this.resumenCorte.set(null);

      this.messageService.add({
        severity: 'success',
        summary: 'Caja Cerrada',
        detail: 'Turno cerrado y corte registrado exitosamente'
      });
      await this.cargarTablero();
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Error al cerrar turno';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.procesando.set(false);
    }
  }

  // ==================== PRE-CUENTA (IMPRIMIR TICKET) ====================

  async imprimirTicket(comanda: ComandaCajaRow): Promise<void> {
    this.procesando.set(true);
    try {
      const resp = await firstValueFrom(this.cajaService.imprimirTicket(comanda.id, this.tenantId));
      const ticket = resp.object || resp.data;
      this.ticketActual.set(ticket || null);
      this.modalTicketVisible.set(true);

      // Actualizar tablero local
      await this.cargarTablero(false);

      this.messageService.add({
        severity: 'info',
        summary: 'Ticket en Mesa',
        detail: `Pre-cuenta de ${comanda.mesaNombre} generada. La comanda pasó a estado "Por Cobrar".`
      });
    } catch (err: any) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo generar el ticket de pre-cuenta' });
    } finally {
      this.procesando.set(false);
    }
  }

  imprimirVentanaTicket(): void {
    window.print();
  }

  // ==================== COBRO DE COMANDA ====================

  abrirModalCobro(comanda: ComandaCajaRow): void {
    if (!this.turnoActivo()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Caja Cerrada',
        detail: 'Debes abrir un turno de caja antes de recibir pagos.'
      });
      return;
    }

    this.comandaSeleccionada.set(comanda);
    this.metodoPagoSeleccionado = 'EFECTIVO';
    this.montoCuentaInput = comanda.total;
    this.montoPropinaInput = 0;
    this.referenciaPagoInput = '';
    this.efectivoRecibidoInput = comanda.total;
    this.modalPagoVisible.set(true);
  }

  aplicarPropinaRapida(porcentaje: number): void {
    const base = this.montoCuentaInput || 0;
    this.montoPropinaInput = Math.round(base * porcentaje * 100) / 100;
  }

  get cambioEfectivo(): number {
    const totalPagar = (this.montoCuentaInput || 0) + (this.montoPropinaInput || 0);
    const recibido = this.efectivoRecibidoInput || 0;
    return Math.max(0, recibido - totalPagar);
  }

  async procesarCobro(): Promise<void> {
    const comanda = this.comandaSeleccionada();
    if (!comanda) return;

    if (this.montoCuentaInput <= 0) {
      this.messageService.add({ severity: 'warn', summary: 'Monto inválido', detail: 'El monto de la cuenta debe ser mayor a 0' });
      return;
    }

    this.procesando.set(true);
    try {
      await firstValueFrom(this.cajaService.cobrarComanda(comanda.id, {
        tenantId: this.tenantId,
        cajeroId: this.userId,
        metodoPago: this.metodoPagoSeleccionado,
        montoCuenta: this.montoCuentaInput,
        montoPropina: this.montoPropinaInput,
        referencia: this.referenciaPagoInput
      }));

      this.modalPagoVisible.set(false);
      this.comandaSeleccionada.set(null);

      this.messageService.add({
        severity: 'success',
        summary: 'Pago Procesado',
        detail: `Cuenta de ${comanda.mesaNombre} cobrada exitosamente ($${(this.montoCuentaInput + this.montoPropinaInput).toFixed(2)})`
      });

      await Promise.all([
        this.cargarTurnoActivo(),
        this.cargarTablero(false),
        this.cargarHistorialComandas(false)
      ]);
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Error procesando el pago';
      this.messageService.add({ severity: 'error', summary: 'Error de Cobro', detail: msg });
    } finally {
      this.procesando.set(false);
    }
  }

  // ==================== HISTORIAL Y GESTIÓN DE COMANDAS ====================

  async cargarHistorialComandas(showLoading = false): Promise<void> {
    if (this.tenantId <= 0) return;
    if (showLoading) this.loadingHistorial.set(true);
    try {
      const resp = await firstValueFrom(
        this.orderService.getOrdersByTenant(this.tenantId, undefined, 0, 100)
      );
      const rawOrders = (resp as any)?.object?.content ?? (resp as any)?.object ?? [];
      const mappedOrders: PendingOrder[] = (rawOrders || []).map((order: any) => this.mapBackendOrder(order));
      this.todasComandas.set(mappedOrders);
    } catch (error) {
      console.error('Error cargando historial de comandas en caja:', error);
    } finally {
      if (showLoading) this.loadingHistorial.set(false);
    }
  }

  cambiarVista(nuevaVista: 'tablero' | 'cerradas' | 'canceladas' | 'cortes_propinas' | 'reporte'): void {
    this.vistaActiva.set(nuevaVista);
    if (nuevaVista === 'tablero') {
      this.cargarTablero();
    } else if (nuevaVista === 'cerradas' || nuevaVista === 'canceladas' || nuevaVista === 'reporte') {
      this.cargarHistorialComandas(true);
    } else if (nuevaVista === 'cortes_propinas') {
      this.cargarMeseros();
    }
  }

  private mapBackendOrder(order: any): PendingOrder {
    const mesaId = order.idMesa ?? order.mesaId;
    const mesaNombre = order.mesaNombre ?? (mesaId ? `Mesa #${mesaId}` : undefined);
    const mesaNumero = order.mesaNumero;
    const meseroNombre = order.meseroNombre ?? (order.idMesero ? `Mesero #${order.idMesero}` : undefined);
    const horaApertura = order.horaApertura ?? order.fecha ?? order.createdAt;
    const horaCierre = order.horaCierre ?? order.paidAt;

    const items = (order.items ?? []).map((it: any) => {
      let alias = it.asientoAlias;
      let comentarios = it.comentarios;
      if (!alias && comentarios && comentarios.startsWith('[')) {
        const m = comentarios.match(/^\[(.*?)\]\s*(.*)$/);
        if (m) {
          alias = m[1];
          comentarios = m[2];
        }
      }
      return {
        ...it,
        comentarios,
        asientoId: it.idAsiento ?? it.asientoId,
        asientoAlias: alias
      };
    });

    return {
      id: order.id,
      tenantId: order.tenantId,
      estado: this.normalizeOrderStatus(order.estado),
      customerId: order.customerId ?? null,
      customerName: order.customerName ?? null,
      nombre: order.customerName ?? null,
      items,
      subtotal: order.subtotal ?? 0,
      descuento: order.descuento ?? 0,
      totalFinal: order.total ?? order.totalFinal ?? 0,
      couponCode: order.couponCode ?? null,
      coupon_id: order.couponId ?? null,
      fechaCreacion: order.fecha ?? order.createdAt,
      mesaId,
      mesaNombre,
      mesaNumero,
      meseroNombre,
      horaApertura,
      horaCierre,
      subcomandas: order.subcomandas ?? [],
      payment: {
        method: order.paymentMethod,
        reference: order.paymentReference ?? null,
        paidAt: order.paidAt,
        paidBy: order.paidBy
      }
    };
  }

  private normalizeOrderStatus(status: string | undefined): OrderStatus {
    const normalized = (status ?? '').toUpperCase();
    if (normalized === 'CONFIRMED') return 'CONFIRMADA';
    if (normalized === 'IN_PROGRESS') return 'EN_PREPARACION';
    if (normalized === 'READY' || normalized === 'DESPACHADO') return 'LISTO';
    if (normalized === 'PAID') return 'PAGADA';
    if (normalized === 'CANCELLED') return 'CANCELADA';
    if (normalized === 'REJECTED') return 'RECHAZADO';
    return (normalized as OrderStatus) || 'PENDIENTE';
  }

  // ==================== DETALLE DE ORDEN ====================

  async abrirDetalleOrden(order: PendingOrder | ComandaCajaRow): Promise<void> {
    if ('items' in order && Array.isArray((order as any).items)) {
      this.selectedOrderDetalle.set(order as PendingOrder);
      this.modalDetalleVisible.set(true);
      return;
    }

    const found = this.todasComandas().find(o => o.id === order.id);
    if (found && found.items && found.items.length > 0) {
      this.selectedOrderDetalle.set(found);
      this.modalDetalleVisible.set(true);
      return;
    }

    try {
      this.loading.set(true);
      const resp = await firstValueFrom(this.orderService.getOrderById(order.id));
      const fullOrder = (resp as any)?.object || (resp as any)?.data || resp;
      if (fullOrder) {
        const mapped = this.mapBackendOrder(fullOrder);
        this.selectedOrderDetalle.set(mapped);
        this.modalDetalleVisible.set(true);
      }
    } catch (e) {
      console.error('Error obteniendo detalle de comanda:', e);
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el detalle de la comanda' });
    } finally {
      this.loading.set(false);
    }
  }

  cerrarDetalleOrden(): void {
    this.modalDetalleVisible.set(false);
    this.selectedOrderDetalle.set(null);
  }

  abrirDetalleReporte(row: ReporteVentaRow): void {
    this.abrirDetalleOrden({
      id: row.id_comanda,
      folioComanda: row.folio_comanda,
      total: row.total_pagado,
      mesaNombre: row.mesa_nombre
    } as any);
  }

  // ==================== CANCELACIÓN DE COMANDAS ====================

  abrirModalCancelar(order: PendingOrder | ComandaCajaRow): void {
    const total = 'total' in order ? (order.total as number) : (order.totalFinal ?? order.subtotal ?? 0);
    const folio = 'folioComanda' in order ? order.folioComanda : (order.id.length > 8 ? order.id.slice(0, 8).toUpperCase() : order.id);
    this.comandaACancelar.set({
      id: order.id,
      folio: String(folio),
      mesaNombre: order.mesaNombre,
      total
    });
    this.motivoCancelacion = '';
    this.modalCancelarVisible.set(true);
  }

  cerrarModalCancelar(): void {
    this.modalCancelarVisible.set(false);
    this.comandaACancelar.set(null);
  }

  async confirmarCancelarComanda(): Promise<void> {
    const target = this.comandaACancelar();
    if (!target) return;

    if (!this.motivoCancelacion || this.motivoCancelacion.trim().length === 0) {
      this.messageService.add({ severity: 'warn', summary: 'Motivo requerido', detail: 'Por favor indica la razón de cancelación' });
      return;
    }

    this.procesando.set(true);
    try {
      await firstValueFrom(this.orderService.updateOrderStatus(target.id, 'CANCELLED', this.motivoCancelacion.trim()));
      this.messageService.add({
        severity: 'info',
        summary: 'Comanda Cancelada',
        detail: `La comanda #${target.folio} fue cancelada correctamente`
      });
      this.cerrarModalCancelar();
      await Promise.all([
        this.cargarTablero(false),
        this.cargarHistorialComandas(false)
      ]);
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Error al cancelar comanda';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.procesando.set(false);
    }
  }

  // ==================== DIVISIÓN DE COMANDA (SPLIT) ====================

  async abrirModalSplit(order: PendingOrder | ComandaCajaRow): Promise<void> {
    if ('items' in order && Array.isArray((order as any).items)) {
      this.orderParaSplit.set(order as PendingOrder);
      this.modalSplitVisible.set(true);
      return;
    }

    const found = this.todasComandas().find(o => o.id === order.id);
    if (found && found.items && found.items.length > 0) {
      this.orderParaSplit.set(found);
      this.modalSplitVisible.set(true);
      return;
    }

    try {
      this.loading.set(true);
      const resp = await firstValueFrom(this.orderService.getOrderById(order.id));
      const fullOrder = (resp as any)?.object || (resp as any)?.data || resp;
      if (fullOrder) {
        const mapped = this.mapBackendOrder(fullOrder);
        this.orderParaSplit.set(mapped);
        this.modalSplitVisible.set(true);
      }
    } catch (e) {
      console.error('Error preparando orden para división:', e);
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la orden para dividirla' });
    } finally {
      this.loading.set(false);
    }
  }

  onSplitModalVisibilityChange(visible: boolean): void {
    this.modalSplitVisible.set(visible);
    if (!visible) {
      this.orderParaSplit.set(null);
    }
  }

  onCuentaCreadaEnCaja(event: any): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Cuenta Dividida',
      detail: 'Se ha creado la nueva cuenta con los artículos seleccionados'
    });
    this.modalSplitVisible.set(false);
    this.orderParaSplit.set(null);
    this.cargarTablero(false);
    this.cargarHistorialComandas(false);
  }

  // ==================== REIMPRESIÓN Y FORMATEO ====================

  reimprimirTicketCerrada(order: PendingOrder): void {
    const total = order.totalFinal ?? order.subtotal ?? 0;
    const ticket: TicketPrecuenta = {
      idComanda: order.id,
      folioComanda: order.id.length > 8 ? order.id.slice(0, 8).toUpperCase() : order.id,
      mesaNombre: order.mesaNombre || 'Mesa General',
      meseroNombre: order.meseroNombre || 'Mesero',
      clienteNombre: this.getClientLabel(order),
      fechaApertura: order.horaApertura || order.fechaCreacion || new Date().toISOString(),
      fechaImpresion: order.payment?.paidAt || order.fechaCreacion || new Date().toISOString(),
      subtotal: order.subtotal || total,
      descuento: order.descuento || 0,
      total,
      propinaSugerida10: total * 0.10,
      propinaSugerida15: total * 0.15,
      propinaSugerida20: total * 0.20,
      items: (order.items || []).map(it => ({
        nombreProducto: this.getProductLabel(it),
        cantidad: it.cantidad,
        precioUnitario: this.getItemPrice(it),
        totalLinea: this.getItemPrice(it) * it.cantidad,
        asientoAlias: it.asientoAlias
      }))
    };
    this.ticketActual.set(ticket);
    this.modalTicketVisible.set(true);
  }

  getClientLabel(order: PendingOrder | null | undefined): string {
    if (!order) return 'Venta General';
    return order.customerName || order.nombre || (order.customerId ? `Cliente #${order.customerId}` : 'Venta General');
  }

  getItemPrice(item: any): number {
    return item?.precioUnitario ?? item?.precio ?? 0;
  }

  getProductLabel(item: any): string {
    return item?.productoNombre || item?.nombreProducto || item?.product?.nombre || item?.nombre || `Producto #${item?.productoId || ''}`;
  }

  getStatusClass(estado?: string): string {
    const s = (estado || '').toUpperCase();
    if (s === 'PAGADA' || s === 'PAID') return 'p-tag-success';
    if (s === 'CANCELADA' || s === 'CANCELLED' || s === 'RECHAZADO') return 'p-tag-danger';
    if (s === 'CONFIRMADA' || s === 'CONFIRMED' || s === 'EN_PREPARACION') return 'p-tag-warning';
    return 'p-tag-info';
  }

  // ==================== CORTE POR MESERO & PROPINAS ====================

  async cargarRendimientoMesero(): Promise<void> {
    if (!this.meseroSeleccionadoId) {
      this.corteMesero.set(null);
      return;
    }

    const turnoId = this.turnoActivo()?.idTurno;
    this.loading.set(true);
    try {
      const resp = await firstValueFrom(
        this.cajaService.getCorteMesero(this.meseroSeleccionadoId, this.tenantId, turnoId)
      );
      this.corteMesero.set(resp.object || resp.data || null);
    } catch (e) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo obtener el corte del mesero' });
    } finally {
      this.loading.set(false);
    }
  }

  get propinaNetaMesero(): number {
    const bruto = this.corteMesero()?.propinasPendientesLiquidar || 0;
    const retencion = (bruto * (this.retencionPropinasPorc / 100));
    return Math.max(0, bruto - retencion);
  }

  async liquidarPropinasMesero(): Promise<void> {
    const mesero = this.corteMesero();
    const turno = this.turnoActivo();
    if (!mesero || !turno) {
      this.messageService.add({ severity: 'warn', summary: 'Atención', detail: 'Se requiere un turno de caja activo para liquidar' });
      return;
    }

    if (mesero.propinasPendientesLiquidar <= 0) {
      this.messageService.add({ severity: 'info', summary: 'Sin saldo', detail: 'No hay propinas pendientes de liquidar' });
      return;
    }

    this.procesando.set(true);
    try {
      await firstValueFrom(this.cajaService.liquidarPropinas({
        tenantId: this.tenantId,
        idTurno: turno.idTurno,
        idMesero: mesero.idMesero,
        idCajero: this.userId,
        porcentajeRetencion: this.retencionPropinasPorc
      }));

      this.messageService.add({
        severity: 'success',
        summary: 'Propinas Liquidadas',
        detail: `Se entregó neto de $${this.propinaNetaMesero.toFixed(2)} a ${mesero.nombreMesero}`
      });

      await this.cargarRendimientoMesero();
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Error liquidando propinas';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.procesando.set(false);
    }
  }

  minutosDesde(fechaStr?: string): number {
    if (!fechaStr) return 0;
    const diff = Date.now() - new Date(fechaStr).getTime();
    return Math.max(0, Math.floor(diff / 60000));
  }
}
