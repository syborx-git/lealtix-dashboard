/**
 * Modelos para el catálogo de menú de Comandix
 */

export interface Product {
  id: number;
  name: string;
  price: number;
  imageUrl: string | null;
  description: string;
}

export interface MenuCategory {
  id: number;
  name: string;
  products: Product[];
}

export interface MenuCatalogResponse {
  code: number;
  message: string;
  object: any[];
}
