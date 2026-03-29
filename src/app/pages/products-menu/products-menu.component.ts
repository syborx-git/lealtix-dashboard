import { Component, OnInit, signal, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray, FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Table, TableModule } from 'primeng/table';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { ToastModule } from 'primeng/toast';
import { ToolbarModule } from 'primeng/toolbar';
import { RatingModule } from 'primeng/rating';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { RadioButtonModule } from 'primeng/radiobutton';
import { CheckboxModule } from 'primeng/checkbox';
import { InputNumberModule } from 'primeng/inputnumber';
import { DialogModule } from 'primeng/dialog';
import { FileUploadModule } from 'primeng/fileupload';
import { TagModule } from 'primeng/tag';
import { InputIconModule } from 'primeng/inputicon';
import { IconFieldModule } from 'primeng/iconfield';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { Product } from '../model/product.component';
import { ProductService } from './service/product.service';
import { CrossSellingService, CrossSellingConfig, CrossSellingDraft } from './service/cross-selling.service';
import { ImageService } from '../service/image.service';
import { ProductDialogComponent } from './product-dialog.component';
import { forkJoin } from 'rxjs';
import { TenantService } from '../admin-page/service/tenant.service';
import { AuthService } from '@/auth/auth.service';
import { ConfettiService } from '@/confetti/confetti.service';
import { ConfettiComponent } from '@/confetti/confetti.component';
import { environment } from '../commons/environment.dev';
import { CampaignService } from '@/pages/campaigns/services/campaign.service';
import { CatalogService, CatalogCategory } from '@/pages/campaigns/services/catalog.service';
import { TreeNode } from 'primeng/api';
import Papa from 'papaparse';

interface Column {
    field: string;
    header: string;
    customExportHeader?: string;
}

interface ExportColumn {
    title: string;
    dataKey: string;
}

@Component({
    selector: 'app-menu-products',
    standalone: true,
    imports: [
        CommonModule,
        TableModule,
        FormsModule,
        ReactiveFormsModule,
        ButtonModule,
        RippleModule,
        ToastModule,
        ToolbarModule,
        ProgressSpinnerModule,
        RatingModule,
        InputTextModule,
        TextareaModule,
        MessageModule,
        SelectModule,
        RadioButtonModule,
        CheckboxModule,
        InputNumberModule,
        DialogModule,
        TagModule,
        InputIconModule,
        IconFieldModule,
        FileUploadModule,
        ConfirmDialogModule,
        ProductDialogComponent,
        ConfettiComponent
    ],
    templateUrl: './products-menu.component.html',
    styleUrls: ['./products-menu.component.scss'],
    providers: [MessageService, ProductService, ConfirmationService]
})
export class ProductMenuComponent implements OnInit {
    // spinner flag: cuando true muestra el spinner global
    loading: boolean = false;

    startLoading() {
        this.loading = true;
    }
    stopLoading() {
        this.loading = false;
    }

    productDialog: boolean = false;
    tenantId: number = 0;
    showFirstProductCongrats: boolean = false;
    tenantSlug: string | null = null;
    showWelcomeBanner = signal<boolean>(false);
    bannerMessage = signal<{ title: string; description: string; buttonText: string }>(
        { title: '', description: '', buttonText: '' }
    );

    // Flag set when navigation originated from the side menu (or query param)
    cameFromMenu: boolean = false;

    // Modal para indicar que debe crear una campaña
    showCampaignSetupPrompt: boolean = false;
    campaignSetupPromptText = {
        title: 'Completa tu configuración de promociones',
        description: 'Has creado tus productos. Ahora configura tus campañas para comenzar a atraer clientes con promociones especiales.'
    };
    campaignSetupPromptCta = 'Crear campaña';

    // Modal para indicar que debe crear productos
    showProductSetupPrompt: boolean = false;
    productSetupPromptText = {
        title: '¡Comienza configurando tu menú!',
        description: 'Antes de crear promociones, necesitas agregar productos a tu catálogo. Los productos son la base de tus campañas.'
    };
    productSetupPromptCta = 'Crear mi primer producto';

    products = signal<Product[]>([]);

    crossSellingItems: CrossSellingConfig[] = [];
    crossSellingCatalog: CatalogCategory[] = [];
    crossSellingCatalogOptions: TreeNode[] = [];
    crossSellingLoading: boolean = false;
    crossSellingSaving: boolean = false;
    crossSellingMax: number = 3;

    newCategory: { name?: string; description?: string; tenantId?: string; active: boolean } = {
        name: '',
        description: '',
        tenantId: '',
        active: true
    };

    categoryForm!: FormGroup;

    categoryDialog: boolean = false;

    editingCategoryId: string | number | null = null;

    constructor(
        private productService: ProductService,
        private crossSellingService: CrossSellingService,
        private catalogService: CatalogService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService,
        private fb: FormBuilder,
        private imageService: ImageService,
        private tenantService: TenantService,
        private authService: AuthService,
        private route: ActivatedRoute,
        private confettiService: ConfettiService,
        private campaignService: CampaignService,
        private router: Router
    ) {
        this.categoryForm = this.fb.group({
            id: [0],
            name: ['', Validators.required],
            description: [''],
            tenantId: [this.tenantId ? this.tenantId.toString() : ''],
            active: [true],
            categories: this.fb.array([])
        });

        // product form
        this.productForm = this.fb.group({
            id: [null],
            name: ['', Validators.required],
            description: [''],
            price: [null, Validators.required],
            img_url: [''],
            productImage: [null], // store actual File/Blob for upload
            isActive: [true]
        });
    }

    ngOnInit() {
        // detect navigation coming from the lateral menu or a query param
        const nav = this.router.getCurrentNavigation?.();
        this.cameFromMenu = Boolean((nav && (nav.extras as any)?.state?.fromMenu) || this.route.snapshot.queryParams['fromMenu'] === 'true');

        const currentUser = this.authService.getCurrentUser();
        const tenantId = currentUser?.tenantId;

        if (tenantId) {
            this.tenantService.getTenantById(tenantId).subscribe({
                next: (tenant) => {
                    this.tenantId = tenant?.id ?? 0;
                    this.tenantSlug = tenant?.slug ?? null;
                    this.loadCategories();
                    this.loadProducts();
                    this.loadCrossSellingCatalog();
                    this.checkBannerConditions();
                    this.checkCampaignSetupPrompt();

                    // Check for categoryId query param to auto-open product dialog
                    this.route.queryParams.subscribe(params => {
                        const categoryId = params['categoryId'];
                        if (categoryId) {
                            // Wait a bit for categories to load
                            setTimeout(() => {
                                this.openNewWithCategory(Number(categoryId));
                            }, 500);
                        }
                    });
                },
                error: (err) => {
                    console.error('Error fetching tenant:', err);
                }
            });
        }

    }

    private getCurrentProductId(): number | null {
        const rawId = (this.product && (this.product as any).id) || this.productForm?.get('id')?.value;
        if (rawId === null || rawId === undefined) return null;
        const idNum = typeof rawId === 'number' ? rawId : Number(rawId);
        return Number.isNaN(idNum) ? null : idNum;
    }

    private buildCrossSellingOptions(): TreeNode[] {
        const currentProductId = this.getCurrentProductId();
        const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

        return (this.crossSellingCatalog || [])
            .map((category) => {
                const children = (category.products || [])
                    .filter((product) => (currentProductId ? product.id !== currentProductId : true))
                    .map((product) => ({
                        key: String(product.id),
                        label: product.price != null
                            ? `${product.name} · ${formatter.format(product.price)}`
                            : product.name,
                        selectable: true
                    }));

                if (!children.length) return null;

                return {
                    key: `cat-${category.id}`,
                    label: category.name,
                    selectable: false,
                    children
                } as TreeNode;
            })
            .filter(Boolean) as TreeNode[];
    }

    private refreshCrossSellingOptions(): void {
        this.crossSellingCatalogOptions = this.buildCrossSellingOptions();
    }

    private resetCrossSellingState(): void {
        this.crossSellingItems = [];
        this.crossSellingLoading = false;
        this.crossSellingSaving = false;
        this.refreshCrossSellingOptions();
    }

    private loadCrossSellingCatalog(): void {
        if (!this.tenantId) return;
        this.catalogService.getCategoriesWithProducts(this.tenantId).subscribe({
            next: (categories) => {
                this.crossSellingCatalog = categories || [];
                this.refreshCrossSellingOptions();
            },
            error: (err) => {
                console.error('Error loading cross-selling catalog', err);
                this.crossSellingCatalog = [];
                this.refreshCrossSellingOptions();
            }
        });
    }

    private loadCrossSellingForProduct(productId: number | null): void {
        if (!productId || !this.tenantId) {
            this.crossSellingItems = [];
            this.refreshCrossSellingOptions();
            return;
        }

        this.crossSellingLoading = true;
        this.crossSellingService.getByProduct(productId, this.tenantId).subscribe({
            next: (items) => {
                this.crossSellingItems = items || [];
                this.refreshCrossSellingOptions();
            },
            error: (err) => {
                console.error('Error loading cross-selling items', err);
                this.crossSellingItems = [];
                this.refreshCrossSellingOptions();
            },
            complete: () => {
                this.crossSellingLoading = false;
            }
        });
    }

    openNewCategory() {
        // Reset only the individual category fields and keep the FormArray 'categories' intact
        const tenant = this.newCategory.tenantId || (this.tenantId ? this.tenantId.toString() : '');
        this.categoryForm.patchValue({ id: null, name: '', description: '', tenantId: tenant, active: true });
        // ensure any validators / touched state are cleared for the controls we reset
        this.categoryForm.get('name')?.markAsUntouched();
        this.categoryForm.get('name')?.markAsPristine();
        this.categoryForm.get('description')?.markAsUntouched();
        this.categoryForm.get('description')?.markAsPristine();
        this.categoryForm.get('active')?.setValue(true);
        this.categoryDialog = true;
    }

    hideCategoryDialog() {
        this.categoryDialog = false;
        this.categoryForm.markAsUntouched();
        this.editingCategoryId = null;
    }

    onCategorySelect(selectedValue: string | number | null) {
        if (!selectedValue) {
            return;
        }
        const cat = this.categoriesArray.value.find((c: any) => String(c.value) === String(selectedValue));
        if (!cat) return;

        const idCtrl = this.categoryForm.get('id');
        const nameCtrl = this.categoryForm.get('name');
        const descCtrl = this.categoryForm.get('description');
        const tenantCtrl = this.categoryForm.get('tenantId');
        const activeCtrl = this.categoryForm.get('active');

        const tenantValue = this.categoryForm.get('tenantId')?.value || this.tenantId?.toString();

        if (idCtrl) idCtrl.setValue(cat.value);
        if (nameCtrl) nameCtrl.setValue(cat.label || '');
        if (descCtrl) descCtrl.setValue((cat as any).description || '');
        if (tenantCtrl) tenantCtrl.setValue(tenantValue);
        if (activeCtrl) activeCtrl.setValue(typeof (cat as any).active === 'boolean' ? (cat as any).active : true);

        // mark controls so UI reflects changes immediately
        [idCtrl, nameCtrl, descCtrl, tenantCtrl, activeCtrl].forEach((c) => {
            if (c) {
                c.markAsDirty();
                c.markAsTouched();
                c.updateValueAndValidity();
            }
        });

        // set editing id so UI shows 'Editar'
        this.editingCategoryId = selectedValue;
    }

    /** Open the category dialog in edit mode using the currently selected editingCategoryId */
    openEditCategory() {
        if (!this.editingCategoryId) {
            // nothing selected
            this.messageService.add({ severity: 'warn', summary: 'Seleccione', detail: 'Seleccione una categoría para editar', life: 3000 });
            return;
        }

        this.onCategorySelect(this.editingCategoryId);
        this.categoryDialog = true;
    }

    product!: Product;
    productForm!: FormGroup;

    selectedProducts!: Product[] | null;

    submitted: boolean = false;

    statuses!: any[];

    @ViewChild('dt') dt!: Table;

    exportColumns!: ExportColumn[];

    cols!: Column[];
    tableFirst: number = 0;
    private editedProductIdToKeepPosition: number | null = null;
    private editedProductIndexToKeepPosition: number | null = null;

    get categoriesArray(): FormArray {
        return this.categoryForm.get('categories') as FormArray;
    }

    private setCategoriesFormArray(items: any[]) {
        const arr = items.map((it) =>
            this.fb.group({
                label: [it.label],
                value: [it.value],
                description: [it.description || ''],
                active: [typeof it.active === 'boolean' ? it.active : true],
                disabled: [it.disabled || false]
            })
        );
        this.categoryForm.setControl('categories', this.fb.array(arr));
    }

    exportCSV() {
        this.dt.exportCSV();
    }

    uploadDialogVisible: boolean = false;
    selectedTemplateFileName: string | null = null;
    selectedTemplateFile: File | null = null;

    /** Handler for the "Cargar Menú" toolbar button. Opens the modal. */
    uploadMenu(): void {
        this.uploadDialogVisible = true;
        this.selectedTemplateFileName = null;
        this.selectedTemplateFile = null;
    }

    /** Download CSV template with sanitized filename. */
    downloadMenuTemplate(): void {
        // Sanitize slug: remove spaces, parentheses, and special characters
        let slug = (this.tenantSlug || 'plantilla').toString().trim();
        slug = slug.replace(/[^a-z0-9\-_]/gi, '').toLowerCase();
        if (!slug) slug = 'plantilla';

        const filename = `lealtix_plantilla_menu_productos_${slug}.csv`;

        // CSV content with proper headers (without 'Estatus')
        const csvContent = `Categoria,Descripcion categoria,Nombre Producto,Descripcion Producto,Precio
    ,,,,
    ,,,,`;

        // Create CSV blob with UTF-8 BOM for Excel compatibility
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }

    /** Validate selected Excel file (extension + non-empty). */
    importProductsFromFile(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input?.files && input.files.length > 0 ? input.files[0] : null;
        if (!file) {
            this.selectedTemplateFileName = null;
            this.selectedTemplateFile = null;
            this.messageService.add({ severity: 'warn', summary: 'Archivo', detail: 'Selecciona un archivo válido.', life: 3000 });
            return;
        }

        const name = file.name.toLowerCase();
        const validExt = name.endsWith('.xlsx') || name.endsWith('.csv');
        if (!validExt) {
            this.selectedTemplateFileName = null;
            this.selectedTemplateFile = null;
            input.value = '';
            this.messageService.add({ severity: 'error', summary: 'Formato no válido', detail: 'Solo se acepta .xlsx o .csv.', life: 4000 });
            return;
        }

        if (file.size === 0) {
            this.selectedTemplateFileName = null;
            this.selectedTemplateFile = null;
            input.value = '';
            this.messageService.add({ severity: 'error', summary: 'Archivo vacío', detail: 'El archivo no puede estar vacío.', life: 4000 });
            return;
        }

        this.selectedTemplateFileName = file.name;
        this.selectedTemplateFile = file;
        this.messageService.add({ severity: 'success', summary: 'Archivo listo', detail: file.name, life: 3000 });
    }

    /** Process imported file and call bulk API */
    processImportedFile(): void {
        if (!this.selectedTemplateFile) {
            this.messageService.add({ severity: 'warn', summary: 'Error', detail: 'No hay archivo seleccionado', life: 3000 });
            return;
        }

        this.startLoading();
        const isCSV = this.selectedTemplateFile.name.toLowerCase().endsWith('.csv');

        if (isCSV) {
            this.parseCSVFile(this.selectedTemplateFile);
        } else {
            this.parseXLSXFile(this.selectedTemplateFile);
        }
    }

    /** Parse CSV file using PapaParse */
    private parseCSVFile(file: File): void {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                this.processFileData(results.data);
            },
            error: (error: any) => {
                console.error('CSV parsing error:', error);
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al parsear CSV', life: 4000 });
                this.stopLoading();
            }
        });
    }

    /** Parse XLSX file (reads as text and treats as CSV) */
    private parseXLSXFile(file: File): void {
        const reader = new FileReader();
        reader.onload = (e: any) => {
            const text = e.target.result;
            const data = Papa.parse(text, {
                header: true,
                skipEmptyLines: true
            });
            this.processFileData(data.data);
        };
        reader.onerror = () => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al leer archivo XLSX', life: 4000 });
            this.stopLoading();
        };
        reader.readAsText(file);
    }

    /** Process and validate file data, then call bulk API */
    private processFileData(rows: any[]): void {
        if (!rows || rows.length === 0) {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No hay datos que cargar', life: 3000 });
            this.stopLoading();
            return;
        }

        const expectedColumns = ['Categoria', 'Descripcion categoria', 'Nombre Producto', 'Descripcion Producto', 'Precio'];

        const firstRow = rows[0];
        if (!firstRow) {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No hay datos que cargar', life: 3000 });
            this.stopLoading();
            return;
        }

        const fileColumns = Object.keys(firstRow).map(k => k.trim());
        const hasValidHeaders = expectedColumns.every(col => fileColumns.includes(col));

        if (!hasValidHeaders) {
            this.messageService.add({
                severity: 'error',
                summary: 'Error de formato',
                detail: 'El archivo no tiene la estructura esperada. Columnas requeridas: ' + expectedColumns.join(', '),
                life: 5000
            });
            this.stopLoading();
            return;
        }

        // Filtrar filas que tengan al menos algún dato (no completamente vacías)
        const validRows = rows.filter(row => {
            if (!row) return false;
            const values = Object.values(row).map(v => String(v || '').trim());
            return values.some(v => v.length > 0);
        });

        // Si no hay filas válidas después del filtro, mostrar error
        if (validRows.length === 0) {
            this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'No hay datos que cargar',
                life: 3000,
                sticky: true
            });
            this.stopLoading();
            return;
        }

        // Verificar que haya al menos una fila con datos en campos requeridos (Categoria y Nombre Producto)
        const rowsWithRequiredData = validRows.filter(row => {
            const categoria = String(row['Categoria'] || '').trim();
            const nombreProducto = String(row['Nombre Producto'] || '').trim();
            return categoria.length > 0 || nombreProducto.length > 0;
        });

        if (rowsWithRequiredData.length === 0) {
            this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'No hay datos que cargar',
                life: 3000,
                sticky: true
            });
            this.stopLoading();
            return;
        }

        const productsToCreate = [];
        const errors = [];

        for (let i = 0; i < rowsWithRequiredData.length; i++) {
            const row = rowsWithRequiredData[i];

            const categoria = String(row['Categoria'] || '').trim();
            const descripcionCategoria = String(row['Descripcion categoria'] || '').trim();
            const nombreProducto = String(row['Nombre Producto'] || '').trim();
            const descripcionProducto = String(row['Descripcion Producto'] || '').trim();
            const precioStr = String(row['Precio'] || '').trim();

            // Si Categoria está vacía -> omitir fila
            if (!categoria) {
                continue;
            }

            // Nombre Producto es obligatorio
            if (!nombreProducto) {
                errors.push(`Fila ${i + 1}: Nombre de producto es obligatorio`);
                continue;
            }

            // Precio es obligatorio y debe ser numérico
            let precio: number | null = null;
            if (!precioStr) {
                errors.push(`Fila ${i + 1} (${nombreProducto}): Precio es obligatorio`);
                continue;
            } else {
                const cleanPrice = precioStr.replace(/[^\d.,]/g, '').replace(',', '.');
                precio = parseFloat(cleanPrice);

                if (isNaN(precio) || precio < 0) {
                    errors.push(`Fila ${i + 1} (${nombreProducto}): Precio inválido '${precioStr}'`);
                    continue;
                }
            }

            const product = {
                categoryName: categoria,
                name: nombreProducto,
                description: descripcionProducto || undefined,
                price: precio,
                imageUrl: null,
                isActive: true
            };

            productsToCreate.push(product);
        }

        if (errors.length > 0) {
            const errorMsg = errors.slice(0, 5).join('\n') + (errors.length > 5 ? `\n... y ${errors.length - 5} errores más` : '');
            this.messageService.add({
                severity: 'warn',
                summary: `${errors.length} registros omitidos`,
                detail: errorMsg,
                life: 7000,
                sticky: true
            });
        }

        if (productsToCreate.length === 0) {
            this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'No hay datos que cargar',
                life: 4000,
                sticky: true
            });
            this.stopLoading();
            return;
        }

        // Ensure `isActive` is always true by default for each product
        productsToCreate.forEach(p => {
            p.isActive = true;
        });

        const payload = {
            tenantId: this.tenantId,
            products: productsToCreate
        };

        this.productService.bulkCreateProducts(payload).subscribe({
            next: (response) => {
                this.handleBulkImportResponse(response);
            },
            error: (error) => {
                console.error('Error importing products:', error);
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error en la importación',
                    detail: error?.error?.message || 'Error al procesar los productos',
                    life: 4000,
                    sticky: true
                });
                this.stopLoading();
            }
        });
    }

    /** Handle bulk import response from backend */
    private handleBulkImportResponse(response: any): void {
        const { code, message, object } = response;

        if (code === 201 || code === 207) {
            const { successCount, failureCount, createdProducts, errors } = object;

            const successMsg = `✓ ${successCount} productos importados exitosamente`;
            this.messageService.add({
                severity: successCount > 0 ? 'success' : 'error',
                summary: successMsg,
                detail: message,
                life: 5000,
                sticky: successCount === 0
            });

            if (errors && errors.length > 0) {
                const errorMsg = errors.slice(0, 5).join('\n') + (errors.length > 5 ? `\n... y ${errors.length - 5} errores más` : '');
                this.messageService.add({
                    severity: 'warn',
                    summary: `⚠️ ${failureCount} registros con error`,
                    detail: errorMsg,
                    life: 7000,
                    sticky: true
                });
            }

            if (successCount > 0) {
                this.loadProducts();
                this.uploadDialogVisible = false;
                this.selectedTemplateFileName = null;
                this.selectedTemplateFile = null;

                // Reset file input
                const fileInput = document.getElementById('menuExcelInput') as HTMLInputElement;
                if (fileInput) {
                    fileInput.value = '';
                }
            }
        } else {
            this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: message || 'Error desconocido en la importación',
                life: 4000,
                sticky: true
            });
        }

        this.stopLoading();
    }

    // Load categories from backend for the category select
    loadCategories() {
        this.startLoading();
        this.productService.getCategoriesByTenantId(this.tenantId).subscribe({
            next: (data) => {
                const mapped = data.object.map((item: any) => ({
                    label: item.categoryName,
                    value: item.categoryId,
                    description: item.categoryDescription || '',
                    active: typeof item.active === 'boolean' ? item.active : true,
                    tenantId: item.tenantId
                }));
                // populate categories form array
                this.setCategoriesFormArray(mapped);
                console.log('Loaded categories:', mapped);
            },
            error: (err) => {
                console.error('Failed to load categories', err);
                this.setCategoriesFormArray([]);
            },
            complete: () => {
                this.stopLoading();
            }
        });
    }

    // Load products from backend
    loadProducts() {
        this.startLoading();
        this.productService.getProductsByTenantId(this.tenantId).subscribe({
            next: (data) => {
                // Preserve original image URLs (do not modify Cloudinary URLs here)
                const reOrderedProducts = this.keepEditedProductPosition((data.object || []) as Product[]);
                this.products.set(reOrderedProducts);

                const rows = this.dt?.rows || 10;
                const maxFirst = reOrderedProducts.length > 0 ? Math.floor((reOrderedProducts.length - 1) / rows) * rows : 0;
                if (this.tableFirst > maxFirst) {
                    this.tableFirst = maxFirst;
                }

                // Check if we should show the product setup prompt
                this.checkProductSetupPrompt();
            },
            error: (err) => {
                console.error('Failed to load products', err);
                this.products.set([]);
                this.clearEditedProductPositionCache();
            },
            complete: () => {
                this.stopLoading();
            }
        });
    }

    onGlobalFilter(table: Table, event: Event) {
        table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
    }

    onTablePage(event: any) {
        this.tableFirst = event?.first ?? 0;
    }

    private normalizeProductId(id: unknown): number | null {
        if (id === null || id === undefined) return null;
        const parsed = typeof id === 'number' ? id : Number(id);
        return Number.isNaN(parsed) ? null : parsed;
    }

    private captureEditedProductPosition(productId: number): void {
        const currentProducts = this.products() || [];
        const index = currentProducts.findIndex((item) => this.normalizeProductId((item as any)?.id) === productId);
        if (index >= 0) {
            this.editedProductIdToKeepPosition = productId;
            this.editedProductIndexToKeepPosition = index;
            return;
        }
        this.clearEditedProductPositionCache();
    }

    private clearEditedProductPositionCache(): void {
        this.editedProductIdToKeepPosition = null;
        this.editedProductIndexToKeepPosition = null;
    }

    private keepEditedProductPosition(items: Product[]): Product[] {
        if (this.editedProductIdToKeepPosition === null || this.editedProductIndexToKeepPosition === null) {
            return items;
        }

        const productId = this.editedProductIdToKeepPosition;
        const originalIndex = this.editedProductIndexToKeepPosition;
        this.clearEditedProductPositionCache();

        const editedIndex = items.findIndex((item) => this.normalizeProductId((item as any)?.id) === productId);
        if (editedIndex < 0) {
            return items;
        }

        const editedProduct = items[editedIndex];
        const withoutEdited = items.filter((_, index) => index !== editedIndex);
        const safeIndex = Math.max(0, Math.min(originalIndex, withoutEdited.length));
        withoutEdited.splice(safeIndex, 0, editedProduct);
        return withoutEdited;
    }

    getOptimizedImage(url: string): string {
        if (!url) return '';

        try {
            // If the url already contains '/upload/', remove any existing transformation segment
            // so we don't double-apply transformations which may cause distortion.
            const parts = url.split('/upload/');
            if (parts.length === 2) {
                const after = parts[1];
                // strip leading transformation parts (they usually contain = or commas and underscores)
                const restIndex = after.indexOf('/');
                const imagePath = restIndex >= 0 ? after.substring(restIndex + 1) : after;
                // Restore previous optimized transform used before: width 266x110 with c_limit
                const transform = 'w_266,h_110,c_limit,f_auto,q_auto';
                return parts[0] + '/upload/' + transform + '/' + imagePath;
            }
            // If url doesn't match expected Cloudinary pattern, return as-is
            return url;
        } catch (e) {
            // fallback: return original url
            return url;
        }
    }

    openNew() {
        this.product = {};
        // default category selection should be the placeholder (null)
        (this.product as any).categoryId = null;
        this.submitted = false;
        // reset product form (clear productImage as well)
        this.productForm.reset({ id: null, name: '', description: '', price: null, img_url: '', productImage: null, isActive: true });
        // ensure preview and internal file reference are cleared when creating new
        this.productImagePreview = null;
        this.productForm.get('productImage')?.setValue(null);
        this.resetCrossSellingState();
        this.productDialog = true;
    }

    openNewWithCategory(categoryId: number) {
        this.product = {};
        // Preselect the category
        (this.product as any).categoryId = categoryId;
        this.submitted = false;
        // reset product form with preselected category
        this.productForm.reset({
            id: null,
            name: '',
            description: '',
            price: null,
            img_url: '',
            productImage: null,
            isActive: true
        });
        // ensure preview and internal file reference are cleared when creating new
        this.productImagePreview = null;
        this.productForm.get('productImage')?.setValue(null);
        this.resetCrossSellingState();
        this.productDialog = true;
    }

    editProduct(product: Product) {
        this.product = { ...product };
        // populate productForm
        this.productForm.patchValue({
            id: product.id ?? null,
            name: product.name ?? '',
            description: product.description ?? '',
            price: product.price ?? null,
            img_url: product.imageUrl ?? '',
            isActive: product.isActive ?? true

        });
        this.productForm.get('productImage')?.setValue(null);
        this.productImagePreview = product.imageUrl ?? null;
        const productId = this.getCurrentProductId();
        this.loadCrossSellingForProduct(productId);
        this.productDialog = true;
    }

    deleteSelectedProducts() {
        this.confirmationService.confirm({
            message: 'Are you sure you want to delete the selected products?',
            header: 'Confirm',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                // show global spinner while deleting
                this.startLoading();
                const deletes = (this.selectedProducts || [])
                    .map((product) => {
                        if (product && product.id !== undefined && product.id !== null) {
                            const idNum = typeof product.id === 'number' ? product.id : Number(product.id);
                            if (!Number.isNaN(idNum)) {
                                return this.productService.deleteProductById(idNum);
                            }
                        }
                        return null;
                    })
                    .filter(Boolean) as any[];

                if (deletes.length > 0) {
                    // run all deletes in parallel and refresh once done
                    forkJoin(deletes).subscribe({
                        next: () => {
                            this.loadProducts();
                            this.messageService.add({
                                severity: 'success',
                                summary: 'Successful',
                                detail: 'Products Deleted',
                                life: 3000
                            });
                        },
                        error: (err) => {
                            console.error('Error deleting products', err);
                            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error deleting some products', life: 3000 });
                        },
                        complete: () => {
                            this.stopLoading();
                        }
                    });
                } else {
                    this.stopLoading();
                }
                this.selectedProducts = null;
            }
        });
    }

    hideDialog() {
        this.productDialog = false;
        this.submitted = false;
        // clear image preview and selected file when dialog closes
        this.productImagePreview = null;
        if (this.productForm) {
            this.productForm.get('productImage')?.setValue(null);
            this.productForm.get('img_url')?.setValue('');
        }
        this.resetCrossSellingState();
    }

    deleteProduct(product: Product) {
        this.confirmationService.confirm({
            message: 'Are you sure you want to delete ' + product.name + '?',
            header: 'Confirm',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                const idValue = product?.id;
                const idNum = typeof idValue === 'number' ? idValue : Number(idValue);

                if (!Number.isNaN(idNum)) {
                    this.startLoading();
                    this.productService.deleteProductById(idNum).subscribe({
                        next: () => {
                            this.loadProducts();
                            this.messageService.add({
                                severity: 'success',
                                summary: 'Successful',
                                detail: 'Product Deleted',
                                life: 3000
                            });

                            // Trigger event for menu update
                            window.dispatchEvent(new Event('productsUpdated'));
                        },
                        error: (err) => {
                            console.error('Failed to delete product:', err);
                            this.messageService.add({
                                severity: 'error',
                                summary: 'Error',
                                detail: 'No se pudo eliminar el producto',
                                life: 3000
                            });
                        },
                        complete: () => {
                            this.stopLoading();
                        }
                    });
                } else {
                    console.warn('Skipping delete for product with invalid id', product);
                    this.messageService.add({
                        severity: 'warn',
                        summary: 'Advertencia',
                        detail: 'ID de producto inválido, no se pudo eliminar',
                        life: 3000
                    });
                }
            }
        });
    }

    findIndexById(id: string): number {
        let index = -1;
        for (let i = 0; i < this.products().length; i++) {
            if (this.products()[i].id === id) {
                index = i;
                break;
            }
        }

        return index;
    }

    createId(): string {
        let id = '';
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (var i = 0; i < 5; i++) {
            id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return id;
    }

    getSeverity(status: boolean) {
        if (status) {
            return 'success';
        } else {
            return 'danger';
        }
    }

    getStatusTitle(status: boolean) {
        if (status) {
            return 'ACTIVO';
        } else {
            return 'INACTIVO';
        }
    }

    saveProduct() {

        this.submitted = true;
        if (!this.product || (this.product as any).categoryId === null || (this.product as any).categoryId === undefined) {
            this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'Seleccione una categoría', life: 3000 });
            return;
        }

        this.productForm.markAllAsTouched();
        if (this.productForm.invalid) {
            this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'Complete los campos requeridos del producto', life: 3000 });
            return;
        }

        const prod = this.productForm.value;
        const imgFile: File | Blob | null = this.productForm.get('productImage')?.value || null;

        const selectedCategoryId = (this.product as any).categoryId;

        const isNewProduct = !prod.id;
        if (!isNewProduct) {
            const editId = this.normalizeProductId(prod.id);
            if (editId !== null) {
                this.captureEditedProductPosition(editId);
            } else {
                this.clearEditedProductPositionCache();
            }
        } else {
            this.clearEditedProductPositionCache();
        }

        const createProductAndClose = (imageUrl?: string) => {
            const newProduct: Product = {
                id: prod.id,
                categoryId: selectedCategoryId,
                tenantId: this.tenantId,
                name: prod.name,
                description: prod.description,
                price: prod.price,
                isActive: prod.isActive,
                imageUrl: imageUrl ?? prod.img_url
            } as any;
            this.startLoading();
            this.productService.createProduct(newProduct).subscribe({
                next: (resp) => {
                    this.messageService.add({ severity: 'success', summary: 'Producto creado', detail: `${newProduct.name} creado`, life: 3000 });

                    // Check if this is the first product created
                    if (isNewProduct) {
                        // Trigger event for menu update only when a new product is created
                        window.dispatchEvent(new Event('productsUpdated'));

                        this.productService.getProductsByTenantId(this.tenantId).subscribe({
                            next: (data) => {
                                this.loadProducts();
                                // Show confetti dialog only if this is the first product (count === 1)
                                if (data.totalRecords === 1) {
                                    this.confettiService.trigger({ action: 'burst' });
                                    this.showFirstProductCongrats = true;
                                }
                            },
                            error: (err) => {
                                console.error('Failed to load products after save', err);
                                this.loadProducts();
                            }
                        });
                    } else {
                        this.loadProducts();
                    }
                },
                error: (err) => {
                    console.error('Error creating product:', err);
                    this.clearEditedProductPositionCache();
                    this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo crear el producto', life: 3000 });
                },
                complete: () => {
                    this.stopLoading();
                }
            });

            this.productDialog = false;
        };

        // If we have a real File/Blob, upload first and then create product with returned URL
        if (imgFile instanceof File || imgFile instanceof Blob) {
            this.startLoading();
            this.imageService.uploadImageProd(imgFile as File, 'product', this.tenantId, prod.name).subscribe({
                next: (imgURresp: string) => {
                    prod.img_url = imgURresp;
                    createProductAndClose(imgURresp);
                },
                error: (error) => {
                    console.error('Error uploading image:', error);
                    createProductAndClose();
                },
                complete: () => {
                    this.stopLoading();}
            });
        } else {
            createProductAndClose();
        }
    }

    onCreateCrossSelling(draft: CrossSellingDraft) {
        const productId = this.getCurrentProductId();
        if (!productId) {
            this.messageService.add({ severity: 'warn', summary: 'Validacion', detail: 'Guarda el producto primero', life: 3000 });
            return;
        }

        if (!draft?.suggestedProductId) {
            this.messageService.add({ severity: 'warn', summary: 'Validacion', detail: 'Selecciona un producto sugerido', life: 3000 });
            return;
        }

        if ((this.crossSellingItems?.length || 0) >= this.crossSellingMax) {
            this.messageService.add({ severity: 'warn', summary: 'Limite', detail: 'Solo puedes agregar hasta 3 productos sugeridos', life: 3000 });
            return;
        }

        this.crossSellingSaving = true;
        const payload = {
            productId,
            suggestedProductId: draft.suggestedProductId,
            tenantId: this.tenantId,
            displayOrder: draft.displayOrder,
            isActive: draft.isActive
        };

        this.crossSellingService.create(payload).subscribe({
            next: () => {
                this.messageService.add({ severity: 'success', summary: 'Venta cruzada', detail: 'Configuracion creada', life: 3000 });
                this.loadCrossSellingForProduct(productId);
            },
            error: (err) => {
                console.error('Error creating cross-selling', err);
                this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'No se pudo crear', life: 3000 });
            },
            complete: () => {
                this.crossSellingSaving = false;
            }
        });
    }

    onUpdateCrossSelling(draft: CrossSellingDraft) {
        const productId = this.getCurrentProductId();
        const crossSellingId = draft?.id ?? null;
        if (!productId || !crossSellingId) {
            return;
        }

        if (!draft?.suggestedProductId) {
            this.messageService.add({ severity: 'warn', summary: 'Validacion', detail: 'Selecciona un producto sugerido', life: 3000 });
            return;
        }

        this.crossSellingSaving = true;
        const payload = {
            productId,
            suggestedProductId: draft.suggestedProductId,
            tenantId: this.tenantId,
            displayOrder: draft.displayOrder,
            isActive: draft.isActive
        };

        this.crossSellingService.update(crossSellingId, payload).subscribe({
            next: () => {
                this.messageService.add({ severity: 'success', summary: 'Venta cruzada', detail: 'Configuracion actualizada', life: 3000 });
                this.loadCrossSellingForProduct(productId);
            },
            error: (err) => {
                console.error('Error updating cross-selling', err);
                this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'No se pudo actualizar', life: 3000 });
            },
            complete: () => {
                this.crossSellingSaving = false;
            }
        });
    }

    confirmDeleteCrossSelling(item: CrossSellingConfig) {
        if (!item?.id) return;
        const name = item.suggestedProductName || 'Producto';

        this.confirmationService.confirm({
            message: `Eliminar venta cruzada para ${name}?`,
            header: 'Confirmar',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.crossSellingSaving = true;
                this.crossSellingService.delete(item.id, this.tenantId).subscribe({
                    next: () => {
                        this.messageService.add({ severity: 'success', summary: 'Venta cruzada', detail: 'Configuracion eliminada', life: 3000 });
                        this.loadCrossSellingForProduct(this.getCurrentProductId());
                    },
                    error: (err) => {
                        console.error('Error deleting cross-selling', err);
                        this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'No se pudo eliminar', life: 3000 });
                    },
                    complete: () => {
                        this.crossSellingSaving = false;
                    }
                });
            }
        });
    }

    // Create a new category and add it to the categories list
    createCategory() {
        this.categoryForm.markAllAsTouched();
        if (this.categoryForm.invalid) {
            this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'Nombre y descripción son requeridos', life: 3000 });
            return;
        }
        const payloadForm = this.categoryForm.value;
        const value = payloadForm.name.trim();
        const payload: any = {
            name: value,
            description: payloadForm.description,
            tenantId: this.tenantId,
            active: payloadForm.active,
            productsDTO: []
        };

        if (payloadForm.id !== undefined && payloadForm.id !== null) {
            payload.id = payloadForm.id;
        } else if (this.editingCategoryId !== undefined && this.editingCategoryId !== null) {
            // fallback: use the selected option's value if form id wasn't set for some reason
            payload.id = this.editingCategoryId;
        }

        this.startLoading();
        this.productService.createCategory(payload).subscribe({
            next: (resp) => {
                this.loadCategories();
                this.hideCategoryDialog();
                this.messageService.add({ severity: 'success', summary: 'Categoría creada', detail: `${value} creada`, life: 3000 });
            },
            error: (err) => {
                console.error('Error creating category', err);
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo crear la categoría', life: 3000 });
            },
            complete: () => {
                this.stopLoading();
            }
        });
    }

    onImageFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input || !input.files || input.files.length === 0) {
            return;
        }
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // save preview and also keep the data url for immediate display
            this.productForm.get('img_url')?.setValue(result);
            this.productImagePreview = result;
            // store the original File for upload
            this.productForm.get('productImage')?.setValue(file);
        };
        reader.readAsDataURL(file);
    }

    clearProductImage() {
        this.productForm.get('img_url')?.setValue('');
        this.productImagePreview = null;
        this.productForm.get('productImage')?.setValue(null);
    }

    // preview for product image selected via FileUpload
    productImagePreview: string | null = null;

    onProductFileSelect(event: any) {
        const files: File[] = event?.originalEvent?.target?.files || event?.files || null;
        if (!files || files.length === 0) return;
        const file = files[0];
        const reader = new FileReader();
        reader.onload = () => {
            this.productImagePreview = reader.result as string;
            // update reactive form img_url with preview (optional)
            this.productForm.get('img_url')?.setValue(this.productImagePreview);
            // store the original File for upload
            this.productForm.get('productImage')?.setValue(file);
        };
        reader.readAsDataURL(file);
    }

    getProductImagePreview(): string | null {
        return this.productImagePreview || this.productForm.get('img_url')?.value || null;
    }

    closeFirstProductDialog() {
        this.showFirstProductCongrats = false;
    }

    openLandingPage() {
        this.showFirstProductCongrats = false;
        // Get slug from tenant or fetch it if not available
        if (!this.tenantSlug) {
            this.tenantService.getTenantById(this.tenantId).subscribe({
                next: (tenant) => {
                    this.tenantSlug = tenant.slug ?? null;
                    this.navigateToLanding();
                },
                error: (err) => {
                    console.error('Error fetching tenant:', err);
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'No se pudo obtener la información del tenant',
                        life: 3000
                    });
                }
            });
        } else {
            this.navigateToLanding();
        }
    }

    /**
     * Retorna la base URL para la landing page usando la configuración de `environment`
     * Reutiliza la misma lógica que `MiPaginaComponent.getBaseUrl()` para evitar hardcode.
     */
    private getBaseUrl(): string {
        const cfg = environment as { landingPageBaseUrl?: string };

        if (cfg.landingPageBaseUrl && cfg.landingPageBaseUrl.trim() !== '') {
            return cfg.landingPageBaseUrl.replace(/\/+$/g, '');
        }

        if (typeof window !== 'undefined' && window.location && window.location.origin) {
            return `${window.location.origin}/landing-page`;
        }

        return 'https://lealtix.com.mx/landing-page';
    }

    private navigateToLanding() {
        if (!this.tenantSlug) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Advertencia',
                detail: 'No se encontró el slug del tenant',
                life: 3000
            });
            return;
        }

        const baseUrl = this.getBaseUrl();
        const landingUrl = `${baseUrl}/${this.tenantSlug}`;
        window.open(landingUrl, '_blank');
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
                console.error('[Banner][products-menu] campaigns check failed', err);
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

    /**
     * Verifica si debe mostrar el modal de "crea una campaña".
     * Se muestra cuando hay productos pero no hay campañas creadas.
     */
    private checkCampaignSetupPrompt(): void {
        if (this.tenantId === 0) return;

        // Obtener productos y campañas para decidir si mostrar el modal
        forkJoin({
            products: this.productService.getProductsByTenantId(this.tenantId),
            campaigns: this.campaignService.getByBusiness(this.tenantId)
        }).subscribe({
            next: ({ products, campaigns }) => {
                const productCount = Array.isArray(products) ? products.length : (products?.object?.length ?? 0);
                const hasProducts = productCount > 0;
                const campaignCount = (campaigns || []).length;
                const hasCampaigns = campaignCount > 0;

                console.debug('[CampaignPrompt][products-menu] hasProducts=', hasProducts, 'hasCampaigns=', hasCampaigns);

                // Mostrar modal solo si: hay productos, NO hay campañas, y no está el banner de bienvenida activo
                if (hasProducts && !hasCampaigns && !this.showWelcomeBanner()) {
                    this.showCampaignSetupPrompt = true;
                } else {
                    this.showCampaignSetupPrompt = false;
                }
            },
            error: (err) => {
                console.warn('[CampaignPrompt][products-menu] error checking campaigns', err);
                this.showCampaignSetupPrompt = false;
            }
        });
    }

    startCampaignConfiguration(): void {
        this.showCampaignSetupPrompt = false;
        this.router.navigate(['/dashboard/campaigns/create']);
    }

    /**
     * Verifica si debe mostrar el modal de "crea productos".
     * Se muestra cuando el usuario entra por primera vez y no hay productos.
     */
    private checkProductSetupPrompt(): void {
        const productCount = this.products()?.length ?? 0;
        const hasProducts = productCount > 0;

        console.debug('[ProductPrompt][products-menu] hasProducts=', hasProducts);

        // Mostrar modal solo si: NO hay productos y no está el banner de bienvenida activo ni el primer producto activo
        if (!hasProducts && !this.showWelcomeBanner() && !this.showFirstProductCongrats) {
            this.showProductSetupPrompt = true;
        } else {
            this.showProductSetupPrompt = false;
        }
    }

    startProductConfiguration(): void {
        this.showProductSetupPrompt = false;
        this.openNew();
    }
}
