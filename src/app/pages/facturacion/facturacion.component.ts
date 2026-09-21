import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FacturacionService } from './facturacion.service';

@Component({
  selector: 'app-facturacion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './facturacion.component.html',
  styleUrls: ['./facturacion.component.scss']
})
export class FacturacionComponent implements OnInit, OnDestroy {
  invoices: any[] = [];
  loading = true;
  error = '';

  searchText = '';
  statusFilter: string = 'all';

  private refreshTimer: any;

  readonly statusFilters = [
    { value: 'all', label: 'Todas' },
    { value: 'valid', label: 'Válidas' },
    { value: 'canceled', label: 'Canceladas' },
    { value: 'pending_cancellation', label: 'Pendientes de cancelación' }
  ];

  constructor(private facturacionService: FacturacionService) {}

  ngOnInit(): void {
    this.load();
    this.refreshTimer = setInterval(() => this.load(true), 10000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
  }

  load(silent = false): void {
    if (!silent) {
      this.loading = true;
    }
    this.error = '';
    this.facturacionService.list().subscribe({
      next: (data) => {
        this.invoices = data || [];
        this.loading = false;
      },
      error: () => {
        if (!silent) {
          this.error = 'No se pudieron cargar las facturas.';
        }
        this.loading = false;
      }
    });
  }

  get filteredInvoices(): any[] {
    let list = this.invoices;

    if (this.statusFilter !== 'all') {
      list = list.filter(inv => inv.status === this.statusFilter);
    }

    const q = this.searchText.trim().toLowerCase();
    if (q) {
      list = list.filter(inv =>
        (inv.customer?.legal_name || '').toLowerCase().includes(q) ||
        (inv.customer?.tax_id || '').toLowerCase().includes(q) ||
        (inv.uuid || '').toLowerCase().includes(q) ||
        (String(inv.series ?? '') + String(inv.folio_number ?? '')).toLowerCase().includes(q)
      );
    }

    return list;
  }

  download(id: string, format: 'pdf' | 'xml'): void {
    this.facturacionService.download(id, format).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${id}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.error = 'No se pudo descargar el archivo.';
      }
    });
  }

  receptor(inv: any): string {
    return inv.customer?.legal_name || '—';
  }

  serieFolio(inv: any): string {
    return `${inv.series ?? ''}${inv.folio_number ?? ''}`;
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'valid': return 'Válida';
      case 'canceled': return 'Cancelada';
      case 'pending_cancellation': return 'Pendiente de cancelación';
      case 'pending': return 'Pendiente';
      case 'draft': return 'Borrador';
      default: return status || '—';
    }
  }

  statusClass(status: string): string {
    switch (status) {
      case 'valid': return 'valid';
      case 'canceled': return 'canceled';
      case 'pending_cancellation': return 'pending-cancellation';
      case 'pending': return 'pending';
      default: return '';
    }
  }

  formatTotal(total: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(total || 0);
  }

  formatDate(date: string): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
