import { Injectable } from '@angular/core';
import { environment } from '@/pages/commons/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import {
  TimeSeriesCountDTO,
  CouponStatsDTO,
  SalesSummaryDTO,
  SalesByPeriodDTO,
  TopProductDTO,
  SalesByCategoryDTO,
  CampaignPerformanceDTO
} from './dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private get base(): string {
    return `${this.getApiBaseUrl().replace(/\/+$/g, '')}/dashboard`;
  }

  constructor(private http: HttpClient) {}

  private getApiBaseUrl(): string {
    const cfg = environment as { apiUrl?: string };

    if (cfg.apiUrl && cfg.apiUrl.trim() !== '') {
      return cfg.apiUrl.replace(/\/+$/g, '');
    }

    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return `${window.location.origin}/api`;
    }

    return 'https://lealtix-service.onrender.com/api';
  }

  private params(tenantId: number, from: string, to: string): HttpParams {
    return new HttpParams()
      .set('tenantId', String(tenantId))
      .set('from', from)
      .set('to', to);
  }

  totalClientes(tenantId: number, from: string, to: string): Observable<number> {
    return this.http
      .get<number>(`${this.base}/customers/total`, { params: this.params(tenantId, from, to) })
      .pipe(catchError((e) => throwError(() => e)));
  }

  clientesNuevosPorPeriodo(tenantId: number, from: string, to: string): Observable<TimeSeriesCountDTO[]> {
    const params = this.params(tenantId, from, to).set('period', 'week');
    return this.http
      .get<TimeSeriesCountDTO[]>(`${this.base}/customers/new-by-period`, { params })
      .pipe(catchError((e) => throwError(() => e)));
  }

  statsCupones(tenantId: number, from: string, to: string): Observable<CouponStatsDTO[]> {
    return this.http
      .get<CouponStatsDTO[]>(`${this.base}/coupons/stats`, { params: this.params(tenantId, from, to) })
      .pipe(catchError((e) => throwError(() => e)));
  }

  resumenVentas(tenantId: number, from: string, to: string): Observable<SalesSummaryDTO> {
    return this.http
      .get<SalesSummaryDTO>(`${this.base}/sales/summary`, { params: this.params(tenantId, from, to) })
      .pipe(catchError((e) => throwError(() => e)));
  }

  ventasPorPeriodo(tenantId: number, period: string, from: string, to: string): Observable<SalesByPeriodDTO[]> {
    return this.http
      .get<SalesByPeriodDTO[]>(`${this.base}/sales/by-period`, { params: this.params(tenantId, from, to).set('period', period) })
      .pipe(catchError((e) => throwError(() => e)));
  }

  topProductos(tenantId: number, from: string, to: string): Observable<TopProductDTO[]> {
    return this.http
      .get<TopProductDTO[]>(`${this.base}/sales/top-products`, { params: this.params(tenantId, from, to) })
      .pipe(catchError((e) => throwError(() => e)));
  }

  ventasPorCategoria(tenantId: number, from: string, to: string): Observable<SalesByCategoryDTO[]> {
    return this.http
      .get<SalesByCategoryDTO[]>(`${this.base}/sales/by-category`, { params: this.params(tenantId, from, to) })
      .pipe(catchError((e) => throwError(() => e)));
  }

  rendimientoCampanas(tenantId: number, from: string, to: string): Observable<CampaignPerformanceDTO[]> {
    return this.http
      .get<CampaignPerformanceDTO[]>(`${this.base}/campaigns/performance`, { params: this.params(tenantId, from, to) })
      .pipe(catchError((e) => throwError(() => e)));
  }

  ventasTickets(tenantId: number, size: number = 200): Observable<any> {
    const params = new HttpParams()
      .set('page', '0')
      .set('size', String(size));
    const url = `${this.getApiBaseUrl().replace(/\/+$/g, '')}/tenant-client-orders/tenant/${tenantId}`;
    return this.http
      .get<any>(url, { params })
      .pipe(catchError((e) => throwError(() => e)));
  }
}
