import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@/pages/commons/environment';

export interface RedemptionRequest {
  customerId: number | string;
  rewardId: string;
  pointsCost: number;
  notes?: string;
}

export interface RedemptionResult {
  id: string;
  transactionId: string;
  status: 'COMPLETED' | 'PENDING' | 'REJECTED';
  timestamp: string;
  remainingPoints: number;
}

@Injectable({
  providedIn: 'root'
})
export class RedemptionApiService {
  private readonly baseUrl = `${environment.apiUrl}/redemptions`;

  constructor(private http: HttpClient) {}

  redeemReward(payload: RedemptionRequest): Observable<RedemptionResult> {
    return this.http.post<RedemptionResult>(`${this.baseUrl}/redeem`, payload);
  }

  getRedemptionHistory(customerId: number | string): Observable<RedemptionResult[]> {
    return this.http.get<RedemptionResult[]>(`${this.baseUrl}/customer/${customerId}`);
  }
}
