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
    const ticketEl = document.querySelector('.ticket') as HTMLElement;
    if (!ticketEl) {
      document.body.classList.add('ticket-print-mode');
      window.print();
      setTimeout(() => document.body.classList.remove('ticket-print-mode'), 800);
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Ticket #${this.order?.id ? this.order.id.slice(0, 8).toUpperCase() : ''}</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body {
              font-family: 'Courier New', Courier, monospace;
              width: 72mm;
              margin: 0 auto;
              padding: 10px 0;
              font-size: 12px;
              color: #000;
              line-height: 1.35;
              text-align: center;
            }
            .ticket-business { font-size: 15px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; }
            .ticket-line { font-size: 11px; }
            .ticket-sep { border-top: 1px dashed #000; margin: 6px 0; }
            .ticket-meta, .ticket-items, .ticket-totals { text-align: left; }
            .ticket-item { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 2px; }
            .ticket-item-name { flex: 1; word-break: break-word; }
            .ticket-total-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
            .ticket-total-final { font-weight: 900; font-size: 14px; margin-top: 4px; }
            .ticket-qr-section { margin-top: 6px; text-align: center; }
            .ticket-qr-label { font-weight: bold; margin-bottom: 4px; font-size: 11px; }
            .ticket-qr-help { font-size: 10px; margin-top: 3px; }
            .ticket-qr-section canvas, .ticket-qr-section img { width: 32mm !important; height: 32mm !important; }
            .ticket-footer { margin-top: 8px; font-size: 11px; }
          </style>
        </head>
        <body>
          ${ticketEl.innerHTML}
        </body>
      </html>
    `;

    let iframe = document.getElementById('ticket-print-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'ticket-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      }, 250);
    }
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
