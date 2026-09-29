import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import confetti from 'canvas-confetti';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { AppFooter } from './app.footer';
import { LayoutService } from '../service/layout.service';
import { OrderSseService, SseNewOrderEvent } from '@/pages/comandix/services/order-sse.service';
import { AuthService } from '@/auth/auth.service';

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
    `],
    template: `
    <div class="min-h-screen bg-slate-50 dark:bg-slate-950">
        <!-- Sidebar fijo solo en escritorio; en móvil vive en el drawer del header -->
        <app-sidebar></app-sidebar>

        <!-- El padding izquierdo sigue al ancho del sidebar (w-64 / w-20) -->
        <div class="app-content transition-all duration-300 ease-in-out" [ngClass]="layoutService.contentPaddingClass()">
            <app-topbar></app-topbar>
            <main class="app-main min-h-[calc(100vh-8rem)] p-3 md:p-4 lg:p-6">
                <router-outlet></router-outlet>
            </main>
            <app-footer></app-footer>
        </div>

        <p-toast position="bottom-right"></p-toast>
    </div>`
})
export class AppLayout implements OnInit, OnDestroy {

    private readonly NOTIFICATION_SOUND = 'assets/sounds/dragon-studio-correct-472358.mp3';
    private sseSub: Subscription | null = null;

    constructor(
        public layoutService: LayoutService,
        public router: Router,
        private orderSseService: OrderSseService,
        private authService: AuthService,
        private messageService: MessageService
    ) {}

    ngOnInit(): void {
        this.startGlobalOrderNotifications();
    }

    /**
     * Notificación global de nuevas órdenes del CHATBOT: funciona en cualquier
     * página del dashboard (no solo en la pantalla del mesero), con sonido.
     */
    private startGlobalOrderNotifications(): void {
        const tenantId = this.authService.getTenantId();
        if (!tenantId) {
            console.warn('[AppLayout] Sin tenantId, no se activan notificaciones globales de órdenes');
            return;
        }

        // Conexión SSE global (reconexión automática nativa del navegador)
        this.orderSseService.connect(tenantId);

        // Escuchar nuevas órdenes desde cualquier página
        this.sseSub = this.orderSseService.newOrder$.subscribe({
            next: (sseEvent: SseNewOrderEvent) => {
                if (sseEvent.tenantId !== tenantId) {
                    return;
                }
                this.notifyNewOrder(sseEvent);
            }
        });
    }

    private notifyNewOrder(event: SseNewOrderEvent): void {
        const order = event.order;

        // 1) Sonido (una sola vez para no duplicar la campana)
        this.playNotificationSound(1, 500);

        // 2) Confetti con paleta Lealtix
        confetti({
            particleCount: 90,
            spread: 75,
            origin: { y: 0.35 },
            colors: ['#DA9F5B', '#33211D', '#FFFBF2', '#c8882a', '#f0c080']
        });

        // 3) Toast global con resumen del pedido
        const clientName = order.customerName ?? 'Cliente General';
        const total = order.total ?? order.subtotal ?? 0;
        this.messageService.add({
            severity: 'success',
            summary: '¡Nueva Orden!',
            detail: `${clientName} — Total: $${Number(total).toFixed(2)}`,
            life: 6000,
            icon: 'pi pi-shopping-bag'
        });
    }

    private playNotificationSound(times = 1, delayMs = 500): void {
        for (let index = 0; index < times; index++) {
            setTimeout(() => {
                try {
                    const audio = new Audio(this.NOTIFICATION_SOUND);
                    audio.play().catch(() => {});
                } catch {
                    // silent: archivo puede no existir en dev
                }
            }, index * delayMs);
        }
    }

    ngOnDestroy() {
        if (this.sseSub) {
            this.sseSub.unsubscribe();
        }

        this.orderSseService.disconnect();
    }
}

