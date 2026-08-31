// ==============================================================================
// CONFIGURACIÓN DE ENTORNOS DE LA APLICACIÓN
// ==============================================================================
// 📌 AQUÍ CAMBIAS LA URL DE TU BACKEND (BE) CUANDO ESTÉ LISTO:
// Modifica la propiedad 'apiUrl' reemplazando 'http://localhost:8080/api'
// por la URL pública o local de tu servidor Backend (ej. 'https://api.tudominio.com/api').
// ==============================================================================

export const environment = {
  production: true,
  /** URL Base del Backend en Producción (HTTPS) */
  apiUrl: 'https://api.lealtix.com.mx/api',
  landingPageBaseUrl: 'https://lealtix.com.mx/landing-page',
  kitchenMockEnabled: false
};
