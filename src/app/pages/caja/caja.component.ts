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
import { DatePickerModule } from 'primeng/datepicker';

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

/** Presets de filtrado de tiempo para tickets terminados/cerrados. */
export type PresetTicketsCerradas = 'HOY' | 'AYER' | 'ESTA_SEMANA' | 'ESTE_MES' | 'TODOS' | 'PERSONALIZADO';

export interface PresetCerradasOpcion {
  valor: PresetTicketsCerradas;
  etiqueta: string;
  icono?: string;
}

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
    DatePickerModule,
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

  // ==================== FILTRO DE TIEMPO / PERIODO PARA TICKETS CERRADOS ====================
  readonly presetsCerradas: PresetCerradasOpcion[] = [
    { valor: 'HOY', etiqueta: 'Hoy', icono: 'pi pi-calendar' },
    { valor: 'AYER', etiqueta: 'Ayer' },
    { valor: 'ESTA_SEMANA', etiqueta: 'Esta semana' },
    { valor: 'ESTE_MES', etiqueta: 'Este mes' },
    { valor: 'TODOS', etiqueta: 'Todos' },
  ];

  presetCerradas = signal<PresetTicketsCerradas>('HOY');
  rangoFechasCerradas = signal<Date[] | null>(null);

  /** Etiqueta descriptiva del periodo seleccionado para tickets cerrados. */
  etiquetaPeriodoCerradas = computed<string>(() => {
    const p = this.presetCerradas();
    const rango = this.rangoFechasCerradas();
    if (p === 'PERSONALIZADO' && rango && rango.length > 0 && rango[0]) {
      const f1 = this.formatoFechaCorta(rango[0]);
      const f2 = rango[1] ? this.formatoFechaCorta(rango[1]) : f1;
      return `${f1} - ${f2}`;
    }
    if (p === 'HOY') {
      return `Hoy (${this.formatoFechaCorta(new Date())})`;
    }
    const match = this.presetsCerradas.find(o => o.valor === p);
    return match ? match.etiqueta : 'Hoy';
  });

  aplicarPresetCerradas(preset: PresetTicketsCerradas): void {
    this.presetCerradas.set(preset);
    this.rangoFechasCerradas.set(null);
  }

  aplicarRangoCerradas(fechas: Date[] | null): void {
    this.rangoFechasCerradas.set(fechas);
    if (fechas && fechas.length > 0 && fechas[0]) {
      this.presetCerradas.set('PERSONALIZADO');
    }
  }

  limpiarRangoCerradas(): void {
    this.rangoFechasCerradas.set(null);
    this.presetCerradas.set('HOY');
  }

  private formatoFechaCorta(d: Date): string {
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const anio = d.getFullYear();
    return `${dia}/${mes}/${anio}`;
  }

  obtenerFechaOrden(o: PendingOrder): Date | null {
    const raw = this.fechaCierreOrden(o);
    if (!raw) return null;
    const cleanStr = typeof raw === 'string' ? raw.replace(' ', 'T') : raw;
    const d = new Date(cleanStr);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  /** Valida si una orden cae en el periodo o preset seleccionado. */
  private ordenCaeEnFiltroFecha(o: PendingOrder): boolean {
    const preset = this.presetCerradas();
    if (preset === 'TODOS') return true;

    const fecha = this.obtenerFechaOrden(o);
    if (!fecha) return false;

    const ahora = new Date();

    if (preset === 'HOY') {
      return (
        fecha.getFullYear() === ahora.getFullYear() &&
        fecha.getMonth() === ahora.getMonth() &&
        fecha.getDate() === ahora.getDate()
      );
    }

    if (preset === 'AYER') {
      const ayer = new Date(ahora);
      ayer.setDate(ahora.getDate() - 1);
      return (
        fecha.getFullYear() === ayer.getFullYear() &&
        fecha.getMonth() === ayer.getMonth() &&
        fecha.getDate() === ayer.getDate()
      );
    }

    if (preset === 'ESTA_SEMANA') {
      const diaSemana = ahora.getDay();
      const difLunes = (diaSemana === 0 ? -6 : 1) - diaSemana;
      const lunes = new Date(ahora);
      lunes.setDate(ahora.getDate() + difLunes);
      lunes.setHours(0, 0, 0, 0);

      const domingo = new Date(lunes);
      domingo.setDate(lunes.getDate() + 6);
      domingo.setHours(23, 59, 59, 999);

      return fecha >= lunes && fecha <= domingo;
    }

    if (preset === 'ESTE_MES') {
      return (
        fecha.getFullYear() === ahora.getFullYear() &&
        fecha.getMonth() === ahora.getMonth()
      );
    }

    if (preset === 'PERSONALIZADO') {
      const rango = this.rangoFechasCerradas();
      if (!rango || rango.length === 0 || !rango[0]) return true;

      const inicio = new Date(rango[0]);
      inicio.setHours(0, 0, 0, 0);

      const fin = new Date(rango[1] ? rango[1] : rango[0]);
      fin.setHours(23, 59, 59, 999);

      return fecha >= inicio && fecha <= fin;
    }

    return true;
  }

  /** TICKETS → sub-vista "Cerradas": comandas ya pagadas filtradas por búsqueda y tiempo. */
  ticketsCerradas = computed(() => {
    const q = (this.busquedaCerradas() || '').toLowerCase().trim();
    return this.comandasCerradas().filter(o => {
      if (!this.coincideBusqueda(o, q)) return false;
      return this.ordenCaeEnFiltroFecha(o);
    });
  });

  /** Total recaudado en los tickets cerrados que coinciden con el filtro actual. */
  totalCobradoCerradasFiltradas = computed(() => {
    return this.ticketsCerradas().reduce((sum, o) => sum + (o.totalFinal ?? o.subtotal ?? 0), 0);
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

  // Modal Desglose Ventas del Día
  modalDesgloseVentasVisible = signal<boolean>(false);

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
  meseroSeleccionadoId = signal<number | null>(null);
  meseroSeleccionado = signal<MeseroSimple | null>(null);
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
  fechaCierreOrden(o: PendingOrder): string {
    return o.horaCierre || o.payment?.paidAt || o.fechaCreacion || o.horaApertura || '';
  }

  /** Dinero, platillos y propinas cobrados hoy por cada mesero, según el historial de órdenes. */
  private cobrosHoyPorMesero = computed(() => {
    const mapa = new Map<string, { tickets: number; dinero: number; platillos: number; propinas: number }>();
    for (const o of this.comandasCerradas()) {
      if (!this.esMismoDia(this.fechaCierreOrden(o))) continue;
      const keyName = (o.meseroNombre || '').trim().toLowerCase();
      const keyEmail = (o.payment?.paidBy ? String(o.payment.paidBy) : '').trim().toLowerCase();
      const keyId = o.meseroId ? `id:${o.meseroId}` : '';

      const dinero = o.totalFinal ?? o.subtotal ?? 0;
      const propina = this.propinaOrden(o);
      const platillos = (o.items ?? []).reduce((s, it) => s + (it.cantidad || 0), 0);

      const updateKey = (k: string) => {
        if (!k) return;
        const prev = mapa.get(k) ?? { tickets: 0, dinero: 0, platillos: 0, propinas: 0 };
        prev.tickets += 1;
        prev.dinero += dinero;
        prev.platillos += platillos;
        prev.propinas += propina;
        mapa.set(k, prev);
      };

      if (keyId) updateKey(keyId);
      if (keyName) updateKey(keyName);
      if (keyEmail && keyEmail !== keyName) updateKey(keyEmail);
    }
    return mapa;
  });

  /**
   * Cards de CORTE DE MESEROS: cada mesero con sus comandas vivas y lo que
   * lleva cobrado hoy (tickets, dinero, platillos y propinas).
   */
  meserosConActivas = computed(() =>
    this.meseros()
      .map(m => {
        const keyId = `id:${m.id}`;
        const keyName = (m.nombre || '').trim().toLowerCase();
        const keyEmail = (m.email || '').trim().toLowerCase();
        const hoy = this.cobrosHoyPorMesero().get(keyId)
                 ?? this.cobrosHoyPorMesero().get(keyName)
                 ?? (keyEmail ? this.cobrosHoyPorMesero().get(keyEmail) : undefined)
                 ?? { tickets: 0, dinero: 0, platillos: 0, propinas: 0 };

        const activasPorNombre = keyName ? (this.comandasActivasPorMesero().get(m.nombre.trim()) ?? 0) : 0;

        return {
          id: m.id,
          nombre: m.nombre,
          email: m.email,
          comandasActivas: activasPorNombre,
          ticketsHoy: hoy.tickets,
          dineroHoy: hoy.dinero,
          platillosHoy: hoy.platillos,
          propinasHoy: hoy.propinas
        };
      })
      .sort((a, b) => b.dineroHoy - a.dineroHoy || a.nombre.localeCompare(b.nombre, 'es'))
  );

  /** Órdenes pagadas hoy por el mesero abierto en la modal. */
  comandasDelMesero = computed<PendingOrder[]>(() => {
    const mesero = this.meseroSeleccionado();
    if (!mesero) return [];
    const keyName = (mesero.nombre || '').trim().toLowerCase();
    const keyEmail = (mesero.email || '').trim().toLowerCase();
    const keyId = mesero.id;

    // IDs de comandas registradas en el corte de este mesero en backend
    const idsPagosCorte = new Set(
      (this.corteMesero()?.pagosRealizados ?? [])
        .map(p => (p.idComanda || '').trim().toLowerCase())
        .filter(id => id.length > 0)
    );

    return this.comandasCerradas().filter(o => {
      const oId = (o.id || '').trim().toLowerCase();
      if (oId && idsPagosCorte.has(oId)) {
        return true;
      }

      if (!this.esMismoDia(this.fechaCierreOrden(o))) return false;

      // Match por ID del mesero
      if (keyId && (o.meseroId === keyId || String(o.meseroId) === String(keyId))) {
        return true;
      }

      const oName = (o.meseroNombre || '').trim().toLowerCase();
      const oEmail = (o.meseroEmail || (o.payment?.paidBy ? String(o.payment.paidBy) : '')).trim().toLowerCase();

      return (keyName && (oName === keyName || oEmail === keyName || oName.includes(keyName) || keyName.includes(oName))) ||
             (keyEmail && (oName === keyEmail || oEmail === keyEmail));
    });
  });

  /**
   * Platillos vendidos por el mesero, agregados por producto.
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

  /** Dinero del corte del mesero (calculado de sus comandas o del corte de backend). */
  totalDineroMesero = computed(() => {
    const h = this.comandasDelMesero().reduce((s, o) => s + (o.totalFinal ?? o.subtotal ?? 0), 0);
    const c = this.corteMesero()?.totalVentas ?? 0;
    return Math.max(h, c);
  });

  /** Propinas del mesero en el día. */
  totalPropinasMesero = computed(() => {
    const h = this.comandasDelMesero().reduce((s, o) => s + this.propinaOrden(o), 0);
    const c = this.corteMesero()?.totalPropinas ?? 0;
    return Math.max(h, c);
  });

  /** Calcula la cantidad total de piezas de platillo de una orden. */
  getTotalItemsOrden(o: PendingOrder): number {
    return (o.items ?? []).reduce((s, it) => s + (it.cantidad || 1), 0);
  }


  // ============ CORTE DEL DÍA (resumen general del turno) ============
  resumenDia = signal<ResumenTurnoCorte | null>(null);
  loadingResumenDia = signal<boolean>(false);

  /** Órdenes pagadas hoy, usada como respaldo cuando el turno aún no está abierto. */
  ordenesPagadasHoy = computed<PendingOrder[]>(() =>
    this.comandasCerradas().filter(o => this.esMismoDia(this.fechaCierreOrden(o)))
  );

  /** Propina de la orden (directa o calculada a partir del pago). */
  propinaOrden(o: PendingOrder): number {
    if (o.propina !== undefined && o.propina !== null) {
      return Number(o.propina) || 0;
    }
    const cuenta = o.totalFinal ?? o.subtotal ?? 0;
    return Math.max(0, (o.payment?.amount ?? 0) - cuenta);
  }

  diaComandas = computed(() => {
    const r = this.resumenDia();
    if (r?.totalComandasCobradas !== undefined && r?.totalComandasCobradas !== null) {
      return r.totalComandasCobradas;
    }
    return this.ordenesPagadasHoy().length;
  });

  /** Total recaudado en el día (cuenta + propinas cobradas hoy). */
  diaVentas = computed(() => {
    const r = this.resumenDia();
    if (r?.totalVentas !== undefined && r?.totalVentas !== null) {
      return r.totalVentas;
    }
    return this.ordenesPagadasHoy().reduce((s, o) => {
      const cuenta = o.totalFinal ?? o.subtotal ?? 0;
      const propina = this.propinaOrden(o);
      return s + cuenta + propina;
    }, 0);
  });

  /** Importe neto de la cuenta (ventas de platillos/bebidas sin propina). */
  diaCuentaVentas = computed(() => {
    const r = this.resumenDia();
    if (r?.totalCuenta !== undefined && r?.totalCuenta !== null) {
      return r.totalCuenta;
    }
    const recaudado = this.diaVentas();
    const propinas = this.diaPropinas();
    return Math.max(0, recaudado - propinas);
  });

  diaPropinas = computed(() => {
    const r = this.resumenDia();
    if (r?.totalPropinas !== undefined && r?.totalPropinas !== null) {
      return r.totalPropinas;
    }
    return this.ordenesPagadasHoy().reduce((s, o) => s + this.propinaOrden(o), 0);
  });

  diaArticulos = computed(() => {
    const r = this.resumenDia();
    if (r?.totalArticulosVendidos !== undefined && r?.totalArticulosVendidos !== null) {
      return r.totalArticulosVendidos;
    }
    return this.ordenesPagadasHoy().reduce(
      (s, o) => s + (o.items ?? []).reduce((x, it) => x + (it.cantidad || 0), 0),
      0
    );
  });

  diaTicketPromedio = computed(() => (this.diaComandas() > 0 ? this.diaVentas() / this.diaComandas() : 0));

  /** Métodos de pago del día acotados estrictamente a la fecha actual. */
  metodosPagoDia = computed<DesgloseMetodoPago[]>(() => {
    const delTurno = this.resumenDia()?.desgloseMetodos ?? [];
    const mapa = new Map<string, DesgloseMetodoPago>();

    if (delTurno.length > 0) {
      for (const dt of delTurno) {
        const clave = this.normalizarNombreMetodo(dt.metodoPago);
        const cuenta = Number(dt.totalCuenta || 0);
        const propina = Number(dt.totalPropina || 0);
        const recaudado = Number(dt.totalRecaudado || (cuenta + propina));
        const prev = mapa.get(clave) ?? {
          metodoPago: clave,
          transacciones: 0,
          totalCuenta: 0,
          totalPropina: 0,
          totalRecaudado: 0
        };
        prev.transacciones += Number(dt.transacciones || 0);
        prev.totalCuenta += cuenta;
        prev.totalPropina += propina;
        prev.totalRecaudado += recaudado;
        mapa.set(clave, prev);
      }
      return Array.from(mapa.values()).sort((a, b) => b.totalRecaudado - a.totalRecaudado);
    }

    // Respaldo desde el historial de comandas pagadas en el día
    for (const o of this.ordenesPagadasHoy()) {
      const rawMetodo = o.payment?.method || 'EFECTIVO';
      const clave = this.normalizarNombreMetodo(rawMetodo);
      const cuenta = o.totalFinal ?? o.subtotal ?? 0;
      const propina = this.propinaOrden(o);
      const prev = mapa.get(clave) ?? {
        metodoPago: clave,
        transacciones: 0,
        totalCuenta: 0,
        totalPropina: 0,
        totalRecaudado: 0
      };
      prev.transacciones += 1;
      prev.totalCuenta += cuenta;
      prev.totalPropina += propina;
      prev.totalRecaudado += cuenta + propina;
      mapa.set(clave, prev);
    }

    return Array.from(mapa.values()).sort((a, b) => b.totalRecaudado - a.totalRecaudado);
  });

  totalEfectivoDia = computed(() => {
    return this.metodosPagoDia()
      .filter(m => this.normalizarNombreMetodo(m.metodoPago) === 'EFECTIVO')
      .reduce((sum, m) => sum + m.totalRecaudado, 0);
  });

  totalTarjetaDia = computed(() => {
    return this.metodosPagoDia()
      .filter(m => this.normalizarNombreMetodo(m.metodoPago) === 'TARJETA')
      .reduce((sum, m) => sum + m.totalRecaudado, 0);
  });

  totalTransferenciaDia = computed(() => {
    return this.metodosPagoDia()
      .filter(m => this.normalizarNombreMetodo(m.metodoPago) === 'TRANSFERENCIA')
      .reduce((sum, m) => sum + m.totalRecaudado, 0);
  });

  totalOtrosMetodosDia = computed(() => {
    return this.metodosPagoDia()
      .filter(m => {
        const nom = this.normalizarNombreMetodo(m.metodoPago);
        return nom !== 'EFECTIVO' && nom !== 'TARJETA' && nom !== 'TRANSFERENCIA';
      })
      .reduce((sum, m) => sum + m.totalRecaudado, 0);
  });

  async abrirModalDesgloseVentas(): Promise<void> {
    await this.cargarResumenDia(false);
    this.modalDesgloseVentasVisible.set(true);
  }

  cerrarModalDesgloseVentas(): void {
    this.modalDesgloseVentasVisible.set(false);
  }

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
    EFECTIVO: 'EFECTIVO',
    DINERO: 'EFECTIVO',
    CARD: 'TARJETA',
    TARJETA: 'TARJETA',
    VISA: 'TARJETA',
    MASTERCARD: 'TARJETA',
    DEBITO: 'TARJETA',
    CREDITO: 'TARJETA',
    TERMINAL: 'TARJETA',
    TRANSFER: 'TRANSFERENCIA',
    TRANSFERENCIA: 'TRANSFERENCIA',
    SPEI: 'TRANSFERENCIA',
    BANCO: 'TRANSFERENCIA',
    MIXED: 'MIXTO',
    MIXTO: 'MIXTO'
  };

  normalizarNombreMetodo(raw?: string | null): string {
    if (!raw) return 'EFECTIVO';
    const norm = raw.trim().toUpperCase();
    return CajaComponent.NOMBRE_METODO[norm] ?? norm;
  }

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

  /** Genera la estructura de ticket de pre-cuenta localmente a partir de la orden. */
  private construirTicketLocal(comanda: PendingOrder | ComandaCajaRow): TicketPrecuenta {
    const orden = ('items' in comanda && Array.isArray((comanda as any).items))
      ? (comanda as PendingOrder)
      : this.todasComandas().find(o => o.id === comanda.id);

    const total = this.totalCuenta(comanda);
    const id = comanda.id || '';
    const folio = id.length > 8 ? id.slice(0, 8).toUpperCase() : id;
    const mesa = comanda.mesaNombre || 'Mesa General';
    const mesero = comanda.meseroNombre || 'Sin asignar';
    const cliente = this.getClientLabel(orden);

    const items = (orden?.items || []).map(it => ({
      nombreProducto: this.getProductLabel(it),
      cantidad: it.cantidad || 1,
      precioUnitario: this.getItemPrice(it),
      totalLinea: this.getItemPrice(it) * (it.cantidad || 1),
      asientoAlias: it.asientoAlias
    }));

    return {
      idComanda: id,
      folioComanda: folio,
      mesaNombre: mesa,
      meseroNombre: mesero,
      clienteNombre: cliente,
      fechaApertura: orden?.horaApertura || orden?.fechaCreacion || new Date().toISOString(),
      fechaImpresion: new Date().toISOString(),
      subtotal: orden?.subtotal || total,
      descuento: orden?.descuento || 0,
      total,
      propinaSugerida10: Math.round(total * 0.10 * 100) / 100,
      propinaSugerida15: Math.round(total * 0.15 * 100) / 100,
      propinaSugerida20: Math.round(total * 0.20 * 100) / 100,
      items: items.length > 0 ? items : [{
        nombreProducto: 'Consumo General',
        cantidad: 1,
        precioUnitario: total,
        totalLinea: total
      }]
    };
  }

  async imprimirTicket(comanda: PendingOrder | ComandaCajaRow, autoPrint = true): Promise<void> {
    if (!comanda) return;
    this.procesando.set(true);

    try {
      const resp = await firstValueFrom(this.cajaService.imprimirTicket(comanda.id, this.tenantId));
      const ticket = resp?.object || resp?.data;
      if (ticket) {
        this.ticketActual.set(ticket);
      } else {
        this.ticketActual.set(this.construirTicketLocal(comanda));
      }

      this.modalTicketVisible.set(true);

      // Actualizar estado local
      await Promise.all([
        this.cargarTablero(false),
        this.cargarHistorialComandas(false)
      ]);

      this.messageService.add({
        severity: 'info',
        summary: 'Ticket en Mesa',
        detail: `Pre-cuenta de ${comanda.mesaNombre || 'Mesa'} generada. La comanda pasó a "Por Cobrar".`
      });
      if (autoPrint) {
        setTimeout(() => this.imprimirVentanaTicket(), 250);
      }
    } catch (err: any) {
      console.warn('Fallback a pre-cuenta local para comanda:', comanda.id, err);
      // Fallback seguro: siempre abrir el ticket para que el cajero pueda imprimir
      const ticket = this.construirTicketLocal(comanda);
      this.ticketActual.set(ticket);
      this.modalTicketVisible.set(true);

      this.messageService.add({
        severity: 'info',
        summary: 'Ticket Generado',
        detail: `Pre-cuenta de ${comanda.mesaNombre || 'Mesa'} lista para imprimir.`
      });

      if (autoPrint) {
        setTimeout(() => this.imprimirVentanaTicket(), 250);
      }
    } finally {
      this.procesando.set(false);
    }
  }

  /**
   * Imprime el ticket térmico con formato estándar 80mm en una ventana/iframe aislada.
   * Evita problemas de estilos CSS globales y no altera la visualización del dashboard.
   */
  imprimirVentanaTicket(): void {
    const t = this.ticketActual();
    if (!t) return;

    const fechaFormateada = t.fechaImpresion ? new Date(t.fechaImpresion).toLocaleString('es-MX') : new Date().toLocaleString('es-MX');

    let itemsHtml = '';
    for (const it of t.items || []) {
      itemsHtml += `
        <tr>
          <td style="text-align: left; padding: 3px 0;">${it.cantidad}x ${it.nombreProducto}${it.asientoAlias ? ' (' + it.asientoAlias + ')' : ''}</td>
          <td style="text-align: right; padding: 3px 0; font-weight: bold;">$${(it.totalLinea || 0).toFixed(2)}</td>
        </tr>
      `;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Ticket - Comanda #${t.folioComanda}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              width: 72mm;
              margin: 0 auto;
              padding: 12px 0;
              font-size: 12px;
              color: #000;
              line-height: 1.25;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            .double-divider { border-top: 2px dashed #000; margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            .title { font-size: 16px; font-weight: 900; margin: 0 0 2px 0; text-align: center; }
            .subtitle { font-size: 11px; margin: 0 0 4px 0; text-align: center; }
            .total-row { font-size: 15px; font-weight: 900; }
            .propina-box { border: 1px dashed #444; padding: 6px; margin: 8px 0; font-size: 11px; }
          </style>
        </head>
        <body>
          <div class="title">PRE-CUENTA</div>
          <div class="subtitle">Comanda #${t.folioComanda}</div>
          <div class="divider"></div>
          <div><strong>Mesa:</strong> ${t.mesaNombre || 'Mesa General'}</div>
          <div><strong>Mesero:</strong> ${t.meseroNombre || 'Sin asignar'}</div>
          <div><strong>Cliente:</strong> ${t.clienteNombre || 'Venta General'}</div>
          <div><strong>Fecha:</strong> ${fechaFormateada}</div>
          <div class="divider"></div>
          <table>
            <thead>
              <tr style="border-bottom: 1px dashed #000;">
                <th style="text-align: left; padding: 2px 0;">Cant / Platillo</th>
                <th style="text-align: right; padding: 2px 0;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div class="divider"></div>
          ${t.descuento && t.descuento > 0 ? `
            <div style="display:flex; justify-content:space-between;">
              <span>Subtotal:</span>
              <span>$${(t.subtotal || t.total).toFixed(2)}</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span>Descuento:</span>
              <span>-$${(t.descuento).toFixed(2)}</span>
            </div>
          ` : ''}
          <div style="display:flex; justify-content:space-between;" class="total-row">
            <span>TOTAL:</span>
            <span>$${(t.total || 0).toFixed(2)}</span>
          </div>
          <div class="divider"></div>
          <div class="propina-box">
            <div class="text-center bold" style="margin-bottom: 3px;">PROPINA SUGERIDA</div>
            <div style="display:flex; justify-content:space-between;"><span>10%:</span> <strong>$${(t.propinaSugerida10 || (t.total * 0.10)).toFixed(2)}</strong></div>
            <div style="display:flex; justify-content:space-between;"><span>15%:</span> <strong>$${(t.propinaSugerida15 || (t.total * 0.15)).toFixed(2)}</strong></div>
            <div style="display:flex; justify-content:space-between;"><span>20%:</span> <strong>$${(t.propinaSugerida20 || (t.total * 0.20)).toFixed(2)}</strong></div>
          </div>
          <div class="double-divider"></div>
          <div class="text-center" style="font-size: 10px;">¡Gracias por su visita!</div>
          <div class="text-center" style="font-size: 9px; margin-top: 2px;">Este ticket no es un comprobante fiscal</div>
        </body>
      </html>
    `;

    let iframe = document.getElementById('ticket-print-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'ticket-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      }, 250);
    }
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
    const total = Number((this.totalCuenta(fila)).toFixed(2));
    this.montoCuentaInput = total;
    this.montoPropinaInput = 0;
    this.referenciaPagoInput = '';
    this.efectivoRecibidoInput = total;
    this.modalPagoVisible.set(true);
  }

  aplicarPropinaRapida(porcentaje: number): void {
    const base = Number(this.montoCuentaInput) || 0;
    this.montoPropinaInput = Math.round(base * porcentaje * 100) / 100;
    this.onPropinaChange();
  }

  onMontoCuentaChange(): void {
    if (this.metodoPagoSeleccionado === 'EFECTIVO' && this.efectivoRecibidoInput < this.totalAPagarModal) {
      this.efectivoRecibidoInput = this.totalAPagarModal;
    }
  }

  onPropinaChange(): void {
    if (this.metodoPagoSeleccionado === 'EFECTIVO' && this.efectivoRecibidoInput < this.totalAPagarModal) {
      this.efectivoRecibidoInput = this.totalAPagarModal;
    }
  }

  restablecerMontoOriginal(): void {
    const c = this.comandaSeleccionada();
    if (c) {
      this.montoCuentaInput = Number((c.total ?? 0).toFixed(2));
      this.onMontoCuentaChange();
    }
  }

  sugerirBilletes(total: number): number[] {
    const t = Number(total) || 0;
    const denominaciones = [50, 100, 200, 500, 1000];
    return denominaciones.filter(d => d > t).slice(0, 2);
  }

  get totalAPagarModal(): number {
    const cuenta = Number(this.montoCuentaInput) || 0;
    const propina = Number(this.montoPropinaInput) || 0;
    return Math.round((cuenta + propina) * 100) / 100;
  }

  get cambioEfectivo(): number {
    const recibido = Number(this.efectivoRecibidoInput) || 0;
    return Math.max(0, Math.round((recibido - this.totalAPagarModal) * 100) / 100);
  }

  async procesarCobro(): Promise<void> {
    const comanda = this.comandaSeleccionada();
    if (!comanda) return;

    const montoCuenta = Number(this.montoCuentaInput) || 0;
    const montoPropina = Number(this.montoPropinaInput) || 0;

    if (montoCuenta <= 0) {
      this.messageService.add({ severity: 'warn', summary: 'Monto inválido', detail: 'El monto de la cuenta debe ser mayor a 0' });
      return;
    }

    if (montoPropina < 0) {
      this.messageService.add({ severity: 'warn', summary: 'Propina inválida', detail: 'El monto de propina no puede ser negativo' });
      return;
    }

    this.procesando.set(true);
    try {
      let metodo = this.metodoPagoSeleccionado || 'EFECTIVO';
      if (metodo === 'VISA' || metodo === 'MASTERCARD' || metodo === 'TARJETA') {
        metodo = 'CARD';
      } else if (metodo === 'TRANSFERENCIA') {
        metodo = 'TRANSFER';
      } else if (metodo === 'VALES') {
        metodo = 'MIXED';
      }

      const cajeroId = this.userId > 0 ? this.userId : (this.turnoActivo()?.idCajero || 1);

      await firstValueFrom(this.cajaService.cobrarComanda(comanda.id, {
        tenantId: this.tenantId,
        cajeroId: cajeroId,
        metodoPago: metodo,
        montoCuenta: montoCuenta,
        montoPropina: montoPropina,
        referencia: this.referenciaPagoInput?.trim() || undefined
      }));

      this.modalPagoVisible.set(false);
      this.comandaSeleccionada.set(null);

      this.messageService.add({
        severity: 'success',
        summary: 'Pago Procesado',
        detail: `Cuenta de ${comanda.mesaNombre} cobrada exitosamente ($${(montoCuenta + montoPropina).toFixed(2)})`
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
      console.error('Error procesando cobro:', err);
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
        this.orderService.getOrdersByTenant(this.tenantId, undefined, 0, 250)
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
      const prodName = it.productName || it.prod || it.name || it.nombreProducto || it.productoNombre || it.product?.nombre || it.nombre;
      const prodId = it.productId ?? it.productoId;
      return {
        ...it,
        productName: prodName,
        productId: prodId,
        comentarios,
        asientoId: it.idAsiento ?? it.asientoId,
        asientoAlias: alias
      };
    });

    const propina = Number(order.propina ?? order.montoPropina ?? 0);
    const cuenta = Number(order.total ?? order.totalFinal ?? 0);

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
      meseroId: order.meseroId ?? order.idMesero,
      meseroEmail: order.meseroEmail,
      horaApertura,
      horaCierre,
      subcomandas: order.subcomandas ?? [],
      propina,
      propinasLiquidadas: order.propinasLiquidadas ?? false,
      payment: {
        method: order.paidMethod ?? order.paymentMethod,
        reference: order.paymentReference ?? null,
        paidAt: order.paidAt,
        paidBy: order.paidByName ?? order.paidBy,
        amount: order.payment?.amount ?? (cuenta + propina),
        tip: propina
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
      const email = this.authService.getCurrentUser()?.email || this.userName || undefined;
      await firstValueFrom(this.orderService.updateOrderStatus(target.id, 'CANCELLED', email, this.motivoCancelacion.trim()));
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
    setTimeout(() => this.imprimirVentanaTicket(), 250);
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
    return (
      item?.productName ||
      item?.prod ||
      item?.name ||
      item?.nombreProducto ||
      item?.productoNombre ||
      item?.product?.nombre ||
      item?.nombre ||
      (item?.productId ? `Producto #${item.productId}` : (item?.productoId ? `Producto #${item.productoId}` : 'Producto'))
    );
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
  async abrirCorteMesero(target: MeseroSimple | number): Promise<void> {
    let id: number;
    let meseroObj: MeseroSimple | null = null;
    if (typeof target === 'number') {
      id = target;
      meseroObj = this.meseros().find(m => m.id === id) ?? null;
    } else {
      id = target.id;
      meseroObj = target;
    }
    this.meseroSeleccionadoId.set(id);
    this.meseroSeleccionado.set(meseroObj);
    this.modalCorteMeseroVisible.set(true);
    this.fechaCorte.set(new Date());
    await Promise.all([this.cargarCorteMesero(), this.cargarHistorialComandas(false)]);
  }

  cerrarCorteMesero(): void {
    this.modalCorteMeseroVisible.set(false);
    this.meseroSeleccionadoId.set(null);
    this.meseroSeleccionado.set(null);
    this.corteMesero.set(null);
  }

  async cargarCorteMesero(): Promise<void> {
    const idMesero = this.meseroSeleccionadoId();
    if (!idMesero) {
      this.corteMesero.set(null);
      return;
    }

    this.loadingCorte.set(true);
    try {
      this.fechaCorte.set(new Date());
      const resp = await firstValueFrom(
        this.cajaService.getCorteMesero(idMesero, this.tenantId, undefined, this.fechaCorteISO())
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
      this.fechaCorte.set(new Date());
      const resp = await firstValueFrom(
        this.cajaService.getResumenTurno(turno.idTurno, this.tenantId, this.fechaCorteISO())
      );
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
    if (this.meseroSeleccionadoId()) {
      await this.cargarCorteMesero();
    }
  }

  get propinaNetaMesero(): number {
    const bruto = this.corteDelDia()?.propinasPendientesLiquidar ?? this.totalPropinasMesero();
    const retencion = (bruto * (this.retencionPropinasPorc / 100));
    return Math.max(0, bruto - retencion);
  }

  async liquidarPropinasMesero(): Promise<void> {
    const mesero = this.corteDelDia() || this.meseroSeleccionado();
    const idMesero = (mesero as any)?.idMesero ?? (mesero as any)?.id;
    const nombre = (mesero as any)?.nombreMesero ?? (mesero as any)?.nombre ?? 'Mesero';
    if (!idMesero) {
      this.messageService.add({ severity: 'info', summary: 'Sin selección', detail: 'Selecciona un mesero para ver su corte' });
      return;
    }

    await this.asegurarTurnoActivo();
    const turno = this.turnoActivo();
    if (!turno) {
      this.messageService.add({ severity: 'warn', summary: 'Atención', detail: 'Se requiere un turno de caja activo para liquidar' });
      return;
    }

    const propinas = (this.corteDelDia()?.propinasPendientesLiquidar && this.corteDelDia()!.propinasPendientesLiquidar > 0)
      ? this.corteDelDia()!.propinasPendientesLiquidar
      : this.totalPropinasMesero();
    if (propinas <= 0) {
      this.messageService.add({ severity: 'info', summary: 'Sin saldo', detail: 'No hay propinas pendientes de liquidar' });
      return;
    }

    this.procesando.set(true);
    try {
      await firstValueFrom(this.cajaService.liquidarPropinas({
        tenantId: this.tenantId,
        idTurno: turno.idTurno,
        idMesero: idMesero,
        idCajero: this.userId,
        porcentajeRetencion: this.retencionPropinasPorc
      }));

      this.messageService.add({
        severity: 'success',
        summary: 'Propinas Liquidadas',
        detail: `Se entregó neto de $${this.propinaNetaMesero.toFixed(2)} a ${nombre}`
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
