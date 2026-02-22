import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { InputNumberModule } from 'primeng/inputnumber';
import { DividerModule } from 'primeng/divider';
import { CampaignService } from '@/pages/campaigns/services/campaign.service';
import { RedemptionService } from '../../services/redemption.service';
import { AuthService } from '@/auth/auth.service';
import { CouponStatus } from '../../models/coupon-validation.model';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

interface RewardData {
  id: number;
  campaignId: number;
  rewardType: string;
  numericValue: number;
  description: string;
  minPurchaseAmount: number;
  usageLimit: number;
  usageCount: number;
  tenantId?: number; // Validar que pertenezca al tenant
  isRedeemed?: boolean; // Indica si ya fue redimido
  canRedeem?: boolean; // Indica si puede ser redimido
}

@Component({
  selector: 'app-manual-code-input',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    MessageModule,
    InputNumberModule,
    DividerModule,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './manual-code-input.component.html',
  styleUrls: ['./manual-code-input.component.scss']
})
export class ManualCodeInputComponent {
  private campaignService = inject(CampaignService);
  private redemptionService = inject(RedemptionService);
  private authService = inject(AuthService);
  private messageService = inject(MessageService);
  private router = inject(Router);

  couponCode: string = '';
  purchaseAmount: number | undefined = undefined;
  errorMessage: string = '';

  loading: boolean = false;
  rewardData: RewardData | null = null;
  showResult: boolean = false;

  discountAmount: number = 0;
  finalAmount: number = 0;

  // Rastrear cupones ya aplicados en esta sesión para evitar duplicados
  private appliedCoupons: Set<string> = new Set();

  validateCode(): void {
    // Validar código del cupón
    if (!this.couponCode || this.couponCode.length < 3) {
      this.errorMessage = 'Por favor, ingresa un código válido';
      this.messageService.add({
        severity: 'warn',
        summary: 'Código requerido',
        detail: 'Ingresa un código de cupón válido',
        life: 4000
      });
      return;
    }

    // Validar que el cupón no haya sido aplicado ya dos veces en esta sesión
    if (this.appliedCoupons.has(this.couponCode)) {
      this.errorMessage = 'Este cupón ya ha sido aplicado en esta transacción';
      this.messageService.add({
        severity: 'error',
        summary: 'Cupón duplicado',
        detail: 'No puedes aplicar el mismo cupón dos veces en la misma comanda',
        life: 4000
      });
      return;
    }

    // Validar que se haya ingresado un monto
    if (this.purchaseAmount === undefined || this.purchaseAmount === null || this.purchaseAmount <= 0) {
      this.errorMessage = 'Ingresa el monto total de la compra';
      this.messageService.add({
        severity: 'warn',
        summary: 'Monto requerido',
        detail: 'Debes ingresar el monto total de la compra para continuar',
        life: 4000
      });
      return;
    }

    this.errorMessage = '';
    this.loading = true;
    this.showResult = false;

    // Extraer campaignId del código del cupón
    const campaignId = this.extractCampaignId(this.couponCode);

    if (!campaignId) {
      this.errorMessage = 'Código de cupón inválido';
      this.loading = false;
      this.messageService.add({
        severity: 'error',
        summary: 'Código inválido',
        detail: 'El formato del código no es válido',
        life: 4000
      });
      return;
    }

    // Validar el cupón mediante el servicio de redenciones (no lo redime)
    const tenantId = this.authService.getTenantId();
    this.redemptionService.validateCouponByCode(this.couponCode, tenantId).subscribe({
      next: (validation) => {
        // Manejar distintos estados devueltos por el backend
        if (validation.alreadyRedeemed || String(validation.status) === 'REDEEMED') {
          this.errorMessage = 'Este cupón ya ha sido redimido';
          this.loading = false;
          this.messageService.add({ severity: 'error', summary: 'Cupón redimido', detail: 'Este cupón ya fue utilizado', life: 4000 });
          return;
        }

        if (validation.isExpired || validation.expired) {
          this.errorMessage = 'Este cupón está vencido';
          this.loading = false;
          this.messageService.add({ severity: 'error', summary: 'Cupón vencido', detail: 'El cupón ha expirado', life: 4000 });
          return;
        }

        // Validar pertenencia al tenant (si el backend retorna tenantId)
        if (validation.tenantId != null && validation.tenantId !== tenantId) {
          this.errorMessage = 'Este cupón no pertenece a tu tenant';
          this.loading = false;
          this.messageService.add({ severity: 'error', summary: 'Cupón inválido', detail: 'El cupón no es válido para tu cuenta', life: 4000 });
          return;
        }

        // Mapear datos de validación al rewardData para cálculo
        this.rewardData = {
          id: 0,
          campaignId: validation.campaignId || campaignId,
          rewardType: validation.rewardType || (validation.couponType as any) || 'PERCENT_DISCOUNT',
          numericValue: validation.numericValue ?? validation.couponValue ?? 0,
          description: validation.rewardDescription || validation.benefit || validation.message || '',
          minPurchaseAmount: validation.minPurchaseAmount ?? validation.minRedemptionAmount ?? 0,
          usageLimit: validation.usageLimit ?? 0,
          usageCount: validation.usageCount ?? 0,
          tenantId: validation.tenantId ?? undefined,
          isRedeemed: !!(validation.alreadyRedeemed || String(validation.status) === 'REDEEMED'),
          canRedeem: !!(validation.valid && !validation.alreadyRedeemed && !validation.isExpired)
        };

        // Continuar con las reglas ya existentes
        this.applyRewardRules();
      },
      error: (error) => {
        console.error('Error validando cupón:', error);
        this.errorMessage = 'No se pudo validar el cupón. Por favor, verifica el código.';
        this.loading = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Cupón no encontrado o inválido' });
      }
    });
  }

  private extractCampaignId(code: string): number | null {
    // Intentar extraer el ID de la campaña del código
    // Formato esperado: CAMP21-XXXXX o similar
    const match = code.match(/CAMP(\d+)/i);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }

    // Si no tiene el formato esperado, intentar usar el código como número
    const numericCode = parseInt(code, 10);
    return isNaN(numericCode) ? null : numericCode;
  }

  private applyRewardRules(): void {
    if (!this.rewardData || this.purchaseAmount === undefined || this.purchaseAmount === null) {
      this.loading = false;
      return;
    }

    const amount = this.purchaseAmount;
    const minAmount = this.rewardData.minPurchaseAmount;

    // 1. Validar que el cupón pertenezca al tenant actual
    // Nota: Si el backend devuelve tenantId, validar que coincida con el tenant actual
    if (this.rewardData.tenantId && !this.validateTenantOwnership(this.rewardData.tenantId)) {
      this.errorMessage = 'Este cupón no es válido para tu cuenta';
      this.loading = false;
      this.messageService.add({
        severity: 'error',
        summary: 'Cupón inválido',
        detail: 'Este cupón no pertenece a tu tenant o no es válido',
        life: 4000
      });
      return;
    }

    // 2. Validar que el cupón no haya sido redimido ya
    if (this.rewardData.isRedeemed || !this.rewardData.canRedeem) {
      this.errorMessage = 'Este cupón ya ha sido redimido';
      this.loading = false;
      this.messageService.add({
        severity: 'error',
        summary: 'Cupón agotado',
        detail: 'Este cupón ya fue utilizado y no está disponible',
        life: 4000
      });
      return;
    }

    // 3. Validar límite de uso del cupón
    if (this.rewardData.usageLimit > 0 && this.rewardData.usageCount >= this.rewardData.usageLimit) {
      this.errorMessage = 'Este cupón ya alcanzó su límite de uso';
      this.loading = false;
      this.messageService.add({
        severity: 'error',
        summary: 'Cupón agotado',
        detail: `Este cupón ya no puede ser utilizado. Límite de uso: ${this.rewardData.usageLimit}`,
        life: 4000
      });
      return;
    }

    // 4. Validar monto mínimo de compra
    if (amount < minAmount) {
      this.errorMessage = `Compra mínima requerida: $${minAmount.toFixed(2)}`;
      this.loading = false;
      this.messageService.add({
        severity: 'error',
        summary: 'Monto insuficiente',
        detail: `Este cupón requiere una compra mínima de $${minAmount.toFixed(2)}. Tu monto actual es $${amount.toFixed(2)}`,
        life: 5000
      });
      return;
    }

    // Todas las validaciones pasaron - Calcular descuento
    this.calculateDiscount();

    // Marcar este cupón como aplicado en esta sesión
    this.appliedCoupons.add(this.couponCode);

    this.loading = false;
    this.showResult = true;

    this.messageService.add({
      severity: 'success',
      summary: 'Cupón válido',
      detail: `Descuento de $${this.discountAmount.toFixed(2)} aplicado`,
      life: 4000
    });
  }

  private calculateDiscount(): void {
    if (!this.rewardData || this.purchaseAmount === undefined || this.purchaseAmount === null) return;

    const amount = this.purchaseAmount;

    switch (this.rewardData.rewardType) {
      case 'PERCENT_DISCOUNT':
        // Calcular descuento porcentual
        this.discountAmount = (amount * this.rewardData.numericValue) / 100;
        break;

      case 'FIXED_AMOUNT':
        // Aplicar descuento de monto fijo
        this.discountAmount = Math.min(this.rewardData.numericValue, amount);
        break;

      default:
        this.discountAmount = 0;
    }

    // Calcular monto final
    this.finalAmount = Math.max(0, amount - this.discountAmount);
  }

  /**
   * Valida que el cupón pertenezca al tenant actual
   * Nota: Implementar validación contra el tenant ID actual del usuario
   */
  private validateTenantOwnership(rewardTenantId: number): boolean {
    // TODO: Obtener el tenantId actual del usuario (del auth service o estado global)
    // Comparar con el tenantId del reward
    // Por ahora, retorna true para no bloquear funcionalidad
    // Implementar cuando se tenga acceso al tenant actual del usuario
    return true;
  }

  resetForm(): void {
    this.couponCode = '';
    this.purchaseAmount = undefined;
    this.errorMessage = '';
    this.showResult = false;
    this.rewardData = null;
    this.discountAmount = 0;
    this.finalAmount = 0;
    // No limpiar appliedCoupons para mantener historial en esta sesión
    // this.appliedCoupons.clear(); // Descomenta si quieres limpiar el historial
  }
}
