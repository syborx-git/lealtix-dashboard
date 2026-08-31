import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@/pages/commons/environment';

export interface Campaign {
  id?: string;
  name?: string;
  description?: string;
  pointsMultiplier?: number;
  startDate?: string;
  endDate?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'SCHEDULED';
}

@Injectable({
  providedIn: 'root'
})
export class CampaignApiService {
  private readonly baseUrl = `${environment.apiUrl}/campaigns`;

  constructor(private http: HttpClient) {}

  getCampaigns(tenantId: string): Observable<Campaign[]> {
    const params = new HttpParams().set('tenantId', tenantId);
    return this.http.get<Campaign[]>(this.baseUrl, { params });
  }

  getCampaignById(id: string): Observable<Campaign> {
    return this.http.get<Campaign>(`${this.baseUrl}/${id}`);
  }
}
