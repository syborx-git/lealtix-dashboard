import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@/pages/commons/environment';

export interface LoyaltyCardConfig {
  id?: number;
  tenantId?: number;
  cardTitle: string;
  cardSubtitle?: string;
  bgColorHex: string;
  textColorHex: string;
  accentColorHex: string;
  stampIcon: string;
  totalStamps: number;
  rewardMode: string; // FULL_CARD | MILESTONE_PER_STAMP
  rewardType: string; // FREE_PRODUCT | PERCENT_DISCOUNT | FIXED_AMOUNT | TWO_FOR_ONE | CUSTOM
  rewardValue?: number;
  rewardProductId?: number;
  rewardProductName?: string;
  rewardTitle: string;
  rewardDescription?: string;
  termsAndConditions?: string;
  active: boolean;
  tenantName?: string;
  tenantLogoUrl?: string;
}

export interface CustomerLoyaltyCard {
  id: number;
  tenantId: number;
  customerId: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  currentStamps: number;
  totalStampsRequired: number;
  completedCardsCount: number;
  totalStampsAccumulated: number;
  hasPendingReward: boolean;
  pendingRewardDescription?: string;
  googleWalletObjectId?: string;
  googleWalletSaveUrl?: string;
  lastStampAt?: string;
  lastRedemptionAt?: string;
}

export interface LoyaltyStampHistory {
  id: number;
  cardId: number;
  customerId: number;
  customerName: string;
  actionType: string;
  stampsChange: number;
  stampsBefore: number;
  stampsAfter: number;
  rewardRedeemed?: string;
  notes?: string;
  registeredByName?: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class LoyaltyCardService {
  private readonly baseUrl = `${environment.apiUrl}/loyalty-card`;

  constructor(private http: HttpClient) {}

  getConfig(tenantId: number): Observable<LoyaltyCardConfig> {
    return this.http.get<LoyaltyCardConfig>(`${this.baseUrl}/config/${tenantId}`);
  }

  updateConfig(tenantId: number, config: LoyaltyCardConfig): Observable<LoyaltyCardConfig> {
    return this.http.put<LoyaltyCardConfig>(`${this.baseUrl}/config/${tenantId}`, config);
  }

  getCustomerCards(tenantId: number): Observable<CustomerLoyaltyCard[]> {
    return this.http.get<CustomerLoyaltyCard[]>(`${this.baseUrl}/customers/${tenantId}`);
  }

  getCustomerCard(tenantId: number, customerId: number): Observable<CustomerLoyaltyCard> {
    return this.http.get<CustomerLoyaltyCard>(`${this.baseUrl}/customers/${tenantId}/${customerId}`);
  }

  addStamps(request: { tenantId: number; customerId: number; stampsToAdd: number; notes?: string }): Observable<CustomerLoyaltyCard> {
    return this.http.post<CustomerLoyaltyCard>(`${this.baseUrl}/stamp/add`, request);
  }

  redeemReward(request: { tenantId: number; customerId: number; notes?: string }): Observable<CustomerLoyaltyCard> {
    return this.http.post<CustomerLoyaltyCard>(`${this.baseUrl}/reward/redeem`, request);
  }

  getHistory(tenantId: number): Observable<LoyaltyStampHistory[]> {
    return this.http.get<LoyaltyStampHistory[]>(`${this.baseUrl}/history/${tenantId}`);
  }

  getHistoryByCard(cardId: number): Observable<LoyaltyStampHistory[]> {
    return this.http.get<LoyaltyStampHistory[]>(`${this.baseUrl}/history/card/${cardId}`);
  }

  getGoogleWalletPassUrl(tenantId: number, customerId: number): Observable<{ saveUrl: string }> {
    return this.http.get<{ saveUrl: string }>(`${this.baseUrl}/google-wallet/pass-url/${tenantId}/${customerId}`);
  }
}

