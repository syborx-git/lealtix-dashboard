import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ReportesFiltrosService } from './services/reportes-filtros.service';
import { Granularidad, PresetReporte } from './services/reportes.service';

interface ReporteNav {
  key: string;
  nombre: string;
  descripcion: string;
  ruta?: string;
  disponible: boolean;
}

interface PilarNav {
  key: string;
  nombre: string;
  icono: string;
  color: string;
  reportes: ReporteNav[];
}

/**
 * Contenedor maestro del modulo de Reportes y Analitica.
 *
 * La barra superior es comun a los 12 reportes: filtros rapidos, rango
 * personalizado, granularidad de la serie y exportacion a Excel. El boton de
 * exportar no sabe que reporte esta abierto: delega en el reporte activo, que
 * se registra en ReportesFiltrosService al montarse.
 */
@Component({
  selector: 'app-reportes-shell',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    ButtonModule,
    DatePickerModule,
    SelectModule,
    TooltipModule,
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './reportes-shell.component.html',
  styleUrls: ['./reportes-shell.component.scss'],
})
export class ReportesShellComponent {
  readonly granularidades = [
    { valor: '', etiqueta: 'Automatica' },
    { valor: 'day', etiqueta: 'Por dia' },
    { valor: 'week', etiqueta: 'Por semana' },
    { valor: 'month', etiqueta: 'Por mes' },
  ];

  readonly pilares: PilarNav[] = [
    {
      key: 'p1',
      nombre: 'Finanzas y Ventas',
      icono: 'pi-chart-line',
      color: '#7c3aed',
      reportes: [
        {
          key: 'ventas',
          nombre: 'Dashboard de Ventas y Tendencias',
          descripcion: 'Ingresos brutos/netos y comparativa de periodos',
          ruta: '/dashboard/reportes/analitica/ventas',
          disponible: true,
        },
        {
          key: 'corte-caja',
          nombre: 'Corte de Caja y Conciliacion',
          descripcion: 'Cobrado por metodo de pago y cuadre por cajero',
          ruta: '/dashboard/reportes/analitica/corte-caja',
          disponible: true,
        },
      ],
    },
    {
      key: 'p2',
      nombre: 'Menu e Inventario',
      icono: 'pi-box',
      color: '#0891b2',
      reportes: [
        {
          key: 'ingenieria-menu',
          nombre: 'Ingenieria de Menu',
          descripcion: 'Popularidad vs ganancia (estrellas, caballos, rompecabezas, perros)',
          disponible: false,
        },
        {
          key: 'kardex',
          nombre: 'Kardex de Insumos',
          descripcion: 'Entradas, consumo y mermas por insumo',
          disponible: false,
        },
        {
          key: 'mermas',
          nombre: 'Auditoria de Mermas',
          descripcion: 'Costeo de desperdicios por motivo y responsable',
          disponible: false,
        },
        {
          key: 'stock-critico',
          nombre: 'Alertas de Stock Critico',
          descripcion: 'Lista de compras automatica',
          disponible: false,
        },
      ],
    },
    {
      key: 'p3',
      nombre: 'CRM y Fidelidad',
      icono: 'pi-users',
      color: '#db2777',
      reportes: [
        {
          key: 'rfm',
          nombre: 'Analisis RFM',
          descripcion: 'Recencia, frecuencia y valor por cliente',
          disponible: false,
        },
        {
          key: 'campanas',
          nombre: 'Rendimiento de Campanas',
          descripcion: 'ROI y uso de cupones',
          disponible: false,
        },
      ],
    },
    {
      key: 'p4',
      nombre: 'Operacion y Staff',
      icono: 'pi-stopwatch',
      color: '#ea580c',
      reportes: [
        {
          key: 'tiempos',
          nombre: 'Tiempos de Servicio',
          descripcion: 'De la comanda al platillo listo',
          disponible: false,
        },
        {
          key: 'meseros',
          nombre: 'Rendimiento por Mesero',
          descripcion: 'Ticket promedio y upselling',
          disponible: false,
        },
        {
          key: 'mapa-calor',
          nombre: 'Mapa de Calor de Afluencia',
          descripcion: 'Horas y dias con mas comandas',
          disponible: false,
        },
        {
          key: 'asistencia',
          nombre: 'Control de Asistencia',
          descripcion: 'Entradas y salidas por PIN',
          disponible: false,
        },
      ],
    },
  ];

  /** Rango del DatePicker en modo intervalo. */
  rangoSeleccionado: Date[] | null = null;

  constructor(
    public filtros: ReportesFiltrosService,
    private messageService: MessageService
  ) {}

  get presetActual(): PresetReporte {
    return this.filtros.preset();
  }

  get granularidadActual(): Granularidad | '' {
    return this.filtros.granularidad();
  }

  aplicarPreset(preset: PresetReporte): void {
    this.rangoSeleccionado = null;
    this.filtros.setPreset(preset);
  }

  aplicarRango(fechas: Date[] | null): void {
    if (fechas && fechas.length === 2) {
      this.filtros.setRango(fechas);
    }
  }

  limpiarRango(): void {
    this.rangoSeleccionado = null;
    this.filtros.setPreset('HOY');
  }

  cambiarGranularidad(valor: Granularidad | ''): void {
    this.filtros.setGranularidad(valor);
  }

  exportar(): void {
    if (!this.filtros.tieneExportador()) {
      this.messageService.add({
        severity: 'info',
        summary: 'Exportacion no disponible',
        detail: 'Abre un reporte para poder exportarlo a Excel',
        life: 3000,
      });
    }
    this.filtros.exportar();
  }

  get totalReportes(): number {
    return this.pilares.reduce((total, pilar) => total + pilar.reportes.length, 0);
  }
}
