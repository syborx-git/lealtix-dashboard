import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { RippleModule } from 'primeng/ripple';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { AppFloatingConfigurator } from "@/layout/component/app.floatingconfigurator";
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../auth.service';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs/operators';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [
        ButtonModule,
        CheckboxModule,
        InputTextModule,
        PasswordModule,
        FormsModule,
        RouterModule,
        RippleModule,
        AppFloatingConfigurator,
        CommonModule,
        ToastModule
    ],
    providers: [MessageService],
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss']
})
export class LoginComponent {
    private authService = inject(AuthService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private messageService = inject(MessageService);

    email: string = '';
    password: string = '';
    checked: boolean = false;
    loading: boolean = false;
    errorMessage: string | null = null;
    private returnUrl: string | null = null;

    private readonly kitchenDashboardRoute = '/dashboard/cocina-dashboard';
    private readonly waiterDashboardRoute = '/dashboard/mesero';
    private readonly defaultDashboardRoute = '/dashboard/kpis';

    constructor() {
        this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    }

    submit() {
        this.errorMessage = null;

        const email = (this.email || '').trim();
        const password = (this.password || '').trim();

        if (!email || !password) {
            this.errorMessage = !email
                ? 'Email es requerido.'
                : 'Contraseña es requerida.';
            return;
        }

        this.loading = true;
        const startedAt = Date.now();
        const minLoadingMs = 2500;

        // Enviar password en claro
        this.authService.loginAndStore({ email, password })
            .pipe(
                finalize(() => {
                    // Garantizar que el loader se vea al menos 2.5s
                    const elapsed = Date.now() - startedAt;
                    const remaining = Math.max(0, minLoadingMs - elapsed);
                    setTimeout(() => (this.loading = false), remaining);
                })
            )
            .subscribe({
                next: (res: any) => {
                    if (!res) {
                        this.handleError('Respuesta inválida del servidor');
                        return;
                    }

                    // Nueva estructura: { code, message, object: { accessToken, userEmail, userId, permissions } }
                    if (res.code === 200 && res.object) {
                        try {
                            // Mostrar mensaje de éxito
                            this.messageService.add({
                                severity: 'success',
                                summary: 'Login Exitoso',
                                detail: `Bienvenido ${res.object.userEmail}`,
                                life: 3000
                            });

                            // Redirigir
                            setTimeout(() => {
                                if (this.returnUrl) {
                                    this.router.navigateByUrl(this.returnUrl);
                                } else {
                                    this.router.navigateByUrl(this.resolveDefaultRoute());
                                }
                            }, 500);
                        } catch (e) {
                            console.error('Error procesando login:', e);
                            this.handleError('Error al procesar el login');
                        }
                        return;
                    }

                    // Estructura antigua: { code, message, data: { user, permissions, token } }
                    if (res.code === 200 && res.data) {
                        try {
                            // Mostrar mensaje de éxito
                            this.messageService.add({
                                severity: 'success',
                                summary: 'Login Exitoso',
                                detail: `Bienvenido ${res.data.user?.nombre || res.data.user?.email}`,
                                life: 3000
                            });

                            // Redirigir
                            setTimeout(() => {
                                if (this.returnUrl) {
                                    this.router.navigateByUrl(this.returnUrl);
                                } else {
                                    this.router.navigateByUrl(this.resolveDefaultRoute());
                                }
                            }, 500);
                        } catch (e) {
                            console.error('Error procesando login:', e);
                            this.handleError('Error al procesar el login');
                        }
                        return;
                    }

                    // Error de credenciales
                    if (res.code === 401) {
                        this.errorMessage = res.message || 'Credenciales inválidas';
                        this.messageService.add({
                            severity: 'error',
                            summary: 'Login Fallido',
                            detail: this.errorMessage || undefined,
                            life: 5000
                        });
                        return;
                    }

                    this.handleError(res?.message || 'Error desconocido en login');
                },
                error: (err: any) => {
                    console.error('Login error:', err);

                    if (err?.error?.code === 401) {
                        this.errorMessage = err.error.message || 'Credenciales inválidas';
                        this.messageService.add({
                            severity: 'error',
                            summary: 'Login Fallido',
                            detail: this.errorMessage || undefined,
                            life: 5000
                        });
                        return;
                    }

                    const errorMsg = err?.error?.message || err?.message || 'Error de red o servidor';
                    this.handleError(errorMsg);
                }
            });
    }

    private handleError(message: string): void {
        this.errorMessage = message;
        this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: message,
            life: 5000
        });
    }

    private resolveDefaultRoute(): string {
        const currentUser = this.authService.getCurrentUser();
        const userRole = currentUser?.role || currentUser?.rol;
        const hasWaiterDashboardPermission = this.authService.hasPermission('dashboard_mesero');
        const hasKitchenDashboardPermission = this.authService.hasPermission('dashboard_kitchen');

        // Waiter dashboard - redirect if user has dashboard_mesero permission
        if (hasWaiterDashboardPermission) {
            return this.waiterDashboardRoute;
        }

        if (userRole === 'COCINA' && hasKitchenDashboardPermission) {
            return this.kitchenDashboardRoute;
        }

        return this.defaultDashboardRoute;
    }
}
