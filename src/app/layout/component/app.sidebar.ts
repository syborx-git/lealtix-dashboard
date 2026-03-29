import { Component, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { AppMenu } from './app.menu';
import { ButtonModule } from 'primeng/button';
import { CommonModule } from '@angular/common';
import { UserProfileComponent } from '@/shared/components/user-profile.component';

@Component({
    selector: 'app-sidebar',
    standalone: true,
    imports: [AppMenu, ButtonModule, CommonModule, UserProfileComponent],
    template: ` <div class="layout-sidebar">
        <div class="layout-menu-wrapper">
            <app-menu></app-menu>
        </div>
        <div class="sidebar-footer" style="display: flex; flex-direction: column; height: auto; justify-content: space-between; gap: 16px; padding: 16px; border-top: 1px solid var(--surface-border);">
            <div class="sidebar-user-section">
                <app-user-profile></app-user-profile>
            </div>
            <button pButton type="button" icon="pi pi-power-off" class="p-button-text logout-button" (click)="logout()" style="width: 100%; margin-top: auto;">Cerrar Sesión</button>
        </div>
    </div>`
})
export class AppSidebar {
    constructor(public el: ElementRef, private router: Router) {}

    logout(): void {
        try {
            sessionStorage.clear();
            localStorage.clear();
        } catch (e) {
            console.warn('Error clearing storage during logout', e);
        }
        // Navigate to login page
        this.router.navigate(['/dashboard/auth/login']).then(() => {
            // ensure a fresh state
            window.location.reload();
        });
    }
}
