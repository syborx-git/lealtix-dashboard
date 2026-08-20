# Architecture Decision Records (ADR) - Lealtix Dashboard

Este repositorio contiene el registro formal de las decisiones arquitectónicas clave tomadas en el desarrollo y mantenimiento del frontend de **Lealtix Dashboard**.

## Estructura de un ADR

Cada ADR sigue una estructura basada en el estándar MADR (Markdown Architectural Decision Records):
1. **Título y Metadatos** (Estado, Fecha, Autores).
2. **Contexto y Problema**.
3. **Opciones Consideradas**.
4. **Decisión Tomada**.
5. **Consecuencias** (Positivas y Negativas / Riesgos).

## Registro de Decisiones

| ID | Título | Estado | Fecha | Impacto Principal |
|---|---|---|---|---|
| [ADR-0000](./0000-plantilla-adr.md) | Plantilla Estándar para Architecture Decision Records | Aceptado | 2026-08-20 | Estandarización de documentación |
| [ADR-0001](./0001-arquitectura-modular-domain-driven.md) | Adopción de Arquitectura Frontend Modular por Dominios (Core, Features, Shared) | Aceptado | 2026-08-20 | Escalabilidad y desacoplamiento de modulos |
| [ADR-0002](./0002-gestion-de-estado-con-signals-y-facades.md) | Gestión de Estado Reactivo con Angular Signals y Patrón Facade | Aceptado | 2026-08-20 | Reactividad moderna sin sobrecarga de NgRx |
| [ADR-0003](./0003-descomposicion-srp-servicios-monoliticos.md) | Refactorización y Descomposición SRP de Servicios Monolíticos ("God Services") | Aceptado | 2026-08-20 | Mantenibilidad, testabilidad y principio SRP |
| [ADR-0004](./0004-estandarizacion-ui-primeng-tailwind.md) | Estandarización del Sistema de Diseño UI con PrimeNG 20 y TailwindCSS v4 | Aceptado | 2026-08-20 | Consistencia visual y rendimiento |
| [ADR-0005](./0005-metricas-calidad-y-trazabilidad-sdd-l4-l5.md) | Implementación de Control Cuantitativo y Trazabilidad (CMMI Nivel 4 y 5) | Aceptado | 2026-08-20 | Calidad continua y gobernanza de código |
