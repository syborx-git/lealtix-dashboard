import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@/pages/commons/environment';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private baseUrl = `${environment.apiUrl}/inventory`;

  constructor(private http: HttpClient) {}

  getByTenant(tenantId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/tenant/${tenantId}`);
  }

  getInsumos(tenantId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/insumos/tenant/${tenantId}`);
  }

  createInsumo(tenantId: number, nombre: string, unidad: string, stock: number, stockMinimo: number, categoryIds?: number[]): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/insumos`, { tenantId, nombre, unidad, stock, stockMinimo, categoryIds: categoryIds ?? [] });
  }

  updateInsumo(insumoId: number, nombre: string, unidad: string, stock: number, stockMinimo: number, categoryIds?: number[]): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/insumos/${insumoId}`, { nombre, unidad, stock, stockMinimo, categoryIds: categoryIds ?? [] });
  }

  deleteInsumo(insumoId: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/insumos/${insumoId}`);
  }

  restockInsumo(insumoId: number, cantidad: number, costoTotal?: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/insumos/${insumoId}/restock`, { cantidad, costoTotal: costoTotal ?? 0 });
  }

  getBebidas(tenantId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/bebidas/tenant/${tenantId}`);
  }

  createBebida(tenantId: number, nombre: string, unidad: string, stock: number, stockMinimo: number, precioVenta: number, categoryIds?: number[]): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/bebidas`, { tenantId, nombre, unidad, stock, stockMinimo, precioVenta, categoryIds: categoryIds ?? [] });
  }

  updateBebida(insumoId: number, nombre: string, unidad: string, stock: number, stockMinimo: number, precioVenta: number, categoryIds?: number[]): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/bebidas/${insumoId}`, { nombre, unidad, stock, stockMinimo, precioVenta, categoryIds: categoryIds ?? [] });
  }

  deleteBebida(insumoId: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/bebidas/${insumoId}`);
  }

  updateStock(productId: number, stock: number, stockMinimo: number, unidad: string): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/product/${productId}`, { stock, stockMinimo, unidad });
  }

  restock(productId: number, cantidad: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/product/${productId}/restock`, { cantidad });
  }

  getRecipes(dishId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/dish/${dishId}/recipes`);
  }

  addRecipeIngredient(dishId: number, insumoId: number, cantidad: number, modificable: boolean): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/dish/${dishId}/recipes`, { insumoId, cantidad, modificable });
  }

  setRecipes(dishId: number, lines: any[]): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/dish/${dishId}/recipes`, { lines });
  }

  removeRecipeIngredient(recipeId: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/recipes/${recipeId}`);
  }

  updateRecipeIngredient(recipeId: number, cantidad: number, modificable: boolean): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/recipes/${recipeId}`, { cantidad, modificable });
  }

  getAdditionals(dishId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/dish/${dishId}/additionals`);
  }

  addAdditional(dishId: number, insumoId: number, cantidad: number, precio: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/dish/${dishId}/additionals`, { insumoId, cantidad, precio });
  }

  updateAdditional(additionalId: number, cantidad: number, precio: number): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/additionals/${additionalId}`, { cantidad, precio });
  }

  removeAdditional(additionalId: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/additionals/${additionalId}`);
  }
}
