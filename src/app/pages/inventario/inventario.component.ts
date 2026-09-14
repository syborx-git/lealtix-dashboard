import { Component, OnInit, signal, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Table, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { MessageModule } from 'primeng/message';
import { InventoryService } from './service/inventory.service';
import { AuthService } from '@/auth/auth.service';

interface InvItem {
  id: number;
  name: string;
  categoryName?: string;
  categories?: { id: number; name: string }[];
  stock: number;
  lowStock: boolean;
  outOfStock: boolean;
  esSubReceta?: boolean;
}

interface Insumo {
  id: number;
  nombre: string;
  unidad: string;
  stock: number;
  stockMinimo: number;
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
    InputNumberModule,
    InputTextModule,
    TooltipModule,
    IconFieldModule,
    InputIconModule,
    ToastModule,
    MessageModule
  ],
  providers: [MessageService],
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

  insumoRestockVisible = false;
  insumoRestockTarget: Insumo | null = null;
  insumoRestockCantidad = 0;
  insumoRestockCostoTotal = 0;

  constructor(
    private inventoryService: InventoryService,
    private authService: AuthService,
    private messageService: MessageService,
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

  loadBebidas() {
    this.loadingBebidas.set(true);
    this.inventoryService.getBebidas(this.tenantId).subscribe({
      next: (res) => {
        const bebidas = res.object || [];
        this.bebidas.set(bebidas);
        this.beverageProductIds = new Set<number>();
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

  /* ============ Helpers de la tabla según modo/pestaña ============ */

  // Platillos visibles en Cocina: productos de menú que no son bebidas ni sub-recetas
  platillos(): InvItem[] {
    return this.items().filter(
      (p) => p.id != null && !this.beverageProductIds.has(Number(p.id)) && p.esSubReceta !== true
    );
  }

  // Filas según la pestaña activa: bebidas también alimentan la pestaña "Insumos de bebida"
  tableRows(): any[] {
    switch (this.activeTab()) {
      case 'products':
        return this.platillos();
      case 'bebidas':
        return this.bebidas();
      case 'insumos-bebida':
        return this.bebidas();
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
      case 'insumos-bebida':
        return this.loadingBebidas();
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
    return this.activeTab() === 'products' ? 3 : 4;
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
    return insumo.stock <= insumo.stockMinimo ? 'stock-low' : 'stock-ok';
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

  /* ============ Restock de insumo ============ */

  openInsumoRestock(insumo: Insumo) {
    this.insumoRestockTarget = insumo;
    this.insumoRestockCantidad = 0;
    this.insumoRestockCostoTotal = 0;
    this.insumoRestockVisible = true;
  }

  doInsumoRestock() {
    if (!this.insumoRestockTarget || this.insumoRestockCantidad <= 0) return;
    this.inventoryService.restockInsumo(this.insumoRestockTarget.id, this.insumoRestockCantidad, this.insumoRestockCostoTotal).subscribe({
      next: (res) => {
        this.messageService.add({ severity: 'success', summary: 'Exitoso', detail: `Stock del insumo: ${res.object}` });
        this.insumoRestockVisible = false;
        this.loadInsumos();
        this.loadBebidas();
        this.load();
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo reabastecer' })
    });
  }
}