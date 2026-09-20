/**
 * Modelos para la gestión de órdenes en Comandix
 */

export interface OrderItem {
  productId: number;
  cantidad: number;
  precioUnitario: number;
  comentarios?: string;
  asientoId?: string | number;
  asientoAlias?: string;
  /** Ingredientes modificables que el cliente pidió quitar (no se descuentan) */
  excludedIngredientIds?: number[];
  /** Insumos adicionales seleccionados por el cliente (se descuentan) */
  additionalIngredientIds?: number[];
}

export interface ComandaAsiento {
  id: string;
  numero: number;
  alias: string;
  estado?: 'ACTIVO' | 'PAGADO';
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
  source?: string;
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
  asientoId?: string | number;
  asientoAlias?: string;
  excludedIngredientIds?: number[];
  additionalIngredientIds?: number[];
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
  horaApertura?: string;
  horaCierre?: string | null;
  mesaId?: number;
  mesaNombre?: string;
  mesaNumero?: number;
  meseroNombre?: string;
  subcomandas?: string[];
  payment?: PaymentInfo;
}

export interface ReporteVentaRow {
  id_comanda: string;
  folio_comanda: string;
  hora_apertura: string;
  hora_cierre: string | null;
  mesa_nombre: string;
  mesa_numero?: number;
  mesero_nombre: string;
  cliente_nombre: string;
  total_pagado: number;
  estado_comanda: string;
  subcomandas?: string[];
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

// ==================== ASIENTOS (comanda por personas) ====================

export interface OrderSeat {
  id: string;
  orderId?: string | null;
  /** Alias editable por el mesero (p. ej. "Hombre gorra azul") */
  alias?: string | null;
  /** Número de asiento (1, 2, 3...) */
  numero?: number | null;
  /** Método con el que se liquidó su parte (si ya se cobró) */
  settleMethod?: PaymentMethod | null;
  settledAt?: string | null;
  createdAt?: string;
}

export interface SeatListResponse {
  code: number;
  message: string;
  object?: OrderSeat[];
}

export interface AddSeatRequest {
  orderId?: string;
  alias?: string | null;
  numero?: number | null;
}

export interface AddSeatResponse {
  code: number;
  message: string;
  object?: OrderSeat;
}

export interface UpdateSeatAliasRequest {
  alias: string;
}

export interface UpdateSeatAliasResponse {
  code: number;
  message: string;
  object?: OrderSeat;
}

export interface AssignItemToSeatRequest {
  seatId: string;
  /** Ids de los artículos que se asignan al asiento (ids de ítem u orderItem ids) */
  itemIds?: (string | number)[];
}

export interface AssignItemToSeatResponse {
  code: number;
  message: string;
  object?: OrderSeat;
}

export interface SettleSeatsRequest {
  seatIds: string[];
  method: PaymentMethod;
  reference?: string | null;
  userEmail?: string;
}

export interface SettleSeatsResponse {
  code: number;
  message: string;
  object?: {
    derivedFolios?: Record<string, string>;
  } | null;
}

/**
 * Fila del reporte general de ventas/comandas (JOIN client_order + mesa + app_user + customer).
 * Coincide 1:1 con SalesReportRowDTO del backend.
 */
export interface SalesReportRow {
  folio: string;
  horarioApertura: string;
  horarioCierre: string;
  mesa: string;
  mesero: string;
  totalPagado: number;
  cliente: string | null;
}

