import { Component, ChangeDetectionStrategy, OnInit, computed, inject, input, output, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { filter } from 'rxjs';
import { LayoutService } from '../../service/layout.service';
import { MenuSection, MenuService } from '../../service/menu.service';

/**
 * Lista de navegación reutilizable.
 *
 * La usan tanto el sidebar de escritorio como el drawer móvil: así ambos
 * comparten el mismo modelo, los mismos permisos y el mismo estado de submenús.
 */
@Component({
    selector: 'app-menu-list',
    standalone: true,
    imports: [CommonModule, RouterModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './menu-list.component.html'
})
export class MenuListComponent implements OnInit {
    /** Versión móvil: nunca se colapsa, los textos siempre son visibles. */
    readonly mobile = input<boolean>(false);
    /** Notifica la navegación al contenedor (el drawer móvil se cierra). */
    readonly navigated = output<void>();

    readonly layoutService = inject(LayoutService);
    private readonly menuService = inject(MenuService);
    private readonly router = inject(Router);

    readonly sections = this.menuService.visibleSections;

    readonly collapsed = computed(() => (this.mobile() ? false : this.layoutService.isSidebarCollapsed()));

    constructor() {
        // Auto-abrir la sección correspondiente a la ruta actual cuando se cargan las secciones
        effect(() => {
            const sections = this.sections();
            if (sections.length > 0) {
                this.autoOpenActiveSection();
            }
        });
    }

    ngOnInit(): void {
        this.router.events
            .pipe(filter(event => event instanceof NavigationEnd))
            .subscribe(() => {
                this.autoOpenActiveSection();
            });
    }

    private autoOpenActiveSection(): void {
        const currentUrl = (this.router.url || '').split('?')[0].split('#')[0];
        if (!currentUrl) return;

        const sections = this.sections();
        for (const section of sections) {
            const match = this.itemsOf(section).some(item => {
                if (!item.routerLink) return false;
                const link = Array.isArray(item.routerLink) ? item.routerLink.join('/') : item.routerLink;
                return currentUrl === link || (link !== '/dashboard' && currentUrl.startsWith(link));
            });
            if (match) {
                this.layoutService.setSubmenuOpen(section.id, true);
                break;
            }
        }
    }

    /**
     * Ítems visibles de una sección.
     *
     * `visible: false` es el mecanismo que usa el menú para ocultar entradas
     * según el estado del tenant (p. ej. "Mi Página" sin productos, "Comanda"
     * para COCINA), igual que hacía el componente legacy.
     */
    itemsOf(section: MenuSection): MenuItem[] {
        return section.items.filter(item => item.visible !== false);
    }

    isOpen(section: MenuSection): boolean {
        return this.layoutService.isSubmenuOpen(section.id);
    }

    /**
     * Click sobre un grupo con submenú.
     *
     * Con el sidebar colapsado el usuario solo ve el icono: en ese caso se
     * expande la barra completa y se despliega el submenú en el mismo clic
     * (regla de UX), en lugar de ignorar el clic o dejar un icono "muerto".
     */
    onSectionClick(section: MenuSection): void {
        if (this.collapsed()) {
            this.layoutService.openGroupFromCollapsed(section.id);
            return;
        }
        this.layoutService.toggleSubmenu(section.id);
    }

    onItemClick(item: MenuItem): void {
        if (item.disabled) {
            return;
        }
        if (this.mobile()) {
            this.layoutService.closeMobileMenu();
        }
        this.navigated.emit();
    }
}
