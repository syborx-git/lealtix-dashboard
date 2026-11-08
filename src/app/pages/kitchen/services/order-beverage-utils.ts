/**
 * Clasificación exhaustiva y robusta de bebidas (Barra) vs platillos (Cocina).
 */

const BEVERAGE_CATEGORY_KEYWORDS = [
    'cerveza', 'cervezas', 'beer', 'beers',
    'bebida', 'bebidas', 'beverage', 'beverages', 'drink', 'drinks',
    'barra', 'bar',
    'coctel', 'cocteles', 'cocteleria', 'cocktail', 'cocktails', 'mixologia',
    'destilado', 'destilados', 'botella', 'botellas',
    'licor', 'licores', 'liquor',
    'vino', 'vinos', 'wine', 'wines',
    'trago', 'tragos', 'shot', 'shots', 'chupito', 'chupitos',
    'cafe', 'cafes', 'coffee', 'cafeteria',
    'infusion', 'infusiones', 'te', 'tes', 'tea',
    'refresco', 'refrescos', 'soda', 'sodas',
    'agua', 'aguas', 'water',
    'jugo', 'jugos', 'juice',
    'smoothie', 'smoothies', 'malteada', 'malteadas', 'frappe', 'frappes',
    'cava', 'cavas', 'cantina', 'cantinas', 'copeo',
    'mixers', 'mixer', 'digestivo', 'digestivos', 'aperitivo', 'aperitivos',
    'sin alcohol', 'con alcohol', 'bebestibles'
];

const BEVERAGE_NAME_KEYWORDS = [
    // Cervezas y preparados
    'cerveza', 'heineken', 'corona', 'cerveza victoria', 'victoria de barril', 'modelo especial',
    'cerveza modelo', 'negra modelo', 'cerveza bohemia', 'stella artois',
    'michelob', 'michelob ultra', 'amstel ultra', 'pacifico', 'cerveza indio', 'tecate', 'carta blanca',
    'dos equis', 'xx', 'cerveza leon', 'montejo', 'caguama', 'caguamon',
    'michelada', 'chelada', 'ojo rojo', 'cubana', 'clamato preparado', 'clamato',
    // Cocteles clásicos y populares
    'mojito', 'margarita', 'carajillo', 'pina colada', 'piña colada', 'azulito',
    'ruso negro', 'ruso blanco', 'alma negra', 'paloma', 'charro negro', 'vampiro', 'cantarito',
    'pinada', 'piñada', 'conga', 'sangria', 'clericot', 'aperol', 'spritz',
    'gin tonic', 'gin & tonic', 'martini', 'cosmopolitan', 'daikiri', 'daiquiri',
    'submarino', 'perla negra', 'baby mango', 'cucaracha', 'torito',
    // Destilados y marcas habituales
    'tequila', 'whisky', 'whiskey', 'vodka', 'mezcal', 'brandy', 'cognac', 'ginebra', 'gin',
    'don julio', 'herradura', 'maestro dobel', 'dobel', 'gran centenario', 'tequila centenario',
    '7 leguas', 'siete leguas', 'jose cuervo', 'cuervo tradicional', 'cuervo especial', '1800',
    'tequila cazadores', 'cazadores reposado', 'tequila espolon',
    'buchanans', 'buchanan', 'red label', 'black label', 'chivas', 'jack daniel', 'jim beam',
    'macallan', 'glenfiddich', 'j&b', 'ballantines', 'johnnie walker',
    'bacardi', 'havana club', 'havana', 'captain morgan', 'matusalem', 'appleton', 'zacapa', 'flor de cana', 'flor de caña',
    'absolut', 'smirnoff', 'grey goose', 'belvedere', 'stolichnaya',
    '400 conejos', 'ojo de tigre', 'alipus', 'montelobos', 'mezcal amores', 'creyente',
    'torres 10', 'torres 5', 'fundador', 'don pedro', 'terry', 'hennessy', 'martell',
    'baileys', 'kahlua', 'frangelico', 'jagermeister', 'licor 43', 'anis dulce', 'anis seco', 'campari',
    'amaretto', 'sambuca', 'midori', 'hpnotiq',
    // Vinos
    'cabernet', 'merlot', 'malbec', 'chardonnay', 'sauvignon', 'tempranillo',
    'syrah', 'pinot', 'rioja', 'ribera', 'lambrusco', 'prosecco', 'champagne', 'champana', 'champaña',
    // Cafetería
    'latte', 'capuchino', 'cappuccino', 'espresso', 'expreso', 'americano', 'moka', 'mocha',
    'frappe', 'matcha latte', 'chai latte',
    // Refrescos, aguas y energizantes
    'coca-cola', 'coca cola', 'sprite', 'fanta', 'refresco', 'perrier', 'pellegrino',
    'penafiel', 'peñafiel', 'ciel', 'agua embotellada', 'agua mineral', 'agua natural',
    'agua fresca', 'limonada', 'naranjada', 'horchata', 'jamaica', 'tamarindo',
    'topo chico', 'tehuacan', 'squirt', 'mundet', 'sidral', 'delaware', 'boing', 'jarrito',
    'red bull', 'monster', 'boost', 'electrolit',
    // Ron
    'ron'
];

export function cleanText(text: string | null | undefined): string {
    if (!text) return '';
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

/**
 * Coincidencia precisa con límites de palabra para evitar falsos positivos
 * (por ejemplo: que "camaron", "chicharron" o "macarron" coincidan con "ron",
 * o que "platos fuertes" o "cortes" coincidan con "te").
 */
function matchesWordOrPhrase(targetText: string, keyword: string): boolean {
    const cleanKw = cleanText(keyword);
    if (!cleanKw) return false;
    const escaped = cleanKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i');
    return regex.test(targetText);
}

export function isBeverageCategoryName(categoryName: string | null | undefined): boolean {
    if (!categoryName) return false;
    const clean = cleanText(categoryName);
    return BEVERAGE_CATEGORY_KEYWORDS.some((kw) => matchesWordOrPhrase(clean, kw));
}

export function isBeverageProductName(productName: string | null | undefined): boolean {
    if (!productName) return false;
    const clean = cleanText(productName);
    return BEVERAGE_NAME_KEYWORDS.some((kw) => matchesWordOrPhrase(clean, kw));
}

export function buildBeverageProductIds(beverages: any[] | null | undefined, menuProducts?: any[] | null | undefined): Set<number> {
    const set = new Set<number>();
    const cocinaProductIds = new Set<number>();

    // 1. Analizar productos de menú según su área explícita
    for (const prod of menuProducts ?? []) {
        const pid = Number(prod?.id ?? prod?.productId);
        if (Number.isFinite(pid) && pid > 0) {
            const area = (prod?.area || '').toString().trim().toUpperCase();
            if (area === 'COCINA' || area === 'ALMACEN') {
                cocinaProductIds.add(pid);
                continue;
            }
            if (area === 'BARRA') {
                set.add(pid);
                continue;
            }
            const catName = prod?.categoryName ?? prod?.category?.nombre ?? prod?.category;
            const prodName = prod?.nombre ?? prod?.name ?? prod?.productName;
            if (isBeverageCategoryName(catName) || isBeverageProductName(prodName)) {
                set.add(pid);
            }
        }
    }

    // 2. Insumos marcados como esBebida (sin sobreescribir productos explícitos de Cocina)
    for (const bev of beverages ?? []) {
        const pid = Number(bev?.productoId);
        if (Number.isFinite(pid) && pid > 0 && !cocinaProductIds.has(pid)) {
            set.add(pid);
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
    // 0. Si el item o su producto tiene el área explícita definida, manda el área
    const explicitArea = (item?.area ?? item?.product?.area ?? item?.areaDistribucion ?? '')
        .toString()
        .trim()
        .toUpperCase();
    if (explicitArea === 'BARRA') {
        return true;
    }
    if (explicitArea === 'COCINA' || explicitArea === 'ALMACEN') {
        return false;
    }

    if (item?.esBebida === true) {
        return true;
    }
    if (item?.esBebida === false) {
        return false;
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
