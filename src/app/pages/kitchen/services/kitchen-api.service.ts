import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { environment } from '@/pages/commons/environment';

export type KitchenTransitionAction = 'start' | 'finish';

export interface KitchenListResponse {
    code?: number;
    message?: string;
    object?: {
        content?: any[];
        totalElements?: number;
        totalPages?: number;
        number?: number;
        size?: number;
    };
    data?: {
        content?: any[];
    };
}

@Injectable({
    providedIn: 'root'
})
export class KitchenApiService {
    private readonly kitchenBaseUrl = `${environment.apiUrl}/tenant-client-orders`;

    constructor(private http: HttpClient) {}

    listOrders(tenantId: number, page = 0, size = 100): Observable<any[]> {
        const params = new HttpParams()
            .set('tenantId', tenantId)
            .set('status', 'EN_PREPARACION')
            .set('page', page)
            .set('size', size);

        return this.http.get<KitchenListResponse>(this.kitchenBaseUrl, { params }).pipe(
            map((response) => this.extractContent(response))
        );
    }

    updateStatus(orderId: string, action: KitchenTransitionAction): Observable<any> {
        const estadoMap: { [key in KitchenTransitionAction]: string } = {
            'start': 'EN_PREPARACION',
            'finish': 'LISTO'
        };

        const estado = estadoMap[action];
        const url = `${this.kitchenBaseUrl}/${orderId}/status`;
        const body = { estado };

        return this.http.patch(url, body);
    }

    private extractContent(response: KitchenListResponse | null | undefined): any[] {
        const content = response?.object?.content ?? response?.data?.content ?? [];
        return Array.isArray(content) ? content : [];
    }
}
