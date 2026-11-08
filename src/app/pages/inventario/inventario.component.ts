import { Component, OnInit, signal, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Table, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { SelectModule } from 'primeng/select';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { MessageModule } from 'primeng/message';
import { InventoryService } from './service/inventory.service';
import { StockRequestService } from './service/stock-request.service';
import { AuthService } from '@/auth/auth.service';
import { isBeverageCategoryName as checkBeverageCategory, isBeverageProductName as checkBeverageProduct } from '../kitchen/services/order-beverage-utils';

interface InvItem {
  id: number;
  name: string;
  nombre?: string;
  description?: string;
  categoryId?: number;
  categoryName?: string;
  categories?: { id: number; name: string }[];
  stock: number;
  stockMinimo?: number;
  unidad?: string;
  price?: number;
  lowStock: boolean;
  outOfStock: boolean;
  esSubReceta?: boolean;
  esPlatillo?: boolean;
  esBebida?: boolean;
  insumos?: any[];
  subRecetas?: any[];
  adicionales?: any[];
}

interface Insumo {
  id: number;
  nombre: string;
  unidad: string;
  stock: number;
  stockMinimo: number;
  stockCocina?: number;
  stockBarra?: number;
  stockBodega?: number;
}

type TabKey = 'products' | 'insumos' | 'bebidas' | 'insumos-bebida';

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    ConfirmDialogModule,
    InputNumberModule,
    InputTextModule,
    TooltipModule,
    IconFieldModule,
    InputIconModule,
    SelectModule,
    ToastModule,
    MessageModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './inventario.component.html',
  styleUrls: ['./inventario.component.scss']
})
export class InventarioComponent implements OnInit {
  @ViewChild('dt') dt!: Table;

  items = signal<InvItem[]>([]);
  insumos = signal<Insumo[]>([]);
  bebidas = signal<any[]>([]);
  loading = signal(false);
  loadingInsumos = signal(false);
  loadingBebidas = signal(false);
  tenantId = 0;

  // Modo de la página: 'cocina' (platillos + insumos) o 'barra' (bebidas + insumos de bebida)
  mode: 'cocina' | 'barra' = 'cocina';

  // IDs de productos de menú que son bebidas (para excluirlos de los platillos de cocina)
  private beverageProductIds = new Set<number>();

  tabs(): { key: TabKey; label: string; icon: string }[] {
    return this.mode === 'cocina'
      ? [
          { key: 'products', label: 'Platillos', icon: 'pi pi-bars' },
          { key: 'insumos', label: 'Insumos', icon: 'pi pi-box' }
        ]
      : [
          { key: 'bebidas', label: 'Bebidas', icon: 'pi pi-glass' },
          { key: 'insumos-bebida', label: 'Insumos de bebida', icon: 'pi pi-box' }
        ];
  }

  // Pestaña activa de la tabla unificada
  activeTab = signal<TabKey>('products');

  setActiveTab(tab: TabKey) {
    this.activeTab.set(tab);
    this.dt?.reset();
  }

  onGlobalFilter(table: Table, event: Event) {
    table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
  }

  constructor(
    private inventoryService: InventoryService,
    private stockRequestService: StockRequestService,
    private authService: AuthService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.mode = this.route.snapshot.data['mode'] === 'barra' ? 'barra' : 'cocina';
    this.activeTab.set(this.mode === 'cocina' ? 'products' : 'bebidas');

    const user = this.authService.getCurrentUser();
    this.tenantId = user?.tenantId || 0;
    if (this.tenantId) {
      this.load();
      this.loadInsumos();
      this.loadBebidas();
    }
  }

  load() {
    this.loading.set(true);
    this.inventoryService.getByTenant(this.tenantId).subscribe({
      next: (res) => {
        const products: InvItem[] = res.object || [];
        this.items.set(products);
        for (const p of products) {
          if (p.id != null && (p.esBebida === true || this.isBeverage(p))) {
            this.beverageProductIds.add(Number(p.id));
          }
        }
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

  loadBebidas() {
    this.loadingBebidas.set(true);
    this.inventoryService.getBebidas(this.tenantId).subscribe({
      next: (res) => {
        const bebidas = res.object || [];
        this.bebidas.set(bebidas);
        for (const b of bebidas) {
          const pid = Number(b?.productoId);
          if (Number.isFinite(pid) && pid > 0) this.beverageProductIds.add(pid);
        }
        this.loadingBebidas.set(false);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las bebidas' });
        this.loadingBebidas.set(false);
      }
    });
  }

  /* ============ Helpers de clasificación de bebidas vs platillos ============ */

  private normalizeText(str: string): string {
    return (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  isBeverageCategoryName(name: string): boolean {
    return checkBeverageCategory(name);
  }

  isBeverageProductName(name: string): boolean {
    return checkBeverageProduct(name);
  }

  isBeverage(item: any): boolean {
    if (!item) return false;
    if (item.esBebida === true) return true;
    const pid = Number(item.id || item.productoId);
    if (Number.isFinite(pid) && pid > 0 && this.beverageProductIds.has(pid)) return true;

    const cats = this.rowCategories(item);
    for (const c of cats) {
      if (this.isBeverageCategoryName(c.name)) return true;
    }
    if (item.categoryName && this.isBeverageCategoryName(item.categoryName)) return true;

    const name = item.name || item.nombre || '';
    return this.isBeverageProductName(name);
  }

  /* ============ Helpers de la tabla según modo/pestaña ============ */

  // Platillos visibles en Cocina: productos de menú que NO son bebidas ni sub-recetas
  platillos(): InvItem[] {
    return this.items().filter(
      (p) => p.id != null && !this.isBeverage(p) && p.esSubReceta !== true
    );
  }

  // Bebidas visibles en Barra: catálogo de bebidas registradas + productos del menú que son bebidas
  bebidasCatalogo(): any[] {
    const list: any[] = [...this.bebidas()];
    const seenNames = new Set(list.map((b) => this.normalizeText(b.nombre || b.name || '')));
    const seenPids = new Set(
      list.map((b) => Number(b.productoId)).filter((id) => Number.isFinite(id) && id > 0)
    );

    for (const p of this.items()) {
      if (p.id != null && this.isBeverage(p) && p.esSubReceta !== true) {
        const pid = Number(p.id);
        const pName = this.normalizeText(p.name || p.nombre || '');
        if (!seenPids.has(pid) && !seenNames.has(pName)) {
          list.push({
            id: p.id,
            productoId: p.id,
            nombre: p.name,
            name: p.name,
            unidad: p.unidad || 'pieza',
            stock: p.stock ?? 0,
            stockBarra: (p as any).stockBarra ?? p.stock ?? 0,
            stockBodega: (p as any).stockBodega ?? 0,
            stockCocina: (p as any).stockCocina ?? 0,
            stockMinimo: p.stockMinimo ?? 0,
            precioVenta: p.price ?? 0,
            categories: p.categories,
            categoryName: p.categoryName,
            insumos: (p as any).insumos,
            subRecetas: (p as any).subRecetas,
            esBebida: true,
            isMenuProduct: true
          });
          seenNames.add(pName);
        }
      }
    }
    return list;
  }

  // Filas según la pestaña activa
  tableRows(): any[] {
    switch (this.activeTab()) {
      case 'products':
        return this.mode === 'cocina' ? this.platillos() : this.bebidasCatalogo();
      case 'bebidas':
        return this.bebidasCatalogo();
      case 'insumos-bebida':
      case 'insumos':
      default:
        return this.insumos();
    }
  }

  tableLoading(): boolean {
    switch (this.activeTab()) {
      case 'products':
        return this.loading();
      case 'bebidas':
        return this.loadingBebidas();
      case 'insumos-bebida':
      case 'insumos':
      default:
        return this.loadingInsumos();
    }
  }

  tableRowsLabel(): string {
    switch (this.activeTab()) {
      case 'products':
        return 'platillos';
      case 'bebidas':
        return 'bebidas';
      case 'insumos-bebida':
        return 'insumos de bebida';
      case 'insumos':
      default:
        return 'insumos';
    }
  }

  currentPageReport(): string {
    return `Mostrando {first} a {last} de {totalRecords} ${this.tableRowsLabel()}`;
  }

  globalFilterFields(): string[] {
    return this.activeTab() === 'products' ? ['name', 'categoryName'] : ['nombre'];
  }

  emptyMessage(): string {
    switch (this.activeTab()) {
      case 'products':
        return 'No hay platillos en el inventario';
      case 'bebidas':
        return 'Sin bebidas registradas';
      case 'insumos-bebida':
        return 'Sin insumos de bebida registrados';
      case 'insumos':
      default:
        return 'Sin insumos registrados';
    }
  }

  tableColspan(): number {
    switch (this.activeTab()) {
      case 'products':
        return 4;
      case 'bebidas':
        return 5;
      default:
        return 5;
    }
  }

  /* ============ Modal de Receta de Preparación ============ */

  recipeModalVisible = false;
  selectedRecipeItem: any = null;
  recipeLines: any[] = [];
  loadingRecipeModal = false;

  openRecipeModal(item: any): void {
    if (!item) return;
    this.selectedRecipeItem = item;
    this.recipeModalVisible = true;
    this.loadingRecipeModal = true;

    // Precargar líneas si ya vienen en el item
    if (Array.isArray(item.insumos) && item.insumos.length > 0) {
      this.recipeLines = this.enrichRecipeLines(item.insumos);
    } else {
      this.recipeLines = [];
    }

    const dishId = Number(item.productoId || item.id);
    if (dishId && dishId > 0) {
      this.inventoryService.getRecipes(dishId).subscribe({
        next: (res) => {
          this.loadingRecipeModal = false;
          const lines = res.object || [];
          if (Array.isArray(lines) && lines.length > 0) {
            this.recipeLines = this.enrichRecipeLines(lines);
          } else if (Array.isArray(item.insumos) && item.insumos.length > 0) {
            this.recipeLines = this.enrichRecipeLines(item.insumos);
          }
        },
        error: () => {
          this.loadingRecipeModal = false;
          if (Array.isArray(item.insumos) && item.insumos.length > 0) {
            this.recipeLines = this.enrichRecipeLines(item.insumos);
          }
        }
      });
    } else {
      this.loadingRecipeModal = false;
    }
  }

  closeRecipeModal(): void {
    this.recipeModalVisible = false;
    this.selectedRecipeItem = null;
    this.recipeLines = [];
    this.loadingRecipeModal = false;
  }

  enrichRecipeLines(lines: any[]): any[] {
    return lines.map((r) => {
      const insumoId = Number(r.insumoId || r.id);
      const match = this.insumos().find((i) => Number(i.id) === insumoId);

      const stockCocina = match?.stockCocina ?? r.stockCocina ?? 0;
      const stockBarra = match?.stockBarra ?? r.stockBarra ?? 0;
      const stockBodega = match?.stockBodega ?? r.stockBodega ?? 0;
      const stockMinimo = match?.stockMinimo ?? r.stockMinimo ?? 0;
      const stock = match?.stock ?? r.stock ?? (stockCocina + stockBarra);

      const areaStock = this.mode === 'cocina' ? stockCocina : stockBarra;
      const required = Number(r.cantidad) || 0;
      const sufficient = required > 0 ? areaStock >= required : areaStock > 0;

      return {
        ...r,
        insumoId,
        nombre: r.insumoName || r.nombre || match?.nombre || 'Insumo',
        unidad: r.insumoUnit || r.unidad || match?.unidad || 'pieza',
        cantidad: required,
        stockCocina,
        stockBarra,
        stockBodega,
        stockMinimo,
        stock,
        areaStock,
        sufficient
      };
    });
  }

  solicitarRestockDeInsumo(r: any, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const insumoPayload = {
      id: r.insumoId || r.id,
      nombre: r.insumoName || r.nombre || r.name,
      unidad: r.insumoUnit || r.unidad || 'pieza',
      stock: r.stock ?? 0,
      stockCocina: r.stockCocina ?? 0,
      stockBarra: r.stockBarra ?? 0,
      stockBodega: r.stockBodega ?? 0,
      stockMinimo: r.stockMinimo ?? 0
    };
    this.openSolicitud(insumoPayload);
  }

  /* ============ Badges de stock (estilo products-menu) ============ */

  productBadgeClass(item: InvItem): string {
    if (item.outOfStock || item.lowStock) return 'stock-low';
    return 'stock-ok';
  }

  productBadgeLabel(item: InvItem): string {
    return `${item.stock}`;
  }

  insumoLowClass(insumo: Insumo): string {
    return this.insumoLocalStock(insumo) <= insumo.stockMinimo ? 'stock-low' : 'stock-ok';
  }

  // Stock visible según el modo de la página: solo la ubicación local (cocina o barra).
  // El restock y la distribución central se gestionan en la pestaña Bodega.
  insumoLocalStock(insumo: Insumo): number {
    const v = this.mode === 'cocina' ? insumo.stockCocina : insumo.stockBarra;
    return v ?? insumo.stock ?? 0;
  }

  /* ============ Solicitud de stock (Restock Request hacia Bodega) ============ */

  solicitudVisible = false;
  solicitudInsumo: any = null;
  solicitudCantidad = 0;
  solicitudPrioridad = 'MEDIA';
  enviandoSolicitud = false;
  prioridadOptions = [
    { label: 'Alta', value: 'ALTA' },
    { label: 'Media', value: 'MEDIA' },
    { label: 'Baja', value: 'BAJA' }
  ];

  openSolicitud(insumo: any): void {
    this.solicitudInsumo = insumo;
    this.solicitudCantidad = 0;
    this.solicitudPrioridad = 'MEDIA';
    this.solicitudVisible = true;
  }

  cerrarSolicitud(): void {
    if (!this.enviandoSolicitud) {
      this.solicitudVisible = false;
      this.solicitudInsumo = null;
    }
  }

  onSolicitudCantidadInput(value: number | null): void {
    this.solicitudCantidad = value ?? 0;
  }

  solicitudArea(): string {
    return this.mode === 'cocina' ? 'COCINA' : 'BARRA';
  }

  puedeEnviarSolicitud(): boolean {
    return !!this.solicitudInsumo && this.solicitudCantidad > 0;
  }

  enviarSolicitud(): void {
    if (!this.puedeEnviarSolicitud()) {
      this.messageService.add({ severity: 'warn', summary: 'Aviso', detail: 'Indica la cantidad a solicitar' });
      return;
    }
    const insumo = this.solicitudInsumo;
    this.enviandoSolicitud = true;
    this.stockRequestService.crear({
      tenantId: this.tenantId,
      insumoId: Number(insumo?.id) || undefined,
      insumoNombre: insumo?.nombre || insumo?.name,
      area: this.solicitudArea(),
      cantidad: this.solicitudCantidad,
      prioridad: this.solicitudPrioridad
    }).subscribe({
      next: (res) => {
        this.enviandoSolicitud = false;
        if (res.code !== 200) {
          this.messageService.add({ severity: 'warn', summary: 'Aviso', detail: res.message });
          return;
        }
        this.messageService.add({ severity: 'success', summary: 'Solicitud enviada', detail: `La bodega recibirá la solicitud de ${this.solicitudInsumo.nombre}` });
        this.solicitudVisible = false;
        this.solicitudInsumo = null;
        this.loadInsumos();
        if (this.selectedRecipeItem) {
          this.openRecipeModal(this.selectedRecipeItem);
        }
      },
      error: () => {
        this.enviandoSolicitud = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo enviar la solicitud' });
      }
    });
  }

  rowCategories(row: any): { id: number; name: string }[] {
    const cats: { id: number; name: string }[] = [];
    if (row && Array.isArray(row.categories)) {
      row.categories.forEach((c: any) => {
        if (c && c.id != null && c.name) {
          const id = Number(c.id);
          if (!Number.isNaN(id) && !cats.some((x) => x.id === id)) cats.push({ id, name: c.name });
        }
      });
    }
    if (!cats.length && row && row.categoryId != null && row.categoryName) cats.push({ id: Number(row.categoryId), name: row.categoryName });
    return cats;
  }

  /* ============ Mini-cards de categorías (máx 3 + "..." expandible) ============ */

  private expandedCatRows = new Set<string>();

  private categoryRowKey(row: any): string {
    const rawId = row?.id ?? 0;
    const id = typeof rawId === 'number' ? rawId : String(rawId);
    const name = row?.name ?? row?.nombre ?? '';
    return `${id}_${name}`;
  }

  isCategoryRowExpanded(row: any): boolean {
    return this.expandedCatRows.has(this.categoryRowKey(row));
  }

  toggleCategories(row: any): void {
    const key = this.categoryRowKey(row);
    if (this.expandedCatRows.has(key)) {
      this.expandedCatRows.delete(key);
    } else {
      this.expandedCatRows.add(key);
    }
  }

  visibleRowCategories(row: any, limit = 3): { id: number; name: string }[] {
    const all = this.rowCategories(row);
    if (all.length <= limit || this.isCategoryRowExpanded(row)) return all;
    return all.slice(0, limit);
  }

  hiddenCategoryCount(row: any): number {
    return Math.max(0, this.rowCategories(row).length - 3);
  }

  deleteInsumo(row: any) {
    if (!row || !row.id) return;
    this.confirmationService.confirm({
      message: `¿Está seguro de que desea eliminar el insumo "${row.nombre}"?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.inventoryService.deleteInsumo(row.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Insumo eliminado',
              detail: `"${row.nombre}" se eliminó correctamente`,
              life: 3000
            });
            this.loadInsumos();
            this.load();
          },
          error: (err) => {
            console.error('Error al eliminar insumo:', err);
            const msg = err?.error?.message || 'No se pudo eliminar el insumo';
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: msg,
              life: 3000
            });
          }
        });
      }
    });
  }

  deleteBebida(row: any) {
    if (!row || !row.id) return;
    this.confirmationService.confirm({
      message: `¿Está seguro de que desea eliminar la bebida "${row.nombre}"?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.inventoryService.deleteBebida(row.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Bebida eliminada',
              detail: `"${row.nombre}" se eliminó correctamente`,
              life: 3000
            });
            this.loadBebidas();
            this.load();
          },
          error: (err) => {
            console.error('Error al eliminar bebida:', err);
            const msg = err?.error?.message || 'No se pudo eliminar la bebida';
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: msg,
              life: 3000
            });
          }
        });
      }
    });
  }
}