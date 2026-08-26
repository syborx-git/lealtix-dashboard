import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

// PrimeNG imports
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';
import { MessageService } from 'primeng/api';

// Models
import { CampaignPreviewData } from '../../../models/create-campaign.models';
import { PromoType } from '@/models/enums';
import { CampaignService } from '../../../services/campaign.service';
import { environment } from '@/pages/commons/environment';

@Component({
  selector: 'app-campaign-preview-dialog',
  standalone: true,
  imports: [
    CommonModule,
    DialogModule,
    ButtonModule,
    ChipModule
  ],
  templateUrl: './campaign-preview-dialog.component.html',
  styleUrls: ['./campaign-preview-dialog.component.scss']
})
export class CampaignPreviewDialogComponent {
  @Input() visible: boolean = false;
  @Input() previewData!: CampaignPreviewData;
  @Input() showButton: boolean = false;
  @Input() promoTypeOptions: { label: string; value: PromoType }[] = [];
  @Input() clientName: string | null = null;
  @Input() clientLogo: string | null = null;
  @Input() clientSlug: string | null = null;
  @Input() rewardDescription?: string | null = null;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() close = new EventEmitter<void>();

  @ViewChild('captureArea', { static: false }) captureArea!: ElementRef<HTMLDivElement>;

  private campaignService = inject(CampaignService);
  private messageService = inject(MessageService);

  readonly lealtixLogo = 'https://res.cloudinary.com/lealtix-media/image/upload/v1759897289/lealtix_logo_transp_qcp5h9.png';
  readonly lealtixUrl = 'https://full-accountability-big-rug.trycloudflare.com/';

  onClose(): void {
    this.visible = false;
    this.visibleChange.emit(this.visible);
    this.close.emit();
  }

  formatDate(date: Date | null | undefined): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  getPromoTypeLabel(promoType: string | undefined): string {
    if (!promoType) return '';
    const option = this.promoTypeOptions.find(opt => opt.value === promoType);
    return option?.label || promoType;
  }

  getClientInitials(): string {
    if (!this.clientName) return 'NE';
    const words = this.clientName.trim().split(' ');
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  getLandingUrl(): string {
    if (!this.clientSlug) return this.lealtixUrl;
    const baseUrl = environment.production
      ? 'https://full-accountability-big-rug.trycloudflare.com/landing-page'
      : 'http://localhost:4200/landing-page';
    return `${baseUrl}/${this.clientSlug}`;
  }

  /**
   * Retorna la URL de la imagen sin modificaciones
   * Para usar la imagen tal como viene de la BD
   */
  getOptimizedImageUrl(imageUrl: string | undefined): string {
    //console.log('getOptimizedImageUrl - Input:', imageUrl);

    if (!imageUrl) {
      //console.warn('getOptimizedImageUrl - No imageUrl provided');
      return '';
    }

    // Retornar la URL original sin modificaciones
    //console.log('getOptimizedImageUrl - Returning original URL:', imageUrl);
    return imageUrl;
  }

  /**
   * Maneja errores al cargar la imagen
   */
  onImageError(event: Event): void {
    console.error('Error loading image:', event);
    const imgElement = event.target as HTMLImageElement;
    console.error('Failed image src:', imgElement?.src);

    this.messageService.add({
      severity: 'warn',
      summary: 'Imagen no disponible',
      detail: 'No se pudo cargar la imagen de la promoción'
    });
  }

  async downloadImage(): Promise<void> {
    if (!this.captureArea) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'El área de captura no está disponible'
      });
      return;
    }

    // Alternativa sin html2canvas: abrir la vista previa en una nueva ventana
    // y permitir que el usuario imprima/guarde como PDF o guarde la página.
    try {
      const html = this.buildPreviewHtml(this.captureArea.nativeElement.innerHTML);
      const w = window.open('', '_blank', 'noopener');
      if (!w) {
        throw new Error('No se pudo abrir la ventana de vista previa');
      }
      w.document.write(html);
      w.document.close();

      this.messageService.add({
        severity: 'info',
        summary: 'Vista previa abierta',
        detail: 'Se abrió una nueva pestaña con la vista previa. Usa imprimir/Guardar como PDF para obtener el archivo.'
      });
    } catch (error) {
      console.error('Error opening preview window:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo abrir la vista previa para descarga'
      });
    }
  }

  async sendByEmail(): Promise<void> {
    if (!this.captureArea) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'El área de captura no está disponible'
      });
      return;
    }

    // Sin html2canvas: enviar HTML de la vista previa al backend (por implementar)
    try {
      const previewHtml = this.captureArea.nativeElement.innerHTML;

      // Preferir la descripción del reward si está disponible
      const previewToSend = {
        ...this.previewData,
        description: this.rewardDescription ?? this.previewData.description,
        previewHtml
      };

      // TODO: Implement backend endpoint to accept HTML snapshot
      // await this.campaignService.sendPreviewEmail({ previewHtml, previewData: previewToSend }).toPromise();

      this.messageService.add({
        severity: 'info',
        summary: 'Función en desarrollo',
        detail: 'El envío por email estará disponible próximamente'
      });
    } catch (error) {
      console.error('Error preparing email content:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo preparar el contenido para el email'
      });
    }
  }

  /** Construye una página HTML básica para la vista previa/impresión */
  private buildPreviewHtml(innerHtml: string): string {
    const styles: string[] = [];
    // Copiar hojas de estilo cargadas en el documento principal
    document.querySelectorAll('link[rel="stylesheet"]').forEach((lnk) => {
      const href = (lnk as HTMLLinkElement).href;
      if (href) styles.push(`<link rel="stylesheet" href="${href}">`);
    });

    // Inyectar contenido y un pequeño script para facilitar impresión
    return `<!doctype html><html><head><meta charset="utf-8"><title>Vista previa</title>${styles.join('')}<style>body{background:#fff;padding:20px;font-family:Segoe UI,Arial,sans-serif}</style></head><body><div id="content">${innerHtml}</div><div style="margin-top:16px;text-align:center"><button onclick="window.print();" style="padding:8px 14px;border-radius:6px;border:1px solid #ccc;background:#f5f5f5;cursor:pointer">Imprimir / Guardar como PDF</button></div></body></html>`;
  }
}

