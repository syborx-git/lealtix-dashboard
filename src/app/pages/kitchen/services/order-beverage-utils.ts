/**
 * Clasificación exhaustiva y robusta de bebidas (Barra) vs platillos (Cocina).
 */

const BEVERAGE_CATEGORY_KEYWORDS = [
    'cerveza', 'beer',
    'bebida', 'beverage', 'drink',
    'barra', 'bar',
    'coctel', 'cocktail', 'mixologia',
    'destilado', 'botella',
    'licor', 'liquor',
    'vino', 'wine',
    'trago', 'shot',
    'cafe', 'coffee', 'cafeteria',
    'infusion', 'te', 'tea',
    'refresco', 'soda',
    'agua', 'water',
    'jugo', 'juice',
    'smoothie', 'malteada'
];

const BEVERAGE_NAME_KEYWORDS = [
    'cerveza', 'heineken', 'corona', 'victoria', 'modelo', 'bohemia', 'stella',
    'michelob', 'amstel', 'ultra', 'mojito', 'margarita', 'carajillo', 'pina colada',
    'azulito', 'ruso negro', 'alma negra', 'coca-cola', 'coca cola', 'sprite', 'fanta',
    'refresco', 'tequila', 'whisky', 'vodka', 'mezcal', 'brandy', 'perrier', 'pellegrino',
    'penafiel', 'peñafiel', 'ciel', 'agua embotellada', 'agua mineral', 'agua natural',
    'agua fresca', 'limonada', 'naranjada', 'ron '
];

export function cleanText(text: string | null | undefined): string {
    if (!text) return '';
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

export function isBeverageCategoryName(categoryName: string | null | undefined): boolean {
    if (!categoryName) return false;
    const clean = cleanText(categoryName);
    return BEVERAGE_CATEGORY_KEYWORDS.some((kw) => clean.includes(kw));
}

export function isBeverageProductName(productName: string | null | undefined): boolean {
    if (!productName) return false;
    const clean = cleanText(productName);
    if (BEVERAGE_NAME_KEYWORDS.some((kw) => clean.includes(kw))) {
        return true;
    }
    return clean === 'ron' || clean.endsWith(' ron') || clean.startsWith('ron ');
}

export function buildBeverageProductIds(beverages: any[] | null | undefined, menuProducts?: any[] | null | undefined): Set<number> {
    const set = new Set<number>();

    // 1. Insumos marcados como esBebida
    for (const bev of beverages ?? []) {
        const pid = Number(bev?.productoId);
        if (Number.isFinite(pid) && pid > 0) {
            set.add(pid);
        }
    }

    // 2. Productos de menú categorizados en Barra / Bebidas o con nombres de bebida
    for (const prod of menuProducts ?? []) {
        const pid = Number(prod?.id ?? prod?.productId);
        if (Number.isFinite(pid) && pid > 0) {
            const catName = prod?.categoryName ?? prod?.category?.nombre ?? prod?.category;
            const prodName = prod?.nombre ?? prod?.name ?? prod?.productName;
            if (isBeverageCategoryName(catName) || isBeverageProductName(prodName)) {
                set.add(pid);
            }
        }
    }

    return set;
}

export function isBeverageProduct(productId: number | null | undefined, beverageProductIds?: Set<number>): boolean {
    if (productId == null || !beverageProductIds) {
        return false;
    }
    return beverageProductIds.has(Number(productId));
}

export function isBeverageItemData(item: any, beverageProductIds?: Set<number>): boolean {
    if (item?.esBebida === true) {
        return true;
    }
    const pid = item?.productId ?? item?.productoId;
    if (pid != null && beverageProductIds && beverageProductIds.has(Number(pid))) {
        return true;
    }
    const catName = item?.categoryName ?? item?.categoria;
    if (isBeverageCategoryName(catName)) {
        return true;
    }
    const prodName = item?.productName ?? item?.prod ?? item?.nombre;
    return isBeverageProductName(prodName);
}