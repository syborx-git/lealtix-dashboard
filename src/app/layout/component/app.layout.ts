import { Component, OnInit, Renderer2, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import confetti from 'canvas-confetti';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { AppTopbar } from './app.topbar';
import { AppSidebar } from './app.sidebar';
import { AppFooter } from './app.footer';
import { LayoutService } from '../service/layout.service';
import { OrderSseService, SseNewOrderEvent } from '@/pages/comandix/services/order-sse.service';
import { AuthService } from '@/auth/auth.service';

@Component({
    selector: 'app-layout',
    standalone: true,
    imports: [CommonModule, AppTopbar, AppSidebar, RouterModule, AppFooter, ToastModule],
    providers: [MessageService],
    template: `<div class="layout-wrapper" [ngClass]="containerClass">
        <app-topbar></app-topbar>
        <app-sidebar></app-sidebar>
        <div class="layout-main-container">
            <div class="layout-main">
                <router-outlet></router-outlet>
            </div>
            <app-footer></app-footer>
        </div>
        <div class="layout-mask animate-fadein"></div>
        <p-toast position="bottom-right"></p-toast>
    </div> `
})
export class AppLayout implements OnInit {
    overlayMenuOpenSubscription: Subscription;

    menuOutsideClickListener: any;

    private readonly NOTIFICATION_SOUND = 'assets/sounds/dragon-studio-correct-472358.mp3';
    private sseSub: Subscription | null = null;

    @ViewChild(AppSidebar) appSidebar!: AppSidebar;

    @ViewChild(AppTopbar) appTopBar!: AppTopbar;

    constructor(
        public layoutService: LayoutService,
        public renderer: Renderer2,
        public router: Router,
        private orderSseService: OrderSseService,
        private authService: AuthService,
        private messageService: MessageService
    ) {
        this.overlayMenuOpenSubscription = this.layoutService.overlayOpen$.subscribe(() => {
            if (!this.menuOutsideClickListener) {
                this.menuOutsideClickListener = this.renderer.listen('document', 'click', (event) => {
                    if (this.isOutsideClicked(event)) {
                        this.hideMenu();
                    }
                });
            }

            if (this.layoutService.layoutState().staticMenuMobileActive) {
                this.blockBodyScroll();
            }
        });

        this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
            this.hideMenu();
        });
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

        // 1) Sonido dos veces
        this.playNotificationSound(2, 500);

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

    isOutsideClicked(event: MouseEvent) {
        const sidebarEl = document.querySelector('.layout-sidebar');
        const topbarEl = document.querySelector('.layout-menu-button');
        const eventTarget = event.target as Node;

        return !(sidebarEl?.isSameNode(eventTarget) || sidebarEl?.contains(eventTarget) || topbarEl?.isSameNode(eventTarget) || topbarEl?.contains(eventTarget));
    }

    hideMenu() {
        this.layoutService.layoutState.update((prev) => ({ ...prev, overlayMenuActive: false, staticMenuMobileActive: false, menuHoverActive: false }));
        if (this.menuOutsideClickListener) {
            this.menuOutsideClickListener();
            this.menuOutsideClickListener = null;
        }
        this.unblockBodyScroll();
    }

    blockBodyScroll(): void {
        if (document.body.classList) {
            document.body.classList.add('blocked-scroll');
        } else {
            document.body.className += ' blocked-scroll';
        }
    }

    unblockBodyScroll(): void {
        if (document.body.classList) {
            document.body.classList.remove('blocked-scroll');
        } else {
            document.body.className = document.body.className.replace(new RegExp('(^|\\s)' + 'blocked-scroll'.split(' ').join('|') + '(\\s|$)', 'gi'), ' ');
        }
    }

    get containerClass() {
        return {
            'layout-overlay': this.layoutService.layoutConfig().menuMode === 'overlay',
            'layout-static': this.layoutService.layoutConfig().menuMode === 'static',
            'layout-static-inactive': this.layoutService.layoutState().staticMenuDesktopInactive && this.layoutService.layoutConfig().menuMode === 'static',
            'layout-overlay-active': this.layoutService.layoutState().overlayMenuActive,
            'layout-mobile-active': this.layoutService.layoutState().staticMenuMobileActive
        };
    }

    ngOnDestroy() {
        if (this.overlayMenuOpenSubscription) {
            this.overlayMenuOpenSubscription.unsubscribe();
        }

        if (this.sseSub) {
            this.sseSub.unsubscribe();
        }

        this.orderSseService.disconnect();

        if (this.menuOutsideClickListener) {
            this.menuOutsideClickListener();
        }
    }
}
