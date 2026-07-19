import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
  RecordPaymentRequest
} from '../../models/order.model';
import { OrderService } from '../../services/order.service';
import { AuthService } from '@/auth/auth.service';

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

  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private fb: FormBuilder,
    private orderService: OrderService,
    private authService: AuthService
  ) {
    this.form = this.fb.group({
      method: ['CASH', Validators.required],
      reference: ['']
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
    }
  }

  ngOnDestroy(): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  get selectedMethod(): PaymentMethod {
    return this.form.get('method')?.value as PaymentMethod;
  }

  get isReferenceRequired(): boolean {
    return this.selectedMethod !== 'CASH';
  }

  get totalToPay(): number {
    if (!this.order) {
      return 0;
    }
    return Number(this.order.totalFinal ?? this.order.subtotal ?? 0);
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

    // Obtener email del usuario logeado desde localStorage
    const currentUserJson = localStorage.getItem('currentUser');
    const currentUser = currentUserJson ? JSON.parse(currentUserJson) : null;
    const userEmail = currentUser?.email ?? 'usuario-desconocido';

    const payload: RecordPaymentRequest = {
      method,
      reference: method === 'CASH' ? null : referenceControlValue,
      userEmail
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
      this.successMessage = 'Pago registrado exitosamente.';
      this.paymentRecorded.emit({
        orderId: this.order.id,
        method,
        reference: payload.reference,
        paidAt
      });

      this.closeTimer = setTimeout(() => {
        this.onClose();
      }, 1200);
    } catch (error: any) {
      this.errorMessage =
        error?.error?.message ||
        error?.message ||
        'No se pudo registrar el pago. Intenta nuevamente.';
    } finally {
      this.loading = false;
    }
  }

  getStatusClass(status: string | undefined): string {
    const normalized = (status ?? '').toUpperCase();
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
