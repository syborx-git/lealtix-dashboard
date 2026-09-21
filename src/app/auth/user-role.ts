export type UserRoleName = 'ADMIN' | 'MESERO' | 'COCINA' | 'CAJA' | 'MARKETING' | 'HOSTESS';

export const ROLE_HOME_ROUTES: Record<UserRoleName, string> = {
    ADMIN: '/dashboard/kpis',
    MESERO: '/dashboard/comandix',
    COCINA: '/dashboard/cocina',
    CAJA: '/dashboard/kpis',
    MARKETING: '/dashboard/kpis',
    HOSTESS: '/dashboard/mesas'
};

export function getRoleName(role?: string | null): UserRoleName | null {
    if (!role) {
        return null;
    }
    const normalized = role.toUpperCase();
    return normalized in ROLE_HOME_ROUTES ? (normalized as UserRoleName) : null;
}

export function homeRouteForRole(role?: string | null): string {
    const normalized = getRoleName(role);
    return normalized ? ROLE_HOME_ROUTES[normalized] : ROLE_HOME_ROUTES.ADMIN;
}