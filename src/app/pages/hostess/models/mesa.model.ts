export type MesaEstado = 'LIBRE' | 'OCUPADA' | 'RESERVADA';

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
    createdAt?: string;
    updatedAt?: string;
}

export interface MesaRequest {
    nombre: string;
    numero?: number;
    capacidad: number;
    estado?: MesaEstado;
    meseroUserId?: number | null;
}

export interface AsignarMeseroRequest {
    meseroUserId?: number | null;
}

export const MESA_ESTADO_COLORS: Record<MesaEstado, EstadoTagSeverity> = {
    LIBRE: 'success',
    OCUPADA: 'danger',
    RESERVADA: 'warn'
};