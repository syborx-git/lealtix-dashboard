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

export interface AuditoriaMermasDTO {
  meta: ReporteMetaDTO;
  kpis: KpiDTO[];
  porMotivo: TablaReporteDTO;
  porResponsable: TablaReporteDTO;
  porInsumo: TablaReporteDTO;
  detalle: TablaReporteDTO;
}

export interface StockMinimoReporteDTO {
  meta: ReporteMetaDTO;
  kpis: KpiDTO[];
  alertas: TablaReporteDTO;
  listaCompras: TablaReporteDTO;
  inventarioGeneral: TablaReporteDTO;
}

export interface AuditoriaTicketsCanceladosDTO {
  meta: ReporteMetaDTO;
  kpis: KpiDTO[];
  porMotivo: TablaReporteDTO;
  porResponsable: TablaReporteDTO;
  detalle: TablaReporteDTO;
}

export interface AuditoriaCortesDiariosDTO {
  meta: ReporteMetaDTO;
  kpis: KpiDTO[];
  porMetodo: TablaReporteDTO;
  distribucion: TablaReporteDTO;
  detalle: TablaReporteDTO;
  listaCortes: any[];
}

export interface ChartPuntoDTO {
  label?: string;
  etiqueta?: string;
  valor: number;
  valorMoneda?: number;
  unidad?: string;
  categoria?: string;
  area?: string;
  subtexto?: string;
}

export interface CorteInsumosDTO {
  meta: ReporteMetaDTO;
  kpis: KpiDTO[];
  areaFiltro: string;
  platillosVendidos: TablaReporteDTO;
  insumosConsumidos: TablaReporteDTO;
  stockDisponible: TablaReporteDTO;
  topPlatillos: ChartPuntoDTO[];
  topInsumos: ChartPuntoDTO[];
}

export interface CuadranteResumenDTO {
  cuadrante: string;
  etiqueta: string;
  icono: string;
  color: string;
  cantidadPlatillos: number;
  unidadesVendidas: number;
  ingresosTotales: number;
  margenTotal: number;
  porcentajeVentas: number;
  porcentajeMargen: number;
  estrategia: string;
}

export interface PuntoMatrizDTO {
  productoId: number;
  nombre: string;
  categoria: string;
  cuadrante: string;
  volumenX: number;
  margenY: number;
  precio: number;
  costo: number;
  margenPct: number;
  unidadesVendidas: number;
  ingresosTotales: number;
  margenTotal: number;
}

export interface IngenieriaMenuDTO {
  meta: ReporteMetaDTO;
  kpis: KpiDTO[];
  umbralPopularidad: number;
  umbralMargen: number;
  resumenCuadrantes: Record<string, CuadranteResumenDTO>;
  matrizProductos: TablaReporteDTO;
  puntosGrafica: PuntoMatrizDTO[];
}

export interface KardexReporteDTO {
  meta: ReporteMetaDTO;
  kpis: KpiDTO[];
  resumenInsumos: TablaReporteDTO;
  movimientosDetalle: TablaReporteDTO;
  transferenciasAreas?: TablaReporteDTO;
  distribucionMovimientos: ChartPuntoDTO[];
  topInsumosRotacion: ChartPuntoDTO[];
}

export interface RfmReporteDTO {
  meta: ReporteMetaDTO;
  kpis: KpiDTO[];
  resumenSegmentos: TablaReporteDTO;
  clientesDetalle: TablaReporteDTO;
  distribucionSegmentos: ChartPuntoDTO[];
  ingresosPorSegmento: ChartPuntoDTO[];
}

export interface CampanasReporteDTO {
  meta: ReporteMetaDTO;
  kpis: KpiDTO[];
  resumenCampanas: TablaReporteDTO;
  cuponesCanjeados: TablaReporteDTO;
  canjesPorCampana: ChartPuntoDTO[];
  comparativaDescuentoVenta: ChartPuntoDTO[];
}

export interface TiemposServicioReporteDTO {
  meta: ReporteMetaDTO;
  kpis: KpiDTO[];
  tiemposPorEstacion: TablaReporteDTO;
  detalleComandas: TablaReporteDTO;
  distribucionRangos: ChartPuntoDTO[];
  promedioPorEstacion: ChartPuntoDTO[];
}

export interface RendimientoMeseroReporteDTO {
  meta: ReporteMetaDTO;
  kpis: KpiDTO[];
  tablaMeseros: TablaReporteDTO;
  desgloseMetodosPago: TablaReporteDTO;
  ventasPorMesero: ChartPuntoDTO[];
  ticketsPorMesero: ChartPuntoDTO[];
}

export interface MapaCalorReporteDTO {
  meta: ReporteMetaDTO;
  kpis: KpiDTO[];
  matrizAfluencia: TablaReporteDTO;
  desglosePorHora: TablaReporteDTO;
  afluenciaPorHora: ChartPuntoDTO[];
  afluenciaPorDia: ChartPuntoDTO[];
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
  area?: string;
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

  /** Reporte 2.3: Auditoria de mermas por motivo, responsable e insumos mermados. */
  obtenerMermas(tenantId: number, params: ReportesParams): Observable<GenericResponse<AuditoriaMermasDTO>> {
    return this.http.get<GenericResponse<AuditoriaMermasDTO>>(`${this.baseUrl}/mermas`, {
      params: this.construirParams(tenantId, params),
    });
  }

  /** Reporte 2.3 en .xlsx real con desglose por motivo, responsable y detalle cronologico. */
  exportarMermas(tenantId: number, params: ReportesParams): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/mermas/export`, {
      params: this.construirParams(tenantId, params),
      responseType: 'blob',
    });
  }

  /** Reporte 2.4: Alertas de stock minimo, critico y sugerencia de compra. */
  obtenerStockMinimo(tenantId: number): Observable<GenericResponse<StockMinimoReporteDTO>> {
    const params = new HttpParams().set('tenantId', String(tenantId));
    return this.http.get<GenericResponse<StockMinimoReporteDTO>>(`${this.baseUrl}/stock-minimo`, { params });
  }

  /** Reporte 2.4 en .xlsx real con lista de compras y auditoria de inventario. */
  exportarStockMinimo(tenantId: number): Observable<Blob> {
    const params = new HttpParams().set('tenantId', String(tenantId));
    return this.http.get(`${this.baseUrl}/stock-minimo/export`, {
      params,
      responseType: 'blob',
    });
  }

  /** Reporte Auditoría: Auditoria de tickets cancelados por motivo, responsable y detalle. */
  obtenerTicketsCancelados(
    tenantId: number,
    params: ReportesParams
  ): Observable<GenericResponse<AuditoriaTicketsCanceladosDTO>> {
    return this.http.get<GenericResponse<AuditoriaTicketsCanceladosDTO>>(`${this.baseUrl}/tickets-cancelados`, {
      params: this.construirParams(tenantId, params),
    });
  }

  /** Reporte Auditoría: Exportación en Excel (.xlsx) con desglose y detalle cronológico. */
  exportarTicketsCancelados(tenantId: number, params: ReportesParams): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/tickets-cancelados/export`, {
      params: this.construirParams(tenantId, params),
      responseType: 'blob',
    });
  }

  /** Reporte 4.2: Auditoria de Cortes del Dia - comparativa teorico vs fisico */
  obtenerCortesDiarios(
    tenantId: number,
    params: ReportesParams
  ): Observable<GenericResponse<AuditoriaCortesDiariosDTO>> {
    return this.http.get<GenericResponse<AuditoriaCortesDiariosDTO>>(`${this.baseUrl}/cortes-diarios`, {
      params: this.construirParams(tenantId, params),
    });
  }

  /** Reporte 4.2 en .xlsx real con desglose por metodo, distribucion y detalle cronologico. */
  exportarCortesDiarios(tenantId: number, params: ReportesParams): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/cortes-diarios/export`, {
      params: this.construirParams(tenantId, params),
      responseType: 'blob',
    });
  }

  /** Reporte 2.1: Corte Diario de Insumos (Cocina / Barra) */
  obtenerCorteInsumos(
    tenantId: number,
    params: ReportesParams
  ): Observable<GenericResponse<CorteInsumosDTO>> {
    return this.http.get<GenericResponse<CorteInsumosDTO>>(`${this.baseUrl}/corte-insumos`, {
      params: this.construirParams(tenantId, params),
    });
  }

  exportarCorteInsumos(tenantId: number, params: ReportesParams): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/corte-insumos/export`, {
      params: this.construirParams(tenantId, params),
      responseType: 'blob',
    });
  }

  /** Reporte 2.2: Matriz de Ingeniería del Menú (Kasavana & Smith) */
  obtenerIngenieriaMenu(
    tenantId: number,
    params: ReportesParams
  ): Observable<GenericResponse<IngenieriaMenuDTO>> {
    return this.http.get<GenericResponse<IngenieriaMenuDTO>>(`${this.baseUrl}/ingenieria-menu`, {
      params: this.construirParams(tenantId, params),
    });
  }

  exportarIngenieriaMenu(tenantId: number, params: ReportesParams): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/ingenieria-menu/export`, {
      params: this.construirParams(tenantId, params),
      responseType: 'blob',
    });
  }

  /** Reporte 2.2: Kardex de Insumos */
  obtenerKardex(
    tenantId: number,
    params: ReportesParams
  ): Observable<GenericResponse<KardexReporteDTO>> {
    return this.http.get<GenericResponse<KardexReporteDTO>>(`${this.baseUrl}/kardex`, {
      params: this.construirParams(tenantId, params),
    });
  }

  exportarKardex(tenantId: number, params: ReportesParams): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/kardex/export`, {
      params: this.construirParams(tenantId, params),
      responseType: 'blob',
    });
  }

  /** Reporte 3.1: Análisis RFM de Clientes */
  obtenerRfm(
    tenantId: number,
    params: ReportesParams
  ): Observable<GenericResponse<RfmReporteDTO>> {
    return this.http.get<GenericResponse<RfmReporteDTO>>(`${this.baseUrl}/rfm`, {
      params: this.construirParams(tenantId, params),
    });
  }

  exportarRfm(tenantId: number, params: ReportesParams): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/rfm/export`, {
      params: this.construirParams(tenantId, params),
      responseType: 'blob',
    });
  }

  /** Reporte 3.2: Rendimiento de Campañas y Cupones */
  obtenerCampanas(
    tenantId: number,
    params: ReportesParams
  ): Observable<GenericResponse<CampanasReporteDTO>> {
    return this.http.get<GenericResponse<CampanasReporteDTO>>(`${this.baseUrl}/campanas`, {
      params: this.construirParams(tenantId, params),
    });
  }

  exportarCampanas(tenantId: number, params: ReportesParams): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/campanas/export`, {
      params: this.construirParams(tenantId, params),
      responseType: 'blob',
    });
  }

  /** Reporte 4.3: Tiempos de Servicio y Preparación */
  obtenerTiemposServicio(
    tenantId: number,
    params: ReportesParams
  ): Observable<GenericResponse<TiemposServicioReporteDTO>> {
    return this.http.get<GenericResponse<TiemposServicioReporteDTO>>(`${this.baseUrl}/tiempos`, {
      params: this.construirParams(tenantId, params),
    });
  }

  exportarTiemposServicio(tenantId: number, params: ReportesParams): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/tiempos/export`, {
      params: this.construirParams(tenantId, params),
      responseType: 'blob',
    });
  }

  /** Reporte 4.4: Rendimiento por Mesero */
  obtenerRendimientoMeseros(
    tenantId: number,
    params: ReportesParams
  ): Observable<GenericResponse<RendimientoMeseroReporteDTO>> {
    return this.http.get<GenericResponse<RendimientoMeseroReporteDTO>>(`${this.baseUrl}/meseros`, {
      params: this.construirParams(tenantId, params),
    });
  }

  exportarRendimientoMeseros(tenantId: number, params: ReportesParams): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/meseros/export`, {
      params: this.construirParams(tenantId, params),
      responseType: 'blob',
    });
  }

  /** Reporte 4.5: Mapa de Calor de Afluencia */
  obtenerMapaCalor(
    tenantId: number,
    params: ReportesParams
  ): Observable<GenericResponse<MapaCalorReporteDTO>> {
    return this.http.get<GenericResponse<MapaCalorReporteDTO>>(`${this.baseUrl}/mapa-calor`, {
      params: this.construirParams(tenantId, params),
    });
  }

  exportarMapaCalor(tenantId: number, params: ReportesParams): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/mapa-calor/export`, {
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
    if (params.area) {
      httpParams = httpParams.set('area', params.area);
    }
    return httpParams;
  }
}
