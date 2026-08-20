# ADR-0004: Estandarización del Sistema de Diseño UI con PrimeNG 20 y TailwindCSS v4

* **Estatus**: Aceptado
* **Autores**: Equipo de Arquitectura de Lealtix
* **Fecha**: 2026-08-20

## Contexto y Formulación del Problema

Lealtix Dashboard utiliza PrimeNG v20 y TailwindCSS v4 (`@tailwindcss/postcss`). Para asegurar una experiencia visual estéticamente destacada, moderna y consistente en todos los módulos (Dark/Light mode, tablas interactivas, dashboards y comanderas) se requiere una directriz clara que evite estilos inline desordenados o CSS disperso.

## Decisión Tomada

1. **Uso de PrimeNG 20 como Base Component**:
   - Tablas paginadas, diálogos, selectores de fecha, dropdowns y menús contextuales provienen directamente de `@primeng` y `@primeuix/themes`.
2. **Utilidades TailwindCSS v4 para Layout y Animaciones**:
   - Spacing, Grids, Flexbox, Micro-animaciones (transitions, hovers, glassmorphism) se aplican mediante clases utilitarias de Tailwind.
3. **Encapsulamiento en Shared UI Kit**:
   - Wrappers personalizados de componentes complejos deben colocarse en `src/app/shared/components/` para no duplicar código en las vistas de páginas.

### Consecuencias

* **Positivas**:
  * Experiencia visual fluida y consistente en toda la plataforma.
  * Mantenimiento centralizado de temas y colores institucionales.
  * Código HTML de componentes limpio y expresivo.
