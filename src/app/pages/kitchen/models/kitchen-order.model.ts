export type KitchenOrderStatus = 'PENDIENTE' | 'CONFIRMADA' | 'EN_PREPARACION' | 'LISTO' | 'PAGADA';

export interface KitchenOrderItem {
    productId?: number;
    productName: string;
    quantity: number;
    unitPrice: number;
    comments?: string;
    /** IDs de ingredientes modificables que el cliente NO quiere */
    excludedIngredientIds?: number[];
    /** IDs de adicionales que el cliente pidió */
    additionalIngredientIds?: number[];
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
