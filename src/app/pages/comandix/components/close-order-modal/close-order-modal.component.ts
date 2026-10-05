import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DividerModule } from 'primeng/divider';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';

import {
  PaymentMethod,
  PendingOrder,
  RecordPaymentRequest,
  TipInfo
} from '../../models/order.model';
import { OrderService } from '../../services/order.service';
import { AuthService } from '@/auth/auth.service';

import { HttpClient } from '@angular/common/http';
import { RedemptionService } from '@/pages/redeem/services/redemption.service';
import { environment } from '@/pages/commons/environment';

export interface CustomerCoupon {
  id: number;
  code: string;
  status: string;
  rewardDescription?: string | null;
  rewardType?: string | null;
  numericValue?: number | null;
  minPurchaseAmount?: number | null;
  expired?: boolean;
  expiresAt?: string | null;
  campaignTitle?: string | null;
}

interface PaymentMethodOption {
  value: PaymentMethod;
  label: string;
  icon: string;
  hint: string;
}

@Component({
  selector: 'app-close-order-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    DividerModule,
    MessageModule,
    ProgressSpinnerModule,
    TagModule
  ],
  templateUrl: './close-order-modal.component.html',
  styleUrls: ['./close-order-modal.component.scss']
})
export class CloseOrderModalComponent implements OnChanges, OnDestroy {
  @Input() visible = false;
  @Input() order: PendingOrder | null = null;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() paymentRecorded = new EventEmitter<{
    orderId: string;
    method: PaymentMethod;
    reference?: string | null;
    paidAt: string;
  }>();

  @Output() facturaGenerated = new EventEmitter<{ uuid: string; invoiceId: string } | null>();
  @Output() cobroSeparado = new EventEmitter<{ order: PendingOrder; tip?: TipInfo | null }>();

  readonly paymentMethods: PaymentMethodOption[] = [
    { value: 'CASH', label: 'CASH', icon: 'pi pi-wallet', hint: 'Sin referencia' },
    { value: 'CARD', label: 'CARD', icon: 'pi pi-credit-card', hint: 'Requiere AUTH-xxxxx' },
    { value: 'TRANSFER', label: 'TRANSFER', icon: 'pi pi-building-columns', hint: 'Requiere UUID/referencia bancaria' },
    { value: 'MIXED', label: 'MIXED', icon: 'pi pi-sync', hint: 'Describe el mix, ej. 50 CASH + 50 CARD' }
  ];

  form: FormGroup;
  loading = false;
  errorMessage = '';
  successMessage = '';

  // ==================== CUPONES Y DESCUENTOS ====================
  customerCoupons: CustomerCoupon[] = [];
  loadingCoupons = false;
  appliedCoupon: CustomerCoupon | null = null;
  manualCouponCode = '';
  validatingCoupon = false;
  couponMessage = '';
  couponError = '';

  // ==================== PROPINA (capa visual) ====================
  readonly tipOptions = [10, 15, 20];
  selectedTipPercent = 0;
  customTipMode: 'percent' | 'amount' = 'percent';
  customTipValue: number | null = null;

  readonly regimenOptions = [
    { label: '601 - General de Ley Personas Morales', value: '601' },
    { label: '612 - Personas Físicas con Actividades Empresariales', value: '612' },
    { label: '626 - Régimen Simplificado de Confianza', value: '626' },
    { label: '616 - Sin obligaciones fiscales', value: '616' }
  ];

  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private fb: FormBuilder,
    private orderService: OrderService,
    private authService: AuthService,
    private http: HttpClient,
    private redemptionService: RedemptionService
  ) {
    this.form = this.fb.group({
      method: ['CASH', Validators.required],
      reference: [''],
      facturaRequired: [false],
      facturaRfc: [''],
      facturaRazonSocial: [''],
      facturaRegimen: ['616'],
      facturaEmail: ['']
    });

    this.form.get('method')?.valueChanges.subscribe((method: PaymentMethod) => {
      this.applyReferenceValidators(method);
      this.errorMessage = '';
      this.successMessage = '';
    });

    this.applyReferenceValidators('CASH');
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
      this.resetState();
      if (this.order?.customerId) {
        this.loadCustomerCoupons(this.order.customerId);
      }
      if (this.order?.couponCode) {
        this.appliedCoupon = {
          id: 0,
          code: this.order.couponCode,
          status: 'ACTIVE',
          rewardDescription: 'Cupón precargado en comanda',
          numericValue: this.order.descuento || 0
        };
      }
    }
  }

  ngOnDestroy(): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  loadCustomerCoupons(customerId: number): void {
    this.loadingCoupons = true;
    this.customerCoupons = [];
    this.http.get<any>(`${environment.apiUrl}/coupons/customer/${customerId}`).subscribe({
      next: (res) => {
        const list = Array.isArray(res?.object) ? res.object : (Array.isArray(res) ? res : []);
        this.customerCoupons = list.filter((c: any) => c.status === 'ACTIVE' && !c.expired);
        this.loadingCoupons = false;
      },
      error: (err) => {
        console.warn('[CloseOrderModal] Error al cargar cupones del cliente:', err);
        this.loadingCoupons = false;
      }
    });
  }

  applyCoupon(coupon: CustomerCoupon): void {
    this.appliedCoupon = coupon;
    this.couponError = '';
    this.couponMessage = `Cupón "${coupon.code}" aplicado`;
  }

  removeAppliedCoupon(): void {
    this.appliedCoupon = null;
    this.couponMessage = '';
    this.couponError = '';
  }

  async validateAndApplyManualCode(): Promise<void> {
    const code = this.manualCouponCode.trim();
    if (!code) {
      this.couponError = 'Por favor ingresa un código de cupón';
      return;
    }

    this.validatingCoupon = true;
    this.couponError = '';
    this.couponMessage = '';

    const tenantId = this.authService.getCurrentUser()?.tenantId || this.order?.tenantId || 0;

    try {
      const res = await firstValueFrom(this.redemptionService.validateCouponByCode(code, tenantId));
      if (res && res.valid) {
        const newCoupon: CustomerCoupon = {
          id: 0,
          code,
          status: 'ACTIVE',
          rewardDescription: res.rewardDescription || 'Descuento aplicado',
          rewardType: res.rewardType,
          numericValue: res.numericValue
        };
        this.applyCoupon(newCoupon);
        this.manualCouponCode = '';
      } else {
        this.couponError = res?.message || 'El cupón ingresado no es válido o ya fue utilizado';
      }
    } catch (e: any) {
      this.couponError = e?.error?.message || e?.message || 'Error al validar el cupón';
    } finally {
      this.validatingCoupon = false;
    }
  }

  get selectedMethod(): PaymentMethod {
    return this.form.get('method')?.value as PaymentMethod;
  }

  get isReferenceRequired(): boolean {
    return this.selectedMethod !== 'CASH';
  }

  get facturaRequired(): boolean {
    return !!this.form.get('facturaRequired')?.value;
  }

  get subtotal(): number {
    if (!this.order) {
      return 0;
    }
    return Number(this.order.subtotal ?? this.order.totalFinal ?? 0);
  }

  get calculatedDiscount(): number {
    if (this.appliedCoupon) {
      if (this.appliedCoupon.rewardType === 'PERCENT_DISCOUNT') {
        return (this.subtotal * (this.appliedCoupon.numericValue || 0)) / 100;
      }
      if (this.appliedCoupon.rewardType === 'FIXED_AMOUNT') {
        return Math.min(this.appliedCoupon.numericValue || 0, this.subtotal);
      }
      return Number(this.appliedCoupon.numericValue || this.order?.descuento || 0);
    }
    return Number(this.order?.descuento ?? 0);
  }

  get totalToPay(): number {
    return Math.max(0, this.subtotal - this.calculatedDiscount);
  }

  get tipAmount(): number {
    if (this.selectedTipPercent > 0) {
      return (this.totalToPay * this.selectedTipPercent) / 100;
    }
    if (this.customTipMode === 'percent' && this.customTipValue != null) {
      return (this.totalToPay * (this.customTipValue || 0)) / 100;
    }
    return Number(this.customTipValue ?? 0);
  }

  get totalWithTip(): number {
    return this.totalToPay + this.tipAmount;
  }

  get selectedTip(): TipInfo {
    if (this.customTipMode === 'amount' && this.customTipValue != null && this.customTipValue > 0) {
      return { amount: this.customTipValue };
    }
    const percent =
      this.selectedTipPercent > 0
        ? this.selectedTipPercent
        : this.customTipMode === 'percent' && this.customTipValue != null
          ? this.customTipValue
          : null;
    return percent ? { percent } : {};
  }

  onCobroSeparado(): void {
    if (!this.order || this.loading) {
      return;
    }
    this.cobroSeparado.emit({ order: this.order, tip: this.selectedTip });
  }

  onClose(): void {
    if (this.loading) {
      return;
    }
    this.visible = false;
    this.visibleChange.emit(false);
  }

  async onConfirmPayment(): Promise<void> {
    if (!this.order || this.loading) {
      return;
    }

    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.errorMessage = 'Completa los campos requeridos para registrar el pago.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const method = this.selectedMethod;
    const referenceControlValue = (this.form.get('reference')?.value ?? '').toString().trim();

    if (this.facturaRequired) {
      const rfc = (this.form.get('facturaRfc')?.value ?? '').toString().trim();
      const razon = (this.form.get('facturaRazonSocial')?.value ?? '').toString().trim();
      const email = (this.form.get('facturaEmail')?.value ?? '').toString().trim();
      if (!rfc || !razon || !email) {
        this.loading = false;
        this.errorMessage = 'Para generar factura ingresa RFC, Razón social y Correo.';
        return;
      }
    }

    // Obtener email del usuario logeado desde localStorage
    const currentUserJson = localStorage.getItem('currentUser');
    const currentUser = currentUserJson ? JSON.parse(currentUserJson) : null;
    const userEmail = currentUser?.email ?? 'usuario-desconocido';

    const couponCode = this.appliedCoupon?.code ?? (this.order?.couponCode || null);
    const payload: RecordPaymentRequest = {
      method,
      reference: method === 'CASH' ? null : referenceControlValue,
      userEmail,
      propina: this.tipAmount > 0 ? this.tipAmount : undefined,
      monto: this.totalToPay > 0 ? this.totalToPay : undefined,
      couponCode: couponCode || undefined
    };

    try {
      const response = await firstValueFrom(this.orderService.recordPayment(this.order.id, payload));

      // Validar que el backend confirmó el cambio de estado a PAGADA
      const estadoActual = response?.object?.estado ?? '';
      const isPaid = estadoActual.toUpperCase() === 'PAGADA' || estadoActual.toUpperCase() === 'PAID';

      if (!isPaid) {
        throw new Error(
          `Estado no cambió a PAGADA. Estado actual del servidor: ${estadoActual}`
        );
      }

      const paidAt = response?.object?.paidAt ?? new Date().toISOString();
      const factura = this.facturaRequired;

      this.successMessage = 'Pago registrado exitosamente.';

      // Generar la factura ANTES de emitir (el padre resetea el modal/form al recibir paymentRecorded)
      if (factura) {
        await this.generateFactura(this.order, method);
      }

      this.paymentRecorded.emit({
        orderId: this.order.id,
        method,
        reference: payload.reference,
        paidAt
      });

      this.closeTimer = setTimeout(() => {
        this.onClose();
      }, factura ? 10000 : 1200);
    } catch (error: any) {
      this.errorMessage =
        error?.error?.message ||
        error?.message ||
        'No se pudo registrar el pago. Intenta nuevamente.';
    } finally {
      this.loading = false;
    }
  }

  private async generateFactura(order: PendingOrder, method: PaymentMethod): Promise<void> {
    const items = (order.items ?? []).map(item => ({
      quantity: item.cantidad ?? 1,
      description: item.productName ?? item.prod ?? ('Producto ' + item.productId),
      price: item.precioUnitario ?? item.precio ?? 0
    }));

    const paymentFormMap: Record<PaymentMethod, string> = {
      CASH: '01',
      CARD: '04',
      TRANSFER: '03',
      MIXED: '99'
    };

    const payload = {
      customer: {
        legalName: (this.form.get('facturaRazonSocial')?.value ?? '').toString().trim(),
        taxId: (this.form.get('facturaRfc')?.value ?? '').toString().trim(),
        taxSystem: (this.form.get('facturaRegimen')?.value ?? '616').toString().trim(),
        email: (this.form.get('facturaEmail')?.value ?? '').toString().trim()
      },
      items,
      paymentForm: paymentFormMap[method] ?? '04',
      use: 'G03',
      currency: 'MXN',
      externalId: order.id
    };

    try {
      const resp = await firstValueFrom(this.orderService.createFacturapiInvoice(payload));
      const uuid = resp?.uuid ?? resp?.object?.uuid ?? '';
      const invoiceId = resp?.id ?? resp?.object?.id ?? '';
      console.log('[Factura] Respuesta Facturapi:', { uuid, invoiceId, resp });

      if (!uuid && !invoiceId) {
        throw new Error('Facturapi no devolvió folio de la factura');
      }

      this.successMessage = 'Pago registrado y factura generada'
        + (uuid ? ` (UUID: ${uuid})` : '')
        + (invoiceId ? ` - Factura ${invoiceId}` : '')
        + '.';
      this.facturaGenerated.emit({ uuid, invoiceId });
    } catch (e: any) {
      console.error('[Factura] Error al generar factura:', e);
      this.successMessage = 'Pago registrado, pero no se pudo generar la factura: ' + (e?.error?.message || e?.message || 'error');
      this.facturaGenerated.emit(null);
    }
  }

  getStatusClass(status: string | undefined): string {    const normalized = (status ?? '').toUpperCase();
    if (normalized === 'PENDIENTE') return 'status-comanda';
    if (normalized === 'CONFIRMADA') return 'status-confirmada';
    if (normalized === 'EN_PREPARACION') return 'status-en_preparacion';
    if (normalized === 'LISTO') return 'status-listo';
    if (normalized === 'PAGADA') return 'status-pagada';
    if (normalized === 'CANCELADA') return 'status-cancelada';
    return 'status-comanda';
  }

  getStatusLabel(status: string | undefined): string {
    return status ?? 'PENDIENTE';
  }

  trackByOrderItem(index: number): number {
    return index;
  }

  private resetState(): void {
    this.form.reset({ method: 'CASH', reference: '' });
    this.applyReferenceValidators('CASH');
    this.errorMessage = '';
    this.successMessage = '';
    this.loading = false;
    this.selectedTipPercent = 0;
    this.customTipMode = 'percent';
    this.customTipValue = null;
    this.appliedCoupon = null;
    this.customerCoupons = [];
    this.manualCouponCode = '';
    this.couponMessage = '';
    this.couponError = '';
  }

  private applyReferenceValidators(method: PaymentMethod): void {
    const referenceControl = this.form.get('reference');
    if (!referenceControl) {
      return;
    }

    if (method === 'CASH') {
      referenceControl.clearValidators();
      referenceControl.setValue('');
      referenceControl.updateValueAndValidity();
      return;
    }

    if (method === 'CARD') {
      referenceControl.setValidators([
        Validators.required,
        Validators.pattern(/^AUTH-[A-Za-z0-9]{3,}$/)
      ]);
    } else {
      referenceControl.setValidators([
        Validators.required,
        Validators.minLength(6)
      ]);
    }

    referenceControl.updateValueAndValidity();
  }
}
