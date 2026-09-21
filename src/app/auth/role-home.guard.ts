import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { homeRouteForRole } from './user-role';

/**
 * RoleHomeGuard
 * Redirige la raíz /dashboard a la página inicial según el rol del usuario.
 */
export const RoleHomeGuard: CanActivateFn = (route, state) => {
	const authService = inject(AuthService);
	const router = inject(Router);

	const user = authService.getCurrentUser();
	const home = homeRouteForRole(user?.role || user?.rol);

	return router.createUrlTree([home]);
};