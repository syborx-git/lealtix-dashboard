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
    private readonly kitchenBaseUrl = `${environment.apiUrl}/kitchen-orders`;
    private readonly legacyBaseUrl = `${environment.apiUrl}/tenant-client-orders`;

    constructor(private http: HttpClient) {}

    listOrders(tenantId: number, page = 0, size = 100): Observable<any[]> {
        const params = new HttpParams().set('tenantId', tenantId).set('page', page).set('size', size);

        return this.http.get<KitchenListResponse>(this.kitchenBaseUrl, { params }).pipe(
            map((response) => this.extractContent(response)),
            catchError(() => {
                return this.http.get<KitchenListResponse>(this.legacyBaseUrl, { params }).pipe(
                    map((response) => this.extractContent(response))
                );
            })
        );
    }

    updateStatus(orderId: string, action: KitchenTransitionAction): Observable<any> {
        const candidateStatuses = action === 'start' ? ['EN_PREPARACION', 'IN_PROGRESS'] : ['DESPACHADO', 'LISTO', 'CONFIRMADO'];

        return this.tryStatusCandidates(this.kitchenBaseUrl, orderId, candidateStatuses).pipe(
            catchError(() => this.tryStatusCandidates(this.legacyBaseUrl, orderId, candidateStatuses))
        );
    }

    private tryStatusCandidates(baseUrl: string, orderId: string, statuses: string[]): Observable<any> {
        const [first, ...rest] = statuses;
        if (!first) {
            return throwError(() => new Error('No status candidates available'));
        }

        return this.patchStatus(baseUrl, orderId, first).pipe(
            catchError((error) => {
                if (rest.length === 0) {
                    return throwError(() => error);
                }

                return this.tryStatusCandidates(baseUrl, orderId, rest);
            })
        );
    }

    private patchStatus(baseUrl: string, orderId: string, status: string): Observable<any> {
        const params = new HttpParams().set('orderId', orderId).set('status', status);
        return this.http.patch(`${baseUrl}/status`, null, { params });
    }

    private extractContent(response: KitchenListResponse | null | undefined): any[] {
        const content = response?.object?.content ?? response?.data?.content ?? [];
        return Array.isArray(content) ? content : [];
    }
}
