import { Routes } from '@angular/router';
import { AppLayout } from './app/layout/component/app.layout';
import { AuthGuard } from './app/auth/auth.guard';
import { PermissionGuard } from './app/auth/permission.guard';
import { RoleGuard } from './app/auth/role.guard';
import { RoleHomeGuard } from './app/auth/role-home.guard';
import { WaiterGuard } from '@/pages/waiter/guards/waiter.guard';

export const appRoutes: Routes = [
    // Everything under /dashboard/**
    // Public auth routes under /dashboard/auth/
    {
        path: 'dashboard',
        children: [
            {
                path: 'auth/login',
                loadComponent: () => import('@/auth/login/login.component').then(m => m.LoginComponent)
            },
            {
                path: 'auth/error',
                loadComponent: () => import('@/auth/error/error').then(m => m.Error)
            },

            // Protected application routes: require authentication
            {
                path: '',
                component: AppLayout,
                canActivate: [AuthGuard],
                canActivateChild: [AuthGuard],
                children: [
                    { path: '', loadComponent: () => import('@/pages/dashboard/dashboard.component').then(m => m.DashboardComponent), canActivate: [RoleHomeGuard], pathMatch: 'full' },
                    { path: 'kpis', loadComponent: () => import('@/pages/dashboard/dashboard.component').then(m => m.DashboardComponent), canActivate: [RoleGuard], data: { roles: ['ADMIN', 'MARKETING', 'CAJA'] } },
                    { path: 'mesero', loadComponent: () => import('@/pages/waiter/waiter-dashboard.component').then(m => m.WaiterDashboardComponent), canActivate: [RoleGuard, WaiterGuard], data: { roles: ['MESERO'] }, title: 'Dashboard Mesero' },
                    { path: 'adminPage', loadComponent: () => import('@/pages/admin-page/landing-editor.component').then(m => m.LandingEditorComponent) },
                    { path: 'categoriesMenu', loadComponent: () => import('@/pages/categories-menu/categories-menu.component').then(m => m.CategoriesMenuComponent) },
                    { path: 'adminMenu', loadComponent: () => import('@/pages/products-menu/products-menu.component').then(m => m.ProductMenuComponent) },
                    // Campaign routes
                    { path: 'campaigns', loadComponent: () => import('@/pages/campaigns/components/campaign-list/campaign-list.component').then(m => m.CampaignListComponent), title: 'Gestión de Campañas', canActivate: [PermissionGuard], data: { permission: 'manage_campaigns' } },
                    { path: 'campaigns/create', loadComponent: () => import('@/pages/campaigns/components/create-campaign/create-campaign.component').then(m => m.CreateCampaignComponent), title: 'Crear Campaña', canActivate: [PermissionGuard], data: { permission: 'manage_campaigns' } },
                    { path: 'campaigns/new', loadComponent: () => import('@/pages/campaigns/components/campaign-form/campaign-form.component').then(m => m.CampaignFormComponent), title: 'Nueva Campaña', canActivate: [PermissionGuard], data: { permission: 'manage_campaigns' } },
                    { path: 'campaigns/:id', loadComponent: () => import('@/pages/campaigns/components/campaign-details/campaign-details.component').then(m => m.CampaignDetailsComponent), title: 'Detalles de Campaña', canActivate: [PermissionGuard], data: { permission: 'manage_campaigns' } },
                    { path: 'campaign-templates', loadComponent: () => import('@/pages/campaigns/components/campaign-templates-list/campaign-templates-list.component').then(m => m.CampaignTemplatesListComponent), title: 'Plantillas de Campañas', canActivate: [PermissionGuard], data: { permission: 'view_campaign_templates' } },
                    { path: 'manual-redemption', loadComponent: () => import('@/pages/manual-redemption/manual-redemption.component').then(m => m.ManualRedemptionComponent), canActivate: [PermissionGuard], data: { permission: 'process_redemption' } },
                    { path: 'inventario', loadComponent: () => import('@/pages/inventario/inventario.component').then(m => m.InventarioComponent), title: 'Inventario', canActivate: [PermissionGuard], data: { permission: 'view_products', mode: 'cocina' } },
                    { path: 'inventario-cocina', loadComponent: () => import('@/pages/inventario/inventario.component').then(m => m.InventarioComponent), title: 'Inventario de Cocina', canActivate: [PermissionGuard], data: { permission: 'view_products', mode: 'cocina' } },
                    { path: 'inventario-barra', loadComponent: () => import('@/pages/inventario/inventario.component').then(m => m.InventarioComponent), title: 'Inventario de Barra', canActivate: [PermissionGuard], data: { permission: 'view_products', mode: 'barra' } },
                    { path: 'bodega', loadComponent: () => import('@/pages/bodega/bodega.component').then(m => m.BodegaComponent), title: 'Bodega', canActivate: [PermissionGuard], data: { permission: 'view_products' } },
                    { path: 'reportes/transferencias', loadComponent: () => import('@/pages/reportes/transferencias-report.component').then(m => m.TransferenciasReportComponent), title: 'Reportes - Transferencias de Bodega', canActivate: [PermissionGuard], data: { permission: 'view_products' } },
                    { path: 'reportes/mermas', loadComponent: () => import('@/pages/reportes/mermas-report.component').then(m => m.MermasReportComponent), title: 'Reportes - Mermas', canActivate: [PermissionGuard], data: { permission: 'manage_mermas' } },
                    { path: 'reportes/ventas', loadComponent: () => import('@/pages/comandix/comandix.component').then(m => m.ComandixComponent), title: 'Reportes - Ventas y Comandas', canActivate: [RoleGuard, PermissionGuard], data: { roles: ['ADMIN', 'CAJA', 'MESERO'], permission: 'view_dashboard', initialView: 'report' } },
                    { path: 'recetas', loadComponent: () => import('@/pages/recetas/recetas.component').then(m => m.RecetasComponent), title: 'Recetas', canActivate: [PermissionGuard], data: { permission: 'manage_recetas' } },
                    { path: 'mermas', loadComponent: () => import('@/pages/mermas/mermas.component').then(m => m.MermasComponent), title: 'Mermas', canActivate: [PermissionGuard], data: { permission: 'manage_mermas' } },
                    { path: 'horarios', loadComponent: () => import('@/pages/horarios/horarios.component').then(m => m.HorariosComponent), title: 'Horarios', canActivate: [PermissionGuard], data: { permission: 'manage_horarios' } },
                    { path: 'mi-pagina', loadComponent: () => import('@/pages/mi-pagina/mi-pagina.component').then(m => m.MiPaginaComponent), title: 'Mi Página', canActivate: [PermissionGuard], data: { permission: 'view_products' } },
                    { path: 'clientes', loadComponent: () => import('@/pages/clientes/components/cliente-list/cliente-list.component').then(m => m.ClienteListComponent), title: 'Gestión de Clientes', canActivate: [PermissionGuard], data: { permission: 'view_customers' } },
                    { path: 'users', loadComponent: () => import('@/pages/user-management/components/user-list/user-management.component').then(m => m.UserManagementComponent), title: 'Gestión de Equipo', canActivate: [PermissionGuard], data: { permission: 'view_users' } },
                    // Admin Roles & Permissions
                    { path: 'admin/roles-permissions', loadComponent: () => import('@/pages/admin-roles-permissions/admin-roles-permissions.component').then(m => m.AdminRolesPermissionsComponent), title: 'Administración de Roles y Permisos', canActivate: [PermissionGuard], data: { permission: 'manage_roles' } },
                    { path: 'comandix', loadComponent: () => import('@/pages/comandix/comandix.component').then(m => m.ComandixComponent), title: 'Comandix - Comanda Inteligente', canActivate: [RoleGuard, PermissionGuard], data: { roles: ['ADMIN', 'MESERO'], permission: 'create_order' } },
                    { path: 'facturacion', loadComponent: () => import('@/pages/facturacion/facturacion.component').then(m => m.FacturacionComponent), title: 'Facturación' },
                    { path: 'cocina-dashboard', loadComponent: () => import('@/pages/kitchen/kitchen-dashboard.component').then(m => m.KitchenDashboardComponent), title: 'Kitchndix - Dashboard Cocina', canActivate: [RoleGuard, PermissionGuard], data: { roles: ['ADMIN', 'COCINA'], permission: 'dashboard_kitchen' } },
                    { path: 'cocina', loadComponent: () => import('@/pages/kitchen/kitchen.component').then(m => m.KitchenComponent), title: 'Kitchndix - Cocina', canActivate: [RoleGuard, PermissionGuard], data: { roles: ['ADMIN', 'COCINA'], permission: 'view_kitchen_orders' } },
                    { path: 'barra', loadComponent: () => import('@/pages/barra/barra.component').then(m => m.BarraComponent), title: 'Kitchndix - Barra', canActivate: [RoleGuard, PermissionGuard], data: { roles: ['ADMIN', 'COCINA'], permission: 'view_kitchen_orders' } },
                    // Hostess
                    { path: 'mesas', loadComponent: () => import('@/pages/hostess/mapeo-mesas/mapeo-mesas.component').then(m => m.MapeoMesasComponent), title: 'Mapeo de Mesas', canActivate: [RoleGuard, PermissionGuard], data: { roles: ['HOSTESS', 'ADMIN'], permission: 'view_mesas' } },
                    { path: 'reservaciones', loadComponent: () => import('@/pages/hostess/reservaciones/reservaciones.component').then(m => m.ReservacionesComponent), title: 'Reservaciones', canActivate: [RoleGuard, PermissionGuard], data: { roles: ['HOSTESS', 'ADMIN'], permission: 'view_reservaciones' } },
                    // Ruta eliminada: menu-print
                    { path: 'menu-classic-print', loadComponent: () => import('@/pages/menu-classic-print/menu-classic-print.component').then(m => m.MenuClassicPrintComponent), title: 'Imprimir Menú Clásico' }
                ]
            }
        ]
    },

    // Redeem module - public access for coupon redemption
    {
        path: 'redeem',
        loadChildren: () => import('./app/pages/redeem/redeem.module').then(m => m.RedeemModule)
    },

    // Default: always go to login page
    { path: '', redirectTo: '/dashboard/auth/login', pathMatch: 'full' },
    { path: '**', redirectTo: '/dashboard/auth/login' }

];
