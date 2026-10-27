export type MesaEstado = 'LIBRE' | 'OCUPADA' | 'RESERVADA';

export type MesaForma = 'redonda' | 'cuadrada' | 'rectangular';

export type EstadoTagSeverity = 'success' | 'info' | 'warn' | 'secondary' | 'contrast' | 'danger';

export interface MesaDTO {
    id?: number;
    tenantId: number;
    nombre: string;
    area?: string;
    identificador?: string;
    numero?: number;
    capacidad: number;
    estado: MesaEstado;
    meseroUserId?: number | null;
    meseroNombre?: string | null;
    posicionX?: number | null;
    posicionY?: number | null;
    ancho?: number;
    alto?: number;
    forma?: MesaForma;
    /** Orientación en grados (0/90/180/270) sobre el plano */
    rotacion?: number;
    idGrupoTemporal?: string | null;
    identificadorUnico?: string;
    createdAt?: string;
    updatedAt?: string;
}

export function mesaIdentificador(mesa: MesaDTO | null | undefined): string {
    if (!mesa) return '';
    if (mesa.identificador) return mesa.identificador;
    if (mesa.identificadorUnico) return mesa.identificadorUnico;
    const numPart = mesa.numero != null ? ` (M-${mesa.numero})` : '';
    const idPart = mesa.id != null ? `#${mesa.id} · ` : '';
    return `${idPart}${mesa.nombre}${numPart}`;
}

export interface MesaRequest {
    nombre: string;
    area?: string;
    identificador?: string;
    numero?: number;
    capacidad: number;
    estado?: MesaEstado;
    meseroUserId?: number | null;
    posicionX?: number | null;
    posicionY?: number | null;
    ancho?: number;
    alto?: number;
    forma?: MesaForma;
    rotacion?: number;
}

export interface AsignarMeseroRequest {
    meseroUserId?: number | null;
}

export interface PosicionRequest {
    posicionX: number;
    posicionY: number;
}

export interface GrupoRequest {
    mesaIds: number[];
}

export interface MesaSize {
    width: number;
    height: number;
}

export const MESA_ESTADO_COLORS: Record<MesaEstado, EstadoTagSeverity> = {
    LIBRE: 'success',
    OCUPADA: 'danger',
    RESERVADA: 'warn'
};

export const MESA_FORMA_OPTIONS: { label: string; value: MesaForma; icon?: string }[] = [
    { label: 'Circular', value: 'redonda', icon: 'pi pi-circle' },
    { label: 'Cuadrada', value: 'cuadrada', icon: 'pi pi-stop' }
];

export const MESA_FORMA_SIZE: Record<MesaForma, MesaSize> = {
    redonda: { width: 80, height: 80 },
    cuadrada: { width: 80, height: 80 },
    rectangular: { width: 110, height: 70 }
};

export function mesaSize(forma?: MesaForma, ancho?: number, alto?: number): MesaSize {
    if (ancho != null && alto != null && ancho > 0 && alto > 0) {
        return { width: ancho, height: alto };
    }
    return MESA_FORMA_SIZE[forma ?? 'cuadrada'] || { width: 80, height: 80 };
}

/** Normaliza la rotación a grados positivos 0-359 */
export function rotacionGrados(rotacion?: number): number {
    const r = (rotacion ?? 0) % 360;
    return r < 0 ? r + 360 : r;
}

/** Tamaño efectivo de la mesa en pantalla:
 *  - width: dimensión horizontal (ancho)
 *  - height: dimensión vertical (alto)
 */
export function mesaTamano(mesa: { forma?: MesaForma; rotacion?: number; ancho?: number; alto?: number }): MesaSize {
    if (mesa.ancho != null && mesa.ancho > 0 && mesa.alto != null && mesa.alto > 0) {
        return { width: mesa.ancho, height: mesa.alto };
    }
    const defaultSize = MESA_FORMA_SIZE[mesa.forma ?? 'cuadrada'] || { width: 80, height: 80 };
    const w = mesa.ancho != null && mesa.ancho > 0 ? mesa.ancho : defaultSize.width;
    const h = mesa.alto != null && mesa.alto > 0 ? mesa.alto : defaultSize.height;
    return { width: w, height: h };
}

export interface MesaGrupo {
    grupoId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    mesas: MesaDTO[];
    capacidadTotal: number;
    etiqueta: string;
}