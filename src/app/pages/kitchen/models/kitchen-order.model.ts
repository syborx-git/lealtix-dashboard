export type KitchenOrderStatus = 'PENDIENTE' | 'CONFIRMADA' | 'EN_PREPARACION' | 'LISTO' | 'PAGADA' | 'CANCELADA';

export interface KitchenOrderItem {
    productId?: number;
    productName: string;
    quantity: number;
    unitPrice: number;
    comments?: string;
    tiempo?: 1 | 2 | 3;
    tiempoMarchado?: boolean;
    paraLlevar?: boolean;
    yaSalio?: boolean;
    /** IDs de ingredientes modificables que el cliente NO quiere */
    excludedIngredientIds?: number[];
    /** IDs de adicionales que el cliente pidió */
    additionalIngredientIds?: number[];
    updatedAt?: string;
}

export interface KitchenOrder {
    id: string;
    parentOrderId?: string;
    tiempo?: 1 | 2 | 3;
    tiempoLabel?: string;
    tenantId: number;
    status: KitchenOrderStatus;
    customerId?: number | null;
    customerName?: string | null;
    mesaId?: number;
    mesaNombre?: string;
    mesaNumero?: number;
    source?: string;
    createdAt: string;
    marchedAt?: string;
    items: KitchenOrderItem[];
    subtotal: number;
    discount: number;
    total: number;
    recorrido?: number;
    segundoTiempoMarchado?: boolean;
    tercerTiempoMarchado?: boolean;
    waitingTiemposLabels?: string[];
}
