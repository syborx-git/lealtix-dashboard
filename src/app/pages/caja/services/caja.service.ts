import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@/pages/commons/environment';
import {
  TurnoDTO,
  AbrirTurnoRequest,
  CerrarTurnoRequest,
  CobrarComandaRequest,
  LiquidarPropinasRequest,
  TableroCaja,
  TicketPrecuenta,
  ResumenTurnoCorte,
  PagoDTO,
  CorteMesero,
  MeseroSimple
} from '../models/caja.model';

export interface ApiResponse<T> {
  code: number;
  message: string;
  object?: T;
  data?: T;
}

@Injectable({
  providedIn: 'root'
})
export class CajaService {
  private readonly baseUrl = `${environment.apiUrl}/caja`;

  constructor(private http: HttpClient) {}

  getTurnoActivo(tenantId: number, cajeroId?: number): Observable<ApiResponse<TurnoDTO>> {
    let params = new HttpParams().set('tenantId', tenantId.toString());
    if (cajeroId) {
      params = params.set('cajeroId', cajeroId.toString());
    }
    return this.http.get<ApiResponse<TurnoDTO>>(`${this.baseUrl}/turno-activo`, { params });
  }

  abrirTurno(req: AbrirTurnoRequest): Observable<ApiResponse<TurnoDTO>> {
    return this.http.post<ApiResponse<TurnoDTO>>(`${this.baseUrl}/turnos/abrir`, req);
  }

  cerrarTurno(req: CerrarTurnoRequest): Observable<ApiResponse<TurnoDTO>> {
    return this.http.post<ApiResponse<TurnoDTO>>(`${this.baseUrl}/turnos/cerrar`, req);
  }

  getTablero(tenantId: number): Observable<ApiResponse<TableroCaja>> {
    const params = new HttpParams().set('tenantId', tenantId.toString());
    return this.http.get<ApiResponse<TableroCaja>>(`${this.baseUrl}/tablero`, { params });
  }

  imprimirTicket(orderId: string, tenantId: number): Observable<ApiResponse<TicketPrecuenta>> {
    const params = new HttpParams().set('tenantId', tenantId.toString());
    return this.http.post<ApiResponse<TicketPrecuenta>>(`${this.baseUrl}/comandas/${orderId}/imprimir-ticket`, {}, { params });
  }

  cobrarComanda(orderId: string, req: CobrarComandaRequest): Observable<ApiResponse<PagoDTO>> {
    return this.http.post<ApiResponse<PagoDTO>>(`${this.baseUrl}/comandas/${orderId}/pagar`, req);
  }

  getResumenTurno(idTurno: number, tenantId: number, fecha?: string): Observable<ApiResponse<ResumenTurnoCorte>> {
    let params = new HttpParams().set('tenantId', tenantId.toString());
    if (fecha) {
      params = params.set('fecha', fecha);
    }
    return this.http.get<ApiResponse<ResumenTurnoCorte>>(`${this.baseUrl}/turnos/${idTurno}/resumen`, { params });
  }

  /**
   * Corte / rendimiento de un mesero.
   * @param fecha cuando se envia, el corte se acota a ese dia (formato yyyy-MM-dd).
   */
  getCorteMesero(idMesero: number, tenantId: number, idTurno?: number, fecha?: string): Observable<ApiResponse<CorteMesero>> {
    let params = new HttpParams().set('tenantId', tenantId.toString());
    if (idTurno) {
      params = params.set('idTurno', idTurno.toString());
    }
    if (fecha) {
      params = params.set('fecha', fecha);
    }
    return this.http.get<ApiResponse<CorteMesero>>(`${this.baseUrl}/cortes/mesero/${idMesero}`, { params });
  }

  liquidarPropinas(req: LiquidarPropinasRequest): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/propinas/liquidar`, req);
  }

  getMeseros(tenantId: number): Observable<ApiResponse<MeseroSimple[]>> {
    const params = new HttpParams().set('tenantId', tenantId.toString());
    return this.http.get<ApiResponse<MeseroSimple[]>>(`${this.baseUrl}/meseros`, { params });
  }
}
