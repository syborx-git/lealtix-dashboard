import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ToastModule } from 'primeng/toast';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectModule } from 'primeng/select';
import { DividerModule } from 'primeng/divider';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';

import { AuthService } from '@/auth/auth.service';
import { MermaRecord, MermaService, TIPOS_MERMA } from '@/pages/comandix/services/merma.service';
import { OrderService } from '@/pages/comandix/services/order.service';
import { PendingOrder } from '@/pages/comandix/models/order.model';
import { InventoryService } from '@/pages/inventario/service/inventory.service';

@Component({
  selector: 'app-mermas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    TagModule,
    ProgressSpinnerModule,
    ToastModule,
    IconFieldModule,
    InputIconModule,
    CheckboxModule,
    SelectModule,
    DividerModule,
    DialogModule
  ],
  templateUrl: './mermas.component.html',
  styleUrls: ['./mermas.component.scss'],
  providers: [MessageService]
})
export class MermasComponent implements OnInit {
  loading = signal<boolean>(false);
  tenantId = 1;
  records = signal<MermaRecord[]>([]);
  filteredRecords = signal<MermaRecord[]>([]);
  globalFilter = '';

  readonly tiposMerma = TIPOS_MERMA;
  tipoMermaSeleccionado = 'OPERATIVA';

  activeOrders = signal<PendingOrder[]>([]);
  loadingOrders = signal<boolean>(false);
  mermaDialogVisible = false;
  mermaOrderId = signal<string | null>(null);
  orderIngredients = signal<any[]>([]);
  loadingIngredients = signal<boolean>(false);
  busquedaComanda = signal<string>('');
  seleccionados: Record<number, boolean> = {};
  cantidades: Record<number, number> = {};
  registeringMerma = signal<boolean>(false);

  // ===== Merma administrativa (transfer list de dos columnas) =====
  adminVisible = false;
  adminInsumos = signal<any[]>([]);
  adminBusqueda = signal<string>('');
  adminFiltrados = signal<any[]>([]);
  adminLoading = signal<boolean>(false);
  adminSeleccionados = signal<{ insumo: any; cantidad: number }[]>([]);
  adminMotivo: string | null = null;
  adminMotivoCustom = '';
  adminOrigen = 'BODEGA';
  adminTipo = 'OPERATIVA';
  registeringAdmin = signal<boolean>(false);

  constructor(
    private mermaService: MermaService,
    private authService: AuthService,
    private messageService: MessageService,
    private orderService: OrderService,
    private inventoryService: InventoryService
  ) {}

  ngOnInit(): void {
    this.tenantId = this.authService.getTenantId() || 1;
    this.loadMermas();
    this.loadActiveOrders();
  }

  loadMermas(): void {
    this.loading.set(true);
    this.mermaService.listarPorTenant(this.tenantId).subscribe({
      next: (res) => {
        this.records.set(res?.object ?? []);
        this.applyFilter();
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error cargando mermas:', err);
        this.records.set([]);
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message || 'No se pudieron cargar las mermas',
          life: 4000
        });
      }
    });
  }

  loadActiveOrders(): void {
    this.loadingOrders.set(true);
    const size = 50;
    const loadOne = (status: string) =>
      this.orderService.getOrdersByTenant(this.tenantId, status, 0, size);

    const orders: PendingOrder[] = [];
    let completed = 0;

    const done = () => {
      completed++;
      if (completed === 2) {
        this.activeOrders.set(orders);
        this.loadingOrders.set(false);
      }
    };

    loadOne('EN_PREPARACION').subscribe({
      next: (res) => { orders.push(...(res?.object?.content ?? [])); done(); },
      error: () => done()
    });

    loadOne('LISTO').subscribe({
      next: (res) => { orders.push(...(res?.object?.content ?? [])); done(); },
      error: () => done()
    });
  }

  getTicket(orderId?: string): string {
    return orderId ? '#' + orderId.slice(0, 8).toUpperCase() : '—';
  }

  getCustomerName(order: PendingOrder): string {
    return (order as any).customerName ?? order.nombre ?? 'Cliente General';
  }

  getOrderItemsCount(order: PendingOrder): number {
    return (order.items ?? []).length;
  }

  trackByOrderId(_index: number, order: PendingOrder): string {
    return order.id;
  }

  openMermaModal(order: PendingOrder): void {
    this.mermaOrderId.set(order.id);
    this.mermaDialogVisible = true;
    this.busquedaComanda.set('');
    this.loadingIngredients.set(true);
    this.seleccionados = {};
    this.cantidades = {};

    this.mermaService.resolverInsumosUsados(order.id).subscribe({
      next: (res) => {
        const insumos = res?.object ?? [];
        insumos.forEach((insumo: any, i: number) => {
          this.seleccionados[i] = false;
          this.cantidades[i] = insumo.cantidad ?? 0;
        });
        this.orderIngredients.set(insumos);
        this.loadingIngredients.set(false);
      },
      error: (err) => {
        console.error('Error cargando insumos:', err);
        this.orderIngredients.set([]);
        this.loadingIngredients.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message || 'No se pudieron cargar los insumos',
          life: 4000
        });
      }
    });
  }

  closeMermaModal(): void {
    this.mermaDialogVisible = false;
    this.mermaOrderId.set(null);
    this.orderIngredients.set([]);
    this.busquedaComanda.set('');
    this.seleccionados = {};
    this.cantidades = {};
  }

  getIngredientesFiltrados(): { i: number; insumo: any }[] {
    const term = this.busquedaComanda().trim().toLowerCase();
    const all = this.orderIngredients();
    const filtered = !term
      ? all
      : all.filter((insumo) =>
          (insumo.insumoNombre ?? insumo.productoNombre ?? '')
            .toLowerCase()
            .includes(term)
        );
    return filtered.map((insumo, idx) => {
      const original = term ? all.indexOf(insumo) : idx;
      return { i: original, insumo };
    });
  }

  isNewOrder(order: PendingOrder): boolean {
    if (!order.fechaCreacion) return false;
    const diffMs = Date.now() - new Date(order.fechaCreacion).getTime();
    return diffMs < 2 * 60 * 1000;
  }

  getStatusClass(estado: string | undefined): string {
    const normalized = (estado ?? '').toUpperCase();
    if (normalized === 'PENDIENTE') return 'status-comanda';
    if (normalized === 'CONFIRMADA') return 'status-confirmada';
    if (normalized === 'EN_PREPARACION' || normalized === 'IN_PROGRESS') return 'status-en_preparacion';
    if (normalized === 'LISTO' || normalized === 'READY') return 'status-listo';
    if (normalized === 'PAGADA' || normalized === 'PAID') return 'status-pagada';
    if (normalized === 'CANCELADA' || normalized === 'CANCELLED') return 'status-cancelada';
    return 'status-comanda';
  }

  getEstadoLabel(estado?: string): string {
    switch (estado?.toUpperCase()) {
      case 'PENDIENTE': return 'PENDIENTE';
      case 'CONFIRMADA': return 'CONFIRMADA';
      case 'EN_PREPARACION':
      case 'IN_PROGRESS': return 'EN PREPARACIÓN';
      case 'LISTO':
      case 'READY': return 'LISTO';
      case 'PAGADA':
      case 'PAID': return 'PAGADA';
      case 'CANCELADA':
      case 'CANCELLED': return 'CANCELADA';
      default: return estado ?? '—';
    }
  }

  getSeleccionTotal(): number {
    return this.orderIngredients().filter((_, i) => this.seleccionados[i]).length;
  }

  getPerdidaTotal(): number {
    let total = 0;
    for (const [indexStr, checked] of Object.entries(this.seleccionados)) {
      if (!checked) continue;
      const index = Number(indexStr);
      const insumo = this.orderIngredients()[index];
      if (!insumo) continue;
      const cantidad = this.cantidades[index] ?? insumo.cantidad ?? 0;
      total += cantidad * (insumo.costoUnitario ?? 0);
    }
    return total;
  }

  onCantidadInput(index: number, event: Event): void {
    this.seleccionados[index] = true;
    this.cantidades[index] = Number((event.target as HTMLInputElement).value);
  }

  onInsumoCheck(index: number, checked: boolean): void {
    this.seleccionados[index] = checked;
  }

  getInsumoName(insumo: any): string {
    return insumo.insumoNombre ?? insumo.productoNombre ?? 'Producto';
  }

  registerMerma(): void {
    const currentId = this.mermaOrderId();
    if (!currentId || this.registeringMerma()) return;

    const items: any[] = [];
    for (const [indexStr, checked] of Object.entries(this.seleccionados)) {
      if (!checked) continue;
      const index = Number(indexStr);
      const insumo = this.orderIngredients()[index];
      if (!insumo) continue;
      const cantidad = this.cantidades[index] ?? 0;
      if (cantidad <= 0) continue;
      items.push({
        insumoId: insumo.insumoId ?? null,
        insumoNombre: insumo.insumoNombre ?? null,
        productoId: insumo.productoId ?? null,
        productoNombre: insumo.productoNombre ?? null,
        cantidad,
        unidad: insumo.unidad ?? 'pieza'
      });
    }

    if (items.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sin selección',
        detail: 'Selecciona al menos un insumo con cantidad mayor a 0',
        life: 3000
      });
      return;
    }

    this.registeringMerma.set(true);
    const user = this.authService.getCurrentUser();
    this.mermaService.registrarMerma({
      tenantId: this.tenantId,
      orderId: currentId,
      tipoMerma: this.tipoMermaSeleccionado,
      usuarioId: user?.id,
      usuarioNombre: user?.nombre,
      items
    }).subscribe({
      next: (res) => {
        if (res?.code !== 200) {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: res?.message || 'No se pudo registrar la merma',
            life: 4000
          });
          return;
        }
        const ticket = this.getTicket(currentId);
        this.messageService.add({
          severity: 'success',
          summary: 'Merma registrada',
          detail: `${items.length} registro(s) de merma salvados para ${ticket}`,
          life: 4000
        });
        this.closeMermaModal();
        this.loadMermas();
        this.registeringMerma.set(false);
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message || 'No se pudo registrar la merma',
          life: 4000
        });
        this.registeringMerma.set(false);
      }
    });
  }

  /* ==================== Merma administrativa ==================== */

  openAdminModal(): void {
    this.adminVisible = true;
    this.adminBusqueda.set('');
    this.adminSeleccionados.set([]);
    this.adminMotivo = null;
    this.adminMotivoCustom = '';
    this.adminOrigen = 'BODEGA';

    if (this.adminInsumos().length === 0) {
      this.loadAdminInsumos();
    } else {
      this.filterAdminInsumos();
    }
  }

  loadAdminInsumos(): void {
    this.adminLoading.set(true);
    this.inventoryService.getBodega(this.tenantId).subscribe({
      next: (res) => {
        this.adminInsumos.set(res?.object ?? []);
        this.filterAdminInsumos();
        this.adminLoading.set(false);
      },
      error: () => {
        this.adminInsumos.set([]);
        this.adminLoading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los insumos', life: 4000 });
      }
    });
  }

  onBusquedaInput(event: Event): void {
    this.busquedaComanda.set((event.target as HTMLInputElement).value ?? '');
  }

  onAdminBusquedaInput(event: Event): void {
    this.adminBusqueda.set((event.target as HTMLInputElement).value ?? '');
    this.filterAdminInsumos();
  }

  filterAdminInsumos(): void {
    const term = this.adminBusqueda().trim().toLowerCase();
    const all = this.adminInsumos();
    if (!term) {
      this.adminFiltrados.set(all);
      return;
    }
    this.adminFiltrados.set(
      all.filter((i) => (i.nombre ?? '').toLowerCase().includes(term) || (i.unidad ?? '').toLowerCase().includes(term))
    );
  }

  adminStockEn(insumo: any, origen: string): number {
    switch (origen) {
      case 'COCINA': return insumo.stockCocina ?? 0;
      case 'BARRA': return insumo.stockBarra ?? 0;
      default: return insumo.stockBodega ?? 0;
    }
  }

  adminLabelOrigen(origen: string): string {
    switch (origen) {
      case 'COCINA': return 'Cocina';
      case 'BARRA': return 'Barra';
      default: return 'Bodega';
    }
  }

  adminDisponibles(): any[] {
    const selected = this.adminSeleccionados();
    return this.adminFiltrados().filter(
      (i) => !selected.some((s) => s.insumo.id === i.id)
    );
  }

  adminDisponibleDe(insumo: any): number {
    return this.adminStockEn(insumo, this.adminOrigen);
  }

  moverADerecha(insumo: any): void {
    if (this.adminSeleccionados().some((s) => s.insumo.id === insumo.id)) return;
    this.adminSeleccionados.update((prev) => [...prev, { insumo, cantidad: 0 }]);
  }

  moverAIzquierda(index: number): void {
    this.adminSeleccionados.update((prev) => prev.filter((_, i) => i !== index));
  }

  onCantidadAdminInput(index: number, event: Event): void {
    const cantidad = Number((event.target as HTMLInputElement).value);
    this.adminSeleccionados.update((prev) =>
      prev.map((s, i) => (i === index ? { ...s, cantidad } : s))
    );
  }

  onMotivoCustomInput(event: Event): void {
    this.adminMotivoCustom = (event.target as HTMLInputElement).value ?? '';
  }

  adminMotivoFinal(): string {
    return this.adminMotivo === 'OTRO'
      ? this.adminMotivoCustom.trim()
      : (this.adminMotivo ?? '').trim();
  }

  adminPuedeRegistrar(): boolean {
    const items = this.adminSeleccionados();
    return (
      items.length > 0 &&
      items.every((s) => s.cantidad > 0) &&
      !!this.adminMotivo &&
      !!this.adminMotivoFinal()
    );
  }

  closeAdminModal(): void {
    this.adminVisible = false;
    this.adminSeleccionados.set([]);
    this.adminBusqueda.set('');
    this.adminMotivo = null;
    this.adminMotivoCustom = '';
  }

  registroAdmin(): void {
    if (!this.adminPuedeRegistrar() || this.registeringAdmin()) return;

    const items = this.adminSeleccionados();
    for (const { insumo, cantidad } of items) {
      const disp = this.adminDisponibleDe(insumo);
      if (cantidad > disp) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Stock insuficiente',
          detail: `Solo hay ${disp} ${insumo.unidad || 'pieza'} de ${insumo.nombre} en ${this.adminLabelOrigen(this.adminOrigen)}`,
          life: 4000
        });
        return;
      }
    }

    const user = this.authService.getCurrentUser();
    const motivoFinal = this.adminMotivoFinal();
    this.registeringAdmin.set(true);
    this.mermaService.registrarMermaAdministrativa({
      tenantId: this.tenantId,
      origen: this.adminOrigen,
      motivo: motivoFinal,
      tipoMerma: this.adminTipo,
      usuarioId: user?.id,
      usuarioNombre: user?.nombre,
      items: items.map(({ insumo, cantidad }) => ({
        insumoId: insumo.id,
        insumoNombre: insumo.nombre,
        cantidad,
        unidad: insumo.unidad || 'pieza'
      }))
    }).subscribe({
      next: (res) => {
        if (res?.code !== 200) {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: res?.message || 'No se pudo registrar la merma administrativa', life: 4000 });
          this.registeringAdmin.set(false);
          return;
        }
        this.messageService.add({
          severity: 'success',
          summary: 'Merma administrativa registrada',
          detail: `${items.length} insumo(s) mermado(s) en ${this.adminLabelOrigen(this.adminOrigen)} (${motivoFinal})`,
          life: 4000
        });
        this.closeAdminModal();
        this.loadMermas();
        this.registeringAdmin.set(false);
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo registrar la merma administrativa', life: 4000 });
        this.registeringAdmin.set(false);
      }
    });
  }

  onGlobalFilter(event: Event): void {
    this.globalFilter = (event.target as HTMLInputElement).value ?? '';
    this.applyFilter();
  }

  private applyFilter(): void {
    const term = this.globalFilter.trim().toLowerCase();
    const all = this.records();
    if (!term) {
      this.filteredRecords.set(all);
      return;
    }
    this.filteredRecords.set(
      all.filter((r) => {
        const ticket = String(r.ticket ?? '').toLowerCase();
        const insumo = (r.insumoNombre ?? '').toLowerCase();
        const producto = (r.productoNombre ?? '').toLowerCase();
        return ticket.includes(term) || insumo.includes(term) || producto.includes(term);
      })
    );
  }

  getTotalPerdida(): number {
    return this.records().reduce((sum, r) => sum + (r.costoTotal ?? 0), 0);
  }

  getTipoColor(tipo?: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
    switch (tipo) {
      case 'ROTURA': return 'danger';
      case 'CADUCIDAD': return 'warn';
      case 'SOBRANTE': return 'info';
      case 'CONTROL_CALIDAD': return 'info';
      default: return 'secondary';
    }
  }

  getTipoLabel(tipo?: string): string {
    return this.tiposMerma.find((t) => t.codigo === tipo)?.label ?? tipo ?? '—';
  }

  getName(r: MermaRecord): string {
    return r.insumoNombre ?? r.productoNombre ?? '—';
  }

  formatFecha(fecha?: string): string {
    if (!fecha) return '—';
    const d = new Date(fecha);
    const iso = Number.isNaN(d.getTime()) ? new Date(fecha.replace(' ', 'T')) : d;
    if (Number.isNaN(iso.getTime())) return fecha;
    return iso.toLocaleString('es-MX', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }
}
