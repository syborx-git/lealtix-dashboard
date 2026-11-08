import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@/pages/commons/environment';

/**
 * Cliente de PRUEBAS para Mercado Pago Point (solo local).
 * No forma parte del flujo de producción.
 */
@Injectable({ providedIn: 'root' })
export class MpPointTestService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/v1/test/mp-point`;

  charge(amount: number): Observable<any> {
    return this.http.post(`${this.base}/charge`, { amount });
  }

  getIntent(id: string): Observable<any> {
    return this.http.get(`${this.base}/payment-intent/${id}`);
  }

  cancelIntent(id: string): Observable<any> {
    return this.http.delete(`${this.base}/payment-intent/${id}`);
  }
}
