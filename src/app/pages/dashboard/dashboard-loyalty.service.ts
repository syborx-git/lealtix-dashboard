import { Injectable } from '@angular/core';
import { environment } from '@/pages/commons/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import {
  RepeatPurchaseRateDTO,
  IdentifiedVsGeneralDTO,
  CustomerLTVDTO,
  CouponConversionDTO,
  CustomizationAnalysisDTO,
  CampaignROIDTO
} from './dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardLoyaltyService {
  private get base(): string {
    return `${this.getApiBaseUrl().replace(/\/+$/g, '')}/dashboard/comandix`;
  }

  constructor(private http: HttpClient) {}

  private getApiBaseUrl(): string {
    const cfg = environment as { apiUrl?: string };

    if (cfg.apiUrl && cfg.apiUrl.trim() !== '') {
      return cfg.apiUrl.replace(/\/+$/g, '');
    }

    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return `${window.location.origin}/api`;
    }

    return 'https://lealtix-service.onrender.com/api';
  }

  private params(tenantId: number): HttpParams {
    return new HttpParams().set('tenantId', String(tenantId));
  }

  private paramsWithDates(tenantId: number, from: string, to: string): HttpParams {
    return new HttpParams()
      .set('tenantId', String(tenantId))
      .set('from', from)
      .set('to', to);
  }

  /**
   * Tasa de Recompra
   * Retorna estadísticas de clientes que compran una sola vez vs múltiples veces
   */
  repeatPurchaseRate(tenantId: number, from: string, to: string): Observable<RepeatPurchaseRateDTO> {
    return this.http
      .get<RepeatPurchaseRateDTO>(`${this.base}/repeat-purchase-rate`, { params: this.paramsWithDates(tenantId, from, to) })
      .pipe(
        catchError((err) => {
          console.error('Error fetching repeat purchase rate:', err);
          return of(this.getEmptyRepeatPurchaseRate());
        })
      );
  }

  /**
   * Ventas Identificadas vs Generales
   * Compara ventas de clientes identificados vs generales
   */
  identifiedVsGeneral(tenantId: number, from: string, to: string): Observable<IdentifiedVsGeneralDTO> {
    return this.http
      .get<IdentifiedVsGeneralDTO>(`${this.base}/identified-vs-general`, { params: this.paramsWithDates(tenantId, from, to) })
      .pipe(
        catchError((err) => {
          console.error('Error fetching identified vs general:', err);
          return of(this.getEmptyIdentifiedVsGeneral());
        })
      );
  }

  /**
   * LTV - Top Clientes
   * Retorna lista de clientes con mayor valor de vida útil
   */
  customerLTV(tenantId: number, from: string, to: string): Observable<CustomerLTVDTO[]> {
    return this.http
      .get<CustomerLTVDTO[]>(`${this.base}/customer-ltv`, { params: this.paramsWithDates(tenantId, from, to) })
      .pipe(
        catchError((err) => {
          console.error('Error fetching customer LTV:', err);
          return of([]);
        })
      );
  }

  /**
   * Conversión de Cupón
   * Análisis detallado de cupones por campaña
   */
  couponConversion(tenantId: number, from: string, to: string): Observable<CouponConversionDTO[]> {
    return this.http
      .get<CouponConversionDTO[]>(`${this.base}/coupon-conversion`, { params: this.paramsWithDates(tenantId, from, to) })
      .pipe(
        catchError((err) => {
          console.error('Error fetching coupon conversion:', err);
          return of([]);
        })
      );
  }

  /**
   * Análisis de Personalización
   * Palabras clave más frecuentes en órdenes personalizadas
   */
  customizationAnalysis(tenantId: number, from: string, to: string): Observable<CustomizationAnalysisDTO[]> {
    return this.http
      .get<CustomizationAnalysisDTO[]>(`${this.base}/customization-analysis`, { params: this.paramsWithDates(tenantId, from, to) })
      .pipe(
        catchError((err) => {
          console.error('Error fetching customization analysis:', err);
          return of([]);
        })
      );
  }

  /**
   * ROI por Campaña
   * Retorno de inversión detallado por campaña
   */
  campaignROI(tenantId: number, from: string, to: string): Observable<CampaignROIDTO[]> {
    return this.http
      .get<CampaignROIDTO[]>(`${this.base}/campaign-roi`, { params: this.paramsWithDates(tenantId, from, to) })
      .pipe(
        catchError((err) => {
          console.error('Error fetching campaign ROI:', err);
          return of([]);
        })
      );
  }

  // Métodos auxiliares para datos vacíos seguros
  private getEmptyRepeatPurchaseRate(): RepeatPurchaseRateDTO {
    return {
      totalCustomers: 0,
      repeatCustomers: 0,
      repeatRate: 0,
      oneTimeBuyers: 0,
      multiTimeBuyers: 0
    };
  }

  private getEmptyIdentifiedVsGeneral(): IdentifiedVsGeneralDTO {
    return {
      identifiedOrdersCount: 0,
      identifiedRevenue: 0,
      identifiedAvgTicket: 0,
      generalOrdersCount: 0,
      generalRevenue: 0,
      generalAvgTicket: 0,
      identifiedPercentage: 0,
      generalPercentage: 0
    };
  }
}
