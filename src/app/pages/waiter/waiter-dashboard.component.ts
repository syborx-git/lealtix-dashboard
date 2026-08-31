import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { CarouselModule } from 'primeng/carousel';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import { DividerModule } from 'primeng/divider';
import { TagModule } from 'primeng/tag';
import { RippleModule } from 'primeng/ripple';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { WaiterDashboardFacadeService } from './services/waiter-dashboard-facade.service';
import {
  WaiterDashboardSummaryDTO,
  VipClientDTO,
  CrossSellProductDTO,
  KpiMetricDTO
} from './models/waiter-dashboard.models';
import { AuthService } from '../../auth/auth.service';

/**
 * WaiterDashboardComponent
 * Main dashboard for waiter role (dashboard_mesero)
 * Displays KPIs, quick actions, cross-sell carousel, and VIP clients table
 * Mobile-first responsive design with PrimeNG components
 */
@Component({
  selector: 'app-waiter-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    ButtonModule,
    TableModule,
    CarouselModule,
    SkeletonModule,
    MessageModule,
    DividerModule,
    TagModule,
    RippleModule,
    DialogModule,
    InputTextModule,
    FormsModule,
    ReactiveFormsModule
  ],
  providers: [MessageService],
  templateUrl: './waiter-dashboard.component.html',
  styleUrls: ['./waiter-dashboard.component.scss']
})
export class WaiterDashboardComponent implements OnInit, OnDestroy {
  // Injected services
  private facadeService = inject(WaiterDashboardFacadeService);
  private authService = inject(AuthService);
  private messageService = inject(MessageService);
  private router = inject(Router);

  // Component state
  private destroy$ = new Subject<void>();
  showNewClientDialog = signal(false);
  newClientForm = signal({
    nombre: '',
    email: '',
    telefono: ''
  });
  clientDialogLoading = signal(false);

  // Date range filter (matching kitchen dashboard pattern)
  readonly selectedDays = signal<1 | 3 | 7>(1);
  readonly rangeLabel = computed(() => {
    const days = this.selectedDays();
    if (days === 1) {
      return 'Vista del día actual';
    }
    if (days === 3) {
      return 'Últimos 3 días';
    }
    return 'Últimos 7 días';
  });

  // Observable streams
  metrics$ = this.facadeService.metrics$;
  vipClients$ = this.facadeService.vipClients$;
  crossSellProducts$ = this.facadeService.crossSellProducts$;
  loading$ = this.facadeService.loading$;
  error$ = this.facadeService.error$;

  // Component properties
  currentUser: string = '';
  currentTenantId: number = 0;
  currentUserId: number = 0;

  // Carousel configuration
  responsiveOptions = [
    {
      breakpoint: '1024px',
      numVisible: 3,
      numScroll: 1
    },
    {
      breakpoint: '768px',
      numVisible: 2,
      numScroll: 1
    },
    {
      breakpoint: '560px',
      numVisible: 1,
      numScroll: 1
    }
  ];

  async ngOnInit(): Promise<void> {
    try {
      // Get tenant and user info
      this.currentTenantId = this.resolveTenantId();
      this.currentUserId = this.resolveUserId();
      this.currentUser = this.resolveUserName();

      // Initialize facade service with date range - triggers all API calls in parallel
      this.facadeService.loadMetricsByDays(this.currentTenantId, this.currentUserId, this.selectedDays());

      // Subscribe to error state for toast notifications
      this.error$
        .pipe(takeUntil(this.destroy$))
        .subscribe((error) => {
          if (error) {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: error,
              life: 5000
            });
          }
        });
    } catch (error) {
      console.error('Error initializing waiter dashboard:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Initialization Error',
        detail: 'Could not load dashboard',
        life: 5000
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.facadeService.destroy();
  }

  /**
   * Resolve tenant ID from current user (stored in session at login)
   * This matches the pattern used in kitchen.component.ts
   */
  private resolveTenantId(): number {
    const currentUser = this.authService.getCurrentUser();
    const tenantId = currentUser?.tenantId ?? 0;

    if (tenantId <= 0) {
      console.warn('Invalid tenant ID retrieved from session');
    }

    return tenantId;
  }

  /**
   * Get user ID from auth service
   */
  private resolveUserId(): number {
    return this.authService.getCurrentUser()?.id || 0;
  }

  /**
   * Get user name for greeting
   */
  private resolveUserName(): string {
    const user = this.authService.getCurrentUser();
    return user?.email?.split('@')[0] || 'Mesero';
  }

  /**
   * Apply date range filter (1, 3, or 7 days) - matching kitchen dashboard pattern
   */
  applyRange(days: 1 | 3 | 7): void {
    if (this.currentTenantId <= 0 || this.selectedDays() === days) {
      return;
    }

    this.selectedDays.set(days);
    this.facadeService.loadMetricsByDays(this.currentTenantId, this.currentUserId, days);
  }

  /**
   * Build KPI metrics array for display
   * Transforms dashboard summary into card-friendly format
   */
  getKpiMetrics(summary: WaiterDashboardSummaryDTO | null): KpiMetricDTO[] {
    if (!summary) return [];

    return [
      {
        label: 'Ventas Identificadas',
        value: summary.salesIdentifiedPercentage,
        icon: 'pi-chart-pie',
        color: 'indigo',
        suffix: '%',
        trend: summary.salesIdentifiedPercentage
      },
      {
        label: 'Clientes Nuevos',
        value: summary.newClientsToday,
        icon: 'pi-user-plus',
        color: 'green',
        suffix: ''
      },
      {
        label: 'Órdenes Hoy',
        value: summary.ordersToday,
        icon: 'pi-shopping-cart',
        color: 'blue',
        suffix: ''
      },
      {
        label: 'Tasa de Recompra',
        value: summary.repurchaseRate,
        icon: 'pi-trending-up',
        color: 'orange',
        suffix: '%',
        trend: summary.repurchaseRate
      }
    ];
  }

  /**
   * Get motivational message based on repurchase rate
   */
  getMotivationalMessage(summary: WaiterDashboardSummaryDTO | null): string {
    if (!summary) return 'Comienza tu turno';
    if (summary.repurchaseRate > 70) {
      return `¡Increíble! Tus clientes vuelven un ${summary.repurchaseRate}% más`;
    } else if (summary.repurchaseRate > 50) {
      return `Bien hecho! Tus clientes vuelven un ${summary.repurchaseRate}%`;
    } else {
      return `Tus clientes vuelven un ${summary.repurchaseRate}% de las veces`;
    }
  }

  /**
   * Calculate days since last visit
   */
  getDaysSinceLastVisit(lastVisitDate: string): number {
    const today = new Date();
    const lastVisit = new Date(lastVisitDate);
    const diffTime = Math.abs(today.getTime() - lastVisit.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Navigate to Comandix (order management)
   */
  goToComanidx(): void {
    this.router.navigate(['/dashboard/comandix']);
  }

  /**
   * Open dialog for new client creation
   */
  openDialogNuevoCliente(): void {
    this.showNewClientDialog.set(true);
    this.newClientForm.set({ nombre: '', email: '', telefono: '' });
  }

  /**
   * Close new client dialog
   */
  closeNewClientDialog(): void {
    this.showNewClientDialog.set(false);
    this.newClientForm.set({ nombre: '', email: '', telefono: '' });
  }

  /**
   * Save new client
   * TODO: Integrate with real ClienteService when available
   */
  saveNewClient(): void {
    const form = this.newClientForm();

    // Validation
    if (!form.nombre?.trim() || !form.email?.trim() || !form.telefono?.trim()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Campos requeridos',
        detail: 'Por favor complete: Nombre, Email y Teléfono',
        life: 3000
      });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      this.messageService.add({
        severity: 'error',
        summary: 'Email inválido',
        detail: 'Por favor ingrese un email válido',
        life: 3000
      });
      return;
    }

    this.clientDialogLoading.set(true);

    // TODO: Call ClienteService.createCliente(this.currentTenantId, form)
    // For now, simulate with timeout
    setTimeout(() => {
      this.messageService.add({
        severity: 'success',
        summary: 'Cliente creado',
        detail: `${form.nombre} ha sido agregado exitosamente`,
        life: 3000
      });

      this.closeNewClientDialog();
      this.clientDialogLoading.set(false);

      // Refresh dashboard after creating new client
      this.facadeService.refresh();
    }, 1500);
  }

  /**
   * Search VIP client (click action)
   * Simulates finding customer in system
   */
  searchVipClient(client: VipClientDTO): void {
    console.log('Searching for VIP client:', client);
    this.messageService.add({
      severity: 'info',
      summary: 'Búsqueda',
      detail: `Buscando cliente: ${client.name}`,
      life: 2000
    });
  }

  /**
   * Refresh dashboard (manual refresh action)
   */
  refreshDashboard(): void {
    this.facadeService.refresh();
    this.messageService.add({
      severity: 'success',
      summary: 'Actualizado',
      detail: 'Dashboard actualizado correctamente',
      life: 2000
    });
  }
}
