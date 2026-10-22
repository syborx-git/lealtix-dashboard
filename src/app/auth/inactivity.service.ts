import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { MessageService } from 'primeng/api';

/**
 * Servicio de control de inactividad de sesión.
 * Cierra automáticamente la sesión tras 3 minutos (180,000 ms) de inactividad
 * para roles operativos como meseros, cajeros y demás.
 *
 * Las únicas sesiones que permanecen SIEMPRE activas son:
 * - Administrador (ADMIN)
 * - Cocina (COCINA o vistas de cocina)
 * - Barra (BARRA o vistas de barra)
 * - Hostess (HOSTESS o vistas de mesas)
 */
@Injectable({
  providedIn: 'root'
})
export class InactivityService implements OnDestroy {
  /** 3 minutos en milisegundos */
  private readonly INACTIVITY_LIMIT_MS = 3 * 60 * 1000;
  /** Intervalo de verificación */
  private readonly CHECK_INTERVAL_MS = 5 * 1000;

  private lastActivityTime = Date.now();
  private checkIntervalTimer: any = null;
  private isRunning = false;
  private unbindEvents: (() => void)[] = [];

  constructor(
    private authService: AuthService,
    private router: Router,
    private messageService: MessageService,
    private ngZone: NgZone
  ) {}

  /**
   * Inicia la vigilancia de inactividad global
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastActivityTime = Date.now();

    // Escuchar eventos de usuario fuera de la zona de Angular para máximo rendimiento
    this.ngZone.runOutsideAngular(() => {
      const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
      const onUserActivity = () => {
        this.lastActivityTime = Date.now();
      };

      events.forEach((evt) => {
        window.addEventListener(evt, onUserActivity, { passive: true });
        this.unbindEvents.push(() => window.removeEventListener(evt, onUserActivity));
      });

      this.checkIntervalTimer = setInterval(() => {
        this.checkInactivity();
      }, this.CHECK_INTERVAL_MS);
    });
  }

  /**
   * Detiene la vigilancia de inactividad
   */
  stop(): void {
    this.isRunning = false;
    if (this.checkIntervalTimer) {
      clearInterval(this.checkIntervalTimer);
      this.checkIntervalTimer = null;
    }
    this.unbindEvents.forEach((unbind) => unbind());
    this.unbindEvents = [];
  }

  /**
   * Verifica si el usuario actual o la vista activa está exento del auto-logout
   */
  isExempt(): boolean {
    if (!this.authService.isAuthenticated()) {
      return true;
    }

    const user = this.authService.getCurrentUser();
    if (!user) {
      return true;
    }

    const role = (user.rol || user.role || '').toUpperCase().trim();

    // Roles que permanecen SIEMPRE activos: administrador, barra, cocina y hostess
    if (role === 'ADMIN' || role === 'COCINA' || role === 'HOSTESS' || role === 'BARRA') {
      return true;
    }

    // Por seguridad adicional, verificar si está en vistas operativas permanentes
    const url = (this.router.url || '').toLowerCase();
    if (
      url.includes('/cocina') ||
      url.includes('/cocina-dashboard') ||
      url.includes('/barra') ||
      url.includes('/mesas')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Chequea si el tiempo transcurrido superó los 3 minutos
   */
  private checkInactivity(): void {
    if (!this.isRunning) return;
    if (this.isExempt()) {
      // Si está exento, refrescar la marca para cuando cambie de rol/pantalla
      this.lastActivityTime = Date.now();
      return;
    }

    const elapsed = Date.now() - this.lastActivityTime;
    if (elapsed >= this.INACTIVITY_LIMIT_MS) {
      this.ngZone.run(() => {
        this.triggerAutoLogout();
      });
    }
  }

  /**
   * Ejecuta el cierre de sesión por inactividad
   */
  private triggerAutoLogout(): void {
    console.warn('[InactivityService] Sesión cerrada tras 3 minutos de inactividad');
    this.stop();
    this.authService.logout();

    this.router.navigate(['/dashboard/auth/login']).then(() => {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sesión Cerrada por Inactividad',
        detail: 'Tu sesión ha expirado tras 3 minutos sin actividad para proteger tu cuenta.',
        life: 6000
      });
    });
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
