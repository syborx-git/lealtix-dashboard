import { Injectable, computed, signal } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { KitchenDashboardApiService } from './kitchen-dashboard-api.service';
import {
    KitchenCompletedOrdersDTO,
    KitchenCustomizationAnalysisDTO,
    KitchenRepeatPurchaseRateDTO,
    KitchenTopDishDTO,
    KitchenVipAlertDTO
} from '../models/kitchen-dashboard.models';

@Injectable({
    providedIn: 'root'
})
export class KitchenDashboardFacadeService {
    readonly loading = signal<boolean>(false);
    readonly error = signal<string | null>(null);

    readonly tenantName = signal<string>('Tu Cocina');
    readonly topDishes = signal<KitchenTopDishDTO[]>([]);
    readonly repeatPurchaseRate = signal<KitchenRepeatPurchaseRateDTO | null>(null);
    readonly completedOrders = signal<KitchenCompletedOrdersDTO | null>(null);
    readonly trendKeywords = signal<KitchenCustomizationAnalysisDTO[]>([]);
    readonly vipAlert = signal<KitchenVipAlertDTO | null>(null);

    readonly repeatRateText = computed(() => {
        const repeatRate = this.repeatPurchaseRate()?.repeatRate ?? 0;
        return `Hoy cocinas para un ${repeatRate.toFixed(1)}% de clientes que vuelven por tu sazon`;
    });

    readonly topThreeDishes = computed(() => this.topDishes().slice(0, 3));

    constructor(private kitchenDashboardApiService: KitchenDashboardApiService) {}

    loadMetricsByDays(tenantId: number, days: 1 | 3 | 7 = 1): void {
        this.loading.set(true);
        this.error.set(null);
        const range = this.buildDateRange(days);

        this.kitchenDashboardApiService
            .getKitchenDashboardSummary(tenantId, range.from, range.to)
            .pipe(finalize(() => this.loading.set(false)))
            .subscribe({
                next: (response) => {
                    if (response?.code !== 200 || !response.object) {
                        this.error.set(response?.message || 'No se pudieron cargar metricas de cocina');
                        return;
                    }

                    const data = response.object;
                    this.tenantName.set((data.tenantName || 'Tu Cocina').trim() || 'Tu Cocina');
                    this.topDishes.set(data.topDishes ?? []);
                    this.repeatPurchaseRate.set(data.repeatPurchaseRate ?? null);
                    this.completedOrders.set(data.completedOrders ?? null);
                    this.trendKeywords.set(data.customizationAnalysis ?? []);
                    this.vipAlert.set(data.vipAlert ?? null);
                },
                error: () => {
                    this.error.set('Error al cargar dashboard de cocina');
                }
            });
    }

    private buildDateRange(days: 1 | 3 | 7): { from: string; to: string } {
        const now = new Date();
        const end = new Date(now);
        end.setHours(23, 59, 59, 0);

        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - (days - 1));

        return {
            from: this.formatLocalDateTime(start),
            to: this.formatLocalDateTime(end)
        };
    }

    private formatLocalDateTime(date: Date): string {
        const year = date.getFullYear();
        const month = `${date.getMonth() + 1}`.padStart(2, '0');
        const day = `${date.getDate()}`.padStart(2, '0');
        const hours = `${date.getHours()}`.padStart(2, '0');
        const minutes = `${date.getMinutes()}`.padStart(2, '0');
        const seconds = `${date.getSeconds()}`.padStart(2, '0');

        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    }
}
