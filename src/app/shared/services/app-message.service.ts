import { Injectable } from '@angular/core';
import { MessageService, ToastMessageOptions } from 'primeng/api';

/**
 * Servicio de notificaciones extendido de PrimeNG MessageService.
 * Garantiza que solo se muestre la notificación más reciente en pantalla
 * y evita que se apilen unas debajo de otras, optimizando el espacio
 * en pantallas pequeñas y tablets POS.
 */
@Injectable({ providedIn: 'root' })
export class AppMessageService extends MessageService {
  override add(message: ToastMessageOptions): void {
    if (message) {
      // Limpia la notificación anterior para mostrar únicamente la más actual
      this.clear(message.key);
      super.add(message);
    }
  }

  override addAll(messages: ToastMessageOptions[]): void {
    if (messages && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      this.clear(lastMessage?.key);
      super.add(lastMessage);
    }
  }
}
