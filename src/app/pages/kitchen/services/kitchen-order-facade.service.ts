import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, firstValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { OrderSseService, SseNewOrderEvent } from '@/pages/comandix/services/order-sse.service';
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
    private readonly readyCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();
    private readonly READY_AUTO_CLEAR_MS = 15000;
    private tenantId = 0;
    private knownOrderIds = new Set<string>();

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
        this.clearAllReadyTimers();
        this.destroy$.next();
    }

    async startOrder(orderId: string): Promise<void> {
        await firstValueFrom(this.kitchenApiService.updateStatus(orderId, 'start'));
        this.patchLocalStatus(orderId, 'EN_PREPARACION');
        this.cancelReadyCleanup(orderId);
    }

    async startOrderFromConfirmed(orderId: string): Promise<void> {
        await firstValueFrom(this.kitchenApiService.updateStatus(orderId, 'start'));
        this.patchLocalStatus(orderId, 'EN_PREPARACION');
    }

    async finishOrder(orderId: string): Promise<void> {
        await firstValueFrom(this.kitchenApiService.updateStatus(orderId, 'finish'));
        this.patchLocalStatus(orderId, 'LISTO');
    }



    private startPolling(): void {
        this.pollingTimer = setInterval(() => this.loadOrders(), 30_000);
    }

    private startRealtime(): void {
        this.orderSseService.connect(this.tenantId);

        this.orderSseService.connectionStatus$
            .pipe(takeUntil(this.destroy$))
            .subscribe((status) => this.connectionSubject.next(status));

        this.orderSseService.newOrder$
            .pipe(takeUntil(this.destroy$))
            .subscribe((event) => this.handleIncomingOrderEvent(event));
    }

    private async loadOrders(): Promise<void> {
        this.loadingSubject.next(true);
        try {
            // Cargar órdenes de cada status independientemente
            const confirmedOrders = await firstValueFrom(
                this.kitchenApiService.listOrdersByStatus(this.tenantId, 'CONFIRMADA', 0, 100)
            );
            const inProgressOrders = await firstValueFrom(
                this.kitchenApiService.listOrdersByStatus(this.tenantId, 'EN_PREPARACION', 0, 100)
            );
            const readyOrders = await firstValueFrom(
                this.kitchenApiService.listOrdersByStatus(this.tenantId, 'LISTO', 0, 100)
            );

            const allBackendOrders = [...confirmedOrders, ...inProgressOrders, ...readyOrders];
            const kitchenOrders = allBackendOrders.map((order) => this.mapBackendOrderToKitchen(order));

            this.knownOrderIds = new Set(kitchenOrders.map((order) => order.id));
            this.ordersSubject.next(kitchenOrders);
        } catch (error) {
            console.error('Error al cargar órdenes de cocina:', error);
            // No hay fallback a mock, simplemente mostrar error
            this.ordersSubject.next([]);
        } finally {
            this.loadingSubject.next(false);
        }
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
        // Agregar la nueva orden al final (FIFO) para mantener orden de llegada
        this.ordersSubject.next([...this.ordersSubject.value, mappedOrder]);

        // Reproducir campana para cualquier orden nueva que llega
        this.kitchenNotificationService.playNewOrderSound(2, 400);
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

        this.ordersSubject.next(patched);
    }

    private removeLocalOrder(orderId: string): void {
        this.knownOrderIds.delete(orderId);
        this.cancelReadyCleanup(orderId);
        this.ordersSubject.next(this.ordersSubject.value.filter((order) => order.id !== orderId));
    }

    private scheduleReadyCleanup(orderId: string): void {
        this.cancelReadyCleanup(orderId);
        const timer = setTimeout(() => {
            this.removeLocalOrder(orderId);
        }, this.READY_AUTO_CLEAR_MS);
        this.readyCleanupTimers.set(orderId, timer);
    }

    private cancelReadyCleanup(orderId: string): void {
        const timer = this.readyCleanupTimers.get(orderId);
        if (!timer) {
            return;
        }

        clearTimeout(timer);
        this.readyCleanupTimers.delete(orderId);
    }

    private clearAllReadyTimers(): void {
        this.readyCleanupTimers.forEach((timer) => clearTimeout(timer));
        this.readyCleanupTimers.clear();
    }

    private reconcileReadyCleanup(orders: KitchenOrder[]): void {
        const readyOrderIds = new Set(orders.filter((order) => order.status === 'LISTO').map((order) => order.id));

        readyOrderIds.forEach((orderId) => this.scheduleReadyCleanup(orderId));

        Array.from(this.readyCleanupTimers.keys())
            .filter((orderId) => !readyOrderIds.has(orderId))
            .forEach((orderId) => this.cancelReadyCleanup(orderId));
    }

    private mapBackendOrderToKitchen(order: any): KitchenOrder {
        const status = this.normalizeStatus(order?.estado);
        const items = (order?.items ?? []).map((item: any) => this.mapItem(item));

        return {
            id: String(order?.id ?? ''),
            tenantId: Number(order?.tenantId ?? this.tenantId),
            status,
            customerId: order?.customerId ?? null,
            customerName: order?.customerName ?? order?.nombre ?? 'Cliente General',
            source: order?.source,
            createdAt: String(order?.fecha ?? order?.createdAt ?? order?.fechaCreacion ?? new Date().toISOString()),
            items,
            subtotal: Number(order?.subtotal ?? 0),
            discount: Number(order?.descuento ?? 0),
            total: Number(order?.total ?? order?.totalFinal ?? 0)
        };
    }

    private mapSseOrderToKitchen(event: SseNewOrderEvent): KitchenOrder {
        const order = event.order;
        const items = (order.items ?? []).map((item) => this.mapItem(item));

        return {
            id: String(order.id),
            tenantId: order.tenantId,
            status: this.normalizeStatus(order.estado),
            customerId: order.customerId,
            customerName: order.customerName ?? `Cliente #${order.customerId}`,
            source: order.source,
            createdAt: order.fecha,
            items,
            subtotal: Number(order.subtotal ?? 0),
            discount: Number(order.descuento ?? 0),
            total: Number(order.total ?? 0)
        };
    }

    private mapItem(item: any): KitchenOrderItem {
        return {
            productId: item?.productId,
            productName: item?.productName ?? item?.prod ?? `Producto #${item?.productId ?? '-'}`,
            quantity: Number(item?.cantidad ?? 0),
            unitPrice: Number(item?.precioUnitario ?? item?.precio ?? 0),
            comments: item?.comentarios ?? ''
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

        // Default a PENDIENTE para órdenes nuevas del CHATBOT
        return 'PENDIENTE';
    }
}
