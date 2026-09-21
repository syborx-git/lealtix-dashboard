import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { homeRouteForRole } from './user-role';

/**
 * RoleGuard
 * Verifica que el rol del usuario esté permitido en route.data['roles'] (array de roles).
 * Redirige a la home del rol si no tiene acceso.
 */
export const RoleGuard: CanActivateFn = (route, state) => {
	const authService = inject(AuthService);
	const router = inject(Router);

	const allowedRoles = (route.data?.['roles'] as string[] | undefined) ?? [];
	if (allowedRoles.length === 0) {
		return true;
	}

	const user = authService.getCurrentUser();
	const userRole = user?.role || user?.rol;

	if (userRole && allowedRoles.includes(userRole)) {
		return true;
	}

	console.warn(`[RoleGuard] Acceso denegado. Rol: ${userRole}, permitidos: ${allowedRoles.join(', ')}`);
	router.navigate([homeRouteForRole(userRole)]);
	return false;
};