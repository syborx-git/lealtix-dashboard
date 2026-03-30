import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  WaiterDashboardSummaryDTO,
  VipClientDTO,
  CrossSellProductDTO,
  WaiterDashboardResponse
} from '../models/waiter-dashboard.models';

/**
 * WaiterApiService
 * Handles all HTTP calls for waiter dashboard feature
 * Follows Lealtix API service pattern with base URL resolution
 */
@Injectable({
  providedIn: 'root'
})
export class WaiterApiService {
  constructor(private http: HttpClient) {}

  /**
   * Get base API URL from environment or window object
   * Pattern: matches existing DashboardService implementation
   */
  private getApiBaseUrl(): string {
    return (window as any)['APP_CONFIG']?.apiBaseUrl || 'http://localhost:8080/api';
  }

  /**
   * Base endpoint for waiter dashboard
   */
  private get base(): string {
    return `${this.getApiBaseUrl()}/dashboard/waiter`;
  }

  /**
   * Helper to build common params (tenantId, userId)
   */
  private params(tenantId: number, userId: number): HttpParams {
    return new HttpParams()
      .set('tenantId', tenantId.toString())
      .set('userId', userId.toString());
  }

  /**
   * Get consolidated dashboard summary
   * Includes identified sales %, new clients, orders, repurchase rate
   */
  getDashboardSummary(
    tenantId: number,
    userId: number
  ): Observable<WaiterDashboardSummaryDTO> {
    return this.http
      .get<WaiterDashboardSummaryDTO>(`${this.base}/summary`, {
        params: this.params(tenantId, userId)
      })
      .pipe(
        catchError((error) => {
          console.error('Error fetching waiter dashboard summary:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get dashboard summary by date range
   * NEW: Supports 1, 3, 7 day ranges with from/to date filtering
   * Format: yyyy-MM-dd'T'HH:mm:ss
   */
  getDashboardSummaryByDateRange(
    tenantId: number,
    userId: number,
    from: string,
    to: string
  ): Observable<WaiterDashboardSummaryDTO> {
    return this.http
      .get<WaiterDashboardSummaryDTO>(`${this.base}/summary/by-date-range`, {
        params: this.params(tenantId, userId)
          .set('from', from)
          .set('to', to)
      })
      .pipe(
        catchError((error) => {
          console.error('Error fetching waiter dashboard summary by date range:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get VIP clients - Top 5 by LTV not visited recently
   */
  getVipClients(
    tenantId: number,
    userId: number,
    limit: number = 5
  ): Observable<VipClientDTO[]> {
    return this.http
      .get<VipClientDTO[]>(`${this.base}/vip-clients`, {
        params: this.params(tenantId, userId).set('limit', limit.toString())
      })
      .pipe(
        catchError((error) => {
          console.error('Error fetching VIP clients:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get cross-sell product suggestions
   * Returns top suggested products for the day
   */
  getCrossSellSuggestions(
    tenantId: number,
    limit: number = 10
  ): Observable<CrossSellProductDTO[]> {
    return this.http
      .get<CrossSellProductDTO[]>(`${this.base}/cross-sell`, {
        params: new HttpParams()
          .set('tenantId', tenantId.toString())
          .set('limit', limit.toString())
      })
      .pipe(
        catchError((error) => {
          console.error('Error fetching cross-sell suggestions:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get complete waiter dashboard (convenience method)
   * Calls all three endpoints and aggregates response
   * Backend should implement this or frontend uses facade pattern
   */
  getCompleteDashboard(
    tenantId: number,
    userId: number
  ): Observable<WaiterDashboardResponse> {
    return this.http
      .get<WaiterDashboardResponse>(`${this.base}/complete`, {
        params: this.params(tenantId, userId)
      })
      .pipe(
        catchError((error) => {
          console.error('Error fetching complete waiter dashboard:', error);
          return throwError(() => error);
        })
      );
  }
}
