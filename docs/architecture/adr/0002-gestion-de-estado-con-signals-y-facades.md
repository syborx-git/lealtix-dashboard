# ADR-0002: Gestión de Estado Reactivo con Angular Signals y Patrón Facade

* **Estatus**: Aceptado
* **Autores**: Equipo de Arquitectura de Lealtix
* **Fecha**: 2026-08-20

## Contexto y Formulación del Problema

El proyecto requiere manejar estado reactivo complejo (filtros de clientes, estado de pedidos en tiempo real en Comandix, balances de puntos y carritos de premios) con alto rendimiento. Integrar NgRx/Redux introduce una alta sobrecarga (*boilerplate*) de Actions, Reducers y Effects para un frontend de tableros operativos.

## Decisión Tomada

Adoptar **Angular Signals** en combinación con el **Patrón Facade**:

1. **Signals (`signal`, `computed`, `effect`)**: Manejo de estado reactivo sincrónico y fino en componentes e inyectables.
2. **RxJS**: Se reserva para operaciones asincrónicas puras, streams de red HTTP, debounce de búsquedas y WebSockets/SSE.
3. **Services / Facades de Estado por Dominio**:
   - Cada módulo de dominio expone su estado como un conjunto de `Signal` de solo lectura (`asReadonly()`), permitiendo a los componentes suscribirse visualmente sin mutar el estado directamente.

### Consecuencias

* **Positivas**:
  * Código limpio, de alta lecturabilidad y libre de suscripciones manuales o memoria desbordada (`unsubscribe()`).
  * Integración nativa con la estrategia de detección de cambios de Angular 20 (ChangeDetectionStrategy.OnPush / Zoneless-ready).
  * Rendimiento de renderizado óptimo.
* **Negativas**:
  * Coexistencia temporal con código legado basado en Promises y Arrays planos mientras se refactorizan las pantallas secundarias.
