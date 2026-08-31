import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { MenuCatalogResponse, MenuCategory } from '../models/menu.model';
import { environment } from '@/pages/commons/environment';

@Injectable({
  providedIn: 'root'
})
export class MenuService {
  private readonly baseUrl = `${environment.apiUrl}/tenant-menu-categories`;

  constructor(private http: HttpClient) {}

  /**
   * Obtiene el catálogo completo de categorías con productos
   * @param tenantId ID del tenant
   * @returns Observable con array de categorías y productos
   */
  getCatalog(tenantId: number): Observable<any[]> {
    const params = new HttpParams().set('tenantId', tenantId.toString());

    return this.http
      .get<MenuCatalogResponse>(`${this.baseUrl}/catalog/categories-with-products`, { params })
      .pipe(
        map((response) => {
          console.log('Respuesta del MenuService:', response); // Debug
          return response.object || [];
        }),
        catchError((error) => {
          console.error('Error al obtener catálogo de menú:', error);
          return throwError(() => error);
        })
      );
  }
}
