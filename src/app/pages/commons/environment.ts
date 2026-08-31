// ==============================================================================
// CONFIGURACIÓN DE ENTORNOS DE LA APLICACIÓN
// ==============================================================================
// 📌 AQUÍ CAMBIAS LA URL DE TU BACKEND (BE) CUANDO ESTÉ LISTO:
// Modifica la propiedad 'apiUrl' reemplazando 'http://localhost:8080/api'
// por la URL pública o local de tu servidor Backend (ej. 'https://api.tudominio.com/api').
// ==============================================================================

export const environment = {
  production: true,
  /** URL Base del Backend (Spring Boot / API Service) — Servidor Hetzner */
  apiUrl: 'http://5.161.82.24:8082/api',
  landingPageBaseUrl: 'http://5.161.82.24:3000/landing-page',
  kitchenMockEnabled: false
};
