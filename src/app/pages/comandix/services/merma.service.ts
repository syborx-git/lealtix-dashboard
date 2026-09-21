import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@/pages/commons/environment';

export interface InsumoUsado {
  insumoId?: number | null;
  insumoNombre?: string | null;
  productoId?: number | null;
  productoNombre?: string | null;
  cantidad: number;
  unidad?: string | null;
  costoUnitario?: number;
  costoTotal?: number;
}

export interface MermaItem {
  insumoId?: number | null;
  insumoNombre?: string | null;
  productoId?: number | null;
  productoNombre?: string | null;
  cantidad: number;
  unidad?: string | null;
}

export interface MermaRecord {
  id?: number;
  tenantId?: number;
  ticket?: string;
  orderId?: string | null;
  registroId?: string;
  tipoMerma?: string;
  categoriaMerma?: string;
  origen?: string;
  motivo?: string;
  usuarioId?: number | null;
  usuarioNombre?: string | null;
  insumoId?: number | null;
  insumoNombre?: string | null;
  productoId?: number | null;
  productoNombre?: string | null;
  cantidad?: number;
  unidad?: string;
  costoUnitario?: number;
  costoTotal?: number;
  fecha?: string;
}

export const TIPOS_MERMA = [
  { codigo: 'OPERATIVA', label: 'Operativa' },
  { codigo: 'ROTURA', label: 'Rotura / desperfecto' },
  { codigo: 'CADUCIDAD', label: 'Caducidad / vencido' },
  { codigo: 'SOBRANTE', label: 'Sobrante' },
  { codigo: 'CONTROL_CALIDAD', label: 'Control de calidad' }
];

@Injectable({ providedIn: 'root' })
export class MermaService {
  private baseUrl = `${environment.apiUrl}/mermas`;

  constructor(private http: HttpClient) {}

  resolverInsumosUsados(orderId: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/order/${orderId}/insumos-usados`);
  }

  registrarMerma(request: {
    tenantId: number;
    orderId: string;
    tipoMerma?: string;
    usuarioId?: number;
    usuarioNombre?: string;
    items: MermaItem[];
  }): Observable<any> {
    return this.http.post<any>(this.baseUrl, request);
  }

  registrarMermaAdministrativa(request: {
    tenantId: number;
    origen: string;
    motivo: string;
    tipoMerma?: string;
    usuarioId?: number;
    usuarioNombre?: string;
    items: MermaItem[];
  }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/administrativa`, request);
  }

  listarPorTenant(tenantId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/tenant/${tenantId}`);
  }
}