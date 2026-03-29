import { Component, OnInit, signal, computed, inject, DestroyRef, model, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { min, startWith } from 'rxjs/operators';

// PrimeNG imports
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { DatePickerModule } from 'primeng/datepicker';
import { FileUploadModule } from 'primeng/fileupload';
import { CheckboxModule } from 'primeng/checkbox';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { DividerModule } from 'primeng/divider';
import { ChipModule } from 'primeng/chip';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, TreeNode } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageModule } from 'primeng/message';
import { TreeSelectModule } from 'primeng/treeselect';

// Models and Services
import { CampaignTemplate } from '@/models/campaign-template.model';
import { CreateCampaignRequest } from '@/models/campaign.model';
import { PromoType, RewardType } from '@/models/enums';
import { CampaignFormModel, TemplateField, CampaignPreviewData } from '../../models/create-campaign.models';
import { RewardResponse, CreateRewardRequest } from '../../models/reward.model';
import { ConfigureRewardRequest } from '@/models/update-campaign-request';
import { CampaignService } from '../../services/campaign.service';
import { CampaignTemplateService } from '../../services/campaign-template.service';
import { CatalogService } from '../../services/catalog.service';
import { CampaignPreviewDialogComponent } from './campaign-dialog/campaign-preview-dialog.component';
import { TenantService } from '@/pages/admin-page/service/tenant.service';
import { AuthService } from '@/auth/auth.service';
import { ImageService } from '@/pages/service/image.service';
import { REWARD_TYPE_OPTIONS } from '../../constants/reward-types';

@Component({
  selector: 'app-create-campaign',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    CardModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    MultiSelectModule,
    DatePickerModule,
    FileUploadModule,
    CheckboxModule,
    ToggleButtonModule,
    DividerModule,
    ChipModule,
    DialogModule,
    TooltipModule,
    ToastModule,
    InputNumberModule,
    MessageModule,
    TreeSelectModule,
    CampaignPreviewDialogComponent
  ],
  providers: [MessageService],
  templateUrl: './create-campaign.component.html',
  styleUrls: ['./create-campaign.component.scss']
})
export class CreateCampaignComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  // Expose enum to template
  public RewardType = RewardType;
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private campaignService = inject(CampaignService);
  private templateService = inject(CampaignTemplateService);
  private messageService = inject(MessageService);
  private tenantService = inject(TenantService);
  private authService = inject(AuthService);
  private imageService = inject(ImageService);
  private catalogService = inject(CatalogService);

  // Signals
  loading = signal<boolean>(false);
  saving = signal<boolean>(false);
  template = signal<CampaignTemplate | null>(null);
  previewDialogVisible = model<boolean>(false);
  campaignSaved = model<boolean>(false);
  uploadedImageUrl = signal<string>('');
  clientName = signal<string | null>(null);
  clientLogo = signal<string | null>(null);
  clientSlug = signal<string | null>(null);
  // Edit mode signals
  isEditMode = signal<boolean>(false);
  campaignToEdit = signal<any>(null);
  currentReward = signal<RewardResponse | null>(null);
  loadingReward = signal<boolean>(false);
  campaignId = signal<number | null>(null);
  // Email confirmation dialog signals
  showEmailConfirmationDialog = signal<boolean>(false);
  pendingCampaignUpdate = signal<any>(null);

  // Reward-related properties
  productTree: TreeNode[] = [];
  selectedProductNode: TreeNode | null = null; // Complete node object for p-treeSelect
  isLoadingProducts = false;
  private lastLoadedTenantId: number | null = null;
  private isUpdatingValidators = false;

  rewardTypes = REWARD_TYPE_OPTIONS;

  @ViewChild('statusSelect', { read: ElementRef }) statusSelect?: ElementRef;
  // Trigger to make preview computed reactive to form changes
  private formTrigger = signal<number>(0);

  email: string | null = null;
  userId: string | null = null;
  tenantId: number | null = null;

  // Form
  campaignForm!: FormGroup;
  private pendingRewardRequest: CreateRewardRequest | null = null;

  // Computed values
  previewData = computed<CampaignPreviewData>(() => {
    // depend on this trigger so computed re-evaluates when form changes
    this.formTrigger();

    if (!this.campaignForm) {
      return this.getEmptyPreview();
    }

    const formValue = this.campaignForm.value;
    return {
      title: formValue.title || 'Título de la campaña',
      subtitle: formValue.subtitle,
      description: formValue.description || 'Descripción de la campaña',
      imageUrl: this.uploadedImageUrl() || formValue.imageUrl || this.template()?.defaultImageUrl,
      promoType: formValue.promoType,
      promoValue: formValue.promoValue,
      startDate: formValue.startDate,
      endDate: formValue.endDate,
      buttonText: 'Obtener Promoción' // Texto fijo
    };
  });

  // Options
  promoTypeOptions = [
    { label: 'Descuento', value: PromoType.DISCOUNT },
    { label: 'Monto Fijo', value: PromoType.AMOUNT },
    { label: 'Compra uno lleva otro', value: PromoType.BOGO },
    { label: 'Producto Gratis', value: PromoType.FREE_ITEM },
    { label: 'Otro', value: PromoType.CUSTOM }
  ];

  // Status options for campaign management
  statusOptions = [
    { label: 'Borrador', value: 'DRAFT' },
    { label: 'Activa', value: 'ACTIVE' }
  ];

  // Distribution channels: Email enabled by default, others shown but disabled
  channelOptions = [
    { label: 'Email', value: 'email', disabled: false },
    { label: 'Facebook', value: 'facebook', disabled: true },
    { label: 'Instagram', value: 'instagram', disabled: true },
    { label: 'Tiktok', value: 'tiktok', disabled: true },
    { label: 'X', value: 'x', disabled: true }
  ];

  // Common segmentation options for quick targeting
  segmentationOptions = [
    { label: 'Todos los clientes', value: 'all' },
    { label: 'Hombres', value: 'male' },
    { label: 'Mujeres', value: 'female' },
    { label: 'Próximo cumpleaños (7 días)', value: 'upcoming_birthday_7d' },
    { label: 'Activos últimos 30 días', value: 'active_30d' },
    { label: 'Usuarios nuevos (últimos 30 días)', value: 'new_30d' },
    { label: 'Alto valor (LTV alto)', value: 'high_ltv' },
    { label: 'Sin compras 60 días', value: 'no_purchase_60d' },
    { label: 'Clientes VIP', value: 'vip' }
  ];

  // Dynamic fields from template (for future extensibility)
  dynamicFields: TemplateField[] = [];

  ngOnInit(): void {
    this.initForm();
    this.loadTenantData();
    this.checkEditMode();
    this.loadTemplateIfProvided();
    this.setupRewardFormListeners();
    // Load product tree if tenantId is available
    if (this.tenantId && Number(this.tenantId) > 0) {
      this.loadProductTree(this.tenantId);
    }
  }

  private checkEditMode(): void {
    const campaignId = this.route.snapshot.queryParamMap.get('id');
    const focusStatus = this.route.snapshot.queryParamMap.get('focusStatus');

    if (campaignId) {
      this.isEditMode.set(true);
      this.campaignId.set(+campaignId);
      this.loadCampaignForEdit(+campaignId, focusStatus === 'true');
    }
  }

  private loadCampaignForEdit(id: number, shouldFocusStatus: boolean = false): void {
    this.loading.set(true);

    this.campaignService.get(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (campaign) => {
          // Guardar la campaña en la señal
          this.campaignToEdit.set(campaign);

          // Cargar el template si la campaña tiene uno
          if (campaign.template?.id) {
            this.templateService.get(campaign.template.id)
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe({
                next: (template: CampaignTemplate) => {
                  this.template.set(template);
                  console.log('[Template Debug] Template loaded in edit mode:', template.id, template.name);
                },
                error: (error: any) => {
                  console.error('Error loading template in edit mode:', error);
                }
              });
          }

          // Poblar el formulario con los datos de la campaña
          this.populateFormWithCampaign(campaign);

          // Cargar el reward de la campaña si existe
          this.loadCampaignReward(id);

          // Finalizar la carga
          this.loading.set(false);

          // Si viene del banner, hacer scroll y focus en el campo de estado
          if (shouldFocusStatus) {
            setTimeout(() => this.scrollAndFocusStatus(), 500);
          }
        },
        error: (error) => {
          console.error('Error loading campaign for edit:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo cargar la campaña para editar'
          });
          this.loading.set(false);
          // Redirect back to campaigns list if campaign not found
          this.router.navigate(['/dashboard/campaigns']);
        }
      });
  }

  private loadCampaignReward(campaignId: number): void {
    this.loadingReward.set(true);

    this.campaignService.getRewardByCampaign(campaignId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (reward) => {
          if (!reward) {
            this.currentReward.set(null);
            const campaign = this.campaignToEdit();
            if (campaign?.promoType === 'NONE') {
              this.updateRewardValidators(RewardType.NONE);
              this.campaignForm.patchValue({
                rewardType: RewardType.NONE,
                rewardDescription: campaign.description || ''
              }, { emitEvent: false });
              this.formTrigger.update(n => n + 1);
            }
            this.loadingReward.set(false);
            return;
          }

          this.currentReward.set(reward);
          console.log('[loadCampaignReward] Cargando reward:', reward);

          // 1. Set validators FIRST (without touching values)
          this.updateRewardValidators(reward.rewardType as RewardType);

          // 2. Populate all reward values silently (emitEvent:false prevents
          //    setupRewardFormListeners from firing and clearing the values we just set)
          this.campaignForm.patchValue({
            rewardType:          reward.rewardType,
            numericValue:        reward.numericValue        ?? null,
            productId:           reward.productId           ?? null,
            buyQuantity:         reward.buyQuantity         ?? null,
            freeQuantity:        reward.freeQuantity        ?? null,
            rewardDescription:   reward.description        ?? '',
            minPurchaseAmount:   reward.minPurchaseAmount   ?? null,
            usageLimit:          reward.usageLimit          ?? null
          }, { emitEvent: false });

          // 3. Manually trigger preview recalculation
          this.formTrigger.update(n => n + 1);

          // 4. Handle product selection for product-based reward types
          if (reward.productId && (reward.rewardType === RewardType.FREE_PRODUCT || reward.rewardType === RewardType.BUY_X_GET_Y)) {
            if (this.productTree.length > 0) {
              this.setSelectedProductNode(reward.productId);
            } else {
              this.loadProductTree(this.tenantId ?? undefined);
            }
          }

          this.loadingReward.set(false);
        },
        error: (error) => {
          if (error.status !== 404) {
            console.error('Error loading campaign reward:', error);
          }
          this.currentReward.set(null);
          this.loadingReward.set(false);
        }
      });
  }

  private populateFormWithCampaign(campaign: any): void {
    const startDate = campaign.startDate ? new Date(campaign.startDate) : null;
    const endDate   = campaign.endDate   ? new Date(campaign.endDate)   : null;
    const isPromoNone = campaign.promoType === 'NONE';

    // Normalize segmentation to an array of valid values
    let segmentationValues: string[] = [];
    if (Array.isArray(campaign.segmentation)) {
      segmentationValues = campaign.segmentation.filter((v: string) =>
        this.segmentationOptions.some(o => o.value === v)
      );
    } else if (typeof campaign.segmentation === 'string') {
      if (this.segmentationOptions.some(o => o.value === campaign.segmentation)) {
        segmentationValues = [campaign.segmentation];
      }
    }

    // Populate campaign-level fields only.
    // Reward fields (numericValue, productId, minPurchaseAmount, usageLimit, etc.)
    // are populated by loadCampaignReward() after the reward endpoint responds.
    this.campaignForm.patchValue({
      title:        campaign.title        || '',
      subtitle:     campaign.subtitle     || '',
      description:  campaign.description  || '',
      imageUrl:     campaign.imageUrl     || '',
      startDate,
      endDate,
      callToAction: campaign.callToAction || '',
      channels:     campaign.channels     || ['email'],
      segmentation: segmentationValues,
      status:       campaign.status       || 'DRAFT',
      isAutomatic:  campaign.isAutomatic  || false,
      promoType:    campaign.promoType    || '',
      // Pre-set NONE reward type so the form shows the description field immediately;
      // loadCampaignReward() will overwrite if the backend returns a real reward.
      ...(isPromoNone ? { rewardType: RewardType.NONE, rewardDescription: campaign.description || '' } : {})
    });

    if (campaign.imageUrl) {
      this.uploadedImageUrl.set(campaign.imageUrl);
    }

    if (campaign.channels?.length > 0) {
      this.campaignForm.patchValue({ channelsText: campaign.channels.join(', ') });
    }

    // Delay segmentation setValue to ensure MultiSelect is initialized
    setTimeout(() => {
      this.campaignForm.get('segmentation')?.setValue(segmentationValues, { emitEvent: true });
    }, 100);
  }

  private initForm(): void {
    this.campaignForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      subtitle: [''],
      description: [''],
      imageUrl: [''],
      promoType: [''],
      promoValue: [''],
      startDate: [null, Validators.required],
      endDate: [null, Validators.required],
      callToAction: [''], // URL opcional
      channelsText: [''],
      channels: [['email']],
      segmentation: [['all']],
      status: ['DRAFT'], // Control de estado
      isAutomatic: [true],
      // Reward fields
      rewardType: [null, Validators.required],
      numericValue: [null],
      productId: [null],
      buyQuantity: [null],
      freeQuantity: [null],
      rewardDescription: ['', [Validators.required, Validators.maxLength(500)]],
      minPurchaseAmount: [null],
      usageLimit: [null]
    });

    // Subscribe to form changes for live preview
    this.campaignForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        // Increment trigger so previewData recomputes immediately
        this.formTrigger.update(n => n + 1);
      });
  }

  private loadTemplateIfProvided(): void {
    const templateId = this.route.snapshot.queryParamMap.get('templateId');

    if (templateId) {
      this.loading.set(true);
      this.templateService.get(+templateId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (template: CampaignTemplate) => {
            this.template.set(template);
            this.applyTemplate(template);
            this.loading.set(false);
          },
          error: (error: any) => {
            console.error('Error loading template:', error);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'No se pudo cargar la plantilla'
            });
            this.loading.set(false);
          }
        });
    }
  }

  private applyTemplate(template: CampaignTemplate): void {
    this.campaignForm.patchValue({
      title: template.defaultTitle || '',
      subtitle: template.defaultSubtitle || '',
      description: template.defaultDescription || '',
      imageUrl: template.defaultImageUrl || '',
      promoType: template.defaultPromoType || ''
    });

    // Set channelsText if channels array exists
    const channels = this.campaignForm.get('channels')?.value;
    if (channels && channels.length > 0) {
      this.campaignForm.patchValue({ channelsText: channels.join(', ') });
    }
  }

  private loadTenantData(): void {
    const currentUser = this.authService.getCurrentUser();
    const tenantId = currentUser?.tenantId;
    if (tenantId) {
      this.tenantService.getTenantById(tenantId).subscribe({
        next: (tenant) => {
          this.tenantId = tenant?.id ?? 0;
          this.clientName.set(tenant.nombreNegocio || 'Negocio');
          this.clientLogo.set(tenant.logoUrl || null);
          this.clientSlug.set(tenant.slug || null);
        },
        error: (err) => {
          console.error('Error fetching tenant:', err);
        }
      });
    }
  }

  onImageUpload(event: any): void {
    const file = event.files[0];
    if (!file) return;

    this.loading.set(true);

    // Obtener nombre de la promoción del formulario o usar uno por defecto
    const promoName = this.campaignForm.get('title')?.value || `promo-${Date.now()}`;
    const tenantId = this.tenantId || 1;

    this.imageService.uploadImagePromotion(file, 'promotion', tenantId, promoName)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (imageUrl: string) => {
          this.uploadedImageUrl.set(imageUrl);
          this.campaignForm.patchValue({ imageUrl: imageUrl });
          this.messageService.add({
            severity: 'success',
            summary: 'Imagen subida',
            detail: 'La imagen se ha subido correctamente a Cloudinary'
          });
          this.loading.set(false);
        },
        error: (error) => {
          console.error('Error al subir imagen:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo subir la imagen. Inténtalo de nuevo.'
          });
          this.loading.set(false);
        }
      });
  }

  /**
   * Método principal para guardar o actualizar campaña
   * - Modo creación: siempre guarda como DRAFT con validación mínima
   * - Modo edición: actualiza la campaña con validación de campos esenciales (permite sin beneficio)
   */
  saveOrUpdate(): void {
    if (this.isEditMode()) {
      // Modo edición: validar únicamente campos esenciales para permitir "Sin beneficio (Solo promoción)"
      const titleControl = this.campaignForm.get('title');
      const startControl = this.campaignForm.get('startDate');
      const endControl = this.campaignForm.get('endDate');
      const rewardTypeControl = this.campaignForm.get('rewardType');
      const statusControl = this.campaignForm.get('status');

      const titleValid = !!titleControl?.value && titleControl.value.trim().length >= 3;
      const datesValid = !!startControl?.value && !!endControl?.value;

      if (!titleValid || !datesValid) {
        titleControl?.markAsTouched();
        startControl?.markAsTouched();
        endControl?.markAsTouched();
        this.messageService.add({
          severity: 'warn',
          summary: 'Formulario inválido',
          detail: 'Por favor, completa los campos requeridos (título y fechas)'
        });
        return;
      }

      // Validar que rewardType esté seleccionado al activar una campaña
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

      this.updateCampaignWithReward();
    } else {
      // Modo creación: validación mínima, siempre guardar como DRAFT
      const titleControl = this.campaignForm.get('title');

      if (!titleControl?.value || titleControl.value.trim().length < 3) {
        titleControl?.markAsTouched();
        this.messageService.add({
          severity: 'warn',
          summary: 'Título requerido',
          detail: 'Ingresa al menos un título para crear la campaña (mínimo 3 caracteres)'
        });
        return;
      }

      // Asegurar que el estado sea DRAFT
      this.campaignForm.patchValue({ status: 'DRAFT' }, { emitEvent: false });
      this.saveCampaignWithReward(true);
    }
  }

  /**
   * Obtiene el label del botón de acción según el contexto
   */
  getActionButtonLabel(): string {
    if (this.isEditMode()) {
      const status = this.campaignForm.get('status')?.value;
      return status === 'ACTIVE' ? 'Actualizar y Activar' : 'Guardar Cambios';
    }
    return 'Crear Campaña';
  }

  /**
   * Obtiene el icono del botón de acción según el contexto
   */
  getActionButtonIcon(): string {
    if (this.isEditMode()) {
      const status = this.campaignForm.get('status')?.value;
      return status === 'ACTIVE' ? 'pi pi-check-circle' : 'pi pi-save';
    }
    return 'pi pi-plus-circle';
  }

  private updateCampaignWithReward(): void {
    const campaignId = this.campaignId();

    if (!campaignId) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se encontró el ID de la campaña'
      });
      return;
    }

    const formValue = this.campaignForm.value;
    const currentStatus = this.campaignToEdit()?.status;
    const newStatus = formValue.status;
    const rewardType = formValue.rewardType;

    // Detectar si se está activando una campaña 2x1
    const isActivating = currentStatus !== 'ACTIVE' && newStatus === 'ACTIVE';
    const is2x1Campaign = rewardType === RewardType.BUY_X_GET_Y;

    if (isActivating && is2x1Campaign) {
      // Guardar el request pendiente y mostrar el modal de confirmación
      const updateRequest = this.buildUpdateRequest(formValue);
      this.pendingCampaignUpdate.set(updateRequest);
      this.showEmailConfirmationDialog.set(true);
      return;
    }

    // Si no es 2x1 o no se está activando, proceder normalmente
    const updateRequest = this.buildUpdateRequest(formValue);
    this.executeUpdateCampaign(updateRequest, false);
  }

  private saveCampaignWithReward(isDraft: boolean): void {
    this.saving.set(true);

    const formValue = this.campaignForm.value;
    const businessId = this.tenantId || 1;

    const request: CreateCampaignRequest = {
      templateId: this.template()?.id || null,
      businessId: businessId,
      title: formValue.title,
      subtitle: formValue.subtitle,
      description: formValue.description,
      imageUrl: this.uploadedImageUrl() || formValue.imageUrl,
      startDate: this.formatDateForBackend(formValue.startDate),
      endDate: this.formatDateForBackend(formValue.endDate),
      callToAction: formValue.callToAction || 'Obtener promoción',
      channels: formValue.channels,
      segmentation: formValue.segmentation,
      isAutomatic: formValue.isAutomatic,
      isDraft: isDraft,
      status: isDraft ? 'DRAFT' : 'ACTIVE'
    };

    const saveObservable = isDraft
      ? this.campaignService.saveDraft(request)
      : this.campaignService.create(request);

    saveObservable
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: any) => {
          const createdCampaignId = response.id;
          this.campaignId.set(createdCampaignId);

          // Si hay datos válidos de reward, crear el reward
          const rewardType = formValue.rewardType;
          if (rewardType && rewardType !== RewardType.NONE) {
            const rewardData: CreateRewardRequest = {
              rewardType: rewardType,
              description: formValue.rewardDescription,
              minPurchaseAmount: formValue.minPurchaseAmount,
              usageLimit: formValue.usageLimit
            };

            // Add type-specific fields
            switch (rewardType) {
              case RewardType.PERCENT_DISCOUNT:
              case RewardType.FIXED_AMOUNT:
                if (formValue.numericValue !== null && formValue.numericValue !== undefined) {
                  rewardData.numericValue = Number(formValue.numericValue);
                }
                break;
              case RewardType.FREE_PRODUCT:
                if (formValue.productId) {
                  const productId = typeof formValue.productId === 'number' ? formValue.productId : Number(formValue.productId);
                  if (!isNaN(productId) && productId > 0) {
                    rewardData.productId = productId;
                  }
                }
                break;
              case RewardType.BUY_X_GET_Y:
                // For 2x1 promotion: include productId (same product for buy and free)
                if (formValue.productId) {
                  const productId = typeof formValue.productId === 'number' ? formValue.productId : Number(formValue.productId);
                  if (!isNaN(productId) && productId > 0) {
                    rewardData.productId = productId;
                  }
                }
                if (formValue.buyQuantity) {
                  rewardData.buyQuantity = Number(formValue.buyQuantity);
                }
                if (formValue.freeQuantity) {
                  rewardData.freeQuantity = Number(formValue.freeQuantity);
                }
                break;
            }

            this.campaignService.createReward(createdCampaignId, rewardData)
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe({
                next: (reward) => {
                  this.currentReward.set(reward);
                  // Detectar si es campaña de bienvenida y está activa para mostrar confeti
                  const isWelcomeCampaign = this.template()?.id === 1;
                  const isActive = !isDraft;
                  console.log('[Confetti Debug] saveCampaignWithReward - templateId:', this.template()?.id, 'isWelcomeCampaign:', isWelcomeCampaign, 'isDraft:', isDraft, 'isActive:', isActive);

                  this.messageService.add({
                    severity: 'success',
                    summary: 'Éxito',
                    detail: isDraft
                      ? 'Borrador y beneficio guardados correctamente'
                      : 'Campaña y beneficio creados correctamente'
                  });
                  this.saving.set(false);
                  this.campaignSaved.set(true);

                  setTimeout(() => {
                    this.router.navigate(['/dashboard/campaigns'], {
                      state: { showWelcomeConfetti: isWelcomeCampaign && isActive }
                    });
                  }, 1500);
                },
                error: (err) => {
                  console.error('Error creating reward:', err);
                  this.messageService.add({
                    severity: 'success',
                    summary: 'Campaña guardada',
                    detail: isDraft
                      ? 'Borrador guardado pero hubo un error al guardar el beneficio'
                      : 'Campaña creada pero hubo un error al guardar el beneficio'
                  });
                  this.saving.set(false);
                  this.campaignSaved.set(true);

                  setTimeout(() => {
                    this.router.navigate(['/dashboard/campaigns']);
                  }, 1500);
                }
              });
          } else {
            // No hay reward type seleccionado o es NONE
            this.showSuccessAndNavigate(isDraft);
          }
        },
        error: (error) => {
          console.error('Error saving campaign:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.error?.message || `No se pudo guardar ${isDraft ? 'el borrador' : 'la campaña'}`
          });
          this.saving.set(false);
        }
      });
  }

  private showSuccessAndNavigate(isDraft: boolean): void {
    const isWelcomeCampaign = this.template()?.id === 1;
    const isActive = !isDraft;
    console.log('[Confetti Debug] showSuccessAndNavigate - templateId:', this.template()?.id, 'isWelcomeCampaign:', isWelcomeCampaign, 'isDraft:', isDraft, 'isActive:', isActive);

    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: isDraft
        ? 'Borrador guardado correctamente'
        : 'Campaña creada correctamente'
    });
    this.saving.set(false);
    this.campaignSaved.set(true);

    setTimeout(() => {
      this.router.navigate(['/dashboard/campaigns'], {
        state: { showWelcomeConfetti: isWelcomeCampaign && isActive }
      });
    }, 1500);
  }

  private updateCampaign(): void {
    const campaignId = this.campaignId();
    if (!campaignId) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se encontró el ID de la campaña'
      });
      return;
    }

    this.saving.set(true);
    const formValue = this.campaignForm.value;

    const updateRequest = {
      title: formValue.title,
      subtitle: formValue.subtitle,
      description: formValue.description,
      imageUrl: this.uploadedImageUrl() || formValue.imageUrl,
      promoType: formValue.promoType,
      promoValue: formValue.promoValue,
      startDate: this.formatDateForBackend(formValue.startDate),
      endDate: this.formatDateForBackend(formValue.endDate),
      callToAction: formValue.callToAction || 'Obtener promoción', // Texto fijo del botón
      channels: formValue.channels,
      segmentation: formValue.segmentation,
      isAutomatic: formValue.isAutomatic,
      status: formValue.status // Usar el estado seleccionado
    };

    // Incluir reward en el payload si existe en el formulario o ya existe en la campaña
    const existingReward = this.currentReward();
    const rewardType = formValue.rewardType;
    if (rewardType && rewardType !== RewardType.NONE) {
      const rewardPayload: any = {
        rewardType,
        description: formValue.rewardDescription
      };

      // Add type-specific fields based on reward type
      if (rewardType === RewardType.PERCENT_DISCOUNT || rewardType === RewardType.FIXED_AMOUNT) {
        rewardPayload.numericValue = formValue.numericValue;
      }
      if (rewardType === RewardType.FREE_PRODUCT) {
        rewardPayload.productId = formValue.productId;
      }
      if (rewardType === RewardType.BUY_X_GET_Y) {
        rewardPayload.buyQuantity = formValue.buyQuantity;
        rewardPayload.freeQuantity = formValue.freeQuantity;
      }
      if (rewardType === RewardType.CUSTOM) {
        rewardPayload.customConfig = formValue.customConfig;
      }

      // Add optional fields if present
      if (formValue.minPurchaseAmount) {
        rewardPayload.minPurchaseAmount = formValue.minPurchaseAmount;
      }
      if (formValue.usageLimit) {
        rewardPayload.usageLimit = formValue.usageLimit;
      }

      (updateRequest as any).reward = rewardPayload;
    }

    this.campaignService.updateCampaign(campaignId, updateRequest as any)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const isWelcomeCampaign = this.template()?.id === 1;
          const isNowActive = formValue.status === 'ACTIVE';
          console.log('[Confetti Debug] updateCampaign - templateId:', this.template()?.id, 'isWelcomeCampaign:', isWelcomeCampaign, 'status:', formValue.status, 'isNowActive:', isNowActive);

          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Campaña actualizada correctamente'
          });
          this.saving.set(false);
          this.campaignSaved.set(true);

          // Pequeño delay para que el usuario vea el mensaje antes de navegar
          setTimeout(() => {
            this.router.navigate(['/dashboard/campaigns'], {
              state: { showWelcomeConfetti: isWelcomeCampaign && isNowActive }
            });
          }, 1500);

          // If there was a pending reward request (created before campaign existed), attach it now
          const createdCampaignId = (response as any)?.id;
          if (createdCampaignId && this.pendingRewardRequest) {
            this.campaignService.createReward(createdCampaignId, this.pendingRewardRequest)
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe({
                next: (reward) => {
                  this.currentReward.set(reward);
                  this.messageService.add({ severity: 'success', summary: 'Beneficio guardado', detail: 'El beneficio pendiente fue adjuntado a la campaña' });
                  this.pendingRewardRequest = null;
                },
                error: (err) => {
                  console.error('Error creating pending reward:', err);
                  this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar el beneficio pendiente' });
                }
              });
          }

          // Pequeño delay para que el usuario vea el mensaje antes de navegar
          setTimeout(() => {
            this.router.navigate(['/dashboard/campaigns']);
          }, 1500);
        },
        error: (error) => {
          console.error('Error updating campaign:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.error?.message || 'No se pudo actualizar la campaña'
          });
          this.saving.set(false);
        }
      });
  }

  private saveCampaign(isDraft: boolean): void {
    this.saving.set(true);

    const formValue = this.campaignForm.value;
    const businessId = this.tenantId || 1;

    const request: CreateCampaignRequest = {
      templateId: this.template()?.id || null,
      businessId: businessId,
      title: formValue.title,
      subtitle: formValue.subtitle,
      description: formValue.description,
      imageUrl: this.uploadedImageUrl() || formValue.imageUrl,
      startDate: this.formatDateForBackend(formValue.startDate),
      endDate: this.formatDateForBackend(formValue.endDate),
      callToAction: formValue.callToAction || 'Obtener promoción', // Texto fijo del botón
      channels: formValue.channels,
      segmentation: formValue.segmentation,
      isAutomatic: formValue.isAutomatic,
      isDraft: isDraft,
      status: isDraft ? 'DRAFT' : 'ACTIVE'
    };

    // Usar el método apropiado según si es borrador o campaña final
    const saveObservable = isDraft
      ? this.campaignService.saveDraft(request)
      : this.campaignService.create(request);

    saveObservable
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: isDraft
              ? 'Borrador guardado correctamente. Puedes completarlo más tarde.'
              : 'Campaña creada correctamente'
          });
          this.saving.set(false);
          this.campaignSaved.set(true);

          // Pequeño delay para que el usuario vea el mensaje antes de navegar
          setTimeout(() => {
            this.router.navigate(['/dashboard/campaigns']);
          }, 1500);
        },
        error: (error) => {
          console.error('Error saving campaign:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.error?.message || `No se pudo guardar ${isDraft ? 'el borrador' : 'la campaña'}`
          });
          this.saving.set(false);
        }
      });
  }

  openPreview(): void {
    this.previewDialogVisible.set(true);
  }

  goBack(): void {
    this.router.navigate(['/dashboard/campaigns']);
  }

  private getEmptyPreview(): CampaignPreviewData {
    return {
      title: 'Título de la campaña',
      description: 'Descripción de la campaña',
      buttonText: 'Obtener promoción'
    };
  }

  // Utility methods for template
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

  onChannelsChange(event: any): void {
    const value = event.target.value;
    if (value) {
      const channels = value.split(',').map((c: string) => c.trim()).filter((c: string) => c);
      this.campaignForm.patchValue({ channels }, { emitEvent: false });
    }
  }

  onRewardSaved(reward: RewardResponse): void {
    this.currentReward.set(reward);
    this.messageService.add({
      severity: 'success',
      summary: 'Beneficio guardado',
      detail: 'El beneficio se ha guardado correctamente'
    });
  }

  onPendingReward(request: CreateRewardRequest): void {
    // When a reward is configured but no campaign exists yet, save the campaign as DRAFT first
    // Then attach the reward to it

    if (this.campaignForm.invalid) {
      this.campaignForm.markAllAsTouched();
      this.messageService.add({
        severity: 'warn',
        summary: 'Formulario incompleto',
        detail: 'Por favor, completa los campos requeridos de la campaña antes de guardar el beneficio'
      });
      return;
    }

    this.saving.set(true);

    const formValue = this.campaignForm.value;
    const businessId = this.tenantId || 1;

    const campaignRequest: CreateCampaignRequest = {
      templateId: this.template()?.id || null,
      businessId: businessId,
      title: formValue.title,
      subtitle: formValue.subtitle,
      description: formValue.description,
      imageUrl: this.uploadedImageUrl() || formValue.imageUrl,
      startDate: this.formatDateForBackend(formValue.startDate),
      endDate: this.formatDateForBackend(formValue.endDate),
      callToAction: formValue.callToAction || 'Obtener promoción',
      channels: formValue.channels,
      segmentation: formValue.segmentation,
      isAutomatic: formValue.isAutomatic,
      isDraft: true, // Save as draft
      status: 'DRAFT'
    };

    // First save the campaign as draft
    this.campaignService.saveDraft(campaignRequest)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (campaignResponse: any) => {
          const createdCampaignId = campaignResponse.id;
          this.campaignId.set(createdCampaignId);
          this.isEditMode.set(true);

          // Now create the reward with the campaign ID
          this.campaignService.createReward(createdCampaignId, request)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (rewardResponse) => {
                this.currentReward.set(rewardResponse);
                this.saving.set(false);
                this.messageService.add({
                  severity: 'success',
                  summary: 'Éxito',
                  detail: 'Campaña guardada como borrador y beneficio configurado correctamente'
                });
              },
              error: (error) => {
                console.error('Error creating reward:', error);
                this.saving.set(false);
                this.messageService.add({
                  severity: 'error',
                  summary: 'Error',
                  detail: error.error?.message || 'No se pudo crear el beneficio'
                });
              }
            });
        },
        error: (error) => {
          console.error('Error saving draft campaign:', error);
          this.saving.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.error?.message || 'No se pudo guardar la campaña como borrador'
          });
        }
      });
  }

  getRewardSummary(): string {
    // If the selected reward type is NONE, show explicit message
    if (this.selectedRewardType === RewardType.NONE) {
      // Prefer any existing description; otherwise a default message
      const desc = this.campaignForm.get('rewardDescription')?.value;
      return desc ? desc : 'Sin beneficio (Solo promoción)';
    }

    const reward = this.currentReward();
    if (!reward) return 'No configurado';

    switch (reward.rewardType) {
      case 'PERCENT_DISCOUNT':
        return `Descuento ${reward.numericValue}%`;
      case 'FIXED_AMOUNT':
        return `Descuento $${reward.numericValue}`;
      case 'FREE_PRODUCT':
        return `Producto Gratis (ID ${reward.productId})`;
      case 'BUY_X_GET_Y':
        return `Compra ${reward.buyQuantity} lleva ${reward.freeQuantity} gratis`;
      case 'CUSTOM':
        return reward.description || 'Beneficio personalizado';
      case 'NONE':
        // If backend returned a NONE reward, show its description or default
        return reward.description || 'Sin beneficio (Solo promoción)';
      default:
        return 'Beneficio configurado';
    }
  }

  private formatDateForBackend(date: Date | null | undefined): string | null {
    if (!date) return null;

    // Asegurar que sea un objeto Date
    const dateObj = date instanceof Date ? date : new Date(date);

    // Verificar que la fecha sea válida
    if (isNaN(dateObj.getTime())) return null;

    // Formatear a yyyy-MM-dd
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private scrollAndFocusStatus(): void {
    if (this.statusSelect?.nativeElement) {
      const element = this.statusSelect.nativeElement;

      // Scroll suave al elemento
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Marcar el campo como touched para mostrar validaciones
      const statusControl = this.campaignForm.get('status');
      if (statusControl) {
        statusControl.markAsTouched();
      }

      // Dar foco al select (buscar el elemento interno del p-select)
      setTimeout(() => {
        const selectElement = element.querySelector('input, button, [role="combobox"]');
        if (selectElement) {
          (selectElement as HTMLElement).focus();
          // Intentar abrir el dropdown si es posible
          (selectElement as HTMLElement).click();
        }
      }, 600);
    }
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
        // Clear values from fields that no longer apply to the new type.
        // This runs only for user-driven changes; programmatic loads use emitEvent:false.
        this.clearRewardFieldValues(type);
        this.updateRewardValidators(type);

        // Load product tree when a product-based reward type is selected
        if (type === RewardType.FREE_PRODUCT || type === RewardType.BUY_X_GET_Y) {
          if (this.productTree.length === 0) {
            this.lastLoadedTenantId = null;
          }
          this.loadProductTree(this.tenantId ?? undefined);
        }

        // Default quantities for 2x1 if not yet set
        if (type === RewardType.BUY_X_GET_Y) {
          if (!this.campaignForm.get('buyQuantity')?.value) {
            this.campaignForm.patchValue({ buyQuantity: 1 }, { emitEvent: false });
          }
          if (!this.campaignForm.get('freeQuantity')?.value) {
            this.campaignForm.patchValue({ freeQuantity: 1 }, { emitEvent: false });
          }
        }
      });
  }

  /**
   * Clears reward field values that do not apply to the newly selected reward type.
   * Only called for user-driven type changes (not during programmatic form population).
   */
  private clearRewardFieldValues(newType: RewardType): void {
    const patch: Partial<Record<string, null>> = {};

    if (newType !== RewardType.PERCENT_DISCOUNT && newType !== RewardType.FIXED_AMOUNT) {
      patch['numericValue'] = null;
    }

    if (newType !== RewardType.FREE_PRODUCT && newType !== RewardType.BUY_X_GET_Y) {
      patch['productId'] = null;
      this.selectedProductNode = null;
    }

    if (newType !== RewardType.BUY_X_GET_Y) {
      patch['buyQuantity'] = null;
      patch['freeQuantity'] = null;
    }

    if (Object.keys(patch).length > 0) {
      this.campaignForm.patchValue(patch, { emitEvent: false });
    }
  }

  /**
   * Updates form validators based on the selected reward type.
   * Does NOT modify field values — use clearRewardFieldValues() for that.
   */
  private updateRewardValidators(rewardType: RewardType): void {
    if (this.isUpdatingValidators) return;
    this.isUpdatingValidators = true;

    try {
      const rewardFields = ['numericValue', 'productId', 'buyQuantity', 'freeQuantity', 'rewardDescription', 'minPurchaseAmount', 'usageLimit'];
      rewardFields.forEach(field => this.campaignForm.get(field)?.clearValidators());

      switch (rewardType) {
        case RewardType.NONE:
          // Description is required so promotional-only campaigns have a message
          this.campaignForm.get('rewardDescription')?.setValidators([Validators.required, Validators.maxLength(500)]);
          break;

        case RewardType.PERCENT_DISCOUNT:
          this.campaignForm.get('numericValue')?.setValidators([Validators.required, Validators.min(0.01), Validators.max(100)]);
          this.campaignForm.get('rewardDescription')?.setValidators([Validators.required, Validators.maxLength(500)]);
          break;

        case RewardType.FIXED_AMOUNT:
          this.campaignForm.get('numericValue')?.setValidators([Validators.required, Validators.min(0.01)]);
          this.campaignForm.get('rewardDescription')?.setValidators([Validators.required, Validators.maxLength(500)]);
          break;

        case RewardType.FREE_PRODUCT:
          this.campaignForm.get('productId')?.setValidators([Validators.required]);
          this.campaignForm.get('rewardDescription')?.setValidators([Validators.required, Validators.maxLength(500)]);
          break;

        case RewardType.BUY_X_GET_Y:
          this.campaignForm.get('productId')?.setValidators([Validators.required]);
          this.campaignForm.get('buyQuantity')?.setValidators([Validators.required, Validators.min(1)]);
          this.campaignForm.get('freeQuantity')?.setValidators([Validators.required, Validators.min(1)]);
          this.campaignForm.get('rewardDescription')?.setValidators([Validators.required, Validators.maxLength(500)]);
          break;

        case RewardType.CUSTOM:
          this.campaignForm.get('rewardDescription')?.setValidators([Validators.required, Validators.maxLength(500)]);
          break;
      }

      this.campaignForm.get('rewardDescription')?.enable({ emitEvent: false });
      rewardFields.forEach(field => this.campaignForm.get(field)?.updateValueAndValidity({ emitEvent: false }));
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

    // Si hay un productId en el formulario, seleccionarlo ahora que el árbol está cargado
    const productId = this.campaignForm.get('productId')?.value;
    if (productId && Number(productId) > 0) {
      this.setSelectedProductNode(Number(productId));
    }
  }

  onProductTreeSelect(node: TreeNode | null): void {
    if (node && node.key) {
      const productId = typeof node.key === 'number' ? node.key : Number(node.key);
      if (!isNaN(productId) && productId > 0) {
        this.campaignForm.get('productId')?.setValue(productId);
        this.selectedProductNode = node;
        console.debug('[onProductTreeSelect]', { node, productId });
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

  /**
   * Construye el request de actualización de campaña
   */
  private buildUpdateRequest(formValue: any): any {
    // Determinar promoType basado en el rewardType seleccionado
    let promoType = formValue.promoType;
    if (this.selectedRewardType === RewardType.NONE) {
      promoType = 'NONE';
    }

    const updateRequest: any = {
      title: formValue.title,
      subtitle: formValue.subtitle,
      description: promoType === 'NONE' ? formValue.rewardDescription : formValue.description,
      imageUrl: this.uploadedImageUrl() || formValue.imageUrl,
      promoType: promoType,
      promoValue: formValue.promoValue,
      startDate: this.formatDateForBackend(formValue.startDate),
      endDate: this.formatDateForBackend(formValue.endDate),
      callToAction: formValue.callToAction || 'Obtener promoción',
      channels: formValue.channels,
      segmentation: formValue.segmentation,
      isAutomatic: formValue.isAutomatic,
      status: formValue.status
    };

    // Incluir reward solo si no es NONE
    if (this.selectedRewardType !== RewardType.NONE && formValue.rewardType) {
      const rewardPayload: any = {
        rewardType: formValue.rewardType,
        description: formValue.rewardDescription,
        minPurchaseAmount: formValue.minPurchaseAmount,
        usageLimit: formValue.usageLimit
      };

      // Add type-specific fields
      switch (formValue.rewardType) {
        case RewardType.PERCENT_DISCOUNT:
        case RewardType.FIXED_AMOUNT:
          if (formValue.numericValue !== null && formValue.numericValue !== undefined) {
            rewardPayload.numericValue = Number(formValue.numericValue);
          }
          break;
        case RewardType.FREE_PRODUCT:
          if (formValue.productId) {
            const productId = typeof formValue.productId === 'number' ? formValue.productId : Number(formValue.productId);
            if (!isNaN(productId) && productId > 0) {
              rewardPayload.productId = productId;
            }
          }
          break;
        case RewardType.BUY_X_GET_Y:
          if (formValue.buyQuantity) {
            rewardPayload.buyQuantity = Number(formValue.buyQuantity);
          }
          if (formValue.freeQuantity) {
            rewardPayload.freeQuantity = Number(formValue.freeQuantity);
          }
          break;
      }

      updateRequest.reward = rewardPayload;
    }

    return updateRequest;
  }

  /**
   * Ejecuta la actualización de la campaña y opcionalmente envía emails
   */
  private executeUpdateCampaign(updateRequest: any, shouldSendEmails: boolean = false): void {
    const campaignId = this.campaignId();
    if (!campaignId) return;

    this.saving.set(true);

    this.campaignService.updateCampaign(campaignId, updateRequest)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          console.log('[Campaign] Campaña actualizada:', response);
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Campaña actualizada correctamente'
          });

          // Si se debe enviar emails, llamar al endpoint
          if (shouldSendEmails) {
            this.sendCampaignEmails(campaignId);
          } else {
            this.saving.set(false);
            this.campaignSaved.set(true);
            this.navigateToListWithToast();
          }
        },
        error: (err) => {
          console.error('[Campaign] Error actualizando campaña:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Error al actualizar la campaña'
          });
          this.saving.set(false);
        }
      });
  }

  /**
   * Envía los emails masivos de la campaña
   */
  private sendCampaignEmails(campaignId: number): void {
    this.campaignService.sendMassiveEmails(campaignId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          console.log('[Campaign] Emails enviados:', response);
          this.saving.set(false);
          this.campaignSaved.set(true);
          this.navigateToListWithToast(true);
        },
        error: (err) => {
          console.error('[Campaign] Error enviando emails:', err);
          const errorMessage = err?.error?.message || err?.message || 'Error al iniciar el envío de emails';
          this.messageService.add({
            severity: 'warn',
            summary: 'Campaña activada',
            detail: `La campaña se activó correctamente, pero hubo un problema al enviar los emails: ${errorMessage}`
          });
          this.saving.set(false);
          this.navigateToListWithToast(false);
        }
      });
  }

  /**
   * Navega al listado de campañas con un toast informativo
   */
  private navigateToListWithToast(emailsSent: boolean = false): void {
    setTimeout(() => {
      this.router.navigate(['/dashboard/campaigns']).then(() => {
        if (emailsSent) {
          this.messageService.add({
            severity: 'info',
            summary: 'Proceso en curso',
            detail: 'El envío de emails se está procesando. Esto puede tardar unos minutos dependiendo del tamaño de tu audiencia.',
            life: 6000
          });
        }
      });
    }, 1000);
  }

  /**
   * Confirma el envío de emails desde el modal
   */
  confirmEmailSend(): void {
    const updateRequest = this.pendingCampaignUpdate();
    if (!updateRequest) return;

    this.showEmailConfirmationDialog.set(false);
    this.executeUpdateCampaign(updateRequest, true);
  }

  /**
   * Cancela el envío de emails desde el modal
   */
  cancelEmailSend(): void {
    this.showEmailConfirmationDialog.set(false);
    this.pendingCampaignUpdate.set(null);
  }
}
