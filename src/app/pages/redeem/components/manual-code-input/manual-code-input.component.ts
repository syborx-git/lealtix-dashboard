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

    // Obtener información del reward de la campaña
    this.campaignService.getRewardByCampaign(campaignId).subscribe({
      next: (reward: any) => {
        this.rewardData = reward;
        this.applyRewardRules();
      },
      error: (error) => {
        console.error('Error obteniendo reward:', error);
        this.errorMessage = 'No se pudo validar el cupón. Por favor, verifica el código.';
        this.loading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Cupón no encontrado o inválido'
        });
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

    // Validar monto mínimo de compra
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

    // Validar límite de uso
    if (this.rewardData.usageCount >= this.rewardData.usageLimit) {
      this.errorMessage = 'Este cupón ya alcanzó su límite de uso';
      this.loading = false;
      this.messageService.add({
        severity: 'error',
        summary: 'Cupón agotado',
        detail: 'Este cupón ya no está disponible',
        life: 4000
      });
      return;
    }

    // Calcular descuento según el tipo
    this.calculateDiscount();

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

  resetForm(): void {
    this.couponCode = '';
    this.purchaseAmount = undefined;
    this.errorMessage = '';
    this.showResult = false;
    this.rewardData = null;
    this.discountAmount = 0;
    this.finalAmount = 0;
  }
}
