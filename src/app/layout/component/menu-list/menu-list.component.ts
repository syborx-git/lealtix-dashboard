import { Component, ChangeDetectionStrategy, OnInit, computed, inject, Input, Output, EventEmitter, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { filter } from 'rxjs';
import { LayoutService } from '../../service/layout.service';
import { MenuSection, MenuService } from '../../service/menu.service';

/**
 * Lista de navegación reutilizable.
 *
 * Utilizada tanto en el sidebar de escritorio como en el drawer móvil.
 * Soporta filtrado en vivo por texto de búsqueda (`searchQuery`).
 */
@Component({
    selector: 'app-menu-list',
    standalone: true,
    imports: [CommonModule, RouterModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './menu-list.component.html',
    styles: [`
        :host {
            display: block;
            width: 100%;
        }

        /* ====================================================================
           ESTILOS POR DEFECTO: BLANCO Y MORADO (MÁXIMA LEGIBILIDAD)
           ==================================================================== */
        .menu-section-btn {
            background: transparent;
            color: #1e293b; /* Texto oscuro nítido y legible */
            border: 1px solid transparent;
            border-radius: 0.85rem;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

            span {
                color: #1e293b;
                transition: color 0.2s ease;
            }

            i {
                color: #4f46e5; /* Ícono morado Lealtix */
                transition: color 0.2s ease;
            }

            .pi-angle-down {
                color: #64748b;
            }

            &:hover {
                background: #f1f5f9;
                color: #0f172a;

                span {
                    color: #0f172a;
                }

                i {
                    color: #4338ca;
                }
            }

            &.active {
                background: #eef2ff;
                color: #312e81 !important; /* Morado profundo de alto contraste sobre lavanda */
                font-weight: 700 !important;
                border-color: #c7d2fe;
                box-shadow: 0 2px 8px rgba(99, 102, 241, 0.12);

                span {
                    color: #312e81 !important;
                    font-weight: 700 !important;
                }

                i {
                    color: #4f46e5 !important;
                }

                .pi-angle-down {
                    color: #4f46e5 !important;
                }
            }
        }

        .menu-sub-link {
            background: transparent;
            color: #334155; /* Texto oscuro bien definido */
            font-weight: 600;
            border: 1px solid transparent;
            border-radius: 0.75rem;
            cursor: pointer;
            transition: all 0.2s ease;

            span {
                color: #334155;
                font-weight: 600;
                transition: color 0.2s ease;
            }

            i {
                color: #6366f1;
                transition: color 0.2s ease;
            }

            &:hover {
                background: #f8fafc;
                color: #0f172a;
                font-weight: 600;

                span {
                    color: #0f172a;
                }

                i {
                    color: #4338ca;
                }
            }
        }

        /* Subítem activo: Morado sólido con letras blancas nítidas en negrita */
        .sub-item-active {
            background: #4f46e5 !important;
            color: #ffffff !important;
            font-weight: 700 !important;
            border: 1px solid #3730a3 !important;
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35) !important;

            span {
                color: #ffffff !important;
                font-weight: 700 !important;
            }

            i {
                color: #ffffff !important;
            }
        }

        /* ====================================================================
           ADAPTACIÓN AUTOMÁTICA EN MODO OSCURO
           ==================================================================== */
        :host-context(.app-dark) {
            .menu-section-btn {
                color: #cbd5e1;

                span {
                    color: #cbd5e1;
                }

                i {
                    color: #818cf8;
                }

                .pi-angle-down {
                    color: #94a3b8;
                }

                &:hover {
                    background: rgba(255, 255, 255, 0.08);
                    color: #ffffff;

                    span {
                        color: #ffffff;
                    }

                    i {
                        color: #a5b4fc;
                    }
                }

                &.active {
                    background: rgba(99, 102, 241, 0.25);
                    color: #ffffff !important;
                    border-color: rgba(99, 102, 241, 0.5);
                    box-shadow: 0 4px 14px rgba(79, 70, 229, 0.3);

                    span {
                        color: #ffffff !important;
                        font-weight: 700 !important;
                    }

                    i {
                        color: #c7d2fe !important;
                    }
                }
            }

            .menu-sub-link {
                color: #cbd5e1;

                span {
                    color: #cbd5e1;
                }

                i {
                    color: #818cf8;
                }

                &:hover {
                    background: rgba(255, 255, 255, 0.06);
                    color: #ffffff;

                    span {
                        color: #ffffff;
                    }

                    i {
                        color: #c7d2fe;
                    }
                }
            }

            .sub-item-active {
                background: #4f46e5 !important;
                color: #ffffff !important;
                border-color: #6366f1 !important;
                box-shadow: 0 4px 14px rgba(79, 70, 229, 0.45) !important;

                span {
                    color: #ffffff !important;
                    font-weight: 700 !important;
                }

                i {
                    color: #ffffff !important;
                }
            }
        }
    `]
})
export class MenuListComponent implements OnInit {
    /** Versión móvil: nunca se colapsa, los textos siempre son visibles. */
    @Input() mobile: boolean = false;

    private readonly _searchQuery = signal<string>('');

    /** Filtro de búsqueda en vivo. */
    @Input()
    set searchQuery(val: string) {
        this._searchQuery.set(val || '');
    }
    get searchQuery(): string {
        return this._searchQuery();
    }

    /** Notifica la navegación al contenedor (el drawer móvil se cierra). */
    @Output() navigated = new EventEmitter<void>();

    readonly layoutService = inject(LayoutService);
    private readonly menuService = inject(MenuService);
    private readonly router = inject(Router);

    readonly sections = this.menuService.visibleSections;

    readonly collapsed = computed(() => (this.mobile ? false : this.layoutService.isSidebarCollapsed()));

    /**
     * Secciones filtradas por el término de búsqueda.
     * Si no hay búsqueda, retorna todas las secciones visibles.
     */
    readonly filteredSections = computed(() => {
        const query = (this._searchQuery() || '').trim().toLowerCase();
        const all = this.sections();
        if (!query) {
            return all;
        }

        return all
            .map(section => {
                const sectionMatches = section.label.toLowerCase().includes(query);
                const matchingItems = this.itemsOf(section).filter(item => {
                    const label = (item.label || '').toLowerCase();
                    return label.includes(query);
                });

                if (sectionMatches) {
                    return section;
                }
                if (matchingItems.length > 0) {
                    return {
                        ...section,
                        items: matchingItems
                    };
                }
                return null;
            })
            .filter((s): s is MenuSection => s !== null);
    });

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
     */
    itemsOf(section: MenuSection): MenuItem[] {
        return section.items.filter(item => item.visible !== false);
    }

    isOpen(section: MenuSection): boolean {
        // Si hay búsqueda activa, expande automáticamente las secciones coincidentes
        if ((this.searchQuery || '').trim().length > 0) {
            return true;
        }
        return this.layoutService.isSubmenuOpen(section.id);
    }

    /**
     * Click sobre un grupo con submenú.
     *
     * Con el sidebar colapsado: se expande la barra completa y se despliegan
     * las opciones del ícono clickeado.
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
        if (this.mobile) {
            this.layoutService.closeMobileMenu();
        }
        this.navigated.emit();
    }
}
