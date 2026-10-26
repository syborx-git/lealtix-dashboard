/**
 * Modelos para el catálogo de menú de Comandix
 */

export interface Product {
  id: number;
  name: string;
  price: number;
  imageUrl: string | null;
  description: string;
  categoryName?: string;
  /** Ingredientes de la receta (base / modificables) para mostrar opciones */
  recipes?: IngredientOption[];
  /** Adicionales disponibles (insumo + cantidad + precio extra) */
  additionals?: IngredientOption[];
  /** Variantes del producto para selección en modal con cards */
  variants?: VariantOption[];
  esVariable?: boolean;
  tieneVariantes?: boolean;
}

export interface IngredientOption {
  insumoId: number;
  insumoName: string;
  cantidad?: number;
  unidad?: string;
  modificable?: boolean;
  precio?: number;
  tipoIngrediente?: 'BASE' | 'MODIFICABLE' | 'ADICIONAL' | 'VARIANTE';
  isVariant?: boolean;
  grupo?: string;
}

export interface VariantOption {
  id?: number;
  insumoId: number;
  insumoName: string;
  name?: string;
  cantidad?: number;
  unidad?: string;
  precio: number;
  price?: number;
  stock?: number;
  grupo?: string;
  tipoIngrediente?: string;
  imageUrl?: string;
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
