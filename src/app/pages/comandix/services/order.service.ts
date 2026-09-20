import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { throwError } from 'rxjs';
import {
  TenantClientOrderCreateRequest,
  TenantClientOrderUpdateRequest,
  TenantClientOrderResponse,
  OrderListResponse,
  UpdateOrderStatusResponse,
  UpdateOrderStatusRequest,
  RecordPaymentRequest,
  RecordPaymentResponse,
  SplitOrderRequest,
  SplitOrderResponse,
  SeatListResponse,
  AddSeatRequest,
  AddSeatResponse,
  UpdateSeatAliasRequest,
  UpdateSeatAliasResponse,
  AssignItemToSeatRequest,
  AssignItemToSeatResponse,
  SettleSeatsRequest,
  SettleSeatsResponse,
  SalesReportRow
} from '../models/order.model';
import { GenericResponse } from '@/models/generic-response.model';
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
    return this.http.post<{ object?: TenantClientOrderResponse } | TenantClientOrderResponse>(this.baseUrl, order).pipe(
      map((response): TenantClientOrderResponse =>
        'object' in response && response.object
          ? response.object
          : response as TenantClientOrderResponse
      ),
      catchError((error) => {
        console.error('Error al crear orden:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Actualiza una orden existente (items, cantidades, comentarios, totales)
   * Usa PUT /{orderId} y si el backend anterior no lo soporta (404/405),
   * hace fallback a PATCH /{orderId}. Otros errores (p. ej. prórroga vencida 400)
   * se propagan sin sobrescribirlos para mostrar el mensaje real.
   */
  updateOrder(orderId: string, order: TenantClientOrderUpdateRequest): Observable<TenantClientOrderResponse> {
    return this.http.put<TenantClientOrderResponse>(`${this.baseUrl}/${orderId}`, order).pipe(
      catchError((putError) => {
        const status = putError?.status;
        if (status === 404 || status === 405) {
          console.warn('PUT no disponible para actualización de orden, intentando PATCH:', putError);
          return this.http.patch<TenantClientOrderResponse>(`${this.baseUrl}/${orderId}`, order).pipe(
            catchError((patchError) => {
              console.error('Error al actualizar orden:', patchError);
              return throwError(() => patchError);
            })
          );
        }
        console.error('Error al actualizar orden:', putError);
        return throwError(() => putError);
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

  /**
   * Divide una cuenta: mueve los artículos indicados de la comanda a una
   * comanda nueva lista para pagar.
   * POST /{orderId}/split
   */
  splitOrder(orderId: string, request: SplitOrderRequest): Observable<SplitOrderResponse> {
    return this.http.post<SplitOrderResponse>(`${this.baseUrl}/${orderId}/split`, request).pipe(
      catchError((error) => {
        console.error('Error al dividir cuenta:', error);
        return throwError(() => error);
      })
    );
  }

  // ==================== ASIENTOS (comanda por personas) ====================

  /**
   * Lista los asientos (personas) de una comanda.
   * GET /{orderId}/seats
   */
  getSeats(orderId: string): Observable<SeatListResponse> {
    return this.http.get<SeatListResponse>(`${this.baseUrl}/${orderId}/seats`).pipe(
      catchError((error) => {
        console.warn('No se pudieron cargar los asientos de la comanda:', orderId, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Añade un asiento (persona) a la comanda.
   * POST /{orderId}/seats
   */
  addSeat(orderId: string, request: AddSeatRequest): Observable<AddSeatResponse> {
    const body: AddSeatRequest = { ...request, orderId };
    return this.http.post<AddSeatResponse>(`${this.baseUrl}/${orderId}/seats`, body).pipe(
      catchError((error) => {
        console.warn('No se pudo añadir el asiento:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Renombra el alias (apodo) de un asiento.
   * PATCH /seats/{seatId}/alias
   */
  updateSeatAlias(seatId: string, alias: string): Observable<UpdateSeatAliasResponse> {
    const body: UpdateSeatAliasRequest = { alias };
    return this.http.patch<UpdateSeatAliasResponse>(`${this.baseUrl}/seats/${seatId}/alias`, body).pipe(
      catchError((error) => {
        console.warn('No se pudo renombrar el asiento:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Asigna artículos de la comanda a un asiento.
   * POST /{orderId}/seats/{seatId}/items
   */
  assignItemToSeat(
    orderId: string,
    seatId: string,
    itemIds: (string | number)[]
  ): Observable<AssignItemToSeatResponse> {
    const body: AssignItemToSeatRequest = { seatId, itemIds };
    return this.http.post<AssignItemToSeatResponse>(`${this.baseUrl}/${orderId}/seats/${seatId}/items`, body).pipe(
      catchError((error) => {
        console.warn('No se pudo asignar el artículo al asiento:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Liquida los asientos seleccionados de una comanda (cierre por persona).
   * POST /{orderId}/seats/settle
   */
  settleSeats(orderId: string, request: SettleSeatsRequest): Observable<SettleSeatsResponse> {
    return this.http.post<SettleSeatsResponse>(`${this.baseUrl}/${orderId}/seats/settle`, request).pipe(
      catchError((error) => {
        console.warn('No se pudieron liquidar los asientos:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Reporte general de ventas/comandas de un tenant en un rango de fechas.
   * GET /tenant/{tenantId}/report?from=&to=   → List<SalesReportRowDTO>
   */
  getSalesReport(
    tenantId: number,
    from: string,
    to: string
  ): Observable<SalesReportRow[]> {
    let params = new HttpParams()
      .set('tenantId', tenantId.toString())
      .set('from', from)
      .set('to', to);
    return this.http.get<GenericResponse<SalesReportRow[]>>(`${this.baseUrl}/tenant/${tenantId}/report`, { params }).pipe(
      map((response) => response.object || []),
      catchError((error) => {
        console.error('Error al obtener reporte de ventas:', error);
        return throwError(() => error);
      })
    );
  }
}
