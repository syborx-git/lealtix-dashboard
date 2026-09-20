import { Component, OnInit } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AppMenuitem } from './app.menuitem';
import { CategoryService } from '../../pages/categories-menu/service/category.service';
import { ProductService } from '../../pages/products-menu/service/product.service';
import { AuthService } from '../../auth/auth.service';
import { KitchenFeatureService } from '@/pages/kitchen/services/kitchen-feature.service';

@Component({
    selector: 'app-menu',
    standalone: true,
    imports: [NgFor, NgIf, AppMenuitem, RouterModule],
    template: `<ul class="layout-menu">
        <ng-container *ngFor="let item of model; let i = index">
            <li app-menuitem *ngIf="!item.separator" [item]="item" [index]="i" [root]="true"></li>
            <li *ngIf="item.separator" class="menu-separator"></li>
        </ng-container>
    </ul> `
})
export class AppMenu implements OnInit {
    model: MenuItem[] = [];
    private userPermissions: string[] = [];

    constructor(
        private categoryService: CategoryService,
        private productService: ProductService,
        private authService: AuthService,
        private kitchenFeatureService: KitchenFeatureService
    ) {
        // Listen for category updates
        window.addEventListener('categoriesUpdated', () => {
            this.checkAndUpdateProductsMenu();
        });

        // Listen for product updates to show/hide Mi Página
        window.addEventListener('productsUpdated', () => {
            this.checkAndUpdateMiPaginaMenu();
        });
    }

    ngOnInit() {
        // Obtener permisos del usuario
        this.authService.getPermissions$().subscribe(permissions => {
            this.userPermissions = permissions || [];
            this.buildMenu();
        });
    }

    private buildMenu() {
        const categoriesItem: MenuItem = { label: 'Categorías', icon: 'pi pi-fw pi-tags', routerLink: ['/dashboard/categoriesMenu'], roles: ['ADMIN'], requiredPermissions: ['manage_categories'] };
        const productsItem: MenuItem = { label: 'Productos', icon: 'pi pi-fw pi-bars', routerLink: ['/dashboard/adminMenu'], disabled: true, title: 'Primero crea al menos una categoría', roles: ['ADMIN'], requiredPermissions: ['create_product', 'edit_product'] };
        const recetasItem: MenuItem = { label: 'Recetas', icon: 'pi pi-fw pi-book', routerLink: ['/dashboard/recetas'], roles: ['ADMIN'], requiredPermissions: ['manage_recetas'] };

        const allMenuGroups: any[] = [
            {
                label: 'Servicio',
                icon: 'pi pi-fw pi-wallet',
                items: [
                    { label: 'Mesas', icon: 'pi pi-fw pi-table', routerLink: ['/dashboard/mesas'], roles: ['HOSTESS', 'ADMIN'], requiredPermissions: ['view_mesas'] },
                    { label: 'Reservaciones', icon: 'pi pi-fw pi-calendar', routerLink: ['/dashboard/reservaciones'], roles: ['HOSTESS', 'ADMIN'], requiredPermissions: ['view_reservaciones'] },
                    { label: 'Comanda', icon: 'pi pi-fw pi-shopping-cart', routerLink: ['/dashboard/comandix'], roles: ['ADMIN', 'MESERO'], requiredPermissions: ['create_order'] },
                    { label: 'Cocina', icon: 'pi pi-fw pi-box', routerLink: ['/dashboard/cocina'], roles: ['ADMIN', 'COCINA'], requiredPermissions: ['view_kitchen_orders', 'update_order_status'] },
                    { label: 'Barra', icon: 'pi pi-fw pi-th-large', routerLink: ['/dashboard/barra'], roles: ['ADMIN', 'COCINA'], requiredPermissions: ['view_kitchen_orders', 'update_order_status'] }
                ]
            },
            {
                label: 'Gestiona tu Menú',
                icon: 'pi pi-fw pi-shop',
                items: [categoriesItem, productsItem, recetasItem]
            },
            {
                label: 'Gestión de Equipo',
                icon: 'pi pi-fw pi-users',
                items: [
                    { label: 'Gestión de Equipo', icon: 'pi pi-fw pi-id-card', routerLink: ['/dashboard/users'], roles: ['ADMIN'], requiredPermissions: ['view_users', 'manage_user_roles'] },
                    { label: 'Horarios', icon: 'pi pi-fw pi-clock', routerLink: ['/dashboard/horarios'], roles: ['ADMIN'], requiredPermissions: ['manage_horarios'] }
                ]
            },
            {
                label: 'Gestión Administrativa',
                icon: 'pi pi-fw pi-cog',
                items: [
                    { label: 'Dashboard', icon: 'pi pi-fw pi-home', routerLink: ['/dashboard/kpis'], roles: ['ADMIN', 'MARKETING', 'CAJA'], requiredPermissions: ['view_dashboard'] },
                    { label: 'Admin Page', icon: 'pi pi-fw pi-globe', routerLink: ['/dashboard/adminPage'], roles: ['ADMIN'], requiredPermissions: ['manage_admin_page'] },
                    { label: 'Mi Página', icon: 'pi pi-fw pi-qrcode', routerLink: ['/dashboard/mi-pagina'], visible: false, roles: ['ADMIN'], requiredPermissions: ['view_products'] },
                    { label: 'Dashboard Cocina', icon: 'pi pi-fw pi-chart-line', routerLink: ['/dashboard/cocina-dashboard'], roles: ['ADMIN', 'COCINA'], requiredPermissions: ['dashboard_kitchen'] },
                    { label: 'Gestión de Clientes', icon: 'pi pi-fw pi-users', routerLink: ['/dashboard/clientes'], roles: ['ADMIN'], requiredPermissions: ['view_customers'] }
                ]
            },
            {
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
                label: 'Reportes',
                icon: 'pi pi-fw pi-chart-bar',
                items: [
                    { label: 'Ventas y Comandas', icon: 'pi pi-fw pi-receipt', routerLink: ['/dashboard/reportes/ventas'], roles: ['ADMIN', 'CAJA'], requiredPermissions: ['view_dashboard'] },
                    { label: 'Transferencias de Bodega', icon: 'pi pi-fw pi-arrows-alt', routerLink: ['/dashboard/reportes/transferencias'], roles: ['ADMIN'], requiredPermissions: ['view_products'] },
                    { label: 'Reportes de Mermas', icon: 'pi pi-fw pi-database', routerLink: ['/dashboard/reportes/mermas'], roles: ['ADMIN'], requiredPermissions: ['manage_mermas'] }
                ]
            },
            {
                label: 'Promociones',
                icon: 'pi pi-fw pi-percentage',
                items: [
                    { label: 'Campañas', icon: 'pi pi-fw pi-id-card', routerLink: ['/dashboard/campaigns'], roles: ['ADMIN', 'MARKETING'], requiredPermissions: ['manage_campaigns'] },
                    { label: 'Plantillas', icon: 'pi pi-fw pi-file', routerLink: ['/dashboard/campaign-templates'], roles: ['ADMIN', 'MARKETING'], requiredPermissions: ['manage_campaign_templates'] },
                    { label: 'Redención', icon: 'pi pi-fw pi-ticket', routerLink: ['/dashboard/manual-redemption'], roles: ['ADMIN', 'MARKETING', 'CAJA'], requiredPermissions: ['process_redemption'] }
                ]
            }
        ];

        // Filtrar items según permisos y descartar grupos vacíos
        const filteredGroups = allMenuGroups
            .map(group => ({ ...group, items: group.items.filter((item: any) => this.hasRequiredPermissions(item)) }))
            .filter(group => group.items.length > 0);

        this.model = [
            {
                label: 'Home',
                items: filteredGroups
            }
        ];

        // Check if categories exist and enable/disable Products menu item
        this.checkAndUpdateProductsMenu();

        // Check if products exist and show/hide Mi Página menu item
        this.checkAndUpdateMiPaginaMenu();

        // Check kitchen module feature toggle before showing Cocina
        this.checkAndUpdateKitchenMenu();
    }

    /** Busca un item de menú por su primera ruta del routerLink, en cualquier nivel del modelo */
    private findMenuItem(routerLink: string): MenuItem | undefined {
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
        return search(this.model[0]?.items);
    }

    private hasRequiredPermissions(item: any): boolean {
        const user = this.authService.getCurrentUser();
        const userRole = user?.role || user?.rol;

        // Validar restricción de rol por lista de roles permitidos
        if (item.roles && item.roles.length > 0 && !item.roles.includes(userRole)) {
            return false;
        }

        // Validar restricción de rol (ej: requiredRole: 'MESERO')
        if (item.requiredRole && item.requiredRole !== userRole) {
            return false;
        }

        // Si el item NO tiene requiredPermissions, mostrar a todos (excepto restricción de rol)
        if (!item.requiredPermissions || item.requiredPermissions.length === 0) {
            return true;
        }

        // El item TIENE requiredPermissions - verificar si usuario tiene AL MENOS UNO
        const hasAtLeastOnePermission = item.requiredPermissions.some((permission: string) =>
            this.authService.hasPermission(permission)
        );

        if (hasAtLeastOnePermission) {
            return true;  // ✅ Usuario tiene el/los permisos requeridos
        }

        return false;  // ❌ No tiene permisos requeridos
    }

    private checkAndUpdateProductsMenu() {
        const currentUser = this.authService.getCurrentUser();
        const tenantId = currentUser?.tenantId;

        if (tenantId) {
            this.categoryService.checkCategoriesExist(tenantId).subscribe({
                next: (hasCategories) => {
                    const productsItem = this.findMenuItem('/dashboard/adminMenu');
                    if (productsItem) {
                        productsItem.disabled = !hasCategories;
                        productsItem.title = hasCategories ? undefined : 'Primero crea al menos una categoría';
                    }
                },
                error: (err) => {
                    console.error('Error checking categories:', err);
                }
            });
        }
    }

    private checkAndUpdateMiPaginaMenu() {
        const currentUser = this.authService.getCurrentUser();
        const userRole = currentUser?.role || currentUser?.rol;
        const tenantId = currentUser?.tenantId;

        // "Mi Página" y "Mi Comanda" no son para COCINA
        if (userRole === 'COCINA') {
            const miPaginaItem = this.findMenuItem('/dashboard/mi-pagina');
            if (miPaginaItem) {
                miPaginaItem.visible = false;
            }
            const comandixItem = this.findMenuItem('/dashboard/comandix');
            if (comandixItem) {
                comandixItem.visible = false;
            }
            return;
        }

        if (tenantId) {
            this.productService.getProductsByTenantId(tenantId).subscribe({
                next: (productResp) => {
                    const products = productResp?.object || [];
                    const hasProducts = products.length > 0;
                    const miPaginaItem = this.findMenuItem('/dashboard/mi-pagina');
                    if (miPaginaItem) {
                        miPaginaItem.visible = hasProducts;
                    }
                    const comandixItem = this.findMenuItem('/dashboard/comandix');
                    if (comandixItem) {
                        comandixItem.visible = true;
                    }
                },
                error: (err) => {
                    console.error('Error checking products:', err);
                }
            });
        }
    }

    private checkAndUpdateKitchenMenu() {
        // Si el usuario tiene los permisos de cocina, mostrar la opción
        // Los permisos ya se validaron en buildMenu(), así que solo necesitamos
        // verificar que existe el item
        const kitchenItem = this.findMenuItem('/dashboard/cocina');

        if (kitchenItem) {
            // Asegurar que esté visible si el usuario logró pasar el filtro de permisos
            kitchenItem.visible = true;
            kitchenItem.disabled = false;
        }
    }
}
