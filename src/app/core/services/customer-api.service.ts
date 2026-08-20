import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@/pages/commons/environment';

export interface Country {
  name?: string;
  code?: string;
}

export interface Representative {
  name?: string;
  image?: string;
}

export interface Customer {
  id?: number;
  name?: string;
  country?: Country;
  company?: string;
  date?: string;
  status?: string;
  activity?: number;
  representative?: Representative;
  balance?: number;
  verified?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CustomerApiService {
  private readonly baseUrl = `${environment.apiUrl}/tenant-customers`;

  constructor(private http: HttpClient) {}

  /**
   * Obtiene lista de clientes desde backend o API remota
   */
  getCustomers(params?: any): Observable<any> {
    return this.http.get<any>(this.baseUrl, { params });
  }

  /**
   * Obtiene cliente por id
   */
  getCustomerById(id: number): Observable<Customer> {
    return this.http.get<Customer>(`${this.baseUrl}/${id}`);
  }
}
