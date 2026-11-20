// Detección dinámica de host (localhost o IP de red local para pruebas en celulares/tablets)
const isBrowser = typeof window !== 'undefined';
const host = isBrowser && window.location.hostname ? window.location.hostname : 'localhost';

export const environment = {
  production: false,
  /** URL Base del Backend local (Spring Boot / API Service) */
  apiUrl: `http://${host}:8080/api`,
  landingPageBaseUrl: `http://${host}:4200/landing-page`,
  kitchenMockEnabled: false
};
