import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { homeRouteForRole } from './user-role';

/**
 * RoleGuard
 * Verifica que el rol del usuario esté permitido en route.data['roles'] (array de roles).
 * Redirige a la home del rol si no tiene acceso.
 */
const OPERATIONAL_EXCLUSIVE_ROUTES: Record<string, string> = {
	BARRA: '/dashboard/barra',
	MESERO: '/dashboard/comandix',
	HOSTESS: '/dashboard/mesas',
	CAJA: '/dashboard/caja'
};

export const RoleGuard: CanActivateFn = (route, state) => {
	const authService = inject(AuthService);
	const router = inject(Router);

	const user = authService.getCurrentUser();
	const rawRole = user?.role || user?.rol;
	const userRole = (rawRole || '').toUpperCase();

	// Seccionamiento estricto: los roles operativos solo pueden acceder a su vista exclusiva
	if (userRole in OPERATIONAL_EXCLUSIVE_ROUTES) {
		const allowedRoute = OPERATIONAL_EXCLUSIVE_ROUTES[userRole];
		const currentPath = state.url.split('?')[0].replace(/\/+$/, '');
		if (currentPath === allowedRoute) {
			return true;
		}
		console.warn(`[RoleGuard] Rol operativo ${userRole} intentó acceder a ${state.url}. Redirigiendo a ${allowedRoute}`);
		router.navigate([allowedRoute]);
		return false;
	}

	const allowedRoles = (route.data?.['roles'] as string[] | undefined) ?? [];
	if (allowedRoles.length === 0) {
		return true;
	}

	if (rawRole && allowedRoles.includes(rawRole)) {
		return true;
	}

	console.warn(`[RoleGuard] Acceso denegado. Rol: ${rawRole}, permitidos: ${allowedRoles.join(', ')}`);
	router.navigate([homeRouteForRole(rawRole)]);
	return false;
};