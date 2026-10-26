import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { TenantService } from '@/pages/admin-page/service/tenant.service';
import { ImageService } from '@/pages/service/image.service';
import { QRCodeComponent } from 'angularx-qrcode';

@Component({
  selector: 'app-logo-negocio',
  standalone: true,
  imports: [CommonModule, FormsModule, ToastModule, QRCodeComponent],
  providers: [MessageService],
  templateUrl: './logo-negocio.component.html',
  styleUrls: ['./logo-negocio.component.scss']
})
export class LogoNegocioComponent implements OnInit {
  private tenantService = inject(TenantService);
  private imageService = inject(ImageService);
  private messageService = inject(MessageService);

  tenantId = signal<number>(1);
  businessName = signal<string>('Mi Negocio');
  businessAddress = signal<string>('');
  businessPhone = signal<string>('');
  slogan = signal<string>('');
  userEmail = signal<string>('');

  currentLogoUrl = signal<string>('');
  previewLogoUrl = signal<string>('');
  selectedFile = signal<File | null>(null);
  ticketLogoMode = signal<'HEADER' | 'WATERMARK' | 'BOTH'>('HEADER');

  cargando = signal<boolean>(false);
  guardando = signal<boolean>(false);
  dragOver = signal<boolean>(false);

  // Muestra simulada para el ticket de prueba
  simulatedOrderId = 'ORD-DEMO-8842';
  invoiceBaseUrl = 'http://localhost:4200/facturar/';

  get activeLogo(): string {
    return this.previewLogoUrl() || this.currentLogoUrl();
  }

  get invoiceUrl(): string {
    return `${this.invoiceBaseUrl}${this.simulatedOrderId}`;
  }

  ngOnInit(): void {
    this.resolverTenantId();
    this.cargarDatosNegocio();
  }

  private resolverTenantId(): void {
    const rawId = localStorage.getItem('tenantId');
    if (rawId) {
      this.tenantId.set(Number(rawId) || 1);
    }
    const rawUser = localStorage.getItem('user');
    if (rawUser) {
      try {
        const u = JSON.parse(rawUser);
        if (u.email) this.userEmail.set(u.email);
        if (u.tenantId) this.tenantId.set(Number(u.tenantId) || 1);
      } catch (_) {}
    }
  }

  cargarDatosNegocio(): void {
    this.cargando.set(true);
    this.tenantService.getTenantById(this.tenantId()).subscribe({
      next: (t: any) => {
        this.cargando.set(false);
        if (t) {
          this.businessName.set(t.bussinessName || t.nombreNegocio || 'Mi Negocio');
          this.businessAddress.set(t.direccion || '');
          this.businessPhone.set(t.telefono || '');
          this.slogan.set(t.slogan || '');
          this.currentLogoUrl.set(t.logoUrl || '');
          this.ticketLogoMode.set((t.ticketLogoMode as any) || 'HEADER');
          this.previewLogoUrl.set('');
          this.selectedFile.set(null);
        }
      },
      error: (err) => {
        this.cargando.set(false);
        console.warn('Error al cargar datos del negocio:', err);
      }
    });
  }

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.dragOver.set(true);
  }

  onDragLeave(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.dragOver.set(false);
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.dragOver.set(false);

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      this.procesarArchivo(e.dataTransfer.files[0]);
    }
  }

  onFileChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.procesarArchivo(input.files[0]);
    }
  }

  private procesarArchivo(file: File): void {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Formato no compatible',
        detail: 'Por favor sube una imagen en formato PNG, JPG, WEBP o SVG.',
        life: 4000
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.messageService.add({
        severity: 'error',
        summary: 'Archivo muy pesado',
        detail: 'El tamaño máximo permitido es de 5MB.',
        life: 4000
      });
      return;
    }

    this.selectedFile.set(file);
    const reader = new FileReader();
    reader.onload = () => {
      this.previewLogoUrl.set(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  cancelarSeleccion(): void {
    this.previewLogoUrl.set('');
    this.selectedFile.set(null);
  }

  guardarLogo(): void {
    const file = this.selectedFile();
    const preview = this.previewLogoUrl();

    if (!file && !preview) {
      this.messageService.add({
        severity: 'info',
        summary: 'Sin cambios',
        detail: 'Selecciona primero una imagen para actualizar tu logotipo.',
        life: 3000
      });
      return;
    }

    this.guardando.set(true);

    if (file) {
      this.imageService.uploadImage(
        file,
        'logo',
        this.userEmail(),
        this.businessName(),
        this.slogan(),
        this.tenantId()
      ).subscribe({
        next: (savedUrl: string) => {
          this.guardando.set(false);
          const cleanUrl = String(savedUrl || '').trim();
          this.currentLogoUrl.set(cleanUrl);
          this.previewLogoUrl.set('');
          this.selectedFile.set(null);

          // Actualizar datos de negocio en DB para asegurar consistencia
          this.actualizarTenantConLogo(cleanUrl);

          this.messageService.add({
            severity: 'success',
            summary: '¡Logo Guardado!',
            detail: 'El logotipo fue guardado exitosamente en la base de datos y se mostrará en los tickets.',
            life: 4000
          });
        },
        error: (err) => {
          this.guardando.set(false);
          console.error('Error al subir logotipo:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Error al guardar',
            detail: 'No se pudo guardar la imagen. Intenta de nuevo o verifica tu conexión.',
            life: 5000
          });
        }
      });
    } else if (preview) {
      // Subir directamente por base64
      this.imageService.uploadLogoBase64(
        preview,
        this.tenantId(),
        this.userEmail(),
        this.businessName(),
        this.slogan()
      ).subscribe({
        next: (savedUrl: string) => {
          this.guardando.set(false);
          const cleanUrl = String(savedUrl || '').trim();
          this.currentLogoUrl.set(cleanUrl);
          this.previewLogoUrl.set('');
          this.actualizarTenantConLogo(cleanUrl);

          this.messageService.add({
            severity: 'success',
            summary: '¡Logo Guardado!',
            detail: 'El logotipo fue guardado en la base de datos.',
            life: 4000
          });
        },
        error: (err) => {
          this.guardando.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Error al guardar',
            detail: 'Hubo un error al guardar la imagen en el servidor.',
            life: 5000
          });
        }
      });
    }
  }

  private actualizarTenantConLogo(url: string): void {
    this.tenantService.getTenantById(this.tenantId()).subscribe({
      next: (t: any) => {
        if (t) {
          t.logoUrl = url;
          t.ticketLogoMode = this.ticketLogoMode();
          this.tenantService.updateTenant(this.tenantId(), t).subscribe({
            next: () => {
              if (this.userEmail()) {
                this.tenantService.invalidateTenantByEmailCache(this.userEmail());
              }
            }
          });
        }
      }
    });
  }

  cambiarModoLogo(modo: 'HEADER' | 'WATERMARK' | 'BOTH'): void {
    this.ticketLogoMode.set(modo);
    this.tenantService.getTenantById(this.tenantId()).subscribe({
      next: (t: any) => {
        if (t) {
          t.ticketLogoMode = modo;
          this.tenantService.updateTenant(this.tenantId(), t).subscribe({
            next: () => {
              const modoTexto = modo === 'HEADER'
                ? 'Cabecera (bien marcado arriba)'
                : (modo === 'WATERMARK' ? 'Marca de agua (detrás de todo el ticket)' : 'Cabecera y marca de agua');
              this.messageService.add({
                severity: 'success',
                summary: 'Modo Actualizado',
                detail: `El logotipo se mostrará como: ${modoTexto}`,
                life: 3500
              });
              if (this.userEmail()) {
                this.tenantService.invalidateTenantByEmailCache(this.userEmail());
              }
            },
            error: (err) => {
              console.error('Error al guardar modo de ticket:', err);
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'No se pudo guardar la preferencia en el servidor.',
                life: 3000
              });
            }
          });
        }
      }
    });
  }

  eliminarLogo(): void {
    if (!this.currentLogoUrl() && !this.previewLogoUrl()) return;

    if (!confirm('¿Estás seguro de que deseas eliminar el logotipo del establecimiento?')) {
      return;
    }

    this.guardando.set(true);
    this.tenantService.getTenantById(this.tenantId()).subscribe({
      next: (t: any) => {
        if (t) {
          t.logoUrl = '';
          this.tenantService.updateTenant(this.tenantId(), t).subscribe({
            next: () => {
              this.guardando.set(false);
              this.currentLogoUrl.set('');
              this.previewLogoUrl.set('');
              this.selectedFile.set(null);
              if (this.userEmail()) {
                this.tenantService.invalidateTenantByEmailCache(this.userEmail());
              }
              this.messageService.add({
                severity: 'info',
                summary: 'Logotipo Eliminado',
                detail: 'El logotipo fue retirado del establecimiento.',
                life: 3000
              });
            },
            error: (err) => {
              this.guardando.set(false);
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'No se pudo eliminar el logotipo en la base de datos.',
                life: 4000
              });
            }
          });
        } else {
          this.guardando.set(false);
        }
      },
      error: () => this.guardando.set(false)
    });
  }
}
