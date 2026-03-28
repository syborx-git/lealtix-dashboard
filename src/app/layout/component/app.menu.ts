import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AppMenuitem } from './app.menuitem';
import { CategoryService } from '../../pages/categories-menu/service/category.service';
import { TenantService } from '../../pages/admin-page/service/tenant.service';
import { ProductService } from '../../pages/products-menu/service/product.service';
import { AuthService } from '../../auth/auth.service';
import { KitchenFeatureService } from '@/pages/kitchen/services/kitchen-feature.service';

@Component({
    selector: 'app-menu',
    standalone: true,
    imports: [CommonModule, AppMenuitem, RouterModule],
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
        private tenantService: TenantService,
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
        const allMenuItems: MenuItem[] = [
            { label: 'Dashboard', icon: 'pi pi-fw pi-home', routerLink: ['/dashboard/kpis'], requiredPermissions: ['view_dashboard'] },
            { label: 'Admin Page', icon: 'pi pi-fw pi-globe', routerLink: ['/dashboard/adminPage'], requiredPermissions: ['manage_admin_page'] },
            { label: 'Categorías', icon: 'pi pi-fw pi-tags', routerLink: ['/dashboard/categoriesMenu'], requiredPermissions: ['manage_categories'] },
            {
                label: 'Productos',
                icon: 'pi pi-fw pi-bars',
                routerLink: ['/dashboard/adminMenu'],
                disabled: true,
                title: 'Primero crea al menos una categoría',
                requiredPermissions: ['create_product', 'edit_product']
            },
            { label: 'Campañas', icon: 'pi pi-fw pi-id-card', routerLink: ['/dashboard/campaigns'], requiredPermissions: ['manage_campaigns'] },
            { label: 'Plantillas', icon: 'pi pi-fw pi-file', routerLink: ['/dashboard/campaign-templates'], requiredPermissions: ['manage_campaign_templates'] },
            { label: 'Redención', icon: 'pi pi-fw pi-ticket', routerLink: ['/dashboard/manual-redemption'], requiredPermissions: ['process_redemption'] },
            { label: 'Gestión de Clientes', icon: 'pi pi-fw pi-users', routerLink: ['/dashboard/clientes'], requiredPermissions: ['view_customers'] },
            { label: 'Gestión de Equipo', icon: 'pi pi-fw pi-id-card', routerLink: ['/dashboard/users'], requiredPermissions: ['view_users', 'manage_user_roles'] },
            {
                label: 'Mi Página',
                icon: 'pi pi-fw pi-qrcode',
                routerLink: ['/dashboard/mi-pagina'],
                visible: false,
                requiredPermissions: ['view_products']
            },
            {
                label: 'Mi Comanda',
                icon: 'pi pi-fw pi-shopping-cart',
                routerLink: ['/dashboard/comandix'],
                visible: false,
                requiredPermissions: ['create_order']
            },
            {
                label: 'Cocina',
                icon: 'pi pi-fw pi-box',
                routerLink: ['/dashboard/cocina'],
                requiredPermissions: ['view_kitchen_orders', 'update_order_status']
            },
            { label: 'Reportes', icon: 'pi pi-fw pi-chart-bar', routerLink: ['/dashboard/uikit/charts'], visible: false, requiredPermissions: ['view_reports', 'admin_access'] },
            { label: 'Utils', icon: 'pi pi-fw pi-table', routerLink: ['/dashboard/uikit/table'], visible: false, requiredPermissions: ['admin_access'] }
        ];

        // Filtrar items según permisos
        const filteredItems = allMenuItems.filter(item => this.hasRequiredPermissions(item));

        this.model = [
            {
                label: 'Home',
                items: filteredItems
            }
        ];

        // Check if categories exist and enable/disable Products menu item
        this.checkAndUpdateProductsMenu();

        // Check if products exist and show/hide Mi Página menu item
        this.checkAndUpdateMiPaginaMenu();

        // Check kitchen module feature toggle before showing Cocina
        this.checkAndUpdateKitchenMenu();
    }

    private hasRequiredPermissions(item: any): boolean {
        const isAdminByRole = this.authService.getCurrentUser()?.rol === 'ADMIN';
        const isAdminByPermission = this.userPermissions.includes('admin_access');

        if (isAdminByRole || isAdminByPermission) {
            return true;
        }

        if (!item.requiredPermissions || item.requiredPermissions.length === 0) {
            return true;
        }
        // El usuario debe tener AL MENOS UNO de los permisos requeridos
        return item.requiredPermissions.some((permission: string) => this.userPermissions.includes(permission));
    }

    private checkAndUpdateProductsMenu() {
        const userStr = sessionStorage.getItem('usuario') ?? localStorage.getItem('usuario');
        if (userStr) {
            try {
                const userObj = JSON.parse(userStr);
                if (userObj && userObj.userEmail) {
                    this.tenantService.getTenantByEmail(String(userObj.userEmail || '').trim()).subscribe({
                        next: (resp) => {
                            const tenant = resp?.object;
                            const tenantId = tenant?.id ?? 0;
                            if (tenantId > 0) {
                                this.categoryService.checkCategoriesExist(tenantId).subscribe({
                                    next: (hasCategories) => {
                                        const productsItem = this.model[0]?.items?.find(item => item.label === 'Productos');
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
                        },
                        error: (err) => {
                            console.error('Error fetching tenant:', err);
                        }
                    });
                }
            } catch (e) {
                console.warn('Failed to parse stored usuario:', e);
            }
        }
    }

    private checkAndUpdateMiPaginaMenu() {
        const userStr = sessionStorage.getItem('usuario') ?? localStorage.getItem('usuario');
        if (userStr) {
            try {
                const userObj = JSON.parse(userStr);
                if (userObj && userObj.userEmail) {
                    this.tenantService.getTenantByEmail(String(userObj.userEmail || '').trim()).subscribe({
                        next: (resp) => {
                            const tenant = resp?.object;
                            const tenantId = tenant?.id ?? 0;
                            if (tenantId > 0) {
                                this.productService.getProductsByTenantId(tenantId).subscribe({
                                    next: (productResp) => {
                                        const products = productResp?.object || [];
                                        const hasProducts = products.length > 0;
                                        const miPaginaItem = this.model[0]?.items?.find(item => item.label === 'Mi Página');
                                        if (miPaginaItem) {
                                            miPaginaItem.visible = hasProducts;
                                        }
                                        const comandixItem = this.model[0]?.items?.find(item => item.label === 'Mi Comanda');
                                        if (comandixItem) {
                                            comandixItem.visible = hasProducts;
                                        }
                                    },
                                    error: (err) => {
                                        console.error('Error checking products:', err);
                                    }
                                });
                            }
                        },
                        error: (err) => {
                            console.error('Error fetching tenant:', err);
                        }
                    });
                }
            } catch (e) {
                console.warn('Failed to parse stored usuario:', e);
            }
        }
    }

    private checkAndUpdateKitchenMenu() {
        // La visibilidad se controla primordialmente por permisos del usuario.
        // Esta función verifica el feature flag del tenant co mo validación adicional.
        // Si el usuario tiene permisos pero el módulo está deshabilitado, se muestra un estado deshabilitado.
        this.kitchenFeatureService.isKitchenEnabledForCurrentTenant$().subscribe({
            next: (enabled) => {
                const kitchenItem = this.model[0]?.items?.find(item => item.label === 'Cocina');
                if (kitchenItem) {
                    if (!enabled) {
                        // Si el módulo está deshabilitado, ocultarlo
                        kitchenItem.visible = false;
                    }
                    // Si está habilitado, dejar que los permisos controlen la visibilidad
                }
            },
            error: () => {
                // En caso de error, permitir visualización si el usuario tiene permisos (no es control nuestro)
                // No ocultamos el item aquí
            }
        });
    }
}
