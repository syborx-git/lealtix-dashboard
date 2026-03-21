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
  UpdateOrderStatusResponse
} from '../models/order.model';
import { environment } from '@/pages/commons/environment';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private readonly baseUrl = `${environment.apiUrl}/tenant-client-orders`;

  private readonly statusMap: Record<string, string> = {
    PENDING: 'PENDIENTE',
    CONFIRMED: 'CONFIRMADO',
    REJECTED: 'RECHAZADO'
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
   * PATCH /api/tenant-client-orders/status?orderId=X&status=CONFIRMADO
   */
  updateOrderStatus(orderId: string, status: string): Observable<UpdateOrderStatusResponse> {
    const normalizedStatus = this.statusMap[status] ?? status;
    const params = new HttpParams()
      .set('orderId', orderId)
      .set('status', normalizedStatus);

    return this.http
      .patch<UpdateOrderStatusResponse>(`${this.baseUrl}/status`, null, { params })
      .pipe(
        catchError((error) => {
          console.error('Error al actualizar estado de orden:', error);
          return throwError(() => error);
        })
      );
  }
}
