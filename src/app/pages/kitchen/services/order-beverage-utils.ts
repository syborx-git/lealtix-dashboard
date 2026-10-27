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
    'trago', 'shot', 'chupito',
    'cafe', 'coffee', 'cafeteria',
    'infusion', 'te', 'tea',
    'refresco', 'soda',
    'agua', 'water',
    'jugo', 'juice',
    'smoothie', 'malteada', 'frappe',
    'cava', 'cantina', 'copeo', 'preparados', 'preparado',
    'mixers', 'mixer', 'digestivo', 'aperitivo',
    'calientes', 'frios', 'sin alcohol', 'con alcohol', 'bebestibles'
];

const BEVERAGE_NAME_KEYWORDS = [
    // Cervezas y preparados
    'cerveza', 'heineken', 'corona', 'victoria', 'modelo', 'bohemia', 'stella',
    'michelob', 'amstel', 'ultra', 'pacifico', 'indio', 'tecate', 'carta blanca',
    'dos equis', 'xx', 'leon', 'montejo', 'barril', 'caguama', 'caguamon',
    'michelada', 'chelada', 'ojo rojo', 'cubana', 'clamato',
    // Cocteles clásicos y populares
    'mojito', 'margarita', 'carajillo', 'pina colada', 'piña colada', 'azulito',
    'ruso negro', 'alma negra', 'paloma', 'charro negro', 'vampiro', 'cantarito',
    'pinada', 'piñada', 'conga', 'sangria', 'clericot', 'aperol', 'spritz',
    'gin tonic', 'gin & tonic', 'martini', 'cosmopolitan', 'daikiri', 'daiquiri',
    'submarino', 'perla negra', 'baby mango', 'cucaracha', 'torito',
    // Destilados y marcas habituales
    'tequila', 'whisky', 'vodka', 'mezcal', 'brandy', 'cognac', 'ginebra', 'gin ',
    'don julio', 'herradura', 'maestro dobel', 'dobel', 'centenario', '7 leguas',
    'siete leguas', 'jose cuervo', 'cuervo', '1800', 'tradicional', 'cazadores', 'espolon',
    'buchanan', 'red label', 'black label', 'chivas', 'jack daniel', 'jim beam',
    'macallan', 'glenfiddich', 'j&b', 'ballantines', 'johnnie walker',
    'bacardi', 'havana', 'captain morgan', 'matusalem', 'appleton', 'zacapa', 'flor de cana',
    'absolut', 'smirnoff', 'grey goose', 'belvedere', 'stolichnaya',
    '400 conejos', 'ojo de tigre', 'alipus', 'montelobos', 'amores', 'creyente',
    'torres 10', 'torres 5', 'fundador', 'don pedro', 'terry', 'hennessy', 'martell',
    'baileys', 'kahlua', 'frangelico', 'jagermeister', 'licor 43', 'anis', 'campari',
    'amaretto', 'sambuca', 'midori', 'hpnotiq',
    // Vinos
    'cabernet', 'merlot', 'malbec', 'chardonnay', 'sauvignon', 'tempranillo',
    'syrah', 'pinot', 'rioja', 'ribera', 'lambrusco', 'prosecco', 'champagne', 'champana',
    // Cafetería
    'latte', 'capuchino', 'cappuccino', 'espresso', 'expreso', 'americano', 'moka', 'mocha',
    'frappe', 'matcha', 'chai',
    // Refrescos, aguas y energizantes
    'coca-cola', 'coca cola', 'sprite', 'fanta', 'refresco', 'perrier', 'pellegrino',
    'penafiel', 'peñafiel', 'ciel', 'agua embotellada', 'agua mineral', 'agua natural',
    'agua fresca', 'limonada', 'naranjada', 'horchata', 'jamaica', 'tamarindo',
    'topo chico', 'tehuacan', 'squirt', 'mundet', 'sidral', 'delaware', 'boing', 'jarrito',
    'red bull', 'monster', 'boost', 'electrolit',
    // Ron y derivados
    'ron ', 'ron 7', 'ron blanco', 'ron añejo'
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