import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';
import { BadgeModule } from 'primeng/badge';
import { PaginatorModule } from 'primeng/paginator';
import { MessageModule } from 'primeng/message';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { forkJoin } from 'rxjs';
import { DashboardService } from './dashboard.service';
import { DashboardLoyaltyService } from './dashboard-loyalty.service';
import { TenantService } from '@/pages/admin-page/service/tenant.service';
import { AuthService } from '@/auth/auth.service';
import { LayoutService } from '@/layout/service/layout.service';
import { InventoryService } from '@/pages/inventario/service/inventory.service';
import {
  TimeSeriesCountDTO,
  CouponStatsDTO,
  SalesSummaryDTO,
  SalesByPeriodDTO,
  TopProductDTO,
  SalesByCategoryDTO,
  CampaignPerformanceDTO,
  RepeatPurchaseRateDTO,
  IdentifiedVsGeneralDTO,
  CustomerLTVDTO,
  CouponConversionDTO,
  CustomizationAnalysisDTO,
  CampaignROIDTO
} from './dashboard.models';

interface Insight {
  type: 'success' | 'warn' | 'info' | 'error';
  icon: string;
  message: string;
}

interface Insumo {
  id: number;
  nombre: string;
  unidad: string;
  stock: number;
  stockMinimo: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    ChartModule,
    TableModule,
    SkeletonModule,
    BadgeModule,
    PaginatorModule,
    MessageModule,
    TooltipModule,
    DialogModule,
    InputNumberModule,
    ButtonModule,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  loading = signal(true);
  error = signal<string | null>(null);

  // Client info signals
  clientName = signal<string>('Negocio');
  clientLogo = signal<string | null>(null);
  clientSlug = signal<string | null>(null);

  // Insights
  insights = signal<Insight[]>([]);

  // Data signals
  totalClientes = signal<number | null>(null);
  clientesNuevos = signal<TimeSeriesCountDTO[]>([]);
  cuponesStats = signal<CouponStatsDTO[]>([]);
  ventasResumen = signal<SalesSummaryDTO | null>(null);
  campanasPerformance = signal<CampaignPerformanceDTO[]>([]);

  // Insumos en stock mínimo
  insumos = signal<Insumo[]>([]);
  insumosEnStockMinimo = computed(() =>
    this.insumos().filter(i => i.stock <= i.stockMinimo)
  );
  insumosStockMinimoLoading = signal(false);

  // Modal listado de insumos en stock mínimo
  stockModalVisible = signal(false);

  // Ventas totales: tickets/comandas de los últimos 2 meses
  ventasTickets = signal<any[]>([]);
  ventasTicketsLoading = signal(false);
  ventasModalVisible = signal(false);

  // Modal de restock de insumo
  restockVisible = signal(false);
  restockTarget = signal<Insumo | null>(null);
  restockCantidad = signal(0);

  private router = inject(Router);

  // Costos y Ganancias (porcentajes configurables por el usuario)
  private static readonly STORAGE_KEY = 'lealtix_costos_porcentajes';
  private static readonly DEFAULT_MP = 35;   // % materia prima
  private static readonly DEFAULT_RH = 20;   // % recurso humano
  porcentajeMateriaPrima = signal<number>(DashboardComponent.DEFAULT_MP);
  porcentajeRecursoHumano = signal<number>(DashboardComponent.DEFAULT_RH);

  porcentajeCostoTotal = computed(() =>
    Math.min(100, this.porcentajeMateriaPrima() + this.porcentajeRecursoHumano())
  );

  ventasBase = computed(() => this.ventasResumen()?.totalSales ?? 0);
  costosMateriaPrima = computed(() => this.ventasBase() * (this.porcentajeMateriaPrima() / 100));
  costosRecursoHumano = computed(() => this.ventasBase() * (this.porcentajeRecursoHumano() / 100));
  costos = computed(() => this.ventasBase() * (this.porcentajeCostoTotal() / 100));
  ganancias = computed(() => this.ventasBase() - this.costos());
  gananciasPct = computed(() => (this.porcentajeCostoTotal() >= 100)
    ? 0
    : Math.round((100 - this.porcentajeCostoTotal()) * 100) / 100);

  // Modales de Costos y Ganancias
  costosModalVisible = signal(false);
  gananciasModalVisible = signal(false);

  // Loyalty Metrics Signals
  repeatPurchaseRate = signal<RepeatPurchaseRateDTO | null>(null);
  identifiedVsGeneral = signal<IdentifiedVsGeneralDTO | null>(null);
  customerLTV = signal<CustomerLTVDTO[]>([]);
  couponConversion = signal<CouponConversionDTO[]>([]);
  customizationAnalysis = signal<CustomizationAnalysisDTO[]>([]);
  campaignROI = signal<CampaignROIDTO[]>([]);

  // Loading signals for loyalty metrics
  loyaltyLoading = signal(false);

  // Chart data signals
  lineChartData = signal<any>(null);
  lineChartOptions = signal<any>(null);
  barChartData = signal<any>(null);
  barChartOptions = signal<any>(null);
  doughnutData = signal<any>(null);
  doughnutOptions = signal<any>(null);
  salesPeriodData = signal<any>(null);
  salesPeriodOptions = signal<any>(null);
  topProductsList = signal<TopProductDTO[]>([]);
  topClientsData = signal<any>(null);
  topClientsOptions = signal<any>(null);
  salesByCategoryData = signal<any>(null);
  salesByCategoryOptions = signal<any>(null);
  periodo = signal<string>('week');
  periodoOptions = [
    { label: 'Día', value: 'day' },
    { label: 'Semana', value: 'week' },
    { label: 'Mes', value: 'month' },
    { label: 'Año', value: 'year' }
  ];
  identifiedVsGeneralChartData = signal<any>(null);
  identifiedVsGeneralChartOptions = signal<any>(null);

  private tenantId = 0;

  constructor(
    private dashboardService: DashboardService,
    private dashboardLoyaltyService: DashboardLoyaltyService,
    private tenantService: TenantService,
    private authService: AuthService,
    private layoutService: LayoutService,
    private inventoryService: InventoryService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.setupChartOptions();
    this.layoutService.configUpdate$.subscribe(() => this.setupChartOptions());
    this.loadPorcentajes();
    this.readTenantId();
  }

  private loadPorcentajes(): void {
    try {
      const raw = localStorage.getItem(DashboardComponent.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.materiaPrima === 'number') this.porcentajeMateriaPrima.set(parsed.materiaPrima);
        if (typeof parsed?.recursoHumano === 'number') this.porcentajeRecursoHumano.set(parsed.recursoHumano);
      }
    } catch {
      // ignorar configuraciones corruptas y usar valores por defecto
    }
  }

  private readTenantId(): void {
    const currentUser = this.authService.getCurrentUser();
    const tenantId = currentUser?.tenantId;

    if (tenantId) {
      this.tenantService.getTenantById(tenantId).subscribe({
        next: (tenant) => {
          this.tenantId = tenant?.id ?? 0;
          this.clientName.set(tenant?.nombreNegocio || 'Negocio');
          this.clientLogo.set(tenant?.logoUrl || null);
          this.clientSlug.set(tenant?.slug || null);

          // Cargar datos una vez obtenido el tenantId
          if (this.tenantId > 0) {
            this.cargarDatos();
          } else {
            this.error.set('No se pudo obtener el tenant');
            this.loading.set(false);
          }
        },
        error: (err) => {
          console.error('Error fetching tenant:', err);
          this.error.set('Error al obtener información del negocio');
          this.loading.set(false);
        }
      });
    } else {
      this.error.set('No se encontró información de usuario');
      this.loading.set(false);
    }
  }

  private setupChartOptions(): void {
    const dark = this.layoutService.isDarkTheme();
    const gridColor = dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.07)';
    const tickColor = dark ? '#ffffff' : '#64748b';
    const legendColor = dark ? '#ffffff' : '#334155';

    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 15,
            font: { size: 12, weight: '500' },
            color: legendColor
          }
        },
        tooltip: {
          backgroundColor: dark ? 'rgba(36,44,64,0.95)' : 'rgba(15,23,42,0.9)',
          padding: 12,
          cornerRadius: 8,
          titleFont: { size: 13, weight: 'bold' },
          bodyFont: { size: 12 },
          displayColors: true
        }
      }
    };

    this.lineChartOptions.set({
      ...baseOptions,
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: { font: { size: 11 }, color: tickColor }
        },
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 }, color: tickColor }
        }
      },
      elements: {
        line: { tension: 0.4 },
        point: { radius: 3, hoverRadius: 6 }
      }
    });

    this.barChartOptions.set({
      ...baseOptions,
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: { font: { size: 11 }, color: tickColor }
        },
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 }, color: tickColor }
        }
      },
      plugins: {
        ...baseOptions.plugins,
        legend: {
          ...baseOptions.plugins.legend,
          position: 'bottom'
        }
      }
    });

    this.doughnutOptions.set({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            usePointStyle: true,
            padding: 15,
            font: { size: 11 },
            color: legendColor,
            generateLabels: (chart: any) => {
              const data = chart.data;
              if (data.labels.length && data.datasets.length) {
                return data.labels.map((label: string, i: number) => {
                  const value = data.datasets[0].data[i];
                  return {
                    text: `${label}: ${value}%`,
                    fillStyle: data.datasets[0].backgroundColor[i],
                    hidden: false,
                    index: i
                  };
                });
              }
              return [];
            }
          }
        },
        tooltip: {
          backgroundColor: dark ? 'rgba(36,44,64,0.95)' : 'rgba(15,23,42,0.9)',
          padding: 12,
          cornerRadius: 8,
          titleFont: { size: 13, weight: 'bold' },
          bodyFont: { size: 12 },
          callbacks: {
            label: (context: any) => {
              return ` ${context.parsed}%`;
            }
          }
        }
      }
    });
  }

  private isDark(): boolean {
    return !!this.layoutService.isDarkTheme();
  }

  private tickTextColor(): string {
    return this.isDark() ? '#ffffff' : '#64748b';
  }

  private gridLineColor(): string {
    return this.isDark() ? 'rgba(255,255,255,0.08)' : '#f1f5f9';
  }

  private cargarDatos(): void {
    this.loading.set(true);
    this.error.set(null);
    this.cargarInsumosStockMinimo();
    this.cargarVentasTickets();

    const today = new Date();
    // Desde el primer día del mes anterior hasta hoy
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const to = new Date(); // Hoy
    const fromIso = from.toISOString();
    const toIso = to.toISOString();

    forkJoin({
      total: this.dashboardService.totalClientes(this.tenantId, fromIso, toIso),
      nuevos: this.dashboardService.clientesNuevosPorPeriodo(this.tenantId, fromIso, toIso),
      cupones: this.dashboardService.statsCupones(this.tenantId, fromIso, toIso),
      ventas: this.dashboardService.resumenVentas(this.tenantId, fromIso, toIso),
      ventasPeriodo: this.dashboardService.ventasPorPeriodo(this.tenantId, 'week', fromIso, toIso),
      topProducts: this.dashboardService.topProductos(this.tenantId, fromIso, toIso),
      ventasCategoria: this.dashboardService.ventasPorCategoria(this.tenantId, fromIso, toIso),
      performance: this.dashboardService.rendimientoCampanas(this.tenantId, fromIso, toIso),
      // Nuevas métricas de lealtad
      repeatPurchase: this.dashboardLoyaltyService.repeatPurchaseRate(this.tenantId, fromIso, toIso),
      identifiedVsGen: this.dashboardLoyaltyService.identifiedVsGeneral(this.tenantId, fromIso, toIso),
      customerLTV: this.dashboardLoyaltyService.customerLTV(this.tenantId, fromIso, toIso),
      couponConv: this.dashboardLoyaltyService.couponConversion(this.tenantId, fromIso, toIso),
      customization: this.dashboardLoyaltyService.customizationAnalysis(this.tenantId, fromIso, toIso),
      roi: this.dashboardLoyaltyService.campaignROI(this.tenantId, fromIso, toIso)
    }).subscribe({
      next: (res) => {
        // Normalizar respuestas que pueden venir envueltas
        const total = this.extractValue(res.total) ?? 0;
        const nuevos = this.extractArray(res.nuevos);
        const cupones = this.extractArray(res.cupones);
        const ventas = this.extractValue(res.ventas);
        const ventasPeriodo = this.extractArray(res.ventasPeriodo);
        const topProducts = this.extractArray(res.topProducts);
        const ventasCategoria = this.extractArray(res.ventasCategoria);
        const performance = this.extractArray(res.performance);

        this.totalClientes.set(total);
        this.clientesNuevos.set(nuevos);
        this.cuponesStats.set(cupones);
        this.ventasResumen.set(ventas);
        this.campanasPerformance.set(performance);

        // Asignar nuevas métricas de lealtad
        const repeatRate = this.extractValue(res.repeatPurchase);
        const idVsGen = this.extractValue(res.identifiedVsGen);
        const ltv = this.extractArray(res.customerLTV);
        const couponConv = this.extractArray(res.couponConv);
        const customization = this.extractArray(res.customization);
        const roi = this.extractArray(res.roi);

        this.repeatPurchaseRate.set(repeatRate);
        this.identifiedVsGeneral.set(idVsGen);
        this.customerLTV.set(ltv);
        this.couponConversion.set(couponConv);
        this.customizationAnalysis.set(customization);
        this.campaignROI.set(roi);

        this.buildLineChart(nuevos);
        this.buildBarChart(cupones);
        this.buildDoughnut(cupones);
        this.buildIdentifiedVsGeneralChart(idVsGen);
        this.buildSalesPeriodChart(ventasPeriodo);
        this.buildTopProductsList(topProducts);
        this.buildTopClientsChart(ltv);
        this.buildSalesByCategoryChart(ventasCategoria);

        this.generateInsights();
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Dashboard load error', err);
        this.error.set('Error cargando datos del dashboard');
        this.loading.set(false);
      }
    });
  }

  private buildSalesPeriodChart(series: SalesByPeriodDTO[]): void {
    if (!series || series.length < 2) {
      this.buildSimulatedSalesPeriodChart(this.periodo());
      return;
    }
    const labels = series.map(s => s.periodStart);
    const total = series.map(s => s.totalSales);
    const identified = series.map(s => s.identifiedSales);
    const general = series.map(s => s.generalSales);
    this.salesPeriodData.set({
      labels,
      datasets: [
        {
          label: 'Ventas',
          data: total,
          fill: true,
          tension: 0.4,
          borderColor: '#6366F1',
          backgroundColor: 'rgba(99,102,241,0.12)'
        },
        {
          label: 'Identificadas',
          data: identified,
          fill: false,
          tension: 0.4,
          borderColor: '#10B981',
          backgroundColor: 'transparent'
        },
        {
          label: 'Generales',
          data: general,
          fill: false,
          tension: 0.4,
          borderColor: '#94A3B8',
          backgroundColor: 'transparent'
        }
      ]
    });
    this.setSalesPeriodOptions();
  }

  /** Datos simulados para visualizar la gráfica (se reemplaza con datos reales cuando haya). */
  private buildSimulatedSalesPeriodChart(period: string = 'week'): void {
    const now = new Date();
    const labels: string[] = [];
    const total: number[] = [];
    const identified: number[] = [];
    const general: number[] = [];

    const pointCounts: Record<string, number> = { day: 14, week: 8, month: 12, year: 5 };
    const steps: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 };
    const points = pointCounts[period] ?? 8;
    const step = steps[period] ?? 7;
    const base = 8200;

    for (let i = points - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * step);
      labels.push(d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }));
      const growth = 1 + (points - 1 - i) * 0.085 + (i % 2 === 0 ? 0.03 : -0.015);
      const t = Math.round(base * growth);
      const idt = Math.round(t * (0.62 + (points - 1 - i) * 0.012));
      total.push(t);
      identified.push(idt);
      general.push(t - idt);
    }

    this.salesPeriodData.set({
      labels,
      datasets: [
        {
          label: 'Ventas',
          data: total,
          fill: true,
          tension: 0.4,
          borderColor: '#6366F1',
          backgroundColor: 'rgba(99,102,241,0.12)'
        },
        {
          label: 'Identificadas',
          data: identified,
          fill: false,
          tension: 0.4,
          borderColor: '#10B981',
          backgroundColor: 'transparent'
        },
        {
          label: 'Generales',
          data: general,
          fill: false,
          tension: 0.4,
          borderColor: '#94A3B8',
          backgroundColor: 'transparent'
        }
      ]
    });
    this.setSalesPeriodOptions();
  }

  cambiarPeriodo(p: string): void {
    if (this.periodo() === p) return;
    this.periodo.set(p);
    this.loadSalesPeriod();
  }

  periodoLabel(): string {
    const found = this.periodoOptions.find(o => o.value === this.periodo());
    return found ? found.label.toLowerCase() : 'periodo';
  }

  private loadSalesPeriod(): void {
    if (!this.tenantId) return;
    const { fromIso, toIso } = this.getPeriodRange(this.periodo());
    this.dashboardService.ventasPorPeriodo(this.tenantId, this.periodo(), fromIso, toIso).subscribe({
      next: (res) => this.buildSalesPeriodChart(res || []),
      error: () => this.buildSimulatedSalesPeriodChart(this.periodo())
    });
  }

  private getPeriodRange(p: string): { fromIso: string; toIso: string } {
    const to = new Date();
    const from = new Date(to);
    switch (p) {
      case 'day': from.setDate(from.getDate() - 30); break;
      case 'month': from.setMonth(from.getMonth() - 11); break;
      case 'year': from.setFullYear(from.getFullYear() - 4); break;
      default: from.setDate(from.getDate() - 84);
    }
    return { fromIso: from.toISOString(), toIso: to.toISOString() };
  }

  private setSalesPeriodOptions(): void {
    this.salesPeriodOptions.set({
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { top: 15, bottom: 5, left: 10, right: 10 }
      },
      plugins: {
        legend: { display: false },
        datalabels: { display: false },
        tooltip: {
          enabled: true,
          padding: 10,
          titleFont: { size: 13 },
          bodyFont: { size: 12 }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 }, color: this.tickTextColor() }
        },
        y: {
          beginAtZero: true,
          grid: { color: this.gridLineColor() },
          ticks: { font: { size: 11 }, color: this.tickTextColor(), callback: (value: any) => '$' + Number(value).toLocaleString() }
        }
      }
    });
  }

  private buildTopProductsList(products: TopProductDTO[]): void {
    const list = (products && products.length > 0)
      ? products.slice(0, 5)
      : [
          { productName: 'Enchiladas', totalQuantity: 142, totalRevenue: 0 },
          { productName: 'Tacos al Pastor', totalQuantity: 118, totalRevenue: 0 },
          { productName: 'Quesadillas', totalQuantity: 96, totalRevenue: 0 },
          { productName: 'Hamburguesa', totalQuantity: 84, totalRevenue: 0 },
          { productName: 'Refresco', totalQuantity: 71, totalRevenue: 0 }
        ];
    this.topProductsList.set(list);
  }

  private buildTopClientsChart(customers: CustomerLTVDTO[]): void {
    const top = [...(customers || [])]
      .sort((a, b) => b.lifetimeValue - a.lifetimeValue)
      .slice(0, 6);

    if (top.length < 2) {
      const simulated = [
        { customerName: 'Valeria Méndez', lifetimeValue: 18450, totalOrders: 0, averageOrderValue: 0 },
        { customerName: 'Carlos Santillán', lifetimeValue: 15230, totalOrders: 0, averageOrderValue: 0 },
        { customerName: 'Mariana Duarte', lifetimeValue: 12980, totalOrders: 0, averageOrderValue: 0 },
        { customerName: 'Rodrigo Garza', lifetimeValue: 10410, totalOrders: 0, averageOrderValue: 0 },
        { customerName: 'Ana Sofía Ruiz', lifetimeValue: 8760, totalOrders: 0, averageOrderValue: 0 },
        { customerName: 'Jorge Ramírez', lifetimeValue: 6420, totalOrders: 0, averageOrderValue: 0 }
      ];
      this.setTopClientsChart(simulated.map(c => c.customerName), simulated.map(c => c.lifetimeValue));
      return;
    }

    this.setTopClientsChart(
      top.map(c => c.customerName),
      top.map(c => c.lifetimeValue)
    );
  }

  private setTopClientsChart(labels: string[], data: number[]): void {
    this.topClientsData.set({
      labels,
      datasets: [
        {
          label: 'LTV ($)',
          data,
          backgroundColor: 'rgba(99,102,241,0.85)',
          hoverBackgroundColor: '#4f46e5',
          borderRadius: 8,
          maxBarThickness: 42
        }
      ]
    });
    this.topClientsOptions.set({
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { top: 15, bottom: 5, left: 10, right: 10 }
      },
      plugins: {
        legend: { display: false },
        datalabels: { display: false },
        tooltip: {
          enabled: true,
          padding: 10,
          titleFont: { size: 13 },
          bodyFont: { size: 12 }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxRotation: 45, minRotation: 0, font: { size: 11, weight: '500' }, color: this.tickTextColor() }
        },
        y: {
          beginAtZero: true,
          grid: { color: this.gridLineColor() },
          ticks: { font: { size: 11 }, color: this.tickTextColor(), callback: (value: any) => '$' + Number(value).toLocaleString() }
        }
      }
    });
  }

  private buildSalesByCategoryChart(categories: SalesByCategoryDTO[]): void {
    const palette = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
    const list = (categories && categories.length > 0)
      ? categories.slice(0, 8)
      : [
          { categoryName: 'Desayunos', totalSales: 42000 },
          { categoryName: 'Comidas', totalSales: 68000 },
          { categoryName: 'Bebidas', totalSales: 31000 },
          { categoryName: 'Postres', totalSales: 19000 },
          { categoryName: 'Botanas', totalSales: 15000 }
        ];

    this.salesByCategoryData.set({
      labels: list.map(c => c.categoryName),
      datasets: [
        {
          label: 'Ventas ($)',
          data: list.map(c => c.totalSales),
          backgroundColor: list.map((_, i) => palette[i % palette.length]),
          hoverBackgroundColor: list.map((_, i) => palette[i % palette.length]),
          borderRadius: 8,
          maxBarThickness: 46,
          clip: false
        }
      ]
    });
    this.salesByCategoryOptions.set({
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { top: 15, bottom: 5, left: 10, right: 10 }
      },
      plugins: {
        legend: { display: false },
        datalabels: { display: false },
        tooltip: {
          enabled: true,
          padding: 10,
          titleFont: { size: 13 },
          bodyFont: { size: 12 }
        }
      },
      scales: {
        x: {
          display: false,
          beginAtZero: true,
          grid: { display: false },
          ticks: { display: false }
        },
        y: {
          grid: { color: this.gridLineColor() },
          ticks: { font: { size: 11 }, color: this.tickTextColor() }
        }
      }
    });
  }

  private buildLineChart(series: TimeSeriesCountDTO[]): void {
    const labels = series.map(s => s.periodStart);
    const data = series.map(s => s.count);
    this.lineChartData.set({
      labels,
      datasets: [
        {
          label: 'Clientes Nuevos',
          data,
          fill: true,
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59,130,246,0.15)'
        }
      ]
    });
  }

  private buildBarChart(stats: CouponStatsDTO[]): void {
    const labels = stats.map(s => s.campaignName);
    const created = stats.map(s => s.couponsCreated);
    const redeemed = stats.map(s => s.couponsRedeemed);
    this.barChartData.set({
      labels,
      datasets: [
        { label: 'Creados', backgroundColor: '#3B82F6', data: created },
        { label: 'Redimidos', backgroundColor: '#10B981', data: redeemed }
      ]
    });
  }

  private buildDoughnut(stats: CouponStatsDTO[]): void {
    const labels = stats.map(s => s.campaignName);
    const data = stats.map(s => Number(s.redemptionRatePct ?? 0));
    const colors = this.generateColors(stats.length);
    this.doughnutData.set({
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        hoverBackgroundColor: colors
      }]
    });
  }

  private buildIdentifiedVsGeneralChart(data: IdentifiedVsGeneralDTO | null): void {
    if (!data) return;

    const labels = ['Identificadas', 'Generales'];
    const chartData = {
      labels,
      datasets: [{
        data: [data.identifiedPercentage, data.generalPercentage],
        backgroundColor: ['#6366F1', '#94A3B8'],
        hoverBackgroundColor: ['#4F46E5', '#78909C']
      }]
    };

    this.identifiedVsGeneralChartData.set(chartData);
    this.identifiedVsGeneralChartOptions.set(this.doughnutOptions());
  }

  private generateColors(count: number): string[] {
    const palette = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
    return Array.from({ length: count }, (_, i) => palette[i % palette.length]);
  }

  getBadgeSeverity(pct: number): 'success' | 'warn' | 'danger' {
    if (pct > 70) return 'success';
    if (pct >= 50) return 'warn';
    return 'danger';
  }

  private extractArray(value: any): any[] {
    if (Array.isArray(value)) return value;
    if (value?.object && Array.isArray(value.object)) return value.object;
    return [];
  }

  private extractValue(value: any): any {
    if (value === null || value === undefined) return null;
    if (typeof value === 'object' && 'object' in value) return value.object;
    return value;
  }

  private generateInsights(): void {
    const insights: Insight[] = [];
    const performance = this.campanasPerformance();
    const cupones = this.cuponesStats();
    const ventas = this.ventasResumen();
    const repeatRate = this.repeatPurchaseRate();
    const idVsGen = this.identifiedVsGeneral();

    // Insight 1: Tasa de Recompra (Valor de Negocio)
    if (repeatRate && repeatRate.totalCustomers > 0) {
      if (repeatRate.repeatRate < 30) {
        insights.push({
          type: 'warn',
          icon: 'pi-exclamation-triangle',
          message: `Tu tasa de recompra es ${repeatRate.repeatRate.toFixed(1)}%. Sugerencia: Activa campañas de retención.`
        });
      } else if (repeatRate.repeatRate >= 30 && repeatRate.repeatRate < 50) {
        insights.push({
          type: 'info',
          icon: 'pi-info-circle',
          message: `Tu tasa de recompra es ${repeatRate.repeatRate.toFixed(1)}%. Está en el promedio esperado.`
        });
      } else {
        insights.push({
          type: 'success',
          icon: 'pi-chart-line',
          message: `¡Excelente! Tu tasa de recompra es ${repeatRate.repeatRate.toFixed(1)}%, por encima del promedio.`
        });
      }
    }

    // Insight 2: Ventas Identificadas vs Generales (Valor de Negocio)
    if (idVsGen && idVsGen.generalPercentage > 50) {
      insights.push({
        type: 'warn',
        icon: 'pi-exclamation-triangle',
        message: `${idVsGen.generalPercentage.toFixed(1)}% de ventas son generales. Sugerencia: Capacita al personal en registro de clientes.`
      });
    }

    // Insight 3: Campaña con mejor rendimiento
    if (performance.length > 0) {
      const bestCampaign = performance.reduce((prev, current) =>
        (current.redemptionRatePct > prev.redemptionRatePct) ? current : prev
      );

      if (bestCampaign.redemptionRatePct > 30) {
        insights.push({
          type: 'success',
          icon: 'pi-chart-line',
          message: `Tu campaña "${bestCampaign.campaignName}" tiene una redención del ${bestCampaign.redemptionRatePct.toFixed(1)}%, por encima del promedio.`
        });
      } else if (bestCampaign.redemptionRatePct >= 15) {
        insights.push({
          type: 'info',
          icon: 'pi-info-circle',
          message: `Tu campaña "${bestCampaign.campaignName}" tiene una redención del ${bestCampaign.redemptionRatePct.toFixed(1)}%, dentro del promedio esperado.`
        });
      }
    }

    // Insight 4: Ticket promedio
    if (ventas && ventas.avgTicket > 0) {
      const avgTicketFormatted = ventas.avgTicket.toFixed(2);
      insights.push({
        type: 'info',
        icon: 'pi-shopping-cart',
        message: `El ticket promedio con cupón es de $${avgTicketFormatted}, basado en ${ventas.transactionCount} transacciones.`
      });
    }

    // Insight 5: Cupones sin redimir
    if (cupones.length > 0) {
      const totalCreated = cupones.reduce((sum, c) => sum + c.couponsCreated, 0);
      const totalRedeemed = cupones.reduce((sum, c) => sum + c.couponsRedeemed, 0);
      const unredeemed = totalCreated - totalRedeemed;
      const unredeemedPct = totalCreated > 0 ? (unredeemed / totalCreated) * 100 : 0;

      if (unredeemedPct > 70) {
        insights.push({
          type: 'warn',
          icon: 'pi-exclamation-triangle',
          message: `Hay ${unredeemed} cupones activos sin redimir (${unredeemedPct.toFixed(0)}% del total). Considera estrategias de activación.`
        });
      }
    }

    // Insight 6: Crecimiento de clientes
    const nuevos = this.clientesNuevos();
    if (nuevos.length >= 2) {
      const lastWeek = nuevos[nuevos.length - 1]?.count || 0;
      const previousWeek = nuevos[nuevos.length - 2]?.count || 0;

      if (lastWeek > previousWeek) {
        const growth = previousWeek > 0 ? ((lastWeek - previousWeek) / previousWeek * 100) : 0;
        insights.push({
          type: 'success',
          icon: 'pi-arrow-up',
          message: `¡Excelente! Tuviste un crecimiento del ${growth.toFixed(0)}% en clientes nuevos esta semana.`
        });
      }
    }

    // Insight 7: Campañas con bajo rendimiento
    if (performance.length > 0) {
      const lowPerformers = performance.filter(p => p.redemptionRatePct < 10 && p.couponsIssued > 10);
      if (lowPerformers.length > 0) {
        insights.push({
          type: 'error',
          icon: 'pi-exclamation-circle',
          message: `${lowPerformers.length} campaña(s) tienen menos del 10% de redención. Revisa su configuración o audiencia.`
        });
      }
    }

    this.insights.set(insights.slice(0, 4)); // Máximo 4 insights
  }

  // Métodos auxiliares para UI
  getRepeatRateTooltip(): string {
    const rate = this.repeatPurchaseRate();
    if (!rate) return '';
    if (rate.repeatRate < 30) {
      return '🎯 Sugerencia: Activa campañas de retención para aumentar clientes recurrentes.';
    }
    return `Tu tasa de recompra es saludable: ${rate.repeatRate.toFixed(1)}%`;
  }

  getIdentifiedPercentageTooltip(): string {
    const data = this.identifiedVsGeneral();
    if (!data) return '';
    if (data.generalPercentage > 50) {
      return '⚠️ Sugerencia: Capacita al personal en registro de clientes para aumentar ventas identificadas.';
    }
    const percentage = data.identifiedPercentage ?? 0;
    return `${percentage.toFixed(1)}% de tus ventas están identificadas.`;
  }

  hasEmptyMetrics(): boolean {
    return !this.repeatPurchaseRate() && !this.identifiedVsGeneral();
  }

  getRepeatRateBadgeSeverity(): 'success' | 'warn' | 'danger' {
    const rate = this.repeatPurchaseRate();
    if (!rate) return 'danger';
    if (rate.repeatRate > 50) return 'success';
    if (rate.repeatRate >= 30) return 'warn';
    return 'danger';
  }

  getIdentifiedSeverity(): 'success' | 'warn' | 'danger' {
    const data = this.identifiedVsGeneral();
    if (!data) return 'danger';
    if (data.identifiedPercentage > 70) return 'success';
    if (data.identifiedPercentage >= 50) return 'warn';
    return 'danger';
  }

  /* ============ Costos y Ganancias (configurables) ============ */

  openCostosModal(): void {
    this.costosModalVisible.set(true);
  }

  closeCostosModal(): void {
    this.costosModalVisible.set(false);
  }

  openGananciasModal(): void {
    this.gananciasModalVisible.set(true);
  }

  closeGananciasModal(): void {
    this.gananciasModalVisible.set(false);
  }

  guardarPorcentajes(): void {
    let mp = Math.max(0, Math.min(100, this.porcentajeMateriaPrima() || 0));
    let rh = Math.max(0, Math.min(100, this.porcentajeRecursoHumano() || 0));
    // Si el total supera 100, recortar el de mayor peso para respetar el tope
    if (mp + rh > 100) {
      if (mp >= rh) mp = 100 - rh;
      else rh = 100 - mp;
    }
    this.porcentajeMateriaPrima.set(mp);
    this.porcentajeRecursoHumano.set(rh);
    try {
      localStorage.setItem(
        DashboardComponent.STORAGE_KEY,
        JSON.stringify({ materiaPrima: mp, recursoHumano: rh })
      );
    } catch {
      // almacenamiento no disponible, se omite la persistencia
    }
    this.messageService.add({ severity: 'success', summary: 'Guardado', detail: 'Porcentajes de costos actualizados' });
  }

  reiniciarPorcentajes(): void {
    this.porcentajeMateriaPrima.set(DashboardComponent.DEFAULT_MP);
    this.porcentajeRecursoHumano.set(DashboardComponent.DEFAULT_RH);
    this.guardarPorcentajes();
  }

  formatoMoneda(valor: any): string {
    const n = Number(valor ?? 0);
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }

  /* ============ Insumos en stock mínimo ============ */

  private cargarInsumosStockMinimo(): void {
    this.insumosStockMinimoLoading.set(true);
    this.inventoryService.getInsumos(this.tenantId).subscribe({
      next: (res) => {
        this.insumos.set(Array.isArray(res?.object) ? res.object : (res || []));
        this.insumosStockMinimoLoading.set(false);
      },
      error: () => {
        this.insumos.set([]);
        this.insumosStockMinimoLoading.set(false);
      }
    });
  }

  /* ============ Ventas totales: tickets de los últimos 2 meses ============ */

  private cargarVentasTickets(): void {
    this.ventasTicketsLoading.set(true);
    this.dashboardService.ventasTickets(this.tenantId).subscribe({
      next: (res) => {
        const page = res?.object ?? res;
        const content = Array.isArray(page?.content) ? page.content : [];
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - 2);
        this.ventasTickets.set(
          content.filter((o: any) => o && o.fecha && new Date(o.fecha) >= cutoff)
        );
        this.ventasTicketsLoading.set(false);
      },
      error: () => {
        this.ventasTickets.set([]);
        this.ventasTicketsLoading.set(false);
      }
    });
  }

  openVentasModal(): void {
    this.ventasModalVisible.set(true);
  }

  closeVentasModal(): void {
    this.ventasModalVisible.set(false);
  }

  formatoTicketTotal(total: any): string {
    const n = Number(total ?? 0);
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }

  formatoTicketFecha(fecha: any): string {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  openStockModal(): void {
    this.stockModalVisible.set(true);
  }

  closeStockModal(): void {
    this.stockModalVisible.set(false);
  }

  insumoLowClass(insumo: Insumo): string {
    return insumo.stock <= insumo.stockMinimo ? 'stock-low' : 'stock-ok';
  }

  /* ============ Restock de insumo ============ */

  openRestock(insumo: Insumo): void {
    this.restockTarget.set(insumo);
    this.restockCantidad.set(0);
    this.restockVisible.set(true);
  }

  closeRestock(): void {
    this.restockVisible.set(false);
  }

  doRestock(): void {
    const target = this.restockTarget();
    if (!target || this.restockCantidad() <= 0) return;
    this.inventoryService.restockInsumo(target.id, this.restockCantidad()).subscribe({
      next: (res) => {
        this.messageService.add({ severity: 'success', summary: 'Exitoso', detail: `Stock actualizado: ${res?.object}` });
        this.closeRestock();
        this.cargarInsumosStockMinimo();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo reabastecer el insumo' });
      }
    });
  }

  /* ============ Navegación ============ */

  irAClientes(): void {
    this.router.navigate(['/dashboard/clientes']);
  }
}

