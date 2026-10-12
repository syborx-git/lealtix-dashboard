import { Injectable, computed, inject, signal } from '@angular/core';
import { MessageService } from 'primeng/api';

export type NotificationGroup = 'order' | 'stock' | 'system';

export interface AppNotification {
  id: string;
  type: string;                 // 'new-order' | 'order-status' | 'stock-low' | 'stock-out' | ...
  group: NotificationGroup;
  title: string;
  message: string;
  icon: string;                 // clase de primeicons, p.ej. 'pi-shopping-bag'
  severity: 'success' | 'info' | 'warn' | 'error';
  ts: number;
  read: boolean;
  route?: string;               // ruta a la que navega al hacer clic
}

interface AddOptions {
  sound?: boolean;
  toast?: boolean;
  browser?: boolean;            // muestra notificación nativa del navegador
  dedupeKey?: string;
}

const STORAGE_KEY = 'lealtix-notifications';
const MAX_ITEMS = 60;
const NOTIFICATION_SOUND = 'assets/sounds/dragon-studio-correct-472358.mp3';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly messageService = inject(MessageService);
  private readonly seenKeys = new Set<string>();

  readonly panelOpen = signal(false);
  readonly notifications = signal<AppNotification[]>([]);
  readonly unreadCount = computed(() => this.notifications().filter((n) => !n.read).length);

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Agrega una notificación. Devuelve la notificación creada o null si se
   * descartó por dedupe (para no repetir la misma alerta, p.ej. stock).
   */
  add(
    n: Omit<AppNotification, 'id' | 'ts' | 'read'>,
    opts: AddOptions = {}
  ): AppNotification | null {
    if (opts.dedupeKey) {
      if (this.seenKeys.has(opts.dedupeKey)) return null;
      this.seenKeys.add(opts.dedupeKey);
    }

    const notif: AppNotification = {
      ...n,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      read: false
    };

    this.notifications.update((list) => [notif, ...list].slice(0, MAX_ITEMS));
    this.persist();

    if (opts.toast !== false) {
      this.messageService.add({
        severity: notif.severity,
        summary: notif.title,
        detail: notif.message,
        life: 5000
      });
    }
    if (opts.sound) {
      this.playSound();
    }
    if (opts.browser) {
      this.showBrowserNotification(notif);
    }
    return notif;
  }

  /** Pide permiso para notificaciones nativas del navegador (una sola vez). */
  ensureBrowserPermission(): void {
    try {
      if (typeof Notification === 'undefined') return;
      if (Notification.permission === 'default') {
        void Notification.requestPermission();
      }
    } catch {
      // no soportado
    }
  }

  private showBrowserNotification(n: AppNotification): void {
    try {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      const native = new Notification(n.title, {
        body: n.message,
        tag: n.type,
        icon: 'favicon.ico'
      });
      native.onclick = () => {
        try {
          window.focus();
          if (n.route) {
            window.location.href = n.route;
          }
        } catch {
          // noop
        }
        native.close();
      };
    } catch {
      // no soportado o bloqueado
    }
  }

  /** Limpia una clave de dedupe (p.ej. cuando el stock se recupera). */
  clearDedupe(key: string): void {
    this.seenKeys.delete(key);
  }

  markRead(id: string): void {
    this.notifications.update((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
    this.persist();
  }

  markAllRead(): void {
    this.notifications.update((list) => list.map((n) => ({ ...n, read: true })));
    this.persist();
  }

  remove(id: string): void {
    this.notifications.update((list) => list.filter((n) => n.id !== id));
    this.persist();
  }

  clear(): void {
    this.notifications.set([]);
    this.persist();
  }

  togglePanel(): void {
    this.panelOpen.update((v) => !v);
    if (this.panelOpen()) {
      // pequeña espera para no marcar leídas antes de renderizar el panel
      setTimeout(() => this.markAllRead(), 800);
    }
  }

  closePanel(): void {
    this.panelOpen.set(false);
  }

  playSound(times = 1, delayMs = 450): void {
    for (let i = 0; i < times; i++) {
      setTimeout(() => {
        try {
          const audio = new Audio(NOTIFICATION_SOUND);
          void audio.play().catch(() => undefined);
        } catch {
          // autoplay bloqueado o archivo ausente
        }
      }, i * delayMs);
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.notifications()));
    } catch {
      // almacenamiento lleno o no disponible
    }
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const list = JSON.parse(raw) as AppNotification[];
      if (Array.isArray(list)) {
        this.notifications.set(list.slice(0, MAX_ITEMS));
      }
    } catch {
      // JSON corrupto: ignora
    }
  }
}
