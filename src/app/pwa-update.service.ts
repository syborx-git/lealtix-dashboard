import { Injectable } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';

/**
 * Auto-actualización de la PWA.
 *
 * Sin esto, el service worker (ngsw) sigue sirviendo la versión cacheada hasta
 * que el usuario cierre TODAS las pestañas, por lo que los nuevos deploys
 * "no se ven" en producción aunque ya estén desplegados.
 *
 * Aquí: cuando hay una versión lista (VERSION_READY) la activamos y recargamos
 * automáticamente; además revisamos cada 3 minutos.
 */
@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
    constructor(private swUpdate: SwUpdate) {
        if (!this.swUpdate.isEnabled) {
            return;
        }

        this.swUpdate.versionUpdates
            .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
            .subscribe(async () => {
                try {
                    await this.swUpdate.activateUpdate();
                } catch {
                    // ignore
                } finally {
                    document.location.reload();
                }
            });

        // Buscar actualizaciones cada 3 minutos (y al volver a la pestaña)
        setInterval(() => this.swUpdate.checkForUpdate().catch(() => {}), 3 * 60 * 1000);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.swUpdate.checkForUpdate().catch(() => {});
            }
        });
    }
}
