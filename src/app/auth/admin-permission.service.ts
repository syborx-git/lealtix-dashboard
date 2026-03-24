import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { environment } from '@/pages/commons/environment';

export interface Permission {
	id: number;
	code: string;
	name: string;
	description?: string;
	resource: string;
	action: string;
	category: string;
}

export interface RolePermissions {
	role: string;
	permissions: Permission[];
	permissionIds: number[];
}

export interface RolePermissionRequest {
	role: 'ADMIN' | 'MESERO' | 'COCINA';
	permissionIds: number[];
	replace?: boolean;
}

@Injectable({
	providedIn: 'root'
})
export class AdminPermissionService {
	private baseUrl = `${environment.apiUrl}/admin`;
	private rolePermissions$ = new BehaviorSubject<RolePermissions[]>([]);
	private allPermissions$ = new BehaviorSubject<Permission[]>([]);

	constructor(private http: HttpClient) {}

	/**
	 * Obtiene todas las permisiones disponibles
	 */
	getAllPermissions(): Observable<Permission[]> {
		const url = `${this.baseUrl}/permissions`;
		return this.http.get<{ permissions: Permission[] }>(url).pipe(
			map(res => res.permissions || []),
			tap((permissions) => {
				this.allPermissions$.next(permissions);
			})
		);
	}

	/**
	 * Obtiene observable de todas las permisiones
	 */
	getAllPermissions$(): Observable<Permission[]> {
		return this.allPermissions$.asObservable();
	}

	/**
	 * Obtiene permisos actuales de un rol
	 */
	getRolePermissions(role: 'ADMIN' | 'MESERO' | 'COCINA'): Observable<RolePermissions> {
		const url = `${this.baseUrl}/roles/${role}/permissions`;
		return this.http.get<RolePermissions>(url);
	}

	/**
	 * Obtiene códigos de permisos de un rol
	 */
	getRolePermissionCodes(role: 'ADMIN' | 'MESERO' | 'COCINA'): Observable<string[]> {
		const url = `${this.baseUrl}/roles/${role}/permission-codes`;
		return this.http.get<{ permissionCodes: string[] }>(url).pipe(
			map(res => res.permissionCodes || []),
			tap((codes) => {
				console.log(`Permisos del rol ${role}:`, codes);
			})
		);
	}

	/**
	 * Asigna permisos a un rol
	 * @param role Role to assign permissions to
	 * @param permissionIds Array of permission IDs to assign
	 * @param replace If true, reemplaza todos los permisos; si false, agrega
	 */
	assignPermissionsToRole(
		role: 'ADMIN' | 'MESERO' | 'COCINA',
		permissionIds: number[],
		replace: boolean = true
	): Observable<{ message: string; permissions: Permission[] }> {
		const url = `${this.baseUrl}/roles/${role}/permissions`;
		const body: RolePermissionRequest = {
			role,
			permissionIds,
			replace
		};

		return this.http.post<{ message: string; permissions: Permission[] }>(url, body).pipe(
			tap((res) => {
				console.log(`Permisos actualizados para ${role}:`, res);
			})
		);
	}

	/**
	 * Obtiene permisos de todos los roles
	 */
	getAllRolesPermissions(): Observable<RolePermissions[]> {
		const url = `${this.baseUrl}/roles/permissions/all`;
		return this.http.get<{ roles: RolePermissions[] }>(url).pipe(
			map(res => res.roles || []),
			tap((roles) => {
				this.rolePermissions$.next(roles);
			})
		);
	}

	/**
	 * Observable de permisos de roles
	 */
	getRolePermissions$(): Observable<RolePermissions[]> {
		return this.rolePermissions$.asObservable();
	}

	/**
	 * Filtra permisos por categoria
	 */
	filterPermissionsByCategory(permissions: Permission[], category: string): Permission[] {
		return permissions.filter((p) => p.category === category);
	}

	/**
	 * Agrupa permisos por recurso
	 */
	groupPermissionsByResource(permissions: Permission[]): { [key: string]: Permission[] } {
		return permissions.reduce(
			(acc, perm) => {
				if (!acc[perm.resource]) {
					acc[perm.resource] = [];
				}
				acc[perm.resource].push(perm);
				return acc;
			},
			{} as { [key: string]: Permission[] }
		);
	}
}
