import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class KitchenNotificationService {
    private readonly NOTIFICATION_SOUND = 'assets/sounds/dragon-studio-correct-472358.mp3';

    playNewOrderSound(times = 1, delayMs = 500): void {
        for (let index = 0; index < times; index++) {
            setTimeout(() => {
                try {
                    const audio = new Audio(this.NOTIFICATION_SOUND);
                    void audio.play().catch(() => undefined);
                } catch {
                    // Archivo ausente o bloqueo de autoplay; no interrumpir la UI.
                }
            }, index * delayMs);
        }
    }
}
