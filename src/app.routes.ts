import { Routes } from '@angular/router';
import { AppLayout } from './app/layout/component/app.layout';
import { DashboardComponent } from './app/pages/dashboard/dashboard.component';
import { LandingEditorComponent } from '@/pages/admin-page/landing-editor.component';
import { ProductMenuComponent } from '@/pages/products-menu/products-menu.component';
import { LoginComponent } from '@/auth/login/login.component';
import { Error } from '@/auth/error/error';
import { AuthGuard } from './app/auth/auth.guard';
import { PermissionGuard } from './app/auth/permission.guard';
import { RoleGuard } from './app/auth/role.guard';
import { RoleHomeGuard } from './app/auth/role-home.guard';
import { CategoriesMenuComponent } from '@/pages/categories-menu/categories-menu.component';

// Hostess components
import { MapeoMesasComponent } from '@/pages/hostess/mapeo-mesas/mapeo-mesas.component';
import { ReservacionesComponent } from '@/pages/hostess/reservaciones/reservaciones.component';

// Campaign components
import { CampaignListComponent } from '@/pages/campaigns/components/campaign-list/campaign-list.component';
import { CampaignFormComponent } from '@/pages/campaigns/components/campaign-form/campaign-form.component';
import { CampaignDetailsComponent } from '@/pages/campaigns/components/campaign-details/campaign-details.component';
import { CampaignTemplatesListComponent } from '@/pages/campaigns/components/campaign-templates-list/campaign-templates-list.component';
import { CreateCampaignComponent } from '@/pages/campaigns/components/create-campaign/create-campaign.component';
import { ManualRedemptionComponent } from '@/pages/manual-redemption/manual-redemption.component';
import { MiPaginaComponent } from '@/pages/mi-pagina/mi-pagina.component';
import { InventarioComponent } from '@/pages/inventario/inventario.component';
import { BodegaComponent } from '@/pages/bodega/bodega.component';
import { TransferenciasReportComponent } from '@/pages/reportes/transferencias-report.component';
import { MermasReportComponent } from '@/pages/reportes/mermas-report.component';
// import eliminado: MenuPrintComponent
import { MenuClassicPrintComponent } from '@/pages/menu-classic-print/menu-classic-print.component';

// Cliente components
import { ClienteListComponent } from '@/pages/clientes/components/cliente-list/cliente-list.component';

// Comandix component
import { ComandixComponent } from '@/pages/comandix/comandix.component';
import { KitchenComponent } from '@/pages/kitchen/kitchen.component';
import { KitchenDashboardComponent } from '@/pages/kitchen/kitchen-dashboard.component';
import { BarraComponent } from '@/pages/barra/barra.component';

// User Management component
import { UserManagementComponent } from '@/pages/user-management/components/user-list/user-management.component';

// Admin Roles & Permissions
import { AdminRolesPermissionsComponent } from '@/pages/admin-roles-permissions/admin-roles-permissions.component';

// Waiter Dashboard component
import { WaiterDashboardComponent } from '@/pages/waiter/waiter-dashboard.component';
import { WaiterGuard } from '@/pages/waiter/guards/waiter.guard';

// Recetas & Mermas
import { RecetasComponent } from '@/pages/recetas/recetas.component';
import { MermasComponent } from '@/pages/mermas/mermas.component';

// Horarios
import { HorariosComponent } from '@/pages/horarios/horarios.component';

export const appRoutes: Routes = [
    // Everything under /dashboard/**
    // Public auth routes under /dashboard/auth/
    {
        path: 'dashboard',
        children: [
            { path: 'auth/login', component: LoginComponent },
            { path: 'auth/error', component: Error },

            // Protected application routes: require authentication
            {
                path: '',
                component: AppLayout,
                canActivate: [AuthGuard],
                canActivateChild: [AuthGuard],
                children: [
                    { path: '', component: DashboardComponent, canActivate: [RoleHomeGuard], pathMatch: 'full' },
                    { path: 'kpis', component: DashboardComponent, canActivate: [RoleGuard], data: { roles: ['ADMIN', 'MARKETING', 'CAJA'] } },
                    { path: 'mesero', component: WaiterDashboardComponent, canActivate: [RoleGuard, WaiterGuard], data: { roles: ['MESERO'] }, title: 'Dashboard Mesero' },
                    { path: 'adminPage', component: LandingEditorComponent },
                    { path: 'categoriesMenu', component: CategoriesMenuComponent },
                    { path: 'adminMenu', component: ProductMenuComponent },
                    // Campaign routes
                    { path: 'campaigns', component: CampaignListComponent, title: 'Gestión de Campañas', canActivate: [PermissionGuard], data: { permission: 'manage_campaigns' } },
                    { path: 'campaigns/create', component: CreateCampaignComponent, title: 'Crear Campaña', canActivate: [PermissionGuard], data: { permission: 'manage_campaigns' } },
                    { path: 'campaigns/new', component: CampaignFormComponent, title: 'Nueva Campaña', canActivate: [PermissionGuard], data: { permission: 'manage_campaigns' } },
                    { path: 'campaigns/:id', component: CampaignDetailsComponent, title: 'Detalles de Campaña', canActivate: [PermissionGuard], data: { permission: 'manage_campaigns' } },
                    { path: 'campaign-templates', component: CampaignTemplatesListComponent, title: 'Plantillas de Campañas', canActivate: [PermissionGuard], data: { permission: 'view_campaign_templates' } },
                    { path: 'manual-redemption', component: ManualRedemptionComponent, canActivate: [PermissionGuard], data: { permission: 'process_redemption' } },
                    { path: 'inventario', component: InventarioComponent, title: 'Inventario', canActivate: [PermissionGuard], data: { permission: 'view_products', mode: 'cocina' } },
                    { path: 'inventario-cocina', component: InventarioComponent, title: 'Inventario de Cocina', canActivate: [PermissionGuard], data: { permission: 'view_products', mode: 'cocina' } },
                    { path: 'inventario-barra', component: InventarioComponent, title: 'Inventario de Barra', canActivate: [PermissionGuard], data: { permission: 'view_products', mode: 'barra' } },
                    { path: 'bodega', component: BodegaComponent, title: 'Bodega', canActivate: [PermissionGuard], data: { permission: 'view_products' } },
                    { path: 'reportes/transferencias', component: TransferenciasReportComponent, title: 'Reportes - Transferencias de Bodega', canActivate: [PermissionGuard], data: { permission: 'view_products' } },
                    { path: 'reportes/mermas', component: MermasReportComponent, title: 'Reportes - Mermas', canActivate: [PermissionGuard], data: { permission: 'manage_mermas' } },
                    { path: 'reportes/ventas', component: ComandixComponent, title: 'Reportes - Ventas y Comandas', canActivate: [RoleGuard, PermissionGuard], data: { roles: ['ADMIN', 'CAJA', 'MESERO'], permission: 'view_dashboard', initialView: 'report' } },
                    { path: 'recetas', component: RecetasComponent, title: 'Recetas', canActivate: [PermissionGuard], data: { permission: 'manage_recetas' } },
                    { path: 'mermas', component: MermasComponent, title: 'Mermas', canActivate: [PermissionGuard], data: { permission: 'manage_mermas' } },
                    { path: 'horarios', component: HorariosComponent, title: 'Horarios', canActivate: [PermissionGuard], data: { permission: 'manage_horarios' } },
                    { path: 'mi-pagina', component: MiPaginaComponent, title: 'Mi Página', canActivate: [PermissionGuard], data: { permission: 'view_products' } },
                    { path: 'clientes', component: ClienteListComponent, title: 'Gestión de Clientes', canActivate: [PermissionGuard], data: { permission: 'view_customers' } },
                    { path: 'users', component: UserManagementComponent, title: 'Gestión de Equipo', canActivate: [PermissionGuard], data: { permission: 'view_users' } },
                    // Admin Roles & Permissions
                    { path: 'admin/roles-permissions', component: AdminRolesPermissionsComponent, title: 'Administración de Roles y Permisos', canActivate: [PermissionGuard], data: { permission: 'manage_roles' } },
                    { path: 'comandix', component: ComandixComponent, title: 'Comandix - Comanda Inteligente', canActivate: [RoleGuard, PermissionGuard], data: { roles: ['ADMIN', 'MESERO'], permission: 'create_order' } },
                    { path: 'cocina-dashboard', component: KitchenDashboardComponent, title: 'Kitchndix - Dashboard Cocina', canActivate: [RoleGuard, PermissionGuard], data: { roles: ['ADMIN', 'COCINA'], permission: 'dashboard_kitchen' } },
                    { path: 'cocina', component: KitchenComponent, title: 'Kitchndix - Cocina', canActivate: [RoleGuard, PermissionGuard], data: { roles: ['ADMIN', 'COCINA'], permission: 'view_kitchen_orders' } },
                    { path: 'barra', component: BarraComponent, title: 'Kitchndix - Barra', canActivate: [RoleGuard, PermissionGuard], data: { roles: ['ADMIN', 'COCINA'], permission: 'view_kitchen_orders' } },
                    // Hostess
                    { path: 'mesas', component: MapeoMesasComponent, title: 'Mapeo de Mesas', canActivate: [RoleGuard, PermissionGuard], data: { roles: ['HOSTESS', 'ADMIN'], permission: 'view_mesas' } },
                    { path: 'reservaciones', component: ReservacionesComponent, title: 'Reservaciones', canActivate: [RoleGuard, PermissionGuard], data: { roles: ['HOSTESS', 'ADMIN'], permission: 'view_reservaciones' } },
                    // Ruta eliminada: menu-print
                    { path: 'menu-classic-print', component: MenuClassicPrintComponent, title: 'Imprimir Menú Clásico' }
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
