import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '@/auth/auth.service';
import { ProductService } from '@/pages/products-menu/service/product.service';
import { OrderService } from '@/pages/comandix/services/order.service';
import { TenantClientOrderCreateRequest } from '@/pages/comandix/models/order.model';
import { MpPointTestService } from '@/pages/mp-test/mp-point-test.service';
import { environment } from '@/pages/commons/environment';

interface KioskProduct {
  id: number;
  name: string;
  price: number;
  imageUrl: string | null;
  description: string;
  category: string;
}

interface CartLine {
  product: KioskProduct;
  qty: number;
}

type KioskStage = 'browse' | 'waiting' | 'success' | 'error';

/**
 * Kiosco de autoservicio (modo cliente).
 *
 * Reutiliza al 100% la integración ya existente con Mercado Pago Point
 * (MpPointTestService -> POST /v1/test/mp-point/charge + polling del intent),
 * pero en lugar de pedir un monto manual, cobra el total del carrito.
 *
 * La orden interna se genera en Lealtix al confirmarse el pago.
 */
@Component({
  selector: 'app-kiosk',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './kiosk.component.html',
  styleUrls: ['./kiosk.component.scss'],
})
export class KioskComponent implements OnDestroy {
  private readonly productService = inject(ProductService);
  private readonly orderService = inject(OrderService);
  private readonly mpSvc = inject(MpPointTestService);
  private readonly authService = inject(AuthService);

  // -------------------- Catálogo --------------------
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly products = signal<KioskProduct[]>([]);
  readonly activeCategory = signal<string>('__all__');

  readonly categories = computed(() => {
    const names: string[] = [];
    for (const p of this.products()) {
      if (!names.includes(p.category)) names.push(p.category);
    }
    return names;
  });

  readonly visibleProducts = computed(() => {
    const cat = this.activeCategory();
    const all = this.products();
    return cat === '__all__' ? all : all.filter((p) => p.category === cat);
  });

  // -------------------- Carrito --------------------
  readonly cart = signal<CartLine[]>([]);
  readonly cartCount = computed(() => this.cart().reduce((n, l) => n + l.qty, 0));
  readonly subtotal = computed(() =>
    Math.round(this.cart().reduce((n, l) => n + l.product.price * l.qty, 0) * 100) / 100,
  );
  readonly canPay = computed(() => this.cartCount() > 0);

  // -------------------- Pago --------------------
  readonly stage = signal<KioskStage>('browse');
  readonly intent = signal<any>(null);
  readonly intentId = signal<string | null>(null);
  readonly errorMsg = signal<string | null>(null);
  readonly paidTotal = signal(0);
  readonly paidOrderId = signal<string | null>(null);
  readonly orderError = signal<string | null>(null);
  readonly countdown = signal(0);

  private tenantId = 0;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private attempts = 0;
  private orderCreating = false;

  private readonly onWindowFocus = () => this.refreshIfIdle();
  private readonly onVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      this.refreshIfIdle();
    }
  };

  constructor() {
    this.tenantId = this.resolveTenantId();
    this.loadCatalog();
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', this.onWindowFocus);
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  /** Reintenta recargar el catálogo sin salir del kiosco. */
  refreshCatalog(): void {
    if (this.stage() !== 'browse') return;
    this.loadCatalog();
  }

  private refreshIfIdle(): void {
    if (this.stage() !== 'browse' || this.loading()) return;
    this.loadCatalog();
  }

  /**
   * El tenant se resuelve de forma robusta: usuario en storage, localStorage,
   * claim del JWT y, por último, AuthService. Así evitamos consultar tenant 0/1
   * por una sesión vieja sin tenantId.
   */
  private resolveTenantId(): number {
    const user = this.authService.getCurrentUser();
    const candidates = [
      Number(user?.tenantId),
      Number(typeof localStorage !== 'undefined' ? localStorage.getItem('tenantId') : 0),
      this.tenantFromJwt(),
      Number(this.authService.getTenantId?.()),
    ];
    for (const value of candidates) {
      if (Number.isFinite(value) && value > 0) return value;
    }
    return 0;
  }

  private tenantFromJwt(): number {
    try {
      const token = this.authService.getToken?.();
      const parts = typeof token === 'string' ? token.split('.') : [];
      if (parts.length < 2) return 0;
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(b64));
      return Number(payload?.tenantId ?? payload?.tenant_id ?? 0) || 0;
    } catch {
      return 0;
    }
  }

  // -------------------- Carga de catálogo --------------------
  loadCatalog(): void {
    if (!this.tenantId || this.tenantId <= 0) {
      this.loading.set(false);
      this.loadError.set('No se pudo identificar el negocio de la sesión. Cierra sesión y vuelve a entrar.');
      return;
    }

    this.loading.set(true);
    this.loadError.set(null);

    this.productService.getProductsByTenantId(this.tenantId, true).subscribe({
      next: (resp: any) => {
        const obj = resp?.object;
        const paged = obj?.content ?? resp?.content;
        const list: any[] = Array.isArray(obj) ? obj : Array.isArray(paged) ? paged : [];
        const mapped = list
          .filter((p) => p?.isActive !== false && p?.esVariable !== true)
          .map((p) => this.mapProduct(p))
          .filter((p) => p.price > 0);
        console.log('[Kiosk] tenant', this.tenantId, 'productos crudos', list.length, 'visibles', mapped.length);
        this.products.set(mapped);
        this.loading.set(false);
      },
      error: (err: any) => {
        this.loading.set(false);
        this.loadError.set(err?.error?.message || 'No se pudo cargar el menú. Intenta de nuevo.');
      },
    });
  }

  private mapProduct(p: any): KioskProduct {
    const category = (p?.categoryName ||
      (Array.isArray(p?.categories) && p.categories[0]?.name) ||
      p?.category?.name ||
      (typeof p?.category === 'string' ? p.category : '') ||
      'Menú') as string;

    const rawImage = p?.imageUrl || p?.img_url || p?.image || null;
    const description =
      (typeof p?.description === 'string' && p.description.trim()) ||
      (typeof p?.descripcion === 'string' && p.descripcion.trim()) ||
      '';

    return {
      id: Number(p?.id ?? 0),
      name: p?.name || p?.productName || 'Producto',
      price: Number(p?.price ?? 0),
      imageUrl: this.resolveImageUrl(rawImage),
      description: String(description || ''),
      category: category || 'Menú',
    };
  }

  private resolveImageUrl(url: string | null | undefined): string | null {
    if (!url || typeof url !== 'string' || !url.trim()) return null;
    const value = url.trim();
    if (value.startsWith('data:') || value.startsWith('blob:')) return value;
    if (value.startsWith('http://') || value.startsWith('https://')) {
      try {
        const parsed = new URL(value);
        const host = parsed.hostname.toLowerCase();
        const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost');
        if (isLocalHost) {
          const apiOrigin = new URL(environment.apiUrl).origin;
          return `${apiOrigin}${parsed.pathname}${parsed.search}`;
        }
      } catch {
        return value;
      }
      return value;
    }
    if (value.startsWith('/')) {
      try {
        return `${new URL(environment.apiUrl).origin}${value}`;
      } catch {
        return value;
      }
    }
    return value;
  }

  // -------------------- Carrito --------------------
  selectCategory(category: string): void {
    this.activeCategory.set(category);
  }

  addToCart(product: KioskProduct): void {
    if (this.stage() !== 'browse') return;
    const current = this.cart();
    const idx = current.findIndex((l) => l.product.id === product.id);
    if (idx >= 0) {
      const next = [...current];
      next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
      this.cart.set(next);
    } else {
      this.cart.set([...current, { product, qty: 1 }]);
    }
  }

  incLine(line: CartLine): void {
    if (this.stage() !== 'browse') return;
    this.cart.update((lines) =>
      lines.map((l) => (l.product.id === line.product.id ? { ...l, qty: l.qty + 1 } : l)),
    );
  }

  decLine(line: CartLine): void {
    if (this.stage() !== 'browse') return;
    this.cart.update((lines) =>
      lines
        .map((l) => (l.product.id === line.product.id ? { ...l, qty: l.qty - 1 } : l))
        .filter((l) => l.qty > 0),
    );
  }

  removeLine(line: CartLine): void {
    if (this.stage() !== 'browse') return;
    this.cart.update((lines) => lines.filter((l) => l.product.id !== line.product.id));
  }

  clearCart(): void {
    this.cart.set([]);
  }

  qtyOf(product: KioskProduct): number {
    return this.cart().find((l) => l.product.id === product.id)?.qty ?? 0;
  }

  // -------------------- Pago en terminal --------------------
  payWithTerminal(): void {
    if (!this.canPay() || this.stage() !== 'browse') return;

    const amount = Math.round(this.subtotal() * 100) / 100;
    if (amount < 5) {
      this.errorMsg.set('El total mínimo para pagar con la terminal es $5.00 MXN.');
      this.stage.set('error');
      return;
    }

    this.errorMsg.set(null);
    this.orderError.set(null);
    this.paidOrderId.set(null);
    this.paidTotal.set(amount);
    this.intent.set(null);
    this.intentId.set(null);
    this.stopPoll();
    this.stage.set('waiting');

    this.mpSvc.charge(amount).subscribe({
      next: (res: any) => {
        const id = res?.id || res?.paymentIntentId;
        if (!id) {
          this.fail('No se recibió un identificador de cobro de la terminal.');
          return;
        }
        this.intent.set(res);
        this.intentId.set(id);
        this.startPoll();
      },
      error: (err: any) => {
        this.fail(
          err?.status === 409
            ? 'Ya hay un cobro pendiente en la terminal. Espera unos segundos o cancélalo.'
            : err?.error?.message || err?.message || 'No se pudo iniciar el cobro en la terminal.',
        );
      },
    });
  }

  cancelPayment(): void {
    const id = this.intentId();
    this.stopPoll();
    if (id) {
      this.mpSvc.cancelIntent(id).subscribe({ next: () => {}, error: () => {} });
    }
    this.intent.set(null);
    this.intentId.set(null);
    this.stage.set('browse');
  }

  retryPayment(): void {
    if (!this.canPay()) {
      this.backToCart();
      return;
    }
    this.stage.set('browse');
    this.errorMsg.set(null);
    this.payWithTerminal();
  }

  backToCart(): void {
    this.stage.set('browse');
    this.errorMsg.set(null);
  }

  newOrder(): void {
    this.clearCountdown();
    this.stopPoll();
    this.cart.set([]);
    this.intent.set(null);
    this.intentId.set(null);
    this.errorMsg.set(null);
    this.orderError.set(null);
    this.paidOrderId.set(null);
    this.paidTotal.set(0);
    this.countdown.set(0);
    this.stage.set('browse');
  }

  private fail(message: string): void {
    this.stopPoll();
    this.errorMsg.set(message);
    this.stage.set('error');
  }

  private startPoll(): void {
    this.stopPoll();
    this.attempts = 0;
    this.pollTimer = setInterval(() => {
      this.attempts++;
      const id = this.intentId();
      if (!id || this.attempts > 40) {
        this.stopPoll();
        if (this.stage() === 'waiting') {
          this.fail('La terminal no respondió a tiempo. Intenta de nuevo.');
        }
        return;
      }
      this.mpSvc.getIntent(id).subscribe({
        next: (res: any) => {
          this.intent.set(res);
          const state = (res?.state || '').toUpperCase();
          if (['FINISHED', 'APPROVED', 'PROCESSED', 'PAID'].includes(state)) {
            this.stopPoll();
            this.onApproved(res);
          } else if (['CANCELED', 'CANCELLED', 'REJECTED', 'ERROR', 'FAILED'].includes(state)) {
            this.stopPoll();
            this.fail(this.paymentErrorText(res));
          }
        },
        error: () => {
          /* silencioso durante el polling */
        },
      });
    }, 3000);
  }

  private stopPoll(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private onApproved(intent: any): void {
    if (this.stage() !== 'waiting') return;
    this.stage.set('success');
    this.paidOrderId.set(null);
    this.orderError.set(null);
    const paymentId =
      intent?.payment?.id || intent?.payment_id || intent?.paymentId || intent?.id || null;
    void this.registerOrder(paymentId);
    this.startCountdown(7);
  }

  private async registerOrder(paymentId: string | number | null): Promise<void> {
    if (this.orderCreating) return;
    this.orderCreating = true;

    const snapshot = this.cart();
    const total = this.paidTotal();
    const user = this.authService.getCurrentUser();

    try {
      const orderRequest: TenantClientOrderCreateRequest = {
        customerId: null,
        tenantId: this.tenantId,
        items: snapshot.map((line) => ({
          productId: line.product.id,
          cantidad: line.qty,
          precioUnitario: line.product.price,
        })),
        subtotal: total,
        descuento: 0,
        totalFinal: total,
        source: 'KIOSK',
        meseroId: user?.id,
        meseroEmail: user?.email,
      };

      const order = await firstValueFrom(this.orderService.createOrder(orderRequest));
      const orderId = order?.id != null ? String(order.id) : null;
      this.paidOrderId.set(orderId);

      if (orderId) {
        try {
          await firstValueFrom(
            this.orderService.recordPayment(orderId, {
              method: 'CARD',
              reference: paymentId != null ? String(paymentId) : null,
              userEmail: user?.email,
              monto: total,
            }),
          );
        } catch {
          /* El pedido ya quedó registrado; el cobro puede conciliarse en caja. */
        }
      }
    } catch (err: any) {
      this.orderError.set(
        err?.error?.message ||
          'El pago se aprobó, pero el pedido no se pudo registrar automáticamente. Avisa al personal.',
      );
    } finally {
      this.orderCreating = false;
      this.cart.set([]);
    }
  }

  private startCountdown(seconds: number): void {
    this.clearCountdown();
    this.countdown.set(seconds);
    this.countdownTimer = setInterval(() => {
      const next = this.countdown() - 1;
      this.countdown.set(next);
      if (next <= 0) {
        this.clearCountdown();
        this.newOrder();
      }
    }, 1000);
  }

  private clearCountdown(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  private paymentErrorText(res: any): string {
    const state = (res?.state || '').toUpperCase();
    const detail = res?.payment?.status_detail;
    if (state === 'CANCELED' || state === 'CANCELLED') {
      return 'El cobro fue cancelado en la terminal.';
    }
    return detail
      ? `El pago no se completó (${detail}). Intenta de nuevo.`
      : 'El pago no se completó. Intenta de nuevo.';
  }

  // -------------------- Helpers de plantilla --------------------
  mxn(value: number | null | undefined): string {
    const n = Number(value) || 0;
    return (
      '$' +
      n.toLocaleString('es-MX', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }

  trackById(_: number, item: KioskProduct): number {
    return item.id;
  }

  trackByCategory(_: number, category: string): string {
    return category;
  }

  trackByLine(_: number, line: CartLine): number {
    return line.product.id;
  }

  ngOnDestroy(): void {
    this.stopPoll();
    this.clearCountdown();
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', this.onWindowFocus);
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
  }
}
