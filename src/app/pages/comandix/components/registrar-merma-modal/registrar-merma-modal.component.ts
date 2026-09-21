import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { DividerModule } from 'primeng/divider';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';

import { PendingOrder } from '../../models/order.model';
import { AuthService } from '@/auth/auth.service';
import { InsumoUsado, MermaItem, MermaService, TIPOS_MERMA } from '../../services/merma.service';

@Component({
  selector: 'app-registrar-merma-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CheckboxModule,
    DialogModule,
    DividerModule,
    InputTextModule,
    MessageModule,
    ProgressSpinnerModule,
    SelectModule,
    TagModule
  ],
  templateUrl: './registrar-merma-modal.component.html',
  styleUrls: ['./registrar-merma-modal.component.scss']
})
export class RegistrarMermaModalComponent implements OnChanges, OnDestroy {
  @Input() visible = false;
  @Input() order: PendingOrder | null = null;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() mermaRegistrada = new EventEmitter<string>();

  readonly tiposMerma = TIPOS_MERMA;

  insumos: InsumoUsado[] = [];
  seleccionados: Record<number, boolean> = {};
  cantidades: Record<number, number> = {};
  tipoMerma = 'OPERATIVA';
  loading = false;
  loadingInsumos = false;
  errorMessage = '';
  successMessage = '';

  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private tenantId = 1;

  constructor(
    private mermaService: MermaService,
    private authService: AuthService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible && this.order) {
      this.resetState();
      this.loadInsumosUsados(this.order.id);
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

  get seleccionTotal(): number {
    return this.insumos.filter((_, i) => this.seleccionados[i]).length;
  }

  get perdidaTotal(): number {
    let total = 0;
    for (const [indexStr, checked] of Object.entries(this.seleccionados)) {
      if (!checked) {
        continue;
      }
      const index = Number(indexStr);
      const insumo = this.insumos[index];
      if (!insumo) {
        continue;
      }
      const cantidad = this.cantidades[index] ?? insumo.cantidad ?? 0;
      total += cantidad * (insumo.costoUnitario ?? 0);
    }
    return total;
  }

  onClose(): void {
    if (this.loading) {
      return;
    }
    this.visible = false;
    this.visibleChange.emit(false);
  }

  async onRegistrar(): Promise<void> {
    if (!this.order || this.loading) {
      return;
    }

    const items: MermaItem[] = [];
    for (const [indexStr, checked] of Object.entries(this.seleccionados)) {
      if (!checked) {
        continue;
      }
      const index = Number(indexStr);
      const insumo = this.insumos[index];
      if (!insumo) {
        continue;
      }
      const cantidad = this.cantidades[index] ?? 0;
      if (cantidad <= 0) {
        continue;
      }
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
      this.errorMessage = 'Selecciona al menos un insumo con cantidad mayor a 0.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const response = await firstValueFrom(
        this.mermaService.registrarMerma({
          tenantId: this.tenantId,
          orderId: this.order.id,
          tipoMerma: this.tipoMerma,
          items
        })
      );

      if (response?.code !== 200) {
        throw new Error(response?.message || 'No se pudo registrar la merma.');
      }

      const registrados = (response?.object ?? []).length;
      this.successMessage = `${registrados} registro(s) de merma salvados para ${this.ticket}.`;
      this.mermaRegistrada.emit(this.order.id);

      this.closeTimer = setTimeout(() => {
        this.onClose();
      }, 1400);
    } catch (error: any) {
      this.errorMessage =
        error?.error?.message || error?.message || 'No se pudo registrar la merma. Intenta nuevamente.';
    } finally {
      this.loading = false;
    }
  }

  getTipoLabel(codigo: string): string {
    return this.tiposMerma.find((t) => t.codigo === codigo)?.label ?? codigo;
  }

  onCantidadInput(index: number, event: Event): void {
    this.seleccionados[index] = true;
    this.cantidades[index] = Number((event.target as HTMLInputElement).value);
  }

  getName(insumo: InsumoUsado): string {
    return insumo.insumoNombre ?? insumo.productoNombre ?? 'Producto';
  }

  trackByInsumo(index: number): number {
    return index;
  }

  private loadInsumosUsados(orderId: string): void {
    this.loadingInsumos = true;
    this.errorMessage = '';
    firstValueFrom(this.mermaService.resolverInsumosUsados(orderId))
      .then((res) => {
        const registros: InsumoUsado[] = res?.object ?? [];
        this.insumos = registros;
        const inicial: Record<number, boolean> = {};
        const cantidades: Record<number, number> = {};
        registros.forEach((r, i) => {
          inicial[i] = false;
          cantidades[i] = r.cantidad ?? 0;
        });
        this.seleccionados = inicial;
        this.cantidades = cantidades;
      })
      .catch(() => {
        this.errorMessage = 'No se pudieron cargar los insumos de la comanda.';
      })
      .finally(() => {
        this.loadingInsumos = false;
      });
  }

  private resetState(): void {
    this.insumos = [];
    this.seleccionados = {};
    this.cantidades = {};
    this.tipoMerma = 'OPERATIVA';
    this.errorMessage = '';
    this.successMessage = '';
    this.loading = false;
    this.tenantId = this.authService.getTenantId() || 1;
  }
}