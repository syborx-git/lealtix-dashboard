import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { environment } from '@/pages/commons/environment';

/**
 * Estructura del evento de nueva orden que llega del backend SSE
 */
export interface SseNewOrderEvent {
  type: 'new-order';
  tenantId: number;
  timestamp: string;
  meta: {
    origin: string; // ej: "CHATBOT"
  };
  order: {
    id: string;
    tenantId: number;
    customerId: number;
    customerName?: string; // NUEVO: nombre del cliente para mostrar
    estado: string; // ej: "PENDIENTE"
    source: string; // ej: "CHATBOT"
    subtotal: number; // NUEVO: monto antes del descuento
    descuento: number; // NUEVO: monto del descuento aplicado
    total: number; // NUEVO: total final (subtotal - descuento)
    items: Array<{
      productId?: number;
      productName?: string;
      prod?: string;
      cantidad: number;
      precioUnitario: number;
      comentarios?: string;
    }>;
    couponCode?: string; // NUEVO: código del cupón aplicado
    couponId?: string; // NUEVO: ID del cupón para redención
    couponDiscount?: number; // NUEVO: monto del descuento por cupón
    fecha: string; // ISO 8601
  };
}

/**
 * Servicio para manejar las notificaciones SSE (Server-Sent Events) de órdenes
 * del backend CHATBOT. Maneja reconexión automática con backoff fijo de 3s.
 */
@Injectable({
  providedIn: 'root'
})
export class OrderSseService implements OnDestroy {
  private eventSource: EventSource | null = null;
  private newOrderSubject = new Subject<SseNewOrderEvent>();
  private connectionStatusSubject = new Subject<'connected' | 'disconnected' | 'error'>();
  private errorMessageSubject = new Subject<string>();

  private readonly SSE_ENDPOINT = `${environment.apiUrl}/sse/orders`;
  private readonly RECONNECT_DELAY_MS = 3000; // Backoff fijo de 3 segundos
  private readonly MAX_RECONNECT_ATTEMPTS = 5; // Máximo 5 reintentos
  private reconnectAttempts = 0;
  private tenantIdForReconnect = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  newOrder$ = this.newOrderSubject.asObservable();
  connectionStatus$ = this.connectionStatusSubject.asObservable();
  errorMessage$ = this.errorMessageSubject.asObservable();

  ngOnDestroy(): void {
    this.disconnect();
  }

  /**
   * Inicia la conexión SSE para un tenant específico
   * @param tenantId ID del tenant a monitorear
   */
  connect(tenantId: number): void {
    if (this.eventSource !== null) {
      console.warn('[OrderSSE] Conexión ya activa, desconectando primero...');
      this.disconnect();
    }

    if (tenantId <= 0) {
      console.warn('[OrderSSE] TenantId inválido, no se inicia SSE');
      this.connectionStatusSubject.next('error');
      this.errorMessageSubject.next('Tenant ID inválido');
      return;
    }

    this.tenantIdForReconnect = tenantId;
    const url = `${this.SSE_ENDPOINT}?tenantId=${tenantId}`;

    console.log('[OrderSSE] Conectando a', url);

    try {
      this.eventSource = new EventSource(url);
      this.reconnectAttempts = 0;

      // ==================== Evento: Conexión confirmada ====================
      // Solo informativo, no mostrar al usuario
      this.eventSource.addEventListener('connected', (event: MessageEvent) => {
        try {
          console.debug('[OrderSSE] Evento "connected" recibido (ignorado)');
          // No emitir nada, solo logging
        } catch (error) {
          console.error('[OrderSSE] Error procesando evento connected:', error);
        }
      });

      // ==================== Evento: Nueva orden ====================
      // CRÍTICO: Este es el único evento relevante para el negocio
      this.eventSource.addEventListener('new-order', (event: MessageEvent) => {
        try {
          const sseEvent: SseNewOrderEvent = JSON.parse(event.data);
          console.log('[OrderSSE] Nueva orden recibida:', {
            orderId: sseEvent.order.id,
            origin: sseEvent.meta.origin,
            total: sseEvent.order.total
          });
          this.newOrderSubject.next(sseEvent);
        } catch (error) {
          console.error('[OrderSSE] Error al parsear evento new-order:', error);
        }
      });

      // ==================== Evento: Heartbeat ====================
      // Mantener viva la conexión, no mostrar nada
      this.eventSource.addEventListener('ping', (event: MessageEvent) => {
        console.debug('[OrderSSE] Heartbeat recibido');
      });

      // ==================== Ciclo de vida de la conexión ====================

      this.eventSource.onopen = () => {
        console.log('[OrderSSE] ✓ Conexión abierta exitosamente');
        this.connectionStatusSubject.next('connected');
        this.reconnectAttempts = 0;
      };

      this.eventSource.onerror = () => {
        const readyState = this.eventSource?.readyState;
        console.error('[OrderSSE] ✗ Error en conexión SSE (readyState:', readyState, ')');

        // Cerrar la conexión
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }

        // Intentar reconectar
        this.connectionStatusSubject.next('error');
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('[OrderSSE] ✗ Error al crear EventSource:', error);
      this.connectionStatusSubject.next('error');
      this.errorMessageSubject.next('Sin conexión en tiempo real');
      this.attemptReconnect();
    }
  }

  /**
   * Desconecta la conexión SSE
   */
  disconnect(): void {
    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.eventSource !== null) {
      console.log('[OrderSSE] Desconectando...');
      this.eventSource.close();
      this.eventSource = null;
      this.connectionStatusSubject.next('disconnected');
    }
  }

  /**
   * Intenta reconectar con backoff fijo de 3 segundos
   * Máximo 5 reintentos, después desiste
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      const message =
        'No se pudo conectar a las notificaciones en tiempo real después de ' +
        this.MAX_RECONNECT_ATTEMPTS +
        ' intentos. Por favor recarga la página.';
      console.error('[OrderSSE] ✗', message);
      this.errorMessageSubject.next('Sin conexión en tiempo real');
      return;
    }

    this.reconnectAttempts++;
    const nextAttempt = this.reconnectAttempts;

    console.warn(
      '[OrderSSE] Reintentando conexión en 3s... (intento ' +
      nextAttempt +
      '/' +
      this.MAX_RECONNECT_ATTEMPTS +
      ')'
    );

    this.reconnectTimeout = setTimeout(() => {
      console.log('[OrderSSE] Realizando reintento de conexión #' + nextAttempt);
      this.connect(this.tenantIdForReconnect);
    }, this.RECONNECT_DELAY_MS);
  }

  /**
   * Verifica si hay una conexión SSE activa
   */
  isConnected(): boolean {
    return this.eventSource !== null && this.eventSource.readyState === EventSource.OPEN;
  }

  /**
   * Obtiene el número de reintentos realizados
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }
}
