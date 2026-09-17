import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@/pages/commons/environment';

interface StockRequestPayload {
  tenantId: number;
  insumoId?: number;
  insumoNombre?: string;
  area: string;
  cantidad: number;
  prioridad: string;
}

@Injectable({ providedIn: 'root' })
export class StockRequestService {
  private baseUrl = `${environment.apiUrl}/stock-requests`;

  constructor(private http: HttpClient) {}

  crear(request: StockRequestPayload): Observable<any> {
    return this.http.post<any>(this.baseUrl, request);
  }

  listarPorTenant(tenantId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/tenant/${tenantId}`);
  }

  contarPendientes(tenantId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/pendientes/tenant/${tenantId}`);
  }

  listarPendientes(tenantId: number, area: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/pendientes/lista/tenant/${tenantId}?area=${area}`);
  }

  aceptar(id: number, tenantId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${id}/aceptar?tenantId=${tenantId}`, null);
  }
}