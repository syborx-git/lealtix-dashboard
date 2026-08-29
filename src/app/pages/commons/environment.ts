// ==============================================================================
// CONFIGURACIÓN DE ENTORNOS DE LA APLICACIÓN
// ==============================================================================
// 📌 AQUÍ CAMBIAS LA URL DE TU BACKEND (BE) CUANDO ESTÉ LISTO:
// Modifica la propiedad 'apiUrl' reemplazando 'http://localhost:8080/api'
// por la URL pública o local de tu servidor Backend (ej. 'https://api.tudominio.com/api').
// ==============================================================================

export const environment = {
  production: true,
  /** URL Base del Backend local (Spring Boot / API Service) */
  apiUrl: 'http://localhost:8080/api',
  landingPageBaseUrl: 'http://localhost:4200/landing-page',
  kitchenMockEnabled: false
};
