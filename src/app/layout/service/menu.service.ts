import { Injectable, signal } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Subscription } from 'rxjs';
import { CategoryService } from '@/pages/categories-menu/service/category.service';
import { ProductService } from '@/pages/products-menu/service/product.service';
import { AuthService } from '@/auth/auth.service';

export interface MenuSection {
    /** Id estable: se usa como clave del estado independiente del submenú. */
    id: string;
    label: string;
    icon: string;
    items: MenuItem[];
}

/**
 * Fuente única del modelo de navegación.
 *
 * Antes vivía dentro de AppMenu (que solo lo usaba el sidebar). Al extraerlo a un
 * servicio, el sidebar de escritorio y el drawer móvil renderizan exactamente el
 * mismo menú, sin duplicar reglas de permisos ni listas que se desincronicen.
 */
@Injectable({ providedIn: 'root' })
export class MenuService {
    private readonly sections = signal<MenuSection[]>([]);

    private userPermissions: string[] = [];

    private readonly subscriptions = new Subscription();

    /** Sidebar y Drawer llaman a `init()`: solo la primera llamada tiene efecto. */
    private initialized = false;

    constructor(
        private categoryService: CategoryService,
        private productService: ProductService,
        private authService: AuthService
    ) {}

    /** Signal con las secciones visibles para el usuario actual. */
    readonly visibleSections = this.sections.asReadonly();

    init(): void {
        if (this.initialized) {
            return;
        }
        this.initialized = true;

        this.subscriptions.add(this.authService.getPermissions$().subscribe(permissions => {
            this.userPermissions = permissions || [];
            this.build();
        }));

        // Mismos eventos globales que ya emitía el menú original: se reevalúan
        // los ítems que dependen de datos vivos sin recargar la aplicación.
        const onCategoriesUpdated = () => this.refreshDynamicItems();
        const onProductsUpdated = () => this.refreshDynamicItems();

        if (typeof window !== 'undefined') {
            window.addEventListener('categoriesUpdated', onCategoriesUpdated);
            window.addEventListener('productsUpdated', onProductsUpdated);
        }

        this.subscriptions.add(() => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('categoriesUpdated', onCategoriesUpdated);
                window.removeEventListener('productsUpdated', onProductsUpdated);
            }
        });
    }

    dispose(): void {
        this.subscriptions.unsubscribe();
    }

    private build(): void {
        const categoriesItem: MenuItem = { label: 'Categorías', icon: 'pi pi-fw pi-tags', routerLink: ['/dashboard/categoriesMenu'], roles: ['ADMIN'], requiredPermissions: ['manage_categories'] };
        const productsItem: MenuItem = { label: 'Productos', icon: 'pi pi-fw pi-bars', routerLink: ['/dashboard/adminMenu'], disabled: true, title: 'Primero crea al menos una categoría', roles: ['ADMIN'], requiredPermissions: ['create_product', 'edit_product'] };
        const recetasItem: MenuItem = { label: 'Recetas', icon: 'pi pi-fw pi-book', routerLink: ['/dashboard/recetas'], roles: ['ADMIN'], requiredPermissions: ['manage_recetas'] };

        const allSections: MenuSection[] = [
            {
                id: 'servicio',
                label: 'Servicio',
                icon: 'pi pi-fw pi-wallet',
                items: [
                    { label: 'Mesas', icon: 'pi pi-fw pi-table', routerLink: ['/dashboard/mesas'], roles: ['HOSTESS', 'ADMIN'], requiredPermissions: ['view_mesas'] },
                    { label: 'Reservaciones', icon: 'pi pi-fw pi-calendar', routerLink: ['/dashboard/reservaciones'], roles: ['HOSTESS', 'ADMIN'], requiredPermissions: ['view_reservations'] },
                    { label: 'Comanda', icon: 'pi pi-fw pi-shopping-cart', routerLink: ['/dashboard/comandix'], roles: ['ADMIN', 'MESERO'], requiredPermissions: ['create_order'] },
                    { label: 'Cocina', icon: 'pi pi-fw pi-box', routerLink: ['/dashboard/cocina'], roles: ['ADMIN', 'COCINA'], requiredPermissions: ['view_kitchen_orders', 'update_order_status'] },
                    { label: 'Barra', icon: 'pi pi-fw pi-th-large', routerLink: ['/dashboard/barra'], roles: ['ADMIN', 'COCINA'], requiredPermissions: ['view_kitchen_orders', 'update_order_status'] },
                    { label: 'Caja', icon: 'pi pi-fw pi-wallet', routerLink: ['/dashboard/caja'], roles: ['ADMIN', 'CAJA'], requiredPermissions: ['process_payment'] }
                ]
            },
            {
                id: 'menu',
                label: 'Gestiona tu Menú',
                icon: 'pi pi-fw pi-shop',
                items: [categoriesItem, productsItem, recetasItem]
            },
            {
                id: 'equipo',
                label: 'Gestión de Equipo',
                icon: 'pi pi-fw pi-users',
                items: [
                    { label: 'Gestión de Equipo', icon: 'pi pi-fw pi-id-card', routerLink: ['/dashboard/users'], roles: ['ADMIN'], requiredPermissions: ['view_users', 'manage_user_roles'] },
                    { label: 'Horarios', icon: 'pi pi-fw pi-clock', routerLink: ['/dashboard/horarios'], roles: ['ADMIN'], requiredPermissions: ['manage_horarios'] }
                ]
            },
            {
                id: 'administrativa',
                label: 'Gestión Administrativa',
                icon: 'pi pi-fw pi-cog',
                items: [
                    { label: 'Dashboard', icon: 'pi pi-fw pi-home', routerLink: ['/dashboard/kpis'], roles: ['ADMIN', 'MARKETING', 'CAJA'], requiredPermissions: ['view_dashboard'] },
                    { label: 'Facturación', icon: 'pi pi-fw pi-file', routerLink: ['/dashboard/facturacion'], roles: ['ADMIN'], requiredPermissions: ['view_dashboard'] },
                    { label: 'Admin Page', icon: 'pi pi-fw pi-globe', routerLink: ['/dashboard/adminPage'], roles: ['ADMIN'], requiredPermissions: ['manage_admin_page'] },
                    { label: 'Mi Página', icon: 'pi pi-fw pi-qrcode', routerLink: ['/dashboard/mi-pagina'], visible: false, roles: ['ADMIN'], requiredPermissions: ['view_products'] },
                    { label: 'Dashboard Cocina', icon: 'pi pi-fw pi-chart-line', routerLink: ['/dashboard/cocina-dashboard'], roles: ['ADMIN', 'COCINA'], requiredPermissions: ['dashboard_kitchen'] },
                    { label: 'Gestión de Clientes', icon: 'pi pi-fw pi-users', routerLink: ['/dashboard/clientes'], roles: ['ADMIN'], requiredPermissions: ['view_customers'] }
                ]
            },
            {
                id: 'almacen',
                label: 'Almacén',
                icon: 'pi pi-fw pi-box',
                items: [
                    { label: 'Bodega', icon: 'pi pi-fw pi-database', routerLink: ['/dashboard/bodega'], roles: ['ADMIN'], requiredPermissions: ['view_products'] },
                    { label: 'Inventario de Cocina', icon: 'pi pi-fw pi-box', routerLink: ['/dashboard/inventario-cocina'], roles: ['ADMIN'], requiredPermissions: ['view_products'] },
                    { label: 'Inventario de Barra', icon: 'pi pi-fw pi-warehouse', routerLink: ['/dashboard/inventario-barra'], roles: ['ADMIN'], requiredPermissions: ['view_products'] },
                    { label: 'Mermas', icon: 'pi pi-fw pi-trash', routerLink: ['/dashboard/mermas'], roles: ['ADMIN'], requiredPermissions: ['manage_mermas'] }
                ]
            },
            {
                id: 'reportes',
                label: 'Reportes',
                icon: 'pi pi-fw pi-chart-bar',
                items: [
                    { label: 'Analitica de Ventas', icon: 'pi pi-fw pi-chart-line', routerLink: ['/dashboard/reportes/analitica/ventas'], roles: ['ADMIN', 'CAJA'], requiredPermissions: ['view_dashboard', 'view_reports', 'view_sales'] },
                    { label: 'Ventas y Comandas', icon: 'pi pi-fw pi-receipt', routerLink: ['/dashboard/reportes/ventas'], roles: ['ADMIN', 'CAJA'], requiredPermissions: ['view_dashboard', 'view_reports', 'view_sales'] },
                    { label: 'Transferencias de Bodega', icon: 'pi pi-fw pi-arrows-alt', routerLink: ['/dashboard/reportes/transferencias'], roles: ['ADMIN'], requiredPermissions: ['view_products'] },
                    { label: 'Reportes de Mermas', icon: 'pi pi-fw pi-database', routerLink: ['/dashboard/reportes/mermas'], roles: ['ADMIN'], requiredPermissions: ['manage_mermas'] }
                ]
            },
            {
                id: 'promociones',
                label: 'Promociones',
                icon: 'pi pi-fw pi-percentage',
                items: [
                    { label: 'Campañas', icon: 'pi pi-fw pi-id-card', routerLink: ['/dashboard/campaigns'], roles: ['ADMIN', 'MARKETING'], requiredPermissions: ['manage_campaigns'] },
                    { label: 'Plantillas', icon: 'pi pi-fw pi-file', routerLink: ['/dashboard/campaign-templates'], roles: ['ADMIN', 'MARKETING'], requiredPermissions: ['manage_campaign_templates'] },
                    { label: 'Redención', icon: 'pi pi-fw pi-ticket', routerLink: ['/dashboard/manual-redemption'], roles: ['ADMIN', 'MARKETING', 'CAJA'], requiredPermissions: ['process_redemption'] }
                ]
            }
        ];

        this.sections.set(
            allSections
                .map(section => ({ ...section, items: section.items.filter(item => this.hasRequiredPermissions(item)) }))
                .filter(section => section.items.length > 0)
        );

        this.refreshDynamicItems();
    }

    /** Re-evalúa los ítems que dependen de datos vivos (categorías, productos, cocina). */
    refreshDynamicItems(): void {
        this.checkAndUpdateProductsMenu();
        this.checkAndUpdateMiPaginaMenu();
        this.checkAndUpdateKitchenMenu();
    }

    private findItem(routerLink: string): MenuItem | undefined {
        const search = (items: MenuItem[] | undefined): MenuItem | undefined => {
            if (!items) return undefined;
            for (const item of items) {
                if (item.routerLink && item.routerLink[0] === routerLink) {
                    return item;
                }
                const found = search(item.items);
                if (found) return found;
            }
            return undefined;
        };
        return search(this.sections().flatMap(section => section.items));
    }

    private hasRequiredPermissions(item: any): boolean {
        const user = this.authService.getCurrentUser();
        const userRole = user?.role || user?.rol;

        if (item.roles && item.roles.length > 0 && !item.roles.includes(userRole)) {
            return false;
        }

        if (item.requiredRole && item.requiredRole !== userRole) {
            return false;
        }

        if (!item.requiredPermissions || item.requiredPermissions.length === 0) {
            return true;
        }

        return item.requiredPermissions.some((permission: string) => this.authService.hasPermission(permission));
    }

    private checkAndUpdateProductsMenu(): void {
        const tenantId = this.authService.getCurrentUser()?.tenantId;
        if (!tenantId) return;

        this.categoryService.checkCategoriesExist(tenantId).subscribe({
            next: hasCategories => {
                const productsItem = this.findItem('/dashboard/adminMenu');
                if (productsItem) {
                    productsItem.disabled = !hasCategories;
                    productsItem.title = hasCategories ? undefined : 'Primero crea al menos una categoría';
                }
                this.touch();
            },
            error: err => console.error('Error checking categories:', err)
        });
    }

    private checkAndUpdateMiPaginaMenu(): void {
        const user = this.authService.getCurrentUser();
        const userRole = user?.role || user?.rol;
        const tenantId = user?.tenantId;

        if (userRole === 'COCINA') {
            const miPaginaItem = this.findItem('/dashboard/mi-pagina');
            if (miPaginaItem) miPaginaItem.visible = false;
            const comandixItem = this.findItem('/dashboard/comandix');
            if (comandixItem) comandixItem.visible = false;
            this.touch();
            return;
        }

        if (!tenantId) return;

        this.productService.getProductsByTenantId(tenantId).subscribe({
            next: productResp => {
                const hasProducts = (productResp?.object || []).length > 0;
                const miPaginaItem = this.findItem('/dashboard/mi-pagina');
                if (miPaginaItem) miPaginaItem.visible = hasProducts;
                const comandixItem = this.findItem('/dashboard/comandix');
                if (comandixItem) comandixItem.visible = true;
                this.touch();
            },
            error: err => console.error('Error checking products:', err)
        });
    }

    private checkAndUpdateKitchenMenu(): void {
        const kitchenItem = this.findItem('/dashboard/cocina');
        if (kitchenItem) {
            kitchenItem.visible = true;
            kitchenItem.disabled = false;
        }
        this.touch();
    }

    /** Fuerza la re-emisión del signal cuando se mutan ítems en sitio. */
    private touch(): void {
        this.sections.update(current => current.map(section => ({ ...section, items: [...section.items] })));
    }
}
