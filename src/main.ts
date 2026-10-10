import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app.config';
import { AppComponent } from './app.component';
import { environment } from './app/pages/commons/environment';

// En local/dev no debe haber Service Worker (PWA). Si quedó uno instalado de un
// build de producción anterior servido en el mismo host, se limpia para evitar
// que sirva assets viejos (lo que deja la app "cargando" indefinidamente).
if (!environment.production && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((regs) => regs.forEach((r) => r.unregister()))
    .catch(() => {});
  if (typeof caches !== 'undefined') {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
  }
}

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
