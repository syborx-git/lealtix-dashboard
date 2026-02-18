import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { TenantClientOrderCreateRequest, TenantClientOrderResponse } from '../models/order.model';
import { environment } from '@/pages/commons/environment';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private readonly baseUrl = `${environment.apiUrl}/tenant-client-orders`;

  constructor(private http: HttpClient) {}

  /**
   * Crea una nueva orden de cliente
   * @param order Datos de la orden a crear
   * @returns Observable con la respuesta de la orden creada
   */
  createOrder(order: TenantClientOrderCreateRequest): Observable<TenantClientOrderResponse> {
    return this.http.post<TenantClientOrderResponse>(this.baseUrl, order).pipe(
      catchError((error) => {
        console.error('Error al crear orden:', error);
        return throwError(() => error);
      })
    );
  }
}
