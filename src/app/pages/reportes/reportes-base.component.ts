import { Directive, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import { ReportesFiltrosService } from './services/reportes-filtros.service';
import {
  KpiDTO,
  ReportesService,
  ReportesParams,
  TipoColumna,
} from './services/reportes.service';
import { AuthService } from '@/auth/auth.service';
import { MessageService } from 'primeng/api';

/**
 * Base comun de todos los reportes del modulo.
 *
 * Concentra lo que debe ser identico en los 12 reportes: recarga automatica
 * cuando cambia cualquier filtro de la barra superior, registro del exportador
 * ante el boton "Exportar a Excel" y los formateadores de presentacion.
 *
 * El subclase solo tiene que implementar cargar() y exportar().
 */
@Directive()
export abstract class ReporteBaseComponent implements OnInit, OnDestroy {
  protected readonly reportesService = inject(ReportesService);
  protected readonly filtros = inject(ReportesFiltrosService);
  protected readonly authService = inject(AuthService);
  protected readonly messageService = inject(MessageService);

  readonly loading = signal(true);
  readonly exportando = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    // Se recarga solo cuando cambia cualquier filtro global de la barra superior.
    effect(() => {
      this.filtros.revision();
      this.cargar();
    });
  }

  /** Clave corta del reporte, usada en el nombre del archivo exportado. */
  protected abstract readonly claveArchivo: string;

  abstract cargar(): void;

  abstract exportar(): void;

  /** Rango activo devuelto por el backend, para nombrar el archivo. */
  protected abstract rangoArchivo(): { from: string; to: string } | null;

  ngOnInit(): void {
    // El boton "Exportar a Excel" de la barra superior delega aqui.
    this.filtros.registrarExportador(() => this.exportar());
  }

  ngOnDestroy(): void {
    this.filtros.registrarExportador(null);
  }

  protected params(): ReportesParams {
    return this.filtros.toParams();
  }

  protected tenantId(): number {
    return this.authService.getTenantId();
  }

  // ==================== Presentacion ====================

  moneda(valor: number | null | undefined): string {
    return (Number(valor ?? 0)).toLocaleString('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  numero(valor: number | null | undefined, decimales = 0): string {
    return (Number(valor ?? 0)).toLocaleString('es-MX', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    });
  }

  porcentaje(valor: number | null | undefined): string {
    if (valor === null || valor === undefined) {
      return 'sin comparacion';
    }
    return `${valor > 0 ? '+' : ''}${this.numero(valor, 1)}%`;
  }

  severity(direccion: KpiDTO['direccion']): 'success' | 'danger' | 'info' | 'secondary' {
    switch (direccion) {
      case 'SUBE':
        return 'success';
      case 'BAJA':
        return 'danger';
      case 'NUEVO':
        return 'info';
      default:
        return 'secondary';
    }
  }

  icono(direccion: KpiDTO['direccion']): string {
    switch (direccion) {
      case 'SUBE':
        return 'pi-arrow-up-right';
      case 'BAJA':
        return 'pi-arrow-down-right';
      case 'NUEVO':
        return 'pi-sparkles';
      default:
        return 'pi-minus';
    }
  }

  /** Alinea a la derecha las columnas numericas o monetarias. */
  alineacion(columna: { tipo: TipoColumna }): 'right' | 'left' {
    const tipo = columna.tipo;
    return tipo === 'MONEDA' || tipo === 'NUMERO' || tipo === 'PORCENTAJE' ? 'right' : 'left';
  }

  /**
   * Formatea el valor de una celda usando el tipo declarado por su columna.
   *
   * `columna` es la clave de la columna (por ejemplo "total", "propinas",
   * "participacion"), NO el nombre visible. El backend entrega cada tabla como
   * una lista de mapas cuyas claves son las claves declaradas en `columnas`, de
   * modo que el formateo tiene que resolverse por clave: leer una clave fija
   * como "valor" dejaba todas las columnas numericas en cero.
   */
  valorCelda(fila: Record<string, any>, columna: { key: string; tipo: TipoColumna }): string {
    const valor = fila?.[columna.key];
    switch (columna.tipo) {
      case 'MONEDA':
        return this.moneda(valor);
      case 'PORCENTAJE':
        return valor === null || valor === undefined ? '-' : `${this.numero(valor, 1)}%`;
      case 'NUMERO':
        // "numero" con 2 decimales duplicaba el conteo de columnas enteras.
        return this.numero(valor, Number.isInteger(Number(valor)) ? 0 : 2);
      case 'FECHA':
        return valor ?? '-';
      default:
        return valor === null || valor === undefined || valor === '' ? '-' : String(valor);
    }
  }

  // ==================== Descarga ====================

  protected descargar(blob: Blob, nombre: string): void {
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(url);
  }

  protected nombreArchivo(): string {
    const rango = this.rangoArchivo();
    const sufijo = rango
      ? `${rango.from.slice(0, 10)}_${rango.to.slice(0, 10)}`
      : 'reporte';
    return `lealtix_${this.claveArchivo}_${sufijo}.xlsx`;
  }
}
