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

    private ticketStatuses = new Map<string, KitchenOrderStatus>();
    private readonly STORAGE_KEY_PREFIX = 'lealtix_kitchen_ticket_status_';

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
        this.loadTicketStatuses();

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
        this.destroy$.next();
    }

    extractParentOrderId(ticketId: string): string {
        if (!ticketId) return '';
        const idx = ticketId.indexOf('__');
        return idx !== -1 ? ticketId.substring(0, idx) : ticketId;
    }

    async startOrder(ticketId: string): Promise<void> {
        const parentId = this.extractParentOrderId(ticketId);
        try {
            await firstValueFrom(this.kitchenApiService.updateStatus(parentId, 'start'));
        } catch (e) {
            console.warn('[KitchenFacade] Error actualizando backend a start:', e);
        }
        this.ticketStatuses.set(ticketId, 'EN_PREPARACION');
        this.saveTicketStatuses();
        this.patchLocalStatus(ticketId, 'EN_PREPARACION');
    }

    async startOrderFromConfirmed(ticketId: string): Promise<void> {
        await this.startOrder(ticketId);
    }

    async finishOrder(ticketId: string): Promise<void> {
        this.ticketStatuses.set(ticketId, 'LISTO');
        this.saveTicketStatuses();

        const parentId = this.extractParentOrderId(ticketId);

        // Actualizar el estado local inmediatamente
        const patched = this.ordersSubject.value.map((order) => {
            if (order.id !== ticketId) {
                return order;
            }
            return {
                ...order,
                status: 'LISTO' as KitchenOrderStatus,
                items: order.items.map((it) => ({ ...it, yaSalio: true }))
            };
        });
        this.emitOrders(patched);

        // Solo marcar la orden completa como LISTO en el backend si TODOS los tickets activos terminaron
        const siblingTickets = this.ordersSubject.value.filter(
            (o) => (o.parentOrderId || this.extractParentOrderId(o.id)) === parentId
        );
        const allSiblingsReady = siblingTickets.every(
            (o) => o.id === ticketId || o.status === 'LISTO' || o.status === 'PAGADA'
        );

        if (allSiblingsReady) {
            try {
                await firstValueFrom(this.kitchenApiService.updateStatus(parentId, 'finish'));
            } catch (e) {
                console.warn('[KitchenFacade] Error actualizando backend a finish:', e);
            }
        }
    }

    async returnToConfirmedForSegundoTiempo(ticketId: string): Promise<void> {
        const parentId = this.extractParentOrderId(ticketId);
        try {
            await firstValueFrom(this.kitchenApiService.updateStatus(parentId, 'return-confirmed'));
        } catch (e) {
            console.warn('[KitchenFacade] Error actualizando backend a return-confirmed:', e);
        }
        this.ticketStatuses.set(ticketId, 'CONFIRMADA');
        this.saveTicketStatuses();
        this.patchLocalStatus(ticketId, 'CONFIRMADA');
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
        const diffMs = Math.abs(now.getTime() - time);
        const withinShift = diffMs <= 24 * 60 * 60 * 1000;
        return sameDay || withinShift;
    }

    private startPolling(): void {
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
            const [confirmedOrders, pendingOrders, inProgressOrders, readyOrders, paidOrders] = await Promise.all([
                firstValueFrom(this.kitchenApiService.listOrdersByStatus(this.tenantId, 'CONFIRMADA', 0, 100)),
                firstValueFrom(this.kitchenApiService.listOrdersByStatus(this.tenantId, 'PENDIENTE', 0, 100)),
                firstValueFrom(this.kitchenApiService.listOrdersByStatus(this.tenantId, 'EN_PREPARACION', 0, 100)),
                firstValueFrom(this.kitchenApiService.listOrdersByStatus(this.tenantId, 'LISTO', 0, 100)),
                firstValueFrom(this.kitchenApiService.listOrdersByStatus(this.tenantId, 'PAGADA', 0, 100))
            ]);

            const todayReady = readyOrders || [];
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

            const kitchenTickets: KitchenOrder[] = [];
            for (const order of allBackendOrders) {
                kitchenTickets.push(...this.mapBackendOrderToTickets(order));
            }

            this.knownOrderIds = new Set(kitchenTickets.map((t) => t.id));
            this.emitOrders(kitchenTickets);
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

    private emitOrders(orders: KitchenOrder[]): void {
        const sorted = [...orders].sort((a, b) =>
            this.parseOrderTime(a.createdAt) - this.parseOrderTime(b.createdAt)
        );
        const signature = sorted
            .map((order) => `${order.id}#${order.status}#${order.tiempo ?? 1}#${order.items.map((i) => `${i.productId}x${i.quantity}t${i.tiempo ?? 1}m${i.tiempoMarchado ? 1 : 0}s${i.yaSalio ? 1 : 0}`).join(',')}`)
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

        const incomingTickets = this.mapBackendOrderToTickets(event.order);
        let added = false;
        const currentOrders = [...this.ordersSubject.value];

        for (const ticket of incomingTickets) {
            if (!this.knownOrderIds.has(ticket.id)) {
                this.knownOrderIds.add(ticket.id);
                currentOrders.push(ticket);
                added = true;
            }
        }

        if (added) {
            this.emitOrders(currentOrders);
            this.kitchenNotificationService.playNewOrderSound(1);
        }
    }

    private handleOrderStatusChangedEvent(event: SseOrderStatusEvent): void {
        if (!event?.order || Number(event.tenantId) !== this.tenantId) {
            return;
        }

        const backendOrderId = String(event.order.id);
        const status = this.normalizeStatus(event.order.estado);

        // Órdenes canceladas se retiran
        if (status === 'CANCELADA') {
            this.removeLocalOrderByParent(backendOrderId);
            return;
        }

        const incomingTickets = this.mapBackendOrderToTickets(event.order);
        if (incomingTickets.length === 0) {
            return;
        }

        let currentOrders = [...this.ordersSubject.value];
        let hasNewTicket = false;

        for (const ticket of incomingTickets) {
            const existingIdx = currentOrders.findIndex((o) => o.id === ticket.id);
            if (existingIdx !== -1) {
                const prev = currentOrders[existingIdx];
                // Mantener estado si ya fue progresado localmente (ej: EN_PREPARACION o LISTO)
                const preservedStatus = (prev.status === 'EN_PREPARACION' || prev.status === 'LISTO') && status === 'CONFIRMADA'
                    ? prev.status
                    : ticket.status;
                currentOrders[existingIdx] = { ...ticket, status: preservedStatus };
            } else {
                // Nuevo ticket generado (ej. 2do o 3er tiempo recién marchado)
                currentOrders.push(ticket);
                this.knownOrderIds.add(ticket.id);
                hasNewTicket = true;
            }
        }

        this.emitOrders(currentOrders);

        if (hasNewTicket || status === 'CONFIRMADA') {
            this.kitchenNotificationService.playNewOrderSound(1);
        }
    }

    private patchLocalStatus(ticketId: string, status: KitchenOrderStatus): void {
        const patched = this.ordersSubject.value.map((order) => {
            if (order.id !== ticketId) {
                return order;
            }
            return {
                ...order,
                status
            };
        });

        this.emitOrders(patched);
    }

    private removeLocalOrderByParent(parentOrderId: string): void {
        const remaining = this.ordersSubject.value.filter((order) => {
            const parent = order.parentOrderId || this.extractParentOrderId(order.id);
            return parent !== parentOrderId && order.id !== parentOrderId;
        });
        for (const order of this.ordersSubject.value) {
            const parent = order.parentOrderId || this.extractParentOrderId(order.id);
            if (parent === parentOrderId || order.id === parentOrderId) {
                this.knownOrderIds.delete(order.id);
                this.ticketStatuses.delete(order.id);
            }
        }
        this.saveTicketStatuses();
        this.emitOrders(remaining);
    }

    private mapBackendOrderToTickets(order: any): KitchenOrder[] {
        const parentOrderId = String(order?.id ?? '');
        const tenantId = Number(order?.tenantId ?? this.tenantId);
        const backendStatus = this.normalizeStatus(order?.estado);

        const mesaId = order?.idMesa ?? order?.mesaId ?? (typeof order?.mesa === 'object' ? order?.mesa?.id : (typeof order?.mesa === 'number' ? order.mesa : undefined));
        const mesaNombre = order?.mesaNombre ?? order?.mesa?.nombre ?? (order?.mesaNumero ? `Mesa ${order.mesaNumero}` : undefined);
        const mesaNumero = order?.mesaNumero ?? order?.mesa?.numero;
        const customerId = order?.customerId ?? null;
        const customerName = order?.customerName ?? order?.nombre ?? (customerId != null ? `Cliente #${customerId}` : 'Cliente General');
        const source = order?.source;
        const createdAt = String(order?.fecha ?? order?.createdAt ?? order?.fechaCreacion ?? new Date().toISOString());
        const subtotal = Number(order?.subtotal ?? 0);
        const discount = Number(order?.descuento ?? 0);
        const total = Number(order?.total ?? order?.totalFinal ?? 0);

        const rawItems = order?.items ?? [];
        const allItems: KitchenOrderItem[] = rawItems.map((item: any) => this.mapItem(item));

        // Separar por tiempos
        const t1Items = allItems.filter((it) => !it.tiempo || it.tiempo === 1);
        const t2Items = allItems.filter((it) => it.tiempo === 2);
        const t3Items = allItems.filter((it) => it.tiempo === 3);

        const hasT2 = t2Items.length > 0;
        const hasT3 = t3Items.length > 0;
        const t2Marchado = t2Items.some((it) => it.tiempoMarchado);
        const t3Marchado = t3Items.some((it) => it.tiempoMarchado);

        // Tiempos futuros en espera (para avisos informativos en tickets activos)
        const waitingLabels: string[] = [];
        if (hasT2 && !t2Marchado) {
            waitingLabels.push('2do Tiempo en espera');
        }
        if (hasT3 && !t3Marchado) {
            waitingLabels.push('3er Tiempo en espera');
        }

        const tickets: KitchenOrder[] = [];

        // Si NO hay tiempos 2 ni 3, es una comanda sencilla
        if (!hasT2 && !hasT3) {
            const ticketId = parentOrderId;
            const status = this.resolveTicketStatus(ticketId, backendStatus);
            tickets.push({
                id: ticketId,
                parentOrderId,
                tiempo: 1,
                tiempoLabel: '1er Tiempo',
                tenantId,
                status,
                customerId,
                customerName,
                mesaId,
                mesaNombre,
                mesaNumero,
                source,
                createdAt,
                marchedAt: createdAt,
                items: allItems,
                subtotal,
                discount,
                total,
                recorrido: 1,
                segundoTiempoMarchado: false,
                tercerTiempoMarchado: false,
                waitingTiemposLabels: []
            });
            return tickets;
        }

        // COMANDA CON MÚLTIPLES TIEMPOS: GENERAR UN TICKET INDEPENDIENTE POR TIEMPO

        // 1ER TIEMPO TICKET (si tiene items de 1er tiempo)
        if (t1Items.length > 0) {
            const ticketId = `${parentOrderId}__T1`;
            const status = this.resolveTicketStatus(ticketId, backendStatus);
            tickets.push({
                id: ticketId,
                parentOrderId,
                tiempo: 1,
                tiempoLabel: '1er Tiempo',
                tenantId,
                status,
                customerId,
                customerName,
                mesaId,
                mesaNombre,
                mesaNumero,
                source,
                createdAt,
                marchedAt: createdAt,
                items: t1Items,
                subtotal,
                discount,
                total,
                recorrido: 1,
                segundoTiempoMarchado: t2Marchado,
                tercerTiempoMarchado: t3Marchado,
                waitingTiemposLabels: waitingLabels
            });
        }

        // 2DO TIEMPO TICKET (si tiene items de 2do tiempo y está marchado)
        if (hasT2 && t2Marchado) {
            const ticketId = `${parentOrderId}__T2`;
            const status = this.resolveTicketStatus(ticketId, backendStatus, 2);
            const latestUpdate = t2Items.find((it) => it.updatedAt)?.updatedAt || createdAt;
            const t2Waiting: string[] = [];
            if (hasT3 && !t3Marchado) {
                t2Waiting.push('3er Tiempo en espera');
            }

            tickets.push({
                id: ticketId,
                parentOrderId,
                tiempo: 2,
                tiempoLabel: '2do Tiempo',
                tenantId,
                status,
                customerId,
                customerName,
                mesaId,
                mesaNombre,
                mesaNumero,
                source,
                createdAt: latestUpdate,
                marchedAt: latestUpdate,
                items: t2Items,
                subtotal,
                discount,
                total,
                recorrido: 2,
                segundoTiempoMarchado: true,
                tercerTiempoMarchado: t3Marchado,
                waitingTiemposLabels: t2Waiting
            });
        }

        // 3ER TIEMPO TICKET (si tiene items de 3er tiempo y está marchado)
        if (hasT3 && t3Marchado) {
            const ticketId = `${parentOrderId}__T3`;
            const status = this.resolveTicketStatus(ticketId, backendStatus, 3);
            const latestUpdate = t3Items.find((it) => it.updatedAt)?.updatedAt || createdAt;

            tickets.push({
                id: ticketId,
                parentOrderId,
                tiempo: 3,
                tiempoLabel: '3er Tiempo',
                tenantId,
                status,
                customerId,
                customerName,
                mesaId,
                mesaNombre,
                mesaNumero,
                source,
                createdAt: latestUpdate,
                marchedAt: latestUpdate,
                items: t3Items,
                subtotal,
                discount,
                total,
                recorrido: 3,
                segundoTiempoMarchado: t2Marchado,
                tercerTiempoMarchado: true,
                waitingTiemposLabels: []
            });
        }

        return tickets;
    }

    private resolveTicketStatus(ticketId: string, backendStatus: KitchenOrderStatus, tiempo = 1): KitchenOrderStatus {
        if (backendStatus === 'CANCELADA') return 'CANCELADA';
        if (backendStatus === 'PAGADA') return 'PAGADA';

        if (this.ticketStatuses.has(ticketId)) {
            const persisted = this.ticketStatuses.get(ticketId)!;
            if (backendStatus === 'LISTO') return 'LISTO';
            return persisted;
        }

        if (backendStatus === 'LISTO') return 'LISTO';

        if (tiempo === 2 || tiempo === 3) {
            return 'CONFIRMADA';
        }

        return backendStatus;
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
            additionalIngredientIds: Array.isArray(item?.additionalIngredientIds) ? item.additionalIngredientIds.map(Number) : [],
            updatedAt: item?.updatedAt
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

        return 'PENDIENTE';
    }

    private getStorageKey(): string {
        return `${this.STORAGE_KEY_PREFIX}${this.tenantId}`;
    }

    private loadTicketStatuses(): void {
        try {
            const raw = localStorage.getItem(this.getStorageKey());
            if (raw) {
                const parsed = JSON.parse(raw);
                this.ticketStatuses = new Map(Object.entries(parsed));
            }
        } catch (e) {
            console.warn('[KitchenFacade] Error loading ticket statuses:', e);
            this.ticketStatuses = new Map();
        }
    }

    private saveTicketStatuses(): void {
        try {
            const obj: Record<string, string> = {};
            this.ticketStatuses.forEach((val, key) => {
                obj[key] = val;
            });
            localStorage.setItem(this.getStorageKey(), JSON.stringify(obj));
        } catch (e) {
            console.warn('[KitchenFacade] Error saving ticket statuses:', e);
        }
    }
}
