import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { GenericResponse } from '@/models/generic-response.model';
import { environment } from '@/pages/commons/environment';
import {
    KitchenCompletedOrdersDTO,
    KitchenCustomizationAnalysisDTO,
    KitchenDashboardSummaryApiDTO,
    KitchenDashboardSummaryDTO,
    KitchenRepeatPurchaseRateDTO,
    KitchenTopDishDTO,
    KitchenVipAlertDTO
} from '../models/kitchen-dashboard.models';

@Injectable({
    providedIn: 'root'
})
export class KitchenDashboardApiService {
    private get baseUrl(): string {
        return `${environment.apiUrl.replace(/\/+$/g, '')}/dashboard/kitchen`;
    }

    constructor(private http: HttpClient) {}

    getKitchenDashboardSummary(tenantId: number, from?: string, to?: string): Observable<GenericResponse<KitchenDashboardSummaryDTO>> {
        const dateRange = this.resolveDateRange(from, to);
        const params = new HttpParams()
            .set('tenantId', String(tenantId))
            .set('from', dateRange.from)
            .set('to', dateRange.to);

        return this.http
            .get<GenericResponse<KitchenDashboardSummaryApiDTO>>(`${this.baseUrl}/summary`, { params })
            .pipe(
                map((response) => ({
                    ...response,
                    object: this.mapSummary(response.object)
                }))
            );
    }

    private mapSummary(summary: KitchenDashboardSummaryApiDTO | null | undefined): KitchenDashboardSummaryDTO {
        return {
            tenantName: summary?.tenantName || 'Tu Cocina',
            topDishes: (summary?.topDishes ?? []).map((dish) => this.mapTopDish(dish)),
            repeatPurchaseRate: this.mapRepeatPurchaseRate(summary?.repeatPurchaseRate),
            completedOrders: this.mapCompletedOrders(summary?.completedOrders),
            customizationAnalysis: (summary?.customizationAnalysis ?? []).map((item) => this.mapCustomization(item)),
            vipAlert: this.mapVipAlert(summary?.vipAlert)
        };
    }

    private mapTopDish(dish: any): KitchenTopDishDTO {
        return {
            productId: this.toNumber(dish?.productId),
            productName: dish?.productName || 'Producto',
            quantity: this.toNumber(dish?.quantity),
            totalSales: this.toNumber(dish?.totalSales),
            rank: this.toNumber(dish?.rank)
        };
    }

    private mapRepeatPurchaseRate(dto: any): KitchenRepeatPurchaseRateDTO {
        return {
            totalCustomers: this.toNumber(dto?.totalCustomers),
            repeatCustomers: this.toNumber(dto?.repeatCustomers),
            repeatRate: this.toNumber(dto?.repeatRate),
            oneTimeBuyers: this.toNumber(dto?.oneTimeBuyers),
            multiTimeBuyers: this.toNumber(dto?.multiTimeBuyers)
        };
    }

    private mapCompletedOrders(dto: any): KitchenCompletedOrdersDTO {
        return {
            completedOrders: this.toNumber(dto?.completedOrders),
            successfulDeliveries: this.toNumber(dto?.successfulDeliveries)
        };
    }

    private mapCustomization(dto: any): KitchenCustomizationAnalysisDTO {
        return {
            keyword: dto?.keyword || '',
            frequency: this.toNumber(dto?.frequency),
            percentage: this.toNumber(dto?.percentage)
        };
    }

    private mapVipAlert(dto: any): KitchenVipAlertDTO | null {
        if (!dto) {
            return null;
        }

        return {
            active: Boolean(dto.active),
            customerId: this.toNumber(dto.customerId),
            customerName: dto.customerName || '',
            customerEmail: dto.customerEmail || '',
            lifetimeValue: this.toNumber(dto.lifetimeValue),
            note: dto.note || ''
        };
    }

    private resolveDateRange(from?: string, to?: string): { from: string; to: string } {
        if (from && to) {
            return { from, to };
        }

        const now = new Date();
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);

        const end = new Date(now);
        end.setHours(23, 59, 59, 0);

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

    private toNumber(value: unknown): number {
        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : 0;
        }

        if (typeof value === 'string') {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : 0;
        }

        return 0;
    }
}
