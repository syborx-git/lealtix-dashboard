import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@/pages/commons/environment';

// ==================== CONTRATO COMPARTIDO CON EL BACKEND ====================
// Debe coincidir con los records de com.lealtixservice.dto.reportes

export type PresetReporte =
  | 'HOY'
  | 'AYER'
  | 'ESTA_SEMANA'
  | 'SEMANA_PASADA'
  | 'ESTE_MES'
  | 'MES_PASADO'
  | 'PERSONALIZADO';

export type Granularidad = 'day' | 'week' | 'month';

export type FormatoKpi = 'moneda' | 'numero';

export interface RangoDTO {
  from: string;
  to: string;
  etiqueta: string;
}

export interface ReporteMetaDTO {
  reporteKey: string;
  pilar: string;
  nombre: string;
  preset: PresetReporte;
  rangoActual: RangoDTO;
  rangoAnterior: RangoDTO;
  granularidad: string;
  generadoEn: string;
}

export interface KpiDTO {
  key: string;
  label: string;
  actual: number;
  anterior: number;
  variacionPct: number | null;
  direccion: 'SUBE' | 'BAJA' | 'IGUAL' | 'NUEVO';
  formato: FormatoKpi;
}

export interface SeriePuntoDTO {
  etiqueta: string;
  periodoIso: string;
  valor: number;
  valorAnterior: number;
  ordenes?: number;
  bruto?: number;
}

export type TipoColumna = 'TEXTO' | 'MONEDA' | 'NUMERO' | 'PORCENTAJE' | 'FECHA';

export interface ColumnaDTO {
  key: string;
  label: string;
  tipo: TipoColumna;
  ancho: number | null;
}

export interface TablaReporteDTO {
  columnas: ColumnaDTO[];
  filas: Record<string, any>[];
}

export interface VentasTendenciasDTO {
  meta: ReporteMetaDTO;
  kpis: KpiDTO[];
  serie: SeriePuntoDTO[];
  porCategoria: TablaReporteDTO;
  topProductos: TablaReporteDTO;
}

export interface CorteCajaDTO {
  meta: ReporteMetaDTO;
  kpis: KpiDTO[];
  porMetodo: TablaReporteDTO;
  porCajero: TablaReporteDTO;
  anulaciones: TablaReporteDTO;
}

export interface GenericResponse<T> {
  code: number;
  message: string;
  object: T;
}

export interface ReportesParams {
  preset: PresetReporte;
  from?: string;
  to?: string;
  granularidad?: string;
}

@Injectable({ providedIn: 'root' })
export class ReportesService {
  private baseUrl = `${environment.apiUrl}/reportes`;

  constructor(private http: HttpClient) {}

  /** Reporte 1.1 en JSON: KPIs con comparativa, serie temporal y tablas. */
  obtenerVentasTendencias(
    tenantId: number,
    params: ReportesParams
  ): Observable<GenericResponse<VentasTendenciasDTO>> {
    return this.http.get<GenericResponse<VentasTendenciasDTO>>(`${this.baseUrl}/ventas`, {
      params: this.construirParams(tenantId, params),
    });
  }

  /** Reporte 1.1 en .xlsx real generado por Apache POI en el backend. */
  exportarVentasTendencias(tenantId: number, params: ReportesParams): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/ventas/export`, {
      params: this.construirParams(tenantId, params),
      responseType: 'blob',
    });
  }

  /** Reporte 1.2: total cobrado, desglose por metodo, conciliacion por cajero y anulaciones. */
  obtenerCorteCaja(tenantId: number, params: ReportesParams): Observable<GenericResponse<CorteCajaDTO>> {
    return this.http.get<GenericResponse<CorteCajaDTO>>(`${this.baseUrl}/corte-caja`, {
      params: this.construirParams(tenantId, params),
    });
  }

  /** Reporte 1.2 en .xlsx real generado por Apache POI en el backend. */
  exportarCorteCaja(tenantId: number, params: ReportesParams): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/corte-caja/export`, {
      params: this.construirParams(tenantId, params),
      responseType: 'blob',
    });
  }

  private construirParams(tenantId: number, params: ReportesParams): HttpParams {
    let httpParams = new HttpParams().set('tenantId', String(tenantId)).set('preset', params.preset);

    if (params.from) {
      httpParams = httpParams.set('from', params.from);
    }
    if (params.to) {
      httpParams = httpParams.set('to', params.to);
    }
    if (params.granularidad) {
      httpParams = httpParams.set('granularidad', params.granularidad);
    }
    return httpParams;
  }
}
