import { Component, ChangeDetectionStrategy, computed, inject, signal, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TooltipModule } from 'primeng/tooltip';
import { MenuListComponent } from '../component/menu-list/menu-list.component';
import { LayoutService } from '../service/layout.service';
import { MenuService, MenuSection } from '../service/menu.service';
import { AuthService } from '@/auth/auth.service';
import { NotificationService, AppNotification } from '@/shared/services/notification.service';

@Component({
    selector: 'app-sidebar',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule, TooltipModule, MenuListComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './sidebar.component.html',
    styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
    readonly layoutService = inject(LayoutService);
    readonly notifications = inject(NotificationService);
    private readonly menuService = inject(MenuService);
    private readonly authService = inject(AuthService);
    private readonly router = inject(Router);

    @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

    /** Término de búsqueda en vivo para filtrar el menú en modo expandido. */
    readonly searchQuery = signal<string>('');

    /** `true` = barra reducida a iconos. Fuente única de verdad: el LayoutService. */
    readonly collapsed = computed(() => this.layoutService.isSidebarCollapsed());

    /** Estado del tema oscuro. */
    readonly isDarkTheme = computed(() => this.layoutService.isDarkTheme());

    /** Contador de notificaciones no leídas. */
    readonly unreadCount = computed(() => this.notifications.unreadCount());

    /** Secciones visibles según rol y permisos del usuario actual. */
    readonly visibleSections = this.menuService.visibleSections;

    readonly currentUser = computed(() => this.authService.getCurrentUser());

    readonly userDisplayName = computed(() => {
        const u = this.currentUser();
        return u?.nombre || u?.userName || u?.email?.split('@')[0] || 'Usuario';
    });

    readonly userRoleName = computed(() => {
        const u = this.currentUser();
        const role = (u?.role || u?.rol || 'USUARIO').toUpperCase();
        switch (role) {
            case 'ADMIN': return 'Administrador';
            case 'MESERO': return 'Mesero';
            case 'COCINA': return 'Cocina';
            case 'BARRA': return 'Barra';
            case 'CAJA': return 'Cajero';
            case 'HOSTESS': return 'Hostess';
            case 'MARKETING': return 'Marketing';
            default: return role;
        }
    });

    readonly userInitials = computed(() => {
        const name = this.userDisplayName();
        if (!name) return 'U';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    });

    /** Estados de los paneles flotantes anclados a la barra */
    readonly isUserMenuOpen = signal<boolean>(false);
    readonly isNotifPanelOpen = signal<boolean>(false);
    readonly isMobileSidebarOpen = signal<boolean>(false);

    constructor() {
        this.menuService.init();
    }

    onToggle(): void {
        this.closeAllFlyouts();
        this.layoutService.toggleSidebar();
    }

    onNavigated(): void {
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            this.layoutService.setSidebarCollapsed(true);
        }
    }

    /**
     * Al hacer clic en un icono con la barra colapsada:
     * - Se despliega el menú completo
     * - Se despliegan las opciones de ese icono inmediatamente
     */
    onSectionIconClick(section: MenuSection): void {
        this.closeAllFlyouts();
        this.layoutService.openGroupFromCollapsed(section.id);
    }

    /**
     * Determina si la sección actual contiene la ruta activa.
     */
    isSectionActive(section: MenuSection): boolean {
        const currentUrl = (this.router.url || '').split('?')[0].split('#')[0];
        if (!currentUrl) return false;
        return section.items.some(item => {
            if (!item.routerLink) return false;
            const link = Array.isArray(item.routerLink) ? item.routerLink.join('/') : item.routerLink;
            return currentUrl === link || (link !== '/dashboard' && currentUrl.startsWith(link));
        });
    }

    onSearchClick(): void {
        this.closeAllFlyouts();
        this.layoutService.expandSidebar();
        setTimeout(() => {
            this.searchInput?.nativeElement?.focus();
        }, 150);
    }

    // ==========================================================================
    // CAMBIO DE TEMA (CLARO / OSCURO)
    // ==========================================================================
    toggleDarkMode(): void {
        this.layoutService.toggleDarkModeFromUi();
    }

    // ==========================================================================
    // NOTIFICACIONES
    // ==========================================================================
    toggleNotifications(): void {
        this.isUserMenuOpen.set(false);
        this.isNotifPanelOpen.update(v => !v);
        if (this.isNotifPanelOpen()) {
            setTimeout(() => this.notifications.markAllRead(), 800);
        }
    }

    openNotification(n: AppNotification): void {
        this.notifications.markRead(n.id);
        this.isNotifPanelOpen.set(false);
        const route = this.notifications.resolveRoute(n);
        if (route) {
            void this.router.navigateByUrl(route);
        }
    }

    notificationTimeAgo(ts: number): string {
        const diff = Date.now() - ts;
        const min = Math.floor(diff / 60000);
        if (min < 1) return 'ahora';
        if (min < 60) return `hace ${min} min`;
        const h = Math.floor(min / 60);
        if (h < 24) return `hace ${h} h`;
        const d = Math.floor(h / 24);
        return `hace ${d} d`;
    }

    // ==========================================================================
    // MENÚ DE USUARIO (CONFIGURACIÓN Y CERRAR SESIÓN)
    // ==========================================================================
    toggleUserMenu(): void {
        this.isNotifPanelOpen.set(false);
        this.isUserMenuOpen.update(v => !v);
    }

    closeAllFlyouts(): void {
        this.isUserMenuOpen.set(false);
        this.isNotifPanelOpen.set(false);
    }

    onSettings(): void {
        this.closeAllFlyouts();
        this.router.navigate(['/dashboard/adminPage']);
    }

    onLogout(): void {
        this.closeAllFlyouts();
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

    // ==========================================================================
    // MÓVIL
    // ==========================================================================
    toggleMobileSidebar(): void {
        this.closeAllFlyouts();
        this.isMobileSidebarOpen.update(v => !v);
    }

    closeMobileSidebar(): void {
        this.isMobileSidebarOpen.set(false);
        this.closeAllFlyouts();
    }

    // ==========================================================================
    // ACCESOS POR TECLADO
    // ==========================================================================
    @HostListener('document:keydown.escape')
    onEscape(): void {
        if (this.isUserMenuOpen() || this.isNotifPanelOpen() || this.isMobileSidebarOpen()) {
            this.closeAllFlyouts();
            this.closeMobileSidebar();
        }
    }

    @HostListener('document:keydown', ['$event'])
    onKeydown(e: KeyboardEvent): void {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            this.onSearchClick();
        }
    }
}
