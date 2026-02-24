import { Component, OnInit, signal, inject, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChipModule } from 'primeng/chip';
import { SkeletonModule } from 'primeng/skeleton';
import { CampaignTemplate } from '@/models/campaign-template.model';
import { CampaignTemplateService } from '../../services/campaign-template.service';
import { ProductService } from '@/pages/products-menu/service/product.service';
import { CampaignService } from '../../services/campaign.service';
import { TenantService } from '@/pages/admin-page/service/tenant.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-campaign-templates-list',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    CardModule,
    ChipModule,
    SkeletonModule
  ],
  templateUrl: './campaign-templates-list.component.html',
  styleUrls: ['./campaign-templates-list.component.scss']
})
export class CampaignTemplatesListComponent implements OnInit {
  templates = signal<CampaignTemplate[]>([]);
  loading = signal<boolean>(true);
  showWelcomeBanner = signal<boolean>(false);
  bannerMessage = signal<{ title: string; description: string; buttonText: string }>(
    { title: '', description: '', buttonText: '' }
  );
  private tenantId: number = 0;
  private destroyRef = inject(DestroyRef);

  constructor(
    private campaignTemplateService: CampaignTemplateService,
    private router: Router,
    private productService: ProductService,
    private campaignService: CampaignService,
    private tenantService: TenantService
  ) {}

  // Fallback handler for template images
  onImageError(event: Event) {
    const img = event?.target as HTMLImageElement | null;
    if (img) {
      img.src = 'https://via.placeholder.com/600x300?text=Sin+imagen';
    }
  }

  // Optimize Cloudinary images by adding transformations
  getOptimizedImageUrl(url: string | undefined): string {
    if (!url) {
      return 'https://via.placeholder.com/600x300?text=Sin+imagen';
    }

    // If it's a Cloudinary URL, add transformation parameters
    if (url.includes('cloudinary.com')) {
      // Insert transformation after /upload/
      const transformedUrl = url.replace(
        '/upload/',
        '/upload/w_600,h_300,c_fill,f_auto,q_auto/'
      );
      return transformedUrl;
    }

    return url;
  }

  ngOnInit(): void {
    this.loadTenantAndBanner();
    this.loadTemplates();
  }

  private loadTenantAndBanner(): void {
    const userStr = sessionStorage.getItem('usuario') ?? localStorage.getItem('usuario');
    if (!userStr) return;

    try {
      const userObj = JSON.parse(userStr);
      if (!userObj?.userEmail) return;

      this.tenantService.getTenantByEmail(String(userObj.userEmail).trim()).subscribe({
        next: (resp) => {
          const tenant = resp?.object;
          this.tenantId = tenant?.id ?? 0;
          if (this.tenantId > 0) {
            this.checkBannerConditions();
            // Reload templates using tenant-specific endpoint
            this.loadTemplates();
          }
        },
        error: (err) => {
          console.error('Error fetching tenant:', err);
        }
      });
    } catch (e) {
      console.warn('Failed to parse stored usuario:', e);
    }
  }

  private loadTemplates(): void {
    this.loading.set(true);

    this.campaignTemplateService.getAll(this.tenantId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (templates) => {
          this.templates.set(templates);
          this.loading.set(false);
        },
        error: (error) => {
          console.error('Error loading templates:', error);
          this.loading.set(false);
        }
      });
  }

  useTemplate(template: CampaignTemplate): void {
    // Navigate to create campaign screen with template pre-selected
    if (template.id) {
      this.router.navigate(['/dashboard/campaigns/create'], {
        queryParams: { templateId: template.id }
      });
    }
  }

  editTemplate(template: CampaignTemplate): void {
    // TODO: Implementar edición de plantilla
    console.log('Edit template:', template);
  }

  createNewTemplate(): void {
    // TODO: Implementar creación de plantilla
    console.log('Create new template');
  }

  // Traducir tipos de promoción a español
  getPromoTypeLabel(promoType: string | undefined): string {
    if (!promoType) return '';

    const translations: { [key: string]: string } = {
      'PERCENTAGE': 'Porcentaje',
      'FIXED_AMOUNT': 'Monto Fijo',
      'BUY_X_GET_Y': 'Compra X Lleva Y',
      'FREE_SHIPPING': 'Envío Gratis',
      'COMBO': 'Combo',
      'CASHBACK': 'Reembolso'
    };

    return translations[promoType] || promoType;
  }

  // Asignar color de fondo según tipo de promoción
  getPromoTypeColor(promoType: string | undefined): string {
    if (!promoType) return 'var(--primary-color)';

    const colors: { [key: string]: string } = {
      'PERCENTAGE': '#10b981',      // Verde
      'FIXED_AMOUNT': '#3b82f6',    // Azul
      'BUY_X_GET_Y': '#f59e0b',     // Naranja
      'FREE_SHIPPING': '#8b5cf6',   // Púrpura
      'COMBO': '#ec4899',           // Rosa
      'CASHBACK': '#06b6d4'         // Cyan
    };

    return colors[promoType] || 'var(--primary-color)';
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
        console.error('[Banner][templates-list] campaigns check failed', err);
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
