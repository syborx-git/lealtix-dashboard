import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { DialogModule } from 'primeng/dialog';
import { ReporteBaseComponent } from './reportes-base.component';
import { KpiGridComponent } from './kpi-grid.component';
import { CuadranteResumenDTO, IngenieriaMenuDTO, PuntoMatrizDTO, ReportesParams } from './services/reportes.service';

/**
 * Reporte 2.2 - Ingeniería del Menú (Matriz Kasavana & Smith).
 *
 * Clasifica cada artículo de la carta en 4 cuadrantes según su Popularidad (volumen de ventas)
 * y su Rentabilidad (margen de contribución = precio de venta - costo de receta):
 * - Estrellas (⭐): Alta popularidad, Alto margen
 * - Caballos de Batalla (🐎): Alta popularidad, Bajo margen
 * - Rompecabezas (🧩): Baja popularidad, Alto margen
 * - Perros (🐕): Baja popularidad, Bajo margen
 */
@Component({
  selector: 'app-ingenieria-menu-report',
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
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    DialogModule,
    KpiGridComponent,
  ],
  templateUrl: './ingenieria-menu-report.component.html',
  styleUrls: ['./ingenieria-menu-report.component.scss'],
})
export class IngenieriaMenuReportComponent extends ReporteBaseComponent {
  protected readonly claveArchivo = '2.2_ingenieria_menu';

  readonly reporte = signal<IngenieriaMenuDTO | null>(null);
  readonly areaFiltro = signal<'TODOS' | 'COCINA' | 'BARRA'>('TODOS');
  readonly cuadranteSeleccionado = signal<string | null>(null);

  // Modal para detalle de cuadrante
  readonly modalCuadranteVisible = signal(false);
  readonly cuadranteParaModal = signal<CuadranteResumenDTO | null>(null);
  searchPlatillosModal = '';

  searchPlatillos = '';

  /** Platillos que pertenecen al cuadrante abierto en el modal */
  readonly platillosDelCuadranteModal = computed<Record<string, any>[]>(() => {
    const c = this.cuadranteParaModal();
    if (!c) return [];
    const todos = this.reporte()?.matrizProductos?.filas ?? [];
    return todos.filter((p: any) => p['cuadranteKey'] === c.cuadrante);
  });

  abrirModalCuadrante(c: CuadranteResumenDTO): void {
    this.cuadranteParaModal.set(c);
    this.searchPlatillosModal = '';
    this.modalCuadranteVisible.set(true);
  }

  /** Lista de cuadrantes ordenada para las 4 tarjetas */
  readonly listaCuadrantes = computed<CuadranteResumenDTO[]>(() => {
    const map = this.reporte()?.resumenCuadrantes;
    if (!map) return [];
    const orden = ['ESTRELLA', 'CABALLO_BATALLA', 'ROMPECABEZAS', 'PERRO'];
    return orden.map(k => map[k]).filter((c): c is CuadranteResumenDTO => !!c);
  });

  /** Productos filtrados por cuadrante si hay alguno seleccionado */
  readonly productosFiltrados = computed<Record<string, any>[]>(() => {
    const todos = this.reporte()?.matrizProductos?.filas ?? [];
    const cuadrante = this.cuadranteSeleccionado();
    if (!cuadrante) return todos;
    return todos.filter((p: any) => p['cuadranteKey'] === cuadrante);
  });

  /** Gráfica 1: Top 10 Platillos Más Rentables (por Margen Unitario $) */
  readonly rentablesChartData = computed(() => {
    const filas = [...(this.reporte()?.matrizProductos?.filas ?? [])];
    const top = filas
      .sort((a, b) => Number(b['margenUnitario'] ?? 0) - Number(a['margenUnitario'] ?? 0))
      .slice(0, 10);

    return {
      labels: top.map(d => String(d['producto'] ?? '')),
      datasets: [
        {
          label: 'Margen Unitario ($)',
          data: top.map(d => Number(d['margenUnitario'] ?? 0)),
          backgroundColor: '#10b981',
          borderRadius: 6,
          barThickness: 20,
        },
      ],
    };
  });

  readonly rentablesChartOptions = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const margen = this.moneda(Number(ctx.parsed.x));
            return ` Margen: ${margen}`;
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: '#f1f5f9' },
        ticks: {
          color: '#64748b',
          callback: (value: any) => `$${value}`,
        },
      },
      y: {
        grid: { display: false },
        ticks: { color: '#334155', font: { weight: '600' as const } },
      },
    },
  };

  /** Gráfica 2: Top 10 Platillos Más Populares (por Volumen de Salida) */
  readonly popularesChartData = computed(() => {
    const filas = [...(this.reporte()?.matrizProductos?.filas ?? [])];
    const top = filas
      .sort((a, b) => Number(b['unidadesVendidas'] ?? 0) - Number(a['unidadesVendidas'] ?? 0))
      .slice(0, 10);

    return {
      labels: top.map(d => String(d['producto'] ?? '')),
      datasets: [
        {
          label: 'Unidades Vendidas',
          data: top.map(d => Number(d['unidadesVendidas'] ?? 0)),
          backgroundColor: '#3b82f6',
          borderRadius: 6,
          barThickness: 20,
        },
      ],
    };
  });

  readonly popularesChartOptions = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${ctx.parsed.x} unidades`,
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: '#f1f5f9' },
        ticks: { color: '#64748b' },
      },
      y: {
        grid: { display: false },
        ticks: { color: '#334155', font: { weight: '600' as const } },
      },
    },
  };

  protected override params(): ReportesParams {
    return {
      ...super.params(),
      area: this.areaFiltro(),
    };
  }

  protected rangoArchivo(): { from: string; to: string } | null {
    const meta = this.reporte()?.meta;
    if (!meta) return null;
    return { from: meta.rangoActual.from, to: meta.rangoActual.to };
  }

  cambiarArea(area: 'TODOS' | 'COCINA' | 'BARRA'): void {
    if (this.areaFiltro() === area) return;
    this.areaFiltro.set(area);
    this.cuadranteSeleccionado.set(null);
    this.cargar();
  }

  toggleCuadrante(cuadrante: string): void {
    if (this.cuadranteSeleccionado() === cuadrante) {
      this.cuadranteSeleccionado.set(null);
    } else {
      this.cuadranteSeleccionado.set(cuadrante);
    }
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);

    this.reportesService
      .obtenerIngenieriaMenu(this.tenantId(), this.params())
      .subscribe({
        next: (respuesta) => {
          if (respuesta?.code && respuesta.code >= 400) {
            this.loading.set(false);
            this.reporte.set(null);
            this.error.set(respuesta.message || 'No se pudo cargar la ingeniería del menú');
            this.messageService.add({
              severity: 'error',
              summary: 'Error al cargar reporte',
              detail: this.error() ?? 'Ocurrió un error inesperado',
              life: 4000,
            });
            return;
          }
          const obj = respuesta?.object;
          if (obj && typeof obj === 'object') {
            this.reporte.set(obj);
          } else {
            this.reporte.set(null);
          }
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.reporte.set(null);
          this.error.set(err?.error?.message ?? err?.message ?? 'No se pudo cargar la ingeniería del menú');
          this.messageService.add({
            severity: 'error',
            summary: 'Error al cargar reporte',
            detail: this.error() ?? 'Ocurrió un error inesperado',
            life: 4000,
          });
        },
      });
  }

  exportar(): void {
    this.exportando.set(true);

    this.reportesService
      .exportarIngenieriaMenu(this.tenantId(), this.params())
      .subscribe({
        next: (blob) => {
          this.exportando.set(false);
          this.descargar(blob, this.nombreArchivo());
          this.messageService.add({
            severity: 'success',
            summary: 'Exportación completada',
            detail: 'Se descargó la matriz de ingeniería del menú correctamente.',
            life: 3500,
          });
        },
        error: (err) => {
          this.exportando.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Error al exportar',
            detail: err?.message ?? 'No se pudo generar el archivo Excel.',
            life: 4500,
          });
        },
      });
  }

  recargar(): void {
    this.cargar();
  }
}
