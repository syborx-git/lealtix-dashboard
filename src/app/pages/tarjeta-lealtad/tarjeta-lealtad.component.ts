import { Component, OnInit, inject, signal, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ProgressBarModule } from 'primeng/progressbar';
import { TooltipModule } from 'primeng/tooltip';
import { AuthService } from '@/auth/auth.service';
import { ProductService } from '@/pages/products-menu/service/product.service';
import { LoyaltyCardService, LoyaltyCardConfig, CustomerLoyaltyCard, LoyaltyStampHistory } from '@/core/services/loyalty-card.service';

interface IconOption {
  label: string;
  value: string;
  emoji: string;
}

interface PaletteOption {
  name: string;
  bg: string;
  text: string;
  accent: string;
}

interface RewardTypeOption {
  label: string;
  value: string;
  icon: string;
  desc: string;
}

@Component({
  selector: 'app-tarjeta-lealtad',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ToastModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    ToggleSwitchModule,
    TableModule,
    TagModule,
    DialogModule,
    ProgressSpinnerModule,
    ProgressBarModule,
    TooltipModule
  ],
  providers: [MessageService],
  templateUrl: './tarjeta-lealtad.component.html',
  styleUrls: ['./tarjeta-lealtad.component.scss']
})
export class TarjetaLealtadComponent implements OnInit {
  @ViewChild('swipeTrack') swipeTrack?: ElementRef<HTMLDivElement>;

  private loyaltyService = inject(LoyaltyCardService);
  private authService = inject(AuthService);
  private productService = inject(ProductService);
  private messageService = inject(MessageService);

  tenantId = signal<number>(1);
  cargando = signal<boolean>(false);
  guardando = signal<boolean>(false);
  activeTab = signal<'diseno' | 'clientes'>('diseno');

  // Config model
  config: LoyaltyCardConfig = {
    cardTitle: 'Petra Club Gourmet',
    cardSubtitle: 'Tarjeta de Sellos y Beneficios Exclusivos',
    bgColorHex: '#4338CA',
    textColorHex: '#FFFFFF',
    accentColorHex: '#F59E0B',
    stampIcon: 'HAMBURGER',
    totalStamps: 8,
    rewardMode: 'FULL_CARD',
    rewardType: 'FREE_PRODUCT',
    rewardTitle: 'Enchiladas Petra de Cortesía',
    rewardDescription: 'Acumula sellos en tus visitas y recibe una cortesía especial.',
    termsAndConditions: 'Válido en consumo en restaurante. Un sello por cuenta mínima de $150 MXN.',
    active: true
  };

  // Customers with loyalty cards
  customerCards = signal<CustomerLoyaltyCard[]>([]);
  historyList = signal<LoyaltyStampHistory[]>([]);
  menuProducts = signal<any[]>([]);

  // Dialogs
  mostrarDialogSello = false;
  mostrarDialogHistorial = false;
  selectedCard: CustomerLoyaltyCard | null = null;
  cardHistory = signal<LoyaltyStampHistory[]>([]);
  notasSello = '';

  // Slide-to-stamp state
  sliderProgress = signal<number>(0);
  isDragging = false;
  isStamped = signal<boolean>(false);
  isStampAnimating = signal<boolean>(false);
  touchStartX = 0;

  // Stamp counts
  availableStampCounts = [
    { count: 4, label: '4 Sellos', desc: 'Rápido' },
    { count: 6, label: '6 Sellos', desc: 'Casual' },
    { count: 8, label: '8 Sellos', desc: 'Recomendado' },
    { count: 10, label: '10 Sellos', desc: 'VIP' },
    { count: 12, label: '12 Sellos', desc: 'Largo plazo' }
  ];

  // Icons
  iconOptions: IconOption[] = [
    { label: 'Hamburguesa', value: 'HAMBURGER', emoji: '🍔' },
    { label: 'Café / Bebida', value: 'COFFEE', emoji: '☕' },
    { label: 'Tacos / Mexicano', value: 'TACO', emoji: '🌮' },
    { label: 'Pizza', value: 'PIZZA', emoji: '🍕' },
    { label: 'Estrella / VIP', value: 'STAR', emoji: '⭐' },
    { label: 'Cóctel / Tragos', value: 'DRINK', emoji: '🍹' },
    { label: 'Corazón / Love', value: 'HEART', emoji: '❤️' },
    { label: 'Gourmet / Cena', value: 'CUTLERY', emoji: '🍽️' }
  ];

  rewardTypeOptions: RewardTypeOption[] = [
    { label: 'Producto Gratis', value: 'FREE_PRODUCT', icon: 'pi pi-gift', desc: 'Platillo o bebida de cortesía' },
    { label: '% Descuento', value: 'PERCENT_DISCOUNT', icon: 'pi pi-percentage', desc: 'Descuento porcentual en la cuenta' },
    { label: '$ Monto Fijo', value: 'FIXED_AMOUNT', icon: 'pi pi-dollar', desc: 'Descuento en efectivo sobre el total' },
    { label: '2x1 Especial', value: 'TWO_FOR_ONE', icon: 'pi pi-tags', desc: '2x1 en platillos seleccionados' },
    { label: 'Personalizado', value: 'CUSTOM', icon: 'pi pi-sparkles', desc: 'Beneficio especial de la casa' }
  ];

  presetPalettes: PaletteOption[] = [
    { name: 'Indigo Lealtix', bg: '#4338CA', text: '#FFFFFF', accent: '#F59E0B' },
    { name: 'Verde Petra Bistro', bg: '#065F46', text: '#FFFFFF', accent: '#34D399' },
    { name: 'Ámbar Grill Fuego', bg: '#9A3412', text: '#FFFFFF', accent: '#FBBF24' },
    { name: 'Obsidiana Dark VIP', bg: '#18181B', text: '#FFFFFF', accent: '#818CF8' },
    { name: 'Borgoña Wine Bar', bg: '#831843', text: '#FFFFFF', accent: '#F472B6' }
  ];

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    const tId = user?.tenantId ? Number(user.tenantId) : 1;
    this.tenantId.set(tId);

    this.cargarDatos();
  }

  cargarDatos(): void {
    const tid = this.tenantId();
    this.cargando.set(true);

    // 1. Config
    this.loyaltyService.getConfig(tid).subscribe({
      next: (cfg) => {
        if (cfg) {
          this.config = { ...this.config, ...cfg };
        }
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error al cargar config de tarjeta de lealtad:', err);
        this.cargando.set(false);
      }
    });

    // 2. Customers
    this.loyaltyService.getCustomerCards(tid).subscribe({
      next: (cards) => {
        this.customerCards.set(cards || []);
      },
      error: (err) => {
        console.error('Error al cargar tarjetas de clientes:', err);
      }
    });

    // 3. Products
    this.productService.getProductsByTenantId(tid).subscribe({
      next: (res: any) => {
        const prods = Array.isArray(res) ? res : (res?.data || res?.object || []);
        this.menuProducts.set(prods);
      },
      error: () => {}
    });
  }

  aplicarPaleta(p: PaletteOption): void {
    this.config.bgColorHex = p.bg;
    this.config.textColorHex = p.text;
    this.config.accentColorHex = p.accent;
  }

  seleccionarSellos(cantidad: number): void {
    this.config.totalStamps = cantidad;
  }

  seleccionarIcono(icono: string): void {
    this.config.stampIcon = icono;
  }

  seleccionarTipoRecompensa(tipo: string): void {
    this.config.rewardType = tipo;
    if (tipo === 'PERCENT_DISCOUNT' && !this.config.rewardValue) {
      this.config.rewardValue = 20;
    } else if (tipo === 'FIXED_AMOUNT' && !this.config.rewardValue) {
      this.config.rewardValue = 100;
    }
  }

  onProductSelect(event: any): void {
    const prodId = this.config.rewardProductId;
    if (prodId) {
      const prod = this.menuProducts().find(p => p.id === prodId);
      if (prod && !this.config.rewardTitle) {
        this.config.rewardTitle = `${prod.nombre} de Cortesía`;
      }
    }
  }

  get currentEmoji(): string {
    const opt = this.iconOptions.find(o => o.value === this.config.stampIcon);
    return opt ? opt.emoji : '⭐';
  }

  getStampsArray(): { index: number; filled: boolean }[] {
    const total = this.config.totalStamps || 8;
    const simulatedFilled = Math.max(1, Math.min(total - 2, 6));
    const arr = [];
    for (let i = 1; i <= total; i++) {
      arr.push({ index: i, filled: i <= simulatedFilled });
    }
    return arr;
  }

  get simulatedFilledCount(): number {
    const total = this.config.totalStamps || 8;
    return Math.max(1, Math.min(total - 2, 6));
  }

  // Sellos del cliente para el modal de estampado
  getClientModalStamps(): { index: number; isFilled: boolean; isNextTarget: boolean }[] {
    const total = this.selectedCard?.totalStampsRequired || this.config.totalStamps || 8;
    const current = this.selectedCard ? this.selectedCard.currentStamps : 0;
    const isStampedNow = this.isStamped();

    const arr = [];
    for (let i = 1; i <= total; i++) {
      const isFilled = isStampedNow ? (i <= current + 1) : (i <= current);
      const isNextTarget = !isStampedNow && (i === current + 1);
      arr.push({ index: i, isFilled, isNextTarget });
    }
    return arr;
  }

  guardarConfiguracion(): void {
    const tid = this.tenantId();
    this.guardando.set(true);

    this.loyaltyService.updateConfig(tid, this.config).subscribe({
      next: (res) => {
        this.config = { ...this.config, ...res };
        this.guardando.set(false);
        this.messageService.add({
          severity: 'success',
          summary: '¡Configuración Guardada!',
          detail: 'La tarjeta de fidelización se ha actualizado con éxito.'
        });
      },
      error: (err) => {
        this.guardando.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo guardar la configuración.'
        });
      }
    });
  }

  // ==========================================================================
  // MODAL SLIDE-TO-STAMP (Estampado Interactivo)
  // ==========================================================================
  abrirModalSello(card: CustomerLoyaltyCard): void {
    this.selectedCard = card;
    this.notasSello = 'Sello administrativo en sucursal';
    this.sliderProgress.set(0);
    this.isStamped.set(false);
    this.isStampAnimating.set(false);
    this.isDragging = false;
    this.mostrarDialogSello = true;
  }

  startDragMouse(event: MouseEvent): void {
    if (this.isStamped()) return;
    event.preventDefault();
    this.isDragging = true;
    this.updateDragProgress(event.clientX);
  }

  startTouch(event: TouchEvent): void {
    if (this.isStamped() || event.touches.length === 0) return;
    this.isDragging = true;
    this.touchStartX = event.touches[0].clientX;
    this.updateDragProgress(this.touchStartX);
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.isDragging || this.isStamped()) return;
    this.updateDragProgress(event.clientX);
  }

  @HostListener('window:touchmove', ['$event'])
  onTouchMove(event: TouchEvent): void {
    if (!this.isDragging || this.isStamped() || event.touches.length === 0) return;
    this.updateDragProgress(event.touches[0].clientX);
  }

  @HostListener('window:mouseup')
  @HostListener('window:touchend')
  onReleaseDrag(): void {
    if (!this.isDragging) return;
    this.isDragging = false;

    if (this.sliderProgress() >= 85 && !this.isStamped()) {
      this.confirmarSelloSlide();
    } else if (!this.isStamped()) {
      // Regresa suavemente a 0
      this.sliderProgress.set(0);
    }
  }

  private updateDragProgress(clientX: number): void {
    if (!this.swipeTrack) return;
    const rect = this.swipeTrack.nativeElement.getBoundingClientRect();
    const handleWidth = 52;
    const maxDistance = rect.width - handleWidth;
    if (maxDistance <= 0) return;

    const offset = clientX - rect.left - (handleWidth / 2);
    const progress = Math.max(0, Math.min(100, (offset / maxDistance) * 100));
    this.sliderProgress.set(progress);

    if (progress >= 85 && !this.isStamped()) {
      this.isDragging = false;
      this.confirmarSelloSlide();
    }
  }

  private confirmarSelloSlide(): void {
    if (!this.selectedCard || this.isStamped()) return;

    this.sliderProgress.set(100);
    this.isStamped.set(true);
    this.isStampAnimating.set(true);

    const clientName = this.selectedCard.customerName;
    const customerId = this.selectedCard.customerId;

    // Disparar la petición al backend
    this.loyaltyService.addStamps({
      tenantId: this.tenantId(),
      customerId: customerId,
      stampsToAdd: 1,
      notes: this.notasSello
    }).subscribe({
      next: (updatedCard) => {
        // Breve pausa para admirar el sello estampado
        setTimeout(() => {
          this.messageService.add({
            severity: 'success',
            summary: '¡Sello Estampado con Éxito! 🎉',
            detail: `${clientName} ahora tiene ${updatedCard.currentStamps} de ${updatedCard.totalStampsRequired} sellos.`
          });
          this.mostrarDialogSello = false;
          this.cargarDatos();
        }, 850);
      },
      error: () => {
        this.sliderProgress.set(0);
        this.isStamped.set(false);
        this.isStampAnimating.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo aplicar el sello.'
        });
      }
    });
  }

  canjearRecompensa(card: CustomerLoyaltyCard): void {
    if (!confirm(`¿Confirmas el canje de la recompensa para ${card.customerName}? Se reiniciará el ciclo de sellos y se sumará 1 canje a su historial.`)) {
      return;
    }

    this.cargando.set(true);
    this.loyaltyService.redeemReward({
      tenantId: this.tenantId(),
      customerId: card.customerId,
      notes: 'Canje manual administrativo'
    }).subscribe({
      next: (updatedCard) => {
        this.messageService.add({
          severity: 'success',
          summary: '¡Recompensa Canjeada!',
          detail: `Se registró el canje. Total tarjetas completadas: ${updatedCard.completedCardsCount}.`
        });
        this.cargarDatos();
      },
      error: (err) => {
        this.cargando.set(false);
        this.messageService.add({
          severity: 'warn',
          summary: 'No se pudo canjear',
          detail: err?.error?.message || 'El cliente aún no cumple los requisitos.'
        });
      }
    });
  }

  verHistorial(card: CustomerLoyaltyCard): void {
    this.selectedCard = card;
    this.mostrarDialogHistorial = true;
    this.loyaltyService.getHistoryByCard(card.id).subscribe({
      next: (h) => this.cardHistory.set(h || []),
      error: () => this.cardHistory.set([])
    });
  }

  abrirGoogleWallet(card: CustomerLoyaltyCard): void {
    if (card.googleWalletSaveUrl) {
      window.open(card.googleWalletSaveUrl, '_blank');
      return;
    }

    this.loyaltyService.getGoogleWalletPassUrl(this.tenantId(), card.customerId).subscribe({
      next: (res) => {
        if (res?.saveUrl) {
          card.googleWalletSaveUrl = res.saveUrl;
          window.open(res.saveUrl, '_blank');
        } else {
          this.messageService.add({
            severity: 'warn',
            summary: 'Google Wallet',
            detail: 'No se pudo generar el enlace del pase para este cliente.'
          });
        }
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo conectar con el servicio de Google Wallet.'
        });
      }
    });
  }
}
