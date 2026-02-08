import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { CreateCampaignRequest, UpdateCampaignRequest, CampaignResponse, CampaignValidationResult, CampaignWithValidation } from '@/models/campaign.model';
import { GenericResponse } from '@/models/generic-response.model';
import { CreateRewardRequest, RewardResponse } from '../models/reward.model';
import { UpdateCampaignRequest as NewUpdateCampaignRequest, ConfigureRewardRequest } from '@/models/update-campaign-request';
import { CampaignResponse as NewCampaignResponse } from '@/models/campaign-response';
import { ApiResponseMapper } from './api-response.mapper';
import { environment } from '@/pages/commons/environment';

@Injectable({
  providedIn: 'root'
})
export class CampaignService {
  private readonly baseUrl = `${environment.apiUrl}/campaigns`;

  constructor(
    private http: HttpClient,
    private mapper: ApiResponseMapper
  ) {}

  /**
   * Crea una nueva campaña
   */
  create(req: CreateCampaignRequest): Observable<CampaignResponse> {
    return this.http.post<GenericResponse<CampaignResponse>>(this.baseUrl, req)
      .pipe(
        map(response => {
          const mappedResponse = this.mapper.mapGenericResponse(response);
          return this.mapper.mapCampaignResponse(mappedResponse.object);
        }),
        tap({
          next: (response: CampaignResponse) => {
            console.log('Campaña creada exitosamente:', response);
          },
          error: (error: any) => {
            console.error('Error al crear campaña:', error);
          }
        })
      );
  }

  /**
   * Actualiza una campaña existente con campo de reward anidado
   * PUT /api/campaigns/{id}
   *
   * - Serializa fechas a formato YYYY-MM-DD
   * - Valida campos de reward según su tipo
   * - Mapea la respuesta GenericResponse.data a CampaignResponse
   */
  updateCampaign(id: number, payload: NewUpdateCampaignRequest): Observable<NewCampaignResponse> {
    const url = `${this.baseUrl}/${id}`;

    // Helper para serializar fechas
    const serializeDate = (date: any): string | null => {
      if (!date) return null;
      if (typeof date === 'string') {
        return date.length === 10 ? date : date.split('T')[0];
      }
      if (date instanceof Date) {
        return date.toISOString().slice(0, 10);
      }
      if (date && typeof date.toISOString === 'function') {
        return date.toISOString().slice(0, 10);
      }
      return null;
    };

    // Normalizar y serializar fechas a YYYY-MM-DD
    const body = {
      ...payload,
      startDate: serializeDate(payload.startDate),
      endDate: serializeDate(payload.endDate),
      channels: payload.channels || [],
      segmentation: payload.segmentation || []
    };

    return this.http.put<any>(url, body).pipe(
      map((resp: any) => {
        // Validar respuesta
        if (!resp) {
          throw new Error('Respuesta inválida del servidor');
        }

        // Manejar ambos formatos: data o object
        const data = resp.data || resp.object;
        if (!data) {
          throw new Error('Respuesta sin datos');
        }

        // Retornar solo el objeto data
        if (resp.code === 200 || resp.code === 201) {
          return data as NewCampaignResponse;
        } else {
          throw new Error(resp.message || 'Error actualizando campaña');
        }
      }),
      tap({
        next: (response: NewCampaignResponse) => {
          console.log('Campaña actualizada exitosamente:', response);
        },
        error: (error: any) => {
          console.error('Error al actualizar campaña:', error);
        }
      }),
      catchError(error => {
        console.error('Error en updateCampaign:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Valida un ConfigureRewardRequest según su tipo
   * Retorna un objeto con isValid y un mensaje de error si aplica
   */
  validateRewardConfig(reward: ConfigureRewardRequest): { isValid: boolean; errorMessage?: string } {
    if (!reward || !reward.rewardType) {
      return { isValid: false, errorMessage: 'Tipo de reward requerido' };
    }

    // Si es NONE, no requiere validación adicional
    if (reward.rewardType === 'NONE') {
      return { isValid: true };
    }

    // Validar description para tipos que lo requieren
    if (!reward.description || reward.description.trim().length === 0) {
      return { isValid: false, errorMessage: 'Descripción del beneficio requerida' };
    }

    if (reward.description.length > 500) {
      return { isValid: false, errorMessage: 'Descripción no puede exceder 500 caracteres' };
    }

    // Validar según tipo
    switch (reward.rewardType) {
      case 'PERCENT_DISCOUNT':
        if (!reward.numericValue || reward.numericValue <= 0 || reward.numericValue > 100) {
          return { isValid: false, errorMessage: 'Descuento debe estar entre 1 y 100%' };
        }
        break;

      case 'FIXED_AMOUNT':
        if (!reward.numericValue || reward.numericValue <= 0) {
          return { isValid: false, errorMessage: 'Monto fijo debe ser mayor a 0' };
        }
        break;

      case 'FREE_PRODUCT':
        if (!reward.productId || reward.productId <= 0) {
          return { isValid: false, errorMessage: 'Producto requerido para regalo' };
        }
        break;

      case 'BUY_X_GET_Y':
        if (!reward.buyQuantity || reward.buyQuantity <= 0) {
          return { isValid: false, errorMessage: 'Cantidad a comprar debe ser mayor a 0' };
        }
        if (!reward.freeQuantity || reward.freeQuantity <= 0) {
          return { isValid: false, errorMessage: 'Cantidad gratis debe ser mayor a 0' };
        }
        break;

      case 'CUSTOM':
        if (!reward.customConfig || reward.customConfig.trim().length === 0) {
          return { isValid: false, errorMessage: 'Configuración personalizada requerida' };
        }
        break;
    }

    return { isValid: true };
  }

  /**
   * Actualiza una campaña existente
   */
  update(id: number, req: UpdateCampaignRequest): Observable<CampaignResponse> {
    return this.http.put<GenericResponse<CampaignResponse>>(`${this.baseUrl}/${id}`, req)
      .pipe(
        map(response => {
          const mappedResponse = this.mapper.mapGenericResponse(response);
          return this.mapper.mapCampaignResponse(mappedResponse.object);
        })
      );
  }

  /**
   * Obtiene una campaña por ID
   */
  get(id: number): Observable<CampaignResponse> {
    return this.http.get<GenericResponse<CampaignResponse>>(`${this.baseUrl}/${id}`)
      .pipe(
        map(response => {
          const mappedResponse = this.mapper.mapGenericResponse(response);
          return this.mapper.mapCampaignResponse(mappedResponse.object);
        })
      );
  }

  /**
   * Obtiene todas las campañas de un negocio
   */
  getByBusiness(businessId: number): Observable<CampaignResponse[]> {
    return this.http.get<GenericResponse<CampaignResponse[]>>(`${this.baseUrl}/business/${businessId}`)
      .pipe(
        map(response => {
          const mappedResponse = this.mapper.mapGenericResponse(response);
          return (mappedResponse.object || []).map(campaign =>
            this.mapper.mapCampaignResponse(campaign)
          );
        })
      );
  }

  /**
   * Elimina una campaña
   */
  delete(id: number): Observable<void> {
    return this.http.delete<GenericResponse<void>>(`${this.baseUrl}/${id}`)
      .pipe(
        map(() => undefined)
      );
  }

  /**
   * Guarda una campaña como borrador
   * Los borradores tienen validaciones más flexibles y pueden ser completados más tarde
   */
  saveDraft(req: CreateCampaignRequest): Observable<CampaignResponse> {
    const draftRequest = { ...req, isDraft: true };
    return this.http.post<GenericResponse<CampaignResponse>>(`${this.baseUrl}/draft`, draftRequest)
      .pipe(
        map(response => {
          const mappedResponse = this.mapper.mapGenericResponse(response);
          return this.mapper.mapCampaignResponse(mappedResponse.object);
        }),
        tap({
          next: (response: CampaignResponse) => {
            console.log('Borrador guardado exitosamente:', response);
          },
          error: (error: any) => {
            console.error('Error al guardar borrador:', error);
          }
        })
      );
  }

  /**
   * Actualiza un borrador existente
   */
  updateDraft(id: number, req: UpdateCampaignRequest): Observable<CampaignResponse> {
    const draftRequest = { ...req, isDraft: true };
    return this.http.put<GenericResponse<CampaignResponse>>(`${this.baseUrl}/draft/${id}`, draftRequest)
      .pipe(
        map(response => {
          const mappedResponse = this.mapper.mapGenericResponse(response);
          return this.mapper.mapCampaignResponse(mappedResponse.object);
        })
      );
  }

  /**
   * Publica un borrador (lo convierte en campaña activa)
   */
  publishDraft(id: number): Observable<CampaignResponse> {
    return this.http.post<GenericResponse<CampaignResponse>>(`${this.baseUrl}/draft/${id}/publish`, {})
      .pipe(
        map(response => {
          const mappedResponse = this.mapper.mapGenericResponse(response);
          return this.mapper.mapCampaignResponse(mappedResponse.object);
        })
      );
  }

  /**
   * Valida las campañas de un negocio
   * Retorna el estado de validación de cada campaña
   */
  validateCampaigns(businessId: number): Observable<CampaignValidationResult[]> {
    return this.http.get<GenericResponse<CampaignValidationResult[]>>(`${this.baseUrl}/business/${businessId}/validate`)
      .pipe(
        map(response => {
          const mappedResponse = this.mapper.mapGenericResponse(response);
          return mappedResponse.object || [];
        })
      );
  }

  /**
   * Obtiene las campañas de un negocio con su estado de validación integrado
   * Combina los resultados de getByBusiness y validateCampaigns
   */
  getCampaignsWithValidation(businessId: number): Observable<CampaignWithValidation[]> {
    return forkJoin({
      campaigns: this.getByBusiness(businessId),
      validations: this.validateCampaigns(businessId)
    }).pipe(
      map(({ campaigns, validations }) => {
        // Mapear cada campaña con su validación correspondiente
        return campaigns.map(campaign => {
          const validation = validations.find(v => v.campaignId === campaign.id);

          // Si no hay validación, crear una por defecto
          const defaultValidation: CampaignValidationResult = {
            campaignId: campaign.id,
            configComplete: false,
            missingItems: ['Validación no disponible'],
            severity: 'ACTION_REQUIRED'
          };

          return {
            campaign,
            validation: validation || defaultValidation
          };
        });
      })
    );
  }

  /**
   * Crea un reward (beneficio) para una campaña
   * POST /campaigns/{id}/reward
   */
  createReward(campaignId: number, req: CreateRewardRequest): Observable<RewardResponse> {
    return this.http.post<GenericResponse<RewardResponse>>(`${this.baseUrl}/${campaignId}/reward`, req)
      .pipe(
        map(response => {
          const mappedResponse = this.mapper.mapGenericResponse(response);
          return mappedResponse.object;
        }),
        tap({
          next: (response: RewardResponse) => {
            console.log('Reward creado exitosamente:', response);
          },
          error: (error: any) => {
            console.error('Error al crear reward:', error);
          }
        })
      );
  }

  /**
   * Obtiene un reward por su ID
   * GET /promotion-rewards/{id}
   */
  getReward(rewardId: number): Observable<RewardResponse> {
    return this.http.get<GenericResponse<RewardResponse>>(`${environment.apiUrl}/promotion-rewards/${rewardId}`)
      .pipe(
        map(response => {
          const mappedResponse = this.mapper.mapGenericResponse(response);
          return mappedResponse.object;
        })
      );
  }

  /**
   * Obtiene el reward de una campaña
   * GET /promotion-rewards/campaign/{id}
   */
  getRewardByCampaign(campaignId: number): Observable<RewardResponse> {
    return this.http.get<GenericResponse<RewardResponse>>(`${environment.apiUrl}/promotion-rewards/campaign/${campaignId}`)
      .pipe(
        map(response => {
          const mappedResponse = this.mapper.mapGenericResponse(response);
          return mappedResponse.object;
        })
      );
  }

  /**
   * Actualiza un reward existente
   * PUT /promotion-rewards/{id}
   */
  updateReward(rewardId: number, req: CreateRewardRequest): Observable<RewardResponse> {
    return this.http.put<GenericResponse<RewardResponse>>(`${environment.apiUrl}/promotion-rewards/${rewardId}`, req)
      .pipe(
        map(response => {
          const mappedResponse = this.mapper.mapGenericResponse(response);
          return mappedResponse.object;
        }),
        tap({
          next: (response: RewardResponse) => {
            console.log('Reward actualizado exitosamente:', response);
          },
          error: (error: any) => {
            console.error('Error al actualizar reward:', error);
          }
        })
      );
  }

  /**
   * Elimina un reward
   * DELETE /promotion-rewards/{id}
   */
  deleteReward(rewardId: number): Observable<void> {
    return this.http.delete<GenericResponse<void>>(`${environment.apiUrl}/promotion-rewards/${rewardId}`)
      .pipe(
        map(() => undefined)
      );
  }

  /**
   * Valida si existe una campaña de bienvenida activa para un tenant
   * GET /campaigns/tenant/{tenantId}/has-welcome
   */
  hasActiveWelcomeCampaign(tenantId: number): Observable<{ hasActiveWelcomeCampaign: boolean }> {
    return this.http.get<GenericResponse<{ hasActiveWelcomeCampaign: boolean }>>(`${this.baseUrl}/tenant/${tenantId}/has-welcome`)
      .pipe(
        map(response => {
          const mappedResponse = this.mapper.mapGenericResponse(response);
          return mappedResponse.object;
        })
      );
  }

  /**
   * Valida el estado de la campaña de bienvenida (ACTIVE o DRAFT)
   * GET /campaigns/tenant/{tenantId}/welcome-status
   */
  getWelcomeCampaignStatus(tenantId: number): Observable<{ status: string | null; exists: boolean }> {
    return this.http.get<GenericResponse<{ status: string | null; exists: boolean }>>(`${this.baseUrl}/tenant/${tenantId}/welcome-status`)
      .pipe(
        map(response => {
          const mappedResponse = this.mapper.mapGenericResponse(response);
          return mappedResponse.object;
        })
      );
  }

  /**
   * Envía emails masivos para una campaña
   * POST /campaigns/{id}/send
   *
   * Inicia el proceso de envío masivo de emails para la campaña especificada.
   * La campaña debe estar en estado READY para poder iniciar el envío.
   *
   * @param campaignId ID de la campaña
   * @returns Observable con el resultado del envío
   */
  sendMassiveEmails(campaignId: number): Observable<{
    status: string;
    message: string;
    campaignId: number;
    currentStatus: string;
  }> {
    return this.http.post<any>(`${this.baseUrl}/${campaignId}/send`, {})
      .pipe(
        map(response => {
          // Manejar respuesta directa del backend
          if (response.status === 'SUCCESS') {
            return {
              status: response.status,
              message: response.message,
              campaignId: response.campaignId,
              currentStatus: response.currentStatus
            };
          } else {
            throw new Error(response.message || 'Error al enviar emails');
          }
        }),
        tap({
          next: (response) => {
            console.log('Envío de emails iniciado:', response);
          },
          error: (error: any) => {
            console.error('Error al enviar emails:', error);
          }
        }),
        catchError(error => {
          console.error('Error en sendMassiveEmails:', error);
          return throwError(() => error);
        })
      );
  }
}
