import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, forkJoin } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { WaiterApiService } from './waiter-api.service';
import {
  WaiterDashboardSummaryDTO,
  VipClientDTO,
  CrossSellProductDTO
} from '../models/waiter-dashboard.models';

/**
 * WaiterDashboardFacadeService
 * Orchestrates API calls and manages dashboard state
 * Exposes Observables for component subscription
 * Follows Kitchen facade pattern from Lealtix codebase
 */
@Injectable({
  providedIn: 'root'
})
export class WaiterDashboardFacadeService {
  // State management
  private destroy$ = new Subject<void>();

  // Public data streams
  private metricsSubject = new BehaviorSubject<WaiterDashboardSummaryDTO | null>(null);
  private vipClientsSubject = new BehaviorSubject<VipClientDTO[]>([]);
  private crossSellSubject = new BehaviorSubject<CrossSellProductDTO[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);

  // Public observables
  readonly metrics$ = this.metricsSubject.asObservable();
  readonly vipClients$ = this.vipClientsSubject.asObservable();
  readonly crossSellProducts$ = this.crossSellSubject.asObservable();
  readonly loading$ = this.loadingSubject.asObservable();
  readonly error$ = this.errorSubject.asObservable();

  private currentTenantId: number | null = null;
  private currentUserId: number | null = null;

  constructor(private waiterApiService: WaiterApiService) {}

  /**
   * Load metrics by date range (matching kitchen dashboard pattern)
   * Supports 1, 3, or 7 day ranges
   * Should be called from component ngOnInit
   */
  loadMetricsByDays(tenantId: number, userId: number, days: 1 | 3 | 7 = 1): void {
    this.currentTenantId = tenantId;
    this.currentUserId = userId;

    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    const range = this.buildDateRange(days);

    // Parallel API calls using forkJoin with date range
    forkJoin([
      this.waiterApiService.getDashboardSummaryByDateRange(tenantId, userId, range.from, range.to),
      this.waiterApiService.getVipClients(tenantId, userId),
      this.waiterApiService.getCrossSellSuggestions(tenantId)
    ])
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loadingSubject.next(false))
      )
      .subscribe({
        next: ([summary, vipClients, crossSell]) => {
          this.metricsSubject.next(summary);
          this.vipClientsSubject.next(vipClients);
          this.crossSellSubject.next(crossSell);
          this.errorSubject.next(null);
        },
        error: (error) => {
          console.error('Error loading waiter dashboard:', error);
          this.errorSubject.next(
            error?.message || 'Error loading dashboard metrics'
          );
        }
      });
  }

  /**
   * Build date range for API calls
   * Calculates from/to dates based on number of days
   * Example: 1 day = today, 3 days = last 3 days, 7 days = last 7 days
   */
  private buildDateRange(days: 1 | 3 | 7): { from: string; to: string } {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 0);

    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1)); // Go back N-1 days

    return {
      from: this.formatLocalDateTime(start),
      to: this.formatLocalDateTime(end)
    };
  }

  /**
   * Format date to ISO8601 local time string (yyyy-MM-dd'T'HH:mm:ss)
   * Matches backend expected format
   */
  private formatLocalDateTime(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const hours = `${date.getHours()}`.padStart(2, '0');
    const minutes = `${date.getMinutes()}`.padStart(2, '0');
    const seconds = `${date.getSeconds()}`.padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  /**
   * Initialize dashboard - Load all metrics in parallel
   * DEPRECATED: Use loadMetricsByDays() instead
   * Kept for backward compatibility
   */
  init(tenantId: number, userId: number): void {
    this.loadMetricsByDays(tenantId, userId, 1);
  }

  /**
   * Refresh dashboard data
   * Useful after actions like creating new client
   */
  refresh(): void {
    if (this.currentTenantId && this.currentUserId) {
      this.init(this.currentTenantId, this.currentUserId);
    }
  }

  /**
   * Get current metrics synchronously (for template use)
   */
  getMetrics(): WaiterDashboardSummaryDTO | null {
    return this.metricsSubject.value;
  }

  /**
   * Get current VIP clients synchronously
   */
  getVipClients(): VipClientDTO[] {
    return this.vipClientsSubject.value;
  }

  /**
   * Get current cross-sell products synchronously
   */
  getCrossSellProducts(): CrossSellProductDTO[] {
    return this.crossSellSubject.value;
  }

  /**
   * Cleanup on component destroy
   */
  destroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
