import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { FileUploadModule } from 'primeng/fileupload';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageModule } from 'primeng/message';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { TouchTooltipDirective } from '@/shared/directives/touch-tooltip.directive';

@Component({
    selector: 'app-product-dialog',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, FormsModule, DialogModule, ButtonModule, FileUploadModule, InputTextModule, TextareaModule, InputNumberModule, MessageModule, CheckboxModule, SelectModule, TooltipModule, TouchTooltipDirective],
    template: `
    <p-dialog [(visible)]="visible" [style]="{ width: '32rem', maxWidth: '90vw' }" header="Detalle de Producto" [modal]="true" styleClass="product-dialog" contentStyleClass="product-dialog-content" (onHide)="onHide()">
        <ng-template #content>
            <div class="product-form-container">
                <!-- Categories Row -->
                <div class="mb-4">
                    <div class="flex align-items-center justify-between mb-2">
                        <label class="field-label">Categoria</label>
                        <button pButton type="button" icon="pi pi-info-circle" class="p-button-sm p-button-text p-button-plain info-button" pTooltip="Selecciona la categoría donde quieres ubicar este producto. Si aún no existe, debes crear una nueva categoría." tooltipPosition="top" appTouchTooltip></button>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="flex-1">
                            <p-select [(ngModel)]="product.categoryId" (ngModelChange)="categoryChange.emit($event)" [options]="categoriesArrayValue" optionLabel="label" optionValue="value" placeholder="Seleccione..." styleClass="w-full"></p-select>
                        </div>
                    </div>
                    <div class="mt-2">
                        <p-message *ngIf="(!product || product.categoryId === null || product.categoryId === undefined) && submitted" severity="error" [text]="'Categoria es requerida'"></p-message>
                    </div>
                </div>

                <!-- Product form -->
                <form [formGroup]="productForm" class="product-form">
                    <input type="hidden" formControlName="img_url" />

                    <div class="form-field">
                        <div class="flex align-items-center justify-between mb-2">
                            <label for="name" class="field-label">Nombre</label>
                            <button pButton type="button" icon="pi pi-info-circle" class="p-button-sm p-button-text p-button-plain info-button" pTooltip="Nombre corto y claro del producto (ej. Café Americano). Será mostrado a tus clientes." tooltipPosition="top" appTouchTooltip></button>
                        </div>
                        <input type="text" pInputText id="name" formControlName="name" required autofocus placeholder="Ej: Café Americano" class="w-full" />
                        <p-message *ngIf="productForm.get('name')?.invalid && (productForm.get('name')?.touched || submitted)" severity="error" [text]="'Nombre es requerido'"></p-message>
                    </div>

                    <div class="form-field">
                        <div class="flex align-items-center justify-between mb-2">
                            <label for="description" class="field-label">Descripción</label>
                            <button pButton type="button" icon="pi pi-info-circle" class="p-button-sm p-button-text p-button-plain info-button" pTooltip="Describe brevemente el producto: ingredientes, tamaño o notas importantes. Esto ayuda a tus clientes a elegir." tooltipPosition="top" appTouchTooltip></button>
                        </div>
                        <textarea id="description" pTextarea formControlName="description" rows="3" placeholder="Descripción breve..." class="w-full"></textarea>
                        <p-message *ngIf="productForm.get('description')?.invalid && (productForm.get('description')?.touched || submitted)" severity="error" [text]="'La descripción es requerida'"></p-message>
                    </div>

                    <div class="form-row">
                        <div class="form-col">
                            <div class="flex align-items-center justify-between mb-2">
                                <label for="price" class="field-label">Precio</label>
                                <button pButton type="button" icon="pi pi-info-circle" class="p-button-sm p-button-text p-button-plain info-button" pTooltip="Ingresa el precio en pesos mexicanos. Si el producto tiene variaciones, define el precio base aquí." tooltipPosition="top" appTouchTooltip></button>
                            </div>
                            <p-inputnumber id="price" formControlName="price" mode="currency" currency="MXN" locale="en-US" class="w-full" />
                            <p-message *ngIf="productForm?.get('price')?.invalid && (productForm.get('price')?.touched || submitted)" severity="error" [text]="'Precio es requerido'"></p-message>
                        </div>

                        <div class="form-col form-col-narrow">
                            <label for="isActive" class="field-label">Activo</label>
                            <div class="flex align-items-center gap-2">
                                <p-checkbox formControlName="isActive" binary="true" inputId="isActive" (onChange)="onActiveChange($event.checked)"></p-checkbox>
                                <button pButton type="button" icon="pi pi-info-circle" class="p-button-sm p-button-text p-button-plain info-button" pTooltip="Activa para mostrar el producto en el menú. Desactiva si quieres ocultarlo temporalmente." tooltipPosition="top" appTouchTooltip></button>
                            </div>
                        </div>
                    </div>

                    <div class="form-field">
                        <div class="flex align-items-center justify-between mb-2">
                            <label class="field-label">Imagen (URL o subir)</label>
                            <button pButton type="button" icon="pi pi-info-circle" class="p-button-sm p-button-text p-button-plain info-button" pTooltip="Sube una imagen clara del producto o pega la URL. Recomendado: formato PNG/JPG, máximo 2MB." tooltipPosition="top" appTouchTooltip></button>
                        </div>
                        <div class="flex align-items-center gap-3">
                            <p-fileUpload mode="basic" name="productImage" accept="image/*" maxFileSize="2000000" chooseLabel="Seleccionar imagen" chooseIcon="pi pi-upload" (onSelect)="onProductFileSelect.emit($event)">
                                <ng-template pTemplate="empty"><span>No hay archivo seleccionado</span></ng-template>
                            </p-fileUpload>
                            <div *ngIf="productImagePreview || productForm.get('img_url')?.value" class="flex align-items-center gap-2">
                                <img [src]="productImagePreview || productForm.get('img_url')?.value" alt="Product image preview" class="product-preview" />
                                <button pButton type="button" icon="pi pi-times" class="p-button-sm p-button-text p-button-danger" (click)="onRemoveImageClick()" pTooltip="Eliminar imagen" tooltipPosition="top"></button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </ng-template>

        <ng-template #footer>
            <div class="product-dialog-footer">
                <p-button label="Cancelar" icon="pi pi-times" severity="secondary" [outlined]="true" (onClick)="hide.emit()" />
                <p-button label="Guardar" icon="pi pi-check" severity="success" (onClick)="save.emit()" />
            </div>
        </ng-template>
    </p-dialog>
    `,
    styles: [`
        /* === DIALOGO PRODUCTO (homologado) === */
        ::ng-deep .product-dialog .p-dialog-header {
            background: linear-gradient(135deg, var(--lealtix-primary-500, #6366f1) 0%, var(--lealtix-primary-600, #4f46e5) 100%);
            color: white;
            padding: 1.25rem 1.5rem;
            border-radius: 1rem 1rem 0 0;
        }

        .product-dialog-content { padding: 0 !important; }

        .product-form-container { padding: 1.5rem; }

        .product-form { display:flex; flex-direction:column; gap:1.25rem; }

        .form-field { display:flex; flex-direction:column; gap:0.5rem; }

        .field-label { font-weight:600; color:var(--lealtix-slate-800); }

        .form-row { display:flex; gap:1rem; }
        .form-col { flex:1; }
        .form-col-narrow { width:8rem; }

        ::ng-deep .info-button { width:2rem !important; height:2rem !important; padding:0 !important; color:var(--lealtix-primary-500) !important; }

        /* === BOTÓN DANGER HOMOLOGADO === */
        ::ng-deep .p-button-danger {
            &.p-button-text {
                background: transparent !important;
                color: #dc2626 !important;
                border: none !important;

                &:hover {
                    background-color: #fee2e2 !important;
                    color: #b91c1c !important;
                }

                &:active {
                    background-color: #fecaca !important;
                }
            }
        }

        ::ng-deep .product-preview { max-width:100px; max-height:64px; object-fit:contain; border-radius:0.5rem; box-shadow:var(--lealtix-shadow-sm); border:1px solid var(--lealtix-slate-200); }

        ::ng-deep .p-inputtext, ::ng-deep .p-inputtextarea, ::ng-deep .p-inputnumber { border-radius:0.75rem !important; border-color:var(--lealtix-slate-300) !important; }

        ::ng-deep .p-message { margin-top:0.5rem; }

        .product-dialog-footer { display:flex; justify-content:flex-end; gap:0.75rem; padding:1rem 1.5rem; border-top:1px solid var(--lealtix-slate-200); background:var(--lealtix-slate-50); }
    `]
})
export class ProductDialogComponent implements OnChanges {
    @Input() visible: boolean = false;
    @Output() visibleChange = new EventEmitter<boolean>();

    @Input() product: any = {};
    @Input() productForm!: any;
    @Input() categoryForm!: any;
    @Input() categoryDialog: boolean = false;
    @Output() categoryDialogChange = new EventEmitter<boolean>();
    localCategoryVisible: boolean = false;
    @Input() productImagePreview: string | null = null;
    @Input() categoriesArrayValue: any[] = [];
    @Input() submitted: boolean = false;

    @Output() save = new EventEmitter<void>();
    @Output() hide = new EventEmitter<void>();
    @Output() openNewCategory = new EventEmitter<void>();
    @Output() openEditCategory = new EventEmitter<void>();
    @Output() createCategory = new EventEmitter<void>();
    @Output() onProductFileSelect = new EventEmitter<any>();
    @Output() categoryChange = new EventEmitter<any>();
    @Output() activeChange = new EventEmitter<boolean>();
    @Output() removeImage = new EventEmitter<void>();

    onHide() {
        this.visibleChange.emit(false);
        this.hide.emit();
    }

    onRemoveImageClick() {
        // Clear preview and form control, then notify parent so it can persist null
        try {
            this.productImagePreview = null;
            if (this.productForm && this.productForm.get && this.productForm.get('img_url')) {
                this.productForm.get('img_url').setValue(null);
            }
            // Also update the bound product object so parents that read `product` see the change
            if (this.product) {
                try {
                    this.product.img_url = null;
                } catch (e) {
                    // ignore
                }
            }
        } catch (e) {
            // ignore errors
        }
        this.removeImage.emit();
    }

    closeCategoryDialog() {
        this.localCategoryVisible = false;
        this.categoryDialogChange.emit(false);
    }

    onCreateCategory() {
        this.createCategory.emit();
        this.closeCategoryDialog();
    }

    onCategorySelect(_event: any) {
        // passthrough — parent uses ngModel on product bound object
    }

    // Prevent the click from changing the p-select internal focus/value
    onNewCategoryClick(event: Event) {
        event.stopPropagation();
        this.openNewCategory.emit();
    }

    onEditCategoryClick(event: Event) {
        event.stopPropagation();
        this.openEditCategory.emit();
    }

    // Keep product.isActive in sync and seed form control when dialog receives a product
    ngOnChanges(changes: SimpleChanges) {
        if (changes['product']) {
            // Ensure product object exists
            this.product = this.product || {};

            // If product.isActive is undefined/null, default to true
            if (this.product.isActive === undefined || this.product.isActive === null) {
                this.product.isActive = true;
                this.activeChange.emit(true);
            }

            // If a reactive form with 'isActive' control is provided, set its value from the product
            if (this.productForm && this.productForm.get) {
                const isActiveControl = this.productForm.get('isActive');
                if (isActiveControl) {
                    try {
                        isActiveControl.setValue(this.product.isActive, { emitEvent: false });
                    } catch (e) {
                        // ignore if unable to set
                    }
                }
            }
        }
    }

    onActiveChange(value: boolean) {
        // If parent form contains the control, write value there; otherwise update product and emit
        if (this.productForm && this.productForm.get && this.productForm.get('isActive')) {
            try {
                this.productForm.get('isActive').setValue(value);
            } catch (e) {
                // ignore
            }
        } else {
            this.product = this.product || {};
            this.product.isActive = value;
            this.activeChange.emit(value);
        }
    }
}
