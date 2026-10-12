import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app.config';
import { AppComponent } from './app.component';

// El panel YA NO usa Service Worker (PWA). Aquí limpiamos cualquier Service
// Worker / caché que haya quedado instalado de una versión anterior, para que
// el navegador siempre cargue la versión fresca (evita "app vieja cacheada").
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((regs) => regs.forEach((r) => r.unregister()))
    .catch(() => {});
  if (typeof caches !== 'undefined') {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
  }
}

// ============================================================================
// Auto-recuperación ante "chunk viejo" después de un deploy.
// Tras desplegar, el Service Worker (PWA) puede tener cacheada la app anterior
// y los chunks ya no existen con ese hash => el panel se queda "cargando".
// Al detectar ese error, limpiamos cachés y recargamos UNA vez para tomar la
// versión nueva.
// ============================================================================
const CHUNK_RECOVERY_KEY = 'lealtix-chunk-recovery';

function isChunkLoadError(message: string): boolean {
  return /Failed to fetch dynamically imported module|Loading chunk \d+ failed|ChunkLoadError|dynamically imported module/i.test(
    message || ''
  );
}

function recoverFromStaleChunk(): void {
  try {
    if (sessionStorage.getItem(CHUNK_RECOVERY_KEY) === '1') {
      return; // ya intentamos en esta sesión (evita loop)
    }
    sessionStorage.setItem(CHUNK_RECOVERY_KEY, '1');
  } catch {
    // sessionStorage no disponible: seguimos
  }

  if (typeof caches !== 'undefined') {
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .catch(() => {})
      .finally(() => location.reload());
    return;
  }
  location.reload();
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (isChunkLoadError((event as ErrorEvent)?.message || '')) {
      recoverFromStaleChunk();
    }
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason: any = (event as PromiseRejectionEvent)?.reason;
    const msg = typeof reason === 'string' ? reason : reason?.message || '';
    if (isChunkLoadError(msg)) {
      recoverFromStaleChunk();
    }
  });
}

bootstrapApplication(AppComponent, appConfig)
  .then(() => {
    try {
      sessionStorage.removeItem(CHUNK_RECOVERY_KEY);
    } catch {
      // ignore
    }
  })
  .catch((err) => console.error(err));
