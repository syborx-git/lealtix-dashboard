import { Component, OnInit, Input, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService, User } from '@/auth/auth.service';

@Component({
	selector: 'app-user-profile',
	standalone: true,
	imports: [CommonModule],
	template: `
		<div *ngIf="currentUser$ | async as user" class="profile-avatar-wrapper">
			<!-- Avatar clickeable -->
			<div class="avatar-trigger" (click)="toggleProfileMenu()" title="Perfil de usuario">
				<div class="user-profile-avatar">
					<i class="pi pi-user"></i>
				</div>
				<span class="status-indicator online"></span>
			</div>

			<!-- Menú desplegable -->
			<div *ngIf="isProfileMenuOpen" class="profile-dropdown-menu">
				<div class="dropdown-header">
					<div class="user-profile-avatar header-avatar">
						<i class="pi pi-user"></i>
					</div>
					<div class="user-info">
						<span class="user-name">{{ user.userName || user.email }}</span>
						<span class="user-role">{{ formatRole(user.role || user.rol) }}</span>
					</div>
				</div>

				<div class="dropdown-divider"></div>

				<ul class="dropdown-list">
					<li class="dropdown-item" (click)="onSettings()">
						<i class="pi pi-cog dropdown-icon"></i>
						<span>Configuración</span>
					</li>
					<div class="dropdown-divider"></div>
					<li class="dropdown-item logout-item" (click)="onLogout()">
						<i class="pi pi-power-off dropdown-icon"></i>
						<span>Cerrar Sesión</span>
					</li>
				</ul>
			</div>
		</div>
	`,
	styleUrls: ['./user-profile.component.scss']
})
export class UserProfileComponent implements OnInit {
	@Input() simple: boolean = false;
	isProfileMenuOpen = false;
	currentUser$: Observable<User | null>;

	constructor(private authService: AuthService, private router: Router) {
		this.currentUser$ = this.authService.getCurrentUser$();
	}

	ngOnInit(): void {}

	@HostListener('document:click', ['$event'])
	onClickOutside(event: Event) {
		const target = event.target as HTMLElement;
		if (!target.closest('.profile-avatar-wrapper')) {
			this.isProfileMenuOpen = false;
		}
	}

	toggleProfileMenu() {
		this.isProfileMenuOpen = !this.isProfileMenuOpen;
	}

	onSettings() {
		this.isProfileMenuOpen = false;
		this.router.navigate(['/dashboard/adminPage']);
	}

	onLogout() {
		this.isProfileMenuOpen = false;
		try {
			sessionStorage.clear();
			localStorage.clear();
		} catch (e) {
			console.warn('Error clearing storage during logout', e);
		}
		this.router.navigate(['/dashboard/auth/login']).then(() => {
			window.location.reload();
		});
	}

	formatRole(role: string | undefined): string {
		if (!role) return '';
		const roleMap: { [key: string]: string } = {
			'ADMIN': 'Administrador',
			'COCINA': 'Cocina',
			'MESERO': 'Mesero',
			'CAJA': 'Cajero'
		};
		return roleMap[role] || role;
	}
}
