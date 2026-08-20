import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@/pages/commons/environment';

export interface Reward {
  id: string;
  name: string;
  description: string;
  pointsRequired: number;
  stock: number;
  imageUrl?: string;
  active: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class RewardApiService {
  private readonly baseUrl = `${environment.apiUrl}/rewards`;

  constructor(private http: HttpClient) {}

  getRewards(): Observable<Reward[]> {
    return this.http.get<Reward[]>(this.baseUrl);
  }

  getRewardById(id: string): Observable<Reward> {
    return this.http.get<Reward>(`${this.baseUrl}/${id}`);
  }
}
