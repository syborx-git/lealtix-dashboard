/**
 * Clasificación bebida/platillo de los items de una orden.
 *
 * Una "bebida" es un insumo con esBebida=true que tiene un producto de menú
 * enlazado (productoId). Como las órdenes solo referencian el producto de menú,
 * un item es bebida si su productId está en el catálogo de bebidas del tenant.
 */

export function buildBeverageProductIds(beverages: any[] | null | undefined): Set<number> {
    const set = new Set<number>();
    for (const bev of beverages ?? []) {
        const pid = Number(bev?.productoId);
        if (Number.isFinite(pid) && pid > 0) {
            set.add(pid);
        }
    }
    return set;
}

export function isBeverageProduct(productId: number | null | undefined, beverageProductIds: Set<number>): boolean {
    if (productId == null) {
        return false;
    }
    return beverageProductIds.has(Number(productId));
}