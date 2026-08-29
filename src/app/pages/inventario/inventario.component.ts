import { Component, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Table, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { TabsModule } from 'primeng/tabs';
import { TooltipModule } from 'primeng/tooltip';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { MessageModule } from 'primeng/message';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { InventoryService } from './service/inventory.service';
import { AuthService } from '@/auth/auth.service';

interface InvItem {
  id: number;
  name: string;
  description?: string;
  categoryId?: number;
  categoryName?: string;
  price?: number;
  imageUrl?: string;
  esPlatillo: boolean;
  insumos: RecipeIngredient[];
  adicionales: DishAdditional[];
  stock: number;
  stockMinimo: number;
  unidad: string;
  lowStock: boolean;
  outOfStock: boolean;
}

interface RecipeIngredient {
  id: number;
  insumoId: number;
  insumoName: string;
  unidad: string;
  cantidad: number;
  modificable: boolean;
  stock: number;
  stockMinimo: number;
}

interface DishAdditional {
  id: number;
  insumoId: number;
  insumoName: string;
  unidad: string;
  cantidad: number;
  stock: number;
}

interface Insumo {
  id: number;
  nombre: string;
  unidad: string;
  stock: number;
  stockMinimo: number;
}

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    BadgeModule,
    TagModule,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    CheckboxModule,
    TabsModule,
    TooltipModule,
    IconFieldModule,
    InputIconModule,
    ToastModule,
    MessageModule,
    ConfirmDialogModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './inventario.component.html',
  styleUrls: ['./inventario.component.scss']
})
export class InventarioComponent implements OnInit {
  @ViewChild('dt') dt!: Table;

  items = signal<InvItem[]>([]);
  insumos = signal<Insumo[]>([]);
  loading = signal(false);
  loadingInsumos = signal(false);
  tenantId = 0;
  unidades = ['pieza', 'gramos', 'mililitros'];

  restockVisible = false;
  restockItem: InvItem | null = null;
  restockCantidad = 0;

  editVisible = false;
  editItem: InvItem | null = null;
  editStock = 0;
  editMin = 0;
  editUnidad = 'pieza';

  recipeVisible = false;
  recipeItem: InvItem | null = null;
  recipeIngredients = signal<RecipeIngredient[]>([]);
  recipeInsumoId: number | null = null;
  recipeCantidad = 0;
  recipeModificable = false;
  loadingRecipes = signal(false);

  editingRecipe: RecipeIngredient | null = null;
  editRecipeCantidad = 0;
  editRecipeModificable = false;

  additionalVisible = false;
  additionalItem: InvItem | null = null;
  dishAdditionals = signal<DishAdditional[]>([]);
  additionalInsumoId: number | null = null;
  additionalCantidad = 0;

  insumoDialogVisible = false;
  editingInsumo: Insumo | null = null;
  insumoNombre = '';
  insumoUnidad = 'pieza';
  insumoStock = 0;
  insumoMin = 0;

  insumoRestockVisible = false;
  insumoRestockTarget: Insumo | null = null;
  insumoRestockCantidad = 0;

  constructor(
    private inventoryService: InventoryService,
    private authService: AuthService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit() {
    const user = this.authService.getCurrentUser();
    this.tenantId = user?.tenantId || 0;
    if (this.tenantId) {
      this.load();
      this.loadInsumos();
    }
  }

  load() {
    this.loading.set(true);
    this.inventoryService.getByTenant(this.tenantId).subscribe({
      next: (res) => {
        this.items.set(res.object || []);
        this.loading.set(false);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el inventario' });
        this.loading.set(false);
      }
    });
  }

  loadInsumos() {
    this.loadingInsumos.set(true);
    this.inventoryService.getInsumos(this.tenantId).subscribe({
      next: (res) => {
        this.insumos.set(res.object || []);
        this.loadingInsumos.set(false);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los insumos' });
        this.loadingInsumos.set(false);
      }
    });
  }

  /* ============ Productos (sin receta): restock / editar stock ============ */

  openRestock(item: InvItem) {
    this.restockItem = item;
    this.restockCantidad = 0;
    this.restockVisible = true;
  }

  doRestock() {
    if (!this.restockItem || this.restockCantidad <= 0) return;
    this.inventoryService.restock(this.restockItem.id, this.restockCantidad).subscribe({
      next: (res) => {
        this.messageService.add({ severity: 'success', summary: 'Exitoso', detail: `Stock actualizado a ${res.object}` });
        this.restockVisible = false;
        this.load();
      },
      error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo restockear' })
    });
  }

  openEdit(item: InvItem) {
    this.editItem = item;
    this.editStock = item.stock;
    this.editMin = item.stockMinimo;
    this.editUnidad = item.unidad || 'pieza';
    this.editVisible = true;
  }

  saveEdit() {
    if (!this.editItem) return;
    this.inventoryService.updateStock(this.editItem.id, this.editStock, this.editMin, this.editUnidad).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Exitoso', detail: 'Inventario actualizado' });
        this.editVisible = false;
        this.load();
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo actualizar' })
    });
  }

  /* ============ Recetas (BOM) ============ */

  openRecipe(item: InvItem) {
    this.recipeItem = item;
    this.recipeIngredients.set(item.insumos || []);
    this.recipeInsumoId = null;
    this.recipeCantidad = 0;
    this.recipeModificable = false;
    this.recipeVisible = true;
  }

  addIngredient() {
    if (!this.recipeItem || !this.recipeInsumoId || this.recipeCantidad <= 0) return;
    this.inventoryService.addRecipeIngredient(
      this.recipeItem.id,
      this.recipeInsumoId,
      this.recipeCantidad,
      this.recipeModificable
    ).subscribe({
      next: () => {
        this.recipeInsumoId = null;
        this.recipeCantidad = 0;
        this.recipeModificable = false;
        this.loadRecipes();
        this.load();
      },
      error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo agregar el insumo' })
    });
  }

  removeIngredient(ing: RecipeIngredient) {
    this.inventoryService.removeRecipeIngredient(ing.id).subscribe({
      next: () => {
        this.loadRecipes();
        this.load();
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo quitar el insumo' })
    });
  }

  startEditIngredient(ing: RecipeIngredient) {
    this.editingRecipe = ing;
    this.editRecipeCantidad = ing.cantidad;
    this.editRecipeModificable = ing.modificable;
  }

  cancelEditIngredient() {
    this.editingRecipe = null;
  }

  saveEditIngredient() {
    if (!this.editingRecipe || this.editRecipeCantidad <= 0) return;
    this.inventoryService.updateRecipeIngredient(this.editingRecipe.id, this.editRecipeCantidad, this.editRecipeModificable).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Exitoso', detail: 'Insumo de receta actualizado' });
        this.editingRecipe = null;
        this.loadRecipes();
        this.load();
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo actualizar el insumo' })
    });
  }

  private loadRecipes() {
    if (!this.recipeItem) return;
    this.inventoryService.getRecipes(this.recipeItem.id).subscribe({
      next: (res) => this.recipeIngredients.set(res.object || [])
    });
  }

  /* ============ Adicionales ============ */

  openAdditionals(item: InvItem) {
    this.additionalItem = item;
    this.dishAdditionals.set(item.adicionales || []);
    this.additionalInsumoId = null;
    this.additionalCantidad = 0;
    this.additionalVisible = true;
  }

  addAdditionalItem() {
    if (!this.additionalItem || !this.additionalInsumoId || this.additionalCantidad <= 0) return;
    this.inventoryService.addAdditional(this.additionalItem.id, this.additionalInsumoId, this.additionalCantidad).subscribe({
      next: () => {
        this.additionalInsumoId = null;
        this.additionalCantidad = 0;
        this.loadAdditionals();
        this.load();
      },
      error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo agregar el adicional' })
    });
  }

  removeAdditionalItem(add: DishAdditional) {
    this.inventoryService.removeAdditional(add.id).subscribe({
      next: () => {
        this.loadAdditionals();
        this.load();
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo quitar el adicional' })
    });
  }

  private loadAdditionals() {
    if (!this.additionalItem) return;
    this.inventoryService.getAdditionals(this.additionalItem.id).subscribe({
      next: (res) => this.dishAdditionals.set(res.object || [])
    });
  }

  /* ============ Insumos (catálogo compartido) ============ */

  openNewInsumo() {
    this.editingInsumo = null;
    this.insumoNombre = '';
    this.insumoUnidad = 'pieza';
    this.insumoStock = 0;
    this.insumoMin = 0;
    this.insumoDialogVisible = true;
  }

  openEditInsumo(insumo: Insumo) {
    this.editingInsumo = insumo;
    this.insumoNombre = insumo.nombre;
    this.insumoUnidad = insumo.unidad || 'pieza';
    this.insumoStock = insumo.stock;
    this.insumoMin = insumo.stockMinimo;
    this.insumoDialogVisible = true;
  }

  saveInsumo() {
    if (!this.insumoNombre.trim()) return;
    const done = () => {
      this.insumoDialogVisible = false;
      this.loadInsumos();
    };
    if (this.editingInsumo) {
      this.inventoryService.updateInsumo(
        this.editingInsumo.id, this.insumoNombre, this.insumoUnidad, this.insumoStock, this.insumoMin
      ).subscribe({
        next: () => { this.messageService.add({ severity: 'success', summary: 'Exitoso', detail: 'Insumo actualizado' }); done(); },
        error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo actualizar el insumo' })
      });
    } else {
      this.inventoryService.createInsumo(
        this.tenantId, this.insumoNombre, this.insumoUnidad, this.insumoStock, this.insumoMin
      ).subscribe({
        next: () => { this.messageService.add({ severity: 'success', summary: 'Exitoso', detail: 'Insumo creado' }); done(); },
        error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo crear el insumo' })
      });
    }
  }

  deleteInsumo(insumo: Insumo) {
    this.confirmationService.confirm({
      message: `¿Eliminar el insumo "${insumo.nombre}"?`,
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.inventoryService.deleteInsumo(insumo.id).subscribe({
          next: (res) => {
            if (res.code !== 200) {
              this.messageService.add({ severity: 'warn', summary: 'Aviso', detail: res.message });
              return;
            }
            this.messageService.add({ severity: 'success', summary: 'Exitoso', detail: 'Insumo eliminado' });
            this.loadInsumos();
          },
          error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar el insumo' })
        });
      }
    });
  }

  openInsumoRestock(insumo: Insumo) {
    this.insumoRestockTarget = insumo;
    this.insumoRestockCantidad = 0;
    this.insumoRestockVisible = true;
  }

  doInsumoRestock() {
    if (!this.insumoRestockTarget || this.insumoRestockCantidad <= 0) return;
    this.inventoryService.restockInsumo(this.insumoRestockTarget.id, this.insumoRestockCantidad).subscribe({
      next: (res) => {
        this.messageService.add({ severity: 'success', summary: 'Exitoso', detail: `Stock del insumo: ${res.object}` });
        this.insumoRestockVisible = false;
        this.loadInsumos();
        this.load();
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo reabastecer' })
    });
  }

  /* ============ Helpers ============ */

  isDish(item: InvItem): boolean {
    return item.esPlatillo;
  }

  insumoLabel(insumo: Insumo): string {
    return `${insumo.nombre} (${insumo.unidad} · stock ${insumo.stock})`;
  }

  stockSeverity(item: InvItem): 'success' | 'warn' | 'danger' {
    if (item.outOfStock) return 'danger';
    if (item.lowStock) return 'warn';
    return 'success';
  }

  stockLabel(item: InvItem): string {
    if (item.outOfStock) return 'Agotado';
    if (item.lowStock) return 'Stock bajo';
    return 'Disponible';
  }

  /** Insumo que limita el stock del platillo (el que menos alcanza) */
  bottleneck(item: InvItem): RecipeIngredient | null {
    if (!item.insumos?.length) return null;
    let min = Infinity;
    let bottleneck: RecipeIngredient | null = null;
    for (const ins of item.insumos) {
      if (!ins.cantidad || ins.cantidad <= 0) continue;
      const available = Math.floor(ins.stock / ins.cantidad);
      if (available < min) {
        min = available;
        bottleneck = ins;
      }
    }
    return bottleneck;
  }

  stockHint(item: InvItem): string {
    const bot = this.bottleneck(item);
    if (!bot) return 'Stock calculado de los insumos de la receta.';
    return `Stock calculado de ${item.insumos.length} insumo(s). Lo limita: ${bot.insumoName} (${bot.stock} ${bot.unidad} ÷ ${bot.cantidad} = ${Math.floor(bot.stock / bot.cantidad)}).`;
  }
}
