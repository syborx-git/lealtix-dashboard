import { Injectable } from '@angular/core';
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
	constructor(private authService: AuthService, private router: Router) {}

	intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
		const token = this.authService.getToken();
		const tenantId = this.authService.getTenantId();

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
			!req.url.includes('tenantId=') &&
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
					this.authService.logout();
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
