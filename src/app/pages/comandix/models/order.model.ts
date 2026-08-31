/**
 * Modelos para la gestión de órdenes en Comandix
 */

export interface OrderItem {
  productId: number;
  cantidad: number;
  precioUnitario: number;
  comentarios?: string;
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
    tenantId: number;
  items: OrderItem[];
  subtotal: number;
  descuento: number;
  totalFinal: number;
  couponCode?: string | null;
  redeemedBy?: number | null;
  redemptionChannel?: string | null;
}

export interface TenantClientOrderUpdateRequest {
  customerId?: number | null;
  tenantId: number;
  items: OrderItem[];
  subtotal: number;
  descuento: number;
  totalFinal: number;
  couponCode?: string | null;
}

export interface TenantClientOrderResponse {
  id: number;
  customerId?: number | null;
  tenantId: number;
  items: OrderItem[];
  subtotal: number;
  descuento: number;
  totalFinal: number;
  fechaCreacion: string;
  estado: string;
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
}

export interface PendingOrder {
  id: string;
  tenantId: number;
  estado: OrderStatus | string;
  customerId?: number | null;
  customerName?: string | null;
  nombre?: string | null;
  items?: PendingOrderItem[];
  subtotal?: number;
  descuento?: number;
  totalFinal?: number;
  couponCode?: string | null;
  coupon_id?: string | null;
  fechaCreacion?: string;
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
