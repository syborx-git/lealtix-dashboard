import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { ReporteBaseComponent } from './reportes-base.component';
import { KpiGridComponent } from './kpi-grid.component';
import { CorteCajaDTO } from './services/reportes.service';

/**
 * Reporte 1.2 - Corte de Caja y Conciliacion.
 *
 * Responde tres preguntas del cierre del dia: cuanto se cobro y por que metodo,
 * quien lo cobro (para cuadrar el efectivo de cada cajero) y que se anulo.
 * Todos los importes y comparativas llegan calculados del backend.
 */
@Component({
  selector: 'app-corte-caja-report',
  standalone: true,
  imports: [CommonModule, ChartModule, TableModule, ButtonModule, SkeletonModule, TooltipModule, KpiGridComponent],
  templateUrl: './corte-caja-report.component.html',
  styleUrls: ['./corte-caja-report.component.scss'],
})
export class CorteCajaReportComponent extends ReporteBaseComponent {
  protected readonly claveArchivo = '1.2_corte_caja';

  readonly reporte = signal<CorteCajaDTO | null>(null);

  /** Distribucion del cobro por metodo en el periodo actual. */
  readonly metodoChartData = computed(() => {
    const filas = this.reporte()?.porMetodo?.filas ?? [];
    return {
      labels: filas.map((fila: any) => fila['metodo']),
      datasets: [
        {
          data: filas.map((fila: any) => Number(fila['total'] ?? 0)),
          backgroundColor: ['#16a34a', '#7c3aed', '#0891b2', '#ea580c', '#94a3b8'],
          borderWidth: 0,
        },
      ],
    };
  });

  readonly metodoChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right' as const, labels: { usePointStyle: true, boxWidth: 8 } },
      tooltip: {
        callbacks: {
          label: (contexto: any) => ` ${this.moneda(Number(contexto.parsed))}`,
          afterLabel: (contexto: any) => {
            const filas = this.reporte()?.porMetodo?.filas ?? [];
            const fila: any = filas[contexto.dataIndex];
            return fila ? ` ${fila['operaciones']} operaciones` : '';
          },
        },
      },
    },
  };

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);

    this.reportesService
      .obtenerCorteCaja(this.tenantId(), this.params())
      .subscribe({
        next: (respuesta) => {
          this.reporte.set(respuesta?.object ?? null);
          this.loading.set(false);
        },
        error: (error) => {
          this.loading.set(false);
          this.error.set(error?.error?.message ?? 'No se pudo cargar el corte de caja');
          this.messageService.add({
            severity: 'error',
            summary: 'Error al cargar el corte de caja',
            detail: this.error() ?? 'Ocurrio un error inesperado al cargar el reporte',
            life: 4000,
          });
        },
      });
  }

  exportar(): void {
    this.exportando.set(true);

    this.reportesService
      .exportarCorteCaja(this.tenantId(), this.params())
      .subscribe({
        next: (blob) => {
          this.exportando.set(false);
          this.descargar(blob, this.nombreArchivo());
        },
        error: (error) => {
          this.exportando.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'No se pudo exportar',
            detail: error?.error?.message ?? 'El archivo Excel no pudo generarse',
            life: 4000,
          });
        },
      });
  }

  recargar(): void {
    this.cargar();
  }

  protected rangoArchivo(): { from: string; to: string } | null {
    const rango = this.reporte()?.meta?.rangoActual;
    return rango ? { from: rango.from, to: rango.to } : null;
  }
}
