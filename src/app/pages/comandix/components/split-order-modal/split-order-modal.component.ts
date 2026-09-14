import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { DividerModule } from 'primeng/divider';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';

import { OrderItem, PendingOrder, TipInfo } from '../../models/order.model';
import { OrderService } from '../../services/order.service';
import { AuthService } from '@/auth/auth.service';

interface SplitItem {
  productId: number;
  productName: string;
  cantidad: number;
  precioUnitario: number;
  comentarios?: string;
  excludedIngredientIds?: number[];
  additionalIngredientIds?: number[];
  seleccionado: boolean;
}

type SplitMode = 'items' | 'equal';

@Component({
  selector: 'app-split-order-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CheckboxModule,
    DialogModule,
    DividerModule,
    InputNumberModule,
    MessageModule,
    ProgressSpinnerModule,
    TagModule
  ],
  templateUrl: './split-order-modal.component.html',
  styleUrls: ['./split-order-modal.component.scss']
})
export class SplitOrderModalComponent implements OnChanges, OnDestroy {
  @Input() visible = false;
  @Input() order: PendingOrder | null = null;
  @Input() tip: TipInfo | null = null;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() cuentaCreada = new EventEmitter<{
    originalOrderId: string;
    newOrderId: string;
    newOrderIds?: string[];
  }>();

  splitMode: SplitMode = 'items';
  numPersonas = 2;
  items: SplitItem[] = [];
  loading = false;
  errorMessage = '';
  successMessage = '';

  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private orderService: OrderService,
    private authService: AuthService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible && this.order) {
      this.resetState();
      this.buildItems();
    }
  }

  ngOnDestroy(): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  get ticket(): string {
    if (!this.order) {
      return '';
    }
    return '#' + this.order.id.slice(0, 8).toUpperCase();
  }

  get clienteLabel(): string {
    return this.order?.customerName ?? this.order?.nombre ?? 'Cliente General';
  }

  get seleccionTotal(): number {
    return this.items.filter((item) => item.seleccionado).length;
  }

  get seleccionCantidad(): number {
    return this.items.filter((item) => item.seleccionado).reduce((sum, item) => sum + item.cantidad, 0);
  }

  get seleccionMonto(): number {
    return this.items
      .filter((item) => item.seleccionado)
      .reduce((sum, item) => sum + item.precioUnitario * item.cantidad, 0);
  }

  get tieneSeleccion(): boolean {
    return this.items.some((item) => item.seleccionado);
  }

  get totalUnidades(): number {
    return this.items.reduce((sum, item) => sum + item.cantidad, 0);
  }

  get totalCuenta(): number {
    return this.items.reduce((sum, item) => sum + item.precioUnitario * item.cantidad, 0);
  }

  get maxPersonas(): number {
    return this.totalUnidades;
  }

  get montoPorPersona(): number {
    if (!this.numPersonas) {
      return 0;
    }
    return this.totalCuenta / this.numPersonas;
  }

  get propinaPorPersona(): number {
    if (this.tip?.percent) {
      return (this.montoPorPersona * this.tip.percent) / 100;
    }
    if (this.tip?.amount != null && this.numPersonas) {
      return this.tip.amount / this.numPersonas;
    }
    return 0;
  }

  get montoPorPersonaConTip(): number {
    return this.montoPorPersona + this.propinaPorPersona;
  }

  onClose(): void {
    if (this.loading) {
      return;
    }
    this.visible = false;
    this.visibleChange.emit(false);
  }

  incrementarPersonas(): void {
    this.numPersonas = Math.min(this.maxPersonas, this.numPersonas + 1);
  }

  decrementarPersonas(): void {
    this.numPersonas = Math.max(2, this.numPersonas - 1);
  }

  async onCrearCuenta(): Promise<void> {
    if (!this.order || this.loading) {
      return;
    }

    const items: OrderItem[] = this.items
      .filter((item) => item.seleccionado)
      .map((item) => ({
        productId: item.productId,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        comentarios: item.comentarios || undefined,
        excludedIngredientIds: item.excludedIngredientIds,
        additionalIngredientIds: item.additionalIngredientIds
      }));

    if (items.length === 0) {
      this.errorMessage = 'Selecciona al menos un artículo para crear la nueva cuenta.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const response = await firstValueFrom(
        this.orderService.splitOrder(this.order.id, {
          tenantId: this.authService.getTenantId() || this.order.tenantId || 1,
          customerId: this.order.customerId ?? null,
          items,
          source: 'POS'
        })
      );

      const newOrderId = response?.object?.newOrder?.id ? String(response.object.newOrder.id) : '';
      if (!newOrderId) {
        throw new Error(response?.message || 'No se pudo crear la nueva cuenta.');
      }

      this.successMessage = 'Nueva cuenta creada exitosamente, cada comanda se salvó por separado.';
      this.cuentaCreada.emit({ originalOrderId: this.order.id, newOrderId });

      this.closeTimer = setTimeout(() => {
        this.onClose();
      }, 1400);
    } catch (error: any) {
      this.errorMessage =
        error?.error?.message ||
        error?.message ||
        'No se pudo dividir la cuenta. Intenta nuevamente.';
    } finally {
      this.loading = false;
    }
  }

  trackByItem(index: number): number {
    return index;
  }

  getComentarios(item: SplitItem): string {
    return item.comentarios ?? '';
  }

  async onDividirEquitativamente(): Promise<void> {
    if (!this.order || this.loading) {
      return;
    }

    const personas = Math.max(2, Math.min(Math.floor(this.numPersonas || 2), this.maxPersonas));
    if (personas < 2) {
      this.errorMessage = 'Ingresa al menos 2 personas para dividir la cuenta.';
      return;
    }
    if (personas > this.maxPersonas) {
      this.errorMessage = `Esta cuenta solo alcanza para ${this.maxPersonas} personas.`;
      return;
    }

    const grupos = this.repartoEquitativo(personas);

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      // La comanda original conserva un grupo; las demás se abren como comandas nuevas
      const newOrderIds: string[] = [];
      for (let i = 1; i < grupos.length; i++) {
        const items: OrderItem[] = grupos[i].map((item) => ({
          productId: item.productId,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          comentarios: item.comentarios || undefined,
          excludedIngredientIds: item.excludedIngredientIds,
          additionalIngredientIds: item.additionalIngredientIds
        }));

        const response = await firstValueFrom(
          this.orderService.splitOrder(this.order.id, {
            tenantId: this.authService.getTenantId() || this.order.tenantId || 1,
            customerId: this.order.customerId ?? null,
            items,
            source: 'POS'
          })
        );

        const newOrderId = response?.object?.newOrder?.id ? String(response.object.newOrder.id) : '';
        if (newOrderId) {
          newOrderIds.push(newOrderId);
        }
      }

      if (newOrderIds.length === 0) {
        throw new Error('No se pudo dividir la cuenta en partes equitativas.');
      }

      this.successMessage =
        `La cuenta se dividió en ${personas} comandas de $${this.montoPorPersona.toFixed(2)} cada una.`;
      this.cuentaCreada.emit({
        originalOrderId: this.order.id,
        newOrderId: newOrderIds[0],
        newOrderIds
      });

      this.closeTimer = setTimeout(() => {
        this.onClose();
      }, 1600);
    } catch (error: any) {
      this.errorMessage =
        error?.error?.message ||
        error?.message ||
        'No se pudo dividir la cuenta equitativamente. Intenta nuevamente.';
    } finally {
      this.loading = false;
    }
  }

  // Reparte los artículos en N grupos con montos lo más balanceados posible
  private repartoEquitativo(personas: number): SplitItem[][] {
    const unidades: SplitItem[] = [];
    this.items.forEach((item) => {
      for (let u = 0; u < item.cantidad; u++) {
        unidades.push({ ...item, cantidad: 1 });
      }
    });

    const grupos: SplitItem[][] = Array.from({ length: personas }, () => []);
    const sumas = new Array<number>(personas).fill(0);

    unidades
      .slice()
      .sort((a, b) => b.precioUnitario - a.precioUnitario)
      .forEach((unidad) => {
        let idx = 0;
        for (let g = 1; g < personas; g++) {
          if (sumas[g] < sumas[idx]) {
            idx = g;
          }
        }
        grupos[idx].push(unidad);
        sumas[idx] += unidad.precioUnitario;
      });

    return grupos;
  }

  private buildItems(): void {
    if (!this.order?.items) {
      this.items = [];
      return;
    }
    this.items = this.order.items.map((item) => ({
      productId: item.productId ?? 0,
      productName: item.productName ?? item.prod ?? `Producto #${item.productId ?? ''}`,
      cantidad: item.cantidad ?? 1,
      precioUnitario: item.precioUnitario ?? item.precio ?? 0,
      comentarios: item.comentarios,
      excludedIngredientIds: item.excludedIngredientIds,
      additionalIngredientIds: item.additionalIngredientIds,
      seleccionado: false
    }));
  }

  private resetState(): void {
    this.items = [];
    this.errorMessage = '';
    this.successMessage = '';
    this.loading = false;
    this.splitMode = 'items';
    this.numPersonas = 2;
  }
}