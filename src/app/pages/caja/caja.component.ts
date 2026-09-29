import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
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
import { ChartModule } from 'primeng/chart';

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
  CorteMesero,
  DesgloseMetodoPago,
  ResumenTurnoCorte,
  MeseroSimple
} from './models/caja.model';
import { PendingOrder, PendingOrderItem, OrderStatus, ReporteVentaRow, TipInfo } from '@/pages/comandix/models/order.model';

/** Las tres categorías del slider principal de "Caja y Cortes". */
export type SeccionCaja = 'tickets' | 'meseros' | 'dia';

/** Sub-vista de la categoría TICKETS: comandas abiertas o ya cerradas (pagadas). */
export type VistaTickets = 'abiertas' | 'cerradas';

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
    ChartModule,
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
  private route = inject(ActivatedRoute);

  private destroy$ = new Subject<void>();
  private pollingTimer: any = null;

  tenantId = 0;
  userId = 0;
  userName = '';
  userRole = '';

  // Estados principales
  /** Categoría seleccionada en el slider superior: TICKETS, CORTE DE MESEROS o CORTE DEL DÍA */
  seccionActiva = signal<SeccionCaja>('tickets');
  /** Sub-pestaña de TICKETS: cuentas abiertas o ya cerradas */
  ticketsVista = signal<VistaTickets>('abiertas');
  loading = signal<boolean>(false);
  procesando = signal<boolean>(false);

  turnoActivo = signal<TurnoDTO | null>(null);
  tablero = signal<TableroCaja>({ cuentasAbiertas: [], cuentasPorCobrar: [] });

  // Historial de Comandas (TICKETS abiertas / cerradas)
  todasComandas = signal<PendingOrder[]>([]);
  loadingHistorial = signal<boolean>(false);
  busquedaActivas = signal<string>('');
  busquedaCerradas = signal<string>('');

  private static readonly ESTADOS_FINALIZADOS = ['PAGADA', 'CANCELADA', 'RECHAZADO'];

  comandasCerradas = computed(() =>
    this.todasComandas().filter(o => (o.estado || '').toUpperCase() === 'PAGADA')
  );

  /** Comandas que siguen vivas: PENDIENTE, CONFIRMADA, EN_PREPARACION o LISTO */
  comandasActivas = computed(() =>
    this.todasComandas().filter(o => !CajaComponent.ESTADOS_FINALIZADOS.includes((o.estado || '').toUpperCase()))
  );

  /** Conteo seguro de comandas pendientes por cobrar para el indicador del header */
  cuentasPorCobrarCount = computed(() => {
    const t = this.tablero();
    if (t?.cuentasPorCobrar && Array.isArray(t.cuentasPorCobrar) && t.cuentasPorCobrar.length > 0) {
      return t.cuentasPorCobrar.length;
    }
    return this.todasComandas().filter(o => (o.estado || '').toUpperCase() === 'POR_COBRAR').length;
  });

  /** Fecha de los cortes en español (el app no define LOCALE_ID, el pipe date daría inglés). */
  get fechaCorteTexto(): string {
    const d = this.fechaCorte();
    const dia = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
    return dia.charAt(0).toUpperCase() + dia.slice(1);
  }

  private coincideBusqueda(o: PendingOrder, q: string): boolean {
    if (!q) return true;
    return (
      (o.id || '').toLowerCase().includes(q) ||
      (o.mesaNombre || '').toLowerCase().includes(q) ||
      (o.meseroNombre || '').toLowerCase().includes(q) ||
      (o.customerName || o.nombre || '').toLowerCase().includes(q)
    );
  }

  /**
   * TICKETS → sub-vista "Abiertas": calca de las órdenes vivas de Comandix
   * (pendientes, confirmadas, en preparación, listas y las ya entregadas por cobrar).
   */
  ticketsAbiertas = computed(() => {
    const q = (this.busquedaActivas() || '').toLowerCase().trim();
    return this.comandasActivas().filter(o => this.coincideBusqueda(o, q));
  });

  /** TICKETS → sub-vista "Cerradas": comandas ya pagadas. */
  ticketsCerradas = computed(() => {
    const q = (this.busquedaCerradas() || '').toLowerCase().trim();
    return this.comandasCerradas().filter(o => this.coincideBusqueda(o, q));
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

  // El módulo NO gestiona turnos (no hay apertura ni clausura desde aquí).
  // El turno se consulta en solo lectura porque el backend exige un turno ABIERTO
  // para registrar cobros y para liquidar propinas.
  ensuringTurno = signal<boolean>(false);

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

  // Corte por mesero (cards + modal de detalle)
  meseros = signal<MeseroSimple[]>([]);
  meseroSeleccionadoId: number | null = null;
  corteMesero = signal<CorteMesero | null>(null);
  loadingCorte = signal<boolean>(false);
  retencionPropinasPorc = 15; // 15% retención por defecto para cocina/barra
  /** Modal con el corteamplio del mesero: tickets, dinero y platillos vendidos. */
  modalCorteMeseroVisible = signal<boolean>(false);

  /** Día que se muestran los cortes. Se refresca al cambiar de categoría. */
  readonly fechaCorte = signal<Date>(new Date());

  /** Comandas vivas agrupadas por mesero, para=listar los cortes con contexto. */
  private comandasActivasPorMesero = computed(() => {
    const mapa = new Map<string, number>();
    for (const o of this.comandasActivas()) {
      const key = (o.meseroNombre || '').trim();
      if (!key) continue;
      mapa.set(key, (mapa.get(key) ?? 0) + 1);
    }
    return mapa;
  });

  /** Fecha de cierre de una orden (prioriza el pago, que es lo que se corta). */
  private fechaCierreOrden(o: PendingOrder): string {
    return o.horaCierre || o.payment?.paidAt || o.fechaCreacion || o.horaApertura || '';
  }

  /** Dinero y platillos cobrados hoy por cada mesero, según el historial de órdenes. */
  private cobrosHoyPorMesero = computed(() => {
    const mapa = new Map<string, { tickets: number; dinero: number; platillos: number }>();
    for (const o of this.comandasCerradas()) {
      if (!this.esMismoDia(this.fechaCierreOrden(o))) continue;
      const keyName = (o.meseroNombre || '').trim().toLowerCase();
      const keyEmail = (o.payment?.paidBy ? String(o.payment.paidBy) : '').trim().toLowerCase();

      const dinero = o.totalFinal ?? o.subtotal ?? 0;
      const platillos = (o.items ?? []).reduce((s, it) => s + (it.cantidad || 0), 0);

      const updateKey = (k: string) => {
        if (!k) return;
        const prev = mapa.get(k) ?? { tickets: 0, dinero: 0, platillos: 0 };
        prev.tickets += 1;
        prev.dinero += dinero;
        prev.platillos += platillos;
        mapa.set(k, prev);
      };

      if (keyName) updateKey(keyName);
      if (keyEmail && keyEmail !== keyName) updateKey(keyEmail);
    }
    return mapa;
  });

  /**
   * Cards de CORTE DE MESEROS: cada mesero con sus comandas vivas y lo que
   * lleva cobrado hoy (tickets, dinero y platillos).
   */
  meserosConActivas = computed(() =>
    this.meseros()
      .map(m => {
        const keyName = (m.nombre || '').trim().toLowerCase();
        const keyEmail = (m.email || '').trim().toLowerCase();
        const hoy = this.cobrosHoyPorMesero().get(keyName)
                 ?? (keyEmail ? this.cobrosHoyPorMesero().get(keyEmail) : undefined)
                 ?? { tickets: 0, dinero: 0, platillos: 0 };

        const activasPorNombre = keyName ? (this.comandasActivasPorMesero().get(m.nombre.trim()) ?? 0) : 0;

        return {
          id: m.id,
          nombre: m.nombre,
          email: m.email,
          comandasActivas: activasPorNombre,
          ticketsHoy: hoy.tickets,
          dineroHoy: hoy.dinero,
          platillosHoy: hoy.platillos
        };
      })
      .sort((a, b) => b.dineroHoy - a.dineroHoy || a.nombre.localeCompare(b.nombre, 'es'))
  );

  meseroSeleccionado = computed(() =>
    this.meseros().find(m => m.id === this.meseroSeleccionadoId) ?? null
  );

  /** Órdenes pagadas hoy por el mesero abierto en la modal. */
  comandasDelMesero = computed<PendingOrder[]>(() => {
    const mesero = this.meseroSeleccionado();
    if (!mesero) return [];
    const keyName = (mesero.nombre || '').trim().toLowerCase();
    const keyEmail = (mesero.email || '').trim().toLowerCase();
    return this.comandasCerradas().filter(o => {
      if (!this.esMismoDia(this.fechaCierreOrden(o))) return false;
      const oName = (o.meseroNombre || '').trim().toLowerCase();
      const oEmail = (o.payment?.paidBy ? String(o.payment.paidBy) : '').trim().toLowerCase();
      return (keyName && (oName === keyName || oEmail === keyName)) ||
             (keyEmail && (oName === keyEmail || oEmail === keyEmail));
    });
  });

  /**
   * Platillos vendidos por el mesero, agregados por producto.
   *
   * El corte del backend no desglosa platillos, así que se arma cruzando los pagos
   * del corte con el detalle de items de las órdenes pagadas de ese mesero.
   */
  platillosDelMesero = computed<{ nombre: string; unidades: number; total: number }[]>(() => {
    const mapa = new Map<string, { unidades: number; total: number }>();
    for (const o of this.comandasDelMesero()) {
      for (const it of o.items ?? []) {
        const nombre = this.getProductLabel(it);
        const unidades = it.cantidad || 0;
        const prev = mapa.get(nombre) ?? { unidades: 0, total: 0 };
        prev.unidades += unidades;
        prev.total += this.getItemPrice(it) * unidades;
        mapa.set(nombre, prev);
      }
    }
    return Array.from(mapa.entries())
      .map(([nombre, v]) => ({ nombre, unidades: v.unidades, total: v.total }))
      .sort((a, b) => b.unidades - a.unidades || b.total - a.total);
  });

  /** Total de platillos vendidos por el mesero en el día. */
  totalPlatillosMesero = computed(() =>
    this.platillosDelMesero().reduce((s, p) => s + p.unidades, 0)
  );

  /** Dinero del corte del mesero (respuesta del backend, sin propinas). */
  totalDineroMesero = computed(() => this.corteDelDia()?.totalVentas ?? 0);

  // ============ CORTE DEL DÍA (resumen general del turno) ============
  resumenDia = signal<ResumenTurnoCorte | null>(null);
  loadingResumenDia = signal<boolean>(false);

  /** Órdenes pagadas hoy, usada como respaldo cuando el turno aún no está abierto. */
  ordenesPagadasHoy = computed<PendingOrder[]>(() =>
    this.comandasCerradas().filter(o => this.esMismoDia(this.fechaCierreOrden(o)))
  );

  /** Propina estimada de la orden: el pago incluye la propina y el total es la cuenta. */
  private propinaOrden(o: PendingOrder): number {
    const cuenta = o.totalFinal ?? o.subtotal ?? 0;
    return Math.max(0, (o.payment?.amount ?? 0) - cuenta);
  }

  diaComandas = computed(() => {
    const r = this.resumenDia()?.totalComandasCobradas ?? 0;
    const h = this.ordenesPagadasHoy().length;
    return Math.max(r, h);
  });

  diaVentas = computed(() => {
    const r = this.resumenDia()?.totalVentas ?? 0;
    const h = this.ordenesPagadasHoy().reduce((s, o) => s + (o.totalFinal ?? o.subtotal ?? 0), 0);
    return Math.max(r, h);
  });

  diaPropinas = computed(() => {
    const r = this.resumenDia()?.totalPropinas ?? 0;
    const h = this.ordenesPagadasHoy().reduce((s, o) => s + this.propinaOrden(o), 0);
    return Math.max(r, h);
  });

  diaArticulos = computed(() => {
    const r = this.resumenDia()?.totalArticulosVendidos ?? 0;
    const h = this.ordenesPagadasHoy().reduce(
      (s, o) => s + (o.items ?? []).reduce((x, it) => x + (it.cantidad || 0), 0),
      0
    );
    return Math.max(r, h);
  });

  diaTicketPromedio = computed(() => (this.diaComandas() > 0 ? this.diaVentas() / this.diaComandas() : 0));

  /** Métodos de pago del día. Usa el corte del backend y si no, lo arma del historial. */
  metodosPagoDia = computed<DesgloseMetodoPago[]>(() => {
    const delTurno = this.resumenDia()?.desgloseMetodos ?? [];
    const ventasTurno = this.resumenDia()?.totalVentas ?? 0;
    const ventasHistorial = this.ordenesPagadasHoy().reduce((s, o) => s + (o.totalFinal ?? o.subtotal ?? 0), 0);

    if (delTurno.length > 0 && ventasTurno >= ventasHistorial) {
      return delTurno;
    }

    const mapa = new Map<string, DesgloseMetodoPago>();
    for (const o of this.ordenesPagadasHoy()) {
      const rawMetodo = o.payment?.method || 'EFECTIVO';
      const clave = CajaComponent.NOMBRE_METODO[rawMetodo.toUpperCase()] ?? rawMetodo.toUpperCase();
      const cuenta = o.totalFinal ?? o.subtotal ?? 0;
      const propina = this.propinaOrden(o);
      const prev = mapa.get(clave) ?? { metodoPago: clave, transacciones: 0, totalCuenta: 0, totalPropina: 0, totalRecaudado: 0 };
      prev.transacciones += 1;
      prev.totalCuenta += cuenta;
      prev.totalPropina += propina;
      prev.totalRecaudado += cuenta + propina;
      mapa.set(clave, prev);
    }

    for (const dt of delTurno) {
      if (!mapa.has(dt.metodoPago)) {
        mapa.set(dt.metodoPago, dt);
      }
    }

    return Array.from(mapa.values()).sort((a, b) => b.totalRecaudado - a.totalRecaudado);
  });

  /** Datos de la gráfica: participación de cada método de pago en lo recaudado. */
  metodosPagoChartData = computed(() => {
    const metodos = this.metodosPagoDia();
    return {
      labels: metodos.map(m => m.metodoPago),
      datasets: [
        {
          data: metodos.map(m => m.totalRecaudado),
          backgroundColor: metodos.map((_, i) => CajaComponent.COLORES_METODO[i % CajaComponent.COLORES_METODO.length]),
          borderWidth: 0,
          hoverOffset: 6
        }
      ]
    };
  });

  metodosPagoChartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 1,
    cutout: '72%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        titleFont: { size: 12, weight: 'bold' },
        bodyFont: { size: 12 },
        padding: 10,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          label: (ctx: any) => {
            const total = (ctx.dataset.data as number[]).reduce((s, v) => s + (v || 0), 0);
            const val = ctx.parsed || 0;
            const pct = total > 0 ? Math.round((val / total) * 100) : 0;
            return ` ${ctx.label || ''}: $${val.toFixed(2)} (${pct}%)`;
          }
        }
      }
    }
  };

  getColorMetodo(index: number): string {
    return CajaComponent.COLORES_METODO[index % CajaComponent.COLORES_METODO.length];
  }

  private static readonly COLORES_METODO = ['#7c3aed', '#10b981', '#f59e0b', '#0ea5e9', '#ef4444', '#64748b'];

  private static readonly NOMBRE_METODO: Record<string, string> = {
    CASH: 'EFECTIVO',
    CARD: 'TARJETA',
    TRANSFER: 'TRANSFERENCIA',
    MIXED: 'MIXTO'
  };

  /**
   * Corte del día del mesero seleccionado.
   *
   * El backend ya recibe `fecha` y devuelve únicamente los cobros de hoy, así que
   * normalmente devuelve la respuesta tal cual. Si por lo que sea la respuesta
   * viniera con cobros de otros días (backend antiguo sin el parámetro), se
   * recalcula aquí para que el corte sea siempre del día.
   */
  corteDelDia = computed<CorteMesero | null>(() => {
    const corte = this.corteMesero();
    if (!corte) return null;

    const pagos = corte.pagosRealizados ?? [];
    const pagosDelDia = pagos.filter(p => this.esMismoDia(p.fecha));
    if (pagosDelDia.length === pagos.length) {
      return corte;
    }

    let totalVentas = 0;
    let totalPropinas = 0;
    const desglose = new Map<string, DesgloseMetodoPago>();

    for (const p of pagosDelDia) {
      const cuenta = Number(p.montoCuenta ?? 0);
      const propina = Number(p.montoPropina ?? 0);
      totalVentas += cuenta;
      totalPropinas += propina;

      const metodo = p.metodoPago || 'SIN METODO';
      const actual = desglose.get(metodo);
      if (actual) {
        actual.transacciones += 1;
        actual.totalCuenta += cuenta;
        actual.totalPropina += propina;
        actual.totalRecaudado += cuenta + propina;
      } else {
        desglose.set(metodo, {
          metodoPago: metodo,
          transacciones: 1,
          totalCuenta: cuenta,
          totalPropina: propina,
          totalRecaudado: cuenta + propina
        });
      }
    }

    return {
      ...corte,
      totalComandasAtendidas: pagosDelDia.length,
      totalVentas,
      totalPropinas,
      propinasPendientesLiquidar: totalPropinas,
      pagosRealizados: pagosDelDia,
      desgloseMetodos: Array.from(desglose.values())
    };
  });

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    this.tenantId = user?.tenantId || 0;
    this.userId = user?.id || 0;
    this.userName = user?.nombre || user?.userName || user?.email || 'Cajero';
    this.userRole = (user?.rol || user?.role || '').toUpperCase();

    this.aplicarVistaInicial(
      this.route.snapshot.data['initialView'] || this.route.snapshot.queryParams['view']
    );

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
      switch (this.seccionActiva()) {
        case 'tickets':
          this.cargarHistorialComandas(false);
          this.cargarTablero(false);
          break;
        case 'meseros':
          this.refrescarCorte();
          break;
        case 'dia':
          this.cargarResumenDia(false);
          this.cargarHistorialComandas(false);
          break;
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
      await this.cargarTurnoActivo();
      // El backend exige un turno ABIERTO para poder cobrar: si no hay ninguno,
      // se abre automáticamente con fondo 0 (Caja no expone apertura de turno).
      if (!this.turnoActivo()) {
        await this.asegurarTurnoActivo();
      }
      await Promise.all([
        this.cargarTablero(false),
        this.cargarMeseros(),
        this.cargarHistorialComandas(false)
      ]);
      if (this.seccionActiva() === 'dia') {
        await this.cargarResumenDia(false);
      }
      if (this.seccionActiva() === 'dia') {
        await this.cargarResumenDia(false);
      }
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

  /**
   * Abre un turno de caja con fondo 0 cuando no hay ninguno abierto.
   * Necesario porque `POST /caja/comandas/{id}/pagar` exige un turno ABIERTO.
   * No expone ninguna UI: es una garantía interna para que el cobro no se bloquee.
   */
  async asegurarTurnoActivo(): Promise<void> {
    if (this.turnoActivo() || this.ensuringTurno()) return;

    this.ensuringTurno.set(true);
    try {
      const resp = await firstValueFrom(this.cajaService.abrirTurno({
        tenantId: this.tenantId,
        cajeroId: this.userId,
        fondoInicial: 0,
        observaciones: 'Turno abierto automáticamente por el módulo de Caja y Cortes'
      }));
      this.turnoActivo.set(resp.object || resp.data || null);
    } catch (e: any) {
      const msg = e?.error?.message || e?.message || 'No fue posible abrir el turno de caja';
      console.warn('[Caja] Apertura automática de turno fallida:', msg);
      this.messageService.add({
        severity: 'warn',
        summary: 'Turno de caja',
        detail: msg,
        life: 6000
      });
    } finally {
      this.ensuringTurno.set(false);
    }
  }

  async cargarTablero(showLoading = true): Promise<void> {
    if (showLoading) this.loading.set(true);
    try {
      const resp = await firstValueFrom(this.cajaService.getTablero(this.tenantId));
      const raw = (resp as any)?.object ?? (resp as any)?.data ?? resp;
      this.tablero.set({
        cuentasAbiertas: Array.isArray(raw?.cuentasAbiertas) ? raw.cuentasAbiertas : [],
        cuentasPorCobrar: Array.isArray(raw?.cuentasPorCobrar) ? raw.cuentasPorCobrar : []
      });
    } catch (e) {
      console.error('Error cargando tablero de caja:', e);
      this.tablero.set({ cuentasAbiertas: [], cuentasPorCobrar: [] });
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

  // ==================== UTILIDADES DE FECHA PARA CORTES ====================

  /** yyyy-MM-dd del día en curso (formato esperado por el backend). */
  private fechaCorteISO(): string {
    const d = this.fechaCorte();
    const mes = `${d.getMonth() + 1}`.padStart(2, '0');
    const dia = `${d.getDate()}`.padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
  }

  /** True si la fecha/hora dada cae en el día en curso (hora local). */
  esMismoDia(fecha?: string | null): boolean {
    if (!fecha) return false;
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return false;
    const ref = this.fechaCorte();
    return (
      d.getFullYear() === ref.getFullYear() &&
      d.getMonth() === ref.getMonth() &&
      d.getDate() === ref.getDate()
    );
  }

  // ==================== PRE-CUENTA (IMPRIMIR TICKET) ====================

  async imprimirTicket(comanda: PendingOrder | ComandaCajaRow): Promise<void> {
    this.procesando.set(true);
    try {
      const resp = await firstValueFrom(this.cajaService.imprimirTicket(comanda.id, this.tenantId));
      const ticket = resp.object || resp.data;
      this.ticketActual.set(ticket || null);
      this.modalTicketVisible.set(true);

      // Actualizar tablero local
      await this.cargarTablero(false);
      await this.cargarHistorialComandas(false);

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

  /** Total de la cuenta, sin importar si viene del tablero o del historial. */
  private totalCuenta(comanda: PendingOrder | ComandaCajaRow): number {
    return (comanda as ComandaCajaRow).total ?? (comanda as PendingOrder).totalFinal ?? (comanda as PendingOrder).subtotal ?? 0;
  }

  /** Adapta una orden del historial al formato de fila que usa la modal de cobro. */
  private aFilaCaja(comanda: PendingOrder | ComandaCajaRow): ComandaCajaRow {
    if ((comanda as ComandaCajaRow).folioComanda !== undefined) return comanda as ComandaCajaRow;
    const o = comanda as PendingOrder;
    return {
      id: o.id,
      folioComanda: o.id.length > 8 ? o.id.slice(0, 8).toUpperCase() : o.id,
      estado: o.estado || '',
      mesaNombre: o.mesaNombre || 'Mesa General',
      meseroNombre: o.meseroNombre || 'Sin asignar',
      clienteNombre: o.customerName || o.nombre || 'Venta General',
      subtotal: o.subtotal ?? 0,
      descuento: o.descuento ?? 0,
      total: o.totalFinal ?? o.subtotal ?? 0,
      totalItems: (o.items ?? []).reduce((s, it) => s + (it.cantidad || 0), 0),
      horaApertura: o.horaApertura || o.fechaCreacion || '',
      fechaImpresionTicket: o.horaCierre || o.payment?.paidAt || undefined
    };
  }

  async abrirModalCobro(comanda: PendingOrder | ComandaCajaRow): Promise<void> {
    if (!this.turnoActivo()) {
      await this.asegurarTurnoActivo();
      if (!this.turnoActivo()) {
        this.messageService.add({
          severity: 'error',
          summary: 'Caja no disponible',
          detail: 'No hay un turno de caja abierto para registrar el cobro. Intenta de nuevo en unos segundos.'
        });
        return;
      }
    }

    const fila = this.aFilaCaja(comanda);
    this.comandaSeleccionada.set(fila);
    this.metodoPagoSeleccionado = 'EFECTIVO';
    this.montoCuentaInput = this.totalCuenta(fila);
    this.montoPropinaInput = 0;
    this.referenciaPagoInput = '';
    this.efectivoRecibidoInput = this.totalCuenta(fila);
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
      if (this.seccionActiva() === 'dia') {
        await this.cargarResumenDia(false);
      }
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

  // ==================== NAVEGACIÓN (3 categorías + sub-vista de TICKETS) ====================

  /**
   * Aplica la categoría pedida por la ruta (data.initialView o ?view=).
   * Se mantiene la compatibilidad con las vistas anteriores: `cortes`, `reporte`,
   * `activas`, `cerradas`, `canceladas` y `tablero`.
   */
  private aplicarVistaInicial(valor: string | undefined): void {
    const clave = (valor || '').toLowerCase();
    if (clave === 'cortes') {
      this.seccionActiva.set('meseros');
      return;
    }
    if (clave === 'reporte' || clave === 'dia') {
      this.seccionActiva.set('dia');
      return;
    }
    this.seccionActiva.set('tickets');
    this.ticketsVista.set(clave === 'cerradas' ? 'cerradas' : 'abiertas');
  }

  /** Cambia entre las tres categorías del slider superior. */
  cambiarSeccion(seccion: SeccionCaja): void {
    if (this.seccionActiva() === seccion) return;
    this.seccionActiva.set(seccion);
    // El corte siempre es del día en curso: se recalcula por si la app quedó abierta.
    if (seccion !== 'tickets') this.fechaCorte.set(new Date());
    this.cargarSeccionActual();
  }

  /** Cambia la sub-vista de TICKETS: "Abiertas" o "Cerradas". */
  cambiarTicketsVista(vista: VistaTickets): void {
    this.ticketsVista.set(vista);
    this.cargarHistorialComandas(true);
  }

  /** Carga únicamente los datos que necesita la categoría visible. */
  private cargarSeccionActual(): void {
    switch (this.seccionActiva()) {
      case 'tickets':
        this.cargarHistorialComandas(true);
        this.cargarTablero(false);
        break;
      case 'meseros':
        this.cargarMeseros();
        this.cargarHistorialComandas(false);
        break;
      case 'dia':
        this.cargarResumenDia();
        this.cargarHistorialComandas(false);
        break;
    }
  }

  private mapBackendOrder(order: any): PendingOrder {
    const mesaId = order.idMesa ?? order.mesaId;
    const mesaNombre = order.mesaNombre ?? (mesaId ? `Mesa #${mesaId}` : undefined);
    const mesaNumero = order.mesaNumero;
    const meseroNombre = order.meseroNombre ?? order.paidByName ?? (order.idMesero ? `Mesero #${order.idMesero}` : undefined);
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
        method: order.paidMethod ?? order.paymentMethod,
        reference: order.paymentReference ?? null,
        paidAt: order.paidAt,
        paidBy: order.paidByName ?? order.paidBy
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

  /** Abre el detalle de la orden indicada desde la tabla del corte del día. */
  verTicketReporte(idComanda: string): void {
    const orden = this.todasComandas().find(o => o.id === idComanda);
    if (!orden) {
      this.messageService.add({ severity: 'info', summary: 'Ticket no disponible', detail: 'La comanda ya no está en el historial local' });
      return;
    }
    void this.abrirDetalleOrden(orden);
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

  // ==================== CORTE POR MESERO (cards + modal) ====================

  /** Abre la modal con el corte completo del mesero. */
  async abrirCorteMesero(idMesero: number): Promise<void> {
    this.meseroSeleccionadoId = idMesero;
    this.modalCorteMeseroVisible.set(true);
    this.fechaCorte.set(new Date());
    await Promise.all([this.cargarCorteMesero(), this.cargarHistorialComandas(false)]);
  }

  cerrarCorteMesero(): void {
    this.modalCorteMeseroVisible.set(false);
    this.meseroSeleccionadoId = null;
    this.corteMesero.set(null);
  }

  async cargarCorteMesero(): Promise<void> {
    if (!this.meseroSeleccionadoId) {
      this.corteMesero.set(null);
      return;
    }

    this.loadingCorte.set(true);
    try {
      this.fechaCorte.set(new Date());
      const resp = await firstValueFrom(
        this.cajaService.getCorteMesero(this.meseroSeleccionadoId, this.tenantId, undefined, this.fechaCorteISO())
      );
      this.corteMesero.set(resp.object || resp.data || null);
    } catch (e: any) {
      this.corteMesero.set(null);
      const msg = e?.error?.message || e?.message || 'No se pudo obtener el corte del mesero';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      this.loadingCorte.set(false);
    }
  }

  // ==================== CORTE DEL DÍA ====================

  /**
   * Resumen del turno abierto (ventas, propinas y métodos de pago).
   * Si no hay turno, se intenta abrir uno con fondo 0 porque el backend lo exige.
   */
  async cargarResumenDia(showLoading = true): Promise<void> {
    if (this.tenantId <= 0) return;
    if (showLoading) this.loadingResumenDia.set(true);
    try {
      if (!this.turnoActivo()) await this.asegurarTurnoActivo();
      const turno = this.turnoActivo();
      if (!turno) {
        this.resumenDia.set(null);
        return;
      }
      const resp = await firstValueFrom(this.cajaService.getResumenTurno(turno.idTurno, this.tenantId));
      this.resumenDia.set(resp.object || resp.data || null);
    } catch (e: any) {
      this.resumenDia.set(null);
      if (showLoading) {
        const msg = e?.error?.message || e?.message || 'No se pudo obtener el corte del día';
        this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
      }
    } finally {
      if (showLoading) this.loadingResumenDia.set(false);
    }
  }

  /** Recarga los datos de la categoría que el usuario está viendo. */
  async refrescar(): Promise<void> {
    if (this.seccionActiva() === 'meseros') {
      await this.refrescarCorte();
      return;
    }
    this.loading.set(true);
    try {
      await this.cargarTurnoActivo();
      if (this.seccionActiva() === 'dia') {
        await Promise.all([this.cargarResumenDia(false), this.cargarHistorialComandas(false)]);
        return;
      }
      await Promise.all([this.cargarTablero(false), this.cargarHistorialComandas(false)]);
    } finally {
      this.loading.set(false);
    }
  }

  async refrescarCorte(): Promise<void> {
    await Promise.all([this.cargarMeseros(), this.cargarHistorialComandas(false)]);
    if (this.meseroSeleccionadoId) {
      await this.cargarCorteMesero();
    }
  }

  get propinaNetaMesero(): number {
    const bruto = this.corteDelDia()?.propinasPendientesLiquidar || 0;
    const retencion = (bruto * (this.retencionPropinasPorc / 100));
    return Math.max(0, bruto - retencion);
  }

  async liquidarPropinasMesero(): Promise<void> {
    const mesero = this.corteDelDia();
    if (!mesero) {
      this.messageService.add({ severity: 'info', summary: 'Sin selección', detail: 'Selecciona un mesero para ver su corte' });
      return;
    }

    await this.asegurarTurnoActivo();
    const turno = this.turnoActivo();
    if (!turno) {
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

      await this.cargarCorteMesero();
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
