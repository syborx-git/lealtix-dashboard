import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import confetti from 'canvas-confetti';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { AppFooter } from './app.footer';
import { LayoutService } from '../service/layout.service';
import { OrderSseService, SseNewOrderEvent, SseOrderStatusEvent } from '@/pages/comandix/services/order-sse.service';
import { AuthService } from '@/auth/auth.service';
import { InactivityService } from '@/auth/inactivity.service';
import { NotificationService } from '@/shared/services/notification.service';
import { InventoryService } from '@/pages/inventario/service/inventory.service';

@Component({
    selector: 'app-layout',
    standalone: true,
    imports: [CommonModule, HeaderComponent, SidebarComponent, RouterModule, AppFooter, ToastModule],
    styles: [`
        :host {
            display: block;
            min-height: 100vh;
        }

        /* Pantallas operativas (POS/tableros): app nativa a pantalla completa,
           sin scroll de página; cada panel scrollea por dentro.
           Solo se aplica en dispositivos táctiles (ver isFullBleed). */
        .app-content:has(.app-main--flush) {
            display: flex;
            flex-direction: column;
            height: 100dvh;
            overflow: hidden;
        }

        .app-main--flush {
            flex: 1 1 auto;
            min-height: 0;
            padding: 0 !important;
            overflow: hidden;
            position: relative;
        }

        .notif-toast {
            display: flex;
            align-items: flex-start;
            gap: 0.7rem;
            padding: 0.15rem 0;
        }
        .notif-toast > .pi {
            font-size: 1.15rem;
            margin-top: 1px;
        }
        .notif-toast-body {
            display: flex;
            flex-direction: column;
            min-width: 0;
        }
        .notif-toast-title {
            font-weight: 700;
            font-size: 0.9rem;
        }
        .notif-toast-detail {
            font-size: 0.8rem;
            opacity: 0.92;
        }
    `],
    template: `
    <div class="min-h-screen bg-slate-50 dark:bg-slate-950">
        <!-- Sidebar fijo solo en escritorio; en móvil vive en el drawer del header -->
        <app-sidebar></app-sidebar>

        <!-- El padding izquierdo sigue al ancho del sidebar (w-64 / w-20) -->
        <div class="app-content transition-all duration-300 ease-in-out" [ngClass]="layoutService.contentPaddingClass()">
            <app-topbar></app-topbar>
            <main class="app-main"
                  [ngClass]="isFullBleed() ? 'app-main--flush' : 'min-h-[calc(100vh-8rem)] p-3 md:p-4 lg:p-6'">
                <router-outlet></router-outlet>
            </main>
            <app-footer *ngIf="!isFullBleed()"></app-footer>
        </div>

        <p-toast position="bottom-right">
            <ng-template let-message pTemplate="message">
                <div class="notif-toast" [style.cursor]="message.data?.route ? 'pointer' : 'default'" (click)="onToastClick(message)">
                    <i class="pi" [ngClass]="message.icon || 'pi-bell'"></i>
                    <div class="notif-toast-body">
                        <span class="notif-toast-title">{{ message.summary }}</span>
                        <span class="notif-toast-detail">{{ message.detail }}</span>
                    </div>
                </div>
            </ng-template>
        </p-toast>
    </div>`
})
export class AppLayout implements OnInit, OnDestroy {

    private sseSub: Subscription | null = null;
    private statusSub: Subscription | null = null;
    private navSub: Subscription | null = null;
    private stockTimer: ReturnType<typeof setInterval> | null = null;

    readonly isFullBleed = signal(false);
    private prevSidebarCollapsed: boolean | null = null;
    private readonly FULL_BLEED_ROUTES = ['/dashboard/comandix', '/dashboard/cocina', '/dashboard/barra'];
    private readonly STOCK_POLL_MS = 5 * 60 * 1000;

    constructor(
        public layoutService: LayoutService,
        public router: Router,
        private orderSseService: OrderSseService,
        private authService: AuthService,
        private messageService: MessageService,
        private inactivityService: InactivityService,
        private notificationService: NotificationService,
        private inventoryService: InventoryService
    ) {}

    ngOnInit(): void {
        this.startGlobalOrderNotifications();
        this.inactivityService.start();
        this.notificationService.ensureBrowserPermission();
    }

    /** Al hacer clic en un toast, navega al apartado de la notificación. */
    onToastClick(message: any): void {
        const route = message?.data?.route;
        if (route) {
            void this.router.navigateByUrl(route);
            this.messageService.clear();
        }
    }

    /**
     * Notificaciones globales en tiempo real (en cualquier página del dashboard):
     * nuevas órdenes, cambios de estado de pedidos y alertas de stock.
     */
    private startGlobalOrderNotifications(): void {
        const tenantId = this.authService.getTenantId();
        if (!tenantId) {
            console.warn('[AppLayout] Sin tenantId, no se activan notificaciones globales');
            return;
        }

        // Conexión SSE global (reconexión automática nativa del navegador)
        this.orderSseService.connect(tenantId);

        this.sseSub = this.orderSseService.newOrder$.subscribe({
            next: (sseEvent: SseNewOrderEvent) => {
                if (sseEvent.tenantId !== tenantId) {
                    return;
                }
                this.notifyNewOrder(sseEvent);
            }
        });

        this.statusSub = this.orderSseService.orderStatusChanged$.subscribe({
            next: (ev: SseOrderStatusEvent) => {
                if (ev.tenantId !== tenantId) {
                    return;
                }
                this.notifyOrderStatus(ev);
            }
        });

        // Alertas de stock SOLO para ADMIN (meseros/cocina no las necesitan).
        // Además se revisa al inicio y luego cada 5 min.
        const role = String(this.authService.getUserRole?.() || '').toUpperCase();
        if (role === 'ADMIN') {
            this.loadStockAlerts(tenantId);
            this.stockTimer = setInterval(() => this.loadStockAlerts(tenantId), this.STOCK_POLL_MS);
        }
    }

    private notifyNewOrder(event: SseNewOrderEvent): void {
        const order = event.order;
        const clientName = order.customerName ?? 'Cliente General';
        const total = order.total ?? order.subtotal ?? 0;

        // Confetti con paleta Lealtix
        confetti({
            particleCount: 90,
            spread: 75,
            origin: { y: 0.35 },
            colors: ['#DA9F5B', '#33211D', '#FFFBF2', '#c8882a', '#f0c080']
        });

        this.notificationService.add(
            {
                type: 'new-order',
                group: 'order',
                title: '¡Nuevo pedido!',
                message: `${clientName} — Total: $${Number(total).toFixed(2)}`,
                icon: 'pi-shopping-bag',
                severity: 'success',
                route: '/dashboard/comandix'
            },
            { sound: true, browser: true }
        );
    }

    private notifyOrderStatus(ev: SseOrderStatusEvent): void {
        const estado = String(ev?.order?.estado || '').toUpperCase();
        const id = String(ev?.order?.id ?? '').slice(0, 6).toUpperCase();
        const client = ev?.order?.customerName ? ` · ${ev.order.customerName}` : '';

        // Solo se notifica al CONFIRMAR y al TERMINAR (para no saturar).
        // El resto de transiciones (en preparación, pagado, cancelado) no notifican.
        if (estado === 'CONFIRMADA') {
            this.notificationService.add(
                {
                    type: 'order-status',
                    group: 'order',
                    title: 'Pedido confirmado',
                    message: `Pedido #${id} confirmado${client}`,
                    icon: 'pi-check-circle',
                    severity: 'info',
                    route: '/dashboard/comandix'
                },
                {  }
            );
        } else if (estado === 'LISTO' || estado === 'LISTA' || estado === 'READY') {
            this.notificationService.add(
                {
                    type: 'order-status',
                    group: 'order',
                    title: 'Pedido terminado',
                    message: `Pedido #${id} listo para entregar${client}`,
                    icon: 'pi-bell',
                    severity: 'success',
                    route: '/dashboard/comandix'
                },
                { sound: true, browser: true }
            );
        }
    }

    /** Revisa el inventario y avisa de productos con stock bajo o agotado. */
    private loadStockAlerts(tenantId: number): void {
        this.inventoryService.getByTenant(tenantId).subscribe({
            next: (resp: any) => {
                const items = Array.isArray(resp?.object) ? resp.object : [];
                for (const p of items) {
                    const id = Number(p?.id);
                    if (!Number.isFinite(id)) {
                        continue;
                    }
                    const name = p?.name || p?.nombre || `Producto #${id}`;
                    if (p?.outOfStock) {
                        this.notificationService.add(
                            {
                                type: 'stock-out',
                                group: 'stock',
                                title: 'Producto agotado',
                                message: `${name} se quedó sin stock`,
                                icon: 'pi-exclamation-triangle',
                                severity: 'error',
                                route: '/dashboard/inventario-cocina'
                            },
                            { dedupeKey: `stock-out-${id}`, browser: true }
                        );
                    } else if (p?.lowStock) {
                        this.notificationService.add(
                            {
                                type: 'stock-low',
                                group: 'stock',
                                title: 'Stock bajo',
                                message: `${name} con stock bajo (${p.stock ?? 0})`,
                                icon: 'pi-box',
                                severity: 'warn',
                                route: '/dashboard/inventario-cocina'
                            },
                            { dedupeKey: `stock-low-${id}`, toast: false }
                        );
                    } else {
                        this.notificationService.clearDedupe(`stock-low-${id}`);
                        this.notificationService.clearDedupe(`stock-out-${id}`);
                    }
                }
            },
            error: () => undefined
        });
    }

    ngOnDestroy() {
        if (this.sseSub) {
            this.sseSub.unsubscribe();
        }
        if (this.statusSub) {
            this.statusSub.unsubscribe();
        }
        if (this.navSub) {
            this.navSub.unsubscribe();
        }
        if (this.stockTimer) {
            clearInterval(this.stockTimer);
        }

        this.inactivityService.stop();
        this.orderSseService.disconnect();
    }
}

