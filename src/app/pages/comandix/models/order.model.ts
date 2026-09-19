/**
 * Modelos para la gestión de órdenes en Comandix
 */

export interface OrderItem {
  productId: number;
  cantidad: number;
  precioUnitario: number;
  comentarios?: string;
  /** Ingredientes modificables que el cliente pidió quitar (no se descuentan) */
  excludedIngredientIds?: number[];
  /** Insumos adicionales seleccionados por el cliente (se descuentan) */
  additionalIngredientIds?: number[];
}

export type OrderStatus =
  | 'PENDIENTE'
  | 'CONFIRMADA'
  | 'EN_PREPARACION'
  | 'LISTO'
  | 'PAGADA'
  | 'RECHAZADO'
  | 'CANCELADA';

export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'MIXED';

export interface PaymentInfo {
  method: PaymentMethod;
  reference?: string | null;
  paidAt?: string;
  paidBy?: string | number;
  amount?: number;
}

export interface RecordPaymentRequest {
  orderId?: string;
  method: PaymentMethod;
  reference?: string | null;
  userEmail?: string;  // Email del usuario que aplica el pago
}

export interface RecordPaymentResponse {
  code?: number;
  message?: string;
  object?: {
    id?: string;
    estado?: OrderStatus;
    paymentMethod?: PaymentMethod;
    paymentReference?: string | null;
    paidAt?: string;
    paidBy?: string | number;
  };
}

export interface TenantClientOrderCreateRequest {
  customerId?: number | null;
  /** Identificador del cliente asociado a la comanda (opcional, null si no aplica) */
  idCliente?: number | null;
  tenantId: number;
  items: OrderItem[];
  subtotal: number;
  descuento: number;
  totalFinal: number;
  couponCode?: string | null;
  redeemedBy?: number | null;
  redemptionChannel?: string | null;
  source?: string;
  /** Mesa seleccionada para la comanda (obligatoria en POS) */
  idMesa?: number | null;
  /** Mesero autenticado que abre la comanda (obligatorio en POS) */
  idMesero?: number | null;
  /** Timestamp ISO de apertura de la comanda */
  horaApertura?: string | null;
}

export interface TenantClientOrderUpdateRequest {
  customerId?: number | null;
  idCliente?: number | null;
  tenantId: number;
  items: OrderItem[];
  subtotal: number;
  descuento: number;
  totalFinal: number;
  couponCode?: string | null;
  idMesa?: number | null;
  idMesero?: number | null;
  horaApertura?: string | null;
}

export interface TenantClientOrderResponse {
  id: number;
  customerId?: number | null;
  idCliente?: number | null;
  tenantId: number;
  items: OrderItem[];
  subtotal: number;
  descuento: number;
  totalFinal: number;
  fechaCreacion: string;
  estado: string;
  idMesa?: number | null;
  idMesero?: number | null;
  horaApertura?: string | null;
}

// ==================== DASHBOARD DE ÓRDENES PENDIENTES ====================

export interface PendingOrderItem {
  productId?: number;
  productName?: string;
  prod?: string;
  cantidad: number;
  precioUnitario: number;
  precio?: number;
  comentarios?: string;
  excludedIngredientIds?: number[];
  additionalIngredientIds?: number[];
}

export interface PendingOrder {
  id: string;
  tenantId: number;
  estado: OrderStatus | string;
  customerId?: number | null;
  idCliente?: number | null;
  customerName?: string | null;
  nombre?: string | null;
  items?: PendingOrderItem[];
  subtotal?: number;
  descuento?: number;
  totalFinal?: number;
  couponCode?: string | null;
  coupon_id?: string | null;
  fechaCreacion?: string;
  idMesa?: number | null;
  idMesero?: number | null;
  horaApertura?: string | null;
  payment?: PaymentInfo;
}

export interface OrderListData {
  content: PendingOrder[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface OrderListResponse {
  code: number;
  message: string;
  object: OrderListData;
}

export interface UpdateOrderStatusResponse {
  code: number;
  message: string;
  data: {
    id: string;
    tenantId: number;
    estado: string;
  } | null;
}

export interface UpdateOrderStatusRequest {
  estado: OrderStatus | string;
  userEmail?: string;
  reason?: string;
}

// ==================== DIVISIÓN DE CUENTA (split) ====================

export interface SplitOrderRequest {
  tenantId: number;
  customerId?: number | null;
  items: OrderItem[];
  source?: string;
}

export interface SplitOrderResponse {
  code: number;
  message: string;
  object?: {
    originalOrder?: TenantClientOrderResponse;
    newOrder?: TenantClientOrderResponse;
  };
}

// ==================== PROPINA (capa visual) ====================

export interface TipInfo {
  /** Propina como porcentaje del total (10, 15, 20...) */
  percent?: number | null;
  /** Propina como monto fijo (modo "Otro") */
  amount?: number | null;
}
