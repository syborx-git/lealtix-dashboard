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
        <div class="sidebar-footer" style="display: flex; flex-direction: column; gap: 14px; padding: 14px 0 0 0; border-top: 1.5px solid var(--lealtix-glass-border);">
            <div class="sidebar-user-section w-full">
                <app-user-profile></app-user-profile>
            </div>
            <button pButton type="button" icon="pi pi-power-off" class="p-button-text p-button-danger logout-button" (click)="logout()" style="width: 100%; border-radius: 10px; font-weight: 600; justify-content: center; height: 32px; font-size: 0.8125rem;">Cerrar Sesión</button>
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
