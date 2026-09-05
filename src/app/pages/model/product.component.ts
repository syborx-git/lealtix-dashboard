import { Category } from './category.component';
export interface Product {
    id?: string;
    name?: string;
    description?: string;
    imageUrl?: string;
    isActive?: boolean;
    price?: number;
    categoryId?: number;
    categoryName?: string;
    categoryDescription?: string;
    tenantId?: number;
    categoryIds?: number[];
    categories?: { id: number; name: string }[];
}
