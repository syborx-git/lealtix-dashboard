import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import {
  TenantClientOrderCreateRequest,
  TenantClientOrderUpdateRequest,
  TenantClientOrderResponse,
  OrderListResponse,
  UpdateOrderStatusResponse,
  UpdateOrderStatusRequest,
  RecordPaymentRequest,
  RecordPaymentResponse
} from '../models/order.model';
import { environment } from '@/pages/commons/environment';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private readonly baseUrl = `${environment.apiUrl}/tenant-client-orders`;

  private readonly statusMap: Record<string, string> = {
    PENDING: 'PENDIENTE',
    CONFIRMED: 'CONFIRMADA',
    REJECTED: 'RECHAZADO',
    PAID: 'PAGADA'
  };

  constructor(private http: HttpClient) {}

  /**
   * Crea una nueva orden de cliente
   */
  createOrder(order: TenantClientOrderCreateRequest): Observable<TenantClientOrderResponse> {
    return this.http.post<TenantClientOrderResponse>(this.baseUrl, order).pipe(
      catchError((error) => {
        console.error('Error al crear orden:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Actualiza una orden existente (items, cantidades, comentarios, totales)
   * Intenta PUT /{orderId} y si el backend no lo soporta, hace fallback a PATCH /{orderId}
   */
  updateOrder(orderId: string, order: TenantClientOrderUpdateRequest): Observable<TenantClientOrderResponse> {
    return this.http.put<TenantClientOrderResponse>(`${this.baseUrl}/${orderId}`, order).pipe(
      catchError((putError) => {
        console.warn('PUT no disponible para actualización de orden, intentando PATCH:', putError);
        return this.http.patch<TenantClientOrderResponse>(`${this.baseUrl}/${orderId}`, order);
      }),
      catchError((error) => {
        console.error('Error al actualizar orden:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Lista órdenes por tenant con filtro opcional de estado
   * GET /api/tenant-client-orders?tenantId=X&status=PENDING&page=0&size=20
   */
  getOrdersByTenant(
    tenantId: number,
    status?: string,
    page = 0,
    size = 20
  ): Observable<OrderListResponse> {
    let params = new HttpParams()
      .set('tenantId', tenantId.toString())
      .set('page', page.toString())
      .set('size', size.toString());

    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<OrderListResponse>(this.baseUrl, { params }).pipe(
      catchError((error) => {
        console.error('Error al obtener órdenes:', error);
        return throwError(() => error);
      })
    );
  }


  /**
   * Actualiza el estado de una orden
   * PATCH /api/tenant-client-orders/{orderId}/status
   * Body: { "estado": "CONFIRMADA", "userEmail": "user@email.com", "reason": "optional" }
   */
  updateOrderStatus(
    orderId: string,
    status: string,
    userEmail?: string,
    reason?: string
  ): Observable<UpdateOrderStatusResponse> {
    const normalizedStatus = this.statusMap[status] ?? status;
    const url = `${this.baseUrl}/${orderId}/status`;
    const body: UpdateOrderStatusRequest = {
      estado: normalizedStatus,
      ...(userEmail && { userEmail }),
      ...(reason && { reason })
    };

    return this.http
      .patch<UpdateOrderStatusResponse>(url, body)
      .pipe(
        catchError((error) => {
          console.error('Error al actualizar estado de orden:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Registra pago/cierre de cuenta para una orden.
   * Intenta endpoint con orderId en path y si no existe hace fallback a endpoint genérico.
   */
  recordPayment(orderId: string, payload: RecordPaymentRequest): Observable<RecordPaymentResponse> {
    const pathUrl = `${this.baseUrl}/${orderId}/record-payment`;
    const genericUrl = `${this.baseUrl}/record-payment`;
    const bodyWithOrder = { ...payload, orderId };

    return this.http.patch<RecordPaymentResponse>(pathUrl, payload).pipe(
      catchError((pathError) => {
        console.warn('Endpoint /{orderId}/record-payment no disponible, intentando fallback /record-payment:', pathError);
        return this.http.patch<RecordPaymentResponse>(genericUrl, bodyWithOrder);
      }),
      catchError((error) => {
        console.error('Error al registrar pago de orden:', error);
        return throwError(() => error);
      })
    );
  }
}
