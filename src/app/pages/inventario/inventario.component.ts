import { Component, OnInit, signal, ViewChild } from '@angular/core';
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
  stock: number;
  lowStock: boolean;
  outOfStock: boolean;
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

  // Pestaña activa de la tabla unificada: 'products' | 'insumos' | 'bebidas'
  activeTab = signal<'products' | 'insumos' | 'bebidas'>('products');

  setActiveTab(tab: 'products' | 'insumos' | 'bebidas') {
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
    private messageService: MessageService
  ) {}

  ngOnInit() {
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
        this.bebidas.set(res.object || []);
        this.loadingBebidas.set(false);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las bebidas' });
        this.loadingBebidas.set(false);
      }
    });
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