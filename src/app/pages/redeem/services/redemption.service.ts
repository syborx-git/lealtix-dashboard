import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CouponValidationResponse } from '../models/coupon-validation.model';
import { RedemptionRequest } from '../models/redemption-request.model';
import { RedemptionResponse } from '../models/redemption-response.model';
import { AuthService } from '@/auth/auth.service';
import { environment } from '@/pages/commons/environment';

@Injectable({
  providedIn: 'root'
})
export class RedemptionService {
  private apiUrl = `${environment.apiUrl}/redemptions`;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  /**
   * Valida un cupón por QR token sin redimirlo (para staff con tenantId)
   */
  validateCouponByQr(qrToken: string, tenantId: number): Observable<CouponValidationResponse> {
    return this.http.get<CouponValidationResponse>(
      `${this.apiUrl}/validate/qr/${qrToken}`,
      { params: { tenantId: tenantId.toString() } }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Valida un cupón por QR token sin redimirlo (para clientes sin tenantId)
   */
  validateCouponByCustomerQr(qrToken: string): Observable<CouponValidationResponse> {
    return this.http.get<CouponValidationResponse>(
      `${this.apiUrl}/validate/customer/qr/${qrToken}`
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Valida un cupón por código
   */
  validateCouponByCode(code: string, tenantId: number): Observable<CouponValidationResponse> {
    return this.http.get<CouponValidationResponse>(
      `${this.apiUrl}/validate/code/${code}`,
      { params: { tenantId: tenantId.toString() } }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Redime un cupón por QR token
   */
  redeemCouponByQr(
    qrToken: string,
    request: RedemptionRequest,
    tenantId: number
  ): Observable<RedemptionResponse> {
    const enrichedRequest = {
      ...request,
      ipAddress: request.ipAddress || this.getClientIp(),
      userAgent: request.userAgent || navigator.userAgent
    };

    return this.http.post<RedemptionResponse>(
      `${this.apiUrl}/redeem/qr/${qrToken}`,
      enrichedRequest,
      { params: { tenantId: tenantId.toString() } }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Redime un cupón por código
   */
  redeemCouponByCode(
    code: string,
    request: RedemptionRequest,
    tenantId: number
  ): Observable<RedemptionResponse> {

    const enrichedRequest = {
      ...request,
      ipAddress: request.ipAddress || this.getClientIp(),
      userAgent: request.userAgent || navigator.userAgent
    };

    return this.http.post<RedemptionResponse>(
      `${this.apiUrl}/redeem/code/${code}`,
      enrichedRequest,
      { params: { tenantId: tenantId.toString() } }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Redime un cupón por ID
   */
  redeemCouponById(
    couponId: number | string,
    request: RedemptionRequest,
    tenantId: number
  ): Observable<RedemptionResponse> {

    const enrichedRequest = {
      ...request,
      ipAddress: request.ipAddress || this.getClientIp(),
      userAgent: request.userAgent || navigator.userAgent
    };

    return this.http.post<RedemptionResponse>(
      `${this.apiUrl}/redeem/id/${couponId}`,
      enrichedRequest,
      { params: { tenantId: tenantId.toString() } }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Intenta obtener la IP del cliente
   */
  private getClientIp(): string {
    // La IP real debe ser capturada desde el backend
    // Aquí solo retornamos un placeholder
    return 'unknown';
  }

  /**
   * Maneja errores HTTP y los convierte a mensajes legibles
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Error al procesar la solicitud';

    if (error.error instanceof ErrorEvent) {
      // Error del cliente
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Error del servidor
      errorMessage = error.error?.message ||
                    `Error del servidor: ${error.status}`;
    }

    return throwError(() => new Error(errorMessage));
  }
}
