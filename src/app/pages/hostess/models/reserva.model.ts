import type { EstadoTagSeverity } from './mesa.model';

export type ReservaEstado = 'PENDIENTE' | 'CONFIRMADA' | 'CANCELADA' | 'CUMPLIDA';

export interface ReservaDTO {
    id?: number;
    tenantId: number;
    clienteNombre: string;
    telefono?: string;
    fecha: string;
    numeroPersonas: number;
    mesaId?: number | null;
    mesaNombre?: string | null;
    estado: ReservaEstado;
    notas?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface ReservaRequest {
    clienteNombre: string;
    telefono?: string;
    fecha: string;
    numeroPersonas: number;
    mesaId?: number | null;
    estado?: ReservaEstado;
    notas?: string;
}

export const RESERVA_ESTADO_COLORS: Record<ReservaEstado, EstadoTagSeverity> = {
    PENDIENTE: 'warn',
    CONFIRMADA: 'success',
    CANCELADA: 'secondary',
    CUMPLIDA: 'info'
};