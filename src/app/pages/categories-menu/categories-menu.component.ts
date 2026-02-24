import { Component, OnInit, signal, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Table, TableModule } from 'primeng/table';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { ToastModule } from 'primeng/toast';
import { ToolbarModule } from 'primeng/toolbar';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { MessageModule } from 'primeng/message';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { InputIconModule } from 'primeng/inputicon';
import { IconFieldModule } from 'primeng/iconfield';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DragDropModule } from 'primeng/dragdrop';
import { InputNumberModule } from 'primeng/inputnumber';
import { Category } from '../model/category.component';
import { CategoryService } from './service/category.service';
import { forkJoin } from 'rxjs';
import { TenantService } from '../admin-page/service/tenant.service';
import { CategoryDialogComponent } from './category-dialog.component';
import { ConfettiService } from '@/confetti/confetti.service';
import { ConfettiComponent } from '@/confetti/confetti.component';
import { ProductService } from '@/pages/products-menu/service/product.service';
import { CampaignService } from '@/pages/campaigns/services/campaign.service';

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
    selector: 'app-categories-menu',
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
        InputTextModule,
        TextareaModule,
        MessageModule,
        CheckboxModule,
        DialogModule,
        TagModule,
        InputIconModule,
        IconFieldModule,
        ConfirmDialogModule,
        DragDropModule,
        InputNumberModule,
        CategoryDialogComponent,
        ConfettiComponent
    ],
    templateUrl: './categories-menu.component.html',
    styleUrls: ['./categories-menu.component.scss'],
    providers: [MessageService, CategoryService, ConfirmationService]
})
export class CategoriesMenuComponent implements OnInit {
    loading: boolean = false;
    showWelcomeBanner = signal<boolean>(false);
    bannerMessage = signal<{ title: string; description: string; buttonText: string }>(
        { title: '', description: '', buttonText: '' }
    );
    categoryDialog: boolean = false;
    tenantId: number = 0;
    draggedCategory: Category | null = null;
    showFirstCategoryCongrats: boolean = false;
    firstCategoryId: number | null = null;
    showCategoryReminderDialog: boolean = false;
    categoryReminderProps = {
        title: 'Organiza tu menú con una categoría',
        description:
            'Para poder crear productos primero necesitas una categoría. Crea una categoría para que tu menú pueda empezar a cobrar vida y asignarle productos.',
        buttonText: 'Entendido'
    };

    categories = signal<Category[]>([]);
    category!: Category;
    categoryForm!: FormGroup;
    selectedCategories!: Category[] | null;
    submitted: boolean = false;

    @ViewChild('dt') dt!: Table;

    exportColumns!: ExportColumn[];
    cols!: Column[];

    constructor(
        private categoryService: CategoryService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService,
        private fb: FormBuilder,
        private tenantService: TenantService,
        private confettiService: ConfettiService,
        private router: Router,
        private productService: ProductService,
        private campaignService: CampaignService
    ) {
        this.categoryForm = this.fb.group({
            id: [null],
            name: ['', Validators.required],
            description: [''],
            tenantId: [this.tenantId],
            active: [true],
            displayOrder: [null]
        });
    }

    ngOnInit() {
        const userStr = sessionStorage.getItem('usuario') ?? localStorage.getItem('usuario');
        if (userStr) {
            try {
                const userObj = JSON.parse(userStr);
                if (userObj && userObj.userEmail) {
                    this.tenantService.getTenantByEmail(String(userObj.userEmail || '').trim()).subscribe({
                        next: (resp) => {
                            const tenant = resp?.object;
                            this.tenantId = tenant?.id ?? 0;
                            this.categoryForm.patchValue({ tenantId: this.tenantId });
                            this.loadCategories();
                            this.checkBannerConditions();
                        },
                        error: (err) => {
                            console.error('Error fetching tenant:', err);
                        }
                    });
                }
            } catch (e) {
                console.warn('Failed to parse stored usuario:', e);
            }
        }
    }

    startLoading() {
        this.loading = true;
    }

    stopLoading() {
        this.loading = false;
    }

    loadCategories() {
        this.startLoading();
        this.categoryService.getCategoriesByTenantId(this.tenantId).subscribe({
            next: (data) => {
                const payload = data?.object;
                const hasCategories = Array.isArray(payload) && payload.length > 0;
                if (hasCategories) {
                    const mapped = payload.map((item: any) => ({
                        id: item.categoryId,
                        name: item.categoryName,
                        description: item.categoryDescription || '',
                        active: typeof item.active === 'boolean' ? item.active : true,
                        tenantId: item.tenantId,
                        displayOrder: item.displayOrder ?? 0
                    }));
                    mapped.sort((a: Category, b: Category) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
                    this.categories.set(mapped);
                    this.showCategoryReminderDialog = false;
                    console.log('Loaded categories:', mapped);
                } else {
                    this.promptCategoryCreation();
                }
            },
            error: (err) => {
                console.error('Failed to load categories', err);
                this.promptCategoryCreation();
            },
            complete: () => {
                this.stopLoading();
            }
        });
    }

    private promptCategoryCreation(): void {
        this.categories.set([]);
        if (this.tenantId > 0) {
            this.showCategoryReminderDialog = true;
        }
    }

    onGlobalFilter(table: Table, event: Event) {
        table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
    }

    exportCSV() {
        this.dt.exportCSV();
    }

    openNew() {
        this.category = { tenantId: this.tenantId, active: true };
        this.submitted = false;
        // Calcular el siguiente displayOrder
        const maxOrder = this.categories().reduce((max, cat) =>
            Math.max(max, cat.displayOrder ?? 0), 0);
        this.categoryForm.reset({
            id: null,
            name: '',
            description: '',
            tenantId: this.tenantId,
            active: true,
            displayOrder: maxOrder + 1
        });
        this.categoryDialog = true;
    }

    editCategory(category: Category) {
        this.category = { ...category };
        this.categoryForm.patchValue({
            id: category.id ?? null,
            name: category.name ?? '',
            description: category.description ?? '',
            tenantId: category.tenantId ?? this.tenantId,
            active: category.active ?? true,
            displayOrder: category.displayOrder ?? 0
        });
        this.categoryDialog = true;
    }

    deleteSelectedCategories() {
        this.confirmationService.confirm({
            message: '¿Está seguro de que desea eliminar las categorías seleccionadas?',
            header: 'Confirmar',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.startLoading();
                const deletes = (this.selectedCategories || [])
                    .map((category) => {
                        if (category && category.id !== undefined && category.id !== null) {
                            const idNum = typeof category.id === 'number' ? category.id : Number(category.id);
                            if (!Number.isNaN(idNum)) {
                                return this.categoryService.deleteCategoryById(idNum);
                            }
                        }
                        return null;
                    })
                    .filter(Boolean) as any[];

                if (deletes.length > 0) {
                    forkJoin(deletes).subscribe({
                        next: () => {
                            this.messageService.add({
                                severity: 'success',
                                summary: 'Exitoso',
                                detail: 'Categorías Eliminadas',
                                life: 3000
                            });
                            this.selectedCategories = null;
                            this.loadCategories();
                        },
                        error: (err) => {
                            console.error('Error deleting categories', err);
                            this.messageService.add({
                                severity: 'error',
                                summary: 'Error',
                                detail: 'Error al eliminar algunas categorías',
                                life: 3000
                            });
                            this.stopLoading();
                        }
                    });
                } else {
                    this.stopLoading();
                }
            }
        });
    }

    hideDialog() {
        this.categoryDialog = false;
        this.submitted = false;
    }

    handleCategoryReminderAcknowledged(): void {
        this.showCategoryReminderDialog = false;
        this.openNew();
    }

    deleteCategory(category: Category) {
        this.confirmationService.confirm({
            message: '¿Está seguro de que desea eliminar ' + category.name + '?',
            header: 'Confirmar',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                const idValue = category?.id;
                const idNum = typeof idValue === 'number' ? idValue : Number(idValue);

                if (!Number.isNaN(idNum)) {
                    this.startLoading();
                    this.categoryService.deleteCategoryById(idNum).subscribe({
                        next: () => {
                            this.messageService.add({
                                severity: 'success',
                                summary: 'Exitoso',
                                detail: 'Categoría Eliminada',
                                life: 3000
                            });
                            this.loadCategories();
                        },
                        error: (err) => {
                            console.error('Failed to delete category:', err);
                            this.messageService.add({
                                severity: 'error',
                                summary: 'Error',
                                detail: 'No se pudo eliminar la categoría',
                                life: 3000
                            });
                            this.stopLoading();
                        }
                    });
                } else {
                    console.warn('Skipping delete for category with invalid id', category);
                    this.messageService.add({
                        severity: 'warn',
                        summary: 'Advertencia',
                        detail: 'ID de categoría inválido, no se pudo eliminar',
                        life: 3000
                    });
                }
            }
        });
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

    saveCategory() {
        this.submitted = true;
        this.categoryForm.markAllAsTouched();

        if (this.categoryForm.invalid) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Validación',
                detail: 'Complete los campos requeridos',
                life: 3000
            });
            return;
        }

        const formValue = this.categoryForm.value;
        const payload: any = {
            name: formValue.name.trim(),
            description: formValue.description.trim(),
            tenantId: this.tenantId,
            active: formValue.active,
            displayOrder: formValue.displayOrder ?? 0,
            productsDTO: []
        };

        if (formValue.id !== undefined && formValue.id !== null) {
            payload.id = formValue.id;
        }

        const isNewCategory = !payload.id;
        this.startLoading();
        this.categoryService.createCategory(payload).subscribe({
            next: (resp) => {
                this.categoryDialog = false;
                this.messageService.add({
                    severity: 'success',
                    summary: 'Exitoso',
                    detail: payload.id ? 'Categoría actualizada' : 'Categoría creada',
                    life: 3000
                });

                // Check if this is the first category created
                if (isNewCategory) {
                    this.categoryService.getCategoriesByTenantId(this.tenantId).subscribe({
                        next: (data) => {
                            const mapped = data.object.map((item: any) => ({
                                id: item.categoryId,
                                name: item.categoryName,
                                description: item.categoryDescription || '',
                                active: typeof item.active === 'boolean' ? item.active : true,
                                tenantId: item.tenantId,
                                displayOrder: item.displayOrder ?? 0
                            }));
                            mapped.sort((a: Category, b: Category) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
                            this.categories.set(mapped);

                            // Show confetti dialog only if this is the first category (count === 1)
                            if (mapped.length === 1) {
                                this.firstCategoryId = mapped[0].id ?? null;
                                this.confettiService.trigger({ action: 'burst' });
                                this.showFirstCategoryCongrats = true;
                                // Emit event to refresh menu - categories now exist
                                window.dispatchEvent(new CustomEvent('categoriesUpdated'));
                            }
                        },
                        error: (err) => {
                            console.error('Failed to load categories after save', err);
                            this.loadCategories();
                        }
                    });
                } else {
                    this.loadCategories();
                }
            },
            error: (err) => {
                console.error('Error saving category', err);
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se pudo guardar la categoría',
                    life: 3000
                });
            },
            complete: () => {
                this.stopLoading();
            }
        });
    }

    // Métodos para drag and drop
    dragStart(category: Category) {
        this.draggedCategory = category;
    }

    dragEnd() {
        this.draggedCategory = null;
    }

    drop(targetCategory: Category) {
        if (this.draggedCategory && this.draggedCategory.id !== targetCategory.id) {
            const currentCategories = [...this.categories()];
            const draggedIndex = currentCategories.findIndex(c => c.id === this.draggedCategory?.id);
            const targetIndex = currentCategories.findIndex(c => c.id === targetCategory.id);

            if (draggedIndex !== -1 && targetIndex !== -1) {
                // Remover el elemento arrastrado
                const [draggedItem] = currentCategories.splice(draggedIndex, 1);
                // Insertar en la nueva posición
                currentCategories.splice(targetIndex, 0, draggedItem);

                // Actualizar displayOrder
                currentCategories.forEach((cat, index) => {
                    cat.displayOrder = index + 1;
                });

                // Actualizar el signal
                this.categories.set(currentCategories);

                // Enviar al backend
                this.updateCategoriesOrder(currentCategories);
            }
        }
        this.draggedCategory = null;
    }

    updateCategoriesOrder(categories: Category[]) {
        const orderPayload = categories.map((cat, index) => ({
            id: Number(cat.id),
            displayOrder: index + 1
        }));

        this.categoryService.reorderCategories(orderPayload, this.tenantId).subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'success',
                    summary: 'Exitoso',
                    detail: 'Orden de categorías actualizado',
                    life: 2000
                });
            },
            error: (err) => {
                console.error('Error updating order', err);
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se pudo actualizar el orden',
                    life: 3000
                });
                // Recargar para restaurar el orden original
                this.loadCategories();
            }
        });
    }

    closeFirstCategoryDialog() {
        this.showFirstCategoryCongrats = false;
    }

    goToCreateProduct() {
        this.showFirstCategoryCongrats = false;
        // Navigate to products page with the first category ID as query param
        this.router.navigate(['/dashboard/adminMenu'], {
            queryParams: { categoryId: this.firstCategoryId }
        });
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
                console.error('[Banner][categories-menu] campaigns check failed', err);
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
