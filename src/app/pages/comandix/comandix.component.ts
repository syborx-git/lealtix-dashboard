import { Component, OnInit, OnDestroy, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subject, firstValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// PrimeNG
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
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

// Servicios
import { MenuService } from './services/menu.service';
import { OrderService } from './services/order.service';
import { OrderSseService, SseNewOrderEvent } from './services/order-sse.service';
import { ClienteService } from '@/pages/clientes/services/cliente.service';
import { RedemptionService } from '@/pages/redeem/services/redemption.service';
import { TenantService } from '@/pages/admin-page/service/tenant.service';
import { AuthService } from '@/auth/auth.service';
import { ProductService } from '@/pages/products-menu/service/product.service';

// Componentes
import { ClienteDialogComponent } from '@/pages/clientes/components/cliente-dialog/cliente-dialog.component';
import { CloseOrderModalComponent } from './components/close-order-modal/close-order-modal.component';

// Modelos
import { MenuCategory, Product } from './models/menu.model';
import {
  OrderItem,
  TenantClientOrderCreateRequest,
  TenantClientOrderUpdateRequest,
  PendingOrder,
  PendingOrderItem,
  OrderStatus,
  PaymentMethod
} from './models/order.model';
import { Cliente, GENERO_OPTIONS, CreateClienteRequest } from '@/models/cliente.model';
import { RedemptionRequest, RedemptionChannel } from '@/pages/redeem/models/redemption-request.model';

interface CartItem {
  product: Product;
  cantidad: number;
  comentarios: string;
  precioUnitario?: number;
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
    TabsModule,
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
    ClienteDialogComponent,
    CloseOrderModalComponent
  ],
  providers: [MessageService],
  templateUrl: './comandix.component.html',
  styleUrls: ['./comandix.component.scss']
})
export class ComandixComponent implements OnInit, OnDestroy {
  // ==================== SIGNALS POS (existente) ====================
  categories = signal<MenuCategory[]>([]);
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

  // Computed POS
  subtotal = computed(() => {
    return this.cart().reduce((sum, item) => sum + (this.getCartItemUnitPrice(item) * item.cantidad), 0);
  });

  totalFinal = computed(() => {
    return Math.max(0, this.subtotal() - this.descuentoAplicado());
  });

  // ==================== SIGNALS DASHBOARD DE ÓRDENES (nuevo) ====================
  activeView = signal<'pos' | 'orders'>('pos');
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

  canCloseOrders = false;
  currentUserEmail: string = '';

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

  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private knownOrderIds = new Set<string>();
  private readonly POLLING_INTERVAL_MS = 30_000;
  private readonly NOTIFICATION_SOUND = 'assets/sounds/dragon-studio-correct-472358.mp3';
  private readonly ACTIVE_DASHBOARD_STATUSES: OrderStatus[] = ['PENDIENTE', 'CONFIRMADA', 'EN_PREPARACION', 'LISTO', 'PAGADA'];

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
    private messageService: MessageService,
    private fb: FormBuilder
  ) {
    this.initializeClienteForm();
  }

  async ngOnInit(): Promise<void> {
    await this.initializeTenant();
    if (this.tenantId > 0) {
      this.loadCatalog();
      this.loadClientes();
      this.startPolling();
      this.startSseConnection();
      this.subscribeToSseEvents();

      // Debug: Monitorear órdenes cerradas
      effect(() => {
        const closed = this.closedOrders();
        const allPaidOrders = this.pendingOrders().filter(
          (o) => this.normalizeOrderStatus(o.estado) === 'PAGADA'
        );
        console.log('[Comandix] 📊 Debug Órdenes Cerradas:', {
          totalPagadas: allPaidOrders.length,
          mostradas: closed.length,
          currentUserEmail: this.currentUserEmail,
          hoy: new Date().toLocaleDateString('es-ES'),
          detalles: closed.map((o) => ({
            id: o.id.slice(0, 8),
            paidAt: o.payment?.paidAt,
            paidBy: o.payment?.paidBy
          }))
        });
      });
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
    // NO desconectar el SSE aquí: la conexión es global (AppLayout la mantiene
    // viva en todos los módulos). Desconectarla al salir de esta página cortaría
    // las notificaciones en el resto del dashboard.
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== VISTA ACTIVA ====================

  switchView(view: 'pos' | 'orders'): void {
    this.activeView.set(view);
    if (view === 'orders') {
      this.ordersView.set('active');
    }
  }

  switchOrdersView(view: 'active' | 'closed' | 'cancelled'): void {
    this.activeView.set('orders');
    this.ordersView.set(view);
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
  }

  private mapBackendOrder(order: any): PendingOrder {
    return {
      id: order.id,
      tenantId: order.tenantId,
      estado: this.normalizeOrderStatus(order.estado),
      customerId: order.customerId ?? null,
      customerName: order.customerName ?? null,
      nombre: order.customerName ?? null,
      items: order.items ?? [],
      subtotal: order.subtotal ?? 0,
      descuento: order.descuento ?? 0,
      totalFinal: order.total ?? order.totalFinal ?? 0,
      couponCode: order.couponCode ?? null,
      coupon_id: order.couponId ?? null,
      fechaCreacion: order.fecha ?? order.createdAt,
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

    this.closeCloseOrderModal();

    this.messageService.add({
      severity: 'success',
      summary: 'Pago registrado',
      detail: `La orden #${event.orderId.slice(0, 8)} quedó en estado PAGADA`,
      life: 4000
    });
  }

  editPendingOrderInPos(order: PendingOrder): void {
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

  // ==================== CATÁLOGO (existente) ====================

  private loadCatalog(): void {
    this.loading.set(true);
    this.loadCatalogFromProducts();
  }

  private loadCatalogFromProducts(): void {
    this.productService
      .getProductsByTenantId(this.tenantId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (productResp) => {
          const products = productResp?.object || [];
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

  private mapProductsToCategories(products: any[]): MenuCategory[] {
    if (!products || products.length === 0) return [];

    const activeProducts = products.filter((p) => p?.isActive !== false);
    const categoriesMap = new Map<string, MenuCategory>();
    let autoId = 1;

    activeProducts.forEach((product) => {
      const categoryName = product.categoryName || product.category?.name || product.category || 'Sin Categoría';
      const categoryId = product.categoryId || product.category?.id || categoryName;
      const categoryKey = String(categoryId ?? categoryName);

      if (!categoriesMap.has(categoryKey)) {
        categoriesMap.set(categoryKey, {
          id: typeof categoryId === 'number' ? categoryId : autoId++,
          name: categoryName,
          products: []
        });
      }

      const imageUrl: string | null = product.imageUrl && typeof product.imageUrl === 'string'
        ? product.imageUrl.trim() || null
        : (product.img_url?.trim() || null) || (product.image?.trim() || null) || null;

      const description: string = (product.description && typeof product.description === 'string'
        ? product.description.trim()
        : '') || '';

      const mappedProduct: Product = {
        id: Number(product.id ?? 0),
        name: product.name || product.productName || 'Producto',
        price: Number(product.price ?? 0),
        imageUrl: imageUrl,
        description: description
      };

      categoriesMap.get(categoryKey)!.products.push(mappedProduct);
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
      genero: ['', [Validators.required]]
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
        genero: this.formNuevoCliente.value.genero
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
    const existingItem = this.cart().find((item) => item.product.id === product.id);

    if (existingItem) {
      this.updateQuantity(existingItem, existingItem.cantidad + 1);
    } else {
      this.cart.update((items) => [
        ...items,
        { product, cantidad: 1, comentarios: '' }
      ]);
    }

    this.messageService.add({
      severity: 'success',
      summary: 'Producto añadido',
      detail: `${product.name} añadido a la comanda`,
      life: 2000
    });
  }

  updateQuantity(item: CartItem, newQuantity: number): void {
    if (newQuantity <= 0) {
      this.removeFromCart(item);
      return;
    }
    this.cart.update((items) =>
      items.map((i) =>
        i.product.id === item.product.id ? { ...i, cantidad: newQuantity } : i
      )
    );
  }

  removeFromCart(item: CartItem): void {
    this.cart.update((items) =>
      items.filter((i) => i.product.id !== item.product.id)
    );
    this.messageService.add({
      severity: 'info',
      summary: 'Producto eliminado',
      detail: `${item.product.name} eliminado de la comanda`,
      life: 2000
    });
  }

  getCartItemUnitPrice(item: CartItem): number {
    return Number(item.precioUnitario ?? item.product.price ?? 0);
  }

  trackByProductId(index: number, item: CartItem): number {
    return item.product.id;
  }

  trackByOrderId(index: number, order: PendingOrder): string {
    return order.id;
  }

  onImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    if (imgElement) {
      imgElement.style.display = 'none';
      const placeholder = imgElement.nextElementSibling as HTMLElement;
      if (placeholder) placeholder.style.display = 'flex';
    }
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

    debugger;
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
        comentarios: item.comentarios || undefined
      }));

      const editingOrder = this.editingPendingOrder();
      debugger;
      if (editingOrder) {
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
          items: this.cart().map((item) => ({
            productId: item.product.id,
            productName: item.product.name,
            cantidad: item.cantidad,
            precioUnitario: this.getCartItemUnitPrice(item),
            comentarios: item.comentarios || undefined
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
        redemptionChannel: 'COMANDIX'
      };

      const response = await firstValueFrom(this.orderService.createOrder(orderRequest));

      this.messageService.add({
        severity: 'success',
        summary: '¡Venta registrada!',
        detail: `Orden #${response.id} creada exitosamente`,
        life: 4000
      });

      this.resetForm();
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: error.message || 'Error al registrar la venta',
        life: 3000
      });
    } finally {
      this.processingOrder.set(false);
    }
  }

  private resetForm(): void {
    this.cart.set([]);
    this.selectedCliente = null;
    this.codigoCupon = '';
    this.descuentoAplicado.set(0);
    this.editingPendingOrder.set(null);
  }

  limpiarCarrito(): void {
    this.cart.set([]);
    this.descuentoAplicado.set(0);
    this.codigoCupon = '';
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
      precioUnitario
    };
  }

  private findProductInCatalog(productId: number): Product | undefined {
    return this.categories()
      .flatMap((category) => category.products ?? [])
      .find((product) => product.id === productId);
  }
}
