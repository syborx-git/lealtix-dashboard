import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { AuthService, User } from '@/auth/auth.service';

@Component({
	selector: 'app-user-profile',
	standalone: true,
	imports: [CommonModule],
	template: `
		<div *ngIf="currentUser$ | async as user" class="user-profile-container" [title]="'Usuario: ' + (user.userName || user.email) + ' | Rol: ' + formatRole(user.role || user.rol)">
			<div class="user-profile-avatar">
				<i class="pi pi-user"></i>
			</div>
			<div class="user-profile-info">
				<div class="user-profile-name">{{ user.userName || user.email }}</div>
				<div class="user-profile-role">{{ formatRole(user.role || user.rol) }}</div>
			</div>
		</div>
	`,
	styleUrls: ['./user-profile.component.scss']
})
export class UserProfileComponent implements OnInit {
	currentUser$: Observable<User | null>;

	constructor(private authService: AuthService) {
		this.currentUser$ = this.authService.getCurrentUser$();
	}

	ngOnInit(): void {}

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
