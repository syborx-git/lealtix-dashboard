import { Injectable, computed, signal } from '@angular/core';
import { Granularidad, PresetReporte, ReportesParams } from './reportes.service';

export interface PresetOpcion {
  valor: PresetReporte;
  etiqueta: string;
  atajo: string;
}

/**
 * Estado compartido del panel de filtros de Reportes y Analitica.
 *
 * Es la pieza que hace que los 12 reportes se comporten igual: cualquier reporte
 * lee los mismos filtros de aqui y se recarga cuando cambian. La comparativa
 * contra el periodo anterior la resuelve el backend, por lo que la UI nunca
 * calcula periodos ni porcentajes.
 */
@Injectable({ providedIn: 'root' })
export class ReportesFiltrosService {
  readonly presets: PresetOpcion[] = [
    { valor: 'HOY', etiqueta: 'Hoy', atajo: 'H' },
    { valor: 'AYER', etiqueta: 'Ayer', atajo: 'A' },
    { valor: 'ESTA_SEMANA', etiqueta: 'Esta semana', atajo: 'S' },
    { valor: 'SEMANA_PASADA', etiqueta: 'Semana pasada', atajo: '' },
    { valor: 'ESTE_MES', etiqueta: 'Este mes', atajo: 'M' },
    { valor: 'MES_PASADO', etiqueta: 'Mes pasado', atajo: '' },
  ];

  readonly preset = signal<PresetReporte>('HOY');
  readonly rango = signal<Date[] | null>(null);
  readonly granularidad = signal<Granularidad | ''>('');

  /**
   * Contador incremental de cambios. Los reportes lo observan con effect() para
   * recargarse; usar un contador evita repetir la peticion cuando el usuario
   * vuelve a pulsar el preset que ya estaba activo.
   */
  private readonly _revision = signal(0);
  readonly revision = this._revision.asReadonly();

  readonly esPersonalizado = computed(() => this.preset() === 'PERSONALIZADO');

  /** Texto del periodo activo; con rango manual muestra las dos fechas. */
  readonly etiquetaPeriodo = computed(() => {
    const fechas = this.rango();
    if (this.esPersonalizado() && fechas && fechas.length === 2) {
      return `${this.formato(fechas[0])} - ${this.formato(fechas[1])}`;
    }
    return this.presets.find((p) => p.valor === this.preset())?.etiqueta ?? 'Hoy';
  });

  setPreset(preset: PresetReporte): void {
    this.preset.set(preset);
    this.rango.set(null);
    this._revision.update((n) => n + 1);
  }

  /** Al elegir fechas manualmente el modo pasa a PERSONALIZADO. */
  setRango(fechas: Date[] | null): void {
    this.rango.set(fechas);
    if (fechas && fechas.length === 2) {
      this.preset.set('PERSONALIZADO');
    }
    this._revision.update((n) => n + 1);
  }

  setGranularidad(granularidad: Granularidad | ''): void {
    this.granularidad.set(granularidad);
    this._revision.update((n) => n + 1);
  }

  /** Traduce el estado actual a los query params que espera el backend. */
  toParams(): ReportesParams {
    const fechas = this.rango();
    const personalizado = this.preset() === 'PERSONALIZADO' && fechas && fechas.length === 2;

    return {
      preset: this.preset(),
      from: personalizado ? this.aIso(fechas![0]) : undefined,
      to: personalizado ? this.aIso(fechas![1]) : undefined,
      granularidad: this.granularidad() || undefined,
    };
  }

  /**
   * El reporte activo registra aqui como exportar sus datos. Asi el boton
   * "Exportar a Excel" de la barra superior sirve para los 12 reportes sin
   * que la barra tenga que conocer ninguno de ellos.
   */
  private exportador: (() => void) | null = null;

  registrarExportador(fn: (() => void) | null): void {
    this.exportador = fn;
  }

  tieneExportador(): boolean {
    return this.exportador !== null;
  }

  exportar(): void {
    this.exportador?.();
  }

  /** Formato yyyy-MM-dd, que es lo que parsea @DateTimeFormat(ISO.DATE_TIME) con hora 00:00. */
  private aIso(fecha: Date): string {
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${fecha.getFullYear()}-${mes}-${dia}T00:00:00`;
  }

  private formato(fecha: Date): string {
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${dia}/${mes}/${fecha.getFullYear()}`;
  }
}
