import { Component, ChangeDetectorRef, OnInit, signal, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { FileUploadModule } from 'primeng/fileupload';
import { InputTextModule } from 'primeng/inputtext';
import { EditorModule } from 'primeng/editor';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputGroupModule } from 'primeng/inputgroup';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { StepperModule } from 'primeng/stepper';
import { MessageModule } from 'primeng/message';
import { Tenant } from '../model/tenat.component';
import { TenantService } from './service/tenant.service';
import { ImageService } from '../service/image.service';
import { ConfettiService } from '@/confetti/confetti.service';
import { ConfettiComponent } from '@/confetti/confetti.component';
import { ProductService } from '@/pages/products-menu/service/product.service';
import { CampaignService } from '@/pages/campaigns/services/campaign.service';
import { AuthService } from '@/auth/auth.service';
import { TooltipModule } from 'primeng/tooltip';
import { PanelModule } from 'primeng/panel';
import { TouchTooltipDirective } from '@/shared/directives/touch-tooltip.directive';

@Component({
    selector: 'app-landing-editor',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, FileUploadModule, InputTextModule, TextareaModule, EditorModule, CardModule, ButtonModule, InputGroupModule, ToggleSwitch, StepperModule, MessageModule, DialogModule, TooltipModule, PanelModule, ConfettiComponent, TouchTooltipDirective ],
    templateUrl: './landing-editor.component.html',
    styleUrls: ['./landing-editor.component.scss']
})
export class LandingEditorComponent implements OnInit {
    private logoObjectUrl: string | null = null;
    email: string = '';
    step: number = 1;
    isMobile: boolean = false;
    landingForm: FormGroup;
    socialPlatforms = [
        { name: 'Facebook', icon: 'pi pi-facebook', control: 'facebook' },
        { name: 'Instagram', icon: 'pi pi-instagram', control: 'instagram' },
        { name: 'TikTok', icon: 'pi pi-tiktok', control: 'tiktok' },
        { name: 'LinkedIn', icon: 'pi pi-linkedin', control: 'linkedin' },
        { name: 'X', icon: 'pi pi-twitter', control: 'x' }
    ];
    tenantId: number = 0;
    userId: number = 0;

    showCongrats: boolean = false;
    showWelcomeBanner = signal<boolean>(false);
    bannerMessage = signal<{ title: string; description: string; buttonText: string }>(
        { title: '', description: '', buttonText: '' }
    );
    showSetupPrompt = false;
    setupPromptText = {
        title: 'Configuremos tu negocio',
        description: 'Para activar tu página necesitamos los datos básicos de tu negocio. Completa esta configuración inicial para compartir tu sitio con tus clientes.'
    };
    setupPromptCta = 'Iniciar configuración';


    constructor(
        private fb: FormBuilder,
        private cdr: ChangeDetectorRef,
        private tenantService: TenantService,
        private imageService: ImageService,
        private confettiService: ConfettiService,
        private router: Router,
        private productService: ProductService,
        private campaignService: CampaignService,
        private authService: AuthService
    ) {
        this.landingForm = this.fb.group({
            logo: [null],
            businessName: ['', Validators.required],
            slogan: [''],
            history: ['', Validators.required],
            vision: ['', Validators.required],
            address: ['', Validators.required],
            phone: ['', Validators.required],
            email: ['', [Validators.email]],
            schedule: ['', Validators.required],
            kitchenModuleEnabled: [false],
            facebook: [''],
            instagram: [''],
            tiktok: [''],
            linkedin: [''],
            x: ['']
        });

    }

    // Utility: detecta si un control tiene el validador 'required'
    isRequired(controlName: string): boolean {
        try {
            const ctrl = this.landingForm.get(controlName);
            if (!ctrl || !ctrl.validator) return false;
            const res = ctrl.validator({} as any);
            return !!(res && (res['required'] || res['requiredTrue']));
        } catch (e) {
            return false;
        }
    }

    ngOnInit(): void {
        this.updateIsMobile();
        const currentUser = this.authService.getCurrentUser();

        if (!currentUser) {
            console.warn('No se encontró información del usuario en storage.');
            this.openSetupPrompt();
            return;
        }

        this.email = currentUser.email;
        this.userId = currentUser.id;

        this.loadTenantInformation();
    }

    private loadTenantInformation(): void {
        if (!this.email) {
            this.openSetupPrompt();
            return;
        }

        this.tenantService.getTenantByEmail(this.email).subscribe({
            next: (response: any) => {
                const tenant = response?.object;
                const notFound = response?.code === 404 || !tenant;

                if (notFound) {
                    this.openSetupPrompt();
                    return;
                }

                this.populateTenantForm(tenant);
            },
            error: (error) => {
                console.error('No tenant found:', error);
                if (error?.status === 404 || error?.error?.code === 404) {
                    this.openSetupPrompt();
                }
            }
        });
    }

    private populateTenantForm(tenantData: any): void {
        if (!tenantData) {
            return;
        }

        this.tenantId = tenantData.id ?? 0;
        this.landingForm.patchValue({
            logo: tenantData.logoUrl,
            businessName: tenantData.nombreNegocio,
            slogan: tenantData.slogan,
            history: tenantData.history,
            vision: tenantData.vision,
            slug: tenantData.slug,
            address: tenantData.direccion,
            phone: tenantData.telefono,
            email: tenantData.bussinessEmail,
            schedule: tenantData.schedules,
            kitchenModuleEnabled: this.resolveKitchenModuleValue(tenantData),
            facebook: tenantData.facebook,
            instagram: tenantData.instagram,
            tiktok: tenantData.tiktok,
            linkedin: tenantData.linkedin,
            x: tenantData.x
        });

        if (this.tenantId > 0) {
            this.checkBannerConditions();
        }
    }

    startConfiguration(): void {
        this.showSetupPrompt = false;
    }

    private openSetupPrompt(): void {
        this.showSetupPrompt = true;
    }

    nextStep() {
        if (this.isStepValid(this.step)) {
            debugger;
            const currentStep = this.step;
            // persist current step to backend before advancing
            this.createTenant(currentStep);
            this.step++;
            // ensure on mobile the stepper shows the active step
            setTimeout(() => this.scrollActiveStepIntoView(), 0);
        } else {
            this.landingForm.markAllAsTouched();
        }
    }

    prevStep() {
        if (this.step > 1) {
            this.step--;
            setTimeout(() => this.scrollActiveStepIntoView(), 0);
        }
    }

    isStepValid(step: number): boolean {
        switch (step) {
            case 1:
                return !!this.landingForm.get('logo')?.valid &&
                       !!this.landingForm.get('businessName')?.valid &&
                       !!this.landingForm.get('slogan')?.valid;
            case 2:
                return !!this.landingForm.get('history')?.valid && !!this.landingForm.get('vision')?.valid;
            case 3:
                return !!this.landingForm.get('address')?.valid &&
                       !!this.landingForm.get('phone')?.valid &&
                       !!this.landingForm.get('email')?.valid &&
                       !!this.landingForm.get('schedule')?.valid;
            default:
                return true;
        }
    }

    onStepChange(newValue: number | null | undefined): void {
        const target = (newValue ?? 1) as number;

        // If navigating forward, validate current step first
        if (target > this.step) {
            if (!this.isStepValid(this.step)) {
                this.landingForm.markAllAsTouched();
                return; // block navigation
            }
        }

        // allow backward navigation or when valid
        this.step = target;
        // scroll active step into view on mobile
        setTimeout(() => this.scrollActiveStepIntoView(), 0);
    }

    /**
     * Scrolls the active p-step into view when the stepper is in mobile (horizontal) mode.
     * This does not change PrimeNG classes — only ensures the active step is visible and focused.
     */
    private scrollActiveStepIntoView(): void {
        if (!this.isMobile) return;

        try {
            const stepList = document.querySelectorAll('.responsive-stepper .p-step-list .p-step');
            if (!stepList || stepList.length === 0) return;

            const index = Math.max(0, Math.min(stepList.length - 1, this.step - 1));
            const el = stepList[index] as HTMLElement | null;
            if (!el) return;

            // Try to center the element within the horizontal scroll container
            const container = document.querySelector('.responsive-stepper .p-step-list') as HTMLElement | null;
            if (container) {
                const elRect = el.getBoundingClientRect();
                const contRect = container.getBoundingClientRect();
                const relativeLeft = elRect.left - contRect.left + container.scrollLeft;
                const targetScroll = Math.max(0, Math.min(container.scrollWidth - container.clientWidth, Math.round(relativeLeft - (container.clientWidth - elRect.width) / 2)));
                container.scrollTo({ left: targetScroll, behavior: 'smooth' });
            } else {
                // fallback
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }

            // focus the header if available for accessibility
            const header = el.querySelector('.p-step-header') as HTMLElement | null;
            if (header && typeof header.focus === 'function') {
                header.focus();
            } else if (typeof el.focus === 'function') {
                el.focus();
            }
        } catch (e) {
            // silent fail — do not affect functionality
            console.debug('[landing-editor] scrollActiveStepIntoView failed', e);
        }
    }

    @HostListener('window:resize')
    updateIsMobile(): void {
        this.isMobile = window.innerWidth < 768;
    }

    createTenant(step: number) {
        // Build a payload from the form once
        const form = this.landingForm.value;
        const logoFile = this.landingForm.get('logo')?.value;

        // Build payload using backend field names (e.g. nombreNegocio, logoUrl)
        const tenantData: Tenant = {
            id: this.tenantId,
            userId: this.userId,
            nombreNegocio: form.businessName,
            slogan: form.slogan,
            history: form.history,
            vision: form.vision,
            direccion: form.address,
            telefono: form.phone,
            bussinessEmail: form.email,
            schedules: form.schedule,
            kitchenModuleEnabled: !!form.kitchenModuleEnabled,
            facebook: form.facebook,
            instagram: form.instagram,
            tiktok: form.tiktok,
            linkedin: form.linkedin,
            x: form.x
        } as Tenant;

        // If logo is already a URL (loaded from tenant), set logoUrl
        if (typeof form.logo === 'string' && form.logo) {
            (tenantData as any).logoUrl = form.logo;
        }

        const doCreate = () => {
            // ensure tenantData.id is up-to-date
            tenantData.id = this.tenantId;
            this.postCreateTenant(tenantData);
        };

        // If logo is a File/Blob, upload it first and attach returned data to payload
        const isFileLogo = !!logoFile && (logoFile instanceof File || logoFile instanceof Blob);
        if (isFileLogo) {
            const email = this.email;
            const nombreNegocio = form.businessName;
            const slogan = form.slogan;
            this.imageService.uploadImage(logoFile as File, 'logo', email, nombreNegocio, slogan).subscribe({
                next: (res: any) => {
                    // backend may return: a numeric id, a plain URL string, or a JSON string/object with url/logoUrl
                    try {
                        debugger;
                        let logoUrl: string | undefined;
                        // If response is an object already
                        if (res && typeof res === 'object') {
                            logoUrl = res.logoUrl || res.url || (res.object && (res.object.logoUrl || res.object.url));
                            if (!logoUrl && res.id) {
                                this.tenantId = res.id;
                                tenantData.id = res.id;
                            }
                        } else if (typeof res === 'string') {
                            // try parse JSON string
                            try {
                                const parsedJson = JSON.parse(res);
                                if (parsedJson) {
                                    logoUrl = parsedJson.logoUrl || parsedJson.url || (parsedJson.object && (parsedJson.object.logoUrl || parsedJson.object.url));
                                    if (!logoUrl && parsedJson.id) {
                                        this.tenantId = parsedJson.id;
                                        tenantData.id = parsedJson.id;
                                    }
                                }
                            } catch (e) {
                                // not JSON — could be plain url or numeric id in text
                                if (/^https?:\/\//.test(res)) {
                                    logoUrl = res;
                                } else {
                                    const n = Number(res);
                                    if (!isNaN(n) && n > 0) {
                                        this.tenantId = n;
                                        tenantData.id = n;
                                    }
                                }
                            }
                        }

                        if (logoUrl) {
                            (tenantData as any).logoUrl = logoUrl;
                        }
                    } catch (e) {
                        console.warn('[landing-editor] uploadImage response parse failed', e);
                    }
                    doCreate();
                },
                error: (error) => {
                    console.error('Error uploading image:', error);
                    // still try to create without logo
                    doCreate();
                }
            });
        } else {
            doCreate();
        }
    }

    private postCreateTenant(tenantData: Tenant): void {
        this.tenantService.createTenant(tenantData).subscribe({
            next: (response) => {
                console.log('Tenant created successfully:', response);
                this.tenantService.invalidateTenantByEmailCache(this.email);
                // If backend returns created/updated tenant id, keep it for future updates
                try {
                    const created = response?.object || response;
                    if (created && created.id) {
                        this.tenantId = created.id;
                    }
                    // If backend returns a logoUrl, update the form so UI and subsequent saves include it
                    const returnedLogo = created?.logoUrl || created?.logo || created?.object?.logoUrl || created?.object?.logo;
                    if (returnedLogo) {
                        this.landingForm.patchValue({ logo: returnedLogo });
                        // clear any local object URL since now we have a remote URL
                        if (this.logoObjectUrl) {
                            URL.revokeObjectURL(this.logoObjectUrl);
                            this.logoObjectUrl = null;
                        }
                    }
                } catch (e) {
                    // ignore parsing errors
                }
            },
            error: (error) => {
                console.error('Error creating tenant:', error);
            }
        });
    }

    private resolveKitchenModuleValue(tenantData: any): boolean {
        const candidate =
            tenantData?.kitchenModuleEnabled ??
            tenantData?.has_kitchen_module ??
            tenantData?.hasKitchenModule ??
            tenantData?.kitchenEnabled;

        if (typeof candidate === 'boolean') {
            return candidate;
        }

        if (typeof candidate === 'number') {
            return candidate === 1;
        }

        if (typeof candidate === 'string') {
            const normalized = candidate.trim().toLowerCase();
            return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'si';
        }

        return false;
    }

    onFileSelect(event: any) {
        const file = event.files && event.files.length ? event.files[0] : null;
        this.landingForm.patchValue({ logo: file });
        // Clean up previous object URL if any
        if (this.logoObjectUrl) {
            URL.revokeObjectURL(this.logoObjectUrl);
            this.logoObjectUrl = null;
        }
        if (file instanceof File || file instanceof Blob) {
            this.logoObjectUrl = URL.createObjectURL(file);
        }
        setTimeout(() => this.cdr.detectChanges());
    }

    removeLogo(): void {
        // Clear form value so backend will save as null
        this.landingForm.patchValue({ logo: null });
        // Revoke any local object URL
        if (this.logoObjectUrl) {
            try { URL.revokeObjectURL(this.logoObjectUrl); } catch (e) {}
            this.logoObjectUrl = null;
        }
        // If the form previously contained a remote URL string, ensure it's cleared
        // (landingForm.value.logo may be string)
        if (this.landingForm.value && typeof this.landingForm.value.logo === 'string') {
            this.landingForm.patchValue({ logo: null });
        }
        // Trigger change detection to update template
        setTimeout(() => this.cdr.detectChanges());
    }

    getLogoPreview(): string | null {
        const logo = this.landingForm.value.logo;
        if (!logo) return null;
        if (typeof logo === 'string') return logo;
        if ((logo instanceof File || logo instanceof Blob) && this.logoObjectUrl) {
            return this.logoObjectUrl;
        }
        return null;
    }
    ngOnDestroy() {
        if (this.logoObjectUrl) {
            URL.revokeObjectURL(this.logoObjectUrl);
        }
    }


    save() {
        this.confettiService.trigger({ action: 'burst' });
        this.showCongrats = true;
    }

    goToMenuConfig() {
        this.showCongrats = false;
        this.router.navigate(['/dashboard/categoriesMenu']);
    }

    edit(){}


    onEditorTextChange(event: any, controlName: string) {
        const text = event.htmlValue || '';
        // Quitar etiquetas HTML para contar solo caracteres visibles
        const plainText = text.replace(/<[^>]*>/g, '');
        if (plainText.length > 499) {
            // Limitar el texto visible
            const truncated = plainText.substring(0, 499);
            this.landingForm.get(controlName)?.setValue(truncated);
        }
    }

    private checkBannerConditions(): void {
        if (this.tenantId === 0) return;

        forkJoin({
            products: this.productService.getProductsByTenantId(this.tenantId),
            campaigns: this.campaignService.getByBusiness(this.tenantId)
        }).subscribe({
            next: ({ products, campaigns }) => {
                const productCount = Array.isArray(products) ? products.length : (products?.object?.length ?? 0);
                const hasProducts = productCount > 0;
                const welcomeCampaigns = (campaigns || []).filter(c => c.template?.id === 1);
                const active = welcomeCampaigns.some(c => c.status === 'ACTIVE');
                const draft = !active && welcomeCampaigns.some(c => c.status === 'DRAFT');

                if (!hasProducts || active) {
                    this.showWelcomeBanner.set(false);
                    return;
                }

                if (welcomeCampaigns.length === 0) {
                    this.showWelcomeBanner.set(true);
                    this.bannerMessage.set({
                        title: 'Tu negocio ya está listo.',
                        description: 'Ahora configura tu campaña de bienvenida para empezar a recibir clientes.',
                        buttonText: 'Configurar campaña de bienvenida'
                    });
                } else if (draft) {
                    this.showWelcomeBanner.set(true);
                    this.bannerMessage.set({
                        title: '¡Ya casi está todo listo!',
                        description: 'Tienes una campaña de bienvenida guardada como borrador. Actívala para comenzar a recibir clientes.',
                        buttonText: 'Activar campaña de bienvenida'
                    });
                } else {
                    this.showWelcomeBanner.set(false);
                }
            },
            error: (err) => {
                console.error('[Banner][landing-editor] campaigns check failed', err);
                this.showWelcomeBanner.set(false);
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
}
