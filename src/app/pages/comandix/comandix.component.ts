import { Component, OnInit, OnDestroy, signal, computed, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, firstValueFrom } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';

// PrimeNG
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { DividerModule } from 'primeng/divider';
import { DialogModule } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';
import { TagModule } from 'primeng/tag';
import { BadgeModule } from 'primeng/badge';
import { DataViewModule } from 'primeng/dataview';
import { SkeletonModule } from 'primeng/skeleton';
import { CheckboxModule } from 'primeng/checkbox';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';

// Servicios
import { MenuService } from './services/menu.service';
import { OrderService } from './services/order.service';
import { OrderSseService, SseNewOrderEvent } from './services/order-sse.service';
import { ClienteService } from '@/pages/clientes/services/cliente.service';
import { RedemptionService } from '@/pages/redeem/services/redemption.service';
import { TenantService } from '@/pages/admin-page/service/tenant.service';
import { AuthService } from '@/auth/auth.service';
import { ProductService } from '@/pages/products-menu/service/product.service';
import { InventoryService } from '@/pages/inventario/service/inventory.service';
import { MesaService } from '@/pages/hostess/services/mesa.service';
import { environment } from '@/pages/commons/environment';

// Componentes
import { ClienteDialogComponent } from '@/pages/clientes/components/cliente-dialog/cliente-dialog.component';
import { CloseOrderModalComponent } from './components/close-order-modal/close-order-modal.component';
import { TicketModalComponent } from './components/ticket-modal/ticket-modal.component';
import { RegistrarMermaModalComponent } from './components/registrar-merma-modal/registrar-merma-modal.component';
import { SplitOrderModalComponent } from './components/split-order-modal/split-order-modal.component';

// Modelos
import { MenuCategory, Product, IngredientOption } from './models/menu.model';
import { MesaDTO } from '@/pages/hostess/models/mesa.model';
import {
  OrderItem,
  TenantClientOrderCreateRequest,
  TenantClientOrderUpdateRequest,
  PendingOrder,
  PendingOrderItem,
  OrderStatus,
  PaymentMethod,
  TipInfo,
  ComandaAsiento,
  ReporteVentaRow
} from './models/order.model';
import { Cliente, GENERO_OPTIONS, CreateClienteRequest } from '@/models/cliente.model';
import { RedemptionRequest, RedemptionChannel } from '@/pages/redeem/models/redemption-request.model';

interface CartItem {
  product: Product;
  cantidad: number;
  comentarios: string;
  precioUnitario?: number;
  excludedIngredientIds?: number[];
  additionalIngredientIds?: number[];
  configKey?: string;
  asientoId?: string;
  asientoAlias?: string;
}

interface StockInfo {
  stock: number;
  stockMinimo: number;
  low: boolean;
  out: boolean;
}

@Component({
  selector: 'app-comandix',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CardModule,
    ButtonModule,
    SelectModule,
    AutoCompleteModule,
    InputTextModule,
    InputNumberModule,
    ToastModule,
    DividerModule,
    DialogModule,
    ProgressSpinnerModule,
    MessageModule,
    TagModule,
    BadgeModule,
    DataViewModule,
    SkeletonModule,
    CheckboxModule,
    TooltipModule,
    TableModule,
    ClienteDialogComponent,
    CloseOrderModalComponent,
    TicketModalComponent,
    RegistrarMermaModalComponent,
    SplitOrderModalComponent
  ],
  providers: [MessageService],
  templateUrl: './comandix.component.html',
  styleUrls: ['./comandix.component.scss']
})
export class ComandixComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);

  // ==================== SIGNALS POS (existente) ====================
  categories = signal<MenuCategory[]>([]);

  // Ids de sub-recetas: NO se venden solas y se ocultan del catálogo
  subRecetaIds = signal<Set<number>>(new Set());

  // Filtro de categoría para el catálogo (0 = todas las categorías)
  selectedCategoryId = signal<number>(0);

  // Lista plana y deduplicada de productos de todas las categorías
  allProducts = computed<Product[]>(() => {
    const seen = new Set<number>();
    const subRecetaIds = this.subRecetaIds();
    const list: Product[] = [];
    for (const cat of this.categories()) {
      for (const p of cat.products) {
        if (p?.id && !seen.has(p.id) && !subRecetaIds.has(p.id)) {
          seen.add(p.id);
          list.push(p);
        }
      }
    }
    return list;
  });

  // Map de categoría -> ids de productos (un producto puede vivir en varias categorías)
  categoryProductIds = computed<Map<number, Set<number>>>(() => {
    const map = new Map<number, Set<number>>();
    for (const cat of this.categories()) {
      map.set(
        Number(cat.id),
        new Set(cat.products.map((p) => p.id))
      );
    }
    return map;
  });

  // Opciones para el selector de categoría (lista seleccionadora minimalista)
  categoryFilterOptions = computed(() => {
    const cats = this.categories();
    return [
      { label: 'Todas las categorías', value: 0 },
      ...cats.map((c) => ({ label: c.name, value: Number(c.id) }))
    ];
  });

  // Productos visibles según el filtro de categoría seleccionado
  filteredProducts = computed<Product[]>(() => {
    const all = this.allProducts();
    const selected = this.selectedCategoryId();
    if (!selected) return all;
    const ids = this.categoryProductIds().get(selected);
    if (!ids) return [];
    return all.filter((p) => ids.has(p.id));
  });
  clientes = signal<Cliente[]>([]);
  cart = signal<CartItem[]>([]);
  loading = signal<boolean>(false);
  processingOrder = signal<boolean>(false);

  // Cliente seleccionado
  selectedCliente: Cliente | null = null;
  filteredClientes: Cliente[] = [];

  // Descuento por cupón
  codigoCupon = '';
  descuentoAplicado = signal<number>(0);
  validatingCoupon = signal<boolean>(false);

  // Diálogo de nuevo cliente
  mostrarDialogoNuevoCliente = false;
  sidebarCarrito = false;
  formNuevoCliente!: FormGroup;
  generoOptions = GENERO_OPTIONS;
  submittedCliente = false;

  // Tenant ID
  tenantId: number = 0;
  private readonly CART_DRAFT_STORAGE_KEY = 'lealtix-comandix-cart-draft';

  // Mapa stock por producto (lo entrega /inventory/tenant/:id) para el badge de "cuántos salen aún"
  private stockMap: Map<number, StockInfo> = new Map();

  // Computed POS
  subtotal = computed(() => {
    return this.cart().reduce((sum, item) => sum + (this.getCartItemUnitPrice(item) * item.cantidad), 0);
  });

  totalFinal = computed(() => {
    return Math.max(0, this.subtotal() - this.descuentoAplicado());
  });

  // ==================== VERIFICACIÓN DE ALERGIAS (cliente seleccionado) ====================
  allergyDialogVisible = false;
  allergyCheckNames: string[] = [];
  allergyCheckProductName = '';
  allergyCheckClienteName = '';
  private allergyPending: { product: Product; excludedIds: number[]; additionalIds: number[]; extraPrice: number } | null = null;

  // ==================== CONFIGURACIÓN DE INGREDIENTES (modificables / adicionales) ====================
  ingredientConfigVisible = false;
  configProduct: Product | null = null;
  configModificables: IngredientOption[] = [];
  configAdicionales: IngredientOption[] = [];
  configExcludedIds = new Set<number>();
configAdditionalIds = new Set<number>();
configEditingItem: CartItem | null = null;

  // ==================== SIGNALS DASHBOARD DE ÓRDENES (nuevo) ====================
  activeView = signal<'pos' | 'orders' | 'report'>('pos');
  ordersView = signal<'active' | 'closed' | 'cancelled'>('active');
  pendingOrders = signal<PendingOrder[]>([]);
  loadingOrders = signal<boolean>(false);
  selectedOrder = signal<PendingOrder | null>(null);
  showOrderDetail = signal<boolean>(false);
  processingOrderAction = signal<boolean>(false);
  editingPendingOrder = signal<PendingOrder | null>(null);
  showCloseOrderModal = signal<boolean>(false);
  selectedOrderForPayment = signal<PendingOrder | null>(null);
  showCancelOrderDialog = signal<boolean>(false);
  selectedOrderForCancellation = signal<PendingOrder | null>(null);
  cancellingOrder = signal<boolean>(false);
  cancellationReason: string = '';

  // ==================== TICKET ====================
  showTicketModal = signal(false);
  selectedOrderForTicket = signal<PendingOrder | null>(null);
  ticketBusinessName = '';
  ticketBusinessAddress = '';
  ticketBusinessPhone = '';
  ticketInvoiceBaseUrl = 'http://localhost:4200/facturar/';
  ticketInvoiceUuid = signal('');

  onFacturaGenerated(event: { uuid: string; invoiceId: string } | null): void {
    this.ticketInvoiceUuid.set(event?.uuid || '');
  }

  canCloseOrders = false;
  canRegistrarMerma = false;
  currentUserEmail: string = '';

  // Modal de merma
  showMermaModal = signal<boolean>(false);
  selectedOrderForMerma = signal<PendingOrder | null>(null);
  showSplitModal = signal<boolean>(false);
  selectedOrderForSplit = signal<PendingOrder | null>(null);
  // Propina de cierre que se mantiene al dividir comandas
  splitOrderTip = signal<TipInfo | null>(null);

  // ==================== ASIENTOS / PERSONAS (Seat Management) ====================
  asientos = signal<ComandaAsiento[]>([
    { id: 'seat-1', numero: 1, alias: 'Persona 1', estado: 'ACTIVO' }
  ]);
  asientoActivoId = signal<string>('seat-1');
  asientoActivo = computed(() => {
    return this.asientos().find((a) => a.id === this.asientoActivoId()) ?? this.asientos()[0];
  });
  showEditAliasDialog = signal<boolean>(false);
  editingAsiento = signal<ComandaAsiento | null>(null);
  tempAliasInput: string = '';

  // ==================== TRAZABILIDAD (Mesa y Mesero) ====================
  mesas = signal<MesaDTO[]>([]);
  selectedMesa = signal<MesaDTO | null>(null);

  // ==================== REPORTE GENERAL DE VENTAS / COMANDAS ====================
  reporteFiltroFecha = signal<'hoy' | 'semana' | 'todos'>('hoy');
  reporteFiltroBusqueda = signal<string>('');

  // Computed: Órdenes activas (excluyendo PAGADA y CANCELADA)
  activeOrders = computed(() => {
    return this.pendingOrders().filter(order => {
      const normalized = this.normalizeOrderStatus(order.estado);
      return normalized !== 'PAGADA' && normalized !== 'CANCELADA' && normalized !== 'RECHAZADO';
    });
  });

  // Computed: Órdenes cerradas (PAGADA del día actual, filtradas por usuario actual)
  closedOrders = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.pendingOrders()
      .filter(order => this.normalizeOrderStatus(order.estado) === 'PAGADA')
      .filter(order => {
        // Validar que la orden fue pagada hoy
        if (!order.payment?.paidAt) {
          return false;
        }
        const paidDate = new Date(order.payment.paidAt);
        paidDate.setHours(0, 0, 0, 0);
        return paidDate.getTime() === today.getTime();
      })
      .filter(order => {
        // Filtrar por usuario actual que procesó el pago
        // Si paidBy está vacío o es 'usuario', mostrar igual (asumiendo que fue este usuario)
        const paidBy = order.payment?.paidBy ?? '';
        if (!paidBy || paidBy === 'usuario') {
          return true; // Mostrar si está vacío o es 'usuario'
        }
        // Si tiene email específico, verificar que sea el usuario actual
        return paidBy === this.currentUserEmail;
      })
      .sort((a, b) => {
        const dateA = a.payment?.paidAt ? new Date(a.payment.paidAt).getTime() : 0;
        const dateB = b.payment?.paidAt ? new Date(b.payment.paidAt).getTime() : 0;
        return dateB - dateA; // Más recientes primero
      });
  });

  // Órdenes canceladas por el usuario actual
  cancelledOrders = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.pendingOrders()
      .filter(order => this.normalizeOrderStatus(order.estado) === 'CANCELADA')
      .sort((a, b) => {
        const dateA = a.fechaCreacion ? new Date(a.fechaCreacion).getTime() : 0;
        const dateB = b.fechaCreacion ? new Date(b.fechaCreacion).getTime() : 0;
        return dateB - dateA; // Más recientes primero
      });
  });

  pendingOrdersCount = computed(() => this.activeOrders().length);
  closedOrdersCount = computed(() => this.closedOrders().length);
  cancelledOrdersCount = computed(() => this.cancelledOrders().length);

  reporteComandas = computed<ReporteVentaRow[]>(() => {
    const orders = this.pendingOrders();
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
        const clienteNombre = o.customerName || o.nombre || (o.customerId ? `Cliente #${o.customerId}` : 'Cliente no registrado');
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
      .filter((r) => r.estado_comanda === 'PAGADA')
      .reduce((sum, r) => sum + r.total_pagado, 0);
  });

  reporteTotalComandas = computed(() => {
    return this.reporteComandas().length;
  });

  reporteTicketPromedio = computed(() => {
    const pagadas = this.reporteComandas().filter((r) => r.estado_comanda === 'PAGADA');
    return pagadas.length > 0 ? this.reporteTotalVendido() / pagadas.length : 0;
  });

  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private editCountdownTimer: ReturnType<typeof setInterval> | null = null;
  private knownOrderIds = new Set<string>();
  private readonly POLLING_INTERVAL_MS = 30_000;
  private readonly NOTIFICATION_SOUND = 'assets/sounds/dragon-studio-correct-472358.mp3';
  private readonly ACTIVE_DASHBOARD_STATUSES: OrderStatus[] = ['PENDIENTE', 'CONFIRMADA', 'EN_PREPARACION', 'LISTO', 'PAGADA'];

  /** Prórroga de edición de comandas enviadas (minutos) */
  private readonly EDIT_WINDOW_MINUTES = 3;
  /** Timestamp 'ahora' para refrescar el countdown de edición cada segundo */
  nowTick = signal<number>(Date.now());
  private readonly editableStates: OrderStatus[] = ['PENDIENTE', 'CONFIRMADA'];

  private destroy$ = new Subject<void>();

  constructor(
    private menuService: MenuService,
    private orderService: OrderService,
    private orderSseService: OrderSseService,
    private clienteService: ClienteService,
    private redemptionService: RedemptionService,
    private tenantService: TenantService,
    private authService: AuthService,
    private productService: ProductService,
    private inventoryService: InventoryService,
    private mesaService: MesaService,
    private messageService: MessageService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.initializeClienteForm();
  }

  async ngOnInit(): Promise<void> {
    const initialView = this.route.snapshot.data['initialView'] || this.route.snapshot.queryParams['view'];
    if (initialView === 'report' || window.location.pathname.includes('reportes/ventas')) {
      this.switchView('report');
    }

    this.restoreCartDraft();
    this.startEditCountdown();
    await this.initializeTenant();
    if (this.tenantId > 0) {
      this.loadCatalog();
      this.loadStockInfo();
      this.loadClientes();
      this.loadMesas();
      this.startPolling();
      this.startSseConnection();
      this.subscribeToSseEvents();
    } else {
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
    if (this.editCountdownTimer) {
      clearInterval(this.editCountdownTimer);
      this.editCountdownTimer = null;
    }
    // NO desconectar el SSE aquí: la conexión es global (AppLayout la mantiene
    // viva en todos los módulos). Desconectarla al salir de esta página cortaría
    // las notificaciones en el resto del dashboard.
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== VISTA ACTIVA ====================

  switchView(view: 'pos' | 'orders' | 'report'): void {
    this.activeView.set(view);
    if (view === 'orders') {
      this.ordersView.set('active');
    }
  }

  switchOrdersView(view: 'active' | 'closed' | 'cancelled'): void {
    this.activeView.set('orders');
    this.ordersView.set(view);
  }

  // ==================== GESTIÓN DE ASIENTOS / PERSONAS ====================

  agregarAsiento(): void {
    const list = this.asientos();
    const nextNum = list.length + 1;
    const nuevoAsiento: ComandaAsiento = {
      id: `seat-${Date.now()}-${nextNum}`,
      numero: nextNum,
      alias: `Persona ${nextNum}`,
      estado: 'ACTIVO'
    };
    this.asientos.update((items) => [...items, nuevoAsiento]);
    this.asientoActivoId.set(nuevoAsiento.id);
    this.messageService.add({
      severity: 'info',
      summary: 'Comensal agregado',
      detail: `Ahora tomando orden para ${nuevoAsiento.alias}`,
      life: 2000
    });
  }

  seleccionarAsiento(id: string): void {
    this.asientoActivoId.set(id);
  }

  abrirEditarAlias(asiento: ComandaAsiento, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.editingAsiento.set(asiento);
    this.tempAliasInput = asiento.alias;
    this.showEditAliasDialog.set(true);
  }

  guardarAlias(): void {
    const target = this.editingAsiento();
    if (target && this.tempAliasInput.trim()) {
      const nuevoAlias = this.tempAliasInput.trim();
      this.asientos.update((list) =>
        list.map((a) => (a.id === target.id ? { ...a, alias: nuevoAlias } : a))
      );
      this.cart.update((items) =>
        items.map((i) => (i.asientoId === target.id ? { ...i, asientoAlias: nuevoAlias } : i))
      );
      this.showEditAliasDialog.set(false);
      this.messageService.add({
        severity: 'success',
        summary: 'Alias guardado',
        detail: `Comensal renombrado a "${nuevoAlias}"`,
        life: 2000
      });
    }
  }

  countItemsPorAsiento(asientoId: string): number {
    return this.cart()
      .filter((i) => i.asientoId === asientoId)
      .reduce((sum, i) => sum + i.cantidad, 0);
  }

  totalPorAsiento(asientoId: string): number {
    return this.cart()
      .filter((i) => i.asientoId === asientoId)
      .reduce((sum, i) => sum + (this.getCartItemUnitPrice(i) * i.cantidad), 0);
  }

  // ==================== CARGA DE MESAS ====================

  private loadMesas(): void {
    if (this.tenantId <= 0) return;
    this.mesaService.getMesas(this.tenantId).subscribe({
      next: (mesas) => {
        if (mesas && mesas.length > 0) {
          this.mesas.set(mesas);
          if (!this.selectedMesa()) {
            this.selectedMesa.set(mesas[0]);
          }
        } else {
          const defaultMesas: MesaDTO[] = [
            { id: 1, tenantId: this.tenantId, nombre: 'Mesa 1', numero: 1, capacidad: 4, estado: 'LIBRE' },
            { id: 2, tenantId: this.tenantId, nombre: 'Mesa 2', numero: 2, capacidad: 4, estado: 'LIBRE' },
            { id: 3, tenantId: this.tenantId, nombre: 'Mesa 3', numero: 3, capacidad: 4, estado: 'LIBRE' },
            { id: 4, tenantId: this.tenantId, nombre: 'Barra', numero: 4, capacidad: 2, estado: 'LIBRE' }
          ];
          this.mesas.set(defaultMesas);
          this.selectedMesa.set(defaultMesas[0]);
        }
      },
      error: () => {
        const defaultMesas: MesaDTO[] = [
          { id: 1, tenantId: this.tenantId, nombre: 'Mesa 1', numero: 1, capacidad: 4, estado: 'LIBRE' },
          { id: 2, tenantId: this.tenantId, nombre: 'Mesa 2', numero: 2, capacidad: 4, estado: 'LIBRE' },
          { id: 3, tenantId: this.tenantId, nombre: 'Mesa 3', numero: 3, capacidad: 4, estado: 'LIBRE' },
          { id: 4, tenantId: this.tenantId, nombre: 'Barra', numero: 4, capacidad: 2, estado: 'LIBRE' }
        ];
        this.mesas.set(defaultMesas);
        this.selectedMesa.set(defaultMesas[0]);
      }
    });
  }

  // ==================== POLLING DE ÓRDENES PENDIENTES ====================

  private startPolling(): void {
    this.pollOrders();
    this.pollingInterval = setInterval(() => this.pollOrders(), this.POLLING_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollingInterval !== null) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  async pollOrders(): Promise<void> {
    if (this.tenantId <= 0) return;
    try {
      console.log('[Comandix] 🔄 Consultando órdenes activas...');
      const responses = await Promise.all(
        this.ACTIVE_DASHBOARD_STATUSES.map((status) =>
          firstValueFrom(this.orderService.getOrdersByTenant(this.tenantId, status))
        )
      );

      const rawOrders = responses
        .flatMap((response) => response?.object?.content ?? [])
        .filter((order, index, array) => index === array.findIndex((current) => current?.id === order?.id));

      console.log('[Comandix] 📦 Órdenes recibidas del BE:', rawOrders.length, rawOrders);

      const isFirstPoll = this.knownOrderIds.size === 0;

      const mappedOrders: PendingOrder[] = rawOrders.map((order: any) => this.mapBackendOrder(order));

      const pendingOrders = mappedOrders.filter((order) => this.normalizeOrderStatus(order.estado) === 'PENDIENTE');

      // La notificación de nueva orden (sonido + toast) la maneja AppLayout vía SSE
      // en todos los módulos. Aquí solo se detectan para registrarlas como conocidas.

      // Detectar nuevas órdenes (solo logging; sin alerta para no duplicar)
      const newOrders = mappedOrders.filter(order => !this.knownOrderIds.has(order.id));
      if (!isFirstPoll && newOrders.length > 0) {
        console.log('[Comandix] 🆕 Nuevas órdenes detectadas vía polling:', newOrders.length);
      }

      // Registrar todas las órdenes conocidas
      mappedOrders.forEach(order => {
        this.knownOrderIds.add(order.id);
      });

      // ==================== FUSIONAR ÓRDENES ====================
      // Combinar órdenes del polling con las existentes (mantener órdenes SSE)
      this.pendingOrders.update(existingOrders => {
        const polledOrderMap = new Map(mappedOrders.map(o => [o.id, o]));
        const existingOrderMap = new Map(existingOrders.map(o => [o.id, o]));

        // Crear nueva lista fusionada
        const mergedOrders: PendingOrder[] = [];

        // 1. Agregar/actualizar todas las órdenes del polling
        mappedOrders.forEach(order => {
          mergedOrders.push(order);
        });

        // 2. Agregar órdenes SSE que no están en el polling
        existingOrders.forEach(existing => {
          if (!polledOrderMap.has(existing.id)) {
            mergedOrders.push(existing);
          }
        });

        console.log('[Comandix] ✅ Órdenes pendientes actualizadas:', mergedOrders.length);
        return mergedOrders;
      });

      // Mostrar alerta en primera carga si hay órdenes
      if (isFirstPoll && mappedOrders.length > 0) {
        console.log('[Comandix] 📊 Primera carga:', mappedOrders.length, 'órdenes activas');
        this.messageService.add({
          severity: 'info',
          summary: 'Órdenes Activas',
          detail: `Tienes ${mappedOrders.length} orden${mappedOrders.length === 1 ? '' : 'es'} activa${mappedOrders.length === 1 ? '' : 's'}`,
          life: 5000,
          icon: 'pi pi-info-circle'
        });
      }
    } catch (error) {
      console.error('Error al consultar órdenes activas:', error);
    }

    this.loadStockInfo();
  }

  private mapBackendOrder(order: any): PendingOrder {
    const mesaId = order.idMesa ?? order.mesaId;
    const mesaObj = this.mesas().find(m => m.id === mesaId);
    const mesaNombre = order.mesaNombre ?? (mesaObj ? mesaObj.nombre : (mesaId ? `Mesa #${mesaId}` : undefined));
    const mesaNumero = order.mesaNumero ?? (mesaObj ? mesaObj.numero : undefined);
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

  // ==================== SSE (SERVER-SENT EVENTS) ====================

  /**
   * Inicia la conexión SSE con el backend
   * SSE es más eficiente que polling para notificaciones push del servidor
   */
  private startSseConnection(): void {
    console.log('[Comandix] Iniciando conexión SSE con tenantId:', this.tenantId);
    this.orderSseService.connect(this.tenantId);
  }

  /**
   * Se suscribe a los eventos SSE de nuevas órdenes
   */
  private subscribeToSseEvents(): void {
    // Escuchar nuevas órdenes del SSE (provenientes del CHATBOT)
    this.orderSseService.newOrder$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sseEvent: SseNewOrderEvent) => {
          // Validar que la orden sea para este tenant
          if (sseEvent.tenantId !== this.tenantId) {
            console.debug('[Comandix] Evento SSE de otro tenant, ignorando:', sseEvent.tenantId);
            return;
          }

          const order = sseEvent.order;

          // Evitar duplicados: si ya existe la orden, no la añadimos
          if (this.knownOrderIds.has(order.id)) {
            console.debug('[Comandix] Orden del SSE ya existe, ignorando duplicado:', order.id);
            return;
          }

          console.log('[Comandix] Nueva orden SSE recibida del CHATBOT:', {
            orderId: order.id,
            cliente: order.customerId,
            total: order.total,
            estado: order.estado
          });

          this.knownOrderIds.add(order.id);

          // Agregar la nueva orden a la lista
          // Mapear estructura SSE a PendingOrder compatible
          const pendingOrder: PendingOrder = {
            id: order.id,
            tenantId: order.tenantId,
            estado: this.normalizeOrderStatus(order.estado),
            customerId: order.customerId ?? null,
            customerName: order.customerName ?? null,
            nombre: order.customerName ?? null,
            items: order.items ?? [],
            subtotal: order.subtotal ?? order.total,
            descuento: order.descuento ?? 0,
            totalFinal: order.total,
            couponCode: order.couponCode ?? null,
            coupon_id: order.couponId ?? null,
            fechaCreacion: order.fecha
          };

          // Actualizar lista de órdenes
          this.pendingOrders.update(orders => {
            const exists = orders.some(o => o.id === order.id);
            if (exists) return orders;
            return [pendingOrder, ...orders]; // Agregar al inicio para que sea visible
          });

          // Dispara la alerta (sonido DOBLE + confetti + DIALOG DETALLADO)
          // Muestra los datos completos de la orden (con estado correctamente mapeado)
          this.triggerNewOrderAlertWithDetailsAndDialog(pendingOrder);
        },
        error: (error) => {
          console.error('[Comandix] Error en SSE newOrder$:', error);
        }
      });

    // Escuchar cambios en el estado de la conexión SSE
    this.orderSseService.connectionStatus$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (status) => {
          console.log('[Comandix] Estado SSE:', status);
          if (status === 'connected') {
            console.log('[Comandix] ✓ Conectado a notificaciones del CHATBOT en tiempo real');
          } else if (status === 'disconnected') {
            console.warn('[Comandix] ✗ Desconectado de SSE');
          } else if (status === 'error') {
            console.warn('[Comandix] ✗ Error en SSE');
          }
        }
      });

    // Escuchar mensajes de error del SSE
    this.orderSseService.errorMessage$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (errorMessage) => {
          console.warn('[Comandix] Mensaje de error SSE:', errorMessage);
          this.messageService.add({
            severity: 'warn',
            summary: 'Conexión en vivo',
            detail: errorMessage,
            life: 4000
          });
        }
      });
  }

  /**
   * Dispara la alerta con detalles específicos de la orden SSE
   * Sonido DOBLE + Confetti + Dialog detallado
   */
  private triggerNewOrderAlertWithDetailsAndDialog(order: any): void {
    // El sonido + confetti + toast global ya lo maneja AppLayout (funciona en cualquier página).
    // Aquí solo abrimos el detalle de la orden dentro de la pantalla del mesero.
    this.openOrderDetail(order);
  }

  // ==================== ALERTA DE NUEVA ORDEN ====================
  // La notificación (sonido + confetti + toast) la maneja AppLayout vía SSE en
  // todos los módulos, para que llegue una sola vez sin importar la página.

  // ==================== DETALLE DE ORDEN ====================

  openOrderDetail(order: PendingOrder): void {
    this.selectedOrder.set(order);
    this.showOrderDetail.set(true);
  }

  closeOrderDetail(): void {
    this.showOrderDetail.set(false);
    this.selectedOrder.set(null);
  }

  openCloseOrderModal(order: PendingOrder): void {
    if (!this.canCloseOrder(order) || this.processingOrderAction()) {
      return;
    }

    this.selectedOrderForPayment.set(order);
    this.showCloseOrderModal.set(true);
    this.ticketInvoiceUuid.set('');
  }

  closeCloseOrderModal(): void {
    this.showCloseOrderModal.set(false);
    this.selectedOrderForPayment.set(null);
  }

  onCloseOrderModalVisibilityChange(visible: boolean): void {
    this.showCloseOrderModal.set(visible);
    if (!visible) {
      this.selectedOrderForPayment.set(null);
    }
  }

  openMermaModal(order: PendingOrder): void {
    if (!this.canRegistrarMerma || this.processingOrderAction()) {
      return;
    }
    this.selectedOrderForMerma.set(order);
    this.showMermaModal.set(true);
  }

  onMermaModalVisibilityChange(visible: boolean): void {
    this.showMermaModal.set(visible);
    if (!visible) {
      this.selectedOrderForMerma.set(null);
    }
  }

  onMermaRegistrada(orderId: string): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Merma registrada',
      detail: `Merma registrada para la orden #${orderId.slice(0, 8)}`,
      life: 4000
    });
  }

  onPaymentRecorded(event: { orderId: string; method: PaymentMethod; reference?: string | null; paidAt: string }): void {
    const existing = this.pendingOrders().find((order) => order.id === event.orderId);
    if (!existing) {
      return;
    }

    const updatedOrder: PendingOrder = {
      ...existing,
      estado: 'PAGADA',
      payment: {
        method: event.method,
        reference: event.reference ?? null,
        paidAt: event.paidAt,
        paidBy: this.currentUserEmail
      }
    };

    this.pendingOrders.update((orders) =>
      orders.map((order) => (order.id === event.orderId ? updatedOrder : order))
    );

    if (this.selectedOrder()?.id === event.orderId) {
      this.selectedOrder.set(updatedOrder);
    }

    // Mostrar el ticket imprimible con el QR de autofacturación
    this.selectedOrderForTicket.set(updatedOrder);
    this.showTicketModal.set(true);

    this.closeCloseOrderModal();

    this.messageService.add({
      severity: 'success',
      summary: 'Pago registrado',
      detail: `La orden #${event.orderId.slice(0, 8)} quedó en estado PAGADA`,
      life: 4000
    });
  }

  // ==================== DIVISIÓN DE CUENTA (pagar por separado) ====================

  onCobroSeparado(event: { order: PendingOrder; tip?: TipInfo | null }): void {
    this.closeCloseOrderModal();
    this.selectedOrderForSplit.set(event.order);
    this.splitOrderTip.set(event.tip ?? null);
    this.showSplitModal.set(true);
  }

  onSplitModalVisibilityChange(visible: boolean): void {
    this.showSplitModal.set(visible);
    if (!visible) {
      this.selectedOrderForSplit.set(null);
      this.splitOrderTip.set(null);
    }
  }

  async onCuentaCreada(event: { originalOrderId: string; newOrderId: string; newOrderIds?: string[] }): Promise<void> {
    const totalComandas = event.newOrderIds?.length ?? 1;
    this.messageService.add({
      severity: 'success',
      summary: totalComandas > 1 ? 'Cuenta dividida equitativamente' : 'Cuenta dividida',
      detail:
        totalComandas > 1
          ? `La cuenta #${event.originalOrderId.slice(0, 8)} se repartió en ${totalComandas + 1} comandas de monto balanceado`
          : `La cuenta #${event.originalOrderId.slice(0, 8)} se separó y se creó la comanda #${event.newOrderId.slice(0, 8)}`,
      life: 4500
    });

    await this.pollOrders();
  }

  editPendingOrderInPos(order: PendingOrder): void {
    if (!this.canEditOrder(order)) {
      this.messageService.add({
        severity: 'error',
        summary: 'Prórroga vencida',
        detail: 'La comanda se envió hace más de 3 minutos y ya no puede editarse',
        life: 3000
      });
      return;
    }

    const latestOrder = this.pendingOrders().find((existingOrder) => existingOrder.id === order.id) ?? order;

    this.selectedCliente = this.resolveClienteFromOrder(latestOrder);
    this.codigoCupon = latestOrder.couponCode ?? '';
    this.descuentoAplicado.set(Number(latestOrder.descuento ?? 0));
    this.cart.set(this.buildCartFromPendingOrder(latestOrder));
    this.editingPendingOrder.set(latestOrder);
    this.closeOrderDetail();
    this.switchView('pos');

    this.messageService.add({
      severity: 'info',
      summary: 'Editando orden',
      detail: `La orden #${latestOrder.id.slice(0, 8)} fue cargada en la comanda`,
      life: 3000
    });
  }

  cancelPendingOrderEdition(): void {
    const currentOrder = this.editingPendingOrder();
    this.resetForm();
    this.switchView('orders');

    if (currentOrder) {
      this.messageService.add({
        severity: 'info',
        summary: 'Edición cancelada',
        detail: `La orden #${currentOrder.id.slice(0, 8)} sigue pendiente`,
        life: 3000
      });
    }
  }

  private playNotificationSound(times = 1, delayMs = 500): void {
    for (let index = 0; index < times; index++) {
      setTimeout(() => {
        try {
          const audio = new Audio(this.NOTIFICATION_SOUND);
          audio.play().catch(() => {});
        } catch {
          // silent: archivo puede no existir en dev
        }
      }, index * delayMs);
    }
  }

  /** Devuelve true si la orden tiene menos de 2 minutos */
  isNewOrder(order: PendingOrder): boolean {
    if (!order.fechaCreacion) return false;
    const diffMs = Date.now() - new Date(order.fechaCreacion).getTime();
    return diffMs < 2 * 60 * 1000;
  }

  /** Arranca el timer que refresca nowTick cada segundo para el countdown de edición */
  private startEditCountdown(): void {
    if (this.editCountdownTimer) {
      clearInterval(this.editCountdownTimer);
    }
    this.editCountdownTimer = setInterval(() => {
      this.nowTick.set(Date.now());
    }, 1000);
  }

  /** True si la comanda aún puede editarse (estado pendiente/confirmada y dentro de la prórroga) */
  canEditOrder(order: PendingOrder): boolean {
    if (!order) return false;
    if (!this.editableStates.includes(order.estado as OrderStatus)) return false;
    if (!order.fechaCreacion) return false;
    const created = new Date(order.fechaCreacion).getTime();
    const now = this.nowTick();
    const diffMs = now - created;
    return diffMs >= 0 && diffMs < this.EDIT_WINDOW_MINUTES * 60 * 1000;
  }

  /** Segundos restantes de la prórroga para la orden (0 si venció) */
  private getEditableRemainingSeconds(order: PendingOrder): number {
    if (!order?.fechaCreacion) return 0;
    const created = new Date(order.fechaCreacion).getTime();
    const diffMs = this.nowTick() - created;
    const remainingSec = Math.ceil((this.EDIT_WINDOW_MINUTES * 60 * 1000 - diffMs) / 1000);
    return remainingSec > 0 ? remainingSec : 0;
  }

  /** Etiqueta "Editable por mm:ss" para la tarjeta de la comanda */
  editCountdownLabel(order: PendingOrder): string {
    const seconds = this.getEditableRemainingSeconds(order);
    if (seconds <= 0) return '';
    const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
    const ss = (seconds % 60).toString().padStart(2, '0');
    return `Editable por ${mm}:${ss}`;
  }

  /** Nombre legible del cliente para mostrar en la tarjeta */
  getClientLabel(order: PendingOrder): string {
    return order.customerName ?? order.nombre ?? 'Cliente General';
  }

  /** Nombre del producto del item (con fallback a productId) */
  getProductLabel(item: any): string {
    return item.productName ?? item.prod ?? `Producto #${item.productId}`;
  }

  /** Precio unitario del item (normaliza campo) */
  getItemPrice(item: any): number {
    return item.precioUnitario ?? item.precio ?? 0;
  }

  // ==================== STOCK DISPONIBLE POR PRODUCTO ("cuántos salen aún") ====================

  /** Carga el stock actual de cada producto del menú (dinámico si tiene receta). */
  private async loadStockInfo(): Promise<void> {
    if (this.tenantId <= 0) return;
    try {
      const resp = await firstValueFrom(this.inventoryService.getByTenant(this.tenantId));
      const items = Array.isArray(resp?.object) ? resp.object : [];
      const map = new Map<number, StockInfo>();
      for (const p of items) {
        if (p?.id == null) continue;
        map.set(Number(p.id), {
          stock: typeof p.stock === 'number' ? p.stock : 0,
          stockMinimo: typeof p.stockMinimo === 'number' ? p.stockMinimo : 0,
          low: !!p.lowStock,
          out: !!p.outOfStock
        });
      }
      this.stockMap = map;
      this.cdr.markForCheck();
    } catch (error) {
      console.warn('[Comandix] No se pudo cargar el stock de productos:', error);
    }
  }

  /** Stock tracked del item (null si el producto no está en inventario). */
  getStockInfo(item: any): StockInfo | null {
    if (!item || item.productId == null) return null;
    return this.stockMap.get(Number(item.productId)) ?? null;
  }

  /** Piezas que quedan disponibles de este producto. */
  getRemainingStock(item: any): number {
    const info = this.getStockInfo(item);
    return info ? Math.max(0, Math.floor(info.stock)) : 0;
  }

  /** True si el artículo está por debajo del stock mínimo o agotado. */
  isLowStock(item: any): boolean {
    const info = this.getStockInfo(item);
    return !!info && (info.low || info.out);
  }

  /** True si el stock es crítico (quedan 3 o menos piezas, o está marcado bajo/agotado). */
  isCriticalStock(item: any): boolean {
    const info = this.getStockInfo(item);
    if (!info) return false;
    return info.low || info.out || this.getRemainingStock(item) <= 3;
  }

  /** True si no quedan piezas. */
  isStockZero(item: any): boolean {
    const info = this.getStockInfo(item);
    return !!info && info.stock <= 0;
  }

  /** Productos de la orden por debajo del stock mínimo/agotados, para la tarjeta de orden. */
  getLowStockItems(order: any): { label: string; remaining: number; zero: boolean }[] {
    if (!order?.items) return [];
    const seen = new Set<number>();
    const result: { label: string; remaining: number; zero: boolean }[] = [];
    for (const item of order.items) {
      const info = this.getStockInfo(item);
      if (!info || !(info.low || info.out)) continue;
      const pid = item.productId != null ? Number(item.productId) : null;
      if (pid != null && seen.has(pid)) continue;
      if (pid != null) seen.add(pid);
      result.push({
        label: this.getProductLabel(item),
        remaining: this.getRemainingStock(item),
        zero: this.isStockZero(item)
      });
    }
    return result;
  }

  canCloseOrder(order: PendingOrder): boolean {
    if (!this.canCloseOrders) {
      return false;
    }
    return order.estado === 'CONFIRMADA' || order.estado === 'LISTO';
  }

  getStatusClass(estado: string | undefined): string {
    const normalized = this.normalizeOrderStatus(estado);
    if (normalized === 'PENDIENTE') return 'status-comanda';
    if (normalized === 'CONFIRMADA') return 'status-confirmada';
    if (normalized === 'EN_PREPARACION') return 'status-en_preparacion';
    if (normalized === 'LISTO') return 'status-listo';
    if (normalized === 'PAGADA') return 'status-pagada';
    if (normalized === 'CANCELADA') return 'status-cancelada';
    return 'status-comanda';
  }

  // ==================== ACCIONES DEL MESERO ====================

  async confirmarOrden(order: PendingOrder): Promise<void> {
    if (this.processingOrderAction()) return;
    this.processingOrderAction.set(true);
    try {
      await firstValueFrom(this.orderService.updateOrderStatus(order.id, 'CONFIRMED'));

      // Si la orden tiene cupón aplicado, redimirlo
      const couponCode = order.couponCode;
      const couponId = order.coupon_id != null && order.coupon_id !== ''
        ? Number(order.coupon_id)
        : null;

      if (couponCode || couponId !== null) {
        try {
          const redemptionReq: RedemptionRequest = {
            redeemedBy: order.customerId?.toString() ?? 'COMANDIX',
            channel: RedemptionChannel.QR_ADMIN,
            originalAmount: order.subtotal,
            metadata: `Orden confirmada #${order.id}`
          };

          if (couponCode) {
            await firstValueFrom(
              this.redemptionService.redeemCouponByCode(couponCode, redemptionReq, this.tenantId)
            );
          } else if (couponId !== null && !Number.isNaN(couponId)) {
            await firstValueFrom(
              this.redemptionService.redeemCouponById(couponId, redemptionReq, this.tenantId)
            );
          }

          this.messageService.add({
            severity: 'info',
            summary: 'Cupón redimido',
            detail: `Cupón ${couponCode ?? couponId} aplicado exitosamente`,
            life: 3000
          });
        } catch (couponError) {
          console.warn('Advertencia al redimir cupón:', couponError);
          this.messageService.add({
            severity: 'warn',
            summary: 'Cupón',
            detail: 'La orden se confirmó pero el cupón no pudo redimirse',
            life: 4000
          });
        }
      }

      this.messageService.add({
        severity: 'success',
        summary: 'Orden confirmada',
        detail: `Orden #${order.id.slice(0, 8)}… confirmada exitosamente`,
        life: 3000
      });

      this.patchOrderStatus(order.id, 'CONFIRMADA');
      this.closeOrderDetail();
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error al confirmar',
        detail: error.message ?? 'No se pudo confirmar la orden',
        life: 3000
      });
    } finally {
      this.processingOrderAction.set(false);
    }
  }

  async rechazarOrden(order: PendingOrder): Promise<void> {
    this.selectedOrderForCancellation.set(order);
    this.showCancelOrderDialog.set(true);
  }

  async onCancelOrderConfirmed(reason: string): Promise<void> {
    const order = this.selectedOrderForCancellation();
    if (!order || this.cancellingOrder()) return;

    this.cancellingOrder.set(true);
    try {
      await firstValueFrom(
        this.orderService.updateOrderStatus(
          order.id,
          'CANCELADA',
          this.currentUserEmail,
          reason
        )
      );

      this.messageService.add({
        severity: 'info',
        summary: 'Orden cancelada',
        detail: `Orden #${order.id.slice(0, 8)}… cancelada`,
        life: 3000
      });

      this.removeOrderFromList(order.id);
      this.showCancelOrderDialog.set(false);
      this.selectedOrderForCancellation.set(null);
      this.closeOrderDetail();
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error al cancelar',
        detail: error.message ?? 'No se pudo cancelar la orden',
        life: 3000
      });
    } finally {
      this.cancellingOrder.set(false);
    }
  }

  onCancelOrderDialogCancel(): void {
    this.showCancelOrderDialog.set(false);
    this.selectedOrderForCancellation.set(null);
  }

  private removeOrderFromList(orderId: string): void {
    this.knownOrderIds.delete(orderId);
    this.pendingOrders.update(orders => orders.filter(o => o.id !== orderId));
  }

  private patchOrderStatus(orderId: string, estado: OrderStatus): void {
    this.pendingOrders.update((orders) =>
      orders.map((order) => (order.id === orderId ? { ...order, estado } : order))
    );
  }

  // ==================== TENANT ====================

  private async initializeTenant(): Promise<void> {
    try {
      const currentUser = this.authService.getCurrentUser();
      this.tenantId = currentUser?.tenantId ?? 0;
      this.currentUserEmail = currentUser?.email ?? 'usuario';
      this.canCloseOrders = this.authService.hasAnyPermission(['process_payment', 'create_order']);
      this.canRegistrarMerma = this.authService.hasAnyPermission(['manage_mermas']);
      this.loadTicketBusinessInfo();
    } catch (error) {
      console.error('Error obteniendo tenant:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo obtener información del negocio',
        life: 3000
      });
    }
  }

  private loadTicketBusinessInfo(): void {
    if (!this.tenantId) {
      return;
    }
    this.tenantService.getTenantById(this.tenantId).subscribe({
      next: (t: any) => {
        this.ticketBusinessName = t?.bussinessName || t?.nombreNegocio || 'Lealtix';
        this.ticketBusinessAddress = t?.direccion || '';
        this.ticketBusinessPhone = t?.telefono || '';
      },
      error: () => {
        // noop
      }
    });
  }

  // ==================== CATÁLOGO (existente) ====================
  private loadCatalog(): void {
    this.loading.set(true);
    this.loadSubRecetaIds();
    this.loadCatalogFromProducts();
  }

  // Las sub-recetas no se venden solas: se cargan sus ids para ocultarlas del menú
  private loadSubRecetaIds(): void {
    this.inventoryService
      .getSubRecetas(this.tenantId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const list = res?.object ?? [];
          const ids = new Set<number>();
          list.forEach((sr: any) => {
            const sid = this.normalizeProductId(sr.id);
            if (sid != null) {
              ids.add(sid);
            }
          });
          this.subRecetaIds.set(ids);
        },
        error: (err) => {
          console.error('Error cargando sub-recetas para el menú:', err);
          this.subRecetaIds.set(new Set());
        }
      });
  }

  private normalizeProductId(id: unknown): number | null {
    if (id === null || id === undefined) {
      return null;
    }
    const parsed = typeof id === 'number' ? id : Number(id);
    return Number.isNaN(parsed) ? null : parsed;
  }

  private loadCatalogFromProducts(): void {
    this.productService
      .getProductsByTenantId(this.tenantId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (productResp) => {
          const responseObject = productResp?.object;
          const pagedProducts = responseObject?.content ?? productResp?.content;
          const products = Array.isArray(responseObject)
            ? responseObject
            : Array.isArray(pagedProducts) ? pagedProducts : [];
          const categories = this.mapProductsToCategories(products);
          this.categories.set(categories);
          this.loading.set(false);
        },
        error: (error) => {
          console.error('Error cargando productos para catálogo:', error);
          this.loading.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo cargar el catálogo de productos',
            life: 3000
          });
        }
      });
  }

  // Normaliza la URL de imagen para que apunte al backend actual:
  // - URLs relativas (/api/...) o con host localhost/127.0.0.1 se reconstruyen
  //   contra el apiUrl del entorno (corrige https://localhost guardado en BD).
  // - URLs externas (Cloudinary, etc.) y data: se dejan intactas.
  private resolveImageUrlForRendering(url: string | null | undefined): string | null {
    if (!url || typeof url !== 'string' || !url.trim()) return null;
    const value = url.trim();
    if (value.startsWith('data:') || value.startsWith('blob:')) return value;
    if (value.startsWith('http://') || value.startsWith('https://')) {
      try {
        const parsed = new URL(value);
        const host = parsed.hostname.toLowerCase();
        const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost');
        if (isLocalHost) {
          const apiOrigin = new URL(environment.apiUrl).origin;
          return `${apiOrigin}${parsed.pathname}${parsed.search}`;
        }
      } catch {
        return value;
      }
      return value;
    }
    if (value.startsWith('/')) {
      try {
        const apiOrigin = new URL(environment.apiUrl).origin;
        return `${apiOrigin}${value}`;
      } catch {
        return value;
      }
    }
    return value;
  }

  private mapProductsToCategories(products: any[]): MenuCategory[] {
    if (!products || products.length === 0) return [];

    const activeProducts = products.filter((p) => p?.isActive !== false);
    const categoriesMap = new Map<string, MenuCategory>();
    let autoId = 1;

    const ensureCategory = (name: string, id: number | string): MenuCategory => {
      const key = String(id ?? name);
      if (!categoriesMap.has(key)) {
        categoriesMap.set(key, {
          id: typeof id === 'number' ? id : autoId++,
          name: name,
          products: []
        });
      }
      return categoriesMap.get(key)!;
    };

    activeProducts.forEach((product) => {
      const rawImageUrl: string | null = product.imageUrl && typeof product.imageUrl === 'string'
        ? product.imageUrl.trim() || null
        : (product.img_url?.trim() || null) || (product.image?.trim() || null) || null;
      const imageUrl = this.resolveImageUrlForRendering(rawImageUrl);

      const description: string = (product.description && typeof product.description === 'string'
        ? product.description.trim()
        : '') || '';

      const mappedProduct: Product = {
        id: Number(product.id ?? 0),
        name: product.name || product.productName || 'Producto',
        price: Number(product.price ?? 0),
        imageUrl: imageUrl,
        description: description,
        recipes: Array.isArray(product.recipes) ? product.recipes as IngredientOption[] : [],
        additionals: Array.isArray(product.additionals) ? product.additionals as IngredientOption[] : []
      };

      // Multicategoría: el producto aparece en TODAS sus categorías (principal + extras).
      const productCategories = (Array.isArray(product.categories) && product.categories.length > 0)
        ? product.categories
        : null;

      if (productCategories) {
        productCategories.forEach((cat: any) => {
          const name = cat?.name || product.categoryName || 'Sin Categoría';
          const id = cat?.id ?? product.categoryId ?? name;
          ensureCategory(name, id).products.push(mappedProduct);
        });
      } else {
        const categoryName = product.categoryName || product.category?.name || product.category || 'Sin Categoría';
        const categoryId = product.categoryId || product.category?.id || categoryName;
        ensureCategory(categoryName, categoryId).products.push(mappedProduct);
      }
    });

    return Array.from(categoriesMap.values());
  }

  // ==================== CLIENTES (existente) ====================

  private loadClientes(): void {
    this.clienteService
      .getClientes({ tenantId: this.tenantId, page: 0, pageSize: 1000 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => { this.clientes.set(response.content); },
        error: (error) => { console.error('Error cargando clientes:', error); }
      });
  }

  filterClientes(event: any): void {
    const query = event.query.toLowerCase();
    this.filteredClientes = this.clientes().filter((cliente) =>
      cliente.nombreCompleto.toLowerCase().includes(query) ||
      cliente.email.toLowerCase().includes(query)
    );
  }

  openDialogNuevoCliente(): void {
    this.submittedCliente = false;
    this.initializeClienteForm();
    this.mostrarDialogoNuevoCliente = true;
  }

  private initializeClienteForm(): void {
    this.formNuevoCliente = this.fb.group({
      nombreCompleto: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      telefono: [''],
      fechaNacimiento: ['', [Validators.required]],
      genero: ['', [Validators.required]],
      alergias: ['']
    });
  }

  async guardarNuevoCliente(): Promise<void> {
    this.submittedCliente = true;

    if (this.formNuevoCliente.invalid) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Formulario inválido',
        detail: 'Por favor completa todos los campos requeridos',
        life: 3000
      });
      return;
    }

    try {
      const clienteData: CreateClienteRequest = {
        nombreCompleto: this.formNuevoCliente.value.nombreCompleto,
        email: this.formNuevoCliente.value.email,
        telefono: this.formNuevoCliente.value.telefono || undefined,
        fechaNacimiento: this.formNuevoCliente.value.fechaNacimiento,
        genero: this.formNuevoCliente.value.genero,
        alergias: this.formNuevoCliente.value.alergias || ''
      };

      const response = await firstValueFrom(
        this.clienteService.createCliente(this.tenantId, clienteData)
      );

      this.loadClientes();
      this.selectedCliente = response;
      this.mostrarDialogoNuevoCliente = false;

      this.messageService.add({
        severity: 'success',
        summary: 'Cliente creado',
        detail: `Cliente ${response.nombreCompleto} creado exitosamente`,
        life: 3000
      });
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: error.message || 'Error al crear el cliente',
        life: 3000
      });
    }
  }

  hideDialogoNuevoCliente(): void {
    this.mostrarDialogoNuevoCliente = false;
    this.submittedCliente = false;
    this.initializeClienteForm();
  }

  onClienteCreated(cliente: Cliente): void {
    this.loadClientes();
    this.selectedCliente = cliente;
    this.messageService.add({
      severity: 'success',
      summary: 'Cliente creado',
      detail: `Cliente ${cliente.nombreCompleto} creado exitosamente`,
      life: 3000
    });
  }

  // ==================== CARRITO (existente) ====================

  addToCart(product: Product): void {
    if (!product) return;

    const modificables = (product.recipes || []).filter((r) => r.modificable);
    const adicionales = product.additionals || [];

    // Si el producto tiene opciones configurables, abrir el panel antes de agregar
    if (modificables.length > 0 || adicionales.length > 0) {
      this.openIngredientConfig(product, modificables, adicionales);
      return;
    }

    this.addToCartWithAllergyCheck(product, [], [], 0);
  }

  /************************************************************************
   *  VERIFICACIÓN DE ALERGIAS
   *  Si el cliente seleccionado tiene alergias registradas, se consulta al
   *  backend si el platillo contiene insumos que coincidan. De ser así, se
   *  muestra un aviso antes de guardar el platillo en la comanda.
   ************************************************************************/
  private addToCartWithAllergyCheck(product: Product, excludedIds: number[], additionalIds: number[], extraPrice: number): void {
    if (!this.selectedCliente || !this.selectedCliente.id) {
      this.appendToCart(product, excludedIds, additionalIds, extraPrice);
      return;
    }
    const alergias = this.selectedCliente.alergias;
    if (!alergias || alergias.length === 0) {
      this.appendToCart(product, excludedIds, additionalIds, extraPrice);
      return;
    }

    this.clienteService.checkClienteAllergens(this.selectedCliente.id, product.id, excludedIds, additionalIds).subscribe({
      next: (matches) => {
        if (!matches || matches.length === 0) {
          this.appendToCart(product, excludedIds, additionalIds, extraPrice);
          return;
        }
        this.allergyPending = { product, excludedIds, additionalIds, extraPrice };
        this.allergyCheckNames = matches.map((m) => m.insumoName).filter(Boolean);
        this.allergyCheckProductName = product.name;
        this.allergyCheckClienteName = this.selectedCliente?.nombreCompleto ?? '';
        this.allergyDialogVisible = true;
        this.cdr.detectChanges();
      },
      error: () => {
        // Si la verificación falla, no bloquear la venta
        this.appendToCart(product, excludedIds, additionalIds, extraPrice);
      }
    });
  }

  confirmAddWithAllergy(): void {
    const pending = this.allergyPending;
    this.allergyDialogVisible = false;
    this.allergyPending = null;
    if (pending) {
      this.appendToCart(pending.product, pending.excludedIds, pending.additionalIds, pending.extraPrice);
    }
    this.cdr.detectChanges();
  }

  cancelAddWithAllergy(): void {
    this.allergyDialogVisible = false;
    this.allergyPending = null;
    this.cdr.detectChanges();
  }

  hasClientAllergies(cliente: Cliente | null): boolean {
    return !!cliente?.alergias && Array.isArray(cliente.alergias) && cliente.alergias.length > 0;
  }

  allergensText(cliente: Cliente | null): string {
    return (cliente?.alergias ?? []).join(', ');
  }

  // ==================== PANEL DE INGREDIENTES (modificables / adicionales) ====================

  private openIngredientConfig(product: Product, modificables: IngredientOption[], adicionales: IngredientOption[]): void {
    // Limpiar cualquier estado previo antes de abrir (evita que el panel se quede "pegado")
    this.configProduct = product;
    this.configModificables = modificables;
    this.configAdicionales = adicionales;
    // Los modificables vienen incluidos por defecto; el cliente desmarca lo que no quiere
    this.configExcludedIds = new Set();
    this.configAdditionalIds = new Set();
    this.configEditingItem = null;
    this.ingredientConfigVisible = true;
    this.cdr.detectChanges();
  }

  editCartItem(item: CartItem): void {
    const product = item.product;
    const modificables = (product.recipes || []).filter((r) => r.modificable);
    const adicionales = product.additionals || [];

    if (modificables.length === 0 && adicionales.length === 0) return;

    this.configProduct = product;
    this.configModificables = modificables;
    this.configAdicionales = adicionales;
    this.configExcludedIds = new Set(item.excludedIngredientIds || []);
    this.configAdditionalIds = new Set(item.additionalIngredientIds || []);
    this.configEditingItem = item;
    this.ingredientConfigVisible = true;
    this.cdr.detectChanges();
  }

  isExcluded(insumoId: number): boolean {
    return this.configExcludedIds.has(insumoId);
  }

  toggleExcluded(insumoId: number, checked: boolean): void {
    if (checked) {
      this.configExcludedIds.delete(insumoId);
    } else {
      this.configExcludedIds.add(insumoId);
    }
  }

  isAdditional(insumoId: number): boolean {
    return this.configAdditionalIds.has(insumoId);
  }

  toggleAdditional(insumoId: number, checked: boolean): void {
    if (checked) {
      this.configAdditionalIds.add(insumoId);
    } else {
      this.configAdditionalIds.delete(insumoId);
    }
  }

  getConfigExtraPrice(): number {
    if (!this.configProduct) return 0;
    return this.configAdicionales
      .filter((a) => this.configAdditionalIds.has(a.insumoId))
      .reduce((sum, a) => sum + (Number(a.precio) || 0), 0);
  }

  getConfigUnitPrice(): number {
    const base = this.configProduct ? Number(this.configProduct.price) || 0 : 0;
    return base + this.getConfigExtraPrice();
  }

  getCartExcludedNames(item: CartItem): string {
    if (!item.excludedIngredientIds?.length) return '';
    return item.excludedIngredientIds
      .map((id) => (item.product.recipes || []).find((r) => r.insumoId === id)?.insumoName || '')
      .filter(Boolean)
      .join(', ');
  }

  getCartAdditionalNames(item: CartItem): string {
    if (!item.additionalIngredientIds?.length) return '';
    return item.additionalIngredientIds
      .map((id) => (item.product.additionals || []).find((a) => a.insumoId === id)?.insumoName || '')
      .filter(Boolean)
      .join(', ');
  }

  confirmIngredientConfig(): void {
    if (!this.configProduct) return;
    const product = this.configProduct;

    const excludedIds: number[] = Array.from(this.configExcludedIds);
    const additionalIds: number[] = Array.from(this.configAdditionalIds);
    const extraPrice = this.getConfigExtraPrice();

const editingItem = this.configEditingItem;

    this.ingredientConfigVisible = false;
    this.cdr.detectChanges();
    try {
      if (editingItem) {
        this.updateCartItemConfig(editingItem, excludedIds, additionalIds, extraPrice);
      } else {
        this.addToCartWithAllergyCheck(product, excludedIds, additionalIds, extraPrice);
      }
    } catch (error: any) {
      console.error('[Comandix] Error al guardar configuración de ingrediente:', error);
    } finally {
      this.resetIngredientConfig();
      this.ingredientConfigVisible = false;
      this.cdr.detectChanges();
    }
  }

  cancelIngredientConfig(): void {
    this.ingredientConfigVisible = false;
    this.resetIngredientConfig();
  }

  private resetIngredientConfig(): void {
    this.configProduct = null;
    this.configModificables = [];
    this.configAdicionales = [];
    this.configExcludedIds = new Set();
    this.configAdditionalIds = new Set();
    this.configEditingItem = null;
  }

  private updateCartItemConfig(item: CartItem, excludedIds: number[], additionalIds: number[], extraPrice: number): void {
    const product = item.product;
    const unitPrice = (Number(product.price) || 0) + extraPrice;
    const configKey = JSON.stringify([[...excludedIds].sort((a, b) => a - b), [...additionalIds].sort((a, b) => a - b)]);

    this.cart.update((items) =>
      items.map((i) =>
        i === item
          ? { ...i, excludedIngredientIds: excludedIds, additionalIngredientIds: additionalIds, precioUnitario: unitPrice, configKey }
          : i
      )
    );

    this.persistCartDraft();

    this.messageService.add({
      severity: 'success',
      summary: 'Producto actualizado',
      detail: `${product.name} actualizado ($${unitPrice.toFixed(2)})`,
      life: 2500
    });

    this.cdr.detectChanges();
  }

  private appendToCart(product: Product, excludedIds: number[], additionalIds: number[], extraPrice: number): void {
    const unitPrice = (Number(product.price) || 0) + extraPrice;
    const configKey = JSON.stringify([[...excludedIds].sort((a, b) => a - b), [...additionalIds].sort((a, b) => a - b)]);
    const currentSeat = this.asientoActivo();
    const seatId = currentSeat.id;
    const seatAlias = currentSeat.alias;

    const existingItem = this.cart().find(
      (item) => item.product.id === product.id && item.configKey === configKey && item.asientoId === seatId
    );

    if (existingItem) {
      this.cart.update((items) =>
        items.map((item) =>
          item.product.id === product.id && item.configKey === configKey && item.asientoId === seatId
            ? { ...item, cantidad: item.cantidad + 1, precioUnitario: unitPrice }
            : item
        )
      );
    } else {
      this.cart.update((items) => [
        ...items,
        {
          product,
          cantidad: 1,
          comentarios: '',
          precioUnitario: unitPrice,
          excludedIngredientIds: excludedIds,
          additionalIngredientIds: additionalIds,
          configKey,
          asientoId: seatId,
          asientoAlias: seatAlias
        }
      ]);
    }

    this.persistCartDraft();

    this.messageService.add({
      severity: 'success',
      summary: 'Producto añadido',
      detail: additionalIds.length > 0
        ? `${product.name} añadido a ${seatAlias} ($${unitPrice.toFixed(2)}, incluye adicionales)`
        : `${product.name} añadido a ${seatAlias} ($${unitPrice.toFixed(2)})`,
      life: 2500
    });

    console.log('[Comandix] Producto agregado, items en carrito:', this.cart().length, { product: product.name, asiento: seatAlias });
    this.cdr.detectChanges();
  }

  updateQuantity(item: CartItem, newQuantity: number): void {
    if (newQuantity <= 0) {
      this.removeFromCart(item);
      return;
    }
    this.cart.update((items) =>
      items.map((i) =>
        this.cartItemKey(i) === this.cartItemKey(item) ? { ...i, cantidad: newQuantity } : i
      )
    );
    this.persistCartDraft();
    this.cdr.detectChanges();
  }

  removeFromCart(item: CartItem): void {
    this.cart.update((items) =>
      items.filter((i) => this.cartItemKey(i) !== this.cartItemKey(item))
    );
    this.persistCartDraft();
    this.cdr.detectChanges();
    this.messageService.add({
      severity: 'info',
      summary: 'Producto eliminado',
      detail: `${item.product.name} eliminado de la comanda`,
      life: 2000
    });
  }

  private cartItemKey(item: CartItem): string {
    return `${item.product.id}::${item.configKey || ''}::${item.asientoId || 'seat-1'}`;
  }

  getCartItemUnitPrice(item: CartItem): number {
    return Number(item.precioUnitario ?? item.product.price ?? 0);
  }

trackByProductId = (index: number, item: CartItem): string => {
    return this.cartItemKey(item);
  };

  trackByOrderId(index: number, order: PendingOrder): string {
    return order.id;
  }

  onImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    if (!imgElement) return;
    imgElement.style.display = 'none';
    const placeholder = imgElement.nextElementSibling as HTMLElement;
    if (placeholder) placeholder.style.display = 'flex';
  }

  // ==================== STOCK DEL CATÁLOGO (badge en tarjeta) ====================
  getProductStockInfo(product: Product): StockInfo | null {
    if (!product) return null;
    return this.stockMap.get(Number(product.id)) ?? null;
  }

  getProductStockText(product: Product): string {
    const info = this.getProductStockInfo(product);
    if (!info) return '';
    if (info.stock <= 0) return 'Agotado';
    return `Stock: ${Math.round(info.stock)}`;
  }

  isProductLowStock(product: Product): boolean {
    const info = this.getProductStockInfo(product);
    if (!info) return false;
    if (info.stock <= 0 || info.low === true || info.out === true) return true;
    if (info.stockMinimo && info.stockMinimo > 0 && info.stock <= info.stockMinimo) return true;
    return false;
  }

  /** True si el stock del producto del catálogo es crítico (quedan 3 o menos piezas). */
  isProductCriticalStock(product: Product): boolean {
    return this.isCriticalStock({ productId: product?.id } as any);
  }

  onCategoryFilterChange(categoryId: number | null | undefined): void {
    this.selectedCategoryId.set(Number(categoryId) || 0);
  }

  async validarCupon(): Promise<void> {
    if (!this.codigoCupon.trim()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Código requerido',
        detail: 'Por favor ingresa un código de cupón',
        life: 3000
      });
      return;
    }

    this.validatingCoupon.set(true);
    try {
      const validationResponse = await firstValueFrom(
        this.redemptionService.validateCouponByCode(this.codigoCupon, this.tenantId)
      );

      if (validationResponse.valid) {
        const descuento = this.calcularDescuento(
          validationResponse.rewardType || '',
          validationResponse.numericValue || 0,
          this.subtotal()
        );
        this.descuentoAplicado.set(descuento);
        this.messageService.add({
          severity: 'success',
          summary: 'Cupón aplicado',
          detail: `Descuento de $${descuento.toFixed(2)} aplicado`,
          life: 3000
        });
      } else {
        this.messageService.add({
          severity: 'error',
          summary: 'Cupón inválido',
          detail: validationResponse.message || 'El cupón no es válido',
          life: 3000
        });
      }
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: error.message || 'Error al validar el cupón',
        life: 3000
      });
    } finally {
      this.validatingCoupon.set(false);
    }
  }

  private calcularDescuento(rewardType: string, numericValue: number, subtotal: number): number {
    switch (rewardType) {
      case 'PERCENT_DISCOUNT': return (subtotal * numericValue) / 100;
      case 'FIXED_AMOUNT':     return Math.min(numericValue, subtotal);
      default:                 return 0;
    }
  }

  async finalizarVenta(): Promise<void> {
    if (this.cart().length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Carrito vacío',
        detail: 'Añade productos antes de finalizar la venta',
        life: 3000
      });
      return;
    }

    const hasInvalidItem = this.cart().some((item) => item.product.id <= 0 || item.cantidad <= 0 || this.getCartItemUnitPrice(item) < 0);
    if (hasInvalidItem) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Productos inválidos',
        detail: 'Revisa los productos cargados en la comanda antes de continuar',
        life: 3000
      });
      return;
    }

    this.processingOrder.set(true);
    try {
      const orderItems: OrderItem[] = this.cart().map((item) => ({
        productId: item.product.id,
        cantidad: item.cantidad,
        precioUnitario: this.getCartItemUnitPrice(item),
        comentarios: item.asientoAlias ? `[${item.asientoAlias}] ${item.comentarios || ''}`.trim() : (item.comentarios || undefined),
        asientoId: item.asientoId,
        asientoAlias: item.asientoAlias,
        excludedIngredientIds: item.excludedIngredientIds?.length ? item.excludedIngredientIds : undefined,
        additionalIngredientIds: item.additionalIngredientIds?.length ? item.additionalIngredientIds : undefined
      }));

      const editingOrder = this.editingPendingOrder();
      if (editingOrder) {
        if (!this.canEditOrder(editingOrder)) {
          this.messageService.add({
            severity: 'error',
            summary: 'Prórroga vencida',
            detail: 'La comanda se envió hace más de 3 minutos y ya no puede editarse',
            life: 3000
          });
          this.processingOrder.set(false);
          return;
        }

        const updateRequest: TenantClientOrderUpdateRequest = {
          customerId: this.selectedCliente?.id ?? editingOrder.customerId ?? null,
          tenantId: editingOrder.tenantId,
          items: orderItems,
          subtotal: this.subtotal(),
          descuento: this.descuentoAplicado(),
          totalFinal: this.totalFinal(),
          couponCode: this.codigoCupon.trim() || null
        };

        await firstValueFrom(this.orderService.updateOrder(editingOrder.id, updateRequest));

        const updatedOrder: PendingOrder = {
          ...editingOrder,
          customerId: this.selectedCliente?.id ?? editingOrder.customerId ?? null,
          customerName: this.selectedCliente?.nombreCompleto ?? editingOrder.customerName ?? editingOrder.nombre ?? null,
          nombre: this.selectedCliente?.nombreCompleto ?? editingOrder.nombre ?? editingOrder.customerName ?? null,
          mesaNombre: this.selectedMesa()?.nombre ?? editingOrder.mesaNombre ?? 'Mesa General',
          mesaNumero: this.selectedMesa()?.numero ?? editingOrder.mesaNumero,
          items: this.cart().map((item) => ({
            productId: item.product.id,
            productName: item.product.name,
            cantidad: item.cantidad,
            precioUnitario: this.getCartItemUnitPrice(item),
            comentarios: item.comentarios || undefined,
            asientoId: item.asientoId,
            asientoAlias: item.asientoAlias,
            excludedIngredientIds: item.excludedIngredientIds?.length ? item.excludedIngredientIds : undefined,
            additionalIngredientIds: item.additionalIngredientIds?.length ? item.additionalIngredientIds : undefined
          })),
          subtotal: this.subtotal(),
          descuento: this.descuentoAplicado(),
          totalFinal: this.totalFinal(),
          couponCode: this.codigoCupon.trim() || null
        };

        this.pendingOrders.update((orders) => orders.map((order) => order.id === editingOrder.id ? updatedOrder : order));
        this.messageService.add({
          severity: 'success',
          summary: 'Orden actualizada',
          detail: `Orden #${editingOrder.id.slice(0, 8)} actualizada exitosamente`,
          life: 4000
        });

        this.resetForm();
        this.switchView('orders');
        return;
      }

      const orderRequest: TenantClientOrderCreateRequest = {
        customerId: this.selectedCliente?.id ?? null,
        tenantId: this.tenantId,
        items: orderItems,
        subtotal: this.subtotal(),
        descuento: this.descuentoAplicado(),
        totalFinal: this.totalFinal(),
        couponCode: this.codigoCupon.trim() || null,
        redeemedBy: this.selectedCliente?.id ?? null,
        redemptionChannel: 'COMANDIX',
        source: 'POS'
      };

      const response = await firstValueFrom(this.orderService.createOrder(orderRequest));

      const createdOrder: PendingOrder = {
        id: String(response.id),
        tenantId: this.tenantId,
        estado: this.normalizeOrderStatus(response.estado),
        customerId: orderRequest.customerId ?? null,
        customerName: this.selectedCliente?.nombreCompleto ?? null,
        nombre: this.selectedCliente?.nombreCompleto ?? null,
        mesaId: this.selectedMesa()?.id,
        mesaNombre: this.selectedMesa()?.nombre ?? 'Mesa General',
        mesaNumero: this.selectedMesa()?.numero,
        meseroNombre: this.authService.getCurrentUser()?.nombre ?? this.authService.getCurrentUser()?.userName ?? this.authService.getCurrentUser()?.email ?? 'Mesero en Turno',
        horaApertura: new Date().toISOString(),
        items: this.cart().map((item) => ({
          productId: item.product.id,
          productName: item.product.name,
          cantidad: item.cantidad,
          precioUnitario: this.getCartItemUnitPrice(item),
          comentarios: item.comentarios || undefined,
          asientoId: item.asientoId,
          asientoAlias: item.asientoAlias,
          excludedIngredientIds: item.excludedIngredientIds?.length ? item.excludedIngredientIds : undefined,
          additionalIngredientIds: item.additionalIngredientIds?.length ? item.additionalIngredientIds : undefined
        })),
        subtotal: orderRequest.subtotal,
        descuento: orderRequest.descuento,
        totalFinal: orderRequest.totalFinal,
        couponCode: orderRequest.couponCode,
        fechaCreacion: response.fechaCreacion || new Date().toISOString()
      };

      this.knownOrderIds.add(createdOrder.id);
      this.pendingOrders.update((orders) => [
        createdOrder,
        ...orders.filter((order) => order.id !== createdOrder.id)
      ]);

      this.messageService.add({
        severity: 'success',
        summary: '¡Venta registrada!',
        detail: `Orden #${response.id} creada exitosamente`,
        life: 4000
      });

      this.resetForm();
      this.switchView('orders');
      void this.pollOrders();
    } catch (error: any) {
      const detail = error?.error?.message || error?.error?.error || error?.message || 'Error al registrar la venta';
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail,
        life: 4000
      });
    } finally {
      this.processingOrder.set(false);
    }
  }

  private resetForm(): void {
    this.cart.set([]);
    this.clearCartDraft();
    this.selectedCliente = null;
    this.codigoCupon = '';
    this.descuentoAplicado.set(0);
    this.editingPendingOrder.set(null);
  }

  limpiarCarrito(): void {
    this.cart.set([]);
    this.clearCartDraft();
    this.descuentoAplicado.set(0);
    this.codigoCupon = '';
    this.asientos.set([{ id: 'seat-1', numero: 1, alias: 'Persona 1', estado: 'ACTIVO' }]);
    this.asientoActivoId.set('seat-1');
  }

  private restoreCartDraft(): void {
    try {
      const draft = localStorage.getItem(this.CART_DRAFT_STORAGE_KEY);
      if (draft) {
        this.cart.set(JSON.parse(draft) as CartItem[]);
      }
    } catch (error) {
      console.warn('[Comandix] No se pudo restaurar el carrito:', error);
      this.clearCartDraft();
    }
  }

  private persistCartDraft(): void {
    try {
      localStorage.setItem(this.CART_DRAFT_STORAGE_KEY, JSON.stringify(this.cart()));
    } catch (error) {
      console.warn('[Comandix] No se pudo guardar el carrito:', error);
    }
  }

  private clearCartDraft(): void {
    try {
      localStorage.removeItem(this.CART_DRAFT_STORAGE_KEY);
    } catch (error) {
      console.warn('[Comandix] No se pudo limpiar el carrito guardado:', error);
    }
  }

  private resolveClienteFromOrder(order: PendingOrder): Cliente | null {
    if (order.customerId) {
      const customerById = this.clientes().find((cliente) => cliente.id === order.customerId);
      if (customerById) {
        return customerById;
      }
    }

    const customerName = (order.customerName ?? order.nombre ?? '').trim().toLowerCase();
    if (!customerName) {
      return null;
    }

    return this.clientes().find((cliente) => cliente.nombreCompleto.trim().toLowerCase() === customerName) ?? null;
  }

  private buildCartFromPendingOrder(order: PendingOrder): CartItem[] {
    return (order.items ?? [])
      .map((item, index) => this.mapPendingOrderItemToCartItem(item, index))
      .filter((item): item is CartItem => item !== null);
  }

  private mapPendingOrderItemToCartItem(item: PendingOrderItem, index: number): CartItem | null {
    const productId = Number(item.productId ?? 0);
    if (productId <= 0) {
      return null;
    }

    const catalogProduct = this.findProductInCatalog(productId);
    const precioUnitario = Number(item.precioUnitario ?? item.precio ?? catalogProduct?.price ?? 0);

    const excludedIngredientIds = Array.isArray(item.excludedIngredientIds) ? item.excludedIngredientIds.map(Number).filter((n) => !Number.isNaN(n)) : [];
    const additionalIngredientIds = Array.isArray(item.additionalIngredientIds) ? item.additionalIngredientIds.map(Number).filter((n) => !Number.isNaN(n)) : [];
    const configKey = JSON.stringify([[...excludedIngredientIds].sort((a, b) => a - b), [...additionalIngredientIds].sort((a, b) => a - b)]);

    return {
      product: catalogProduct ?? {
        id: productId,
        name: item.productName ?? item.prod ?? `Producto #${index + 1}`,
        price: precioUnitario,
        imageUrl: null,
        description: ''
      },
      cantidad: Number(item.cantidad ?? 1),
      comentarios: item.comentarios ?? '',
      precioUnitario,
      excludedIngredientIds,
      additionalIngredientIds,
      configKey
    };
  }

  private findProductInCatalog(productId: number): Product | undefined {
    return this.categories()
      .flatMap((category) => category.products ?? [])
      .find((product) => product.id === productId);
  }
}
