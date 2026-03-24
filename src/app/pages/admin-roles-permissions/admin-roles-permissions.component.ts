import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { KnobModule } from 'primeng/knob';
import { DividerModule } from 'primeng/divider';
import { AdminPermissionService, Permission, RolePermissions } from '@/auth/admin-permission.service';
import { AuthService } from '@/auth/auth.service';

@Component({
	selector: 'app-admin-roles-permissions',
	standalone: true,
	imports: [
		CommonModule,
		FormsModule,
		ButtonModule,
		CardModule,
		CheckboxModule,
		ConfirmDialogModule,
		SkeletonModule,
		ToastModule,
		KnobModule,
		DividerModule
	],
	providers: [ConfirmationService, MessageService],
	templateUrl: './admin-roles-permissions.component.html',
	styleUrls: ['./admin-roles-permissions.component.scss']
})
export class AdminRolesPermissionsComponent implements OnInit {
	private adminService = inject(AdminPermissionService);
	private messageService = inject(MessageService);
	private confirmationService = inject(ConfirmationService);
	private authService = inject(AuthService);

	roles: ('ADMIN' | 'MESERO' | 'COCINA')[] = ['ADMIN', 'MESERO', 'COCINA'];
	selectedRole: 'ADMIN' | 'MESERO' | 'COCINA' = 'MESERO';

	allPermissions: Permission[] = [];
	rolePermissions: { [key: string]: Permission[] } = {};
	selectedPermissions: { [key: number]: boolean } = {};

	loading = false;
	savingRole: { [key: string]: boolean } = {};

	// Para agrupar permisos por recurso
	permissionsByResource: { [key: string]: Permission[] } = {};
	resources: string[] = [];

	// Estadísticas
	totalPermissions = 0;
	assignedPermissions = 0;

	ngOnInit(): void {
		this.loadData();
	}

	/**
	 * Carga todos los datos necesarios
	 */
	loadData(): void {
		this.loading = true;
		this.adminService.getAllPermissions().subscribe({
			next: (permissions) => {
				this.allPermissions = permissions;
				this.permissionsByResource = this.adminService.groupPermissionsByResource(
					permissions
				);
				this.resources = Object.keys(this.permissionsByResource).sort();
				this.totalPermissions = permissions.length;
				this.loadRolePermissions();
			},
			error: (err) => {
				console.error('Error cargando permisos:', err);
				this.messageService.add({
					severity: 'error',
					summary: 'Error',
					detail: 'No se pudieron cargar los permisos',
					life: 5000
				});
				this.loading = false;
			}
		});
	}

	/**
	 * Carga los permisos del rol seleccionado
	 */
	loadRolePermissions(): void {
		this.adminService.getRolePermissions(this.selectedRole).subscribe({
			next: (rolePerms) => {
				this.rolePermissions[this.selectedRole] = rolePerms.permissions;
				this.selectedPermissions = {};

				// Marcar permisos asignados
				rolePerms.permissions.forEach((perm) => {
					this.selectedPermissions[perm.id] = true;
				});

				this.assignedPermissions = rolePerms.permissions.length;
				this.loading = false;
			},
			error: (err) => {
				console.error('Error cargando permisos del rol:', err);
				this.messageService.add({
					severity: 'error',
					summary: 'Error',
					detail: 'No se pudieron cargar los permisos del rol',
					life: 5000
				});
				this.loading = false;
			}
		});
	}

	/**
	 * Cambia el rol seleccionado
	 */
	selectRole(role: 'ADMIN' | 'MESERO' | 'COCINA'): void {
		this.selectedRole = role;
		this.selectedPermissions = {};

		// Si el rol es ADMIN, todos están seleccionados y deshabilitados
		if (role === 'ADMIN') {
			this.allPermissions.forEach((perm) => {
				this.selectedPermissions[perm.id] = true;
			});
			this.assignedPermissions = this.allPermissions.length;
		} else {
			this.loadRolePermissions();
		}
	}

	/**
	 * Toggle de un permiso
	 */
	togglePermission(permissionId: number): void {
		if (this.selectedRole === 'ADMIN') {
			return; // ADMIN no puede tener permisos removidos
		}

		this.selectedPermissions[permissionId] = !this.selectedPermissions[permissionId];
		this.assignedPermissions = Object.values(this.selectedPermissions).filter(
			(v) => v === true
		).length;
	}

	/**
	 * Toggle de todos los permisos de un recurso
	 */
	toggleResourcePermissions(resource: string): void {
		if (this.selectedRole === 'ADMIN') {
			return;
		}

		const resourcePermissions = this.permissionsByResource[resource];
		const allSelected = resourcePermissions.every((p) => this.selectedPermissions[p.id]);

		resourcePermissions.forEach((perm) => {
			this.selectedPermissions[perm.id] = !allSelected;
		});

		this.assignedPermissions = Object.values(this.selectedPermissions).filter(
			(v) => v === true
		).length;
	}

	/**
	 * Guarda los permisos del rol
	 */
	saveRolePermissions(): void {
		const permissionIds = Object.keys(this.selectedPermissions)
			.filter((id) => this.selectedPermissions[+id])
			.map((id) => +id);

		this.confirmationService.confirm({
			message: `¿Estás seguro de que deseas actualizar los permisos del rol ${this.selectedRole}? (${permissionIds.length} permisos)`,
			header: 'Confirmar',
			icon: 'pi pi-exclamation-triangle',
			accept: () => {
				this.savingRole[this.selectedRole] = true;

				this.adminService
					.assignPermissionsToRole(this.selectedRole, permissionIds, true)
					.subscribe({
						next: (res) => {
							this.savingRole[this.selectedRole] = false;
							this.messageService.add({
								severity: 'success',
								summary: 'Éxito',
								detail: `Permisos del rol ${this.selectedRole} actualizados correctamente`,
								life: 5000
							});

							// Actualizar el servicio de autenticación después de guardar
							if (
								this.authService.getCurrentUser()?.rol === this.selectedRole
							) {
								this.authService.refreshPermissions().subscribe();
							}
						},
						error: (err) => {
							this.savingRole[this.selectedRole] = false;
							console.error('Error guardando permisos:', err);
							this.messageService.add({
								severity: 'error',
								summary: 'Error',
								detail: 'No se pudieron guardar los permisos',
								life: 5000
							});
						}
					});
			}
		});
	}

	/**
	 * Reinicia los permisos al estado guardado
	 */
	resetPermissions(): void {
		this.loadRolePermissions();
		this.messageService.add({
			severity: 'info',
			summary: 'Reiniciado',
			detail: 'Los cambios han sido descartados',
			life: 3000
		});
	}

	/**
	 * Verifica si los permisos han sido modificados
	 */
	hasChanges(): boolean {
		if (this.selectedRole === 'ADMIN') {
			return false; // ADMIN no se puede editar
		}

		const currentPermissions = this.rolePermissions[this.selectedRole] || [];
		const currentIds = new Set(currentPermissions.map((p) => p.id));
		const selectedIds = Object.keys(this.selectedPermissions)
			.filter((id) => this.selectedPermissions[+id])
			.map((id) => +id);

		if (currentIds.size !== selectedIds.length) {
			return true;
		}

		return selectedIds.some((id) => !currentIds.has(id));
	}

	/**
	 * Filtra permisos de un recurso específico
	 */
	getResourcePermissions(resource: string): Permission[] {
		return this.permissionsByResource[resource] || [];
	}

	/**
	 * Verifica cuántos permisos de un recurso están seleccionados
	 */
	getResourceSelectedCount(resource: string): number {
		const permissions = this.getResourcePermissions(resource);
		return permissions.filter((p) => this.selectedPermissions[p.id]).length;
	}

	/**
	 * Obtiene label descriptivo para un rol
	 */
	getRoleLabel(role: string): string {
		const labels: { [key: string]: string } = {
			ADMIN: 'Administrador',
			MESERO: 'Mesero/Operativo',
			COCINA: 'Cocina'
		};
		return labels[role] || role;
	}

	/**
	 * Obtiene descripción para un rol
	 */
	getRoleDescription(role: string): string {
		const descriptions: { [key: string]: string } = {
			ADMIN: 'Acceso total al sistema',
			MESERO: 'Acceso a comanda, órdenes y redenciones',
			COCINA: 'Acceso solo a órdenes pendientes y estado'
		};
		return descriptions[role] || '';
	}

	/**
	 * Verifica si puede deshabilitar checkbox (para comparación de tipos)
	 */
	isAdminRole(): boolean {
		return this.selectedRole === 'ADMIN';
	}
}
