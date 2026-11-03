import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@/pages/commons/environment';

interface InventoryStatus {
    label: string;
    value: string;
}

export interface Product {
    id?: string;
    code?: string;
    name?: string;
    description?: string;
    price?: number;
    quantity?: number;
    inventoryStatus?: string;
    category?: string;
    image?: string;
    rating?: number;
}

@Injectable({providedIn: 'root'})
export class ProductService {

     constructor(private http: HttpClient) {}

      private apiUrlCategoriesByTenant = `${environment.apiUrl}/tenant-menu-categories/categories`;
      private apiUrlCreateCategory = `${environment.apiUrl}/tenant-menu-categories`;
      private apiUrlCreateProduct = `${environment.apiUrl}/tenant-menu-products`;
      private apiUrlProductsByTenant = `${environment.apiUrl}/tenant-menu-products/tenant`;
      private apiURLDeleteProduct = `${environment.apiUrl}/tenant-menu-products`;
      private apiUrlBulkProducts = `${environment.apiUrl}/tenant-menu-products/bulk`;
      private apiUrlSearchCategory = `${environment.apiUrl}/tenant-menu-categories/search`;


    getCategoriesByTenantId(tenantId: number) {
        return this.http.get<any>(`${this.apiUrlCategoriesByTenant}/${tenantId}`);
    }

    createCategory(payload: any) {
        return this.http.post<any>(`${this.apiUrlCreateCategory}`, payload);
    }

    createProduct(payload: any) {
        return this.http.post<any>(`${this.apiUrlCreateProduct}`, payload);
    }

    getProductsByTenantId(tenantId: number, bustCache = false) {
        if (!bustCache) {
            return this.http.get<any>(`${this.apiUrlProductsByTenant}/${tenantId}`);
        }
        // Evita respuestas cacheadas (HTTP/SW): URL única + cabeceras no-cache.
        return this.http.get<any>(`${this.apiUrlProductsByTenant}/${tenantId}?_t=${Date.now()}`, {
            headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }
        });
    }

    deleteProductById(productId: number) {
        return this.http.delete<any>(`${this.apiURLDeleteProduct}/${productId}`);
    }

    searchCategoryByName(tenantId: number, nombre: string) {
        return this.http.get<any>(`${this.apiUrlSearchCategory}?tenantId=${tenantId}&nombre=${encodeURIComponent(nombre)}`);
    }

    bulkCreateProducts(payload: any) {
        return this.http.post<any>(`${this.apiUrlBulkProducts}`, payload);
    }

    status: string[] = ['ACTIVO', 'INACTIVO'];
}
