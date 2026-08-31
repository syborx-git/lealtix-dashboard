import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError, shareReplay } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { Tenant } from '../../model/tenat.component';
import { environment } from '@/pages/commons/environment';

@Injectable({providedIn: 'root'})
export class TenantService {


  private apiUrl = `${environment.apiUrl}/tenant`;
  private apiUrlGetByEmail = `${environment.apiUrl}/tenant/config`;
  private tenantByEmailCache = new Map<string, Observable<any>>();

  constructor(private http: HttpClient) {}

  createTenant(tenant: Tenant): Observable<any> {
    return this.http.post<any>(this.apiUrl, tenant);
  }

  getTenantByEmail(email: string) {
      const normalizedEmail = String(email || '').trim().toLowerCase();
      const cached = this.tenantByEmailCache.get(normalizedEmail);
      if (cached) {
        return cached;
      }

      const encodedEmail = encodeURIComponent(normalizedEmail);
      const request$ = this.http.get<any>(`${this.apiUrlGetByEmail}/${encodedEmail}`).pipe(
        shareReplay(1),
        catchError((error) => {
          this.tenantByEmailCache.delete(normalizedEmail);
          return throwError(() => error);
        })
      );

      this.tenantByEmailCache.set(normalizedEmail, request$);
      return request$;
  }

  getTenantById(tenantId: number): Observable<Tenant> {
    return this.http.get<Tenant>(`${this.apiUrl}/${tenantId}`);
  }

  updateTenant(tenantId: number, tenant: Tenant): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${tenantId}`, tenant);
  }

  invalidateTenantByEmailCache(email: string): void {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      return;
    }

    this.tenantByEmailCache.delete(normalizedEmail);
  }
}
