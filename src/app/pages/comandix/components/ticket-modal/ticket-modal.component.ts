import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QRCodeComponent } from 'angularx-qrcode';
import { PendingOrder } from '../../models/order.model';

@Component({
  selector: 'app-ticket-modal',
  standalone: true,
  imports: [CommonModule, QRCodeComponent],
  templateUrl: './ticket-modal.component.html',
  styleUrls: ['./ticket-modal.component.scss']
})
export class TicketModalComponent {
  @Input() visible = false;
  @Input() order: PendingOrder | null = null;
  @Input() businessName = 'Lealtix';
  @Input() businessAddress = '';
  @Input() businessPhone = '';
  @Input() invoiceBaseUrl = 'http://localhost:4200/facturar/';
  @Input() invoiceUuid = '';
  @Output() visibleChange = new EventEmitter<boolean>();

  get invoiceUrl(): string {
    return this.order ? `${this.invoiceBaseUrl}${this.order.id}` : '';
  }

  print(): void {
    document.body.classList.add('ticket-print-mode');
    window.print();
    setTimeout(() => document.body.classList.remove('ticket-print-mode'), 800);
  }

  close(): void {
    document.body.classList.remove('ticket-print-mode');
    this.visible = false;
    this.visibleChange.emit(false);
  }

  get total(): number {
    return Number(this.order?.totalFinal ?? this.order?.subtotal ?? 0);
  }

  fmt(value: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value || 0);
  }

  itemPrice(item: any): number {
    return (item?.precioUnitario || item?.precio || 0) * (item?.cantidad || 1);
  }
}
