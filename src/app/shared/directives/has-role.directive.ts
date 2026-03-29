import { Directive, Input, TemplateRef, ViewContainerRef, OnInit } from '@angular/core';
import { UserRole } from '@/models/user.model';
import { AuthService } from '@/auth/auth.service';

/**
 * Directiva estructural *hasRole para controlar la visibilidad de elementos
 * basándose en el rol del usuario autenticado
 *
 * Uso:
 * <div *hasRole="'ADMIN'">Solo para admins</div>
 * <div *hasRole="['ADMIN', 'MESERO']">Para admin o mesero</div>
 */
@Directive({
  selector: '[appHasRole]',
  standalone: true
})
export class HasRoleDirective implements OnInit {
  private requiredRoles: UserRole[] = [];
  private userRole: UserRole | null = null;

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private authService: AuthService
  ) {}

  @Input()
  set appHasRole(roles: UserRole | UserRole[]) {
    this.requiredRoles = Array.isArray(roles) ? roles : [roles];
    this.updateView();
  }

  ngOnInit() {
    // Obtener el rol del usuario actual
    this.userRole = this.getUserRoleFromStorage();
    this.updateView();
  }

  private updateView() {
    if (this.canViewElement()) {
      this.viewContainer.createEmbeddedView(this.templateRef);
    } else {
      this.viewContainer.clear();
    }
  }

  private canViewElement(): boolean {
    if (!this.userRole) {
      return false;
    }
    return this.requiredRoles.includes(this.userRole);
  }

  private getUserRoleFromStorage(): UserRole | null {
    try {
      const user = this.authService.getCurrentUser();
      return user?.rol as UserRole || null;
    } catch (error) {
      console.error('Error al obtener rol del usuario:', error);
    }
    return null;
  }
}
