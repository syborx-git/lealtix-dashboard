import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QRCodeComponent } from 'angularx-qrcode';
import { PendingOrder } from '../../models/order.model';
import { CajaService } from '@/pages/caja/services/caja.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-ticket-modal',
  standalone: true,
  imports: [CommonModule, QRCodeComponent],
  templateUrl: './ticket-modal.component.html',
  styleUrls: ['./ticket-modal.component.scss']
})
export class TicketModalComponent {
  private cajaService = inject(CajaService);

  @Input() visible = false;
  @Input() order: PendingOrder | null = null;
  @Input() businessName = 'Lealtix';
  @Input() businessAddress = '';
  @Input() businessPhone = '';
  @Input() businessLogo = '';
  @Input() ticketLogoMode = 'HEADER';
  @Input() invoiceBaseUrl = 'http://localhost:4200/facturar/';
  @Input() invoiceUuid = '';
  @Output() visibleChange = new EventEmitter<boolean>();

  get invoiceUrl(): string {
    return this.order ? `${this.invoiceBaseUrl}${this.order.id}` : '';
  }

  async print(): Promise<void> {
    if (this.order?.id) {
      try {
        const tenantId = Number(localStorage.getItem('tenantId')) || 1;
        const resp = await firstValueFrom(this.cajaService.imprimirTicketDirecto(this.order.id, tenantId));
        if (resp?.object?.impresoEnHardware) {
          this.close();
          return;
        }
      } catch (e) {
        console.warn('Fallback a impresión de ventana:', e);
      }
    }

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
            @page {
              size: 58mm auto;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            html, body {
              width: 58mm;
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #000000;
              font-family: 'Courier New', Courier, 'Lucida Console', Monaco, monospace;
              font-size: 11px;
              line-height: 1.25;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              -webkit-font-smoothing: none;
            }
            .ticket-container {
              width: 48mm;
              max-width: 48mm;
              min-width: 48mm;
              margin: 0 auto;
              padding: 2mm 0 14mm 0;
              box-sizing: border-box;
              text-align: center;
              position: relative;
              overflow: hidden;
            }
            .ticket {
              position: relative;
              overflow: hidden;
            }
            .ticket-watermark {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 75%;
              max-height: 55%;
              object-fit: contain;
              opacity: 0.12;
              filter: grayscale(100%);
              pointer-events: none;
              z-index: 0;
            }
            .ticket-header, .ticket-sep, .ticket-meta, .ticket-items, .ticket-totals, .ticket-qr-section, .ticket-footer {
              position: relative;
              z-index: 1;
            }
            .ticket-logo-box {
              text-align: center;
              margin-bottom: 6px;
            }
            .ticket-logo-header {
              max-width: 38mm;
              max-height: 22mm;
              object-fit: contain;
              margin: 0 auto;
              display: block;
              filter: contrast(130%);
            }
            .ticket-business { font-size: 13.5px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; line-height: 1.2; margin-bottom: 2px; }
            .ticket-line { font-size: 10px; font-weight: 700; line-height: 1.25; }
            .ticket-type { font-size: 11px; font-weight: 900; text-transform: uppercase; margin-top: 3px; letter-spacing: 1px; }
            .ticket-sep { border-bottom: 1px dashed #000000; margin: 5px 0; width: 100%; }
            .ticket-meta { text-align: left; font-size: 10.5px; font-weight: 700; line-height: 1.35; }
            .ticket-meta-row { display: flex; justify-content: space-between; gap: 2px; }
            .ticket-items { text-align: left; }
            .ticket-item { display: flex; justify-content: space-between; gap: 4px; margin-bottom: 3px; font-size: 10.5px; }
            .ticket-item-name { flex: 1; word-break: break-word; font-weight: 700; }
            .ticket-item-tag { font-size: 9.5px; font-weight: 900; color: #000000; }
            .ticket-item-price { text-align: right; font-weight: 900; white-space: nowrap; }
            .ticket-totals { text-align: left; font-size: 11px; }
            .ticket-total-row { display: flex; justify-content: space-between; margin-bottom: 2px; font-weight: 700; }
            .ticket-total-final { font-weight: 900; font-size: 15px; border-top: 1px dashed #000000; border-bottom: 1px dashed #000000; padding: 4px 0; margin: 4px 0; }
            .ticket-qr-section { margin-top: 6px; text-align: center; }
            .ticket-qr-label { font-weight: 900; margin-bottom: 4px; font-size: 10.5px; }
            .ticket-qr-help { font-size: 9.5px; font-weight: 700; margin-top: 2px; }
            .ticket-qr-section canvas, .ticket-qr-section img { width: 28mm !important; height: 28mm !important; margin: 0 auto; display: block; }
            .ticket-footer { margin-top: 6px; font-size: 10px; font-weight: 700; text-align: center; }
          </style>
        </head>
        <body>
          <div class="ticket-container">
            ${ticketEl.innerHTML}
          </div>
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

      const doPrint = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.warn('Error al imprimir ticket:', e);
        }
      };

      // Esperar a que las imágenes (logo y QR) terminen de cargarse antes de abrir la ventana de impresión
      const imgs = Array.from(doc.images || []);
      if (imgs.length > 0) {
        let loadedCount = 0;
        const checkReady = () => {
          loadedCount++;
          if (loadedCount >= imgs.length) {
            setTimeout(doPrint, 100);
          }
        };
        imgs.forEach((img: HTMLImageElement) => {
          if (img.complete) {
            checkReady();
          } else {
            img.onload = checkReady;
            img.onerror = checkReady;
          }
        });
        setTimeout(doPrint, 1800);
      } else {
        setTimeout(doPrint, 200);
      }
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
