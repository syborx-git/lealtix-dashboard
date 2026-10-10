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

    private readonly NOTIFICATION_SOUND = 'assets/sounds/dragon-studio-correct-472358.mp3';
    private sseSub: Subscription | null = null;
    private navSub: Subscription | null = null;

    readonly isFullBleed = signal(false);
    private readonly FULL_BLEED_ROUTES = ['/dashboard/comandix', '/dashboard/cocina', '/dashboard/barra'];

    constructor(
        public layoutService: LayoutService,
        public router: Router,
        private orderSseService: OrderSseService,
        private authService: AuthService,
        private messageService: MessageService
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
        if (this.navSub) {
            this.navSub.unsubscribe();
        }

        this.orderSseService.disconnect();
    }
}

