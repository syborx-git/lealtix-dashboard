import { Component, OnInit, signal, DestroyRef, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import { ChipModule } from 'primeng/chip';
import { DividerModule } from 'primeng/divider';
import { MessageService, TreeNode } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { Select } from 'primeng/select';
import { TreeSelect } from 'primeng/treeselect';
import { InputNumber } from 'primeng/inputnumber';
import { Textarea } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';
import { Message } from 'primeng/message';
import { CreateCampaignRequest, UpdateCampaignRequest, CampaignResponse } from '@/models/campaign.model';
import { ConfigureRewardRequest } from '@/models/update-campaign-request';
import { RewardResponse, CreateRewardRequest } from '../../models/reward.model';
import { CampaignTemplate } from '@/models/campaign-template.model';
import { PromoType, CampaignStatus, RewardType } from '@/models/enums';
import { CampaignService } from '../../services/campaign.service';
import { CampaignTemplateService } from '../../services/campaign-template.service';
import { CatalogService } from '../../services/catalog.service';
import { DateRangeValidator } from '../../utils/date-range.validator';
import { REWARD_TYPE_OPTIONS } from '../../constants/reward-types';


@Component({
  selector: 'app-campaign-form',
  standalone: true,
  imports: [
  CommonModule,
  ReactiveFormsModule,
  FormsModule,
  ButtonModule,
  CardModule,
  InputTextModule,
  CheckboxModule,
  ChipModule,
  DividerModule,
  ToastModule,
  Select,
  TreeSelect,
  InputNumber,
  Textarea,
  TooltipModule,
  Message
  ],
  providers: [MessageService],
  templateUrl: './campaign-form.component.html',
  styles: [`
    :host {
      display: block;
    }

    .border-primary {
      border: 2px solid var(--primary-color) !important;
    }

    .cursor-pointer {
      cursor: pointer;
    }

    .max-w-200 {
      max-width: 200px;
    }

    .max-h-150 {
      max-height: 150px;
    }
  `]
})
export class CampaignFormComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  campaignForm: FormGroup;
  templates = signal<CampaignTemplate[]>([]);
  selectedTemplateId = signal<number | null>(null);
  isEditMode = signal<boolean>(false);
  saving = signal<boolean>(false);
  imagePreview = signal<string>('');

  minDate = new Date();

  campaignId?: number;
  // Reward associated to the campaign (when editing)
  existingReward?: RewardResponse | null = null;

  // Reward-related properties
  productTree: TreeNode[] = [];
  selectedProductNode: TreeNode | null = null; // Complete node object for p-treeSelect
  isLoadingProducts = false;
  private lastLoadedTenantId: number | null = null;
  private isUpdatingValidators = false;
  tenantId = 1; // TODO: Get from auth service

  rewardTypes = REWARD_TYPE_OPTIONS;

  promoTypeOptions = [
    { label: 'Descuento porcentual', value: PromoType.DISCOUNT },
    { label: 'Descuento por monto', value: PromoType.AMOUNT },
    { label: 'Compra uno lleva otro', value: PromoType.BOGO },
    { label: 'Artículo gratuito', value: PromoType.FREE_ITEM }  ];

  statusOptions = [
    { label: 'Borrador', value: CampaignStatus.DRAFT },
    { label: 'Activa', value: CampaignStatus.ACTIVE },
    { label: 'Inactiva', value: CampaignStatus.INACTIVE },
    { label: 'Programada', value: CampaignStatus.SCHEDULED }
  ];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private campaignService: CampaignService,
    private campaignTemplateService: CampaignTemplateService,
    private catalogService: CatalogService,
    private messageService: MessageService
  ) {
    this.campaignForm = this.createForm();
  }

  ngOnInit(): void {
    this.loadTemplates();
    this.checkRouteParams();
    this.setupImagePreview();
    this.setupRewardFormListeners();
    // Load product tree if tenantId is available
    if (this.tenantId && Number(this.tenantId) > 0) {
      this.loadProductTree(this.tenantId);
    }
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
      isAutomatic: [false],
      // Reward fields
      rewardType: [null, Validators.required],
      numericValue: [null],
      productId: [null],
      buyQuantity: [null],
      freeQuantity: [null],
      rewardDescription: ['', [Validators.required, Validators.maxLength(500)]],
      minPurchaseAmount: [null],
      usageLimit: [null]
    }, {
      validators: [DateRangeValidator.dateRange, DateRangeValidator.promoValue]
    });
  }

  private loadTemplates(): void {
    this.campaignTemplateService.getAll()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (templates) => {
          this.templates.set(templates.filter(t => t.active !== false));
        },
        error: (error) => {
          console.error('Error loading templates:', error);
        }
      });
  }

  private checkRouteParams(): void {
    this.route.queryParams.pipe(takeUntilDestroyed()).subscribe(params => {
      if (params['templateId']) {
        this.loadTemplate(+params['templateId']);
      }
      if (params['campaignId']) {
        this.loadCampaignForEdit(+params['campaignId']);
      }
    });
  }

  private loadTemplate(templateId: number): void {
    this.campaignTemplateService.get(templateId)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (template) => {
          this.applyTemplate(template);
        },
        error: (error) => {
          console.error('Error loading template:', error);
        }
      });
  }

  private loadCampaignForEdit(campaignId: number): void {
    this.campaignId = campaignId;
    this.isEditMode.set(true);

    this.campaignService.get(campaignId)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (campaign) => {
          this.populateFormWithCampaign(campaign);

          // Cargar también el reward para obtener la descripción
          this.campaignService.getRewardByCampaign(campaignId)
            .pipe(takeUntilDestroyed())
            .subscribe({
              next: (reward) => {
                console.log('🔍 REWARD LOADED:', reward);
                // Guardar reward para incluirlo en el payload al actualizar
                this.existingReward = reward;
                // Actualizar el formulario con los datos del reward
                // Usamos emitEvent: false para evitar que los listeners limpien los valores
                this.campaignForm.patchValue({
                  description: reward.description,
                  rewardType: reward.rewardType,
                  numericValue: reward.numericValue,
                  productId: reward.productId,
                  buyQuantity: reward.buyQuantity,
                  freeQuantity: reward.freeQuantity,
                  rewardDescription: reward.description,
                  minPurchaseAmount: reward.minPurchaseAmount,
                  usageLimit: reward.usageLimit
                }, { emitEvent: false });

                // Si hay productId, asegurar que el árbol esté cargado y luego seleccionar el nodo
                if (reward.productId) {
                  // Si el árbol ya está cargado, seleccionar inmediatamente
                  if (this.productTree.length > 0) {
                    this.setSelectedProductNode(reward.productId);
                  } else {
                    // Si no está cargado, cargarlo primero (la selección se hará automáticamente después)
                    this.loadProductTree(this.tenantId);
                  }
                }
              },
              error: (error) => {
                console.log('ℹ️ No se encontró reward para la campaña');
              }
            });
        },
        error: (error) => {
          console.error('Error loading campaign:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo cargar la campaña para editar'
          });
        }
      });
  }

  private populateFormWithCampaign(campaign: CampaignResponse): void {
    this.campaignForm.patchValue({
      title: campaign.title,
      subtitle: campaign.subtitle,
      description: '', // La descripción se cargará desde el reward
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
    // Aplicar validadores dependientes del promoType tras cargar
    this.onPromoTypeChange();
  }

  private setupImagePreview(): void {
    this.campaignForm.get('imageUrl')?.valueChanges
      .pipe(takeUntilDestroyed())
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
    const descriptionControl = this.campaignForm.get('description');

    // Reset promo value when type changes
    promoValueControl?.setValue('');

    // Add/remove validators based on type
    if (this.shouldShowPromoValue()) {
      promoValueControl?.setValidators([Validators.required]);
    } else {
      promoValueControl?.clearValidators();
    }

    // Si es 'Solo Promoción' (CUSTOM) entonces la descripción del reward es requerida
    if (promoType === PromoType.CUSTOM) {
      descriptionControl?.setValidators([Validators.required, Validators.minLength(3)]);
    } else {
      descriptionControl?.clearValidators();
    }

    promoValueControl?.updateValueAndValidity();
    descriptionControl?.updateValueAndValidity();
  }

  shouldShowPromoValue(): boolean {
    const promoType = this.campaignForm.get('promoType')?.value;
    return promoType === PromoType.DISCOUNT || promoType === PromoType.AMOUNT || promoType === PromoType.CUSTOM;
  }

  isPromoTypeCustom(): boolean {
    return this.campaignForm.get('promoType')?.value === PromoType.CUSTOM;
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

  getEndDateMinDate(): Date {
    const startDate = this.campaignForm.get('startDate')?.value;
    if (startDate) {
      const minEndDate = new Date(startDate);
      minEndDate.setDate(minEndDate.getDate() + 1);
      return minEndDate;
    }
    return this.minDate;
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

  removeChannel(channelToRemove: string): void {
    const currentChannels = this.campaignForm.get('channels')?.value || [];
    const updatedChannels = currentChannels.filter((c: string) => c !== channelToRemove);
    this.campaignForm.patchValue({ channels: updatedChannels });
  }

  onSubmit(): void {
    // Validación adicional para rewardType cuando se activa una campaña
    const statusControl = this.campaignForm.get('status');
    const rewardTypeControl = this.campaignForm.get('rewardType');
    const isActivating = statusControl?.value === 'ACTIVE';

    if (isActivating && !rewardTypeControl?.value) {
      rewardTypeControl?.markAsTouched();
      this.messageService.add({
        severity: 'warn',
        summary: 'Tipo de Beneficio Requerido',
        detail: 'Debes seleccionar un tipo de beneficio antes de activar la campaña'
      });
      return;
    }

    if (this.campaignForm.invalid) {
      this.campaignForm.markAllAsTouched();
      return;
    }

    console.log('📝 FORM VALUE ON SUBMIT:', this.campaignForm.value);
    console.log('📝 DESCRIPTION VALUE:', this.campaignForm.get('description')?.value);

    this.saving.set(true);

    if (this.isEditMode()) {
      this.updateCampaign();
    } else {
      this.createCampaign();
    }
  }

  private createCampaign(): void {
    const formValue = this.campaignForm.value;

    const request: CreateCampaignRequest = {
      templateId: this.selectedTemplateId(),
      businessId: 1, // TODO: Get from auth service
      title: formValue.title,
      subtitle: formValue.subtitle,
      // description se guarda en promotion_reward, no aquí
      promoType: formValue.promoType,
      promoValue: formValue.promoValue,
      callToAction: formValue.callToAction,
      startDate: formValue.startDate,
      endDate: formValue.endDate,
      channels: formValue.channels,
      segmentation: formValue.segmentation,
      imageUrl: formValue.imageUrl,
      isAutomatic: formValue.isAutomatic
    };

    this.campaignService.create(request)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (campaign) => {
          // After creating campaign, create reward if data exists
          const rewardRequest = this.buildRewardRequest();
          if (rewardRequest) {
            this.createRewardForCampaign(campaign.id, rewardRequest);
          } else {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Campaña creada exitosamente'
            });
            this.router.navigate(['/dashboard/campaigns', campaign.id]);
          }
        },
        error: (error) => {
          console.error('Error creating campaign:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo crear la campaña'
          });
          this.saving.set(false);
        }
      });
  }

  private createRewardForCampaign(campaignId: number, rewardRequest: CreateRewardRequest): void {
    console.log('🔍 CREATE REWARD REQUEST:', {
      campaignId,
      rewardRequest
    });

    this.campaignService.createReward(campaignId, rewardRequest)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Campaña y beneficio creados exitosamente'
          });
          this.router.navigate(['/dashboard/campaigns', campaignId]);
        },
        error: (error) => {
          console.error('Error creating reward:', error);
          this.messageService.add({
            severity: 'warn',
            summary: 'Campaña creada',
            detail: 'Campaña creada pero hubo un error al guardar el beneficio'
          });
          this.router.navigate(['/dashboard/campaigns', campaignId]);
        }
      });
  }

  private updateCampaign(): void {
    const formValue = this.campaignForm.value;
    const request: UpdateCampaignRequest = {
      title: formValue.title,
      subtitle: formValue.subtitle,
      promoType: formValue.promoType,
      promoValue: formValue.promoValue,
      callToAction: formValue.callToAction,
      startDate: formValue.startDate,
      endDate: formValue.endDate,
      status: formValue.status,
      channels: formValue.channels,
      segmentation: formValue.segmentation,
      imageUrl: formValue.imageUrl,
      isAutomatic: formValue.isAutomatic
    };

    this.campaignService.update(this.campaignId!, request)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (campaign) => {
          // Update or create reward
          const rewardRequest = this.buildRewardRequest();
          if (rewardRequest) {
            if (this.existingReward?.id) {
              this.updateRewardForCampaign(this.existingReward.id, rewardRequest, campaign.id);
            } else {
              this.createRewardForCampaign(campaign.id, rewardRequest);
            }
          } else {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Campaña actualizada exitosamente'
            });
            this.router.navigate(['/dashboard/campaigns', campaign.id]);
          }
        },
        error: (error) => {
          console.error('Error updating campaign:', error);
          const msg = error?.error?.message || 'No se pudo actualizar la campaña';
          this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
          this.saving.set(false);
        }
      });
  }

  private updateRewardForCampaign(rewardId: number, rewardRequest: CreateRewardRequest, campaignId: number): void {
    console.log('🔍 UPDATE REWARD REQUEST:', {
      rewardId,
      rewardRequest
    });

    this.campaignService.updateReward(rewardId, rewardRequest)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Campaña y beneficio actualizados exitosamente'
          });
          this.router.navigate(['/dashboard/campaigns', campaignId]);
        },
        error: (error) => {
          console.error('Error updating reward:', error);
          this.messageService.add({
            severity: 'warn',
            summary: 'Campaña actualizada',
            detail: 'Campaña actualizada pero hubo un error al actualizar el beneficio'
          });
          this.router.navigate(['/dashboard/campaigns', campaignId]);
        }
      });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/campaigns']);
  }

  // ============================================================================
  // REWARD-RELATED METHODS
  // ============================================================================

  private setupRewardFormListeners(): void {
    this.campaignForm.get('rewardType')?.valueChanges
      .pipe(
        startWith(this.campaignForm.get('rewardType')?.value),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((type: RewardType) => {
        this.updateRewardValidators(type);

        // When FREE_PRODUCT or BUY_X_GET_Y (2x1) is selected, load the product tree
        if (type === RewardType.FREE_PRODUCT || type === RewardType.BUY_X_GET_Y) {
          // Ensure productTree is loaded - if empty, load it regardless of lastLoadedTenantId
          if (this.productTree.length === 0) {
            this.lastLoadedTenantId = null; // Reset to force reload
          }
          this.loadProductTree(this.tenantId);
        }

        // For 2x1 promotion: set default quantities and initialize form values
        if (type === RewardType.BUY_X_GET_Y) {
          // Set default values for 2x1 if not already set
          const buyQty = this.campaignForm.get('buyQuantity')?.value;
          const freeQty = this.campaignForm.get('freeQuantity')?.value;

          if (!buyQty || buyQty === null) {
            this.campaignForm.patchValue({ buyQuantity: 1 }, { emitEvent: false });
          }
          if (!freeQty || freeQty === null) {
            this.campaignForm.patchValue({ freeQuantity: 1 }, { emitEvent: false });
          }

          // Clear product selection when changing reward type to 2x1
          this.selectedProductNode = null;
          this.campaignForm.patchValue({ productId: null }, { emitEvent: false });
        } else {
          // For other reward types that don't use 2x1, clear the product selection
          if (type !== RewardType.FREE_PRODUCT) {
            this.selectedProductNode = null;
            this.campaignForm.patchValue({ productId: null }, { emitEvent: false });
          }
        }
      });
  }

  private updateRewardValidators(rewardType: RewardType): void {
    if (this.isUpdatingValidators) {
      return;
    }

    this.isUpdatingValidators = true;

    try {
      // Clear all reward field validators
      const rewardFields = ['numericValue', 'productId', 'buyQuantity', 'freeQuantity', 'rewardDescription', 'minPurchaseAmount', 'usageLimit'];
      rewardFields.forEach(field => {
        if (field !== 'rewardDescription') {
          this.campaignForm.get(field)?.clearValidators();
          this.campaignForm.get(field)?.setValue(null, { emitEvent: false });
        }
      });

      // If NONE, clear description as well
      if (rewardType === RewardType.NONE) {
        this.campaignForm.get('rewardDescription')?.clearValidators();
        this.campaignForm.get('rewardDescription')?.setValue('Sin beneficio - Solo promoción', { emitEvent: false });
      } else {
        // Apply validators based on reward type
        switch (rewardType) {
          case RewardType.PERCENT_DISCOUNT:
            this.campaignForm.get('numericValue')?.setValidators([Validators.required, Validators.min(0), Validators.max(100)]);
            this.campaignForm.get('rewardDescription')?.setValidators([Validators.required, Validators.maxLength(500)]);
            break;
          case RewardType.FIXED_AMOUNT:
            this.campaignForm.get('numericValue')?.setValidators([Validators.required, Validators.min(0)]);
            this.campaignForm.get('rewardDescription')?.setValidators([Validators.required, Validators.maxLength(500)]);
            break;
          case RewardType.FREE_PRODUCT:
            this.campaignForm.get('productId')?.setValidators([Validators.required]);
            this.campaignForm.get('rewardDescription')?.setValidators([Validators.required, Validators.maxLength(500)]);
            break;
          case RewardType.BUY_X_GET_Y:
            // For 2x1 promotion: require productId, buyQuantity, freeQuantity, and description
            this.campaignForm.get('productId')?.setValidators([Validators.required]);
            this.campaignForm.get('buyQuantity')?.setValidators([Validators.required, Validators.min(1)]);
            this.campaignForm.get('freeQuantity')?.setValidators([Validators.required, Validators.min(1)]);
            this.campaignForm.get('rewardDescription')?.setValidators([Validators.required, Validators.maxLength(500)]);
            break;
          case RewardType.CUSTOM:
            this.campaignForm.get('rewardDescription')?.setValidators([Validators.required, Validators.maxLength(500)]);
            break;
        }
      }

      // Update validation state without emitting events
      rewardFields.forEach(field => {
        this.campaignForm.get(field)?.updateValueAndValidity({ emitEvent: false });
      });
    } finally {
      this.isUpdatingValidators = false;
    }
  }

  private loadProductTree(tenantId?: number): void {
    if (this.isLoadingProducts || this.lastLoadedTenantId === tenantId) {
      return;
    }

    if (tenantId && Number(tenantId) > 0) {
      this.isLoadingProducts = true;
      this.lastLoadedTenantId = tenantId;
      this.catalogService.getCategoriesWithProducts(tenantId).subscribe({
        next: (categories) => {
          this.productTree = this.catalogService.mapToTreeNodes(categories);
          this.isLoadingProducts = false;

          // Si hay un productId en el formulario, seleccionarlo ahora que el árbol está cargado
          const productId = this.campaignForm.get('productId')?.value;
          if (productId && Number(productId) > 0) {
            this.setSelectedProductNode(Number(productId));
          }
        },
        error: (err) => {
          this.isLoadingProducts = false;
          console.warn('Failed to load product tree from backend, using mock data', err);
          this.loadMockProductTree();
        }
      });
    } else {
      this.loadMockProductTree();
    }
  }

  private loadMockProductTree(): void {
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

  onProductTreeSelect(node: TreeNode | null): void {
    if (node && node.key) {
      const productId = typeof node.key === 'number' ? node.key : Number(node.key);
      if (!isNaN(productId) && productId > 0) {
        this.campaignForm.get('productId')?.setValue(productId);
        this.selectedProductNode = node;
      }
    } else {
      this.campaignForm.get('productId')?.setValue(null);
      this.selectedProductNode = null;
    }
  }

  /**
   * Find a product node in the tree by productId and set it as selected
   * Used when loading existing rewards in edit mode
   */
  private setSelectedProductNode(productId: number): void {
    console.log('[setSelectedProductNode] Buscando producto con ID:', productId, 'Árbol tiene', this.productTree.length, 'nodos');

    const findNode = (nodes: TreeNode[]): TreeNode | null => {
      for (const node of nodes) {
        if (node.key && Number(node.key) === productId) {
          return node;
        }
        if (node.children) {
          const found = findNode(node.children);
          if (found) return found;
        }
      }
      return null;
    };

    const foundNode = findNode(this.productTree);
    if (foundNode) {
      this.selectedProductNode = foundNode;
      console.log('[setSelectedProductNode] ✅ Producto encontrado y seleccionado:', foundNode.label);
    } else {
      console.warn('[setSelectedProductNode] ⚠️ No se encontró el producto con ID:', productId);
    }
  }

  // Getters for template
  get selectedRewardType(): RewardType | null {
    return this.campaignForm.get('rewardType')?.value;
  }

  get showNumericValue(): boolean {
    return this.selectedRewardType === RewardType.PERCENT_DISCOUNT ||
           this.selectedRewardType === RewardType.FIXED_AMOUNT;
  }

  get showProductId(): boolean {
    return this.selectedRewardType === RewardType.FREE_PRODUCT ||
           this.selectedRewardType === RewardType.BUY_X_GET_Y;
  }

  get showBuyGetQuantities(): boolean {
    return this.selectedRewardType === RewardType.BUY_X_GET_Y;
  }

  get show2x1Product(): boolean {
    // Show product selector for 2x1 promotion (same product)
    return this.selectedRewardType === RewardType.BUY_X_GET_Y;
  }

  get productIdLabel(): string {
    if (this.selectedRewardType === RewardType.BUY_X_GET_Y) {
      return 'Producto 2x1';
    }
    return 'Producto a regalar';
  }

  get productIdHelperText(): string {
    if (this.selectedRewardType === RewardType.BUY_X_GET_Y) {
      return 'Selecciona el producto que participará en la promoción 2x1. El cliente comprará 1 y recibirá 1 adicional gratis.';
    }
    return 'Selecciona la categoría y luego el producto que se regalará.';
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

  private buildRewardRequest(): CreateRewardRequest | null {
    const formValue = this.campaignForm.value;

    // If reward type is NONE, no reward data
    if (formValue.rewardType === RewardType.NONE) {
      return null;
    }

    const request: CreateRewardRequest = {
      rewardType: formValue.rewardType,
      description: formValue.rewardDescription || undefined,
      minPurchaseAmount: formValue.minPurchaseAmount || undefined,
      usageLimit: formValue.usageLimit || undefined
    };

    // Add type-specific fields
    switch (formValue.rewardType) {
      case RewardType.PERCENT_DISCOUNT:
      case RewardType.FIXED_AMOUNT:
        if (formValue.numericValue !== null && formValue.numericValue !== undefined) {
          request.numericValue = Number(formValue.numericValue);
        }
        break;
      case RewardType.FREE_PRODUCT:
        if (formValue.productId) {
          const productId = typeof formValue.productId === 'number' ? formValue.productId : Number(formValue.productId);
          if (!isNaN(productId) && productId > 0) {
            request.productId = productId;
          }
        }
        break;
      case RewardType.BUY_X_GET_Y:
        // For 2x1 promotion: include productId (same product for buy and free)
        if (formValue.productId) {
          const productId = typeof formValue.productId === 'number' ? formValue.productId : Number(formValue.productId);
          if (!isNaN(productId) && productId > 0) {
            request.productId = productId;
          }
        }
        if (formValue.buyQuantity) {
          request.buyQuantity = Number(formValue.buyQuantity);
        }
        if (formValue.freeQuantity) {
          request.freeQuantity = Number(formValue.freeQuantity);
        }
        break;
      case RewardType.CUSTOM:
        if (formValue.customConfig) {
          request.customConfig = formValue.customConfig;
        }
        break;
    }

    return request;
  }
}
