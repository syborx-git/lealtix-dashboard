// ==============================================================================
// CONFIGURACIÓN DE ENTORNOS DE LA APLICACIÓN
// ==============================================================================
// 📌 AQUÍ CAMBIAS LA URL DE TU BACKEND (BE) CUANDO ESTÉ LISTO:
// Modifica la propiedad 'apiUrl' reemplazando 'http://localhost:8080/api'
// por la URL pública o local de tu servidor Backend (ej. 'https://api.tudominio.com/api').
// ==============================================================================

const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';

export const environment = {
  production: false,
  /** URL Base del Backend (dinámica: se adapta a localhost o a la IP local de la máquina en red) */
  apiUrl: `http://${host}:8080/api`,
  landingPageBaseUrl: `http://${host}:4200/landing-page`,
  kitchenMockEnabled: false
};
