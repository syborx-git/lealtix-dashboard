import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { CampaignTemplate } from '@/models/campaign-template.model';
import { GenericResponse } from '@/models/generic-response.model';
import { ApiResponseMapper } from './api-response.mapper';
import { environment } from '@/pages/commons/environment';

@Injectable({
  providedIn: 'root'
})
export class CampaignTemplateService {
  private readonly baseUrl = `${environment.apiUrl}/campaign-templates`;

  // Cache para las plantillas por tenant
  private templatesCache: Map<number, Observable<CampaignTemplate[]>> = new Map();

  constructor(
    private http: HttpClient,
    private mapper: ApiResponseMapper
  ) {}

  /**
   * Obtiene todas las plantillas de campañas (con cache)
   */
  /**
   * Obtiene todas las plantillas de campañas para un tenant (con cache por tenant)
   */
  getAll(tenantId?: number): Observable<CampaignTemplate[]> {
    // Si no viene tenantId, solicitar al endpoint base
    if (!tenantId) {
      return this.http.get<GenericResponse<CampaignTemplate[]>>(this.baseUrl)
        .pipe(
          map(response => {
            const mappedResponse = this.mapper.mapGenericResponse(response);
            return (mappedResponse.object || []).map(template =>
              this.mapper.mapCampaignTemplate(template)
            );
          })
        );
    }

    // Use cache por tenant
    const cache = this.templatesCache.get(tenantId);
    if (cache) {
      return cache;
    }

    const request$ = this.http.get<GenericResponse<CampaignTemplate[]>>(`${this.baseUrl}/tenant/${tenantId}`)
      .pipe(
        map(response => {
          const mappedResponse = this.mapper.mapGenericResponse(response);
          return (mappedResponse.object || []).map(template =>
            this.mapper.mapCampaignTemplate(template)
          );
        }),
        shareReplay(1)
      );

    this.templatesCache.set(tenantId, request$);
    return request$;
  }

  /**
   * Obtiene una plantilla por ID
   */
  get(id: number): Observable<CampaignTemplate> {
    return this.http.get<GenericResponse<CampaignTemplate>>(`${this.baseUrl}/${id}`)
      .pipe(
        map(response => {
          const mappedResponse = this.mapper.mapGenericResponse(response);
          return this.mapper.mapCampaignTemplate(mappedResponse.object);
        })
      );
  }

  /**
   * Crea una nueva plantilla
   */
  create(dto: CampaignTemplate): Observable<CampaignTemplate> {
    return this.http.post<GenericResponse<CampaignTemplate>>(this.baseUrl, dto)
      .pipe(
        map(response => {
          // Limpiar cache al crear
          this.clearCache();
          const mappedResponse = this.mapper.mapGenericResponse(response);
          return this.mapper.mapCampaignTemplate(mappedResponse.object);
        })
      );
  }

  /**
   * Actualiza una plantilla existente
   */
  update(id: number, dto: CampaignTemplate): Observable<CampaignTemplate> {
    return this.http.put<GenericResponse<CampaignTemplate>>(`${this.baseUrl}/${id}`, dto)
      .pipe(
        map(response => {
          // Limpiar cache al actualizar
          this.clearCache();
          const mappedResponse = this.mapper.mapGenericResponse(response);
          return this.mapper.mapCampaignTemplate(mappedResponse.object);
        })
      );
  }

  /**
   * Elimina una plantilla
   */
  delete(id: number): Observable<void> {
    return this.http.delete<GenericResponse<void>>(`${this.baseUrl}/${id}`)
      .pipe(
        map(() => {
          // Limpiar cache al eliminar
          this.clearCache();
          return;
        })
      );
  }

  /**
   * Limpia el cache de plantillas
   */
  private clearCache(tenantId?: number): void {
    if (tenantId) {
      this.templatesCache.delete(tenantId);
    } else {
      this.templatesCache.clear();
    }
  }

  /**
   * Refresca el cache manualmente
   */
  refreshCache(tenantId?: number): Observable<CampaignTemplate[]> {
    this.clearCache(tenantId);
    return this.getAll(tenantId);
  }
}
