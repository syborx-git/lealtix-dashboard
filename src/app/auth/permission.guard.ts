import { Injectable, inject } from '@angular/core';
import { CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { MessageService } from 'primeng/api';

/**
 * Función guard para validar permisos en rutas
 * Uso en rutas: canActivate: [PermissionGuard], data: { permission: 'view_campaigns' }
 */
export const PermissionGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
	const authService = inject(AuthService);
	const router = inject(Router);
	const messageService = inject(MessageService, { optional: true });

	// Obtener el permiso requerido de la ruta
	const requiredPermission = route.data['permission'] as string | null;

	// Si no hay permiso requerido, permitir acceso
	if (!requiredPermission) {
		return true;
	}

	// Verificar si el usuario tiene el permiso
	if (authService.hasPermission(requiredPermission)) {
		return true;
	}

	// Usuario no tiene permiso
	const user = authService.getCurrentUser();
	console.warn(
		`[PermissionGuard] Acceso denegado. Usuario: ${user?.email}, Rol: ${user?.rol}, Permiso requerido: ${requiredPermission}`
	);

	if (messageService) {
		messageService.add({
			severity: 'error',
			summary: 'Acceso Denegado',
			detail: `No tienes permiso para acceder a esta sección. Permiso requerido: ${requiredPermission}`,
			life: 5000
		});
	}

	// Redirigir a la página anterior o al dashboard
	router.navigate(['/dashboard/kpis']);
	return false;
};

