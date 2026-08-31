import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ConfirmationService, MessageService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DividerModule } from 'primeng/divider';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { FormsModule } from '@angular/forms';
import { RedemptionService } from '../../services/redemption.service';
import { CouponValidationResponse, CouponStatus } from '../../models/coupon-validation.model';
import { RedemptionRequest, RedemptionChannel } from '../../models/redemption-request.model';
import { RedemptionResponse } from '../../models/redemption-response.model';
import { AuthService } from '@/auth/auth.service';
import { TenantService } from '@/pages/admin-page/service/tenant.service';
import { CampaignService } from '@/pages/campaigns/services/campaign.service';

type PageState = 'loading' | 'valid' | 'invalid' | 'redeemed' | 'expired' | 'not-found' | 'redeeming' | 'success' | 'error';

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
  selector: 'app-redeem-page',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    ButtonModule,
    TagModule,
    MessageModule,
    ProgressSpinnerModule,
    DividerModule,
    ConfirmDialogModule,
    ToastModule,
    DialogModule,
    InputNumberModule,
    FormsModule
  ],
  templateUrl: './redeem-page.component.html',
  styleUrls: ['./redeem-page.component.scss'],
  providers: [ConfirmationService, MessageService]
})
export class RedeemPageComponent implements OnInit, OnDestroy {
  qrToken: string = '';
  pageState: PageState = 'loading';
  validationData: CouponValidationResponse | null = null;
  redemptionData: RedemptionResponse | null = null;
  errorMessage: string = '';
  isRedeeming: boolean = false;

  // Dialog para solicitar monto
  showAmountDialog: boolean = false;
  originalAmount: number | null = null;
  minRedemptionAmount: number = 0;

  // Reward data y cálculos de descuento
  rewardData: RewardData | null = null;
  calculatedDiscount: number = 0;
  calculatedFinalAmount: number = 0;

  // Control de acceso
  email: string = '';
  isStaffView: boolean = false;
  hasValidSession: boolean = false;
  tenantId: number | null = null;

  private destroy$ = new Subject<void>();

  // Referencia al enum para usar en template
  CouponStatus = CouponStatus;

  // Exponer Math para usar en template
  Math = Math;

  constructor(
    private route: ActivatedRoute,
    private redemptionService: RedemptionService,
    @Inject(AuthService) private authService: AuthService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private tenantService: TenantService,
    private campaignService: CampaignService
  ) {}

  ngOnInit(): void {
    // Obtener token de la ruta o del query param `code` (soporta enlaces como ?code=...)
    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const tokenFromParam = params['qrToken'];
        if (tokenFromParam) {
          this.setTokenAndValidate(tokenFromParam);
        }
      });

    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(qparams => {
        const tokenFromQuery = qparams['code'] || qparams['qrToken'];
        if (tokenFromQuery) {
          this.setTokenAndValidate(tokenFromQuery);
        } else if (!this.qrToken) {
          this.pageState = 'not-found';
          this.errorMessage = 'No se proporcionó un código de cupón válido';
        }
      });
  }

  // Establece el token si cambió y lanza la validación
  private setTokenAndValidate(token: string): void {
    if (!token) return;
    if (this.qrToken === token) return;
    this.qrToken = token;
    this.checkStaffAccess();
  }

  /**
   * Verifica si el usuario tiene sesión y tenantId válido (staff)
   */
  private checkStaffAccess(): void {
    // Obtener usuario usando el servicio de autenticación
    const currentUser = this.authService.getCurrentUser();

    if (currentUser && currentUser.tenantId) {
      this.email = currentUser.email;
      this.tenantId = currentUser.tenantId ?? 0;
      this.hasValidSession = true;

      // Si tiene tenantId válido, es vista de staff
      this.isStaffView = !!this.tenantId && this.tenantId > 0;
    } else {
      // No hay tenant válido, es cliente
      this.isStaffView = false;
      this.hasValidSession = false;
      this.tenantId = null;
    }
    // Validar cupón después de determinar el tipo de usuario
    this.validateCoupon();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Valida el cupón automáticamente al cargar
   * Usa endpoint diferente según si es staff o cliente
   */
  private validateCoupon(): void {
    this.pageState = 'loading';

    // Seleccionar el método de validación según el tipo de usuario
    const validationObservable = this.isStaffView && this.tenantId !== null
      ? this.redemptionService.validateCouponByQr(this.qrToken, this.tenantId)
      : this.redemptionService.validateCouponByCustomerQr(this.qrToken);

    validationObservable
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: CouponValidationResponse) => {
          this.validationData = response;

          if (response.valid) {
            this.pageState = 'valid';
            // Cargar información del reward cuando el cupón es válido
            const campaignId = response.campaignId;
            if (campaignId != null) {
              this.loadRewardData(campaignId);
            }
          } else if (response.alreadyRedeemed) {
            this.pageState = 'redeemed';
          } else if (response.isExpired) {
            this.pageState = 'expired';
          } else {
            this.pageState = 'not-found';
          }
        },
        error: (error: any) => {
          console.error('Error validating coupon:', error);
          this.pageState = 'error';
          this.errorMessage = error.message || 'Error al validar el cupón';
        }
      });
  }

  /**
   * Carga la información del reward para mostrar en la vista del cupón
   */
  private loadRewardData(campaignId: number): void {
    if (!campaignId) return;

    // Si validationData ya tiene información del reward, usarla directamente
    if (this.validationData?.minPurchaseAmount != null || this.validationData?.usageLimit != null) {
      this.rewardData = {
        id: 0,
        campaignId: campaignId,
        rewardType: this.validationData.rewardType || '',
        numericValue: this.validationData.numericValue || 0,
        description: this.validationData.rewardDescription || '',
        minPurchaseAmount: this.validationData.minPurchaseAmount || 0,
        usageLimit: this.validationData.usageLimit || 0,
        usageCount: this.validationData.usageCount || 0
      };
      this.minRedemptionAmount = this.validationData.minPurchaseAmount || 0;
      return;
    }

    // Si no, cargar desde el servicio
    this.campaignService.getRewardByCampaign(campaignId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (reward: any) => {
          this.rewardData = reward;
          this.minRedemptionAmount = reward.minPurchaseAmount || 0;
        },
        error: (error) => {
          console.warn('No se pudo cargar información del reward:', error);
          // Si no hay reward, usar valores del validationData
          this.minRedemptionAmount = this.validationData?.minRedemptionAmount || 0;
        }
      });
  }

  /**
   * Inicia el proceso de redención con confirmación
   */
  onRedeemCoupon(): void {
    // Si rewardData ya está cargado, usarlo directamente
    if (this.rewardData) {
      this.minRedemptionAmount = this.rewardData.minPurchaseAmount || 0;
      this.originalAmount = null;

      // Validar límite de uso
      if (this.rewardData.usageCount >= this.rewardData.usageLimit) {
        this.messageService.add({
          severity: 'error',
          summary: 'Cupón agotado',
          detail: 'Este cupón ya alcanzó su límite de uso',
          life: 4000
        });
        return;
      }

      this.showAmountDialog = true;
      return;
    }

    // Si no, obtener campaignId y cargar reward
    const campaignId = this.validationData?.campaignId;

    if (!campaignId) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo obtener información de la campaña',
        life: 3000
      });
      return;
    }

    // Cargar información del reward desde la campaña
    this.campaignService.getRewardByCampaign(campaignId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (reward: any) => {
          this.rewardData = reward;
          this.minRedemptionAmount = reward.minPurchaseAmount || 0;
          this.originalAmount = null;

          // Validar límite de uso
          if (this.rewardData && this.rewardData.usageCount >= this.rewardData.usageLimit) {
            this.messageService.add({
              severity: 'error',
              summary: 'Cupón agotado',
              detail: 'Este cupón ya alcanzó su límite de uso',
              life: 3000
            });
            return;
          }

          this.showAmountDialog = true;
        },
        error: (error) => {
          console.error('Error obteniendo reward:', error);
          // Si no hay reward definido, usar valores por defecto
          this.minRedemptionAmount = this.validationData?.minRedemptionAmount || this.validationData?.minPurchaseAmount || 0;
          this.originalAmount = null;
          this.showAmountDialog = true;
        }
      });
  }

  /**
   * Confirma la redención con el monto ingresado
   */
  confirmRedemption(): void {
    // Convertir explícitamente a números para evitar comparaciones incorrectas
    debugger;
    const amount = Number(this.originalAmount);
    const minAmount = Number(this.minRedemptionAmount);

    // Validar que el monto sea válido
    if (isNaN(amount) || amount <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Monto inválido',
        detail: 'Por favor ingresa un monto de compra válido',
        life: 4000
      });
      return;
    }

    // Validar que el monto sea mayor o igual al mínimo
    if (amount < minAmount) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Monto insuficiente',
        detail: `Este cupón requiere una compra mínima de $${minAmount.toFixed(2)}`,
        life: 4000
      });
      return;
    }

    // Calcular descuento si hay rewardData
    this.calculateDiscountAndFinal(amount);

    // Cerrar diálogo y mostrar confirmación
    this.showAmountDialog = false;

    const discountText = this.calculatedDiscount > 0
      ? ` con un descuento de $${this.calculatedDiscount.toFixed(2)}`
      : '';
    const finalText = this.calculatedDiscount > 0
      ? ` Total a pagar: $${this.calculatedFinalAmount.toFixed(2)}.`
      : '';

    this.confirmationService.confirm({
      header: '¿Confirmar redención?',
      message: `¿Está seguro que desea redimir este cupón por un monto de $${amount.toFixed(2)}${discountText}? ${finalText} Esta acción no se puede deshacer.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, redimir',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-success',
      rejectButtonStyleClass: 'p-button-secondary',
      accept: () => {
        this.redeemCoupon();
      },
      reject: () => {
        // Si cancela, volver a mostrar el diálogo
        this.showAmountDialog = true;
      }
    });
  }

  /**
   * Calcula el descuento y monto final basado en el rewardData
   */
  private calculateDiscountAndFinal(amount: number): void {
    if (!this.rewardData) {
      this.calculatedDiscount = 0;
      this.calculatedFinalAmount = amount;
      return;
    }

    switch (this.rewardData.rewardType) {
      case 'PERCENT_DISCOUNT':
        this.calculatedDiscount = (amount * this.rewardData.numericValue) / 100;
        break;

      case 'FIXED_AMOUNT':
        this.calculatedDiscount = Math.min(this.rewardData.numericValue, amount);
        break;

      default:
        this.calculatedDiscount = 0;
    }

    this.calculatedFinalAmount = Math.max(0, amount - this.calculatedDiscount);
  }

  /**
   * Cancela el diálogo de monto
   */
  /**
   * Cancela el diálogo de monto
   */
  cancelAmountDialog(): void {
    this.showAmountDialog = false;
    this.originalAmount = null;
  }

  /**
   * Ejecuta la redención del cupón
   */
  private redeemCoupon(): void {
    debugger;

    this.isRedeeming = true;
    this.pageState = 'redeeming';
    // Obtener información del usuario actual usando el método genérico
    const currentUser = this.authService.getCurrentUser();

    const request: RedemptionRequest = {
      redeemedBy: currentUser?.email || 'unknown',
      channel: RedemptionChannel.QR_WEB,
      originalAmount: this.originalAmount ?? undefined,
      location: 'Web Dashboard',
      metadata: JSON.stringify({
        device: this.getDeviceType(),
        browser: this.getBrowserName(),
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || null
      })
    };

    this.redemptionService.redeemCouponByQr(this.qrToken, request, this.tenantId ?? 0)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: RedemptionResponse) => {
          this.redemptionData = response;
          this.isRedeeming = false;

          if (response.success) {
            this.pageState = 'success';
            this.messageService.add({
              severity: 'success',
              summary: '¡Cupón redimido!',
              detail: 'El cupón se ha redimido exitosamente',
              life: 5000
            });
          } else {
            this.pageState = 'error';
            this.errorMessage = response.message || 'No se pudo redimir el cupón';
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: this.errorMessage,
              life: 5000
            });
          }
        },
        error: (error: any) => {
          console.error('Error redeeming coupon:', error);
          this.isRedeeming = false;
          this.pageState = 'error';
          this.errorMessage = error.message || 'Error al redimir el cupón';
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: this.errorMessage,
            life: 5000
          });
        }
      });
  }

  /**
   * Recarga la página para validar otro cupón
   */
  onValidateAnother(): void {
    window.location.reload();
  }

  /**
   * Obtiene el tipo de dispositivo
   */
  private getDeviceType(): string {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(userAgent)) {
      return 'Tablet';
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(userAgent)) {
      return 'Mobile';
    }
    return 'Desktop';
  }

  /**
   * Obtiene el nombre del navegador
   */
  private getBrowserName(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Opera')) return 'Opera';
    return 'Unknown';
  }

  /**
   * Formatea fecha para mostrar
   */
  formatDate(dateString?: string | null): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Obtiene la severidad del tag según el estado
   */
  getStatusSeverity(status?: string | null): 'success' | 'danger' | 'warn' | 'info' {
    if (!status) return 'info';
    switch (status) {
      case CouponStatus.ACTIVE:
        return 'success';
      case CouponStatus.REDEEMED:
        return 'danger';
      case CouponStatus.EXPIRED:
        return 'warn';
      case CouponStatus.CANCELLED:
        return 'danger';
      default:
        return 'info';
    }
  }

  /**
   * Obtiene el texto del estado
   */
  getStatusText(status?: string | null): string {
    if (!status) return 'DESCONOCIDO';
    switch (status) {
      case CouponStatus.ACTIVE:
        return 'ACTIVO';
      case CouponStatus.REDEEMED:
        return 'REDIMIDO';
      case CouponStatus.EXPIRED:
        return 'EXPIRADO';
      case CouponStatus.CANCELLED:
        return 'CANCELADO';
      case CouponStatus.CREATED:
        return 'CREADO';
      case CouponStatus.SENT:
        return 'ENVIADO';
      default:
        return 'DESCONOCIDO';
    }
  }
}
