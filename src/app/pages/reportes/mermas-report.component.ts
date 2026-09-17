import { Component, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Table, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { MermaRecord, MermaService } from '../comandix/services/merma.service';
import { AuthService } from '@/auth/auth.service';

@Component({
  selector: 'app-mermas-report',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    TagModule,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './mermas-report.component.html',
  styleUrls: ['./mermas-report.component.scss']
})
export class MermasReportComponent implements OnInit {
  @ViewChild('dt') dt!: Table;

  items = signal<MermaRecord[]>([]);
  loading = signal(false);
  tenantId = 0;

  constructor(
    private mermaService: MermaService,
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
    this.mermaService.listarPorTenant(this.tenantId).subscribe({
      next: (res) => {
        this.items.set(res.object || []);
        this.loading.set(false);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las mermas' });
        this.loading.set(false);
      }
    });
  }

  onGlobalFilter(table: Table, event: Event) {
    table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
  }

  esAdministrativa(r: MermaRecord): boolean {
    return (r.categoriaMerma ?? 'COMANDADA').toUpperCase() === 'ADMINISTRATIVA';
  }

  tipoColor(r: MermaRecord): 'info' | 'warn' {
    return this.esAdministrativa(r) ? 'info' : 'warn';
  }

  tipoLabel(r: MermaRecord): string {
    return this.esAdministrativa(r) ? 'Administrativa' : 'Comanda';
  }

  nombre(r: MermaRecord): string {
    return r.insumoNombre ?? r.productoNombre ?? '—';
  }

  usuario(r: MermaRecord): string {
    return r.usuarioNombre || '—';
  }

  motivo(r: MermaRecord): string {
    return r.motivo || (this.esAdministrativa(r) ? '—' : 'Merma por comanda');
  }

  origenLabel(r: MermaRecord): string {
    switch (r.origen) {
      case 'BODEGA': return 'Bodega';
      case 'COCINA': return 'Cocina';
      case 'BARRA': return 'Barra';
      default: return '';
    }
  }

  formatFecha(iso: string): string {
    if (!iso) return '—';
    const date = new Date(iso);
    if (isNaN(date.getTime())) return iso;
    return date.toLocaleString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }
}