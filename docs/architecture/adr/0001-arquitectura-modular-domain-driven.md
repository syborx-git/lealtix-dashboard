# ADR-0001: Adopción de Arquitectura Frontend Modular por Dominios (Core, Features, Shared)

* **Estatus**: Aceptado
* **Autores**: Equipo de Arquitectura de Lealtix
* **Fecha**: 2026-08-20

## Contexto y Formulación del Problema

`lealtix-dashboard` creció con una estructura basada en componentes planos dentro de `src/app/pages/`, mezclando servicios compartidos (`src/app/pages/service`) y modelos (`src/app/pages/model`) con páginas individuales. Al crecer el número de módulos (Clientes, Campañas, Comandix, Redención), esta disposición dificulta la delimitación de límites de contexto (Bounded Contexts), desacoplamiento y escalabilidad.

## Decisión Tomada

Adoptar una **Arquitectura Frontend Modular Clean / Domain-Driven Design (DDD)** estructurada en tres capas principales:

1. **`src/app/core/`**:
   - Servicios transversales de infraestructura (HTTP Client Wrappers, Interceptors, Guards, Auth, API endpoints globales).
   - Singleton Services (`providedIn: 'root'`).
2. **`src/app/features/` (o subdominios organizados bajo `pages/` en migración ref-safe)**:
   - Módulos/vistas aislados por dominio de negocio (ej. `clientes`, `campañas`, `comandix`, `user-management`).
   - Cada feature contiene sus componentes de presentación, sus propios sub-servicios y modelos locales.
3. **`src/app/shared/`**:
   - Componentes UI presentacionales puros (UI Kit, dialogs reusable, pipes, directivas).
   - Sin dependencias de servicios de infraestructura específicos de un dominio.

### Consecuencias

* **Positivas**:
  * Delimitación clara de responsabilidades entre infraestructura (`core`), negocio (`features`) y presentación reutilizable (`shared`).
  * Facilidad para pruebas unitarias aisladas.
  * Facilita la carga perezosa (*Lazy Loading*) por dominio.
* **Negativas / Mitigación**:
  * Transición gradual requerida. Se usará el patrón Facade/Adapter en `pages/service/customer.service.ts` para no romper llamadas existentes mientras se migran las importaciones.
