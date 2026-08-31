import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { PendingOrder } from '../models/order.model';

@Component({
  selector: 'app-cancel-order-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, ButtonModule, InputTextareaModule],
  templateUrl: './cancel-order-dialog.component.html',
  styleUrls: ['./cancel-order-dialog.component.scss']
})
export class CancelOrderDialogComponent {
  @Input() visible: boolean = false;
  @Input() order: PendingOrder | null = null;
  @Input() isLoading: boolean = false;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() confirmed = new EventEmitter<string>();
  @Output() cancelled = new EventEmitter<void>();

  cancellationReason: string = '';

  onVisibilityChange(newVisible: boolean): void {
    if (!newVisible) {
      this.cancellationReason = '';
    }
    this.visibleChange.emit(newVisible);
  }

  onConfirm(): void {
    if (this.cancellationReason.trim().length > 0) {
      this.confirmed.emit(this.cancellationReason);
    }
  }

  onCancel(): void {
    this.cancellationReason = '';
    this.cancelled.emit();
    this.visibleChange.emit(false);
  }

  getClientLabel(order: PendingOrder): string {
    return order.customerName ?? order.nombre ?? (order.customerId ? `Cliente #${order.customerId}` : 'Cliente General');
  }
}
