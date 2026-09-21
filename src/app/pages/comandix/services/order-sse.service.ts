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
 * del backend CHATBOT. Usa la reconexión automática nativa de EventSource
 * (el navegador reintenta indefinidamente), sin límite de intentos.
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
  private reconnectAttempts = 0;
  private tenantIdForReconnect = 0;

  newOrder$ = this.newOrderSubject.asObservable();
  connectionStatus$ = this.connectionStatusSubject.asObservable();
  errorMessage$ = this.errorMessageSubject.asObservable();

  ngOnDestroy(): void {
    this.disconnect();
  }

  /**
   * Inicia la conexión SSE para un tenant específico.
   * Si ya hay una conexión abierta/conectando para el mismo tenant, no duplica.
   */
  connect(tenantId: number): void {
    if (tenantId <= 0) {
      console.warn('[OrderSSE] TenantId inválido, no se inicia SSE');
      this.connectionStatusSubject.next('error');
      this.errorMessageSubject.next('Tenant ID inválido');
      return;
    }

    // Ya conectado o reconectando al mismo tenant: no duplicar
    if (this.eventSource && this.tenantIdForReconnect === tenantId &&
        (this.eventSource.readyState === EventSource.OPEN || this.eventSource.readyState === EventSource.CONNECTING)) {
      console.log('[OrderSSE] Conexión ya activa para tenant', tenantId);
      return;
    }

    // Limpiar cualquier conexión previa (de otro tenant o ya cerrada)
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.tenantIdForReconnect = tenantId;
    const url = `${this.SSE_ENDPOINT}?tenantId=${tenantId}`;
    console.log('[OrderSSE] Conectando a', url);

    try {
      const es = new EventSource(url);
      this.eventSource = es;
      this.reconnectAttempts = 0;

      // ==================== Evento: Conexión confirmada ====================
      es.addEventListener('connected', (event: MessageEvent) => {
        try {
          console.debug('[OrderSSE] Evento "connected" recibido (ignorado)');
        } catch (error) {
          console.error('[OrderSSE] Error procesando evento connected:', error);
        }
      });

      // ==================== Evento: Nueva orden ====================
      es.addEventListener('new-order', (event: MessageEvent) => {
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
      es.addEventListener('ping', (event: MessageEvent) => {
        console.debug('[OrderSSE] Heartbeat recibido');
      });

      // ==================== Ciclo de vida de la conexión ====================
      es.onopen = () => {
        console.log('[OrderSSE] ✓ Conexión abierta exitosamente');
        this.reconnectAttempts = 0;
        this.connectionStatusSubject.next('connected');
      };

      // Reconexión automática NATIVA del navegador: EventSource reintenta solo
      // e indefinidamente. NO cerramos manualmente; solo informamos del estado.
      es.onerror = () => {
        const state = es.readyState;
        if (state === EventSource.CLOSED) {
          console.error('[OrderSSE] Conexión SSE cerrada');
          this.connectionStatusSubject.next('disconnected');
        } else {
          // readyState === CONNECTING: el navegador está reintentando por su cuenta
          this.reconnectAttempts++;
          console.warn('[OrderSSE] Reconexión automática del navegador (intento ' + this.reconnectAttempts + ')');
          this.connectionStatusSubject.next('disconnected');
        }
      };
    } catch (error) {
      console.error('[OrderSSE] ✗ Error al crear EventSource:', error);
      this.connectionStatusSubject.next('error');
      this.errorMessageSubject.next('Sin conexión en tiempo real');
    }
  }

  /**
   * Desconecta la conexión SSE (cierre explícito, p.ej. al salir de la página)
   */
  disconnect(): void {
    if (this.eventSource !== null) {
      console.log('[OrderSSE] Desconectando...');
      this.eventSource.close();
      this.eventSource = null;
      this.connectionStatusSubject.next('disconnected');
    }
  }

  /**
   * Verifica si hay una conexión SSE activa
   */
  isConnected(): boolean {
    return this.eventSource !== null && this.eventSource.readyState === EventSource.OPEN;
  }

  /**
   * Obtiene el número de reconexiones realizadas
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }
}
