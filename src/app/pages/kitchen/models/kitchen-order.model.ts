export type KitchenOrderStatus = 'PENDIENTE' | 'EN_PREPARACION' | 'LISTO_DESPACHADO';

export interface KitchenOrderItem {
    productId?: number;
    productName: string;
    quantity: number;
    unitPrice: number;
    comments?: string;
}

export interface KitchenOrder {
    id: string;
    tenantId: number;
    status: KitchenOrderStatus;
    customerId?: number | null;
    customerName?: string | null;
    source?: string;
    createdAt: string;
    items: KitchenOrderItem[];
    subtotal: number;
    discount: number;
    total: number;
}
