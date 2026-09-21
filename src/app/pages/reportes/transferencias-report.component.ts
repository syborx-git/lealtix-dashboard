import { Component, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Table, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { InventoryService } from '../inventario/service/inventory.service';
import { AuthService } from '@/auth/auth.service';

interface Transferencia {
  id: number;
  insumoId: number;
  insumoNombre: string;
  origen: string;
  destino: string;
  cantidad: number;
  createdAt: string;
}

@Component({
  selector: 'app-transferencias-report',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    TooltipModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './transferencias-report.component.html',
  styleUrls: ['./transferencias-report.component.scss']
})
export class TransferenciasReportComponent implements OnInit {
  @ViewChild('dt') dt!: Table;

  items = signal<Transferencia[]>([]);
  loading = signal(false);
  tenantId = 0;

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
    }
  }

  load() {
    this.loading.set(true);
    this.inventoryService.getTransferencias(this.tenantId).subscribe({
      next: (res) => {
        this.items.set(res.object || []);
        this.loading.set(false);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el historial de transferencias' });
        this.loading.set(false);
      }
    });
  }

  onGlobalFilter(table: Table, event: Event) {
    table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
  }

  destinoLabel(destino: string): string {
    return destino === 'cocina' ? 'Cocina' : 'Barra';
  }

  formatFecha(iso: string): string {
    if (!iso) return '-';
    const date = new Date(iso);
    if (isNaN(date.getTime())) return iso;
    return date.toLocaleString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }
}