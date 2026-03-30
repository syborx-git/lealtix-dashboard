import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ChartModule } from 'primeng/chart';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SkeletonModule } from 'primeng/skeleton';
import { AuthService } from '@/auth/auth.service';
import { KitchenDashboardFacadeService } from './services/kitchen-dashboard-facade.service';

@Component({
    selector: 'app-kitchen-dashboard',
    standalone: true,
    imports: [CommonModule, CardModule, ButtonModule, TagModule, ChartModule, ProgressSpinnerModule, SkeletonModule],
    templateUrl: './kitchen-dashboard.component.html',
    styleUrl: './kitchen-dashboard.component.scss'
})
export class KitchenDashboardComponent implements OnInit {
    private facade = inject(KitchenDashboardFacadeService);
    private authService = inject(AuthService);
    private router = inject(Router);

    readonly loading = this.facade.loading;
    readonly error = this.facade.error;
    readonly tenantName = this.facade.tenantName;
    readonly topThreeDishes = this.facade.topThreeDishes;
    readonly repeatRateText = this.facade.repeatRateText;
    readonly completedOrders = this.facade.completedOrders;
    readonly trendKeywords = this.facade.trendKeywords;
    readonly vipAlert = this.facade.vipAlert;
    readonly selectedDays = signal<1 | 3 | 7>(1);
    readonly rangeLabel = computed(() => {
        const days = this.selectedDays();
        if (days === 1) {
            return 'Vista del dia actual';
        }

        if (days === 3) {
            return 'Ultimos 3 dias';
        }

        return 'Ultimos 7 dias';
    });

    readonly trendChartData = computed(() => {
        const keywords = this.trendKeywords().slice(0, 5);
        return {
            labels: keywords.map((k) => k.keyword),
            datasets: [
                {
                    label: 'Frecuencia',
                    data: keywords.map((k) => k.frequency),
                    borderRadius: 8,
                    backgroundColor: ['#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd']
                }
            ]
        };
    });

    readonly trendChartOptions = signal<any>({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            }
        },
        scales: {
            x: {
                grid: {
                    display: false
                },
                ticks: {
                    color: '#64748b'
                }
            },
            y: {
                beginAtZero: true,
                ticks: {
                    color: '#64748b',
                    precision: 0
                },
                grid: {
                    color: '#e2e8f0'
                }
            }
        }
    });

    ngOnInit(): void {
        const user = this.authService.getCurrentUser();
        const tenantId = user?.tenantId ?? 0;

        if (tenantId <= 0) {
            this.facade.error.set('No se pudo resolver el tenant actual para cargar el dashboard de cocina.');
            return;
        }

        this.facade.loadMetricsByDays(tenantId, this.selectedDays());
    }

    applyRange(days: 1 | 3 | 7): void {
        const user = this.authService.getCurrentUser();
        const tenantId = user?.tenantId ?? 0;

        if (tenantId <= 0 || this.selectedDays() === days) {
            return;
        }

        this.selectedDays.set(days);
        this.facade.loadMetricsByDays(tenantId, days);
    }

    goToKitchen(): void {
        this.router.navigate(['/dashboard/cocina']);
    }
}
