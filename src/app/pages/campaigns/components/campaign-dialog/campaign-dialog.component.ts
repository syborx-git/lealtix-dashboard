import { Component, EventEmitter, Input, Output, OnInit, signal, OnChanges, SimpleChanges, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { MessageModule } from 'primeng/message';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectModule } from 'primeng/select';
import { CardModule } from 'primeng/card';
import { ChipModule } from 'primeng/chip';
import { DividerModule } from 'primeng/divider';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TouchTooltipDirective } from '@/shared/directives/touch-tooltip.directive';

import { CampaignResponse } from '@/models/campaign.model';
import { CampaignTemplate } from '@/models/campaign-template.model';
import { PromoType, CampaignStatus } from '@/models/enums';
import { CampaignTemplateService } from '../../services/campaign-template.service';
import { DateRangeValidator } from '../../utils/date-range.validator';

@Component({
  selector: 'app-campaign-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    MessageModule,
    CheckboxModule,
    SelectModule,
    CardModule,
    ChipModule,
    DividerModule,
    InputGroupModule,
    InputGroupAddonModule,
    TooltipModule,
    TouchTooltipDirective
  ],
  template: `
    <p-dialog
      [(visible)]="visible"
      [style]="{ width: '36rem', maxWidth: '90vw' }"
      [contentStyle]="{ 'max-height': 'calc(90vh - 120px)', 'overflow': 'auto' }"
      [header]="isEditMode ? 'Editar Campaña' : 'Nueva Campaña'"
      [modal]="true"
      [maximizable]="true"
      [resizable]="true"
      styleClass="campaign-dialog"
      contentStyleClass="campaign-dialog-content"
      (onHide)="onHide()">

      <ng-template pTemplate="content">
        <div class="campaign-form-container">

          <!-- Template selector (only for new campaigns) -->
          <div class="mb-4" *ngIf="!isEditMode && showTemplateSelector && templates().length > 0">
            <h4 class="text-lg font-semibold mb-3">Seleccionar Plantilla (Opcional)</h4>
            <div class="grid gap-3">
              <div class="col-12" *ngFor="let template of templates()">
                <p-card
                  class="cursor-pointer h-full"
                  [class.border-primary]="selectedTemplateId() === template.id"
                  (click)="selectTemplate(template)">
                  <div class="flex justify-content-between align-items-center">
                    <div>
                      <h5 class="mt-0 mb-1">{{ template.name }}</h5>
                      <p class="text-sm text-500 mb-0">{{ template.defaultTitle }}</p>
                    </div>
                    <div class="flex align-items-center gap-2">
                      <p-chip
                        [label]="template.defaultPromoType || 'Custom'"
                        size="small"
                        styleClass="p-chip-outlined">
                      </p-chip>
                      <i class="pi pi-check text-primary"
                         *ngIf="selectedTemplateId() === template.id">
                      </i>
                    </div>
                  </div>
                </p-card>
              </div>
            </div>
            <p-divider></p-divider>
          </div>

          <!-- Campaign form -->
          <form [formGroup]="campaignForm" class="space-y-4">

            <!-- Información básica -->
            <div>
              <h4 class="text-lg font-semibold mb-3">Información Básica</h4>

              <div class="space-y-4">
                <div>
                  <div class="flex align-items-center gap-2 mb-2">
                    <label for="title" class="field-label">
                      Título <span class="text-red-500">*</span>
                    </label>
                    <button
                      pButton
                      type="button"
                      icon="pi pi-info-circle"
                      class="p-button-sm p-button-text p-button-plain info-button"
                      pTooltip="Un mensaje claro y emocional que resalte la propuesta de valor."
                      tooltipPosition="top"
                      appTouchTooltip
                    ></button>
                  </div>
                  <input
                    id="title"
                    type="text"
                    pInputText
                    formControlName="title"
                    placeholder="Escribe el título"
                    class="w-full"
                    [class.p-invalid]="isFieldInvalid('title')"
                    autofocus
                  />
                  <p-message
                    *ngIf="campaignForm.get('title')?.errors?.['required'] && campaignForm.get('title')?.touched"
                    severity="error"
                    [text]="'El título es requerido'">
                  </p-message>
                  <p-message
                    *ngIf="campaignForm.get('title')?.errors?.['minlength'] && campaignForm.get('title')?.touched"
                    severity="error"
                    [text]="'El título debe tener al menos 3 caracteres'">
                  </p-message>
                </div>

                <div>
                  <div class="flex align-items-center gap-2 mb-2">
                    <label for="subtitle" class="field-label">Subtítulo</label>
                    <button
                      pButton
                      type="button"
                      icon="pi pi-info-circle"
                      class="p-button-sm p-button-text p-button-plain info-button"
                      pTooltip="Añade un contexto breve que apoye al título sin repetirlo."
                      tooltipPosition="top"
                      appTouchTooltip
                    ></button>
                  </div>
                  <input
                    id="subtitle"
                    type="text"
                    pInputText
                    formControlName="subtitle"
                    placeholder="Subtítulo (opcional)"
                    class="w-full"
                  />
                </div>

                <div>
                  <div class="flex items-center gap-2 mb-2">
                    <label for="description" class="block font-medium">Descripción</label>
                    <button
                      pButton
                      type="button"
                      icon="pi pi-info-circle"
                      class="p-button-rounded p-button-sm p-button-text text-primary-600"
                      pTooltip="Explica el beneficio, duración y cómo se entrega la promoción."
                      tooltipPosition="top"
                      appTouchTooltip
                      aria-label="Descripción del campo descripción"
                    ></button>
                  </div>
                  <textarea
                    id="description"
                    pTextarea
                    formControlName="description"
                    rows="3"
                    placeholder="Describe la campaña"
                    class="w-full"
                  ></textarea>
                </div>
              </div>
            </div>

            <!-- Promoción -->
            <div>
              <h4 class="text-lg font-semibold mb-3">Configuración de Promoción</h4>

              <div class="space-y-4">
                <div>
                  <div class="flex items-center gap-2 mb-2">
                    <label for="promoType" class="block font-medium">Tipo de Promoción</label>
                    <button
                      pButton
                      type="button"
                      icon="pi pi-info-circle"
                      class="p-button-rounded p-button-sm p-button-text text-primary-600"
                      pTooltip="Elige cómo quieres premiar a tu cliente: porcentaje, monto fijo o regalo."
                      tooltipPosition="top"
                      appTouchTooltip
                      aria-label="Descripción del campo tipo de promoción"
                    ></button>
                  </div>
                  <p-select
                    id="promoType"
                    formControlName="promoType"
                    [options]="promoTypeOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Seleccionar tipo"
                    styleClass="w-full"
                    (onChange)="onPromoTypeChange()"
                  ></p-select>
                </div>

                <div *ngIf="shouldShowPromoValue()">
                  <div class="flex items-center gap-2 mb-2">
                    <label for="promoValue" class="block font-medium">
                      {{ getPromoValueLabel() }}
                    </label>
                    <button
                      pButton
                      type="button"
                      icon="pi pi-info-circle"
                      class="p-button-rounded p-button-sm p-button-text text-primary-600"
                      pTooltip="Cantidad o porcentaje que se aplicará en la promoción."
                      tooltipPosition="top"
                      appTouchTooltip
                      aria-label="Descripción del campo valor de promoción"
                    ></button>
                  </div>
                  <div class="p-inputgroup">
                    <span class="p-inputgroup-addon" *ngIf="getPromoValuePrefix()">
                      {{ getPromoValuePrefix() }}
                    </span>
                    <input
                      id="promoValue"
                      type="text"
                      pInputText
                      formControlName="promoValue"
                      class="w-full"
                      [placeholder]="getPromoValuePlaceholder()"
                      pTooltip="Cantidad o porcentaje que se aplicará en la promoción."
                      tooltipPosition="top"
                    />
                    <span class="p-inputgroup-addon" *ngIf="getPromoValueSuffix()">
                      {{ getPromoValueSuffix() }}
                    </span>
                  </div>
                  <p-message
                    *ngIf="campaignForm.get('promoValue')?.errors?.['promoValue']"
                    severity="error"
                    variant="text"
                    size="small">
                    {{ campaignForm.get('promoValue')?.errors?.['promoValue']?.message }}
                  </p-message>
                </div>

                <div>
                  <div class="flex items-center gap-2 mb-2">
                    <label for="callToAction" class="block font-medium">Call to Action</label>
                    <button
                      pButton
                      type="button"
                      icon="pi pi-info-circle"
                      class="p-button-rounded p-button-sm p-button-text text-primary-600"
                      pTooltip="Texto breve que indique la acción que deseas que haga tu cliente."
                      tooltipPosition="top"
                      appTouchTooltip
                      aria-label="Descripción del campo call to action"
                    ></button>
                  </div>
                  <input
                    id="callToAction"
                    type="text"
                    pInputText
                    formControlName="callToAction"
                    placeholder="Ej: ¡Aprovecha ahora!"
                    class="w-full"
                  />
                </div>
              </div>
            </div>

            <!-- Programación -->
            <div>
              <h4 class="text-lg font-semibold mb-3">Programación</h4>

              <div class="space-y-4">
                <div>
                  <div class="flex items-center gap-2 mb-2">
                    <label for="startDate" class="block font-medium">
                      Fecha de inicio <span class="text-red-500">*</span>
                    </label>
                    <button
                      pButton
                      type="button"
                      icon="pi pi-info-circle"
                      class="p-button-rounded p-button-sm p-button-text text-primary-600"
                      pTooltip="Fecha en la que la campaña comenzará a ser visible."
                      tooltipPosition="top"
                      appTouchTooltip
                      aria-label="Descripción del campo fecha de inicio"
                    ></button>
                  </div>
                  <input
                    id="startDate"
                    type="date"
                    pInputText
                    formControlName="startDate"
                    class="w-full"
                    [class.p-invalid]="isFieldInvalid('startDate')"
                  />
                  <p-message
                    *ngIf="isFieldInvalid('startDate')"
                    severity="error"
                    variant="text"
                    size="small">
                    {{ campaignForm.get('startDate')?.errors?.['futureDate']?.message || 'La fecha de inicio es inválida' }}
                  </p-message>
                </div>

                <div>
                  <div class="flex items-center gap-2 mb-2">
                    <label for="endDate" class="block font-medium">Fecha de fin</label>
                    <button
                      pButton
                      type="button"
                      icon="pi pi-info-circle"
                      class="p-button-rounded p-button-sm p-button-text text-primary-600"
                      pTooltip="Si la campaña termina en una fecha específica, indícala aquí."
                      tooltipPosition="top"
                      appTouchTooltip
                      aria-label="Descripción del campo fecha de fin"
                    ></button>
                  </div>
                  <input
                    id="endDate"
                    type="date"
                    pInputText
                    formControlName="endDate"
                    class="w-full"
                    [class.p-invalid]="isFieldInvalid('endDate') || (campaignForm.errors && campaignForm.errors['dateRange'])"
                  />
                  <p-message
                    *ngIf="isFieldInvalid('endDate')"
                    severity="error"
                    variant="text"
                    size="small">
                    La fecha de fin es inválida
                  </p-message>
                  <p-message
                    *ngIf="campaignForm.errors?.['dateRange']"
                    severity="error"
                    variant="text"
                    size="small">
                    {{ campaignForm.errors?.['dateRange']?.message }}
                  </p-message>
                </div>
              </div>
            </div>

            <!-- Distribución -->
            <div>
              <h4 class="text-lg font-semibold mb-3">Distribución</h4>

              <div class="space-y-4">
                <div>
                  <div class="flex items-center gap-2 mb-2">
                    <label for="channels" class="block font-medium">Canales</label>
                    <button
                      pButton
                      type="button"
                      icon="pi pi-info-circle"
                      class="p-button-rounded p-button-sm p-button-text text-primary-600"
                      pTooltip="Sepáralos por comas y piensa en dónde interactúa tu audiencia."
                      tooltipPosition="top"
                      appTouchTooltip
                      aria-label="Descripción del campo canales"
                    ></button>
                  </div>
                  <input
                    id="channels"
                    type="text"
                    pInputText
                    placeholder="Email, SMS, App"
                    (blur)="onChannelsChange($event)"
                    class="w-full"
                  />
                  <p-message
                    *ngIf="campaignForm.get('channels')?.invalid && campaignForm.get('channels')?.touched"
                    severity="error"
                    variant="text"
                    size="small">
                    Agrega al menos un canal
                  </p-message>
                  <small class="text-500">Escribe los canales separados por coma</small>
                </div>

                <div>
                  <div class="flex items-center gap-2 mb-2">
                    <label for="segmentation" class="block font-medium">Segmentación</label>
                    <button
                      pButton
                      type="button"
                      icon="pi pi-info-circle"
                      class="p-button-rounded p-button-sm p-button-text text-primary-600"
                      pTooltip="Describe el perfil al que dedicas esta campaña."
                      tooltipPosition="top"
                      appTouchTooltip
                      aria-label="Descripción del campo segmentación"
                    ></button>
                  </div>
                  <input
                    id="segmentation"
                    type="text"
                    pInputText
                    formControlName="segmentation"
                    placeholder="Ej: Clientes premium"
                    class="w-full"
                  />
                </div>
              </div>
            </div>

            <!-- Imagen -->
            <div>
              <h4 class="text-lg font-semibold mb-3">Imagen</h4>

              <div>
                <div class="flex items-center gap-2 mb-2">
                  <label for="imageUrl" class="block font-medium">URL de Imagen</label>
                  <button
                    pButton
                    type="button"
                    icon="pi pi-info-circle"
                    class="p-button-rounded p-button-sm p-button-text text-primary-600"
                    pTooltip="Enlaza una imagen representativa para apoyar la campaña."
                    tooltipPosition="top"
                    appTouchTooltip
                    aria-label="Descripción del campo URL de imagen"
                  ></button>
                </div>
                <input
                  id="imageUrl"
                  type="text"
                  pInputText
                  formControlName="imageUrl"
                  placeholder="https://ejemplo.com/imagen.jpg"
                  class="w-full"
                />
                <!-- Preview de imagen -->
                <div class="mt-3" *ngIf="imagePreview()">
                  <img
                    [src]="imagePreview()"
                    alt="Preview"
                    class="border-round border-1 border-gray-200"
                    (error)="onImageError()"
                    style="max-width:200px; max-height:150px; object-fit: contain;"
                  />
                </div>
              </div>
            </div>

            <!-- Estado (solo en modo edición) -->
            <div *ngIf="isEditMode">
              <h4 class="text-lg font-semibold mb-3">Estado</h4>

              <div class="space-y-4">
                <div>
                  <div class="flex items-center gap-2 mb-2">
                    <label for="status" class="block font-medium">Estado de la Campaña</label>
                    <button
                      pButton
                      type="button"
                      icon="pi pi-info-circle"
                      class="p-button-rounded p-button-sm p-button-text text-primary-600"
                      pTooltip="Define si la campaña está activa o en borrador según necesites."
                      tooltipPosition="top"
                      aria-label="Descripción del campo estado"
                    ></button>
                  </div>
                  <p-select
                    id="status"
                    formControlName="status"
                    [options]="statusOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Seleccionar estado"
                    styleClass="w-full"
                  ></p-select>
                </div>
              </div>
            </div>

            <!-- Configuración automática -->
            <div>
              <div class="flex align-items-center gap-3">
                <p-checkbox
                  formControlName="isAutomatic"
                  binary="true"
                  inputId="isAutomatic">
                </p-checkbox>
                <div class="flex align-items-center gap-1">
                  <label for="isAutomatic" class="mb-0">Campaña automática</label>
                  <button
                    pButton
                    type="button"
                    icon="pi pi-info-circle"
                    class="p-button-rounded p-button-sm p-button-text text-primary-600"
                    pTooltip="Actívala para que la plataforma envíe la campaña sin intervención manual."
                    tooltipPosition="top"
                    appTouchTooltip
                    aria-label="Descripción del campo campaña automática"
                  ></button>
                </div>
              </div>
              <small class="block text-500 mt-1">
                La campaña se ejecutará automáticamente según las reglas definidas
              </small>
            </div>

          </form>
        </div>
      </ng-template>

      <ng-template pTemplate="footer">
        <div class="campaign-dialog-footer">
          <p-button
            label="Cancelar"
            icon="pi pi-times"
            severity="secondary"
            [outlined]="true"
            (onClick)="hide.emit()"
          />
          <p-button
            [label]="isEditMode ? 'Actualizar' : 'Guardar'"
            icon="pi pi-check"
            severity="success"
            [loading]="saving()"
            [disabled]="campaignForm.invalid"
            (onClick)="save.emit()"
          />
        </div>
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    /* === DIÁLOGO CAMPAÑA (homologado) === */
    ::ng-deep .campaign-dialog .p-dialog-header {
      background: linear-gradient(135deg, var(--lealtix-primary-500, #6366f1) 0%, var(--lealtix-primary-600, #4f46e5) 100%);
      color: white;
      padding: 1.25rem 1.5rem;
      border-radius: var(--lealtix-radius-xl) var(--lealtix-radius-xl) 0 0;
    }

    .campaign-dialog-content { padding: 0 !important; }

    .campaign-form-container { padding: 1.5rem; }

    .field-label {
      font-weight: 600;
      color: var(--lealtix-slate-800);
      display: block;
    }

    ::ng-deep .info-button {
      width: 2rem !important;
      height: 2rem !important;
      padding: 0 !important;
      color: var(--lealtix-primary-500) !important;
    }

    ::ng-deep .p-inputtext,
    ::ng-deep .p-inputtextarea {
      border-radius: var(--lealtix-radius-md) !important;
      border-color: var(--lealtix-slate-300) !important;
    }

    ::ng-deep .p-message {
      margin-top: 0.5rem;
    }

    .campaign-dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      border-top: 1px solid var(--lealtix-slate-200);
      background: var(--lealtix-slate-50);
    }

    .border-primary {
      border: 2px solid var(--lealtix-primary-500) !important;
      box-shadow: 0 0 0 3px var(--lealtix-primary-50) !important;
    }

    .cursor-pointer {
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .cursor-pointer:hover {
      transform: translateY(-2px);
      box-shadow: var(--lealtix-shadow-md);
    }

    .space-y-4 > :not([hidden]) ~ :not([hidden]) {
      margin-top: 1rem;
    }

    h4 {
      color: var(--lealtix-slate-800);
      font-weight: 700;
      margin-bottom: 1rem;
    }
  `]
})
export class CampaignDialogComponent implements OnInit, OnChanges {
  @Input() visible: boolean = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  @Input() campaign: CampaignResponse | null = null;
  @Input() submitted: boolean = false;
  @Input() isEditMode: boolean = false;
  @Input() initialTemplateId?: number;
  @Input() showTemplateSelector = true;

  @Output() save = new EventEmitter<void>();
  @Output() hide = new EventEmitter<void>();

  campaignForm: FormGroup;
  templates = signal<CampaignTemplate[]>([]);
  selectedTemplateId = signal<number | null>(null);
  saving = signal<boolean>(false);
  imagePreview = signal<string>('');

  private destroyRef = inject(DestroyRef);

  promoTypeOptions = [
    { label: 'Descuento porcentual', value: PromoType.DISCOUNT },
    { label: 'Descuento por monto', value: PromoType.AMOUNT },
    { label: 'Compra uno lleva otro', value: PromoType.BOGO },
    { label: 'Artículo gratuito', value: PromoType.FREE_ITEM },
    { label: 'Promoción personalizada', value: PromoType.CUSTOM }
  ];

  statusOptions = [
    { label: 'Borrador', value: CampaignStatus.DRAFT },
    { label: 'Activa', value: CampaignStatus.ACTIVE },
    { label: 'Inactiva', value: CampaignStatus.INACTIVE },
    { label: 'Programada', value: CampaignStatus.SCHEDULED }
  ];

  constructor(
    private fb: FormBuilder,
    private campaignTemplateService: CampaignTemplateService,
    private messageService: MessageService
  ) {
    this.campaignForm = this.createForm();
  }

  ngOnInit(): void {
    this.loadTemplates();
    this.setupImagePreview();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['campaign'] && this.campaign) {
      this.populateFormWithCampaign(this.campaign);
    }

    // Auto-apply template if initialTemplateId is provided
    if (changes['initialTemplateId'] && this.initialTemplateId && this.templates().length > 0) {
      const template = this.templates().find(t => t.id === this.initialTemplateId);
      if (template) {
        this.selectTemplate(template);
      }
    }

    // If templates loaded after initialTemplateId was set, apply it
    if (changes['templates'] && this.initialTemplateId && this.templates().length > 0) {
      const template = this.templates().find(t => t.id === this.initialTemplateId);
      if (template) {
        this.selectTemplate(template);
      }
    }
  }

  onHide(): void {
    this.visibleChange.emit(false);
    this.hide.emit();
  }

  // Helper para templates: checa si un campo del form es inválido y fue tocado
  isFieldInvalid(fieldName: string): boolean {
    const control = this.campaignForm.get(fieldName);
    return !!(control && control.invalid && (control.touched || control.dirty));
  }

  private createForm(): FormGroup {
    return this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      subtitle: [''],
      description: [''],
      promoType: [''],
      promoValue: [''],
      callToAction: [''],
      startDate: [''],
      endDate: [''],
      channels: [[]],
      segmentation: [''],
      imageUrl: [''],
      status: [CampaignStatus.DRAFT],
      isAutomatic: [false]
    }, {
      validators: [DateRangeValidator.dateRange, DateRangeValidator.promoValue]
    });
  }

  private loadTemplates(): void {
    this.campaignTemplateService.getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (templates) => {
          this.templates.set(templates.filter(t => t.active !== false));

          // Apply initial template if provided
          if (this.initialTemplateId) {
            const template = templates.find(t => t.id === this.initialTemplateId);
            if (template) {
              this.selectTemplate(template);
            }
          }
        },
        error: (error) => {
          console.error('Error loading templates:', error);
        }
      });
  }

  private populateFormWithCampaign(campaign: CampaignResponse): void {
    this.campaignForm.patchValue({
      title: campaign.title,
      subtitle: campaign.subtitle,
      description: campaign.description,
      promoType: campaign.promoType,
      promoValue: campaign.promoValue,
      callToAction: campaign.callToAction,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      channels: campaign.channels || [],
      segmentation: campaign.segmentation,
      imageUrl: campaign.imageUrl,
      status: campaign.status,
      isAutomatic: campaign.isAutomatic
    });
  }

  private setupImagePreview(): void {
    this.campaignForm.get('imageUrl')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(url => {
        this.imagePreview.set(url || '');
      });
  }

  selectTemplate(template: CampaignTemplate): void {
    this.selectedTemplateId.set(template.id!);
    this.applyTemplate(template);
  }

  private applyTemplate(template: CampaignTemplate): void {
    this.campaignForm.patchValue({
      title: template.defaultTitle || '',
      subtitle: template.defaultSubtitle || '',
      description: template.defaultDescription || '',
      promoType: template.defaultPromoType || '',
      imageUrl: template.defaultImageUrl || ''
    });
  }

  onPromoTypeChange(): void {
    const promoType = this.campaignForm.get('promoType')?.value;
    const promoValueControl = this.campaignForm.get('promoValue');

    // Reset promo value when type changes
    promoValueControl?.setValue('');

    // Add/remove validators based on type
    if (this.shouldShowPromoValue()) {
      promoValueControl?.setValidators([Validators.required]);
    } else {
      promoValueControl?.clearValidators();
    }

    promoValueControl?.updateValueAndValidity();
  }

  shouldShowPromoValue(): boolean {
    const promoType = this.campaignForm.get('promoType')?.value;
    return promoType === PromoType.DISCOUNT || promoType === PromoType.AMOUNT || promoType === PromoType.CUSTOM;
  }

  getPromoValueLabel(): string {
    const promoType = this.campaignForm.get('promoType')?.value;
    switch (promoType) {
      case PromoType.DISCOUNT: return 'Porcentaje de Descuento';
      case PromoType.AMOUNT: return 'Monto de Descuento';
      case PromoType.CUSTOM: return 'Descripción de la Promoción';
      default: return 'Valor';
    }
  }

  getPromoValuePrefix(): string {
    const promoType = this.campaignForm.get('promoType')?.value;
    return promoType === PromoType.AMOUNT ? '$' : '';
  }

  getPromoValueSuffix(): string {
    const promoType = this.campaignForm.get('promoType')?.value;
    return promoType === PromoType.DISCOUNT ? '%' : '';
  }

  getPromoValuePlaceholder(): string {
    const promoType = this.campaignForm.get('promoType')?.value;
    switch (promoType) {
      case PromoType.DISCOUNT: return '10';
      case PromoType.AMOUNT: return '1000';
      case PromoType.CUSTOM: return 'Descripción de la promoción';
      default: return '';
    }
  }

  onImageError(): void {
    this.imagePreview.set('');
  }

  onChannelsChange(event: any): void {
    const value = event.target.value;
    if (value.trim()) {
      const channels = value.split(',').map((c: string) => c.trim()).filter((c: string) => c);
      this.campaignForm.patchValue({ channels });
      event.target.value = '';
    }
  }

  getFormValue() {
    return this.campaignForm.value;
  }

  getSelectedTemplateId() {
    return this.selectedTemplateId();
  }

  setSaving(value: boolean) {
    this.saving.set(value);
  }
}
