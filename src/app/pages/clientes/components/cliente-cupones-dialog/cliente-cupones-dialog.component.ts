import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageService } from 'primeng/api';

import { ClienteService, ClienteCouponDTO, AssignCouponPayload } from '../../services/cliente.service';
import { Cliente } from '@/models/cliente.model';

@Component({
  selector: 'app-cliente-cupones-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    TagModule,
    TooltipModule,
    ProgressSpinnerModule
  ],
  styleUrls: ['./cliente-cupones-dialog.component.scss'],
  template: `
    <p-dialog
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '42rem', maxWidth: '95vw' }"
      [dismissableMask]="true"
      [resizable]="false"
      styleClass="cliente-cupones-dialog"
      (onHide)="cerrar()"
    >
      <ng-template #header>
        <div class="flex align-items-center gap-3">
          <div class="header-icon-container">
            <i class="pi pi-ticket"></i>
          </div>
          <div>
            <h2>Cupones de {{ cliente?.nombreCompleto || 'Cliente' }}</h2>
            <div class="header-subtitle">
              <i class="pi pi-envelope mr-1"></i>{{ cliente?.email || 'Sin correo' }}
              <span *ngIf="cliente?.telefono" class="ml-2">
                <i class="pi pi-phone mr-1"></i>{{ cliente?.telefono }}
              </span>
            </div>
          </div>
        </div>
      </ng-template>

      <div class="cupones-container">
        <!-- ================= SECCIÓN ASIGNAR CUPÓN ================= -->
        <div class="assign-box">
          <div class="assign-header">
            <div class="title">
              <i class="pi pi-gift"></i>
              <span>Asignar Cupón o Promoción</span>
            </div>
            <div class="tabs-switch">
              <button
                type="button"
                [class.active]="modoAsignacion === 'campania'"
                (click)="modoAsignacion = 'campania'"
              >
                Campaña
              </button>
              <button
                type="button"
                [class.active]="modoAsignacion === 'personalizado'"
                (click)="modoAsignacion = 'personalizado'"
              >
                Personalizado
              </button>
            </div>
          </div>

          <!-- MODO 1: Por Campaña del Negocio -->
          <div *ngIf="modoAsignacion === 'campania'" class="form-row">
            <div class="form-group" style="flex: 2;">
              <label>Seleccionar Campaña Activa</label>
              <p-select
                [(ngModel)]="selectedCampaniaId"
                [options]="campaniasOptions()"
                optionLabel="label"
                optionValue="value"
                placeholder="Elige una promoción..."
                appendTo="body"
              ></p-select>
            </div>
          </div>

          <!-- MODO 2: Cupón Personalizado Directo (ej. 20%) -->
          <div *ngIf="modoAsignacion === 'personalizado'">
            <div class="form-row">
              <div class="form-group" style="flex: 1.5;">
                <label>Título de la Promoción</label>
                <input
                  pInputText
                  type="text"
                  [(ngModel)]="customTitulo"
                  placeholder="Ej: Descuento 20% Especial"
                />
              </div>
              <div class="form-group" style="flex: 1;">
                <label>Tipo de Beneficio</label>
                <p-select
                  [(ngModel)]="customRewardType"
                  [options]="rewardTypes"
                  optionLabel="label"
                  optionValue="value"
                  appendTo="body"
                ></p-select>
              </div>
              <div class="form-group" style="flex: 0.8;">
                <label>{{ customRewardType === 'PERCENT_DISCOUNT' ? 'Porcentaje (%)' : 'Monto ($)' }}</label>
                <input
                  pInputText
                  type="number"
                  [(ngModel)]="customValor"
                  min="1"
                  max="100"
                  placeholder="20"
                />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group" style="flex: 2;">
                <label>Descripción del Beneficio</label>
                <input
                  pInputText
                  type="text"
                  [(ngModel)]="customDescripcion"
                  placeholder="Ej: 20% de descuento en el total de tu cuenta"
                />
              </div>
              <div class="form-group" style="flex: 0.8;">
                <label>Vigencia (Días)</label>
                <input
                  pInputText
                  type="number"
                  [(ngModel)]="customDiasVigencia"
                  min="1"
                  placeholder="60"
                />
              </div>
            </div>
          </div>

          <!-- Botón de acción -->
          <div class="assign-actions">
            <p-button
              label="Asignar Cupón"
              icon="pi pi-plus-circle"
              severity="success"
              styleClass="p-button-sm font-semibold"
              [loading]="asignandoCupon()"
              (onClick)="ejecutarAsignacion()"
            ></p-button>
          </div>
        </div>

        <!-- ================= SECCIÓN HISTORIAL DE CUPONES ================= -->
        <div class="coupons-list-section">
          <div class="section-title">
            <span>Cupones del Cliente</span>
            <span class="count-badge">{{ cupones().length }} asignados</span>
          </div>

          <!-- Cargando -->
          <div *ngIf="cargandoCupones()" class="text-center py-4">
            <p-progressSpinner strokeWidth="4" [style]="{ width: '40px', height: '40px' }"></p-progressSpinner>
            <p class="text-sm text-500 mt-2">Consultando cupones...</p>
          </div>

          <!-- Sin cupones -->
          <div *ngIf="!cargandoCupones() && cupones().length === 0" class="empty-coupons">
            <i class="pi pi-ticket"></i>
            <p class="font-medium">No tiene cupones registrados</p>
            <p class="text-xs text-500 mt-1">Usa el formulario superior para asignarle un cupón de descuento ahora mismo.</p>
          </div>

          <!-- Lista de cupones -->
          <div *ngIf="!cargandoCupones() && cupones().length > 0" class="coupons-grid">
            <div
              *ngFor="let coupon of cupones()"
              class="coupon-item-card"
              [ngClass]="{
                'status-active': coupon.status === 'ACTIVE' && !coupon.expired,
                'status-redeemed': coupon.status === 'REDEEMED',
                'status-expired': coupon.status === 'EXPIRED' || coupon.expired
              }"
            >
              <div class="coupon-left">
                <div class="coupon-code-wrap">
                  <span class="code-box">{{ coupon.code }}</span>
                  <button
                    type="button"
                    class="btn-copy"
                    pTooltip="Copiar código"
                    tooltipPosition="top"
                    (click)="copiarCodigo(coupon.code)"
                  >
                    <i class="pi pi-copy"></i>
                  </button>
                  <p-tag
                    [value]="getEstadoLabel(coupon)"
                    [severity]="getEstadoSeverity(coupon)"
                  ></p-tag>
                </div>

                <div class="campaign-title">
                  {{ coupon.campaignTitle || 'Campaña de Fidelización' }}
                </div>

                <div class="benefit-desc">
                  {{ coupon.rewardDescription || 'Descuento especial aplicable en comanda o chat virtual' }}
                </div>
              </div>

              <div class="coupon-right">
                <div class="discount-tag">
                  {{ formatBeneficio(coupon) }}
                </div>
                <div class="expiry-text">
                  <i class="pi pi-calendar"></i>
                  <span>Vence: {{ formatFecha(coupon.expiresAt) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </p-dialog>
  `
})
export class ClienteCuponesDialogComponent implements OnChanges {
  @Input() visible: boolean = false;
  @Input() cliente: Cliente | null = null;
  @Input() tenantId: number = 1;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() cuponAsignado = new EventEmitter<ClienteCouponDTO>();

  cupones = signal<ClienteCouponDTO[]>([]);
  campaniasOptions = signal<{ label: string; value: number }[]>([]);
  cargandoCupones = signal<boolean>(false);
  asignandoCupon = signal<boolean>(false);

  modoAsignacion: 'campania' | 'personalizado' = 'campania';
  selectedCampaniaId: number | null = null;

  // Formulario cupón personalizado
  customTitulo: string = 'Descuento 20% Especial';
  customRewardType: string = 'PERCENT_DISCOUNT';
  customValor: number = 20;
  customDescripcion: string = '20% de descuento en el total de tu consumo';
  customDiasVigencia: number = 60;

  rewardTypes = [
    { label: 'Porcentaje (%)', value: 'PERCENT_DISCOUNT' },
    { label: 'Monto Fijo ($)', value: 'FIXED_AMOUNT' }
  ];

  constructor(
    private clienteService: ClienteService,
    private messageService: MessageService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible && this.cliente?.id) {
      this.cargarDatos();
    }
  }

  cargarDatos(): void {
    if (!this.cliente?.id) return;

    this.cargandoCupones.set(true);

    // Cargar cupones del cliente
    this.clienteService.getCuponesByCliente(this.cliente.id).subscribe({
      next: (data) => {
        this.cupones.set(data || []);
        this.cargandoCupones.set(false);
      },
      error: () => {
        this.cargandoCupones.set(false);
      }
    });

    // Cargar campañas disponibles del tenant
    const tId = this.tenantId > 0 ? this.tenantId : 1;
    this.clienteService.getCampaniasDisponibles(tId).subscribe({
      next: (campaigns) => {
        const options = (campaigns || []).map((c: any) => {
          let desc = c.title || 'Campaña';
          if (c.promotionReward) {
            const r = c.promotionReward;
            if (r.rewardType === 'PERCENT_DISCOUNT' && r.numericValue) {
              desc += ` (${r.numericValue}% OFF)`;
            } else if (r.rewardType === 'FIXED_AMOUNT' && r.numericValue) {
              desc += ` ($${r.numericValue} OFF)`;
            }
          }
          return { label: desc, value: c.id };
        });
        this.campaniasOptions.set(options);
        if (options.length > 0 && !this.selectedCampaniaId) {
          this.selectedCampaniaId = options[0].value;
        }
      }
    });
  }

  ejecutarAsignacion(): void {
    if (!this.cliente?.id) return;

    const payload: AssignCouponPayload = {
      customerId: this.cliente.id
    };

    if (this.modoAsignacion === 'campania') {
      if (!this.selectedCampaniaId) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Atención',
          detail: 'Por favor selecciona una campaña para asignar el cupón.',
          life: 3000
        });
        return;
      }
      payload.campaignId = this.selectedCampaniaId;
    } else {
      if (!this.customValor || this.customValor <= 0) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Atención',
          detail: 'Ingresa un valor de descuento válido.',
          life: 3000
        });
        return;
      }
      payload.title = this.customTitulo || 'Descuento Especial';
      payload.rewardType = this.customRewardType;
      payload.discountValue = this.customValor;
      payload.description = this.customDescripcion || `${this.customValor}% de descuento`;
      payload.daysValid = this.customDiasVigencia || 60;
    }

    this.asignandoCupon.set(true);

    this.clienteService.asignarCupon(payload).subscribe({
      next: (nuevoCupon) => {
        this.asignandoCupon.set(false);
        this.messageService.add({
          severity: 'success',
          summary: '¡Cupón Asignado!',
          detail: `Código: ${nuevoCupon.code} asignado a ${this.cliente?.nombreCompleto}`,
          life: 4500
        });

        // Recargar cupones
        this.cargarDatos();
        this.cuponAsignado.emit(nuevoCupon);
      },
      error: (err) => {
        this.asignandoCupon.set(false);
        const errMsg = err?.error?.message || err?.message || 'No se pudo asignar el cupón';
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: errMsg,
          life: 5000
        });
      }
    });
  }

  copiarCodigo(codigo: string): void {
    if (!codigo) return;
    navigator.clipboard.writeText(codigo).then(() => {
      this.messageService.add({
        severity: 'info',
        summary: 'Copiado',
        detail: `Código ${codigo} copiado al portapapeles`,
        life: 2500
      });
    });
  }

  formatBeneficio(coupon: ClienteCouponDTO): string {
    if (coupon.numericValue && coupon.rewardType === 'PERCENT_DISCOUNT') {
      return `${coupon.numericValue}% OFF`;
    }
    if (coupon.numericValue && coupon.rewardType === 'FIXED_AMOUNT') {
      return `$${coupon.numericValue} OFF`;
    }
    return 'BENEFICIO';
  }

  formatFecha(fecha?: string): string {
    if (!fecha) return 'Sin fecha límite';
    try {
      const d = new Date(fecha);
      return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return fecha;
    }
  }

  getEstadoLabel(coupon: ClienteCouponDTO): string {
    if (coupon.expired || coupon.status === 'EXPIRED') return 'Expirado';
    if (coupon.status === 'REDEEMED') return 'Canjeado';
    if (coupon.status === 'CANCELLED') return 'Cancelado';
    return 'Activo';
  }

  getEstadoSeverity(coupon: ClienteCouponDTO): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' {
    if (coupon.expired || coupon.status === 'EXPIRED') return 'danger';
    if (coupon.status === 'REDEEMED') return 'secondary';
    if (coupon.status === 'CANCELLED') return 'warn';
    return 'success';
  }

  cerrar(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }
}
