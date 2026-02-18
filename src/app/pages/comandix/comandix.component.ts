import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subject, firstValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// PrimeNG
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { DividerModule } from 'primeng/divider';
import { DialogModule } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';
import { TagModule } from 'primeng/tag';

// Servicios
import { MenuService } from './services/menu.service';
import { OrderService } from './services/order.service';
import { ClienteService } from '@/pages/clientes/services/cliente.service';
import { RedemptionService } from '@/pages/redeem/services/redemption.service';
import { TenantService } from '@/pages/admin-page/service/tenant.service';
import { AuthService } from '@/auth/auth.service';
import { ProductService } from '@/pages/products-menu/service/product.service';

// Componentes
import { ClienteDialogComponent } from '@/pages/clientes/components/cliente-dialog/cliente-dialog.component';

// Modelos
import { MenuCategory, Product } from './models/menu.model';
import { OrderItem, TenantClientOrderCreateRequest } from './models/order.model';
import { Cliente, GENERO_OPTIONS, CreateClienteRequest } from '@/models/cliente.model';

interface CartItem {
  product: Product;
  cantidad: number;
  comentarios: string;
}

@Component({
  selector: 'app-comandix',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CardModule,
    ButtonModule,
    TabsModule,
    AutoCompleteModule,
    InputTextModule,
    InputNumberModule,
    ToastModule,
    DividerModule,
    DialogModule,
    ProgressSpinnerModule,
    MessageModule,
    TagModule,
    ClienteDialogComponent
  ],
  providers: [MessageService],
  templateUrl: './comandix.component.html',
  styleUrls: ['./comandix.component.scss']
})
export class ComandixComponent implements OnInit, OnDestroy {
  // Signals
  categories = signal<MenuCategory[]>([]);
  clientes = signal<Cliente[]>([]);
  cart = signal<CartItem[]>([]);
  loading = signal<boolean>(false);
  processingOrder = signal<boolean>(false);

  // Cliente seleccionado
  selectedCliente: Cliente | null = null;
  filteredClientes: Cliente[] = [];

  // Descuento por cupón
  codigoCupon = '';
  descuentoAplicado = signal<number>(0);
  validatingCoupon = signal<boolean>(false);

  // Diálogo de nuevo cliente
  mostrarDialogoNuevoCliente = false;
  formNuevoCliente!: FormGroup;
  generoOptions = GENERO_OPTIONS;
  submittedCliente = false;

  // Tenant ID
  tenantId: number = 0;

  // Computed values
  subtotal = computed(() => {
    return this.cart().reduce((sum, item) => sum + (item.product.price * item.cantidad), 0);
  });

  totalFinal = computed(() => {
    return Math.max(0, this.subtotal() - this.descuentoAplicado());
  });

  private destroy$ = new Subject<void>();

  constructor(
    private menuService: MenuService,
    private orderService: OrderService,
    private clienteService: ClienteService,
    private redemptionService: RedemptionService,
    private tenantService: TenantService,
    private authService: AuthService,
    private productService: ProductService,
    private messageService: MessageService,
    private fb: FormBuilder
  ) {
    this.initializeClienteForm();
  }

  async ngOnInit(): Promise<void> {
    await this.initializeTenant();
    if (this.tenantId > 0) {
      this.loadCatalog();
      this.loadClientes();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Inicializa el tenant ID del usuario actual
   */
  private async initializeTenant(): Promise<void> {
    try {
      const currentUserWithTenant = await firstValueFrom(this.authService.getCurrentUserWithTenant());
      const email = currentUserWithTenant?.email || currentUserWithTenant?.userEmail;
      this.tenantId = currentUserWithTenant?.tenantId ?? 0;

      if (!this.tenantId && email) {
        const tenant = await firstValueFrom(this.tenantService.getTenantByEmail(email));
        this.tenantId = tenant?.object?.id ?? 0;
      }
    } catch (error) {
      console.error('Error obteniendo tenant:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo obtener información del negocio',
        life: 3000
      });
    }
  }

  /**
   * Carga el catálogo de productos
   */
  private loadCatalog(): void {
    this.loading.set(true);
    // Usar ProductService como principal ya que trae todos los campos (imageUrl, description, etc.)
    this.loadCatalogFromProducts();
  }

  /**
   * Fallback: construye catálogo a partir de productos del tenant
   */
  private loadCatalogFromProducts(): void {
    this.productService
      .getProductsByTenantId(this.tenantId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (productResp) => {
          const products = productResp?.object || [];
          const categories = this.mapProductsToCategories(products);
          this.categories.set(categories);
          this.loading.set(false);
        },
        error: (error) => {
          console.error('Error cargando productos para catálogo:', error);
          this.loading.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo cargar el catálogo de productos',
            life: 3000
          });
        }
      });
  }

  /**
   * Mapea productos del backend a categorías del catálogo
   */
  private mapProductsToCategories(products: any[]): MenuCategory[] {
    if (!products || products.length === 0) {
      return [];
    }

    const activeProducts = products.filter((p) => p?.isActive !== false);
    const categoriesMap = new Map<string, MenuCategory>();
    let autoId = 1;

    activeProducts.forEach((product) => {
      const categoryName = product.categoryName || product.category?.name || product.category || 'Sin Categoría';
      const categoryId = product.categoryId || product.category?.id || categoryName;
      const categoryKey = String(categoryId ?? categoryName);

      if (!categoriesMap.has(categoryKey)) {
        categoriesMap.set(categoryKey, {
          id: typeof categoryId === 'number' ? categoryId : autoId++,
          name: categoryName,
          products: []
        });
      }

      // Obtener la URL de imagen con validación - priorizar imageUrl
      const imageUrl: string | null = product.imageUrl && typeof product.imageUrl === 'string'
        ? product.imageUrl.trim() || null
        : (product.img_url?.trim() || null) || (product.image?.trim() || null) || null;

      // Obtener descripción
      const description: string = (product.description && typeof product.description === 'string'
        ? product.description.trim()
        : '') || '';

      const mappedProduct: Product = {
        id: Number(product.id ?? 0),
        name: product.name || product.productName || 'Producto',
        price: Number(product.price ?? 0),
        imageUrl: imageUrl,
        description: description
      };

      categoriesMap.get(categoryKey)!.products.push(mappedProduct);
    });

    return Array.from(categoriesMap.values());
  }

  /**
   * Carga la lista de clientes
   */
  private loadClientes(): void {
    this.clienteService
      .getClientes({ tenantId: this.tenantId, page: 0, pageSize: 1000 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.clientes.set(response.content);
        },
        error: (error) => {
          console.error('Error cargando clientes:', error);
        }
      });
  }

  /**
   * Filtra clientes para el autocomplete
   */
  filterClientes(event: any): void {
    const query = event.query.toLowerCase();
    this.filteredClientes = this.clientes().filter((cliente) =>
      cliente.nombreCompleto.toLowerCase().includes(query) ||
      cliente.email.toLowerCase().includes(query)
    );
  }

  /**
   * Abre el diálogo para crear un nuevo cliente
   */
  openDialogNuevoCliente(): void {
    this.submittedCliente = false;
    this.initializeClienteForm();
    this.mostrarDialogoNuevoCliente = true;
  }

  /**
   * Inicializa el formulario de nuevo cliente
   */
  private initializeClienteForm(): void {
    this.formNuevoCliente = this.fb.group({
      nombreCompleto: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      telefono: [''],
      fechaNacimiento: ['', [Validators.required]],
      genero: ['', [Validators.required]]
    });
  }

  /**
   * Guarda el nuevo cliente
   */
  async guardarNuevoCliente(): Promise<void> {
    this.submittedCliente = true;

    if (this.formNuevoCliente.invalid) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Formulario inválido',
        detail: 'Por favor completa todos los campos requeridos',
        life: 3000
      });
      return;
    }

    try {
      const clienteData: CreateClienteRequest = {
        nombreCompleto: this.formNuevoCliente.value.nombreCompleto,
        email: this.formNuevoCliente.value.email,
        telefono: this.formNuevoCliente.value.telefono || undefined,
        fechaNacimiento: this.formNuevoCliente.value.fechaNacimiento,
        genero: this.formNuevoCliente.value.genero
      };

      const response = await firstValueFrom(
        this.clienteService.createCliente(this.tenantId, clienteData)
      );

      this.loadClientes();
      this.selectedCliente = response;
      this.mostrarDialogoNuevoCliente = false;

      this.messageService.add({
        severity: 'success',
        summary: 'Cliente creado',
        detail: `Cliente ${response.nombreCompleto} creado exitosamente`,
        life: 3000
      });
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: error.message || 'Error al crear el cliente',
        life: 3000
      });
    }
  }

  /**
   * Cierra el diálogo de nuevo cliente
   */
  hideDialogoNuevoCliente(): void {
    this.mostrarDialogoNuevoCliente = false;
    this.submittedCliente = false;
    this.initializeClienteForm();
  }

  /**
   * Maneja la creación exitosa de un nuevo cliente
   */
  onClienteCreated(cliente: Cliente): void {
    this.loadClientes();
    this.selectedCliente = cliente;
    this.messageService.add({
      severity: 'success',
      summary: 'Cliente creado',
      detail: `Cliente ${cliente.nombreCompleto} creado exitosamente`,
      life: 3000
    });
  }

  /**
   * Añade un producto al carrito
   */
  addToCart(product: Product): void {
    const existingItem = this.cart().find((item) => item.product.id === product.id);

    if (existingItem) {
      this.updateQuantity(existingItem, existingItem.cantidad + 1);
    } else {
      this.cart.update((items) => [
        ...items,
        { product, cantidad: 1, comentarios: '' }
      ]);
    }

    this.messageService.add({
      severity: 'success',
      summary: 'Producto añadido',
      detail: `${product.name} añadido a la comanda`,
      life: 2000
    });
  }

  /**
   * Actualiza la cantidad de un ítem en el carrito
   */
  updateQuantity(item: CartItem, newQuantity: number): void {
    if (newQuantity <= 0) {
      this.removeFromCart(item);
      return;
    }

    this.cart.update((items) =>
      items.map((i) =>
        i.product.id === item.product.id ? { ...i, cantidad: newQuantity } : i
      )
    );
  }

  /**
   * Elimina un ítem del carrito
   */
  removeFromCart(item: CartItem): void {
    this.cart.update((items) =>
      items.filter((i) => i.product.id !== item.product.id)
    );

    this.messageService.add({
      severity: 'info',
      summary: 'Producto eliminado',
      detail: `${item.product.name} eliminado de la comanda`,
      life: 2000
    });
  }

  /**
   * TrackBy function para el carrito - previene re-renderizado innecesario
   */
  trackByProductId(index: number, item: CartItem): number {
    return item.product.id;
  }

  /**
   * Maneja el error de carga de imagen
   */
  onImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    if (imgElement) {
      imgElement.style.display = 'none';
      const placeholder = imgElement.nextElementSibling as HTMLElement;
      if (placeholder) {
        placeholder.style.display = 'flex';
      }
    }
  }

  /**
   * Valida y aplica un cupón de descuento
   */
  async validarCupon(): Promise<void> {
    if (!this.codigoCupon.trim()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Código requerido',
        detail: 'Por favor ingresa un código de cupón',
        life: 3000
      });
      return;
    }

    this.validatingCoupon.set(true);

    try {
      const validationResponse = await firstValueFrom(
        this.redemptionService.validateCouponByCode(this.codigoCupon, this.tenantId)
      );

      if (validationResponse.valid) {
        // Calcular descuento según tipo de reward
        const descuento = this.calcularDescuento(
          validationResponse.rewardType || '',
          validationResponse.numericValue || 0,
          this.subtotal()
        );

        this.descuentoAplicado.set(descuento);
        this.messageService.add({
          severity: 'success',
          summary: 'Cupón aplicado',
          detail: `Descuento de $${descuento.toFixed(2)} aplicado`,
          life: 3000
        });
      } else {
        this.messageService.add({
          severity: 'error',
          summary: 'Cupón inválido',
          detail: validationResponse.message || 'El cupón no es válido',
          life: 3000
        });
      }
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: error.message || 'Error al validar el cupón',
        life: 3000
      });
    } finally {
      this.validatingCoupon.set(false);
    }
  }

  /**
   * Calcula el descuento según el tipo de reward
   */
  private calcularDescuento(
    rewardType: string,
    numericValue: number,
    subtotal: number
  ): number {
    switch (rewardType) {
      case 'PERCENT_DISCOUNT':
        return (subtotal * numericValue) / 100;
      case 'FIXED_AMOUNT':
        return Math.min(numericValue, subtotal);
      default:
        return 0;
    }
  }

  /**
   * Finaliza y registra la venta
   */
  async finalizarVenta(): Promise<void> {
    debugger;
    if (this.cart().length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Carrito vacío',
        detail: 'Añade productos antes de finalizar la venta',
        life: 3000
      });
      return;
    }

    this.processingOrder.set(true);

    try {
      const orderItems: OrderItem[] = this.cart().map((item) => ({
        productId: item.product.id,
        cantidad: item.cantidad,
        precioUnitario: item.product.price,
        comentarios: item.comentarios || undefined
      }));

      const orderRequest: TenantClientOrderCreateRequest = {
        customerId: this.selectedCliente?.id ?? null,
        tenantId: this.tenantId,
        items: orderItems,
        subtotal: this.subtotal(),
        descuento: this.descuentoAplicado(),
        totalFinal: this.totalFinal(),
        couponCode: this.codigoCupon.trim() || null,
        redeemedBy: this.selectedCliente?.id ?? null,
        redemptionChannel: 'COMANDIX'

      };

      const response = await firstValueFrom(
        this.orderService.createOrder(orderRequest)
      );

      this.messageService.add({
        severity: 'success',
        summary: '¡Venta registrada!',
        detail: `Orden #${response.id} creada exitosamente`,
        life: 4000
      });

      // Limpiar formulario
      this.resetForm();
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: error.message || 'Error al registrar la venta',
        life: 3000
      });
    } finally {
      this.processingOrder.set(false);
    }
  }

  /**
   * Reinicia el formulario después de una venta exitosa
   */
  private resetForm(): void {
    this.cart.set([]);
    this.selectedCliente = null;
    this.codigoCupon = '';
    this.descuentoAplicado.set(0);
  }

  /**
   * Limpia el carrito
   */
  limpiarCarrito(): void {
    this.cart.set([]);
    this.descuentoAplicado.set(0);
    this.codigoCupon = '';
  }
}
