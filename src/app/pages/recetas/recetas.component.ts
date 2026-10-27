import { Component, OnInit, signal, computed } from '@angular/core';
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
  recipeGrupo = '';
  recipeAddLoading = signal<boolean>(false);
  recipeStep = signal<1 | 2 | 3>(1);
  editingRecipe: any | null = null;
  editRecipeCantidad = 0;
  editRecipeImportancia = 'BASE';
  editRecipePrecio = 0;
  editRecipeGrupo = '';
  readonly suggestedGroups = ['Proteína', 'Salsa', 'Guarnición', 'Complementos', 'Término', 'Queso', 'Toppings', 'Bebida'];

  // Sub-recetas asignadas en el diálogo de receta (Paso 2)
  assignedSubRecetas = signal<any[]>([]);
  selectedSubRecetaId: number | null = null;
  selectedSubImportancia = 'BASE';
  selectedSubPrecio = 0;
  selectedSubCantidad = 100;
  selectedSubUnidad = 'mililitros';
  subRecetaAssignLoading = signal<boolean>(false);

  // Variables / Variantes asignadas en el diálogo de receta (Paso 3)
  assignedVariantDishes = signal<any[]>([]);
  variantDishesLoading = signal<boolean>(false);
  selectedVariantDishId: number | null = null;
  selectedVariantPrecio = 0;
  selectedVariantGrupo = '';
  selectedVariantCantidad = 1;
  selectedVariantUnidad = 'pieza';
  variantDishAssignLoading = signal<boolean>(false);

  // Platillos y bebidas marcados como variables disponibles para asignar (excluyendo el actual)
  availableVariableProducts = computed(() => {
    const currentDishId = this.normalizeProductId(this.recipeItem?.id);
    return this.products()
      .filter((p) => p.esVariable === true && this.normalizeProductId(p.id) !== currentDishId)
      .map((p) => ({
        id: this.normalizeProductId(p.id),
        name: p.name,
        price: Number(p.price ?? 0),
        categoryName: p.categoryName || '',
        displayName: `${p.name} — $${p.price ?? 0}${p.categoryName ? ' (' + p.categoryName + ')' : ''}`
      }));
  });

  // Insumos disponibles para Paso 1 (excluye seleccionarse a sí mismo si la receta actual es una subreceta)
  availableInsumos = computed(() => {
    const list = this.insumos() || [];
    const currentDishId = this.normalizeProductId(this.recipeItem?.id);
    const isCurrentSubReceta = !!this.recipeItem?.esSubReceta;
    return list.filter((ins) => {
      if (isCurrentSubReceta && (ins.productoId === currentDishId || ins.id === currentDishId)) {
        return false;
      }
      return true;
    });
  });

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
  subRecetaTamanoLote = 1000;
  subRecetaUnidad = 'mililitros';
  subRecetaInsumoId: number | null = null;
  subRecetaCantidad = 0;
  subRecetaLines = signal<any[]>([]);

  // Restock / Producción de sub-receta
  restockModalVisible = false;
  restockItem: any = null;
  restockLotes = 1;
  restockLoading = signal<boolean>(false);

  readonly unidadMedidaOptions = [
    { label: 'Mililitros (ml)', value: 'mililitros' },
    { label: 'Gramos (g)', value: 'gramos' },
    { label: 'Piezas (pz)', value: 'pieza' }
  ];

  readonly importanciaOptions = [
    { label: 'Base (siempre en la receta)', value: 'BASE' },
    { label: 'Modificable (puede retirarse)', value: 'MODIFICABLE' },
    { label: 'Adicional (costo extra)', value: 'ADICIONAL' },
    { label: 'Variante (subcomanda en cards)', value: 'VARIANTE' }
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
    this.recipeGrupo = '';
    this.selectedVariantDishId = null;
    this.selectedVariantPrecio = 0;
    this.selectedVariantGrupo = '';
    this.selectedVariantCantidad = 1;
    this.selectedVariantUnidad = 'pieza';
    this.assignedVariantDishes.set([]);
    this.recipeStep.set(1);
    this.recipeVisible = true;
    const dishId = this.normalizeProductId(product?.id);
    if (dishId != null) {
      this.loadRecipeLines(dishId);
      this.loadAssignedSubRecetas(dishId);
      this.loadAssignedVariantDishes(dishId);
    }
  }

  private loadRecipeLines(dishId: number): void {
    this.loadingRecipes.set(true);
    const lines: any[] = [];
    const insumoMap = new Map<number, any>();
    (this.insumos() || []).forEach((ins) => insumoMap.set(ins.id, ins));

    this.inventoryService.getRecipes(dishId).subscribe({
      next: (res) => {
        const recipes = (res?.object ?? []).map((r: any) => {
          const ins = insumoMap.get(r.insumoId);
          return {
            ...r,
            esSubReceta: ins ? !!ins.esSubReceta : false,
            kind: 'RECIPE',
            tipoIngrediente: r.modificable ? 'MODIFICABLE' : 'BASE'
          };
        });
        lines.push(...recipes);
        this.inventoryService.getAdditionals(dishId).subscribe({
          next: (res2) => {
            const additionals = (res2?.object ?? []).map((a: any) => {
              const ins = insumoMap.get(a.insumoId);
              return {
                ...a,
                esSubReceta: ins ? !!ins.esSubReceta : false,
                kind: 'ADDITIONAL',
                tipoIngrediente: (a.isVariant || a.tipoIngrediente === 'VARIANTE' || a.grupo === 'VARIANTE') ? 'VARIANTE' : 'ADICIONAL'
              };
            });
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
        const list = (res?.object ?? []).map((sr: any) => ({
          ...sr,
          _savedImportancia: sr.importancia || 'BASE',
          _savedPrecio: Number(sr.precio ?? 0),
          _savedCantidad: Number(sr.cantidad ?? 1),
          _savedUnidad: sr.unidad || 'mililitros'
        }));
        this.assignedSubRecetas.set(list);
      },
      error: (err) => {
        console.error('Error cargando sub-recetas asignadas:', err);
        this.assignedSubRecetas.set([]);
      }
    });
  }

  onSelectedSubRecetaChange(subId: number | null): void {
    this.selectedSubRecetaId = subId;
    if (subId) {
      const sr = this.subRecetas().find((s) => s.id === subId);
      if (sr?.unidad) {
        this.selectedSubUnidad = sr.unidad;
      }
    }
  }

  assignSubRecetaToCurrent(): void {
    const dishId = this.normalizeProductId(this.recipeItem?.id);
    if (dishId == null || !this.selectedSubRecetaId || this.subRecetaAssignLoading()) {
      return;
    }
    const qty = this.selectedSubCantidad > 0 ? this.selectedSubCantidad : 1;
    const uni = this.selectedSubUnidad || 'mililitros';
    this.subRecetaAssignLoading.set(true);
    this.inventoryService.assignSubReceta(
      dishId,
      this.selectedSubRecetaId,
      this.selectedSubImportancia,
      this.selectedSubPrecio || 0,
      qty,
      uni
    ).subscribe({
      next: (res) => {
        this.subRecetaAssignLoading.set(false);
        this.selectedSubRecetaId = null;
        this.selectedSubImportancia = 'BASE';
        this.selectedSubPrecio = 0;
        this.selectedSubCantidad = 100;
        this.loadAssignedSubRecetas(dishId);
        if (res?.code !== 200) {
          this.messageService.add({ severity: 'warn', summary: 'Atención', detail: res?.message || 'No se pudo asignar la sub-receta', life: 3000 });
          return;
        }
        this.messageService.add({ severity: 'success', summary: 'Sub-receta asignada', detail: `Se asignaron ${qty} ${uni} al platillo`, life: 3000 });
      },
      error: (err) => {
        this.subRecetaAssignLoading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo asignar la sub-receta', life: 3000 });
      }
    });
  }

  saveAssignedSubImportancia(sr: any, event?: any): void {
    const dishId = this.normalizeProductId(this.recipeItem?.id);
    if (dishId == null || !sr) {
      return;
    }
    const newImportancia = event?.value ?? sr.importancia ?? 'BASE';
    sr.importancia = newImportancia;
    const currentPrecio = Number(sr.precio ?? 0);
    const currentCantidad = Number(sr.cantidad ?? 1);
    const currentUnidad = sr.unidad || 'mililitros';

    // Evitar llamadas repetidas o bucles infinitos si el valor no cambió
    if (
      sr._savedImportancia === newImportancia &&
      sr._savedPrecio === currentPrecio &&
      sr._savedCantidad === currentCantidad &&
      sr._savedUnidad === currentUnidad
    ) {
      return;
    }

    const prevImportancia = sr._savedImportancia ?? 'BASE';
    const prevPrecio = sr._savedPrecio ?? 0;
    const prevCantidad = sr._savedCantidad ?? 1;
    const prevUnidad = sr._savedUnidad ?? 'mililitros';
    sr._savedImportancia = newImportancia;
    sr._savedPrecio = currentPrecio;
    sr._savedCantidad = currentCantidad;
    sr._savedUnidad = currentUnidad;

    this.inventoryService.updateSubRecetaImportance(
      dishId,
      sr.id,
      newImportancia,
      currentPrecio,
      currentCantidad,
      currentUnidad
    ).subscribe({
      next: (res) => {
        if (res?.code !== 200) {
          sr._savedImportancia = prevImportancia;
          sr._savedPrecio = prevPrecio;
          sr._savedCantidad = prevCantidad;
          sr._savedUnidad = prevUnidad;
          sr.importancia = prevImportancia;
          sr.precio = prevPrecio;
          sr.cantidad = prevCantidad;
          sr.unidad = prevUnidad;
          this.messageService.add({ severity: 'warn', summary: 'Atención', detail: res?.message || 'No se pudo actualizar la sub-receta', life: 3000 });
          return;
        }
        this.messageService.add({
          severity: 'success',
          summary: 'Sub-receta actualizada',
          detail: `"${sr.name}" quedó con porción de ${currentCantidad} ${currentUnidad} (${this.importanciaLabel(newImportancia)})`,
          life: 2500
        });
      },
      error: (err) => {
        sr._savedImportancia = prevImportancia;
        sr._savedPrecio = prevPrecio;
        sr._savedCantidad = prevCantidad;
        sr._savedUnidad = prevUnidad;
        sr.importancia = prevImportancia;
        sr.precio = prevPrecio;
        sr.cantidad = prevCantidad;
        sr.unidad = prevUnidad;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo actualizar la sub-receta', life: 3000 });
      }
    });
  }

  private importanciaLabel(importancia: string): string {
    const opt = this.importanciaOptions.find((o) => o.value === importancia);
    return opt ? opt.label.toLowerCase() : importancia.toLowerCase();
  }

  removeAssignedSubReceta(sr: any): void {
    const dishId = this.normalizeProductId(this.recipeItem?.id);
    if (dishId == null || !sr) {
      return;
    }
    this.confirmationService.confirm({
      message: `¿Quitar la sub-receta "${sr.name}" de este producto?`,
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.inventoryService.removeSubRecetaFromDish(dishId, sr.id).subscribe({
          next: () => {
            this.assignedSubRecetas.update((list) => list.filter((item) => item.id !== sr.id));
            this.messageService.add({ severity: 'success', summary: 'Sub-receta removida', detail: `Se desvinculó "${sr.name}" del platillo`, life: 2500 });
          },
          error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo quitar la sub-receta', life: 3000 })
        });
      }
    });
  }

  trackBySubReceta(_index: number, item: any): number {
    return item?.id ?? _index;
  }

  trackByIngredient(_index: number, item: any): number {
    return item?.id ?? _index;
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
      this.recipeGrupo = '';
      this.loadRecipeLines(dishId);
      this.messageService.add({ severity: 'success', summary: 'Insumo agregado', detail: 'Se actualizó la receta del platillo', life: 3000 });
    };
    if (this.recipeTipoIngrediente === 'ADICIONAL' || this.recipeTipoIngrediente === 'VARIANTE') {
      const isVariant = this.recipeTipoIngrediente === 'VARIANTE';
      this.inventoryService.addAdditional(dishId, this.recipeInsumoId, this.recipeCantidad, this.recipePrecio || 0, this.recipeGrupo, isVariant).subscribe({
        next: () => {
          finish();
          this.recipeAddLoading.set(false);
        },
        error: (err) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo agregar la opción', life: 3000 });
          this.recipeAddLoading.set(false);
        }
      });
    } else {
      this.inventoryService.addRecipeIngredient(dishId, this.recipeInsumoId, this.recipeCantidad, this.recipeTipoIngrediente === 'MODIFICABLE', this.recipeGrupo).subscribe({
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
    this.editRecipeImportancia = ing.tipoIngrediente || 'BASE';
    this.editRecipePrecio = Number(ing.precio ?? 0);
    this.editRecipeGrupo = ing.grupo || '';
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
    const importancia = this.editRecipeImportancia || 'BASE';
    const action = ing.kind === 'ADDITIONAL'
      ? this.inventoryService.updateAdditional(ing.id, this.editRecipeCantidad, importancia, this.editRecipePrecio || 0, this.editRecipeGrupo)
      : this.inventoryService.updateRecipeIngredient(ing.id, this.editRecipeCantidad, importancia, this.editRecipePrecio || 0, this.editRecipeGrupo);
    action.subscribe({
      next: (res) => {
        this.editingRecipe = null;
        if (dishId != null) {
          this.loadRecipeLines(dishId);
        }
        if (res?.code === 400) {
          this.messageService.add({ severity: 'warn', summary: 'Atención', detail: res?.message || 'No se pudo actualizar', life: 3000 });
          return;
        }
        this.messageService.add({ severity: 'success', summary: 'Actualizado', detail: `Importancia: ${this.importanciaLabel(importancia)}`, life: 3000 });
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo actualizar', life: 3000 })
    });
  }

  saveRecipeStep1AndClose(): void {
    this.recipeVisible = false;
    this.messageService.add({
      severity: 'success',
      summary: 'Receta guardada',
      detail: 'Insumos registrados correctamente (sin sub-receta)',
      life: 3000
    });
  }

  goToRecipeStep2(): void {
    this.recipeStep.set(2);
  }

  goToRecipeStep1(): void {
    this.recipeStep.set(1);
  }

  finishRecipeStep2(): void {
    this.recipeVisible = false;
    this.messageService.add({
      severity: 'success',
      summary: 'Receta finalizada',
      detail: 'Insumos y sub-recetas guardados exitosamente',
      life: 3000
    });
  }

  goToRecipeStep3(): void {
    this.recipeStep.set(3);
  }

  finishRecipeStep3(): void {
    this.recipeVisible = false;
    this.messageService.add({
      severity: 'success',
      summary: 'Receta completa guardada',
      detail: 'Insumos, sub-recetas y variables configurados correctamente',
      life: 3000
    });
  }

  loadAssignedVariantDishes(dishId: number): void {
    this.variantDishesLoading.set(true);
    this.inventoryService.getVariantDishes(dishId).subscribe({
      next: (res) => {
        const list = (res?.object ?? []).map((v: any) => ({
          ...v,
          _savedPrecio: Number(v.precio ?? 0),
          _savedCantidad: Number(v.cantidad ?? 1),
          _savedUnidad: v.unidad || 'pieza',
          _savedGrupo: v.grupo || ''
        }));
        this.assignedVariantDishes.set(list);
        this.variantDishesLoading.set(false);
      },
      error: (err) => {
        console.error('Error cargando variables asignadas:', err);
        this.assignedVariantDishes.set([]);
        this.variantDishesLoading.set(false);
      }
    });
  }

  onSelectedVariantDishChange(varDishId: number | null): void {
    this.selectedVariantDishId = varDishId;
    if (varDishId) {
      const p = this.products().find((prod) => this.normalizeProductId(prod.id) === varDishId);
      if (p) {
        this.selectedVariantPrecio = Number(p.price ?? 0);
        this.selectedVariantGrupo = p.categoryName || 'Variante';
      }
    }
  }

  assignVariantDishToCurrent(): void {
    const dishId = this.normalizeProductId(this.recipeItem?.id);
    if (dishId == null || !this.selectedVariantDishId || this.variantDishAssignLoading()) {
      return;
    }
    this.variantDishAssignLoading.set(true);
    const qty = this.selectedVariantCantidad > 0 ? this.selectedVariantCantidad : 1;
    const uni = this.selectedVariantUnidad || 'pieza';
    const precio = this.selectedVariantPrecio || 0;
    const grupo = this.selectedVariantGrupo || '';

    this.inventoryService.addVariantDish(
      dishId,
      this.selectedVariantDishId,
      precio,
      grupo,
      qty,
      uni
    ).subscribe({
      next: (res) => {
        this.variantDishAssignLoading.set(false);
        this.selectedVariantDishId = null;
        this.selectedVariantPrecio = 0;
        this.selectedVariantGrupo = '';
        this.selectedVariantCantidad = 1;
        this.selectedVariantUnidad = 'pieza';
        this.loadAssignedVariantDishes(dishId);
        if (res?.code !== 200) {
          this.messageService.add({ severity: 'warn', summary: 'Atención', detail: res?.message || 'No se pudo vincular la variable', life: 3000 });
          return;
        }
        this.messageService.add({ severity: 'success', summary: 'Variable agregada', detail: 'Platillo/bebida vinculado como variante de esta receta', life: 3000 });
      },
      error: (err) => {
        this.variantDishAssignLoading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo agregar la variable', life: 3000 });
      }
    });
  }

  saveAssignedVariantDish(v: any): void {
    if (!v || !v.id) return;
    const currentPrecio = Number(v.precio ?? 0);
    const currentCantidad = Number(v.cantidad ?? 1);
    const currentUnidad = v.unidad || 'pieza';
    const currentGrupo = v.grupo || '';

    if (
      v._savedPrecio === currentPrecio &&
      v._savedCantidad === currentCantidad &&
      v._savedUnidad === currentUnidad &&
      v._savedGrupo === currentGrupo
    ) {
      return;
    }

    const prevPrecio = v._savedPrecio ?? 0;
    const prevCantidad = v._savedCantidad ?? 1;
    const prevUnidad = v._savedUnidad ?? 'pieza';
    const prevGrupo = v._savedGrupo ?? '';

    v._savedPrecio = currentPrecio;
    v._savedCantidad = currentCantidad;
    v._savedUnidad = currentUnidad;
    v._savedGrupo = currentGrupo;

    this.inventoryService.updateVariantDish(
      v.id,
      currentPrecio,
      currentGrupo,
      currentCantidad,
      currentUnidad
    ).subscribe({
      next: (res) => {
        if (res?.code !== 200) {
          v._savedPrecio = prevPrecio;
          v._savedCantidad = prevCantidad;
          v._savedUnidad = prevUnidad;
          v._savedGrupo = prevGrupo;
          v.precio = prevPrecio;
          v.cantidad = prevCantidad;
          v.unidad = prevUnidad;
          v.grupo = prevGrupo;
          this.messageService.add({ severity: 'warn', summary: 'Atención', detail: res?.message || 'No se pudo actualizar la variable', life: 3000 });
          return;
        }
        this.messageService.add({
          severity: 'success',
          summary: 'Variable actualizada',
          detail: `"${v.variantDishName || 'Variante'}" actualizada correctamente`,
          life: 2500
        });
      },
      error: (err) => {
        v._savedPrecio = prevPrecio;
        v._savedCantidad = prevCantidad;
        v._savedUnidad = prevUnidad;
        v._savedGrupo = prevGrupo;
        v.precio = prevPrecio;
        v.cantidad = prevCantidad;
        v.unidad = prevUnidad;
        v.grupo = prevGrupo;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo actualizar la variable', life: 3000 });
      }
    });
  }

  removeAssignedVariantDish(v: any): void {
    if (!v || !v.id) return;
    this.confirmationService.confirm({
      message: `¿Desvincular "${v.variantDishName}" como variante de esta receta?`,
      header: 'Confirmar desvinculación',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.inventoryService.removeVariantDish(v.id).subscribe({
          next: () => {
            this.assignedVariantDishes.update((list) => list.filter((item) => item.id !== v.id));
            this.messageService.add({ severity: 'success', summary: 'Variable eliminada', detail: `Se quitó "${v.variantDishName}" de la receta`, life: 2500 });
          },
          error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo quitar la variable', life: 3000 })
        });
      }
    });
  }

  trackByVariantDish(_index: number, item: any): number {
    return item?.id ?? _index;
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
    this.subRecetaTamanoLote = 1000;
    this.subRecetaUnidad = 'mililitros';
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
    const tamano = Number(this.subRecetaTamanoLote) > 0 ? Number(this.subRecetaTamanoLote) : 1000;
    const uni = this.subRecetaUnidad || 'mililitros';
    this.subRecetaSaving.set(true);
    this.inventoryService.createSubReceta(this.tenantId, this.subRecetaNombre.trim(), lines, tamano, uni).subscribe({
      next: (res) => {
        this.subRecetaSaving.set(false);
        if (res?.code !== 200) {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: res?.message || 'No se pudo crear la sub-receta', life: 3000 });
          return;
        }
        this.subRecetaVisible = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Sub-receta creada',
          detail: `"${this.subRecetaNombre.trim()}" con rendimiento de ${tamano} ${uni} creada exitosamente`,
          life: 4000
        });
        this.loadSubRecetas();
      },
      error: (err) => {
        this.subRecetaSaving.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo crear la sub-receta', life: 3000 });
      }
    });
  }

  /* ============ Restock / Producción de sub-receta ============ */

  openRestockModal(sr: any): void {
    if (!sr) return;
    this.restockItem = sr;
    this.restockLotes = 1;
    this.restockLoading.set(false);
    this.restockModalVisible = true;
  }

  closeRestockModal(): void {
    this.restockModalVisible = false;
    this.restockItem = null;
    this.restockLotes = 1;
    this.restockLoading.set(false);
  }

  confirmRestock(): void {
    if (!this.restockItem || this.restockLotes <= 0 || this.restockLoading()) {
      return;
    }
    this.restockLoading.set(true);
    const subRecetaId = this.restockItem.id;
    const lotes = Number(this.restockLotes) > 0 ? Number(this.restockLotes) : 1;
    const tamanoLote = Number(this.restockItem.tamanoLote || 1000);
    const unidad = this.restockItem.unidad || 'mililitros';

    this.inventoryService.producirLoteSubReceta(subRecetaId, lotes).subscribe({
      next: (res) => {
        this.restockLoading.set(false);
        if (res?.code !== 200) {
          this.messageService.add({
            severity: 'error',
            summary: 'Error al preparar lote',
            detail: res?.message || 'No se pudo generar el restock de la sub-receta',
            life: 5000
          });
          return;
        }
        const data = res?.data;
        const totalProducido = data?.producidoTotal ?? (tamanoLote * lotes);
        const nuevoStock = data?.nuevoStock ?? ((this.restockItem.stock || 0) + totalProducido);

        this.messageService.add({
          severity: 'success',
          summary: '¡Producción generada!',
          detail: `Se prepararon ${lotes} lote(s) (+${totalProducido} ${unidad}) de "${this.restockItem.name}". Stock actual: ${nuevoStock} ${unidad}. Insumos descontados correctamente.`,
          life: 5000
        });
        this.closeRestockModal();
        this.loadSubRecetas();
        this.loadInsumos();
      },
      error: (err) => {
        this.restockLoading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Insumos insuficientes o error',
          detail: err?.error?.message || 'No se pudo generar la preparación del lote. Verifica el inventario de insumos.',
          life: 5000
        });
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