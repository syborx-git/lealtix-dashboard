import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { GenericResponse } from '@/models/generic-response.model';
import { environment } from '@/pages/commons/environment';
import { MesaDTO, MesaRequest, AsignarMeseroRequest, MesaEstado } from '../models/mesa.model';

@Injectable({ providedIn: 'root' })
export class MesaService {
    private readonly baseUrl = `${environment.apiUrl}/mesas`;

    constructor(private http: HttpClient) {}

    getMesas(tenantId: number): Observable<MesaDTO[]> {
        return this.http
            .get<GenericResponse<MesaDTO[]>>(this.baseUrl, { params: { tenantId: tenantId.toString() } })
            .pipe(map(resp => resp.object || []));
    }

    createMesa(tenantId: number, request: MesaRequest): Observable<MesaDTO> {
        return this.http
            .post<GenericResponse<MesaDTO>>(this.baseUrl, request, { params: { tenantId: tenantId.toString() } })
            .pipe(map(resp => resp.object));
    }

    updateMesa(id: number, tenantId: number, request: MesaRequest): Observable<MesaDTO> {
        return this.http
            .put<GenericResponse<MesaDTO>>(`${this.baseUrl}/${id}`, request, { params: { tenantId: tenantId.toString() } })
            .pipe(map(resp => resp.object));
    }

    assignMesero(id: number, tenantId: number, request: AsignarMeseroRequest): Observable<MesaDTO> {
        return this.http
            .put<GenericResponse<MesaDTO>>(`${this.baseUrl}/${id}/asignar-mesero`, request, { params: { tenantId: tenantId.toString() } })
            .pipe(map(resp => resp.object));
    }

    changeEstado(id: number, tenantId: number, estado: MesaEstado): Observable<MesaDTO> {
        return this.http
            .put<GenericResponse<MesaDTO>>(`${this.baseUrl}/${id}/estado`, JSON.stringify(estado), {
                params: { tenantId: tenantId.toString() },
                headers: { 'Content-Type': 'application/json' }
            })
            .pipe(map(resp => resp.object));
    }

    deleteMesa(id: number, tenantId: number): Observable<any> {
        return this.http
            .delete<GenericResponse<any>>(`${this.baseUrl}/${id}`, { params: { tenantId: tenantId.toString() } })
            .pipe(map(resp => resp));
    }
}