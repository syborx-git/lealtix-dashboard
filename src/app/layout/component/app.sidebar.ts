import { Component, ElementRef } from '@angular/core';
import { AppMenu } from './app.menu';
import { CommonModule } from '@angular/common';
import { LayoutService } from '../service/layout.service';

@Component({
    selector: 'app-sidebar',
    standalone: true,
    imports: [AppMenu, CommonModule],
    template: ` <div class="layout-sidebar"
        [ngClass]="{ 'sidebar-collapsed': isCollapsed, 'hover-expanded': isHovered }"
        (mouseenter)="onMouseEnter()"
        (mouseleave)="onMouseLeave()">
        <!-- Encabezado con marca Lealtix y botón pin -->
        <div class="sidebar-header">
            <div class="brand-logo">
                <img src="https://res.cloudinary.com/lealtix-media/image/upload/q_auto/f_auto/v1759897289/lealtix_logo_transp_qcp5h9.png" alt="Lealtix Logo" class="logo-img" />
                <span class="logo-text">LEALTIX</span>
            </div>
            <button class="toggle-pin-btn" (click)="toggleSidebar()" title="Fijar / Colapsar">
                <i class="pi" [ngClass]="isCollapsed ? 'pi-circle' : 'pi-circle-fill'"></i>
            </button>
        </div>

        <div class="layout-menu-wrapper">
            <app-menu></app-menu>
        </div>
    </div>`
})
export class AppSidebar {
    isHovered = false;

    constructor(public el: ElementRef, public layoutService: LayoutService) {}

    get isCollapsed(): boolean {
        return !!this.layoutService.layoutState().staticMenuDesktopInactive;
    }

    toggleSidebar(): void {
        this.layoutService.layoutState.update((prev) => ({
            ...prev,
            staticMenuDesktopInactive: !prev.staticMenuDesktopInactive
        }));
    }

    onMouseEnter(): void {
        if (this.isCollapsed) {
            this.isHovered = true;
        }
    }

    onMouseLeave(): void {
        if (this.isCollapsed) {
            this.isHovered = false;
        }
    }
}
