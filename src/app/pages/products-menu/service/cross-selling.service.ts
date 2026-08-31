import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { environment } from '@/pages/commons/environment';

export interface CrossSellingConfig {
    id: number;
    productId: number;
    productName?: string;
    suggestedProductId: number;
    suggestedProductName?: string;
    tenantId: number;
    displayOrder: number;
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface CrossSellingDraft {
    id?: number | null;
    suggestedProductId: number | null;
    displayOrder: number;
    isActive: boolean;
}

export interface CrossSellingPayload {
    productId: number;
    suggestedProductId: number;
    tenantId: number;
    displayOrder: number;
    isActive: boolean;
}

interface ApiResponse<T> {
    code: number;
    message: string;
    object: T;
}

@Injectable({ providedIn: 'root' })
export class CrossSellingService {
    private readonly baseUrl = `${environment.apiUrl}/cross-selling`;

    constructor(private http: HttpClient) {}

    getByProduct(productId: number, tenantId: number): Observable<CrossSellingConfig[]> {
        return this.http
            .get<ApiResponse<CrossSellingConfig[]>>(`${this.baseUrl}/product/${productId}?tenantId=${tenantId}`)
            .pipe(map((resp) => resp?.object || []));
    }

    create(payload: CrossSellingPayload): Observable<ApiResponse<CrossSellingConfig>> {
        return this.http.post<ApiResponse<CrossSellingConfig>>(`${this.baseUrl}`, payload);
    }

    update(id: number, payload: CrossSellingPayload): Observable<ApiResponse<CrossSellingConfig>> {
        return this.http.put<ApiResponse<CrossSellingConfig>>(`${this.baseUrl}/${id}`, payload);
    }

    delete(id: number, tenantId: number): Observable<ApiResponse<null>> {
        return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/${id}?tenantId=${tenantId}`);
    }
}
