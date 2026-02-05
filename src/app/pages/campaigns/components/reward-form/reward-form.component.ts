import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Select } from 'primeng/select';
import { TreeSelect } from 'primeng/treeselect';
import { InputNumber } from 'primeng/inputnumber';
import { Textarea } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';
import { Message } from 'primeng/message';
import { RewardType } from '@/models/enums';
import { CreateRewardRequest, RewardResponse } from '../../models/reward.model';
import { ConfigureRewardRequest } from '@/models/update-campaign-request';
import { CampaignService } from '../../services/campaign.service';
import { CatalogService } from '../../services/catalog.service';
import { TreeNode } from 'primeng/api';

@Component({
  selector: 'app-reward-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    Select,
    TreeSelect,
    FormsModule,
    InputNumber,
    Textarea,
    TooltipModule,
    Message
  ],
  templateUrl: './reward-form.component.html',
  styleUrls: ['./reward-form.component.scss']
})
export class RewardFormComponent implements OnInit, OnChanges {
  @Input() campaignId?: number;
  @Input() existingReward?: RewardResponse;
  @Input() tenantId?: number;
  @Output() saved = new EventEmitter<RewardResponse>();
  @Output() cancelled = new EventEmitter<void>();
  @Output() pending = new EventEmitter<CreateRewardRequest>();
  @Output() rewardDataChanged = new EventEmitter<CreateRewardRequest>();

  private fb = inject(FormBuilder);
  private campaignService = inject(CampaignService);
  private catalogService = inject(CatalogService);
  private messageService = inject(MessageService);

  rewardForm!: FormGroup;
  // Product/category tree for TreeSelect
  productTree: TreeNode[] = [];
  selectedProductKey: any = null;
  isLoadingProducts = false;
  private lastLoadedTenantId: number | null = null;
  private isUpdatingValidators = false;
  rewardTypes = [
    { label: 'Descuento porcentual', value: RewardType.PERCENT_DISCOUNT },
    { label: 'Monto fijo', value: RewardType.FIXED_AMOUNT },
    { label: 'Personalizado / Solo promoción', value: RewardType.CUSTOM }
  ];

  isSubmitting = false;
  isEditMode = false;
  @ViewChild('rewardTypeSelect') rewardTypeSelect!: Select;
  @ViewChild('rewardTypeSelect', { read: ElementRef }) rewardTypeSelectElement!: ElementRef;

  public focusRewardType(): void {
    // Allow the view to settle, then scroll to the component, open the dropdown and mark as touched
    setTimeout(() => {
      try {
        // Scroll to the select element so it's visible
        if (this.rewardTypeSelectElement?.nativeElement) {
          this.rewardTypeSelectElement.nativeElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }

        // Mark the field as touched to show the validation message
        this.rewardForm.get('rewardType')?.markAsTouched();

        // Do not automatically open the dropdown; only mark touched and scroll into view
        // (previous behavior called this.rewardTypeSelect.show())
      } catch (e) {
        console.warn('Unable to open reward select dropdown', e);
      }
    }, 300);
  }

  ngOnInit(): void {
    this.initForm();
    this.setupFormListeners();
    if (this.existingReward) {
      this.loadExistingReward(this.existingReward);
    }
    // Solo cargar si tenantId está disponible y es válido
    if (this.tenantId && Number(this.tenantId) > 0) {
      this.loadProductTree(this.tenantId);
    }
  }

  /**
   * Load product tree from backend using CatalogService.
   * Falls back to mock data if tenantId not provided or request fails.
   * Prevents duplicate loads for the same tenantId.
   */
  private loadProductTree(tenantId?: number): void {
    // Prevenir cargas duplicadas para el mismo tenantId
    if (this.isLoadingProducts || this.lastLoadedTenantId === tenantId) {
      console.debug('[reward-form] Product tree already loaded or loading for tenantId:', tenantId);
      return;
    }

    if (tenantId && Number(tenantId) > 0) {
      this.isLoadingProducts = true;
      this.lastLoadedTenantId = tenantId;
      this.catalogService.getCategoriesWithProducts(tenantId).subscribe({
        next: (categories) => {
          this.productTree = this.catalogService.mapToTreeNodes(categories);
          this.isLoadingProducts = false;
          console.debug('[reward-form] product tree loaded successfully', this.productTree);
        },
        error: (err) => {
          this.isLoadingProducts = false;
          console.warn('[reward-form] Failed to load product tree from backend, using mock data', err);
          this.loadMockProductTree();
        }
      });
    } else {
      this.loadMockProductTree();
    }
  }

  // Load simulated categories + products
  private loadMockProductTree(): void {
    // Example structure: categories with children products; keys are product IDs
    // Categories are NOT selectable; only products can be selected
    this.productTree = [
    {
      label: 'Bebidas',
      key: 'cat-1',
      selectable: false,
      children: [
        { label: 'Café Americano', key: '101', selectable: true },
        { label: 'Latte', key: '102', selectable: true },
        { label: 'Cappuccino', key: '103', selectable: true }
      ]
    },
    {
      label: 'Postres',
      key: 'cat-2',
      selectable: false,
      children: [
        { label: 'Tarta de Chocolate', key: '201', selectable: true },
        { label: 'Cheesecake', key: '202', selectable: true }
      ]
    },
    {
      label: 'Bocadillos',
      key: 'cat-3',
      selectable: false,
      children: [
        { label: 'Sándwich Club', key: '301', selectable: true },
        { label: 'Wrap de Pollo', key: '302', selectable: true }
      ]
    }
  ];
  }

  // Handle selection from TreeSelect: store numeric productId in the form
  onProductTreeSelect(event: any): void {
    let val = event;
    if (event && typeof event === 'object') {
      val = event.value !== undefined ? event.value : event;
    }

    // Some TreeSelect payloads provide the node object with `key`, others the raw key value
    const rawKey = (val && typeof val === 'object' && val.key !== undefined) ? val.key : val;

    // Ensure numeric conversion (handles "55" -> 55)
    const productId = typeof rawKey === 'number' ? rawKey : Number(rawKey);

    if (!isNaN(productId) && productId > 0) {
      this.rewardForm.get('productId')?.setValue(productId);
      // selectionMode="single" expects scalar model value
      this.selectedProductKey = String(productId);
      console.log('[RewardForm] Product selected - ID:', productId, 'selectedProductKey:', this.selectedProductKey);
    } else {
      this.rewardForm.get('productId')?.setValue(null);
      this.selectedProductKey = null;
      console.warn('[RewardForm] Invalid product ID received:', rawKey);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['existingReward'] && this.rewardForm) {
      if (this.existingReward) {
        this.loadExistingReward(this.existingReward);
      } else {
        // Si existingReward se vuelve null/undefined, resetear el formulario
        this.isEditMode = false;
        this.rewardForm.reset();
      }
    }
  }

  private loadExistingReward(reward: RewardResponse): void {
    this.isEditMode = true;
    this.rewardForm.patchValue({
      rewardType: reward.rewardType,
      numericValue: reward.numericValue,
      productId: reward.productId,
      buyQuantity: reward.buyQuantity,
      freeQuantity: reward.freeQuantity,
      description: reward.description,
      minPurchaseAmount: reward.minPurchaseAmount,
      usageLimit: reward.usageLimit
    });
    if (reward.productId) {
      this.selectedProductKey = reward.productId.toString();
    }
  }

  private initForm(): void {
    this.rewardForm = this.fb.group({
      rewardType: [null, Validators.required],
      numericValue: [null],
      productId: [null],
      buyQuantity: [null],
      freeQuantity: [null],
      description: ['', [Validators.required, Validators.maxLength(500)]],
      minPurchaseAmount: [null],
      usageLimit: [1]
    });
  }

  private setupFormListeners(): void {
    this.rewardForm.get('rewardType')?.valueChanges.subscribe((type: RewardType) => {
      console.log('[RewardForm] rewardType changed ->', type, 'typeof:', typeof type);
      this.updateValidators(type);
      this.emitRewardDataIfValid();

      // When FREE_PRODUCT is selected, load the product tree from backend
      if (type === RewardType.FREE_PRODUCT || String(type) === RewardType.FREE_PRODUCT) {
        this.loadProductTree(this.tenantId);
      }
    });

    // Emit changes on any form value change (skip if updating validators to avoid infinite loop)
    this.rewardForm.valueChanges.subscribe(() => {
      if (!this.isUpdatingValidators) {
        this.emitRewardDataIfValid();
      }
    });
  }

  private emitRewardDataIfValid(): void {
    if (this.rewardForm.valid) {
      const request = this.buildRequest();
      this.rewardDataChanged.emit(request);
    }
  }

  private updateValidators(rewardType: RewardType): void {
    // Prevenir actualizaciones en cascada
    if (this.isUpdatingValidators) {
      return;
    }

    this.isUpdatingValidators = true;

    try {
      // Limpiar todos los validadores
      Object.keys(this.rewardForm.controls).forEach(key => {
        // Keep description validator globally required; do not clear it here
        if (key !== 'rewardType' && key !== 'description') {
          this.rewardForm.get(key)?.clearValidators();
          this.rewardForm.get(key)?.setValue(null, { emitEvent: false });
        }
      });

      // Si es NONE, limpiar también la descripción
      if (rewardType === RewardType.NONE) {
        this.rewardForm.get('description')?.clearValidators();
        this.rewardForm.get('description')?.setValue('Sin beneficio - Solo promoción', { emitEvent: false });
      } else {
        // Aplicar validadores según el tipo de reward
        switch (rewardType) {
          case RewardType.PERCENT_DISCOUNT:
            this.rewardForm.get('numericValue')?.setValidators([Validators.required, Validators.min(0), Validators.max(100)]);
            break;
          case RewardType.FIXED_AMOUNT:
            this.rewardForm.get('numericValue')?.setValidators([Validators.required, Validators.min(0)]);
            break;
          case RewardType.FREE_PRODUCT:
            this.rewardForm.get('productId')?.setValidators([Validators.required]);
            break;
          case RewardType.BUY_X_GET_Y:
            this.rewardForm.get('buyQuantity')?.setValidators([Validators.required, Validators.min(1)]);
            this.rewardForm.get('freeQuantity')?.setValidators([Validators.required, Validators.min(1)]);
            break;
          case RewardType.CUSTOM:
            this.rewardForm.get('description')?.setValidators([Validators.required]);
            break;
        }
      }

      // Actualizar el estado de validación sin emitir eventos
      Object.keys(this.rewardForm.controls).forEach(key => {
        this.rewardForm.get(key)?.updateValueAndValidity({ emitEvent: false });
      });
    } finally {
      this.isUpdatingValidators = false;
    }
  }

  get selectedRewardType(): RewardType | null {
    return this.rewardForm.get('rewardType')?.value;
  }

  /**
   * Método público para obtener el rewardType seleccionado actualmente
   * Útil para obtener el valor incluso cuando es NONE (que no retorna reward data)
   */
  public getSelectedRewardType(): RewardType | null {
    return this.rewardForm.get('rewardType')?.value;
  }

  get showNumericValue(): boolean {
    return this.selectedRewardType === RewardType.PERCENT_DISCOUNT ||
           this.selectedRewardType === RewardType.FIXED_AMOUNT;
  }

  get showProductId(): boolean {
    return this.selectedRewardType === RewardType.FREE_PRODUCT;
  }

  get showBuyGetQuantities(): boolean {
    return this.selectedRewardType === RewardType.BUY_X_GET_Y;
  }

  get showDescription(): boolean {
    return this.selectedRewardType === RewardType.CUSTOM;
  }

  get numericValueLabel(): string {
    if (this.selectedRewardType === RewardType.PERCENT_DISCOUNT) {
      return 'Porcentaje de descuento (%)';
    }
    if (this.selectedRewardType === RewardType.FIXED_AMOUNT) {
      return 'Monto fijo ($)';
    }
    return 'Valor';
  }

  // Public method to get reward data for parent component
  public getRewardData(): CreateRewardRequest | null {
    // Si el tipo es NONE, no hay reward data
    if (this.rewardForm.get('rewardType')?.value === RewardType.NONE) {
      return null;
    }

    if (this.rewardForm.valid) {
      return this.buildRequest();
    }
    return null;
  }

  // Public method to check if reward form has valid data
  public hasValidRewardData(): boolean {
    // Si el tipo es NONE, no hay reward data
    if (this.rewardForm.get('rewardType')?.value === RewardType.NONE) {
      return false;
    }
    return this.rewardForm.valid && this.rewardForm.get('rewardType')?.value !== null;
  }

  onSubmit(): void {
    if (this.rewardForm.invalid) {
      this.rewardForm.markAllAsTouched();

      // Mensaje específico si falta el tipo de beneficio
      if (this.rewardForm.get('rewardType')?.invalid) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Falta seleccionar tipo de beneficio',
          detail: 'Debes seleccionar el tipo de beneficio que recibirán tus clientes',
          life: 5000
        });
      } else {
        this.messageService.add({
          severity: 'warn',
          summary: 'Formulario incompleto',
          detail: 'Por favor completa todos los campos requeridos',
          life: 4000
        });
      }
      return;
    }
this.isSubmitting = true;
    const request: CreateRewardRequest = this.buildRequest();

    // Si es modo edición y existe un reward, actualizar
    if (this.isEditMode && this.existingReward?.id) {
      this.updateReward(this.existingReward.id, request);
    } else if (this.campaignId) {
      // Si no es edición pero hay campaignId, crear nuevo reward
      this.createReward(this.campaignId, request);
    } else {
      // If no campaignId is provided (we're creating a campaign), emit the pending reward
      this.isSubmitting = false;
      this.pending.emit(request);
      this.messageService.add({
        severity: 'info',
        summary: 'Beneficio pendiente',
        detail: 'El beneficio se guardará automáticamente después de crear la campaña',
        life: 5000
      });
    }
  }

  private createReward(campaignId: number, request: CreateRewardRequest): void {
    this.campaignService.createReward(campaignId, request).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: 'Beneficio creado correctamente'
        });
        this.saved.emit(response);
        this.rewardForm.reset();
      },
      error: (error) => {
        this.isSubmitting = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.message || 'Error al crear el beneficio'
        });
      }
    });
  }

  private updateReward(rewardId: number, request: CreateRewardRequest): void {
    this.campaignService.updateReward(rewardId, request).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: 'Beneficio actualizado correctamente'
        });
        this.saved.emit(response);
      },
      error: (error) => {
        this.isSubmitting = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.message || 'Error al actualizar el beneficio'
        });
      }
    });
  }

  private buildRequest(): CreateRewardRequest {
    const formValue = this.rewardForm.value;
    const request: CreateRewardRequest = {
      rewardType: formValue.rewardType
    };

    // Siempre incluir descripción si el tipo no es NONE
    if (formValue.rewardType !== RewardType.NONE && formValue.description) {
      request.description = formValue.description;
    }

    // Agregar campos según el tipo de reward
    switch (formValue.rewardType) {
      case RewardType.PERCENT_DISCOUNT:
      case RewardType.FIXED_AMOUNT:
        if (formValue.numericValue !== null && formValue.numericValue !== undefined) {
          request.numericValue = formValue.numericValue;
        }
        break;

      case RewardType.FREE_PRODUCT:
        if (formValue.productId) {
          request.productId = formValue.productId;
        }
        break;

      case RewardType.BUY_X_GET_Y:
        if (formValue.buyQuantity) {
          request.buyQuantity = formValue.buyQuantity;
        }
        if (formValue.freeQuantity) {
          request.freeQuantity = formValue.freeQuantity;
        }
        break;

      case RewardType.CUSTOM:
        if (formValue.customConfig) {
          request.customConfig = formValue.customConfig;
        }
        break;
    }

    // Agregar campos opcionales comunes
    if (formValue.minPurchaseAmount) {
      request.minPurchaseAmount = formValue.minPurchaseAmount;
    }
    if (formValue.usageLimit) {
      request.usageLimit = formValue.usageLimit;
    }

    return request;
  }

  /**
   * Construye un ConfigureRewardRequest para uso en UpdateCampaignRequest
   * Este método valida y retorna null si el reward es inválido
   *
   * VALIDACIÓN POR TIPO DE REWARD:
   * - NONE: No se envía reward (null)
   * - PERCENT_DISCOUNT: numericValue (0-100), description*, minPurchaseAmount, usageLimit
   * - FIXED_AMOUNT: numericValue (monto), description*, minPurchaseAmount, usageLimit
   * - FREE_PRODUCT: productId (número), description*, minPurchaseAmount, usageLimit
   * - BUY_X_GET_Y: buyQuantity, freeQuantity, description*, minPurchaseAmount, usageLimit
   * - CUSTOM: customConfig, description*, minPurchaseAmount, usageLimit
   *
   * (*) description es requerido para todos excepto NONE
   */
  public getConfigureRewardRequest(): ConfigureRewardRequest | null {
    const formValue = this.rewardForm.value;

    // Si es NONE o el form es inválido, retornar null
    if (formValue.rewardType === RewardType.NONE || this.rewardForm.invalid) {
      console.log('[RewardForm] getConfigureRewardRequest: returning null - rewardType:', formValue.rewardType, 'isValid:', this.rewardForm.valid);
      return null;
    }

    // Base config con campos comunes (description, minPurchaseAmount, usageLimit)
    const config: ConfigureRewardRequest = {
      rewardType: formValue.rewardType,
      description: formValue.description || undefined,
      minPurchaseAmount: formValue.minPurchaseAmount || undefined,
      usageLimit: formValue.usageLimit || undefined
    };

    // Agregar campos específicos según el tipo
    switch (formValue.rewardType) {
      case RewardType.PERCENT_DISCOUNT:
      case 'PERCENT_DISCOUNT':
        // Validar que numericValue sea un número válido entre 0 y 100
        if (formValue.numericValue !== null && formValue.numericValue !== undefined) {
          config.numericValue = Number(formValue.numericValue);
          console.log('[RewardForm] PERCENT_DISCOUNT - numericValue:', config.numericValue);
        }
        break;

      case RewardType.FIXED_AMOUNT:
      case 'FIXED_AMOUNT':
        // Validar que numericValue sea un número válido > 0
        if (formValue.numericValue !== null && formValue.numericValue !== undefined) {
          config.numericValue = Number(formValue.numericValue);
          console.log('[RewardForm] FIXED_AMOUNT - numericValue:', config.numericValue);
        }
        break;

      case RewardType.FREE_PRODUCT:
      case 'FREE_PRODUCT':
        // Validar que productId sea un número válido > 0
        if (formValue.productId) {
          // Asegurar que productId sea numérico
          const productId = typeof formValue.productId === 'number'
            ? formValue.productId
            : Number(formValue.productId);

          if (!isNaN(productId) && productId > 0) {
            config.productId = productId;
            console.log('[RewardForm] FREE_PRODUCT - productId:', config.productId, 'selectedProductKey:', this.selectedProductKey);
          } else {
            console.warn('[RewardForm] FREE_PRODUCT - Invalid productId:', formValue.productId);
          }
        }
        break;

      case RewardType.BUY_X_GET_Y:
      case 'BUY_X_GET_Y':
        if (formValue.buyQuantity) {
          config.buyQuantity = Number(formValue.buyQuantity);
        }
        if (formValue.freeQuantity) {
          config.freeQuantity = Number(formValue.freeQuantity);
        }
        console.log('[RewardForm] BUY_X_GET_Y - buyQuantity:', config.buyQuantity, 'freeQuantity:', config.freeQuantity);
        break;

      case RewardType.CUSTOM:
      case 'CUSTOM':
        if (formValue.customConfig) {
          config.customConfig = formValue.customConfig;
        }
        console.log('[RewardForm] CUSTOM - customConfig:', config.customConfig);
        break;
    }

    console.log('[RewardForm] Final ConfigureRewardRequest:', config);
    return config;
  }

  onCancel(): void {
    this.rewardForm.reset();
    this.cancelled.emit();
  }
}
