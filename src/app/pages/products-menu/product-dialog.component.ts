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
import { TreeSelectModule } from 'primeng/treeselect';
import { TooltipModule } from 'primeng/tooltip';
import { TouchTooltipDirective } from '@/shared/directives/touch-tooltip.directive';
import { CrossSellingConfig, CrossSellingDraft } from './service/cross-selling.service';
import { TreeNode } from 'primeng/api';

@Component({
    selector: 'app-product-dialog',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, FormsModule, DialogModule, ButtonModule, FileUploadModule, InputTextModule, TextareaModule, InputNumberModule, MessageModule, CheckboxModule, SelectModule, TreeSelectModule, TooltipModule, TouchTooltipDirective],
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

                    <!-- Cross-selling section -->
                    <div class="cross-selling-section">
                        <div class="section-header">
                            <div>
                                <div class="section-title">Venta cruzada</div>
                                <div class="section-help">Sugiere hasta {{ crossSellingMax }} productos relacionados para este producto.</div>
                            </div>
                            <button pButton type="button" icon="pi pi-info-circle" class="p-button-sm p-button-text p-button-plain info-button" pTooltip="La venta cruzada permite sugerir productos complementarios en el menu." tooltipPosition="top" appTouchTooltip></button>
                        </div>

                        <p-message *ngIf="!crossSellingEnabled" severity="info" [text]="'Guarda el producto para configurar venta cruzada.'" styleClass="cross-selling-info"></p-message>

                        <div *ngIf="crossSellingEnabled" class="cross-selling-body">
                            <div class="cross-selling-meta">
                                <span class="cs-count">{{ crossSellingItems.length || 0 }}/{{ crossSellingMax }}</span>
                                <span *ngIf="crossSellingLoading" class="cs-loading">Cargando...</span>
                            </div>

                            <div class="cross-selling-form">
                                <div class="form-field">
                                    <label class="field-label">Producto sugerido</label>
                                    <p-treeSelect
                                        [(ngModel)]="crossSellingSelectedNode"
                                        (ngModelChange)="onCrossSellingNodeChange($event)"
                                        [ngModelOptions]="{ standalone: true }"
                                        [options]="crossSellingCatalogOptions"
                                        selectionMode="single"
                                        placeholder="Selecciona un producto"
                                        filter="true"
                                        filterPlaceholder="Buscar producto"
                                        styleClass="w-full">
                                    </p-treeSelect>
                                </div>

                                <div class="form-row">
                                    <div class="form-col">
                                        <label class="field-label">Orden</label>
                                        <p-inputnumber [(ngModel)]="crossSellingDraft.displayOrder" [ngModelOptions]="{ standalone: true }" [min]="1" [max]="crossSellingMax" [useGrouping]="false" class="w-full"></p-inputnumber>
                                    </div>
                                    <div class="form-col form-col-narrow cs-active-col">
                                        <label class="field-label">Activo</label>
                                        <div class="flex align-items-center gap-2">
                                            <p-checkbox [(ngModel)]="crossSellingDraft.isActive" [ngModelOptions]="{ standalone: true }" binary="true" inputId="crossSellingActive"></p-checkbox>
                                        </div>
                                    </div>
                                </div>

                                <div class="cross-selling-actions">
                                    <p-button
                                        [label]="crossSellingEditingId ? 'Actualizar' : 'Agregar'"
                                        icon="pi pi-check"
                                        severity="success"
                                        [disabled]="crossSellingSaving || !canSubmitCrossSelling()"
                                        (onClick)="submitCrossSelling()"></p-button>
                                    <p-button
                                        *ngIf="crossSellingEditingId"
                                        label="Cancelar"
                                        severity="secondary"
                                        [outlined]="true"
                                        (onClick)="cancelCrossSellingEdit()"></p-button>
                                </div>

                                <p-message *ngIf="crossSellingError" severity="error" [text]="crossSellingError"></p-message>
                            </div>

                            <div *ngIf="crossSellingItems.length; else crossSellingEmpty" class="cross-selling-list">
                                <div class="cross-selling-item" *ngFor="let item of crossSellingItems">
                                    <div class="cs-item-main">
                                        <span class="cs-order">#{{ item.displayOrder }}</span>
                                        <div class="cs-info">
                                            <div class="cs-name">{{ item.suggestedProductName || 'Producto' }}</div>
                                            <div class="cs-status" [class.is-active]="item.isActive">{{ item.isActive ? 'Activo' : 'Inactivo' }}</div>
                                        </div>
                                    </div>
                                    <div class="cs-item-actions">
                                        <button pButton type="button" icon="pi pi-pencil" class="p-button-sm p-button-text" (click)="startCrossSellingEdit(item)" pTooltip="Editar" tooltipPosition="top"></button>
                                        <button pButton type="button" icon="pi pi-trash" class="p-button-sm p-button-text p-button-danger" (click)="requestCrossSellingDelete(item)" pTooltip="Eliminar" tooltipPosition="top"></button>
                                    </div>
                                </div>
                            </div>
                            <ng-template #crossSellingEmpty>
                                <div class="cs-empty">No hay productos sugeridos aun.</div>
                            </ng-template>
                        </div>
                    </div>

                    <!-- Receta (insumos) section -->
                    <div class="recipe-section">
                        <div class="section-header">
                            <div>
                                <div class="section-title">Receta (insumos)</div>
                                <div class="section-help">Define lo que lleva este producto. Su stock se calcula de los insumos y se descuentan con cada comanda.</div>
                            </div>
                            <button pButton type="button" icon="pi pi-info-circle" class="p-button-sm p-button-text p-button-plain info-button" pTooltip="Los insumos se comparten entre todos los productos y se gestionan en la pestaña Insumos del Inventario. Deja vacío si el producto se vende directo." tooltipPosition="top" appTouchTooltip></button>
                        </div>

                        <div class="recipe-form">
                            <div class="form-field">
                                <div class="flex align-items-center justify-between mb-2">
                                    <label class="field-label">Insumo</label>
                                    <button pButton type="button" icon="pi pi-plus" label="Nuevo insumo" class="p-button-sm p-button-text" (click)="openNewInsumo()"></button>
                                </div>
                                <p-select [(ngModel)]="recipeDraftLine.insumoId" [options]="insumos" optionLabel="nombre" optionValue="id" placeholder="Selecciona un insumo" filter="true" filterPlaceholder="Buscar insumo" styleClass="w-full"></p-select>
                                <small *ngIf="recipeDraftLine.insumoId" class="recipe-hint">{{ insumoDetail(recipeDraftLine.insumoId) }}</small>
                                <small *ngIf="!insumos.length" class="recipe-hint">Aún no hay insumos. Crea uno con el botón "Nuevo insumo".</small>
                            </div>
                            <div class="form-row">
                                <div class="form-col">
                                    <label class="field-label">Cantidad por producto</label>
                                    <p-inputnumber [(ngModel)]="recipeDraftLine.cantidad" [ngModelOptions]="{ standalone: true }" [min]="0" [step]="0.5" [useGrouping]="false" class="w-full"></p-inputnumber>
                                </div>
                                <div class="form-col form-col-narrow">
                                    <label class="field-label">Modificable</label>
                                    <div class="flex align-items-center gap-2">
                                        <p-checkbox [(ngModel)]="recipeDraftLine.modificable" [ngModelOptions]="{ standalone: true }" binary="true" inputId="recipeModificable"></p-checkbox>
                                        <button pButton type="button" icon="pi pi-info-circle" class="p-button-sm p-button-text p-button-plain info-button" pTooltip="Si está activo, el cliente puede quitar este ingrediente en su comanda (no se descuenta)." tooltipPosition="top" appTouchTooltip></button>
                                    </div>
                                </div>
                            </div>
                            <div class="recipe-actions">
                                <p-button label="Agregar insumo" icon="pi pi-plus" severity="success" [disabled]="!canAddRecipe()" (onClick)="addRecipe()"></p-button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </ng-template>

        <!-- Dialogo para crear un insumo sobre la marcha -->
        <p-dialog [(visible)]="newInsumoDialog" header="Nuevo insumo" [style]="{ width: '26rem', maxWidth: '90vw' }" [modal]="true">
            <div class="p-fluid" style="display:flex;flex-direction:column;gap:1rem;">
                <div class="form-field">
                    <label class="field-label">Nombre</label>
                    <input type="text" pInputText id="newInsumoNombre" [(ngModel)]="newInsumoNombre" placeholder="Ej. Tortilla, Queso, Pollo..." class="w-full" autofocus />
                </div>
                <div class="form-field">
                    <label class="field-label">Unidad</label>
                    <p-select [(ngModel)]="newInsumoUnidad" [options]="unidadesOptions" styleClass="w-full"></p-select>
                </div>
                <div class="form-field">
                    <label class="field-label">Stock inicial <span style="color:#dc2626">*</span></label>
                    <p-inputnumber [(ngModel)]="newInsumoStock" [min]="0" [step]="0.5" [useGrouping]="false" class="w-full"></p-inputnumber>
                    <small class="recipe-hint">Obligatorio: escribe cuánto tienes de este insumo para que el platillo calcule bien su stock.</small>
                </div>
                <div class="form-field">
                    <label class="field-label">Stock mínimo</label>
                    <p-inputnumber [(ngModel)]="newInsumoMin" [min]="0" [step]="0.5" [useGrouping]="false" class="w-full"></p-inputnumber>
                    <small class="recipe-hint">Al bajar de este nivel, el platillo que lo usa avisará "stock bajo".</small>
                </div>
                <p-message severity="info" [text]="'El insumo se crea compartido (lo pueden usar otros productos) y aparecerá en la pestaña Insumos del Inventario.'"></p-message>
            </div>
            <ng-template #footer>
                <div class="flex justify-content-end gap-2" style="padding-top:1rem;">
                    <p-button label="Cancelar" icon="pi pi-times" severity="secondary" [outlined]="true" (onClick)="newInsumoDialog = false"></p-button>
                    <p-button label="Crear y usar" icon="pi pi-check" severity="success" [disabled]="!newInsumoNombre.trim() || newInsumoStock == null" (onClick)="saveNewInsumo()"></p-button>
                </div>
            </ng-template>
        </p-dialog>

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

        /* === VENTA CRUZADA === */
        .cross-selling-section { margin-top:1.5rem; padding-top:1.25rem; border-top:1px dashed var(--lealtix-slate-200); display:flex; flex-direction:column; gap:1rem; }
        .section-header { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; }
        .section-title { font-weight:700; color:var(--lealtix-slate-800); font-size:1rem; }
        .section-help { color:var(--lealtix-slate-600); font-size:0.85rem; }
        .cross-selling-body { display:flex; flex-direction:column; gap:1rem; }
        .cross-selling-meta { display:flex; align-items:center; justify-content:space-between; color:var(--lealtix-slate-600); font-size:0.85rem; }
        .cs-count { font-weight:600; }
        .cs-loading { color:var(--lealtix-primary-600); }
        .cross-selling-form { padding:1rem; border:1px solid var(--lealtix-slate-200); border-radius:0.75rem; background:var(--lealtix-slate-50); display:flex; flex-direction:column; gap:0.75rem; }
        .cross-selling-actions { display:flex; gap:0.5rem; justify-content:flex-end; }
        .cross-selling-list { display:flex; flex-direction:column; gap:0.75rem; }
        .cross-selling-item { display:flex; align-items:center; justify-content:space-between; padding:0.75rem 1rem; border:1px solid var(--lealtix-slate-200); border-radius:0.75rem; background:white; box-shadow:var(--lealtix-shadow-xs); }
        .cs-item-main { display:flex; align-items:center; gap:0.75rem; }
        .cs-order { font-weight:700; color:var(--lealtix-primary-600); background:var(--lealtix-primary-50); padding:0.25rem 0.5rem; border-radius:999px; font-size:0.75rem; }
        .cs-info { display:flex; flex-direction:column; gap:0.25rem; }
        .cs-name { font-weight:600; color:var(--lealtix-slate-800); }
        .cs-status { font-size:0.75rem; color:var(--lealtix-slate-500); }
        .cs-status.is-active { color:var(--lealtix-success-600); font-weight:600; }
        .cs-item-actions { display:flex; align-items:center; gap:0.25rem; }
        .cs-empty { text-align:center; color:var(--lealtix-slate-500); padding:0.75rem 0; }
        .cs-active-col { min-width:7rem; }

        ::ng-deep .cross-selling-info .p-message-text { color: #ffffff !important; }

        /* === RECETA (INSUMOS) === */
        .recipe-section { margin-top:1.5rem; padding-top:1.25rem; border-top:1px dashed var(--lealtix-slate-200); display:flex; flex-direction:column; gap:1rem; }
        .recipe-form { padding:1rem; border:1px solid var(--lealtix-slate-200); border-radius:0.75rem; background:var(--lealtix-slate-50); display:flex; flex-direction:column; gap:0.75rem; }
        .recipe-actions { display:flex; gap:0.5rem; justify-content:flex-end; }
        .recipe-list { display:flex; flex-direction:column; gap:0.75rem; }
        .recipe-item { display:flex; align-items:center; justify-content:space-between; padding:0.75rem 1rem; border:1px solid var(--lealtix-slate-200); border-radius:0.75rem; background:white; box-shadow:var(--lealtix-shadow-xs); }
        .recipe-hint { color:var(--lealtix-slate-500); font-size:0.8rem; }
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

    @Input() crossSellingEnabled: boolean = false;
    @Input() crossSellingItems: CrossSellingConfig[] = [];
    @Input() crossSellingCatalogOptions: any[] = [];
    @Input() crossSellingLoading: boolean = false;
    @Input() crossSellingSaving: boolean = false;
    @Input() crossSellingMax: number = 3;

    @Input() insumos: any[] = [];
    @Input() recipeLines: any[] = [];
    @Input() tenantId: number = 0;
    @Input() lastCreatedInsumoId: number | null = null;
    @Output() addRecipeLine = new EventEmitter<any>();
    @Output() createInsumo = new EventEmitter<any>();

    @Output() createCrossSelling = new EventEmitter<CrossSellingDraft>();
    @Output() updateCrossSelling = new EventEmitter<CrossSellingDraft>();
    @Output() deleteCrossSelling = new EventEmitter<CrossSellingConfig>();

    @Output() save = new EventEmitter<void>();
    @Output() hide = new EventEmitter<void>();
    @Output() openNewCategory = new EventEmitter<void>();
    @Output() openEditCategory = new EventEmitter<void>();
    @Output() createCategory = new EventEmitter<void>();
    @Output() onProductFileSelect = new EventEmitter<any>();
    @Output() categoryChange = new EventEmitter<any>();
    @Output() activeChange = new EventEmitter<boolean>();
    @Output() removeImage = new EventEmitter<void>();

    crossSellingDraft: CrossSellingDraft = {
        suggestedProductId: null,
        displayOrder: 1,
        isActive: true
    };
    crossSellingSelectedNode: TreeNode | null = null;
    crossSellingEditingId: number | null = null;
    crossSellingError: string | null = null;

    recipeDraftLine: any = { insumoId: null, cantidad: 1, modificable: false };

    newInsumoDialog: boolean = false;
    newInsumoNombre: string = '';
    newInsumoUnidad: string = 'pieza';
    newInsumoStock: number | null = null;
    newInsumoMin: number = 0;
    unidadesOptions: string[] = ['pieza', 'gramos', 'mililitros'];

    onHide() {
        this.visibleChange.emit(false);
        this.hide.emit();
        this.resetCrossSellingDraft();
    }

    /* ============ Receta (insumos) ============ */

    addRecipe() {
        const line = this.recipeDraftLine;
        if (!line.insumoId || !line.cantidad || line.cantidad <= 0) return;
        if (this.recipeLines.some((l) => l.insumoId === line.insumoId)) return;
        this.addRecipeLine.emit({ ...line });
        this.recipeDraftLine = { insumoId: null, cantidad: 1, modificable: false };
    }

    canAddRecipe(): boolean {
        const line = this.recipeDraftLine;
        if (!line.insumoId) return false;
        if (!line.cantidad || line.cantidad <= 0) return false;
        return !this.recipeLines.some((l) => l.insumoId === line.insumoId);
    }

    insumoName(insumoId: number): string {
        const found = (this.insumos || []).find((i) => Number(i.id) === Number(insumoId));
        return found ? found.nombre : 'Insumo';
    }

    insumoDetail(insumoId: number): string {
        const found = (this.insumos || []).find((i) => Number(i.id) === Number(insumoId));
        return found ? `${found.unidad || 'pieza'} · stock ${found.stock ?? 0}` : '';
    }

    /* ============ Crear insumo sobre la marcha ============ */

    openNewInsumo() {
        this.newInsumoNombre = '';
        this.newInsumoUnidad = 'pieza';
        this.newInsumoStock = null;
        this.newInsumoMin = 0;
        this.newInsumoDialog = true;
    }

    saveNewInsumo() {
        if (!this.newInsumoNombre.trim()) return;
        this.createInsumo.emit({
            nombre: this.newInsumoNombre.trim(),
            unidad: this.newInsumoUnidad,
            stock: this.newInsumoStock ?? 0,
            stockMinimo: this.newInsumoMin
        });
        this.newInsumoDialog = false;
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

            this.resetCrossSellingDraft();
        }

        if (changes['lastCreatedInsumoId'] && changes['lastCreatedInsumoId'].currentValue != null) {
            this.recipeDraftLine = { ...this.recipeDraftLine, insumoId: changes['lastCreatedInsumoId'].currentValue };
        }

        if (changes['crossSellingItems'] && !this.crossSellingEditingId) {
            this.crossSellingDraft = {
                suggestedProductId: null,
                displayOrder: this.getNextDisplayOrder(),
                isActive: true
            };
            this.crossSellingSelectedNode = null;
        }

        if (changes['crossSellingCatalogOptions']) {
            this.syncSelectedNode();
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

    private getNextDisplayOrder(): number {
        const used = new Set((this.crossSellingItems || []).map((item) => item.displayOrder));
        for (let i = 1; i <= this.crossSellingMax; i += 1) {
            if (!used.has(i)) {
                return i;
            }
        }
        return 1;
    }

    resetCrossSellingDraft() {
        this.crossSellingEditingId = null;
        this.crossSellingError = null;
        this.crossSellingDraft = {
            suggestedProductId: null,
            displayOrder: this.getNextDisplayOrder(),
            isActive: true
        };
        this.crossSellingSelectedNode = null;
    }

    canSubmitCrossSelling(): boolean {
        if (!this.crossSellingEnabled) return false;
        if (!this.crossSellingDraft.suggestedProductId) return false;
        if (!this.crossSellingDraft.displayOrder || this.crossSellingDraft.displayOrder < 1) return false;
        if (!this.crossSellingEditingId && (this.crossSellingItems?.length || 0) >= this.crossSellingMax) return false;
        return true;
    }

    submitCrossSelling() {
        this.crossSellingError = null;

        if (!this.crossSellingEnabled) {
            return;
        }

        if (!this.crossSellingDraft.suggestedProductId) {
            this.crossSellingError = 'Selecciona un producto sugerido.';
            return;
        }

        if (!this.crossSellingDraft.displayOrder || this.crossSellingDraft.displayOrder < 1) {
            this.crossSellingError = 'El orden debe ser mayor o igual a 1.';
            return;
        }

        const duplicate = (this.crossSellingItems || []).some((item) =>
            item.suggestedProductId === this.crossSellingDraft.suggestedProductId && item.id !== this.crossSellingEditingId
        );
        if (duplicate) {
            this.crossSellingError = 'Este producto ya esta agregado.';
            return;
        }

        if (this.crossSellingEditingId) {
            this.updateCrossSelling.emit({
                id: this.crossSellingEditingId,
                suggestedProductId: this.crossSellingDraft.suggestedProductId,
                displayOrder: this.crossSellingDraft.displayOrder,
                isActive: this.crossSellingDraft.isActive
            });
        } else {
            this.createCrossSelling.emit({
                suggestedProductId: this.crossSellingDraft.suggestedProductId,
                displayOrder: this.crossSellingDraft.displayOrder,
                isActive: this.crossSellingDraft.isActive
            });
        }

        this.resetCrossSellingDraft();
    }

    startCrossSellingEdit(item: CrossSellingConfig) {
        this.crossSellingEditingId = item.id;
        this.crossSellingError = null;
        this.crossSellingDraft = {
            suggestedProductId: item.suggestedProductId,
            displayOrder: item.displayOrder,
            isActive: item.isActive
        };
        this.syncSelectedNode();
    }

    cancelCrossSellingEdit() {
        this.resetCrossSellingDraft();
    }

    requestCrossSellingDelete(item: CrossSellingConfig) {
        this.deleteCrossSelling.emit(item);
    }

    onCrossSellingNodeChange(node: TreeNode | null) {
        this.crossSellingSelectedNode = node;
        const keyValue = node?.key;
        const idValue = keyValue !== undefined && keyValue !== null ? Number(keyValue) : null;
        this.crossSellingDraft.suggestedProductId = Number.isNaN(idValue as number) ? null : idValue;
    }

    private syncSelectedNode() {
        if (!this.crossSellingDraft.suggestedProductId) {
            this.crossSellingSelectedNode = null;
            return;
        }
        const targetKey = String(this.crossSellingDraft.suggestedProductId);
        const node = this.findNodeByKey(this.crossSellingCatalogOptions as TreeNode[], targetKey);
        this.crossSellingSelectedNode = node;
    }

    private findNodeByKey(nodes: TreeNode[] | null | undefined, key: string): TreeNode | null {
        if (!nodes || nodes.length === 0) return null;
        for (const node of nodes) {
            if (node.key === key) {
                return node;
            }
            if (node.children && node.children.length > 0) {
                const found = this.findNodeByKey(node.children, key);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    }
}
