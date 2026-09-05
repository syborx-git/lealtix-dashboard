export enum UserRole {
  ADMIN = 'ADMIN',
  MESERO = 'MESERO',
  COCINA = 'COCINA',
  CAJA = 'CAJA',
  MARKETING = 'MARKETING'
}

export interface UserDTO {
  id?: number;
  nombre: string;
  email: string;
  contrasena?: string;
  rol: UserRole;
  permissions?: string[];
  activo?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  sueldoMensual?: number;
}

export interface CreateUserRequest {
  nombre: string;
  email: string;
  contrasena: string;
  rol: UserRole;
  tenantId: number;
  sueldoMensual: number;
}

export interface UpdateUserRequest {
  nombre?: string;
  email?: string;
  contrasena?: string;
  rol?: UserRole;
  sueldoMensual?: number;
}

export interface UserListResponse {
  total: number;
  usuarios: UserDTO[];
}

export interface GenericResponse<T> {
  code: number;
  message: string;
  data?: T;
}

// Permission mappings for each role
export const ROLE_PERMISSIONS: { [key in UserRole]: string[] } = {
  [UserRole.ADMIN]: [
    'view_dashboard',
    'manage_users',
    'manage_campaigns',
    'manage_categories',
    'manage_products',
    'view_reports',
    'manage_settings'
  ],
  [UserRole.MESERO]: [
    'view_comanda',
    'create_order',
    'edit_own_order'
  ],
  [UserRole.COCINA]: [
    'view_kitchen_orders',
    'update_order_status',
    'view_pending_orders'
  ],
  [UserRole.CAJA]: [
    'view_sales',
    'process_payment',
    'manage_transactions',
    'view_cash_register'
  ],
  [UserRole.MARKETING]: [
    'view_campaigns',
    'create_campaign',
    'view_analytics',
    'manage_redemptions'
  ]
};

// Color mappings for each role (for p-tag display)
export const ROLE_COLORS: { [key in UserRole]: string } = {
  [UserRole.ADMIN]: 'danger',
  [UserRole.MESERO]: 'info',
  [UserRole.COCINA]: 'success',
  [UserRole.CAJA]: 'warning',
  [UserRole.MARKETING]: 'secondary'
};
