import { Injectable, effect, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';

export interface layoutConfig {
    preset?: string;
    primary?: string;
    surface?: string | undefined | null;
    darkTheme?: boolean;
    menuMode?: string;
}

interface LayoutState {
    staticMenuDesktopInactive?: boolean;
    overlayMenuActive?: boolean;
    configSidebarVisible?: boolean;
    staticMenuMobileActive?: boolean;
    menuHoverActive?: boolean;
}

interface MenuChangeEvent {
    key: string;
    routeEvent?: boolean;
}

/** Clases de ancho del sidebar: completo (w-64) y reducido (w-20, solo iconos). */
export const SIDEBAR_CLASS = {
    expanded: 'w-64',
    collapsed: 'w-20'
} as const;

/** Breakpoint `lg` del proyecto (992px) en píxeles, usado para decidir desktop vs móvil. */
export const DESKTOP_BREAKPOINT = 992;

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'lealtix.sidebar.collapsed';

@Injectable({
    providedIn: 'root'
})
export class LayoutService {
    _config: layoutConfig = {
        preset: 'Aura',
        primary: 'indigo',
        surface: null,
        darkTheme: false,
        menuMode: 'static'
    };

    _state: LayoutState = {
        staticMenuDesktopInactive: false,
        overlayMenuActive: false,
        configSidebarVisible: false,
        staticMenuMobileActive: false,
        menuHoverActive: false
    };

    layoutConfig = signal<layoutConfig>(this._config);

    layoutState = signal<LayoutState>(this._state);

    private configUpdate = new Subject<layoutConfig>();

    private overlayOpen = new Subject<any>();

    private menuSource = new Subject<MenuChangeEvent>();

    private resetSource = new Subject();

    menuSource$ = this.menuSource.asObservable();

    resetSource$ = this.resetSource.asObservable();

    configUpdate$ = this.configUpdate.asObservable();

    overlayOpen$ = this.overlayOpen.asObservable();

    theme = computed(() => (this.layoutConfig()?.darkTheme ? 'dark' : 'light'));

    isSidebarActive = computed(() => this.layoutState().overlayMenuActive || this.layoutState().staticMenuMobileActive);

    isDarkTheme = computed(() => this.layoutConfig().darkTheme);

    getPrimary = computed(() => this.layoutConfig().primary);

    getSurface = computed(() => this.layoutConfig().surface);

    isOverlay = computed(() => this.layoutConfig().menuMode === 'overlay');

    transitionComplete = signal<boolean>(false);

    // ==========================================================================
    // Estado compartido del Shell (Sidebar colapsable + Drawer móvil)
    // Vive aquí para que Sidebar, Header (hamburguesa) y Drawer estén sincronizados.
    // ==========================================================================

    /** `true` = barra reducida a iconos (w-20). `false` = barra completa (w-64). */
    readonly isSidebarCollapsed = signal<boolean>(LayoutService.readCollapsedFromStorage());

    /** `true` = panel móvil (off-canvas) abierto. */
    readonly isMobileMenuOpen = signal<boolean>(false);

    /**
     * Estado independiente de cada menú desplegable.
     * Clave = id del grupo, valor = abierto/cerrado. Al vivir en un record,
     * cada menú conserva su propio booleano sin interferir con los demás.
     */
    private readonly openSubmenus = signal<Record<string, boolean>>({});

    /** Clases de ancho a aplicar al contenedor del sidebar. */
    readonly sidebarWidthClass = computed(() => (this.isSidebarCollapsed() ? SIDEBAR_CLASS.collapsed : SIDEBAR_CLASS.expanded));

    /** Padding izquierdo del área de contenido, sincronizado con el ancho del sidebar. */
    readonly contentPaddingClass = computed(() => (this.isSidebarCollapsed() ? 'lg:pl-20' : 'lg:pl-64'));

    private initialized = false;

    constructor() {
        effect(() => {
            const config = this.layoutConfig();
            if (config) {
                this.onConfigUpdate();
            }
        });

        effect(() => {
            const config = this.layoutConfig();

            if (!this.initialized || !config) {
                this.initialized = true;
                return;
            }

            this.handleDarkModeTransition(config);
        });

        // El drawer móvil bloquea el scroll del body mientras está abierto.
        effect((onCleanup) => {
            if (!this.isMobileMenuOpen()) {
                return;
            }
            document.body.classList.add('overflow-hidden');
            onCleanup(() => document.body.classList.remove('overflow-hidden'));
        });
    }

    // ==========================================================================
    // Sidebar colapsable
    // ==========================================================================

    toggleSidebar(): void {
        this.setSidebarCollapsed(!this.isSidebarCollapsed());
    }

    setSidebarCollapsed(collapsed: boolean): void {
        this.isSidebarCollapsed.set(collapsed);
        this.layoutState.update((prev) => ({ ...prev, staticMenuDesktopInactive: collapsed }));

        try {
            localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0');
        } catch {
            // localStorage puede estar bloqueado (modo privado): la preferencia solo vive en memoria
        }
    }

    expandSidebar(): void {
        if (this.isSidebarCollapsed()) {
            this.setSidebarCollapsed(false);
        }
    }

    // ==========================================================================
    // Drawer móvil
    // ==========================================================================

    toggleMobileMenu(): void {
        this.isMobileMenuOpen.update(open => !open);
    }

    openMobileMenu(): void {
        this.closeAllSubmenus();
        this.isMobileMenuOpen.set(true);
    }

    closeMobileMenu(): void {
        this.isMobileMenuOpen.set(false);
    }

    // ==========================================================================
    // Menús desplegables (estado independiente por menú)
    // ==========================================================================

    isSubmenuOpen(id: string): boolean {
        return !!this.openSubmenus()[id];
    }

    setSubmenuOpen(id: string, open: boolean): void {
        this.openSubmenus.update(state => (state[id] === open ? state : { ...state, [id]: open }));
    }

    toggleSubmenu(id: string): void {
        this.setSubmenuOpen(id, !this.isSubmenuOpen(id));
    }

    closeAllSubmenus(): void {
        if (Object.keys(this.openSubmenus()).length > 0) {
            this.openSubmenus.set({});
        }
    }

    /**
     * Regla de UX: al pulsar un ítem con submenú con el sidebar colapsado,
     * se expande la barra completa y se despliega el submenú, en lugar de
     * dejar al usuario con un icono pulsado que no parece hacer nada.
     */
    openGroupFromCollapsed(id: string): void {
        this.expandSidebar();
        this.setSubmenuOpen(id, true);
    }

    // ==========================================================================
    // Utilidades responsive / tema
    // ==========================================================================

    isDesktop(): boolean {
        return typeof window !== 'undefined' && window.innerWidth >= DESKTOP_BREAKPOINT;
    }

    isMobile(): boolean {
        return !this.isDesktop();
    }

    /** Si se pasa a desktop con el drawer abierto, se cierra para no dejarlo huérfano. */
    syncBreakpoint(): void {
        if (this.isDesktop() && this.isMobileMenuOpen()) {
            this.closeMobileMenu();
        }
    }

    toggleDarkModeFromUi(): void {
        this.layoutConfig.update(state => ({ ...state, darkTheme: !state.darkTheme }));
    }

    private static readCollapsedFromStorage(): boolean {
        try {
            return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === '1';
        } catch {
            return false;
        }
    }

    // ==========================================================================
    // Machinery original de PrimeNG (se conserva para los componentes heredados)
    // ==========================================================================

    private handleDarkModeTransition(config: layoutConfig): void {
        if ((document as any).startViewTransition) {
            this.startViewTransition(config);
        } else {
            this.toggleDarkMode(config);
            this.onTransitionEnd();
        }
    }

    private startViewTransition(config: layoutConfig): void {
        const transition = (document as any).startViewTransition(() => {
            this.toggleDarkMode(config);
        });

        transition.ready
            .then(() => {
                this.onTransitionEnd();
            })
            .catch(() => {});
    }

    toggleDarkMode(config?: layoutConfig): void {
        const _config = config || this.layoutConfig();
        if (_config.darkTheme) {
            document.documentElement.classList.add('app-dark');
        } else {
            document.documentElement.classList.remove('app-dark');
        }
    }

    private onTransitionEnd() {
        this.transitionComplete.set(true);
        setTimeout(() => {
            this.transitionComplete.set(false);
        });
    }

    onMenuToggle() {
        if (this.isOverlay()) {
            this.layoutState.update((prev) => ({ ...prev, overlayMenuActive: !this.layoutState().overlayMenuActive }));

            if (this.layoutState().overlayMenuActive) {
                this.overlayOpen.next(null);
            }
        }

        if (this.isDesktop()) {
            this.layoutState.update((prev) => ({ ...prev, staticMenuDesktopInactive: !this.layoutState().staticMenuDesktopInactive }));
        } else {
            this.layoutState.update((prev) => ({ ...prev, staticMenuMobileActive: !this.layoutState().staticMenuMobileActive }));

            if (this.layoutState().staticMenuMobileActive) {
                this.overlayOpen.next(null);
            }
        }
    }

    onConfigUpdate() {
        this._config = { ...this.layoutConfig() };
        this.configUpdate.next(this.layoutConfig());
    }

    onMenuStateChange(event: MenuChangeEvent) {
        this.menuSource.next(event);
    }

    reset() {
        this.resetSource.next(true);
    }
}
