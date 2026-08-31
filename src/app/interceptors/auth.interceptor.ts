import { Injectable, Injector } from '@angular/core';
import {
	HttpInterceptor,
	HttpRequest,
	HttpHandler,
	HttpEvent,
	HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';
import { Router } from '@angular/router';

/**
 * Interceptor que agrega el token Bearer y maneja errores de autenticación
 */
@Injectable({ providedIn: 'root' })
export class AuthInterceptor implements HttpInterceptor {
	private authService?: AuthService;

	constructor(private injector: Injector, private router: Router) {}

	private getAuthService(): AuthService {
		if (!this.authService) {
			this.authService = this.injector.get(AuthService);
		}
		return this.authService;
	}

	intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
		const authService = this.getAuthService();
		const token = authService.getToken() || localStorage.getItem('accessToken');
		const tenantId = authService.getTenantId();

		// Clonar la request y agregar headers
		let authReq = req;

		if (token) {
			authReq = req.clone({
				setHeaders: {
					Authorization: `Bearer ${token}`,
					'X-Tenant-Id': tenantId.toString()
				}
			});
		}

		// Si la request no tiene tenantId como parámetro y es una solicitud autenticada,
		// agregar tenantId como query param
		if (
			token &&
			!req.urlWithParams.includes('tenantId=') &&
			!req.url.includes('login') &&
			!req.url.includes('/redeem/')
		) {
			const separator = authReq.url.includes('?') ? '&' : '?';
			authReq = authReq.clone({
				url: `${authReq.url}${separator}tenantId=${tenantId}`
			});
		}

		return next.handle(authReq).pipe(
			catchError((error: HttpErrorResponse) => {
				// Manejar 401 Unauthorized - Token expirado o inválido
				if (error.status === 401) {
					console.warn('[AuthInterceptor] Token inválido o expirado, redirigiendo a login');
					this.getAuthService().logout();
					this.router.navigate(['/dashboard/auth/login']);
				}

				// Manejar 403 Forbidden - Permiso denegado
				if (error.status === 403) {
					console.warn('[AuthInterceptor] Acceso denegado (403):', error);
				}

				return throwError(() => error);
			})
		);
	}
}
