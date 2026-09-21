import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { GenericResponse } from '@/models/generic-response.model';
import { environment } from '@/pages/commons/environment';
import { ReservaDTO, ReservaRequest } from '../models/reserva.model';

@Injectable({ providedIn: 'root' })
export class ReservaService {
    private readonly baseUrl = `${environment.apiUrl}/reservas`;

    constructor(private http: HttpClient) {}

    getReservas(tenantId: number): Observable<ReservaDTO[]> {
        return this.http
            .get<GenericResponse<ReservaDTO[]>>(this.baseUrl, { params: { tenantId: tenantId.toString() } })
            .pipe(map(resp => resp.object || []));
    }

    createReserva(tenantId: number, request: ReservaRequest): Observable<ReservaDTO> {
        return this.http
            .post<GenericResponse<ReservaDTO>>(this.baseUrl, request, { params: { tenantId: tenantId.toString() } })
            .pipe(map(resp => resp.object));
    }

    updateReserva(id: number, tenantId: number, request: ReservaRequest): Observable<ReservaDTO> {
        return this.http
            .put<GenericResponse<ReservaDTO>>(`${this.baseUrl}/${id}`, request, { params: { tenantId: tenantId.toString() } })
            .pipe(map(resp => resp.object));
    }

    cancelReserva(id: number, tenantId: number): Observable<ReservaDTO> {
        return this.http
            .put<GenericResponse<ReservaDTO>>(`${this.baseUrl}/${id}/cancelar`, null, { params: { tenantId: tenantId.toString() } })
            .pipe(map(resp => resp.object));
    }

    deleteReserva(id: number, tenantId: number): Observable<any> {
        return this.http
            .delete<GenericResponse<any>>(`${this.baseUrl}/${id}`, { params: { tenantId: tenantId.toString() } })
            .pipe(map(resp => resp));
    }
}