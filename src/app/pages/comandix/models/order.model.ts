/**
 * Modelos para la gestión de órdenes en Comandix
 */

export interface OrderItem {
  productId: number;
  cantidad: number;
  precioUnitario: number;
  comentarios?: string;
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
