export type MesaEstado = 'LIBRE' | 'OCUPADA' | 'RESERVADA';

export type MesaForma = 'redonda' | 'cuadrada' | 'rectangular';

export type EstadoTagSeverity = 'success' | 'info' | 'warn' | 'secondary' | 'contrast' | 'danger';

export interface MesaDTO {
    id?: number;
    tenantId: number;
    nombre: string;
    numero?: number;
    capacidad: number;
    estado: MesaEstado;
    meseroUserId?: number | null;
    meseroNombre?: string | null;
    posicionX?: number | null;
    posicionY?: number | null;
    forma?: MesaForma;
    /** Orientación en grados (0/90/180/270) sobre el plano */
    rotacion?: number;
    idGrupoTemporal?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface MesaRequest {
    nombre: string;
    numero?: number;
    capacidad: number;
    estado?: MesaEstado;
    meseroUserId?: number | null;
    posicionX?: number | null;
    posicionY?: number | null;
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

export const MESA_FORMA_OPTIONS: { label: string; value: MesaForma }[] = [
    { label: 'Redonda', value: 'redonda' },
    { label: 'Cuadrada', value: 'cuadrada' },
    { label: 'Rectangular', value: 'rectangular' }
];

export const MESA_FORMA_SIZE: Record<MesaForma, MesaSize> = {
    redonda: { width: 81, height: 81 },
    cuadrada: { width: 78, height: 78 },
    rectangular: { width: 111, height: 69 }
};

export function mesaSize(forma?: MesaForma): MesaSize {
    return MESA_FORMA_SIZE[forma ?? 'cuadrada'];
}

/** Normaliza la rotación a grados positivos 0-359 */
export function rotacionGrados(rotacion?: number): number {
    const r = (rotacion ?? 0) % 360;
    return r < 0 ? r + 360 : r;
}

/** Tamaño efectivo de la mesa considerando su rotación (90/270 intercambian ancho/alto) */
export function mesaTamano(mesa: { forma?: MesaForma; rotacion?: number }): MesaSize {
    const base = mesaSize(mesa.forma);
    const rot = rotacionGrados(mesa.rotacion);
    return rot % 180 === 0 ? base : { width: base.height, height: base.width };
}