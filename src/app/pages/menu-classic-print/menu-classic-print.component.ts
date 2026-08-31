import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { QRCodeComponent } from 'angularx-qrcode';

import { TenantService } from '@/pages/admin-page/service/tenant.service';
import { ProductService } from '@/pages/products-menu/service/product.service';
import { AuthService } from '@/auth/auth.service';
import { environment } from '@/pages/commons/environment';

// Interfaces para el menú
interface MenuProduct {
  id: number;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  isActive: boolean;
}

interface MenuCategory {
  name: string;
  products: MenuProduct[];
}

@Component({
  selector: 'app-menu-classic-print',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    DividerModule,
    ProgressSpinnerModule,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './menu-classic-print.component.html',
  styleUrls: ['./menu-classic-print.component.scss']
})
export class MenuClassicPrintComponent implements OnInit {
  // Signals para datos reactivos
  menuCategorias = signal<MenuCategory[]>([]);
  tenantName = signal<string>('');
  tenantSlug = signal<string>('');
  tenantLogoUrl = signal<string>('');
  tenantAddress = signal<string>('');
  tenantPhone = signal<string>('');
  tenantEmail = signal<string>('');
  tenantSchedules = signal<string>('');
  landingUrl = signal<string>('');
  isLoading = signal<boolean>(true);

  qrSize = 10;

  /** Devuelve las iniciales del negocio como fallback cuando no hay logo */
  tenantInitials(): string {
    const name = this.tenantName();
    if (!name) return '';
    return name
      .split(' ')
      .map(w => w.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private tenantService: TenantService,
    private productService: ProductService,
    private authService: AuthService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadMenuData();
  }

  /**
   * Carga los datos del menú usando los servicios existentes
   * Métodos usados:
   * - TenantService.getTenantByEmail() para obtener tenantId y metadatos del negocio
   * - ProductService.getProductsByTenantId() para obtener el array de productos
   */
  private loadMenuData(): void {
    this.isLoading.set(true);

    const user = this.authService.getCurrentUser();
    if (!user || !user.tenantId) {
      this.showError('No se encontró usuario autenticado o tenant');
      this.isLoading.set(false);
      return;
    }

    // Obtener tenant por ID
    this.tenantService.getTenantById(user.tenantId).subscribe({
      next: (tenant) => {
        const tenantId = tenant?.id;
        const tenantSlug = tenant?.slug;
        const tenantName = tenant?.nombreNegocio || 'Mi Negocio';
        const tenantLogoUrl = tenant?.logoUrl || '';

        // Guardar logo del tenant
        this.tenantLogoUrl.set(tenantLogoUrl);

        // Guardar contacto y horarios para footer
        const direccion = tenant?.direccion || '';
        const telefono = tenant?.telefono || '';
        const email = tenant?.bussinessEmail || '';
        const schedulesRaw = tenant?.schedules;
        const schedules = Array.isArray(schedulesRaw)
          ? schedulesRaw.join(' · ')
          : (typeof schedulesRaw === 'string' ? schedulesRaw : '');

        this.tenantAddress.set(direccion);
        this.tenantPhone.set(telefono);
        this.tenantEmail.set(email);
        this.tenantSchedules.set(schedules);

        if (!tenantId || !tenantSlug) {
          this.showError('No se encontró información del tenant');
          this.isLoading.set(false);
          return;
        }

        // Guardar datos del tenant
        this.tenantSlug.set(tenantSlug);
        this.tenantName.set(tenantName);

        // Construir URL de landing para QR
        const baseUrl = this.getBaseUrl();
        const landingUrl = `${baseUrl}/${tenantSlug}`;
        this.landingUrl.set(landingUrl);

        // Obtener productos por tenantId
        this.productService.getProductsByTenantId(tenantId).subscribe({
          next: (productResp) => {
            const products = productResp?.object || [];

            // Transformar productos a categorías de menú
            const menuCategorias = this.mapProductsToMenuCategorias(products);
            this.menuCategorias.set(menuCategorias);

            this.isLoading.set(false);
          },
          error: (error) => {
            console.error('Error al cargar productos:', error);
            this.showError('Error al cargar productos');
            this.isLoading.set(false);
          }
        });
      },
      error: (error) => {
        console.error('Error al cargar información del tenant:', error);
        this.showError('Error al cargar información del tenant');
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Transforma el array de productos en menuCategorias preservando el orden
   * Filtra productos inactivos
   */
  private mapProductsToMenuCategorias(products: any[]): MenuCategory[] {
    if (!products || products.length === 0) {
      return [];
    }

    // Filtrar solo productos activos
    const activeProducts = products.filter(p => p.isActive);

    // Agrupar por categoría manteniendo el orden de aparición
    const categoriesMap = new Map<string, MenuProduct[]>();
    const categoryOrder: string[] = [];

    activeProducts.forEach(product => {
      const categoryName = product.categoryName || 'Sin Categoría';

      if (!categoriesMap.has(categoryName)) {
        categoriesMap.set(categoryName, []);
        categoryOrder.push(categoryName);
      }

      categoriesMap.get(categoryName)!.push({
        id: product.id,
        name: product.name,
        description: product.description || '',
        price: product.price || 0,
        imageUrl: product.imageUrl,
        isActive: product.isActive
      });
    });

    // Convertir el mapa a array manteniendo el orden
    return categoryOrder.map(categoryName => ({
      name: categoryName,
      products: categoriesMap.get(categoryName) || []
    }));
  }

  /**
   * Obtiene la URL base de la aplicación para generar el QR
   */
  private getBaseUrl(): string {
    const cfg = environment as { landingPageBaseUrl?: string };

    if (cfg.landingPageBaseUrl && cfg.landingPageBaseUrl.trim() !== '') {
      return cfg.landingPageBaseUrl.replace(/\/+$/g, '');
    }

    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return `${window.location.origin}/landing-page`;
    }

    return 'https://full-accountability-big-rug.trycloudflare.com/landing-page';
  }

  /**
   * Ejecuta la impresión nativa del navegador
   * El navegador permite guardar como PDF desde el diálogo de impresión
   */
  printMenu(): void {
    if (this.menuCategorias().length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sin productos',
        detail: 'No hay productos disponibles para imprimir',
        life: 3000
      });
      return;
    }

    // Pequeño delay para asegurar que todo está renderizado
    setTimeout(() => {
      window.print();
    }, 100);
  }

  /**
   * Obtiene la fecha actual formateada
   */
  getCurrentDate(): string {
    return new Date().toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Muestra mensaje de error
   */
  private showError(message: string): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Error',
      detail: message,
      life: 5000
    });
  }
}
