import { Injectable } from '@angular/core';
import { Observable, of, map, catchError } from 'rxjs';
import { AuthService } from '@/auth/auth.service';
import { TenantService } from '@/pages/admin-page/service/tenant.service';
import { ProductService } from '@/pages/products-menu/service/product.service';
import { environment } from '@/pages/commons/environment';

export interface TenantPageInfo {
  tenantSlug: string;
  landingUrl: string;
  hasProducts: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class MiPaginaService {

  constructor(
    private authService: AuthService,
    private tenantService: TenantService,
    private productService: ProductService
  ) {}

  /**
   * Obtiene la información de la página del tenant actual
   * Incluye: slug, URL de landing y validación de productos
   */
  getTenantPageInfo(): Observable<TenantPageInfo | null> {
    const user = this.authService.getCurrentUser();

    if (!user || !user.email) {
      console.warn('No se encontró usuario autenticado');
      return of(null);
    }

    return this.tenantService.getTenantByEmail(user.email).pipe(
      map((resp) => {
        const tenant = resp?.object;
        const tenantId = tenant?.id;
        const tenantSlug = tenant?.slug;

        if (!tenantId || !tenantSlug) {
          console.warn('Tenant sin ID o slug');
          return null;
        }

        // Construir URL de landing usando entorno (producción o local)
        const baseUrl = this.getBaseUrl();
        const landingUrl = `${baseUrl}/${tenantSlug}`;

        return {
          tenantSlug,
          landingUrl,
          hasProducts: false // Se actualizará después
        };
      }),
      catchError((error) => {
        console.error('Error obteniendo información del tenant:', error);
        return of(null);
      })
    );
  }

  /**
   * Valida si el tenant tiene al menos un producto registrado
   */
  checkHasProducts(tenantId: number): Observable<boolean> {
    return this.productService.getProductsByTenantId(tenantId).pipe(
      map((resp) => {
        const products = resp?.object || [];
        return products.length > 0;
      }),
      catchError((error) => {
        console.error('Error validando productos:', error);
        return of(false);
      })
    );
  }

  /**
   * Obtiene la URL base de la aplicación dinámicamente
   * Usa el protocolo, host y puerto actuales
   */
  private getBaseUrl(): string {
    const baseUrl = environment.production
      ? 'https://lealtix.com.mx/landing-page'
      : 'http://localhost:4200/landing-page';
    return baseUrl;
  }
}
