import { Component, computed, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Table, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { MessageModule } from 'primeng/message';
import { InventoryService } from '../inventario/service/inventory.service';
import { StockRequestService } from '../inventario/service/stock-request.service';
import { AuthService } from '@/auth/auth.service';

interface BodegaItem {
  id: number;
  nombre: string;
  unidad: string;
  stock: number;
  stockBodega: number;
  stockCocina: number;
  stockBarra: number;
  stockMinimo: number;
  esBebida: boolean;
}

@Component({
  selector: 'app-bodega',
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
    SelectButtonModule,
    SelectModule,
    ToastModule,
    MessageModule
  ],
  providers: [MessageService],
  templateUrl: './bodega.component.html',
  styleUrls: ['./bodega.component.scss']
})
export class BodegaComponent implements OnInit {
  @ViewChild('dt') dt!: Table;

  items = signal<BodegaItem[]>([]);
  catalogFilter = signal<'all' | 'alphabetical' | 'minimum'>('all');
  catalogFilterOptions = [
    { label: 'Todos los insumos', value: 'all' },
    { label: 'Orden alfabético', value: 'alphabetical' },
    { label: 'En stock mínimo', value: 'minimum' }
  ];
  filteredItems = computed(() => {
    const items = [...this.items()];

    if (this.catalogFilter() === 'minimum') {
      return items.filter((item) => this.isAtMinimum(item));
    }

    if (this.catalogFilter() === 'alphabetical') {
      return items.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
    }

    return items;
  });
  loading = signal(false);
  tenantId = 0;

  // Alta de insumo en bodega
  createVisible = false;
  createNombre = '';
  createUnidad = 'pieza';
  createCantidad = 0;
  createCostoTotal = 0;
  createStockMinimo = 0;

  // Restock en bodega
  restockVisible = false;
  restockTarget: BodegaItem | null = null;
  restockCantidad = 0;
  restockCostoTotal = 0;

  // Mover de bodega a cocina/barra
  moveVisible = false;
  moveTarget: BodegaItem | null = null;
  moveDestino: 'cocina' | 'barra' = 'cocina';
  moveCantidad = 0;
  destinoOptions = [
    { label: 'Cocina', value: 'cocina', icon: 'pi pi-box' },
    { label: 'Barra', value: 'barra', icon: 'pi pi-glass' }
  ];

  constructor(
    private inventoryService: InventoryService,
    private stockRequestService: StockRequestService,
    private authService: AuthService,
    private messageService: MessageService
  ) {}

  ngOnInit() {
    const user = this.authService.getCurrentUser();
    this.tenantId = user?.tenantId || 0;
    if (this.tenantId) {
      this.load();
      this.loadPendientes();
    }
  }

  pendientesCocina = signal(0);
  pendientesBarra = signal(0);

  loadPendientes() {
    this.stockRequestService.contarPendientes(this.tenantId).subscribe({
      next: (res) => {
        const c = res.object || {};
        this.pendientesCocina.set(Number(c.cocina) || 0);
        this.pendientesBarra.set(Number(c.barra) || 0);
      },
      error: () => {
        this.pendientesCocina.set(0);
        this.pendientesBarra.set(0);
      }
    });
  }

  /* ============ Modal de solicitudes de stock (Cocina/Barra) ============ */

  solicitudesVisible = false;
  solicitudesArea: 'COCINA' | 'BARRA' = 'COCINA';
  solicitudes = signal<any[]>([]);
  solicitudesLoading = signal(false);
  aceptandoId: number | null = null;

  openSolicitudes(area: 'COCINA' | 'BARRA') {
    this.solicitudesArea = area;
    this.solicitudes.set([]);
    this.solicitudesVisible = true;
    this.loadSolicitudes();
  }

  cerrarSolicitudes() {
    if (this.aceptandoId === null) {
      this.solicitudesVisible = false;
    }
  }

  loadSolicitudes() {
    this.solicitudesLoading.set(true);
    this.stockRequestService.listarPendientes(this.tenantId, this.solicitudesArea).subscribe({
      next: (res) => {
        this.solicitudes.set(res.object || []);
        this.solicitudesLoading.set(false);
      },
      error: () => {
        this.solicitudes.set([]);
        this.solicitudesLoading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las solicitudes' });
      }
    });
  }

  solicitudesTitulo(): string {
    return this.solicitudesArea === 'COCINA' ? 'Solicitudes de Cocina' : 'Solicitudes de Barra';
  }

  solicitudesSubtitulo(): string {
    return `Insumos solicitados pendientes de surtir · ${this.solicitudesArea.toLowerCase()}`;
  }

  prioridadLabel(p: string): string {
    switch (p) {
      case 'ALTA': return 'Alta';
      case 'BAJA': return 'Baja';
      default: return 'Media';
    }
  }

  prioridadClass(p: string): string {
    return p === 'ALTA' ? 'prio-alta' : p === 'BAJA' ? 'prio-baja' : 'prio-media';
  }

  aceptarSolicitud(req: any) {
    if (this.aceptandoId !== null) return;
    this.aceptandoId = req.id;
    this.stockRequestService.aceptar(req.id, this.tenantId).subscribe({
      next: (res) => {
        this.aceptandoId = null;
        if (res.code !== 200) {
          this.messageService.add({ severity: 'warn', summary: 'Aviso', detail: res.message });
          this.loadSolicitudes();
          return;
        }
        this.messageService.add({ severity: 'success', summary: 'Transferencia completada', detail: res.message });
        this.loadSolicitudes();
        this.load();
        this.loadPendientes();
      },
      error: () => {
        this.aceptandoId = null;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo completar la transferencia' });
      }
    });
  }

  load() {
    this.loading.set(true);
    this.inventoryService.getBodega(this.tenantId).subscribe({
      next: (res) => {
        const all = (res.object || []) as BodegaItem[];
        this.items.set(all.filter((i) => !i.esBebida));
        this.loading.set(false);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la bodega' });
        this.loading.set(false);
      }
    });
  }

  onGlobalFilter(table: Table, event: Event) {
    table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
  }

  distribuido(item: BodegaItem): number {
    return (item.stockCocina ?? 0) + (item.stockBarra ?? 0);
  }

  isAtMinimum(item: BodegaItem): boolean {
    return (item.stockBodega ?? 0) < (item.stockMinimo ?? 0);
  }

  /* ============ Alta de insumo en bodega ============ */

  openCreate() {
    this.createVisible = true;
    this.createNombre = '';
    this.createUnidad = 'pieza';
    this.createCantidad = 0;
    this.createCostoTotal = 0;
    this.createStockMinimo = 0;
  }

  doCreate() {
    if (!this.createNombre.trim()) {
      this.messageService.add({ severity: 'warn', summary: 'Aviso', detail: 'Escribe el nombre del insumo' });
      return;
    }
    if (this.createCantidad > 0 && this.createCostoTotal <= 0) {
      this.messageService.add({ severity: 'warn', summary: 'Aviso', detail: 'Indica el costo de la carga (obligatorio)' });
      return;
    }
    this.inventoryService.createInsumoBodega(this.tenantId, this.createNombre, this.createUnidad, this.createCantidad, this.createCostoTotal, this.createStockMinimo, []).subscribe({
      next: (res) => {
        if (res.code !== 200) {
          this.messageService.add({ severity: 'warn', summary: 'Aviso', detail: res.message });
          return;
        }
        this.messageService.add({ severity: 'success', summary: 'Insumo registrado', detail: 'Se registró en bodega' });
        this.createVisible = false;
        this.load();
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo registrar el insumo' })
    });
  }

  /* ============ Restock en bodega ============ */

  openRestock(item: BodegaItem) {
    this.restockTarget = item;
    this.restockCantidad = 0;
    this.restockCostoTotal = 0;
    this.restockVisible = true;
  }

  doRestock() {
    if (!this.restockTarget || this.restockCantidad <= 0) return;
    if (this.restockCostoTotal <= 0) {
      this.messageService.add({ severity: 'warn', summary: 'Aviso', detail: 'El costo de la carga es obligatorio' });
      return;
    }
    this.inventoryService.restockBodega(this.restockTarget.id, this.restockCantidad, this.restockCostoTotal).subscribe({
      next: (res) => {
        if (res.code !== 200) {
          this.messageService.add({ severity: 'warn', summary: 'Aviso', detail: res.message });
          return;
        }
        this.messageService.add({ severity: 'success', summary: 'Entrada a bodega', detail: 'Entrada registrada' });
        this.restockVisible = false;
        this.load();
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo registrar el restock' })
    });
  }

  /* ============ Distribuir de bodega a cocina/barra ============ */

  openMove(item: BodegaItem) {
    this.moveTarget = item;
    this.moveCantidad = 0;
    this.moveDestino = item.esBebida ? 'barra' : 'cocina';
    this.moveVisible = true;
  }

  moverMaximo() {
    this.moveCantidad = this.moveTarget?.stockBodega ?? 0;
  }

  doMove() {
    if (!this.moveTarget || this.moveCantidad <= 0) return;
    if (this.moveCantidad > (this.moveTarget.stockBodega ?? 0)) {
      this.messageService.add({ severity: 'warn', summary: 'Aviso', detail: 'La cantidad no puede ser mayor al stock en bodega' });
      return;
    }
    this.inventoryService.moverBodega(this.moveTarget.id, this.moveCantidad, this.moveDestino).subscribe({
      next: (res) => {
        if (res.code !== 200) {
          this.messageService.add({ severity: 'warn', summary: 'Aviso', detail: res.message });
          return;
        }
        this.messageService.add({
          severity: 'success',
          summary: 'Stock movido',
          detail: `${this.moveCantidad} ${this.moveTarget?.unidad || ''} a ${this.moveDestino === 'cocina' ? 'cocina' : 'barra'}`
        });
        this.moveVisible = false;
        this.load();
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo mover el stock' })
    });
  }
}