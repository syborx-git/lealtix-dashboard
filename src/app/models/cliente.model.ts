/**
 * Modelo de Cliente para Gestión de Clientes
 */

export type GeneroEnum = 'Hombre' | 'Mujer' | 'Otro';

export interface Cliente {
  id: number;
  tenantId: number;
  nombreCompleto: string;
  email: string;
  fechaNacimiento: string | Date;
  genero: GeneroEnum;
  telefono?: string;
  activo: boolean;
  fechaCreacion: string | Date;
  fechaActualizacion?: string | Date;
}

export interface CreateClienteRequest {
  nombreCompleto: string;
  email: string;
  fechaNacimiento: string | Date;
  genero: GeneroEnum;
  telefono?: string;
}

export interface UpdateClienteRequest {
  nombreCompleto?: string;
  email?: string;
  fechaNacimiento?: string | Date;
  genero?: GeneroEnum;
  telefono?: string;
  activo?: boolean;
}

export interface ClienteListResponse {
  content: Cliente[];
  totalElements: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export interface BulkUploadClienteRequest {
  clientes: CreateClienteRequest[];
}

export interface BulkUploadClienteResponse {
  exitosos: number;
  fallidos: number;
  errores: { indice: number; mensaje: string }[];
}

export interface ClienteSearchParams {
  tenantId: number;
  email?: string;
  page?: number;
  pageSize?: number;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}

export const GENERO_OPTIONS = [
  { label: 'Hombre', value: 'Hombre' },
  { label: 'Mujer', value: 'Mujer' },
  { label: 'Otro', value: 'Otro' }
];

export const CSV_HEADERS = ['nombreCompleto', 'email', 'fechaNacimiento', 'genero', 'telefono'];
export const CSV_HEADERS_DISPLAY = ['Nombre Completo', 'Email', 'Fecha de Nacimiento', 'Género', 'Teléfono (Opcional)'];
