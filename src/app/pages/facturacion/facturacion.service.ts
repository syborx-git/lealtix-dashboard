import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@/pages/commons/environment';

@Injectable({ providedIn: 'root' })
export class FacturacionService {
  private baseUrl = `${environment.apiUrl}/facturapi/invoices`;

  constructor(private http: HttpClient) {}

  list(): Observable<any[]> {
    return this.http.get<any[]>(this.baseUrl);
  }

  download(id: string, format: 'pdf' | 'xml'): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}/${format}`, { responseType: 'blob' });
  }
}
