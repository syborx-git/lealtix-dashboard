import { Routes } from '@angular/router';
import { AppLayout } from './app/layout/component/app.layout';
import { DashboardComponent } from './app/pages/dashboard/dashboard.component';
import { LandingEditorComponent } from '@/pages/admin-page/landing-editor.component';
import { ProductMenuComponent } from '@/pages/products-menu/products-menu.component';
import { LoginComponent } from '@/auth/login/login.component';
import { Error } from '@/auth/error/error';
import { AuthGuard } from './app/auth/auth.guard';
import { CategoriesMenuComponent } from '@/pages/categories-menu/categories-menu.component';

// Campaign components
import { CampaignListComponent } from '@/pages/campaigns/components/campaign-list/campaign-list.component';
import { CampaignFormComponent } from '@/pages/campaigns/components/campaign-form/campaign-form.component';
import { CampaignDetailsComponent } from '@/pages/campaigns/components/campaign-details/campaign-details.component';
import { CampaignTemplatesListComponent } from '@/pages/campaigns/components/campaign-templates-list/campaign-templates-list.component';
import { CreateCampaignComponent } from '@/pages/campaigns/components/create-campaign/create-campaign.component';
import { ManualRedemptionComponent } from '@/pages/manual-redemption/manual-redemption.component';
import { MiPaginaComponent } from '@/pages/mi-pagina/mi-pagina.component';
// import eliminado: MenuPrintComponent
import { MenuClassicPrintComponent } from '@/pages/menu-classic-print/menu-classic-print.component';

// Cliente components
import { ClienteListComponent } from '@/pages/clientes/components/cliente-list/cliente-list.component';

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
                    { path: '', redirectTo: 'adminPage', pathMatch: 'full' },
                    { path: 'kpis', component: DashboardComponent },
                    { path: 'adminPage', component: LandingEditorComponent },
                    { path: 'categoriesMenu', component: CategoriesMenuComponent },
                    { path: 'adminMenu', component: ProductMenuComponent },
                    // Campaign routes
                    { path: 'campaigns', component: CampaignListComponent, title: 'Gestión de Campañas' },
                    { path: 'campaigns/create', component: CreateCampaignComponent, title: 'Crear Campaña' },
                    { path: 'campaigns/new', component: CampaignFormComponent, title: 'Nueva Campaña' },
                    { path: 'campaigns/:id', component: CampaignDetailsComponent, title: 'Detalles de Campaña' },
                    { path: 'campaign-templates', component: CampaignTemplatesListComponent, title: 'Plantillas de Campañas' },
                    { path: 'manual-redemption', component: ManualRedemptionComponent, title: 'Redención Manual' },
                    { path: 'mi-pagina', component: MiPaginaComponent, title: 'Mi Página' },
                    { path: 'clientes', component: ClienteListComponent, title: 'Gestión de Clientes' },
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
