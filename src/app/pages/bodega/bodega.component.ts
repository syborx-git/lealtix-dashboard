import { Component, OnInit, signal, computed, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Table, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { SelectButtonModule } from 'primeng/selectbutton';
import { MessageService, ConfirmationService } from 'primeng/api';
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
    ConfirmDialogModule,
    InputNumberModule,
    InputTextModule,
    TooltipModule,
    SelectButtonModule,
    ToastModule,
    MessageModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './bodega.component.html',
  styleUrls: ['./bodega.component.scss']
})
export class BodegaComponent implements OnInit {
  @ViewChild('dt') dt!: Table;

  items = signal<BodegaItem[]>([]);
  loading = signal(false);
  tenantId = 0;

  /* ===== Filtro rápido: todos / alfabético / solo en stock mínimo ===== */
  filtroOpciones = [
    { label: 'Todos', value: 'todos', icon: 'pi pi-list' },
    { label: 'Orden alfabético (A–Z)', value: 'alfabetico', icon: 'pi pi-sort-alpha-down' },
    { label: 'Solo en stock mínimo', value: 'stockMinimo', icon: 'pi pi-exclamation-triangle' }
  ];
  filtroBodega: 'todos' | 'alfabetico' | 'stockMinimo' = 'todos';

  /* Lista ya filtrada/ordenada (la consume la tabla) */
  itemsFiltrados = computed<BodegaItem[]>(() => {
    const base = this.items();
    const f = this.filtroBodega;
    if (f === 'alfabetico') {
      return [...base].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
    }
    if (f === 'stockMinimo') {
      return base.filter((i) => this.enStockMinimo(i));
    }
    return base;
  });

  /* ¿Llegó (o bajó de) su stock mínimo? → requiere restock inmediato */
  enStockMinimo(item: BodegaItem): boolean {
    const min = item.stockMinimo ?? 0;
    return min > 0 && (item.stockBodega ?? 0) <= min;
  }

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
    private messageService: MessageService,
    private confirmationService: ConfirmationService
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

  /* ============ Alta de insumo en bodega ============ */

  getDefaultStockMinimo(unidad?: string | null): number {
    if (!unidad) return 10;
    const u = unidad.trim().toLowerCase();
    if (u.includes('gram') || u === 'g' || u === 'gr') return 500;
    if (u.includes('mili') || u === 'ml' || u.includes('litro') || u === 'l') return 500;
    return 10;
  }

  onCreateUnidadChange() {
    if (!this.createStockMinimo || this.createStockMinimo <= 0 || this.createStockMinimo === 10 || this.createStockMinimo === 500) {
      this.createStockMinimo = this.getDefaultStockMinimo(this.createUnidad);
    }
  }

  openCreate() {
    this.createVisible = true;
    this.createNombre = '';
    this.createUnidad = 'pieza';
    this.createCantidad = 0;
    this.createCostoTotal = 0;
    this.createStockMinimo = this.getDefaultStockMinimo('pieza');
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
    const finalStockMinimo = (this.createStockMinimo && this.createStockMinimo > 0)
      ? this.createStockMinimo
      : this.getDefaultStockMinimo(this.createUnidad);
    this.createStockMinimo = finalStockMinimo;
    this.inventoryService.createInsumoBodega(this.tenantId, this.createNombre, this.createUnidad, this.createCantidad, this.createCostoTotal, finalStockMinimo, []).subscribe({
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

  /* ============ Eliminar insumo ============ */

  deleteInsumo(item: BodegaItem) {
    this.confirmationService.confirm({
      message: `¿Está seguro de que desea eliminar el insumo "${item.nombre}"? Esta acción también lo removerá de recetas y bebidas asociadas.`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.inventoryService.deleteInsumo(item.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Insumo eliminado',
              detail: `"${item.nombre}" se eliminó correctamente`,
              life: 3000
            });
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

  /* ============ Restock Automático (1-Clic Masivo) ============ */
  autoRestockVisible = false;
  autoRestockLoading = signal(false);
  autoRestockSaving = signal(false);
  autoRestockError = signal<string | null>(null);
  autoRestockFactor = 1.5;
  autoRestockFolio = '';
  autoRestockItems = signal<any[]>([]);
  filtroAreaRestock: 'TODAS' | 'COCINA' | 'BARRA' | 'ALMACEN' = 'TODAS';

  itemsRestockFiltrados = computed(() => {
    const list = this.autoRestockItems();
    if (this.filtroAreaRestock === 'TODAS') return list;
    return list.filter(i => (i.areaDestino || '').toUpperCase() === this.filtroAreaRestock);
  });

  totalItemsSeleccionados = computed(() =>
    this.autoRestockItems().filter(i => i.selected).length
  );

  totalUnidadesSugeridas = computed(() =>
    this.autoRestockItems()
      .filter(i => i.selected)
      .reduce((acc, i) => acc + (Number(i.cantidadComprada) || 0), 0)
  );

  totalInversionEstimada = computed(() =>
    this.autoRestockItems()
      .filter(i => i.selected)
      .reduce((acc, i) => acc + (Number(i.subtotalReal) || 0), 0)
  );

  todosSeleccionados = computed(() => {
    const list = this.itemsRestockFiltrados();
    return list.length > 0 && list.every(i => i.selected);
  });

  openAutoRestock(factor: number = 1.5) {
    this.autoRestockFactor = factor;
    this.autoRestockLoading.set(true);
    this.autoRestockVisible = true;
    this.cargarSugerenciaRestock(factor);
  }

  cargarSugerenciaRestock(factor: number) {
    this.autoRestockFactor = factor;
    this.autoRestockLoading.set(true);
    this.autoRestockError.set(null);
    this.inventoryService.getRestockSugerido(this.tenantId, factor).subscribe({
      next: (res) => {
        this.autoRestockLoading.set(false);
        this.autoRestockError.set(null);
        const data = res.object || {};
        this.autoRestockFolio = data.folioSugerido || '';
        const rawItems = (data.items || []).map((it: any) => ({
          ...it,
          selected: true,
          cantidadComprada: Number(it.cantidadSugerida) || 0,
          costoUnitarioReal: Number(it.costoUnitarioEstimado) || 0,
          subtotalReal: Number(it.subtotalEstimado) || 0
        }));
        this.autoRestockItems.set(rawItems);
      },
      error: (err) => {
        this.autoRestockLoading.set(false);
        this.autoRestockItems.set([]);
        const errorMsg = err?.status === 404
          ? 'El servicio de cálculo de compras no está disponible temporalmente (404 Not Found).'
          : (err?.error?.message || 'No se pudo calcular la sugerencia de compra.');
        this.autoRestockError.set(errorMsg);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: errorMsg
        });
      }
    });
  }

  onCantidadRestockChange(item: any) {
    const cant = Number(item.cantidadComprada) || 0;
    const costoU = Number(item.costoUnitarioReal) || 0;
    item.subtotalReal = Math.round(cant * costoU * 100) / 100;
    this.autoRestockItems.set([...this.autoRestockItems()]);
  }

  onCostoUnitarioChange(item: any) {
    const cant = Number(item.cantidadComprada) || 0;
    const costoU = Number(item.costoUnitarioReal) || 0;
    item.subtotalReal = Math.round(cant * costoU * 100) / 100;
    this.autoRestockItems.set([...this.autoRestockItems()]);
  }

  toggleSelectAllRestock(checked: boolean) {
    const targetArea = this.filtroAreaRestock;
    const updated = this.autoRestockItems().map(i => {
      if (targetArea === 'TODAS' || (i.areaDestino || '').toUpperCase() === targetArea) {
        return { ...i, selected: checked };
      }
      return i;
    });
    this.autoRestockItems.set(updated);
  }

  calcularStockResultante(item: any): number {
    const act = Number(item.stockActual) || 0;
    const add = Number(item.cantidadComprada) || 0;
    return Math.round((act + add) * 1000) / 1000;
  }

  ejecutarRestockDirecto() {
    const seleccionados = this.autoRestockItems().filter(i => i.selected && Number(i.cantidadComprada) > 0);
    if (seleccionados.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Atención',
        detail: 'Selecciona al menos un insumo con cantidad mayor a 0'
      });
      return;
    }

    this.autoRestockSaving.set(true);
    const payload = {
      tenantId: this.tenantId,
      titulo: `Restock Directo 1-Clic (${seleccionados.length} insumos)`,
      items: seleccionados.map(i => ({
        insumoId: i.insumoId,
        cantidad: Number(i.cantidadComprada),
        costoTotal: Number(i.subtotalReal) || 0,
        areaDestino: i.areaDestino || 'COCINA'
      }))
    };

    this.inventoryService.restockDirecto(payload).subscribe({
      next: (res) => {
        this.autoRestockSaving.set(false);
        if (res.code === 200) {
          this.messageService.add({
            severity: 'success',
            summary: '¡Restock Exitoso!',
            detail: `Se reabastecieron ${seleccionados.length} insumos directamente en sus áreas correspondientes.`,
            life: 5000
          });
          this.autoRestockVisible = false;
          this.load();
        } else {
          this.messageService.add({ severity: 'warn', summary: 'Aviso', detail: res.message });
        }
      },
      error: (err) => {
        this.autoRestockSaving.set(false);
        const msg = err?.error?.message || 'Error al ejecutar el restock automático';
        this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
      }
    });
  }

  guardarComoOrdenCompra() {
    const seleccionados = this.autoRestockItems().filter(i => i.selected && Number(i.cantidadComprada) > 0);
    if (seleccionados.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Atención',
        detail: 'Selecciona al menos un insumo para guardar la orden'
      });
      return;
    }

    this.autoRestockSaving.set(true);
    const payload = {
      tenantId: this.tenantId,
      factor: this.autoRestockFactor,
      items: seleccionados.map(i => ({
        insumoId: i.insumoId,
        insumoNombre: i.insumoNombre,
        areaDestino: i.areaDestino,
        unidad: i.unidad,
        stockActual: i.stockActual,
        stockMinimo: i.stockMinimo,
        cantidadSugerida: Number(i.cantidadComprada),
        costoUnitarioEstimado: Number(i.costoUnitarioReal) || 0,
        subtotalEstimado: Number(i.subtotalReal) || 0
      }))
    };

    this.inventoryService.generarOrdenCompra(payload).subscribe({
      next: (res) => {
        this.autoRestockSaving.set(false);
        if (res.code === 201 || res.code === 200) {
          this.messageService.add({
            severity: 'success',
            summary: 'Lista de Compras Guardada',
            detail: `Folio generado: ${res.object?.folio || ''}`,
            life: 4000
          });
          this.autoRestockVisible = false;
          this.openListaCompras();
        } else {
          this.messageService.add({ severity: 'warn', summary: 'Aviso', detail: res.message });
        }
      },
      error: () => {
        this.autoRestockSaving.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar la orden de compra' });
      }
    });
  }

  /* ============ Módulo de Lista de Compras ============ */
  listaComprasVisible = false;
  ordenesCompra = signal<any[]>([]);
  ordenesLoading = signal(false);
  ordenSeleccionada = signal<any | null>(null);
  filtroEstadoOrden: 'TODAS' | 'PENDIENTE' | 'SURTIDA' = 'TODAS';

  ordenesFiltradas = computed(() => {
    const all = this.ordenesCompra();
    if (this.filtroEstadoOrden === 'TODAS') return all;
    return all.filter(o => (o.estado || '').toUpperCase() === this.filtroEstadoOrden);
  });

  openListaCompras() {
    this.listaComprasVisible = true;
    this.ordenSeleccionada.set(null);
    this.cargarOrdenesCompra();
  }

  cargarOrdenesCompra() {
    this.ordenesLoading.set(true);
    this.inventoryService.listarOrdenesCompra(this.tenantId).subscribe({
      next: (res) => {
        this.ordenesLoading.set(false);
        this.ordenesCompra.set(res.object || []);
      },
      error: () => {
        this.ordenesLoading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las órdenes de compra' });
      }
    });
  }

  verDetalleOrden(orden: any) {
    this.inventoryService.obtenerOrdenCompra(orden.id).subscribe({
      next: (res) => {
        this.ordenSeleccionada.set(res.object);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el detalle de la orden' });
      }
    });
  }

  surtirOrdenDesdeDetalle(orden: any) {
    if (!orden || !orden.items) return;
    this.autoRestockFolio = orden.folio;
    this.autoRestockFactor = 1.5;
    const items = (orden.items || []).map((it: any) => ({
      ...it,
      selected: !it.surtido,
      cantidadComprada: Number(it.cantidadComprada || it.cantidadSugerida) || 0,
      costoUnitarioReal: Number(it.costoUnitarioReal || it.costoUnitarioEstimado) || 0,
      subtotalReal: Number(it.subtotalReal || it.subtotalEstimado) || 0
    }));
    this.autoRestockItems.set(items);
    this.autoRestockVisible = true;
  }

  imprimirOrden(orden: any) {
    if (!orden) return;
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      this.messageService.add({ severity: 'warn', summary: 'Aviso', detail: 'Por favor habilita las ventanas emergentes para imprimir' });
      return;
    }

    const itemsHtml = (orden.items || []).map((it: any, idx: number) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${idx + 1}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>${it.insumoNombre}</strong></td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${it.areaDestino || 'COCINA'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;"><strong>${it.cantidadSugerida} ${it.unidad || 'pz'}</strong></td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${Number(it.costoUnitarioEstimado || 0).toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${Number(it.subtotalEstimado || 0).toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center; border: 1px dashed #999;">[ &nbsp; ]</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Lista de Compras - ${orden.folio}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 30px; color: #1e293b; }
          .header { border-bottom: 2px solid #6366f1; padding-bottom: 15px; margin-bottom: 20px; }
          .title { font-size: 24px; font-weight: bold; color: #4338ca; }
          .meta { margin-top: 5px; color: #64748b; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
          th { background: #f1f5f9; padding: 10px 8px; text-align: left; font-weight: 600; border-bottom: 2px solid #cbd5e1; }
          .total-box { margin-top: 20px; text-align: right; font-size: 16px; font-weight: bold; }
          @media print {
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">🛒 LEALTIX - LISTA DE COMPRAS Y RESTOCK</div>
          <div class="meta">Folio: <strong>${orden.folio}</strong> | Fecha: ${new Date(orden.createdAt).toLocaleString()} | Estado: ${orden.estado}</div>
          <div class="meta">Destino directo: Insumos separados por área de Cocina y Barra</div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 30px; text-align: center;">#</th>
              <th>Insumo / Descripción</th>
              <th style="text-align: center;">Área Destino</th>
              <th style="text-align: right;">Cant. a Comprar</th>
              <th style="text-align: right;">Costo Unit. Est.</th>
              <th style="text-align: right;">Subtotal</th>
              <th style="width: 60px; text-align: center;">Check</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div class="total-box">
          Presupuesto Estimado Total: $${Number(orden.totalEstimado || 0).toFixed(2)} MXN
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }



  /* ============ Distribuir Áreas desde Bodega (1-Clic) ============ */
  distribuirVisible = false;
  distribuirLoading = signal(false);
  distribuirSaving = signal(false);
  distribuirError = signal<string | null>(null);
  distribuirFactor = 1.5;
  distribuirItems = signal<any[]>([]);
  filtroAreaDistribucion: 'TODAS' | 'COCINA' | 'BARRA' = 'TODAS';

  itemsDistribucionFiltrados = computed(() => {
    const list = this.distribuirItems();
    if (this.filtroAreaDistribucion === 'TODAS') return list;
    return list.filter(i => (i.areaDestino || '').toUpperCase() === this.filtroAreaDistribucion);
  });

  totalInsumosADistribuir = computed(() =>
    this.distribuirItems().filter(i => i.selected && Number(i.cantidadATransferir) > 0).length
  );

  totalUnidadesADistribuir = computed(() =>
    this.distribuirItems()
      .filter(i => i.selected)
      .reduce((acc, i) => acc + (Number(i.cantidadATransferir) || 0), 0)
  );

  distribucionTodosSeleccionados = computed(() => {
    const list = this.itemsDistribucionFiltrados();
    return list.length > 0 && list.every(i => i.selected);
  });

  distribucionConBodegaDisponible = computed(() =>
    this.distribuirItems().filter(i => (Number(i.stockBodega) || 0) > 0).length
  );

  openDistribuir(factor: number = 1.5) {
    this.distribuirFactor = factor;
    this.distribuirVisible = true;
    this.cargarDistribucionSugerida(factor);
  }

  cargarDistribucionSugerida(factor: number) {
    this.distribuirFactor = factor;
    this.distribuirLoading.set(true);
    this.distribuirError.set(null);
    this.inventoryService.getDistribucionSugerida(this.tenantId, factor).subscribe({
      next: (res) => {
        this.distribuirLoading.set(false);
        this.distribuirError.set(null);
        const data = res.object || {};
        const list = Array.isArray(data) ? data : (data.items || []);
        const rawItems = list.map((it: any) => ({
          ...it,
          selected: (Number(it.cantidadSugerida) > 0 && Number(it.stockBodega) > 0),
          cantidadATransferir: Number(it.cantidadSugerida) || 0
        }));
        this.distribuirItems.set(rawItems);
      },
      error: (err) => {
        this.distribuirLoading.set(false);
        this.distribuirItems.set([]);
        const errorMsg = err?.status === 404
          ? 'El servicio de distribución no está disponible temporalmente (404 Not Found).'
          : (err?.error?.message || 'No se pudo calcular la sugerencia de distribución a áreas.');
        this.distribuirError.set(errorMsg);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: errorMsg
        });
      }
    });
  }

  onCantidadDistribucionChange(item: any) {
    const max = Number(item.stockBodega) || 0;
    if (item.cantidadATransferir < 0) {
      item.cantidadATransferir = 0;
    }
    if (item.cantidadATransferir > max) {
      item.cantidadATransferir = max;
    }
    this.distribuirItems.set([...this.distribuirItems()]);
  }

  toggleSelectAllDistribucion(checked: boolean) {
    const targetArea = this.filtroAreaDistribucion;
    const updated = this.distribuirItems().map(i => {
      if (targetArea === 'TODAS' || (i.areaDestino || '').toUpperCase() === targetArea) {
        if (Number(i.stockBodega) > 0 || !checked) {
          return { ...i, selected: checked };
        }
      }
      return i;
    });
    this.distribuirItems.set(updated);
  }

  calcularStockAreaResultante(item: any): number {
    const act = Number(item.stockAreaActual) || 0;
    const add = Number(item.cantidadATransferir) || 0;
    return Math.round((act + add) * 1000) / 1000;
  }

  calcularStockBodegaRemanente(item: any): number {
    const bodega = Number(item.stockBodega) || 0;
    const add = Number(item.cantidadATransferir) || 0;
    return Math.max(0, Math.round((bodega - add) * 1000) / 1000);
  }

  ejecutarDistribucionBatch() {
    const seleccionados = this.distribuirItems().filter(
      i => i.selected && Number(i.cantidadATransferir) > 0
    );
    if (seleccionados.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Atención',
        detail: 'Selecciona al menos un insumo con cantidad mayor a 0 y existencia en bodega'
      });
      return;
    }

    this.distribuirSaving.set(true);
    const payload = {
      tenantId: this.tenantId,
      items: seleccionados.map(i => ({
        insumoId: i.insumoId,
        cantidad: Number(i.cantidadATransferir),
        destino: (i.areaDestino || 'cocina').toLowerCase()
      }))
    };

    this.inventoryService.distribuirBatch(payload).subscribe({
      next: (res) => {
        this.distribuirSaving.set(false);
        if (res.code === 200) {
          this.messageService.add({
            severity: 'success',
            summary: '¡Distribución Exitosa!',
            detail: `Se transfirieron existencias a ${seleccionados.length} insumos en Cocina y Barra.`,
            life: 5000
          });
          this.distribuirVisible = false;
          this.load();
          this.loadPendientes();
        } else {
          this.messageService.add({ severity: 'warn', summary: 'Aviso', detail: res.message });
        }
      },
      error: (err) => {
        this.distribuirSaving.set(false);
        const msg = err?.error?.message || 'Error al ejecutar la distribución a áreas';
        this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
      }
    });
  }
}