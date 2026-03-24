import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap, of, map, catchError, BehaviorSubject } from 'rxjs';
import { environment } from '@/pages/commons/environment';
import { TenantService } from '@/pages/admin-page/service/tenant.service';

export interface LoginCredentials {
	email: string;
	password: string;
	tenantId?: number;  // Opcional - obtenido del backend si no se proporciona
}

export interface BackendWrapper<T> {
	code: number;
	message: string;
	data?: T;
	object?: T;
}

export interface User {
	id: number;
	nombre?: string;
	nombre_usuario?: string;
	email: string;
	rol?: 'ADMIN' | 'MESERO' | 'COCINA';
	tenantId?: number;  // Opcional - puede venir del JWT o de otro endpoint
}

export interface LoginResponse {
	code: number;
	message: string;
	object?: {
		accessToken: string;
		userEmail: string;
		userId: number;
		permissions: string[];
	};
	data?: {
		user: User;
		permissions: string[];
		token: string;
		accessToken?: string;
	};
}

export interface TokenPayload {
	accessToken: string;
	userEmail: string;
	userId: number;
}

@Injectable({
	providedIn: 'root'
})
export class AuthService {
	private baseUrl = `${environment.apiUrl}/tenant/auth`;
	private currentUser$ = new BehaviorSubject<User | null>(null);
	private permissions$ = new BehaviorSubject<string[]>([]);
	private token$ = new BehaviorSubject<string | null>(null);

	constructor(
		private http: HttpClient,
		private tenantService: TenantService
	) {
		this.loadFromStorage();
	}

	/**
	 * Carga usuario, permisos y token desde localStorage
	 */
	private loadFromStorage(): void {
		try {
			const user = localStorage.getItem('currentUser');
			const permissions = localStorage.getItem('permissions');
			const token = localStorage.getItem('accessToken');

			if (user) {
				this.currentUser$.next(JSON.parse(user));
			}
			if (permissions) {
				this.permissions$.next(JSON.parse(permissions));
			}
			if (token) {
				this.token$.next(token);
			}
		} catch (e) {
			console.warn('Error loading from storage:', e);
		}
	}

	/**
	 * Comprueba si existe un token de acceso en localStorage.
	 */
	isAuthenticated(): boolean {
		try {
			const token = localStorage.getItem('accessToken');
			return !!token;
		} catch (e) {
			return false;
		}
	}

	/**
	 * Realiza login al backend usando POST /api/tenant/auth/login
	 * @param credentials { tenantId, email, password }
	 * @returns Observable<LoginResponse>
	 */
	login(credentials: LoginCredentials): Observable<LoginResponse> {
		const url = `${this.baseUrl}/login`;
		const headers = new HttpHeaders({ 'Content-Type': 'application/json', Accept: '*/*' });
		return this.http.post<LoginResponse>(url, credentials, { headers });
	}

	/**
	 * Llama a login, almacena token, usuario y permisos
	 * Maneja ambas estructuras de respuesta: nueva { object } y antigua { data }
	 * @param credentials
	 */
	loginAndStore(credentials: LoginCredentials): Observable<LoginResponse> {
		return this.login(credentials).pipe(
			tap((res) => {
				// Nueva estructura: { code, message, object: { accessToken, userEmail, userId, permissions } }
				if (res?.object) {
					const { accessToken, userEmail, userId, permissions } = res.object;
					try {
						// Guardar token
						localStorage.setItem('accessToken', accessToken || '');
						this.token$.next(accessToken || null);

						// Guardar usuario (creando objeto User)
						const user: User = {
							id: userId,
							email: userEmail
						};
						localStorage.setItem('currentUser', JSON.stringify(user));
						this.currentUser$.next(user);

						// Guardar permisos
						localStorage.setItem('permissions', JSON.stringify(permissions || []));
						this.permissions$.next(permissions || []);

						// Compatible con código antiguo
						localStorage.setItem('usuario', JSON.stringify({
							userEmail: userEmail,
							userId: userId
						}));
					} catch (e) {
						console.warn('No se pudo guardar en localStorage', e);
					}
				}
				// Estructura antigua: { code, message, data: { user, permissions, token} }
				else if (res?.data) {
					const { token, user, permissions } = res.data;
					try {
						// Guardar token
						localStorage.setItem('accessToken', token || res.data.accessToken || '');
						this.token$.next(token || res.data.accessToken || null);

						// Guardar usuario
						localStorage.setItem('currentUser', JSON.stringify(user));
						this.currentUser$.next(user);

						// Guardar permisos
						localStorage.setItem('permissions', JSON.stringify(permissions || []));
						this.permissions$.next(permissions || []);

						// Compatible con código antiguo
						localStorage.setItem('usuario', JSON.stringify({
							userEmail: user.email,
							userId: user.id,
							tenantId: user.tenantId,
							nombre: user.nombre || user.nombre_usuario
						}));
					} catch (e) {
						console.warn('No se pudo guardar en localStorage', e);
					}
				}
			})
		);
	}

	/**
	 * Obtiene el usuario actual como Observable
	 */
	getCurrentUser$(): Observable<User | null> {
		return this.currentUser$.asObservable();
	}

	/**
	 * Obtiene el usuario actual (snapshot)
	 */
	getCurrentUser(): User | null {
		return this.currentUser$.value;
	}

	/**
	 * Obtiene los permisos del usuario como Observable
	 */
	getPermissions$(): Observable<string[]> {
		return this.permissions$.asObservable();
	}

	/**
	 * Obtiene los permisos del usuario (snapshot)
	 */
	getPermissions(): string[] {
		return this.permissions$.value;
	}

	/**
	 * Verifica si el usuario tiene un permiso específico
	 */
	hasPermission(permission: string): boolean {
		const perms = this.permissions$.value;
		const user = this.currentUser$.value;

		// ADMIN tiene todos los permisos
		if (user?.rol === 'ADMIN') {
			return true;
		}

		return perms.includes(permission);
	}

	/**
	 * Verifica si el usuario tiene cualquiera de los permisos especificados
	 */
	hasAnyPermission(permissions: string[]): boolean {
		return permissions.some(perm => this.hasPermission(perm));
	}

	/**
	 * Verifica si el usuario tiene todos los permisos especificados
	 */
	hasAllPermissions(permissions: string[]): boolean {
		return permissions.every(perm => this.hasPermission(perm));
	}

	/**
	 * Obtiene el token de acceso actual
	 */
	getToken(): string | null {
		return this.token$.value;
	}

	/**
	 * Obtiene el ID del tenant del usuario actual
	 */
	getTenantId(): number {
		return this.currentUser$.value?.tenantId || 1;
	}

	/**
	 * Obtiene el rol del usuario actual
	 */
	getUserRole(): 'ADMIN' | 'MESERO' | 'COCINA' | null {
		return this.currentUser$.value?.rol || null;
	}

	/**
	 * Elimina las credenciales locales (logout)
	 */
	logout(): void {
		try {
			localStorage.removeItem('accessToken');
			localStorage.removeItem('currentUser');
			localStorage.removeItem('permissions');
			localStorage.removeItem('usuario');

			this.currentUser$.next(null);
			this.permissions$.next([]);
			this.token$.next(null);
		} catch (e) {
			// ignore
		}
	}

	/**
	 * Fuerza un refresh de permisos desde el backend
	 */
	refreshPermissions(): Observable<string[]> {
		const user = this.getCurrentUser();
		if (!user) {
			return of([]);
		}

		const url = `${environment.apiUrl}/me/permissions?tenantId=${user.tenantId}`;
		return this.http.get<{ permissions: string[] }>(url).pipe(
			tap((res) => {
				if (res.permissions) {
					localStorage.setItem('permissions', JSON.stringify(res.permissions));
					this.permissions$.next(res.permissions);
				}
			}),
			map(res => res.permissions),
			catchError((error) => {
				console.error('Error refreshing permissions:', error);
				return of(this.getPermissions());
			})
		);
	}
}
