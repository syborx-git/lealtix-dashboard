import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TagModule } from 'primeng/tag';
import { KpiDTO } from './services/reportes.service';

/**
 * Cuadro de KPIs con comparativa contra el periodo anterior.
 * Es presentacional: recibe los KPI ya calculados por el backend.
 */
@Component({
  selector: 'app-kpi-grid',
  standalone: true,
  imports: [CommonModule, TagModule],
  template: `
    <div class="kpi-grid">
      @for (kpi of kpis; track kpi.key) {
        <div class="kpi-card">
          <span class="kpi-card__label">{{ kpi.label }}</span>
          <span class="kpi-card__valor">
            {{ kpi.formato === 'moneda' ? moneda(kpi.actual) : numero(kpi.actual, 0) }}
          </span>
          <div class="kpi-card__comparativa">
            <p-tag
              [severity]="severity(kpi.direccion)"
              [value]="porcentaje(kpi.variacionPct)"
              [icon]="icono(kpi.direccion)"
            />
            <span class="kpi-card__anterior">
              antes: {{ kpi.formato === 'moneda' ? moneda(kpi.anterior) : numero(kpi.anterior, 0) }}
            </span>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
        gap: 0.85rem;
      }

      .kpi-card {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        padding: 1rem 1.1rem;
        background: #fff;
        border: 1px solid var(--lealtix-slate-200);
        border-radius: var(--lealtix-radius-md);
        box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
      }

      .kpi-card__label {
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--lealtix-slate-500);
      }

      .kpi-card__valor {
        font-size: 1.55rem;
        font-weight: 700;
        line-height: 1.1;
        color: var(--lealtix-slate-900);
      }

      .kpi-card__comparativa {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .kpi-card__anterior {
        font-size: 0.72rem;
        color: var(--lealtix-slate-500);
      }

      @media (max-width: 640px) {
        .kpi-card__valor {
          font-size: 1.3rem;
        }
      }

      :host-context(.app-dark) .kpi-card {
        background: #1e293b;
        border-color: #334155;
      }

      :host-context(.app-dark) .kpi-card__valor {
        color: #e2e8f0;
      }

      :host-context(.app-dark) .kpi-card__label,
      :host-context(.app-dark) .kpi-card__anterior {
        color: #94a3b8;
      }
    `,
  ],
})
export class KpiGridComponent {
  @Input({ required: true }) kpis: KpiDTO[] = [];

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
}
