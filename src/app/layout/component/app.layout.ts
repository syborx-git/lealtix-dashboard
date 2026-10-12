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
import { NotificationService } from '@/shared/services/notification.service';
import { InventoryService } from '@/pages/inventario/service/inventory.service';

@Component({
    selector: 'app-layout',
    standalone: true,
    imports: [CommonModule, HeaderComponent, SidebarComponent, RouterModule, AppFooter, ToastModule],
    providers: [MessageService],
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

        <p-toast position="bottom-right"></p-toast>
    </div>`
})
export class AppLayout implements OnInit, OnDestroy {

    private sseSub: Subscription | null = null;
    private statusSub: Subscription | null = null;
    private navSub: Subscription | null = null;
    private stockTimer: ReturnType<typeof setInterval> | null = null;

    readonly isFullBleed = signal(false);
    private readonly FULL_BLEED_ROUTES = ['/dashboard/comandix', '/dashboard/cocina', '/dashboard/barra'];
    private readonly STOCK_POLL_MS = 5 * 60 * 1000;

    constructor(
        public layoutService: LayoutService,
        public router: Router,
        private orderSseService: OrderSseService,
        private authService: AuthService,
        private messageService: MessageService,
        private notificationService: NotificationService,
        private inventoryService: InventoryService
    ) {
        this.updateFullBleed(this.router.url);
        this.navSub = this.router.events
            .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
            .subscribe((e) => this.updateFullBleed(e.urlAfterRedirects || e.url));
    }

    private updateFullBleed(url: string): void {
        const clean = (url || '').split('?')[0];
        const isOperationalRoute = this.FULL_BLEED_ROUTES.some((r) => clean.startsWith(r));
        // Pantalla completa solo en dispositivos táctiles (tablet). En computadora
        // con mouse se conserva el layout normal con scroll de página.
        this.isFullBleed.set(isOperationalRoute && this.isTouchDevice());
    }

    private isTouchDevice(): boolean {
        try {
            return !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        } catch {
            return false;
        }
    }

    ngOnInit(): void {
        this.startGlobalOrderNotifications();
        this.notificationService.ensureBrowserPermission();
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

        // Alertas de stock: al inicio y luego cada 5 min
        this.loadStockAlerts(tenantId);
        this.stockTimer = setInterval(() => this.loadStockAlerts(tenantId), this.STOCK_POLL_MS);
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
            { sound: true, toast: true, browser: true }
        );
    }

    private notifyOrderStatus(ev: SseOrderStatusEvent): void {
        const estado = String(ev?.order?.estado || '').toUpperCase();
        const id = String(ev?.order?.id ?? '').slice(0, 6).toUpperCase();
        const client = ev?.order?.customerName ? ` · ${ev.order.customerName}` : '';

        let title = 'Pedido actualizado';
        let message = `Pedido #${id}${client}`;
        let icon = 'pi-refresh';
        let severity: 'success' | 'info' | 'warn' | 'error' = 'info';
        let sound = false;

        switch (estado) {
            case 'CONFIRMADA':
                title = 'Pedido confirmado';
                message = `Pedido #${id} confirmado${client}`;
                icon = 'pi-check-circle';
                break;
            case 'EN_PREPARACION':
                title = 'En preparación';
                message = `Pedido #${id} empezó a prepararse${client}`;
                icon = 'pi-spinner';
                break;
            case 'LISTA':
            case 'LISTO':
            case 'READY':
                title = '¡Pedido listo!';
                message = `Pedido #${id} listo para entregar${client}`;
                icon = 'pi-bell';
                severity = 'success';
                sound = true;
                break;
            case 'PAGADA':
                title = 'Pedido pagado';
                message = `Pedido #${id} pagado${client}`;
                icon = 'pi-dollar';
                severity = 'success';
                break;
            case 'CANCELADA':
                title = 'Pedido cancelado';
                message = `Pedido #${id} cancelado${client}`;
                icon = 'pi-times-circle';
                severity = 'error';
                sound = true;
                break;
            default:
                break;
        }

        this.notificationService.add(
            { type: 'order-status', group: 'order', title, message, icon, severity, route: '/dashboard/comandix' },
            { sound, toast: true, browser: sound }
        );
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
                            { dedupeKey: `stock-out-${id}`, toast: true, browser: true }
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

        this.orderSseService.disconnect();
    }
}

