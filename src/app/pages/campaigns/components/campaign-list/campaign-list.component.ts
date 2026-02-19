import { Component, OnInit, signal, computed, inject, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ChipModule } from 'primeng/chip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { FloatLabelModule } from 'primeng/floatlabel';
import { ToolbarModule } from 'primeng/toolbar';
import { SelectModule } from 'primeng/select';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { CampaignResponse, CreateCampaignRequest, UpdateCampaignRequest, CampaignWithValidation, CampaignValidationResult } from '@/models/campaign.model';
import { CampaignStatus } from '@/models/enums';
import { CampaignService } from '../../services/campaign.service';
import { TenantService } from '@/pages/admin-page/service/tenant.service';
import { CampaignDialogComponent } from '../campaign-dialog/campaign-dialog.component';
import { ProductService } from '@/pages/products-menu/service/product.service';
import { CampaignFormatters } from '../../utils/formatters';
import { ConfettiService } from '@/confetti/confetti.service';
import { ConfettiComponent } from '@/confetti/confetti.component';

interface TableColumn {
    field: string;
    header: string;
}

@Component({
    selector: 'app-campaign-list',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        TableModule,
        InputTextModule,
        ChipModule,
        ConfirmDialogModule,
        FloatLabelModule,
        ToolbarModule,
        IconFieldModule,
        InputIconModule,
        SelectModule,
        ToastModule,
        TooltipModule,
        DialogModule,
        CampaignDialogComponent,
        ConfettiComponent
    ],
    providers: [ConfirmationService, MessageService],
    templateUrl: './campaign-list.component.html',
    styleUrls: ['./campaign-list.component.scss']
})
export class CampaignListComponent implements OnInit {
    campaigns = signal<CampaignResponse[]>([]);
    campaignsWithValidation = signal<CampaignWithValidation[]>([]);
    selectedCampaigns: CampaignResponse[] = [];
    loading = signal<boolean>(true);
    searchText = '';
    selectedStatus: string | null = null;
    showOnlyIncomplete = false;
    email: string = '';
    userId: number = 0;
    tenantId: number = 0;
    businessId: number = 0;
    showWelcomeBanner = signal<boolean>(false);
    bannerMessage = signal<{ title: string; description: string; buttonText: string }>(
        { title: '', description: '', buttonText: '' }
    );
    // Welcome campaign confetti
    showWelcomeConfetti = signal<boolean>(false);

    // Dialog state
    campaignDialog = signal<boolean>(false);
    selectedCampaign = signal<CampaignResponse | null>(null);
    submitted = signal<boolean>(false);
    isEditMode = signal<boolean>(false);

    // Inject DestroyRef for takeUntilDestroyed
    private destroyRef = inject(DestroyRef);

    columns: TableColumn[] = [
        { field: 'title', header: 'Título' },
        { field: 'promoType', header: 'Tipo' },
        { field: 'status', header: 'Estado' },
        { field: 'startDate', header: 'Fechas' },
        { field: 'channels', header: 'Canales' }
    ];

    statusOptions = [
        { label: 'Borrador', value: CampaignStatus.DRAFT },
        { label: 'Activa', value: CampaignStatus.ACTIVE },
        { label: 'Inactiva', value: CampaignStatus.INACTIVE },
        { label: 'Programada', value: CampaignStatus.SCHEDULED }
    ];

    filteredCampaigns = computed(() => {
        let filtered = this.campaignsWithValidation();

        // Filter by search text
        if (this.searchText) {
            const search = this.searchText.toLowerCase();
            filtered = filtered.filter((item) =>
                item.campaign.title.toLowerCase().includes(search) ||
                item.campaign.subtitle?.toLowerCase().includes(search) ||
                item.campaign.description?.toLowerCase().includes(search)
            );
        }

        // Filter by status
        if (this.selectedStatus) {
            filtered = filtered.filter((item) => item.campaign.status === this.selectedStatus);
        }

        // Filter by incomplete campaigns
        if (this.showOnlyIncomplete) {
            filtered = filtered.filter((item) => !item.validation.configComplete);
        }

        // Sort: incomplete campaigns first
        filtered = filtered.sort((a, b) => {
            if (a.validation.configComplete === b.validation.configComplete) {
                return 0;
            }
            return a.validation.configComplete ? 1 : -1;
        });

        return filtered;
    });

    constructor(
        private campaignService: CampaignService,
        private confirmationService: ConfirmationService,
        private messageService: MessageService,
        private router: Router,
        private tenantService: TenantService,
        private productService: ProductService,
        private confettiService: ConfettiService
    ) {}

    ngOnInit(): void {
        const userStr = sessionStorage.getItem('usuario') ?? localStorage.getItem('usuario');
        if (userStr) {
            try {
                const userObj = JSON.parse(userStr);
                if (userObj && userObj.userEmail) {
                    this.email = String(userObj.userEmail || '').trim();
                    this.userId = userObj.userId;
                }
            } catch (e) {
                console.warn('Failed to parse stored usuario:', e);
            }
        }
        this.tenantService.getTenantByEmail(this.email).subscribe({
            next: (tenant: any) => {
                if (tenant) {
                    this.tenantId = tenant.object.id ?? 0;
                    this.businessId = this.tenantId;
                }
                this.loadCampaigns();
                this.checkBannerConditions();
                // Check if we should show welcome confetti after data loads
                setTimeout(() => this.checkForWelcomeConfetti(), 500);
            },
            error: (error) => {
                console.error('No tenant found:');
            }
        });
    }

    private loadCampaigns(): void {
        this.loading.set(true);
        this.campaignService
            .getCampaignsWithValidation(this.businessId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (campaignsWithValidation) => {
                    this.campaignsWithValidation.set(campaignsWithValidation);
                    // También actualizar la lista de campañas sin validación para compatibilidad
                    this.campaigns.set(campaignsWithValidation.map(item => item.campaign));
                    this.loading.set(false);
                },
                error: (error) => {
                    console.error('Error loading campaigns:', error);
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'No se pudieron cargar las campañas con validación'
                    });
                    this.loading.set(false);
                }
            });
    }

    onSearchChange(event: any): void {
        this.searchText = event.target.value;
    }

    onStatusChange(): void {
        // El computed se actualizará automáticamente
    }

    refreshData(): void {
        this.loadCampaigns();
    }

    createNewCampaign(): void {
        // Navegar a la pantalla completa de creación de campaña
        this.router.navigate(['/dashboard/campaigns/create']);
    }

    editCampaign(campaign: CampaignResponse): void {
        // Navegar al componente de creación con el ID de la campaña para editarla
        this.router.navigate(['/dashboard/campaigns/create'], {
            queryParams: { id: campaign.id }
        });
    }

    hideCampaignDialog(): void {
        this.campaignDialog.set(false);
        this.submitted.set(false);
    }

    saveCampaign(campaignDialog: any): void {
        this.submitted.set(true);

        if (campaignDialog.campaignForm.invalid) {
            campaignDialog.campaignForm.markAllAsTouched();
            return;
        }

        campaignDialog.setSaving(true);

        if (this.isEditMode()) {
            this.updateCampaign(campaignDialog);
        } else {
            this.createCampaignRequest(campaignDialog);
        }
    }

    private createCampaignRequest(campaignDialog: any): void {
        const formValue = campaignDialog.getFormValue();

        const request: CreateCampaignRequest = {
            templateId: campaignDialog.getSelectedTemplateId(),
            businessId: this.businessId,
            title: formValue.title,
            subtitle: formValue.subtitle,
            description: formValue.description,
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
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (campaign) => {
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Éxito',
                        detail: 'Campaña creada exitosamente'
                    });
                    this.loadCampaigns();
                    this.hideCampaignDialog();
                    campaignDialog.setSaving(false);
                },
                error: (error) => {
                    console.error('Error creating campaign:', error);
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'No se pudo crear la campaña'
                    });
                    campaignDialog.setSaving(false);
                }
            });
    }

    private updateCampaign(campaignDialog: any): void {
        const formValue = campaignDialog.getFormValue();
        const campaignId = this.selectedCampaign()?.id;

        if (!campaignId) {
            return;
        }

        const request: UpdateCampaignRequest = {
            title: formValue.title,
            subtitle: formValue.subtitle,
            description: formValue.description,
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

        this.campaignService.update(campaignId, request)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (campaign) => {
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Éxito',
                        detail: 'Campaña actualizada exitosamente'
                    });
                    this.loadCampaigns();
                    this.hideCampaignDialog();
                    campaignDialog.setSaving(false);
                },
                error: (error) => {
                    console.error('Error updating campaign:', error);
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'No se pudo actualizar la campaña'
                    });
                    campaignDialog.setSaving(false);
                }
            });
    }

    deleteCampaign(campaign: CampaignResponse): void {
        this.confirmationService.confirm({
            message: `¿Estás seguro de que quieres eliminar la campaña "${campaign.title}"?`,
            header: 'Confirmar eliminación',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.campaignService
                    .delete(campaign.id)
                    .pipe(takeUntilDestroyed(this.destroyRef))
                    .subscribe({
                        next: () => {
                            // Remover de la lista (actualizar both campaigns y campaignsWithValidation)
                            const currentCampaigns = this.campaigns();
                            this.campaigns.set(currentCampaigns.filter((c) => c.id !== campaign.id));

                            const currentWithValidation = this.campaignsWithValidation();
                            this.campaignsWithValidation.set(currentWithValidation.filter((item) => item.campaign.id !== campaign.id));

                            this.messageService.add({
                                severity: 'success',
                                summary: 'Éxito',
                                detail: 'Campaña eliminada exitosamente'
                            });
                        },
                        error: (error) => {
                            console.error('Error deleting campaign:', error);
                            this.messageService.add({
                                severity: 'error',
                                summary: 'Error',
                                detail: 'No se pudo eliminar la campaña'
                            });
                        }
                    });
            }
        });
    }

    deleteSelectedCampaigns(): void {
        if (!this.selectedCampaigns || !this.selectedCampaigns.length) {
            return;
        }

        const count = this.selectedCampaigns.length;
        this.confirmationService.confirm({
            message: `¿Estás seguro de que quieres eliminar ${count} campaña${count > 1 ? 's' : ''}?`,
            header: 'Confirmar eliminación múltiple',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                const deletePromises = this.selectedCampaigns.map(campaign =>
                    this.campaignService.delete(campaign.id).toPromise()
                );

                Promise.all(deletePromises)
                    .then(() => {
                            // Remover campañas eliminadas de la lista (actualizar campaigns y campaignsWithValidation)
                            const currentCampaigns = this.campaigns();
                            const selectedIds = this.selectedCampaigns.map(c => c.id);
                            this.campaigns.set(currentCampaigns.filter(c => !selectedIds.includes(c.id)));

                            const currentWithValidation = this.campaignsWithValidation();
                            this.campaignsWithValidation.set(currentWithValidation.filter(item => !selectedIds.includes(item.campaign.id)));

                            this.selectedCampaigns = [];
                            this.messageService.add({
                                severity: 'success',
                                summary: 'Éxito',
                                detail: `${count} campaña${count > 1 ? 's eliminadas' : ' eliminada'} exitosamente`
                            });
                        })
                    .catch((error) => {
                        console.error('Error deleting campaigns:', error);
                        this.messageService.add({
                            severity: 'error',
                            summary: 'Error',
                            detail: 'No se pudieron eliminar todas las campañas'
                        });
                    });
            }
        });
    }

    getStatusLabel(status: string): string {
        const option = this.statusOptions.find((opt) => opt.value === status);
        return option?.label || status;
    }

    getStatusStyle(status: string): any {
        switch (status) {
            case CampaignStatus.ACTIVE:
                return { 'background-color': '#10b981', color: 'white' };
            case CampaignStatus.INACTIVE:
                return { 'background-color': '#ef4444', color: 'white' };
            case CampaignStatus.SCHEDULED:
                return { 'background-color': '#3b82f6', color: 'white' };
            case CampaignStatus.DRAFT:
            default:
                return { 'background-color': '#6b7280', color: 'white' };
        }
    }

    /**
     * Retorna un mensaje tooltip apropiado según el estado de validación
     */
    getTooltipMessage(validation: CampaignValidationResult): string {
        if (validation.configComplete) {
            return '✓ Campaña lista para activar';
        }

        if (validation.missingItems.length === 0) {
            return 'Pendiente de validación';
        }

        return 'Elementos faltantes:\n• ' + validation.missingItems.join('\n• ');
    }

    /**
     * Toggle para mostrar solo campañas incompletas
     */
    toggleIncompleteFilter(): void {
        this.showOnlyIncomplete = !this.showOnlyIncomplete;
    }

    /**
     * Obtiene el conteo de campañas incompletas
     */
    getIncompleteCount(): number {
        return this.campaignsWithValidation().filter(item => !item.validation.configComplete).length;
    }

    private checkBannerConditions(): void {
        if (this.tenantId === 0) return;

        forkJoin({
            products: this.productService.getProductsByTenantId(this.tenantId),
            welcomeStatus: this.campaignService.getWelcomeCampaignStatus(this.tenantId)
        }).subscribe({
            next: ({ products, welcomeStatus }) => {
                const productCount = Array.isArray(products) ? products.length : (products?.object?.length ?? 0);
                const hasProducts = productCount > 0;
                const campaignExists = welcomeStatus?.exists ?? false;
                const campaignStatus = welcomeStatus?.status;

                console.debug('[Banner][campaign-list] tenantId=', this.tenantId, 'productCount=', productCount, 'welcomeStatus=', welcomeStatus);

                if (!hasProducts || (campaignExists && campaignStatus === 'ACTIVE')) {
                    this.showWelcomeBanner.set(false);
                    return;
                }

                if (!campaignExists) {
                    this.showWelcomeBanner.set(true);
                    this.bannerMessage.set({
                        title: 'Tu negocio ya está listo.',
                        description: 'Ahora configura tu campaña de bienvenida para empezar a recibir clientes.',
                        buttonText: 'Configurar campaña de bienvenida'
                    });
                } else if (campaignStatus === 'DRAFT') {
                    this.showWelcomeBanner.set(true);
                    this.bannerMessage.set({
                        title: '¡Ya casi está todo listo!',
                        description: 'Tienes una campaña de bienvenida guardada como borrador. Actívala para comenzar a recibir clientes.',
                        buttonText: 'Activar campaña de bienvenida'
                    });
                }
            },
            error: (err) => {
                console.warn('[Banner][campaign-list] welcome-status failed, falling back to campaigns list', err);
                this.productService.getProductsByTenantId(this.tenantId).subscribe({
                    next: (productsResp) => {
                        const productCount = Array.isArray(productsResp) ? productsResp.length : (productsResp?.object?.length ?? 0);
                        const hasProducts = productCount > 0;

                        this.campaignService.getByBusiness(this.tenantId).subscribe({
                            next: (campaigns) => {
                                const welcomeCampaigns = (campaigns || []).filter(c => c.template?.id === 1);
                                const active = welcomeCampaigns.some(c => c.status === 'ACTIVE');
                                const draft = !active && welcomeCampaigns.some(c => c.status === 'DRAFT');

                                if (!hasProducts || active) { this.showWelcomeBanner.set(false); return; }

                                if (welcomeCampaigns.length === 0) {
                                    this.showWelcomeBanner.set(true);
                                    this.bannerMessage.set({ title: 'Tu negocio ya está listo.', description: 'Ahora configura tu campaña de bienvenida para empezar a recibir clientes.', buttonText: 'Configurar campaña de bienvenida' });
                                } else if (draft) {
                                    this.showWelcomeBanner.set(true);
                                    this.bannerMessage.set({ title: '¡Ya casi está todo listo!', description: 'Tienes una campaña de bienvenida guardada como borrador. Actívala para comenzar a recibir clientes.', buttonText: 'Activar campaña de bienvenida' });
                                }
                            },
                            error: (e2) => { console.error('[Banner][campaign-list] fallback getByBusiness failed', e2); this.showWelcomeBanner.set(false); }
                        });
                    },
                    error: (e3) => { console.error('[Banner][campaign-list] fallback getProducts failed', e3); this.showWelcomeBanner.set(false); }
                });
            }
        });
    }

    navigateToWelcomeCampaign(): void {
        this.campaignService.getByBusiness(this.tenantId).subscribe({
            next: (campaigns) => {
                const draftWelcome = (campaigns || []).find(c => c.template?.id === 1 && c.status === 'DRAFT');
                if (draftWelcome) {
                    this.router.navigate(['/dashboard/campaigns/create'], { queryParams: { id: draftWelcome.id, focusStatus: 'true' } });
                } else {
                    this.router.navigate(['/dashboard/campaigns/create'], { queryParams: { templateId: 1 } });
                }
            },
            error: () => { this.router.navigate(['/dashboard/campaigns/create'], { queryParams: { templateId: 1 } }); }
        });
    }

    private checkForWelcomeConfetti(): void {
        const navigation = this.router.getCurrentNavigation();
        const state = navigation?.extras?.state || window.history.state;

        console.log('[Confetti Debug] checkForWelcomeConfetti - state:', state);

        if (state?.showWelcomeConfetti) {
            console.log('[Confetti Debug] Showing welcome confetti!');
            // Wait a bit for table to render before showing confetti
            setTimeout(() => {
                this.confettiService.trigger({ action: 'burst' });
                this.showWelcomeConfetti.set(true);
            }, 300);
        }
    }

    closeWelcomeConfetti(): void {
        this.showWelcomeConfetti.set(false);
    }
}
