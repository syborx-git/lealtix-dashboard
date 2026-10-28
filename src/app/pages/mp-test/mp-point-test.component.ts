import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MpPointTestService } from './mp-point-test.service';

/**
 * Página de PRUEBAS (solo local) para cobrar en la terminal Mercado Pago Point.
 * No forma parte del flujo de producción.
 */
@Component({
  selector: 'app-mp-point-test',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="mp-page">
      <div class="mp-head">
        <h2>Prueba Mercado Pago Point</h2>
        <span class="mp-tag">SOLO PRUEBAS</span>
      </div>
      <p class="mp-sub">
        Envía un cobro a la terminal Point Smart 2 y consulta su estado. Usa tarjeta de prueba;
        no se cobra dinero real.
      </p>

      <div class="mp-card">
        <label>Monto (MXN) — mínimo $5.00</label>
        <div class="mp-row">
          <input type="number" min="5" step="0.01" [(ngModel)]="amount" [disabled]="loading()" />
          <button class="btn primary" (click)="charge()" [disabled]="loading() || pending()">
            {{ loading() ? 'Enviando…' : (pending() ? 'Esperando en terminal…' : 'Cobrar en terminal') }}
          </button>
        </div>
        <div class="mp-hint" *ngIf="pending()">
          Hay un cobro pendiente en la terminal. Pásale la tarjeta o pulsa <b>Cancelar cobro</b>.
        </div>
        <div class="mp-actions">
          <button class="btn" (click)="refresh()" [disabled]="!intentId()">Consultar estado</button>
          <button class="btn danger" (click)="cancel()" [disabled]="!intentId()">Cancelar cobro</button>
        </div>
        <div *ngIf="error()" class="mp-error">{{ error() }}</div>
      </div>

      <div class="mp-card" *ngIf="intent()">
        <div class="mp-kv"><span>Payment Intent</span><code>{{ intentId() }}</code></div>
        <div class="mp-kv">
          <span>Monto</span>
          <b>{{ (intent().amount || 0) / 100 | number:'1.2-2' }} MXN</b>
        </div>
        <div class="mp-kv">
          <span>Estado</span>
          <b [ngClass]="stateClass(intent().state)">{{ intent().state || '—' }}</b>
        </div>
        <div class="mp-kv" *ngIf="intent().payment">
          <span>Pago</span>
          <b [ngClass]="stateClass(intent().payment?.status)">
            {{ intent().payment?.status }}
            {{ intent().payment?.status_detail ? '(' + intent().payment?.status_detail + ')' : '' }}
          </b>
        </div>
        <div class="mp-hint" *ngIf="intent().state === 'OPEN'">
          Acerca la tarjeta de prueba a la terminal…
        </div>

        <details>
          <summary>Respuesta JSON</summary>
          <pre>{{ intent() | json }}</pre>
        </details>
      </div>
    </div>
  `,
  styles: [
    `
      .mp-page {
        max-width: 760px;
        margin: 0 auto;
        padding: 1.5rem;
      }
      .mp-head {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.25rem;
      }
      .mp-head h2 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 800;
        color: var(--text-color);
      }
      .mp-tag {
        font-size: 0.65rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        padding: 0.2rem 0.5rem;
        border-radius: 999px;
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
        border: 1px solid rgba(245, 158, 11, 0.3);
      }
      .mp-sub {
        color: var(--text-color-secondary);
        font-size: 0.9rem;
        margin-bottom: 1.25rem;
      }
      .mp-card {
        background: var(--surface-card);
        border: 1px solid var(--surface-border);
        border-radius: 16px;
        padding: 1.25rem;
        margin-bottom: 1rem;
        box-shadow: var(--lealtix-shadow-md, 0 4px 6px rgba(0, 0, 0, 0.07));
      }
      label {
        display: block;
        font-weight: 700;
        font-size: 0.8rem;
        margin-bottom: 0.4rem;
        color: var(--text-color-secondary);
      }
      .mp-row {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
      }
      input {
        flex: 1 1 180px;
        min-width: 0;
        padding: 0.65rem 0.8rem;
        border-radius: 10px;
        border: 1px solid var(--surface-border);
        background: var(--surface-section);
        color: var(--text-color);
        font-size: 1rem;
      }
      .mp-actions {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.75rem;
        flex-wrap: wrap;
      }
      .btn {
        padding: 0.65rem 1rem;
        border-radius: 10px;
        border: 1px solid var(--surface-border);
        background: var(--surface-section);
        color: var(--text-color);
        font-weight: 700;
        cursor: pointer;
      }
      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .btn.primary {
        background: linear-gradient(135deg, #6366f1, #4f46e5);
        color: #fff;
        border: none;
      }
      .btn.danger {
        color: #f87171;
        border-color: rgba(239, 68, 68, 0.4);
      }
      .mp-error {
        margin-top: 0.75rem;
        padding: 0.65rem 0.8rem;
        border-radius: 10px;
        background: rgba(239, 68, 68, 0.12);
        color: #fca5a5;
        font-size: 0.85rem;
      }
      .mp-kv {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.4rem 0;
        border-bottom: 1px dashed var(--surface-border);
        font-size: 0.9rem;
      }
      .mp-kv span {
        color: var(--text-color-secondary);
      }
      .mp-kv b,
      .mp-kv code {
        color: var(--text-color);
        word-break: break-all;
        text-align: right;
      }
      .mp-hint {
        margin-top: 0.75rem;
        padding: 0.65rem 0.8rem;
        border-radius: 10px;
        background: rgba(245, 158, 11, 0.12);
        color: #fbbf24;
        font-size: 0.85rem;
        font-weight: 600;
      }
      .st.ok {
        color: #34d399;
      }
      .st.bad {
        color: #f87171;
      }
      .st.wait {
        color: #fbbf24;
      }
      details {
        margin-top: 0.85rem;
      }
      summary {
        cursor: pointer;
        color: var(--text-color-secondary);
        font-size: 0.85rem;
      }
      pre {
        margin-top: 0.5rem;
        padding: 0.75rem;
        border-radius: 10px;
        background: var(--surface-section);
        color: var(--text-color);
        font-size: 0.75rem;
        max-height: 260px;
        overflow: auto;
      }
    `,
  ],
})
export class MpPointTestComponent implements OnDestroy {
  private readonly svc = inject(MpPointTestService);

  amount = 5;
  readonly intent = signal<any>(null);
  readonly intentId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /** Hay un cobro en curso en la terminal (OPEN/ON_TERMINAL). */
  readonly pending = computed(() => {
    const s = (this.intent()?.state || '').toUpperCase();
    return ['OPEN', 'ON_TERMINAL', 'IN_PROGRESS', 'PENDING'].includes(s);
  });

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private attempts = 0;

  charge(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    this.intent.set(null);
    this.intentId.set(null);
    this.stopPoll();

    this.svc.charge(Number(this.amount)).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.intent.set(res);
        const id = res?.id || res?.paymentIntentId;
        if (id) {
          this.intentId.set(id);
          this.startPoll();
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          err?.status === 409
            ? 'Ya hay un cobro pendiente en la terminal. Pásale la tarjeta o cancélalo; si no, espera unos minutos.'
            : this.msg(err),
        );
      },
    });
  }

  refresh(): void {
    const id = this.intentId();
    if (!id) return;
    this.svc.getIntent(id).subscribe({
      next: (res) => this.intent.set(res),
      error: (err) => this.error.set(this.msg(err)),
    });
  }

  cancel(): void {
    const id = this.intentId();
    if (!id) return;
    this.svc.cancelIntent(id).subscribe({
      next: (res) => {
        this.intent.set(res);
        // Mercado Pago tarda unos segundos en reflejar CANCELED; seguimos consultando.
        this.startPoll();
      },
      error: (err) => this.error.set(this.msg(err)),
    });
  }

  stateClass(state?: string): string {
    const v = (state || '').toUpperCase();
    if (['FINISHED', 'APPROVED', 'PROCESSED', 'PAID'].includes(v)) return 'st ok';
    if (['CANCELED', 'CANCELLED', 'REJECTED', 'ERROR', 'FAILED'].includes(v)) return 'st bad';
    if (['OPEN', 'ON_TERMINAL', 'PENDING', 'IN_PROGRESS'].includes(v)) return 'st wait';
    return 'st';
  }

  private startPoll(): void {
    this.stopPoll();
    this.attempts = 0;
    this.pollTimer = setInterval(() => {
      this.attempts++;
      const id = this.intentId();
      if (!id || this.attempts > 60) {
        this.stopPoll();
        return;
      }
      this.svc.getIntent(id).subscribe({
        next: (res) => {
          this.intent.set(res);
          const st = (res?.state || '').toUpperCase();
          if (st && st !== 'OPEN') this.stopPoll();
        },
        error: () => {
          /* silencioso durante el polling */
        },
      });
    }, 4000);
  }

  private stopPoll(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private msg(err: any): string {
    return err?.error?.message || err?.message || 'Error inesperado';
  }

  ngOnDestroy(): void {
    this.stopPoll();
  }
}
