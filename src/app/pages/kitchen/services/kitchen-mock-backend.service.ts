import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { KitchenOrder, KitchenOrderItem, KitchenOrderStatus } from '../models/kitchen-order.model';

@Injectable({
    providedIn: 'root'
})
export class KitchenMockBackendService {
    private readonly ordersSubject = new BehaviorSubject<KitchenOrder[]>([]);
    private generationTimer: ReturnType<typeof setInterval> | null = null;

    getOrders$(): Observable<KitchenOrder[]> {
        return this.ordersSubject.asObservable();
    }

    start(tenantId: number): void {
        if (this.ordersSubject.value.length === 0) {
            this.ordersSubject.next(this.createSeedOrders(tenantId));
        }

        if (this.generationTimer !== null) {
            clearInterval(this.generationTimer);
        }

        this.generationTimer = setInterval(() => {
            const incomingOrder = this.createIncomingOrder(tenantId);
            this.ordersSubject.next([incomingOrder, ...this.ordersSubject.value]);
        }, 45000);
    }

    stop(): void {
        if (this.generationTimer !== null) {
            clearInterval(this.generationTimer);
            this.generationTimer = null;
        }
    }

    updateStatus(orderId: string, status: KitchenOrderStatus): Observable<boolean> {
        const updated = this.ordersSubject.value.map((order) => {
            if (order.id !== orderId) {
                return order;
            }
            return {
                ...order,
                status
            };
        });
        this.ordersSubject.next(updated);
        return of(true);
    }

    removeOrder(orderId: string): void {
        this.ordersSubject.next(this.ordersSubject.value.filter((order) => order.id !== orderId));
    }

    private createSeedOrders(tenantId: number): KitchenOrder[] {
        return [
            this.buildOrder(tenantId, 'Cliente General', 'PENDIENTE', [
                { productName: 'Hamburguesa Clásica', quantity: 2, unitPrice: 14500, comments: 'Sin cebolla' },
                { productName: 'Papas Grandes', quantity: 1, unitPrice: 7500, comments: 'Extra salsa' }
            ], -4),
            this.buildOrder(tenantId, 'Ana Rojas', 'EN_PREPARACION', [{ productName: 'Wrap de Pollo', quantity: 1, unitPrice: 16500 }], -8)
        ];
    }

    private createIncomingOrder(tenantId: number): KitchenOrder {
        const menu = [
            { productName: 'Taco de Birria', quantity: 3, unitPrice: 8200, comments: 'Doble queso' },
            { productName: 'Limonada de Coco', quantity: 1, unitPrice: 9000, comments: 'Sin hielo' },
            { productName: 'Panini Veggie', quantity: 2, unitPrice: 15000, comments: 'Sin tomate' }
        ];

        const randomItem = menu[Math.floor(Math.random() * menu.length)] as KitchenOrderItem;
        return this.buildOrder(tenantId, 'Pedido Lealbot', 'PENDIENTE', [randomItem], 0);
    }

    private buildOrder(
        tenantId: number,
        customerName: string,
        status: KitchenOrderStatus,
        items: KitchenOrderItem[],
        minutesAgo: number
    ): KitchenOrder {
        const subtotal = items.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);

        return {
            id: `MOCK-${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
            tenantId,
            status,
            customerName,
            source: 'CHATBOT',
            createdAt: new Date(Date.now() + minutesAgo * 60_000).toISOString(),
            items,
            subtotal,
            discount: 0,
            total: subtotal
        };
    }
}
