import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, firstValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { OrderSseService, SseNewOrderEvent, SseOrderStatusEvent } from '@/pages/comandix/services/order-sse.service';
import { KitchenOrder, KitchenOrderItem, KitchenOrderStatus } from '../models/kitchen-order.model';
import { KitchenNotificationService } from './kitchen-notification.service';
import { KitchenApiService } from './kitchen-api.service';

@Injectable({
    providedIn: 'root'
})
export class KitchenOrderFacadeService implements OnDestroy {
    private readonly ordersSubject = new BehaviorSubject<KitchenOrder[]>([]);
    private readonly loadingSubject = new BehaviorSubject<boolean>(false);
    private readonly connectionSubject = new BehaviorSubject<'connected' | 'disconnected' | 'error'>('disconnected');

    private readonly destroy$ = new Subject<void>();
    private pollingTimer: ReturnType<typeof setInterval> | null = null;
    private tenantId = 0;
    private knownOrderIds = new Set<string>();
    private pollingBusy = false;
    private lastSignature = '';

    readonly orders$ = this.ordersSubject.asObservable();
    readonly loading$ = this.loadingSubject.asObservable();
    readonly connectionStatus$ = this.connectionSubject.asObservable();

    constructor(
        private kitchenApiService: KitchenApiService,
        private orderSseService: OrderSseService,
        private kitchenNotificationService: KitchenNotificationService
    ) {}

    init(tenantId: number): void {
        if (tenantId <= 0) {
            return;
        }

        this.teardown();
        this.tenantId = tenantId;

        this.loadOrders();
        this.startPolling();
        this.startRealtime();
    }

    ngOnDestroy(): void {
        this.teardown();
    }

    teardown(): void {
        if (this.pollingTimer !== null) {
            clearInterval(this.pollingTimer);
            this.pollingTimer = null;
        }
        // NO desconectar el SSE aquí: la conexión es global (AppLayout la mantiene
        // viva en todos los módulos). Desconectarla cortaría las notificaciones.
        this.destroy$.next();
    }

    async startOrder(orderId: string): Promise<void> {
        await firstValueFrom(this.kitchenApiService.updateStatus(orderId, 'start'));
        this.patchLocalStatus(orderId, 'EN_PREPARACION');
    }

    async startOrderFromConfirmed(orderId: string): Promise<void> {
        await firstValueFrom(this.kitchenApiService.updateStatus(orderId, 'start'));
        this.patchLocalStatus(orderId, 'EN_PREPARACION');
    }

    async finishOrder(orderId: string): Promise<void> {
        await firstValueFrom(this.kitchenApiService.updateStatus(orderId, 'finish'));
        const patched = this.ordersSubject.value.map((order) => {
            if (order.id !== orderId) {
                return order;
            }
            return {
                ...order,
                status: 'LISTO' as KitchenOrderStatus,
                items: order.items.map((it) => {
                    if (it.tiempo === 1) {
                        return { ...it, yaSalio: true };
                    }
                    return it;
                })
            };
        });
        this.emitOrders(patched);
    }

    async returnToConfirmedForSegundoTiempo(orderId: string): Promise<void> {
        await firstValueFrom(this.kitchenApiService.updateStatus(orderId, 'return-confirmed'));
        const patched = this.ordersSubject.value.map((order) => {
            if (order.id !== orderId) {
                return order;
            }
            return {
                ...order,
                status: 'CONFIRMADA' as KitchenOrderStatus,
                recorrido: 2,
                items: order.items.map((it) => {
                    if (it.tiempo === 1) {
                        return { ...it, yaSalio: true };
                    }
                    return it;
                })
            };
        });
        this.emitOrders(patched);
    }

    parseOrderTime(createdAt: any): number {
        if (!createdAt) return 0;
        if (typeof createdAt === 'number') return createdAt;
        if (Array.isArray(createdAt)) {
            const [y, m = 1, d = 1, h = 0, min = 0, s = 0] = createdAt;
            return new Date(y, m - 1, d, h, min, s).getTime();
        }
        const t = new Date(createdAt).getTime();
        return Number.isNaN(t) ? 0 : t;
    }

    isToday(createdAt: any): boolean {
        const time = this.parseOrderTime(createdAt);
        if (time === 0) return true;
        const d = new Date(time);
        const now = new Date();
        const sameDay = d.getFullYear() === now.getFullYear() &&
                        d.getMonth() === now.getMonth() &&
                        d.getDate() === now.getDate();
        // Turno operativo de restaurante: cubre el día calendario o las órdenes de las últimas 24 horas
        const diffMs = Math.abs(now.getTime() - time);
        const withinShift = diffMs <= 24 * 60 * 60 * 1000;
        return sameDay || withinShift;
    }

    private startPolling(): void {
        // Refresco de respaldo cada 2s para que la comanda aparezca casi al instante
        this.pollingTimer = setInterval(() => void this.loadOrders(false), 2_000);
    }

    private startRealtime(): void {
        this.orderSseService.connect(this.tenantId);

        this.orderSseService.connectionStatus$
            .pipe(takeUntil(this.destroy$))
            .subscribe((status) => this.connectionSubject.next(status));

        this.orderSseService.newOrder$
            .pipe(takeUntil(this.destroy$))
            .subscribe((event) => this.handleIncomingOrderEvent(event));

        this.orderSseService.orderStatusChanged$
            .pipe(takeUntil(this.destroy$))
            .subscribe((event) => this.handleOrderStatusChangedEvent(event));
    }

    private async loadOrders(showLoader = true): Promise<void> {
        if (this.pollingBusy) {
            return;
        }
        this.pollingBusy = true;
        if (showLoader) {
            this.loadingSubject.next(true);
        }
        try {
            // Consultar órdenes activas e historial del día (PENDIENTE, CONFIRMADA, EN_PREPARACION, LISTO y PAGADA de hoy)
            const [confirmedOrders, pendingOrders, inProgressOrders, readyOrders, paidOrders] = await Promise.all([
                firstValueFrom(this.kitchenApiService.listOrdersByStatus(this.tenantId, 'CONFIRMADA', 0, 100)),
                firstValueFrom(this.kitchenApiService.listOrdersByStatus(this.tenantId, 'PENDIENTE', 0, 100)),
                firstValueFrom(this.kitchenApiService.listOrdersByStatus(this.tenantId, 'EN_PREPARACION', 0, 100)),
                firstValueFrom(this.kitchenApiService.listOrdersByStatus(this.tenantId, 'LISTO', 0, 100)),
                firstValueFrom(this.kitchenApiService.listOrdersByStatus(this.tenantId, 'PAGADA', 0, 100))
            ]);

            // Todas las órdenes LISTO se conservan en cocina (en pase / historial de entrega)
            const todayReady = readyOrders || [];
            // Las órdenes PAGADAS se conservan en el historial si corresponden al turno operativo de hoy
            const todayPaid = (paidOrders || []).filter((o) =>
                this.isToday(o?.paidAt ?? o?.readyAt ?? o?.fecha ?? o?.createdAt)
            );

            const rawOrders = [...confirmedOrders, ...pendingOrders, ...inProgressOrders, ...todayReady, ...todayPaid];
            const seenIds = new Set<string>();
            const allBackendOrders: any[] = [];
            for (const order of rawOrders) {
                const id = String(order?.id ?? '');
                if (id && !seenIds.has(id)) {
                    seenIds.add(id);
                    allBackendOrders.push(order);
                }
            }

            const kitchenOrders = allBackendOrders.map((order) => this.mapBackendOrderToKitchen(order));

            this.knownOrderIds = new Set(kitchenOrders.map((order) => order.id));
            this.emitOrders(kitchenOrders);
        } catch (error) {
            console.error('Error al cargar órdenes de cocina:', error);
            this.emitOrders([]);
        } finally {
            this.pollingBusy = false;
            if (showLoader) {
                this.loadingSubject.next(false);
            }
        }
    }

    /**
     * Emite la lista ordenada cronológicamente de forma ascendente (FIFO):
     * La comanda más antigua arriba y las más nuevas debajo.
     * Mantiene la firma para evitar parpadeos en pantalla.
     */
    private emitOrders(orders: KitchenOrder[]): void {
        const sorted = [...orders].sort((a, b) =>
            this.parseOrderTime(a.createdAt) - this.parseOrderTime(b.createdAt)
        );
        const signature = sorted
            .map((order) => `${order.id}#${order.status}#${order.recorrido ?? 1}#${order.items.map((i) => `${i.productId}x${i.quantity}t${i.tiempo ?? 1}m${i.tiempoMarchado ? 1 : 0}s${i.yaSalio ? 1 : 0}`).join(',')}`)
            .join('|');

        if (signature === this.lastSignature) {
            return;
        }

        this.lastSignature = signature;
        this.ordersSubject.next(sorted);
    }

    private handleIncomingOrderEvent(event: SseNewOrderEvent): void {
        if (event.tenantId !== this.tenantId) {
            return;
        }

        const mappedOrder = this.mapSseOrderToKitchen(event);
        if (this.knownOrderIds.has(mappedOrder.id)) {
            return;
        }

        this.knownOrderIds.add(mappedOrder.id);
        // Agregar la nueva orden: emitOrders la posicionará en orden FIFO debajo de las anteriores
        this.emitOrders([...this.ordersSubject.value, mappedOrder]);
    }

    /**
     * Reacciona en tiempo real a los cambios de estado de una orden.
     * Si la orden se paga hoy, se mantiene en el historial del día de cocina.
     */
    private handleOrderStatusChangedEvent(event: SseOrderStatusEvent): void {
        if (!event?.order || Number(event.tenantId) !== this.tenantId) {
            return;
        }

        const orderId = String(event.order.id);
        const status = this.normalizeStatus(event.order.estado);

        // Órdenes canceladas se retiran
        if (status === 'CANCELADA') {
            if (this.knownOrderIds.has(orderId)) {
                this.removeLocalOrder(orderId);
            }
            return;
        }

        const mappedOrder = this.mapOrderDataToKitchen(event.order);
        if (!mappedOrder.id) {
            return;
        }

        // Si fue pagada hoy, conservarla en el historial diario visible de cocina
        if (status === 'PAGADA') {
            if (this.isToday(mappedOrder.createdAt)) {
                this.knownOrderIds.add(mappedOrder.id);
                const exists = this.ordersSubject.value.some((o) => o.id === mappedOrder.id);
                if (exists) {
                    this.emitOrders(
                        this.ordersSubject.value.map((order) =>
                            order.id === mappedOrder.id ? { ...order, ...mappedOrder, status: 'PAGADA' } : order
                        )
                    );
                } else {
                    this.emitOrders([...this.ordersSubject.value, { ...mappedOrder, status: 'PAGADA' }]);
                }
            } else {
                this.removeLocalOrder(orderId);
            }
            return;
        }

        if (this.knownOrderIds.has(mappedOrder.id)) {
            // Ya existe: actualizar estado/datos
            const previousOrder = this.ordersSubject.value.find((o) => o.id === mappedOrder.id);
            this.emitOrders(
                this.ordersSubject.value.map((order) =>
                    order.id === mappedOrder.id ? { ...order, ...mappedOrder, status } : order
                )
            );
            // Si regresa a CONFIRMADA (ej. el mesero marchó el segundo tiempo), sonar la campana
            if (status === 'CONFIRMADA' && previousOrder?.status !== 'CONFIRMADA') {
                this.kitchenNotificationService.playNewOrderSound(1);
            }
            return;
        }

        // Orden confirmada por el mesero: aparece en cocina respetando FIFO
        this.knownOrderIds.add(mappedOrder.id);
        this.emitOrders([...this.ordersSubject.value, mappedOrder]);
        this.kitchenNotificationService.playNewOrderSound(1);
    }

    private patchLocalStatus(orderId: string, status: KitchenOrderStatus): void {
        const patched = this.ordersSubject.value.map((order) => {
            if (order.id !== orderId) {
                return order;
            }
            return {
                ...order,
                status
            };
        });

        this.emitOrders(patched);
    }

    private removeLocalOrder(orderId: string): void {
        this.knownOrderIds.delete(orderId);
        this.emitOrders(this.ordersSubject.value.filter((order) => order.id !== orderId));
    }

    private mapBackendOrderToKitchen(order: any): KitchenOrder {
        const status = this.normalizeStatus(order?.estado);
        const mesaId = order?.idMesa ?? order?.mesaId ?? (typeof order?.mesa === 'object' ? order?.mesa?.id : (typeof order?.mesa === 'number' ? order.mesa : undefined));
        const mesaNombre = order?.mesaNombre ?? order?.mesa?.nombre ?? (order?.mesaNumero ? `Mesa ${order.mesaNumero}` : undefined);
        const mesaNumero = order?.mesaNumero ?? order?.mesa?.numero;

        const rawItems = order?.items ?? [];
        const items: KitchenOrderItem[] = rawItems.map((item: any) => this.mapItem(item));

        const has3erMarchado = items.some((it: KitchenOrderItem) => it.tiempo === 3 && it.tiempoMarchado);
        const has2doMarchado = items.some((it: KitchenOrderItem) => it.tiempo === 2 && it.tiempoMarchado);
        const recorrido = order?.recorrido ?? (has3erMarchado ? 3 : (has2doMarchado ? 2 : 1));

        // Si ya está en 3er o 2do tiempo marchado, los tiempos anteriores ya salieron
        const refinedItems = items.map((it: KitchenOrderItem) => {
            if (recorrido === 3 && (it.tiempo === 1 || it.tiempo === 2)) {
                return { ...it, yaSalio: true };
            }
            if (recorrido === 2 && it.tiempo === 1) {
                return { ...it, yaSalio: true };
            }
            return it;
        });

        return {
            id: String(order?.id ?? ''),
            tenantId: Number(order?.tenantId ?? this.tenantId),
            status,
            customerId: order?.customerId ?? null,
            customerName: order?.customerName ?? order?.nombre ?? 'Cliente General',
            mesaId,
            mesaNombre,
            mesaNumero,
            source: order?.source,
            createdAt: String(order?.fecha ?? order?.createdAt ?? order?.fechaCreacion ?? new Date().toISOString()),
            items: refinedItems,
            subtotal: Number(order?.subtotal ?? 0),
            discount: Number(order?.descuento ?? 0),
            total: Number(order?.total ?? order?.totalFinal ?? 0),
            recorrido,
            segundoTiempoMarchado: has2doMarchado,
            tercerTiempoMarchado: has3erMarchado
        };
    }

    private mapSseOrderToKitchen(event: SseNewOrderEvent): KitchenOrder {
        return this.mapOrderDataToKitchen(event.order);
    }

    private mapOrderDataToKitchen(order: any): KitchenOrder {
        const rawItems = order?.items ?? [];
        const items: KitchenOrderItem[] = rawItems.map((item: any) => this.mapItem(item));
        const mesaId = order?.idMesa ?? order?.mesaId;
        const mesaNombre = order?.mesaNombre;
        const mesaNumero = order?.mesaNumero;

        const has3erMarchado = items.some((it: KitchenOrderItem) => it.tiempo === 3 && it.tiempoMarchado);
        const has2doMarchado = items.some((it: KitchenOrderItem) => it.tiempo === 2 && it.tiempoMarchado);
        const recorrido = order?.recorrido ?? (has3erMarchado ? 3 : (has2doMarchado ? 2 : 1));

        const refinedItems = items.map((it: KitchenOrderItem) => {
            if (recorrido === 3 && (it.tiempo === 1 || it.tiempo === 2)) {
                return { ...it, yaSalio: true };
            }
            if (recorrido === 2 && it.tiempo === 1) {
                return { ...it, yaSalio: true };
            }
            return it;
        });

        return {
            id: String(order?.id ?? ''),
            tenantId: Number(order?.tenantId ?? this.tenantId),
            status: this.normalizeStatus(order?.estado),
            customerId: order?.customerId ?? null,
            customerName: order?.customerName ?? (order?.customerId != null ? `Cliente #${order.customerId}` : 'Cliente General'),
            mesaId,
            mesaNombre,
            mesaNumero,
            source: order?.source,
            createdAt: order?.fecha ?? order?.createdAt ?? new Date().toISOString(),
            items: refinedItems,
            subtotal: Number(order?.subtotal ?? 0),
            discount: Number(order?.descuento ?? 0),
            total: Number(order?.total ?? 0),
            recorrido,
            segundoTiempoMarchado: has2doMarchado,
            tercerTiempoMarchado: has3erMarchado
        };
    }

    private mapItem(item: any): KitchenOrderItem {
        const rawComments = String(item?.comentarios ?? '');
        let tiempo: 1 | 2 | 3 = item?.tiempo === 3 ? 3 : (item?.tiempo === 2 ? 2 : 1);
        let tiempoMarchado = !!item?.tiempoMarchado;
        const paraLlevar = item?.paraLlevar || rawComments.includes('PARA LLEVAR');

        if (rawComments.includes('3ER TIEMPO') || rawComments.includes('TERCER TIEMPO')) {
            tiempo = 3;
            if (rawComments.includes('MARCHADO')) {
                tiempoMarchado = true;
            }
        } else if (rawComments.includes('2DO TIEMPO') || rawComments.includes('SEGUNDO TIEMPO')) {
            tiempo = 2;
            if (rawComments.includes('MARCHADO')) {
                tiempoMarchado = true;
            }
        }

        return {
            productId: item?.productId,
            productName: item?.productName ?? item?.prod ?? `Producto #${item?.productId ?? '-'}`,
            quantity: Number(item?.cantidad ?? 0),
            unitPrice: Number(item?.precioUnitario ?? item?.precio ?? 0),
            comments: rawComments,
            tiempo,
            tiempoMarchado,
            paraLlevar,
            yaSalio: !!item?.yaSalio,
            excludedIngredientIds: Array.isArray(item?.excludedIngredientIds) ? item.excludedIngredientIds.map(Number) : [],
            additionalIngredientIds: Array.isArray(item?.additionalIngredientIds) ? item.additionalIngredientIds.map(Number) : []
        };
    }

    private normalizeStatus(rawStatus: unknown): KitchenOrderStatus {
        const status = String(rawStatus ?? '').toUpperCase();

        if (status === 'PENDIENTE') {
            return 'PENDIENTE';
        }

        if (status === 'CONFIRMADA' || status === 'CONFIRMED') {
            return 'CONFIRMADA';
        }

        if (status === 'EN_PREPARACION' || status === 'IN_PROGRESS') {
            return 'EN_PREPARACION';
        }

        if (status === 'LISTO' || status === 'DESPACHADO') {
            return 'LISTO';
        }

        if (status === 'PAGADA' || status === 'PAID') {
            return 'PAGADA';
        }

        if (status === 'CANCELADA' || status === 'CANCELLED') {
            return 'CANCELADA';
        }

        // Default a PENDIENTE para órdenes nuevas del CHATBOT
        return 'PENDIENTE';
    }
}
