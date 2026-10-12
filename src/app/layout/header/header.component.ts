import { Component, ChangeDetectionStrategy, HostListener, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { MenuListComponent } from '../component/menu-list/menu-list.component';
import { LayoutService } from '../service/layout.service';
import { MenuService } from '../service/menu.service';
import { UserProfileComponent } from '@/shared/components/user-profile.component';
import { NotificationService, AppNotification } from '@/shared/services/notification.service';

@Component({
    selector: 'app-topbar',
    standalone: true,
    imports: [CommonModule, MenuListComponent, UserProfileComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit, OnDestroy {
    readonly layoutService = inject(LayoutService);

    private readonly menuService = inject(MenuService);

    private readonly router = inject(Router);

    private readonly subscriptions = new Subscription();

    readonly isDarkTheme = computed(() => this.layoutService.isDarkTheme());

    readonly isMobileMenuOpen = computed(() => this.layoutService.isMobileMenuOpen());

    readonly collapsed = computed(() => this.layoutService.isSidebarCollapsed());

    readonly notifications = inject(NotificationService);

    toggleNotifications(): void {
        this.notifications.togglePanel();
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

    /** Abre el apartado indicado por la notificación. */
    openNotification(n: AppNotification): void {
        this.notifications.markRead(n.id);
        this.notifications.closePanel();
        if (n.route) {
            this.router.navigateByUrl(n.route);
        }
    }

    ngOnInit(): void {
        this.menuService.init();

        // Navegar cierra el drawer móvil si estaba abierto y sincroniza breakpoint.
        this.subscriptions.add(
            this.router.events
                .pipe(filter(event => event instanceof NavigationEnd))
                .subscribe(() => {
                    this.layoutService.closeMobileMenu();
                    this.layoutService.syncBreakpoint();
                })
        );
    }

    ngOnDestroy(): void {
        this.subscriptions.unsubscribe();
    }

    /** Cierra el drawer al pasar a desktop: allí el menú ya está en el sidebar. */
    @HostListener('window:resize')
    onResize(): void {
        this.layoutService.syncBreakpoint();
    }

    // ==========================================================================
    // Drawer móvil
    // ==========================================================================

    onToggleMobileMenu(): void {
        this.layoutService.toggleMobileMenu();
    }

    /** Cierre al pulsar la capa oscura (bg-black/50 fixed inset-0). */
    onBackdropClick(): void {
        this.layoutService.closeMobileMenu();
    }

    /** Cierre con la tecla Escape: accessibility básico del off-canvas. */
    @HostListener('document:keydown.escape')
    onEscape(): void {
        if (this.layoutService.isMobileMenuOpen()) {
            this.layoutService.closeMobileMenu();
        }
    }

    // ==========================================================================
    // Sidebar de escritorio
    // ==========================================================================

    onToggleSidebar(): void {
        this.layoutService.toggleSidebar();
    }

    // ==========================================================================
    // Tema y acciones
    // ==========================================================================

    toggleDarkMode(): void {
        this.layoutService.toggleDarkModeFromUi();
    }
}
