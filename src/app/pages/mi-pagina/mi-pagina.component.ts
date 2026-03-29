import { Component, OnInit, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DividerModule } from 'primeng/divider';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { QRCodeComponent } from 'angularx-qrcode';
import { MiPaginaService } from './mi-pagina.service';
import { environment } from '@/pages/commons/environment';
import { AuthService } from '@/auth/auth.service';
import { TenantService } from '@/pages/admin-page/service/tenant.service';
import { ProductService } from '@/pages/products-menu/service/product.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-mi-pagina',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    DividerModule,
    ToastModule,
    ProgressSpinnerModule,
    TooltipModule,
    QRCodeComponent
  ],
  providers: [MessageService],
  templateUrl: './mi-pagina.component.html',
  styleUrls: ['./mi-pagina.component.scss']
})
export class MiPaginaComponent implements OnInit {
  @ViewChild('qrcodeElement', { static: false }) qrcodeElement!: ElementRef;

  landingUrl = signal<string>('');
  tenantSlug = signal<string>('');
  hasProducts = signal<boolean>(false);
  isPublished = signal<boolean>(false);
  isLoading = signal<boolean>(true);

  qrSize = 300;
  qrErrorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' = 'M';

  constructor(
    private miPaginaService: MiPaginaService,
    private authService: AuthService,
    private tenantService: TenantService,
    private productService: ProductService,
    private messageService: MessageService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadPageInfo();
  }

  /**
   * Carga la información de la página del tenant
   */
  private loadPageInfo() {
    this.isLoading.set(true);

    const user = this.authService.getCurrentUser();
    if (!user || !user.tenantId) {
      this.showError('No se encontró usuario autenticado o tenant');
      this.isLoading.set(false);
      return;
    }

    this.tenantService.getTenantById(user.tenantId).subscribe({
      next: (tenant) => {
        const tenantId = tenant?.id;
        const tenantSlug = tenant?.slug;

        if (!tenantId || !tenantSlug) {
          this.showError('No se encontró información del tenant');
          this.isLoading.set(false);
          return;
        }

        // Obtener productos para validar estado
        this.productService.getProductsByTenantId(tenantId).subscribe({
          next: (productResp) => {
            const products = productResp?.object || [];
            const hasProducts = products.length > 0;

            // Construir URL
            const baseUrl = this.getBaseUrl();
            const landingUrl = `${baseUrl}/${tenantSlug}`;

            // Actualizar estado
            this.tenantSlug.set(tenantSlug);
            this.landingUrl.set(landingUrl);
            this.hasProducts.set(hasProducts);
            this.isPublished.set(hasProducts);

            this.isLoading.set(false);
          },
          error: (error) => {
            console.error('Error al cargar productos:', error);
            this.showError('Error al verificar productos');
            this.isLoading.set(false);
          }
        });
      },
      error: (error) => {
        console.error('Error al cargar información del tenant:', error);
        this.showError('Error al cargar información del tenant');
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Copia la URL al portapapeles
   */
  copyUrl() {
    const url = this.landingUrl();
    if (!url) {
      this.showError('No hay URL para copiar');
      return;
    }

    navigator.clipboard.writeText(url).then(
      () => {
        this.messageService.add({
          severity: 'success',
          summary: 'URL copiada',
          detail: 'La URL se copió correctamente al portapapeles',
          life: 3000
        });
      },
      (err) => {
        console.error('Error al copiar URL:', err);
        this.showError('No se pudo copiar la URL');
      }
    );
  }

  /**
   * Descarga el código QR como imagen PNG
   */
  async downloadQR() {
    try {
      const canvas = document.querySelector('canvas');
      if (!canvas) {
        this.showError('El código QR no está listo');
        return;
      }

      // Convertir canvas a blob
      canvas.toBlob((blob) => {
        if (!blob) {
          this.showError('Error al generar la imagen');
          return;
        }

        // Crear enlace de descarga
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `qr-${this.tenantSlug()}.png`;
        link.click();

        // Limpiar
        URL.revokeObjectURL(url);

        this.messageService.add({
          severity: 'success',
          summary: 'QR descargado',
          detail: 'El código QR se descargó correctamente',
          life: 3000
        });
      }, 'image/png');
    } catch (error) {
      console.error('Error al descargar QR:', error);
      this.showError('Error al descargar el código QR');
    }
  }

  /**
   * Imprime el código QR
   */
  printQR() {
    const printWindow = window.open('', '', 'width=600,height=600');
    if (!printWindow) {
      this.showError('No se pudo abrir la ventana de impresión');
      return;
    }

    const qrCanvas = document.querySelector('canvas');
    if (!qrCanvas) {
      this.showError('No se encontró el código QR');
      printWindow.close();
      return;
    }

    const qrImageUrl = qrCanvas.toDataURL('image/png');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Imprimir QR - ${this.tenantSlug()}</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            }
            .container {
              text-align: center;
            }
            h2 {
              margin-bottom: 20px;
              color: #333;
            }
            img {
              max-width: 400px;
              height: auto;
            }
            .url {
              margin-top: 20px;
              font-size: 14px;
              color: #666;
              word-break: break-all;
            }
            @media print {
              body {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Código QR - Mi Página</h2>
            <img src="${qrImageUrl}" alt="Código QR" />
            <p class="url">${this.landingUrl()}</p>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();

    // Esperar a que la imagen cargue antes de imprimir
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    };
  }

  /**
   * Obtiene la URL base de la aplicación
   */
  private getBaseUrl(): string {
    const cfg = environment as { landingPageBaseUrl?: string };

    // 1) If explicit config exists, use it (trim trailing slash).
    if (cfg.landingPageBaseUrl && cfg.landingPageBaseUrl.trim() !== '') {
      return cfg.landingPageBaseUrl.replace(/\/+$/g, '');
    }

    // 2) Otherwise build from the current origin at runtime (avoids hardcoding localhost/prod).
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return `${window.location.origin}/landing-page`;
    }

    // 3) Final fallback (shouldn't normally hit in browser environments).
    return 'https://lealtix.com.mx/landing-page';
  }

  /**
   * Navega a la vista de menú imprimible
   */

  navigateToMenuPrint(): void {
    this.router.navigate(['/dashboard/menu-classic-print']);
  }

  /**
   * Navega a la vista de menú imprimible y activa la exportación automática
   */

  navigateToMenuPrintAndExport(): void {
    this.router.navigate(['/dashboard/menu-classic-print'], {
      state: { autoExport: true }
    });
  }

  /**
   * Muestra un mensaje de error
   */
  private showError(message: string) {
    this.messageService.add({
      severity: 'error',
      summary: 'Error',
      detail: message,
      life: 5000
    });
  }
}
