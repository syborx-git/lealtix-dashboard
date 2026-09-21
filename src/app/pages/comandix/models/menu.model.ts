/**
 * Modelos para el catálogo de menú de Comandix
 */

export interface Product {
  id: number;
  name: string;
  price: number;
  imageUrl: string | null;
  description: string;
  /** Ingredientes de la receta (base / modificables) para mostrar opciones */
  recipes?: IngredientOption[];
  /** Adicionales disponibles (insumo + cantidad + precio extra) */
  additionals?: IngredientOption[];
}

export interface IngredientOption {
  insumoId: number;
  insumoName: string;
  cantidad?: number;
  unidad?: string;
  modificable?: boolean;
  precio?: number;
  tipoIngrediente?: 'BASE' | 'MODIFICABLE' | 'ADICIONAL';
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
