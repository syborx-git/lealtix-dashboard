import { Component, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { DividerModule } from 'primeng/divider';
import { FormsModule } from '@angular/forms';
import { ReporteBaseComponent } from './reportes-base.component';
import { KpiGridComponent } from './kpi-grid.component';
import { AuditoriaCortesDiariosDTO } from './services/reportes.service';
import { CorteCajaDiarioDTO } from '@/pages/caja/models/caja.model';

/**
 * Reporte 4.2 - Auditoría de Cortes del Día.
 *
 * Muestra el registro histórico y la auditoría de arqueos y cortes de caja diarios:
 * - KPIs de cortes realizados, total esperado por sistema, total físico declarado y diferencia neta.
 * - Desglose acumulado por método de pago (efectivo, tarjeta, transferencia, otros).
 * - Gráfica de distribución de cuadres (cuadrados, con sobrante, con faltante).
 * - Historial cronológico con comentarios de justificación y modal de detalle auditado.
 */
@Component({
  selector: 'app-cortes-diarios-report',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ChartModule,
    TableModule,
    ButtonModule,
    SkeletonModule,
    TooltipModule,
    TagModule,
    DialogModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    DividerModule,
    KpiGridComponent,
  ],
  templateUrl: './cortes-diarios-report.component.html',
  styleUrls: ['./cortes-diarios-report.component.scss'],
})
export class CortesDiariosReportComponent extends ReporteBaseComponent {
  protected readonly claveArchivo = '4.2_auditoria_cortes_diarios';

  readonly reporte = signal<AuditoriaCortesDiariosDTO | null>(null);

  // Estado del modal de detalle de corte
  readonly detalleModalVisible = signal<boolean>(false);
  readonly corteSeleccionado = signal<CorteCajaDiarioDTO | null>(null);

  // Filtro de búsqueda en tabla de detalle
  readonly textoBusqueda = signal<string>('');

  /** Filas filtradas del historial de cortes */
  readonly filasDetalleFiltradas = computed(() => {
    const rep = this.reporte();
    if (!rep?.detalle?.filas) return [];
    const q = this.textoBusqueda().trim().toLowerCase();
    if (!q) return rep.detalle.filas;

    return rep.detalle.filas.filter((f: any) => {
      const folio = String(f.folio || '').toLowerCase();
      const cajero = String(f.cajero || '').toLowerCase();
      const fecha = String(f.fecha || '').toLowerCase();
      const comentarios = String(f.comentarios || '').toLowerCase();
      const estado = String(f.estado || '').toLowerCase();
      return (
        folio.includes(q) ||
        cajero.includes(q) ||
        fecha.includes(q) ||
        comentarios.includes(q) ||
        estado.includes(q)
      );
    });
  });

  /** Gráfica Doughnut de distribución de resultados del cuadre */
  readonly distribucionChartData = computed(() => {
    const rep = this.reporte();
    if (!rep?.distribucion?.filas?.length) return null;

    const labels: string[] = [];
    const data: number[] = [];
    const backgroundColors: string[] = [];

    for (const f of rep.distribucion.filas) {
      const estado = String(f['estado'] || '');
      labels.push(estado);
      data.push(Number(f['cantidad'] || 0));

      if (estado.toLowerCase().includes('cuadrado')) {
        backgroundColors.push('#10b981'); // Emerald
      } else if (estado.toLowerCase().includes('sobrante')) {
        backgroundColors.push('#6366f1'); // Indigo
      } else {
        backgroundColors.push('#ef4444'); // Rose/Red
      }
    }

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: backgroundColors,
          borderWidth: 0,
          hoverOffset: 6,
        },
      ],
    };
  });

  readonly distribucionChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          boxWidth: 12,
          usePointStyle: true,
          pointStyle: 'circle',
          font: { family: 'inherit', size: 11, weight: 600 as any },
          padding: 14,
        },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const val = context.raw || 0;
            return ` ${context.label}: ${val} corte(s)`;
          },
        },
      },
    },
    cutout: '70%',
  };

  cargar(): void {
    if (this.tenantId() <= 0) return;
    this.loading.set(true);
    this.error.set(null);

    this.reportesService
      .obtenerCortesDiarios(this.tenantId(), this.params())
      .subscribe({
        next: (resp) => {
          if (resp?.code === 200 && resp.object) {
            this.reporte.set(resp.object);
          } else {
            this.error.set(resp?.message || 'No se pudo cargar la auditoría de cortes diarios');
          }
          this.loading.set(false);
        },
        error: (err) => {
          console.error('[CortesDiariosReport] Error cargando reporte:', err);
          this.error.set(
            err?.error?.message ||
              err?.message ||
              'Error de comunicación al consultar la auditoría de cortes'
          );
          this.loading.set(false);
        },
      });
  }

  exportar(): void {
    if (this.tenantId() <= 0) return;
    this.exportando.set(true);

    this.reportesService
      .exportarCortesDiarios(this.tenantId(), this.params())
      .subscribe({
        next: (blob) => {
          this.descargar(blob, this.nombreArchivo());
          this.exportando.set(false);
        },
        error: (err) => {
          console.error('[CortesDiariosReport] Error exportando archivo:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'No se pudo exportar',
            detail: err?.error?.message ?? 'No se pudo generar el archivo Excel de auditoría de cortes',
            life: 4000,
          });
          this.exportando.set(false);
        },
      });
  }

  protected rangoArchivo(): { from: string; to: string } | null {
    const rango = this.reporte()?.meta?.rangoActual;
    return rango ? { from: rango.from, to: rango.to } : null;
  }

  recargar(): void {
    this.cargar();
  }

  /** Abre el modal de detalle para el corte seleccionado */
  abrirModalDetalle(fila: any): void {
    const idCorte = Number(fila.id ?? fila.folio?.replace('#CD-', ''));
    const rep = this.reporte();

    // Intentar buscar en listaCortes
    let encontrado: CorteCajaDiarioDTO | null = null;
    if (rep?.listaCortes?.length) {
      encontrado =
        rep.listaCortes.find(
          (c) => c.idCorteDiario === idCorte || '#CD-' + String(c.idCorteDiario).padStart(4, '0') === fila.folio
        ) || null;
    }

    // Si no está en listaCortes, construir un DTO a partir de la fila
    if (!encontrado) {
      encontrado = {
        idCorteDiario: idCorte || 0,
        tenantId: this.tenantId(),
        cajeroNombre: fila.cajero,
        fechaCorte: fila.fecha,
        fechaHoraRegistro: fila.fecha + ' ' + fila.hora,
        sistemaEfectivo: 0,
        sistemaTarjeta: 0,
        sistemaTransferencia: 0,
        sistemaOtros: 0,
        sistemaTotal: Number(fila.sistema || 0),
        realEfectivo: 0,
        realTarjeta: 0,
        realTransferencia: 0,
        realOtros: 0,
        realTotal: Number(fila.real || 0),
        diferenciaEfectivo: 0,
        diferenciaTarjeta: 0,
        diferenciaTransferencia: 0,
        diferenciaOtros: 0,
        diferenciaTotal: Number(fila.diferencia || 0),
        estadoDiferencia: fila.estado,
        comentarios: fila.comentarios,
      };
    }

    this.corteSeleccionado.set(encontrado);
    this.detalleModalVisible.set(true);
  }

  cerrarModalDetalle(): void {
    this.detalleModalVisible.set(false);
    this.corteSeleccionado.set(null);
  }

  /** Severidad visual para los tags de estado de cuadre */
  severidadEstado(estado: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const e = (estado || '').toUpperCase();
    if (e.includes('CUADRADO')) return 'success';
    if (e.includes('SOBRANTE')) return 'info';
    if (e.includes('FALTANTE')) return 'danger';
    return 'secondary';
  }

  iconoEstado(estado: string): string {
    const e = (estado || '').toUpperCase();
    if (e.includes('CUADRADO')) return 'pi pi-check-circle';
    if (e.includes('SOBRANTE')) return 'pi pi-arrow-up-right';
    if (e.includes('FALTANTE')) return 'pi pi-arrow-down-right';
    return 'pi pi-circle';
  }
}
