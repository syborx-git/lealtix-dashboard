const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';

export const environment = {
    production: false,
    apiUrl: `http://${host}:8080/api`,
    landingPageBaseUrl: `http://${host}:4200/landing-page`,
    kitchenMockEnabled: true
};
