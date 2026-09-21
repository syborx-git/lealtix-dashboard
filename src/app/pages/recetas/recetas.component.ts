import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { DividerModule } from 'primeng/divider';

import { ProductService } from '@/pages/products-menu/service/product.service';
import { InventoryService } from '@/pages/inventario/service/inventory.service';
import { AuthService } from '@/auth/auth.service';

@Component({
  selector: 'app-recetas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    CheckboxModule,
    DialogModule,
    TagModule,
    ProgressSpinnerModule,
    ToastModule,
    TooltipModule,
    ConfirmDialogModule,
    IconFieldModule,
    InputIconModule,
    DividerModule
  ],
  templateUrl: './recetas.component.html',
  styleUrls: ['./recetas.component.scss'],
  providers: [MessageService, ConfirmationService]
})
export class RecetasComponent implements OnInit {
  loading = signal<boolean>(false);
  tenantId = 1;
  products = signal<any[]>([]);
  filteredProducts = signal<any[]>([]);
  globalFilter = '';

  // Vista en pestañas: platillos / bebidas / sub-recetas
  activeTab = signal<'platillos' | 'bebidas' | 'subrecetas'>('platillos');
  categoryOptions = signal<{ label: string; value: string }[]>([]);
  selectedCategory = signal<string | null>(null);
  bebidaIds = signal<Set<number>>(new Set());
  subRecetaIds = signal<Set<number>>(new Set());

  // Insumos disponibles para agregar a la receta
  insumos = signal<any[]>([]);
  insumosLoading = signal<boolean>(false);

  // Sub-recetas disponibles del tenant
  subRecetas = signal<any[]>([]);
  subRecetasLoading = signal<boolean>(false);

  // Diálogo de receta
  recipeVisible = false;
  recipeItem: any | null = null;
  recipeIngredients = signal<any[]>([]);
  loadingRecipes = signal<boolean>(false);
  recipeInsumoId: number | null = null;
  recipeCantidad = 0;
  recipeTipoIngrediente = 'BASE';
  recipePrecio = 0;
  recipeAddLoading = signal<boolean>(false);
  editingRecipe: any | null = null;
  editRecipeCantidad = 0;
  editRecipeModificable = false;
  editRecipePrecio = 0;

  // Sub-recetas asignadas en el diálogo de receta
  assignedSubRecetas = signal<any[]>([]);
  selectedSubRecetaId: number | null = null;
  subRecetaAssignLoading = signal<boolean>(false);

  // Selector de producto / bebida (botones grandes)
  pickerVisible = false;
  pickerMode: 'PRODUCTO' | 'BEBIDA' = 'PRODUCTO';
  pickerItems = signal<any[]>([]);
  pickerLoading = signal<boolean>(false);
  pickerSelectedId: number | null = null;

  // Crear sub-receta
  subRecetaVisible = false;
  subRecetaSaving = signal<boolean>(false);
  subRecetaNombre = '';
  subRecetaInsumoId: number | null = null;
  subRecetaCantidad = 0;
  subRecetaLines = signal<any[]>([]);

  readonly tipoIngredienteOptions = [
    { label: 'Base (siempre en la receta)', value: 'BASE' },
    { label: 'Modificable (puede retirarse)', value: 'MODIFICABLE' },
    { label: 'Adicional (costo extra)', value: 'ADICIONAL' }
  ];

  constructor(
    private productService: ProductService,
    private inventoryService: InventoryService,
    private authService: AuthService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.tenantId = this.authService.getTenantId() || 1;
    this.loadProducts();
    this.loadInsumos();
    this.loadSubRecetas();
    this.loadBebidas();
  }

  loadProducts(): void {
    this.loading.set(true);
    this.productService.getProductsByTenantId(this.tenantId).subscribe({
      next: (res) => {
        const products = (res?.object ?? []) as any[];
        this.products.set(products);
        this.rebuildCategoryOptions(products);
        this.applyFilter();
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error cargando productos:', err);
        this.products.set([]);
        this.categoryOptions.set([]);
        this.filteredProducts.set([]);
        this.loading.set(false);
      }
    });
  }

  loadBebidas(): void {
    this.inventoryService.getBebidas(this.tenantId).subscribe({
      next: (res) => {
        const bebidas = (res?.object ?? []) as any[];
        const ids = new Set<number>();
        bebidas.forEach((b) => {
          const pid = this.normalizeProductId(b.productoId);
          if (pid != null) {
            ids.add(pid);
          }
        });
        this.bebidaIds.set(ids);
        this.applyFilter();
      },
      error: (err) => {
        console.error('Error cargando bebidas:', err);
        this.bebidaIds.set(new Set());
      }
    });
  }

  private rebuildCategoryOptions(products: any[]): void {
    const seen = new Set<string>();
    const options: { label: string; value: string }[] = [];
    products.forEach((p) => {
      const name = p.categoryName as string | undefined;
      if (name && !seen.has(name)) {
        seen.add(name);
        options.push({ label: name, value: name });
      }
    });
    options.sort((a, b) => a.label.localeCompare(b.label));
    this.categoryOptions.set(options);
  }

  private loadInsumos(): void {
    this.insumosLoading.set(true);
    this.inventoryService.getInsumos(this.tenantId).subscribe({
      next: (res) => {
        this.insumos.set(res?.object ?? []);
        this.insumosLoading.set(false);
      },
      error: (err) => {
        console.error('Error cargando insumos:', err);
        this.insumos.set([]);
        this.insumosLoading.set(false);
      }
    });
  }

  loadSubRecetas(): void {
    this.subRecetasLoading.set(true);
    this.inventoryService.getSubRecetas(this.tenantId).subscribe({
      next: (res) => {
        const list = res?.object ?? [];
        this.subRecetas.set(list);
        const ids = new Set<number>();
        list.forEach((sr: any) => {
          const sid = this.normalizeProductId(sr.id);
          if (sid != null) {
            ids.add(sid);
          }
        });
        this.subRecetaIds.set(ids);
        this.applyFilter();
        this.subRecetasLoading.set(false);
      },
      error: (err) => {
        console.error('Error cargando sub-recetas:', err);
        this.subRecetas.set([]);
        this.subRecetaIds.set(new Set());
        this.subRecetasLoading.set(false);
      }
    });
  }

  setActiveTab(tab: 'platillos' | 'bebidas' | 'subrecetas'): void {
    if (this.activeTab() === tab) {
      return;
    }
    this.activeTab.set(tab);
    this.selectedCategory.set(null);
    this.applyFilter();
  }

  onCategoryChange(value: string | null): void {
    this.selectedCategory.set(value ?? null);
    this.applyFilter();
  }

  onGlobalFilter(event: Event): void {
    this.globalFilter = (event.target as HTMLInputElement).value ?? '';
    this.applyFilter();
  }

  private tabData(): any[] {
    const tab = this.activeTab();
    if (tab === 'subrecetas') {
      return this.subRecetas().map((sr) => ({ ...sr, esSubReceta: true }));
    }
    const bebidas = this.bebidaIds();
    const subRecetas = this.subRecetaIds();
    return this.products().filter((p) => {
      const id = this.normalizeProductId(p.id);
      const isBebida = id != null && bebidas.has(id);
      const isSubReceta = p.esSubReceta === true || (id != null && subRecetas.has(id));
      return tab === 'bebidas' ? isBebida && !isSubReceta : !isBebida && !isSubReceta;
    });
  }

  private applyFilter(): void {
    const term = this.globalFilter.trim().toLowerCase();
    const category = this.selectedCategory();
    const all = this.tabData();
    this.filteredProducts.set(
      all.filter((p) => {
        if (category && p.categoryName !== category) {
          return false;
        }
        if (!term) {
          return true;
        }
        const name = `${p.name ?? ''} ${p.categoryName ?? ''}`.toLowerCase();
        return name.includes(term);
      })
    );
  }

  canEditRecetas(): boolean {
    return this.authService.hasAnyPermission(['manage_recetas', 'manage_products']);
  }

  /* ============ Botones grandes: selector de producto / bebida ============ */

  openPicker(mode: 'PRODUCTO' | 'BEBIDA'): void {
    this.pickerMode = mode;
    this.pickerSelectedId = null;
    this.pickerVisible = true;
    this.pickerLoading.set(true);

    if (mode === 'BEBIDA') {
      this.inventoryService.getBebidas(this.tenantId).subscribe({
        next: (res) => {
          this.pickerItems.set(
            ((res?.object ?? []) as any[])
              .filter((b) => b.productoId != null)
              .map((b) => ({ id: b.productoId, name: b.nombre, dishProductId: b.productoId }))
          );
          this.pickerLoading.set(false);
        },
        error: () => {
          this.pickerItems.set([]);
          this.pickerLoading.set(false);
        }
      });
    } else {
      this.inventoryService.getByTenant(this.tenantId).subscribe({
        next: (res) => {
          this.pickerItems.set(
            ((res?.object ?? []) as any[])
              .filter((p) => !p.esSubReceta)
              .map((p) => ({ id: p.id, name: `${p.name} — ${p.price ?? 0}`, dishProductId: p.id }))
          );
          this.pickerLoading.set(false);
        },
        error: () => {
          this.pickerItems.set([]);
          this.pickerLoading.set(false);
        }
      });
    }
  }

  confirmPicker(): void {
    const selected = this.pickerItems().find((i) => i.id === this.pickerSelectedId);
    if (!selected) {
      return;
    }
    this.pickerVisible = false;
    this.openRecipe({ id: selected.dishProductId, name: selected.name });
  }

  /* ============ Receta ============ */

  openRecipe(product: any): void {
    this.recipeItem = product;
    this.recipeIngredients.set([]);
    this.recipeInsumoId = null;
    this.recipeCantidad = 0;
    this.recipeTipoIngrediente = 'BASE';
    this.recipePrecio = 0;
    this.recipeVisible = true;
    const dishId = this.normalizeProductId(product?.id);
    if (dishId != null) {
      this.loadRecipeLines(dishId);
      this.loadAssignedSubRecetas(dishId);
    }
  }

  private loadRecipeLines(dishId: number): void {
    this.loadingRecipes.set(true);
    const lines: any[] = [];
    this.inventoryService.getRecipes(dishId).subscribe({
      next: (res) => {
        const recipes = (res?.object ?? []).map((r: any) => ({
          ...r,
          kind: 'RECIPE',
          tipoIngrediente: r.modificable ? 'MODIFICABLE' : 'BASE'
        }));
        lines.push(...recipes);
        this.inventoryService.getAdditionals(dishId).subscribe({
          next: (res2) => {
            const additionals = (res2?.object ?? []).map((a: any) => ({
              ...a,
              kind: 'ADDITIONAL',
              tipoIngrediente: 'ADICIONAL'
            }));
            lines.push(...additionals);
            this.recipeIngredients.set(lines);
            this.loadingRecipes.set(false);
          },
          error: () => {
            this.recipeIngredients.set(lines);
            this.loadingRecipes.set(false);
          }
        });
      },
      error: () => {
        this.recipeIngredients.set(lines);
        this.loadingRecipes.set(false);
      }
    });
  }

  private loadAssignedSubRecetas(dishId: number): void {
    this.assignedSubRecetas.set([]);
    this.selectedSubRecetaId = null;
    this.inventoryService.getSubRecetasByDish(dishId).subscribe({
      next: (res) => {
        this.assignedSubRecetas.set(res?.object ?? []);
      },
      error: (err) => {
        console.error('Error cargando sub-recetas asignadas:', err);
        this.assignedSubRecetas.set([]);
      }
    });
  }

  assignSubRecetaToCurrent(): void {
    const dishId = this.normalizeProductId(this.recipeItem?.id);
    if (dishId == null || !this.selectedSubRecetaId || this.subRecetaAssignLoading()) {
      return;
    }
    this.subRecetaAssignLoading.set(true);
    this.inventoryService.assignSubReceta(dishId, this.selectedSubRecetaId).subscribe({
      next: () => {
        this.subRecetaAssignLoading.set(false);
        this.selectedSubRecetaId = null;
        this.loadAssignedSubRecetas(dishId);
        this.messageService.add({ severity: 'success', summary: 'Sub-receta asignada', detail: 'La preparación ahora suma sus insumos a este producto', life: 3000 });
      },
      error: (err) => {
        this.subRecetaAssignLoading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo asignar la sub-receta', life: 3000 });
      }
    });
  }

  removeAssignedSubReceta(sr: any): void {
    const dishId = this.normalizeProductId(this.recipeItem?.id);
    if (dishId == null) {
      return;
    }
    this.confirmationService.confirm({
      message: `¿Quitar la sub-receta "${sr.name}" de este producto?`,
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.inventoryService.removeSubRecetaFromDish(dishId, sr.id).subscribe({
          next: () => {
            this.loadAssignedSubRecetas(dishId);
          },
          error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo quitar la sub-receta', life: 3000 })
        });
      }
    });
  }

  addRecipeIngredient(): void {
    const dishId = this.normalizeProductId(this.recipeItem?.id);
    if (dishId == null || !this.recipeInsumoId || this.recipeCantidad <= 0) {
      return;
    }
    this.recipeAddLoading.set(true);
    const finish = () => {
      this.recipeInsumoId = null;
      this.recipeCantidad = 0;
      this.recipePrecio = 0;
      this.recipeTipoIngrediente = 'BASE';
      this.loadRecipeLines(dishId);
      this.messageService.add({ severity: 'success', summary: 'Insumo agregado', detail: 'Se actualizó la receta del platillo', life: 3000 });
    };
    if (this.recipeTipoIngrediente === 'ADICIONAL') {
      this.inventoryService.addAdditional(dishId, this.recipeInsumoId, this.recipeCantidad, this.recipePrecio || 0).subscribe({
        next: () => {
          finish();
          this.recipeAddLoading.set(false);
        },
        error: (err) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo agregar el adicional', life: 3000 });
          this.recipeAddLoading.set(false);
        }
      });
    } else {
      this.inventoryService.addRecipeIngredient(dishId, this.recipeInsumoId, this.recipeCantidad, this.recipeTipoIngrediente === 'MODIFICABLE').subscribe({
        next: () => {
          finish();
          this.recipeAddLoading.set(false);
        },
        error: (err) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo agregar el insumo', life: 3000 });
          this.recipeAddLoading.set(false);
        }
      });
    }
  }

  removeRecipeIngredient(ing: any): void {
    const label = ing.kind === 'ADDITIONAL' ? 'adicional' : 'ingrediente';
    this.confirmationService.confirm({
      message: `¿Quitar "${ing.insumoName}" (${label}) de la receta?`,
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        const dishId = this.normalizeProductId(this.recipeItem?.id);
        const action = ing.kind === 'ADDITIONAL'
          ? this.inventoryService.removeAdditional(ing.id)
          : this.inventoryService.removeRecipeIngredient(ing.id);
        action.subscribe({
          next: () => {
            if (dishId != null) {
              this.loadRecipeLines(dishId);
            }
          },
          error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: `No se pudo quitar el ${label}`, life: 3000 })
        });
      }
    });
  }

  startEditIngredient(ing: any): void {
    this.editingRecipe = ing;
    this.editRecipeCantidad = ing.cantidad;
    this.editRecipeModificable = !!ing.modificable;
    this.editRecipePrecio = Number(ing.precio ?? 0);
  }

  cancelEditIngredient(): void {
    this.editingRecipe = null;
  }

  saveEditIngredient(): void {
    if (!this.editingRecipe || this.editRecipeCantidad <= 0) {
      return;
    }
    const dishId = this.normalizeProductId(this.recipeItem?.id);
    const ing = this.editingRecipe;
    const action = ing.kind === 'ADDITIONAL'
      ? this.inventoryService.updateAdditional(ing.id, this.editRecipeCantidad, this.editRecipePrecio)
      : this.inventoryService.updateRecipeIngredient(ing.id, this.editRecipeCantidad, this.editRecipeModificable);
    action.subscribe({
      next: () => {
        this.editingRecipe = null;
        if (dishId != null) {
          this.loadRecipeLines(dishId);
        }
        this.messageService.add({ severity: 'success', summary: 'Actualizado', detail: 'Insumo de la receta actualizado', life: 3000 });
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo actualizar', life: 3000 })
    });
  }

  recipeIngredientCount(product: any): number {
    if (!product) return 0;
    if (Array.isArray(product.recipes)) {
      return product.recipes.length;
    }
    if (Array.isArray(product.insumos)) {
      return product.insumos.length;
    }
    return 0;
  }

  /* ============ Crear sub-receta ============ */

  openSubRecetaModal(): void {
    this.subRecetaVisible = true;
    this.subRecetaSaving.set(false);
    this.subRecetaNombre = '';
    this.subRecetaInsumoId = null;
    this.subRecetaCantidad = 0;
    this.subRecetaLines.set([]);
    this.loadInsumos();
  }

  addSubRecetaLine(): void {
    if (!this.subRecetaInsumoId || this.subRecetaCantidad <= 0) {
      return;
    }
    const insumo = this.insumos().find((i) => i.id === this.subRecetaInsumoId);
    if (!insumo) {
      return;
    }
    this.subRecetaLines.update((lines) => [
      ...lines,
      {
        insumoId: insumo.id,
        insumoName: insumo.nombre,
        cantidad: this.subRecetaCantidad,
        unidad: insumo.unidad ?? 'pieza'
      }
    ]);
    this.subRecetaInsumoId = null;
    this.subRecetaCantidad = 0;
  }

  removeSubRecetaLine(index: number): void {
    this.subRecetaLines.update((lines) => lines.filter((_, i) => i !== index));
  }

  saveSubReceta(): void {
    if (this.subRecetaSaving() || !this.subRecetaNombre?.trim()) {
      return;
    }
    const lines = this.subRecetaLines()
      .filter((l) => l.insumoId != null && l.cantidad > 0)
      .map((l) => ({ insumoId: l.insumoId, cantidad: l.cantidad, modificable: false }));
    if (lines.length === 0) {
      this.messageService.add({ severity: 'warn', summary: 'Sin insumos', detail: 'Agrega al menos un insumo a la sub-receta', life: 3000 });
      return;
    }
    this.subRecetaSaving.set(true);
    this.inventoryService.createSubReceta(this.tenantId, this.subRecetaNombre.trim(), lines).subscribe({
      next: (res) => {
        this.subRecetaSaving.set(false);
        if (res?.code !== 200) {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: res?.message || 'No se pudo crear la sub-receta', life: 3000 });
          return;
        }
        this.subRecetaVisible = false;
        this.messageService.add({ severity: 'success', summary: 'Sub-receta creada', detail: `"${this.subRecetaNombre.trim()}" está lista para asignarse a platillos o bebidas`, life: 4000 });
        this.loadSubRecetas();
      },
      error: (err) => {
        this.subRecetaSaving.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo crear la sub-receta', life: 3000 });
      }
    });
  }

  private normalizeProductId(id: unknown): number | null {
    if (id === null || id === undefined) {
      return null;
    }
    const parsed = typeof id === 'number' ? id : Number(id);
    return Number.isNaN(parsed) ? null : parsed;
  }
}