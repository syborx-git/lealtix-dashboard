import { Component } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { StyleClassModule } from 'primeng/styleclass';
import { AppConfigurator } from './app.configurator';
import { LayoutService } from '../service/layout.service';
import { UserProfileComponent } from '@/shared/components/user-profile.component';

@Component({
    selector: 'app-topbar',
    standalone: true,
    imports: [RouterModule, CommonModule, StyleClassModule, AppConfigurator, UserProfileComponent],
    template: ` <div class="layout-topbar">
        <div class="navbar-container">
            <!-- Lado Izquierdo: Buscador -->
            <div class="navbar-left">
                <div class="search-wrapper">
                    <i class="pi pi-search search-icon"></i>
                    <input type="text" placeholder="Search [CTRL + K]" class="search-input" />
                </div>
            </div>

            <!-- Lado Derecho: Acciones, Notificaciones y Perfil -->
            <div class="navbar-actions">
                <button class="nav-icon-btn" title="Tema" (click)="toggleDarkMode()">
                    <i [ngClass]="{ 'pi': true, 'pi-moon': layoutService.isDarkTheme(), 'pi-sun': !layoutService.isDarkTheme() }"></i>
                </button>

                <button class="nav-icon-btn notification-btn" title="Notificaciones">
                    <i class="pi pi-bell"></i>
                    <span class="notification-badge"></span>
                </button>

                <app-user-profile [simple]="true"></app-user-profile>
            </div>
        </div>
    </div>`,
    styles: [`
        .navbar-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            background-color: var(--surface-card);
            padding: 0.6rem 1.25rem;
            border-radius: 12px;
            box-shadow: 0 2px 6px rgba(67, 89, 113, 0.08);
            border: 1px solid var(--surface-border);
            width: 100%;
        }

        .navbar-left {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            flex: 1;
            min-width: 0;
        }

        .menu-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 38px;
            height: 38px;
            border-radius: 8px;
            border: none;
            background: transparent;
            color: var(--text-color-secondary);
            font-size: 1.1rem;
            cursor: pointer;
            transition: background-color 0.2s ease;
        }

        .menu-btn:hover {
            background-color: var(--surface-hover);
        }

        .search-wrapper {
            display: flex;
            align-items: center;
            gap: 0.6rem;
            flex: 1;
            max-width: 400px;
            min-width: 0;
        }

        .search-icon {
            color: var(--text-color-secondary);
            font-size: 1.1rem;
        }

        .search-input {
            border: none;
            outline: none;
            background: transparent;
            width: 100%;
            font-size: 0.95rem;
            color: var(--text-color);
        }

        .search-input::placeholder {
            color: var(--text-color-secondary);
        }

        .navbar-actions {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .nav-icon-btn {
            background: transparent;
            border: none;
            width: 38px;
            height: 38px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-color-secondary);
            font-size: 1.1rem;
            cursor: pointer;
            transition: background-color 0.2s ease;
            position: relative;
        }

        .nav-icon-btn:hover {
            background-color: var(--surface-hover);
        }

        .notification-badge {
            position: absolute;
            top: 6px;
            right: 6px;
            width: 8px;
            height: 8px;
            background-color: #ff3e1d;
            border-radius: 50%;
            border: 2px solid var(--surface-card);
        }

        @media (max-width: 640px) {
            .search-wrapper { max-width: 160px; }
            .nav-icon-btn:nth-child(1),
            .nav-icon-btn:nth-child(3) { display: none; }
        }
    `]
})
export class AppTopbar {
    items!: MenuItem[];

    constructor(public layoutService: LayoutService) {}

    toggleDarkMode() {
        this.layoutService.layoutConfig.update((state) => ({ ...state, darkTheme: !state.darkTheme }));
    }
}
