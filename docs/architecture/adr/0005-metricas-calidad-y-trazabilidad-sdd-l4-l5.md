# ADR-0005: Implementación de Control Cuantitativo y Trazabilidad (CMMI Nivel 4 y 5)

* **Estatus**: Aceptado
* **Autores**: Equipo de Arquitectura de Lealtix
* **Fecha**: 2026-08-20

## Contexto y Formulación del Problema

Para alcanzar un nivel de madurez CMMI 4 (Gestión Cuantitativa) y CMMI 5 (Optimización Continua), el proyecto debe ir más allá de la documentación pasiva e incorporar métricas observables, presupuestos de rendimiento y trazabilidad total entre requerimientos, código y pruebas.

## Decisión Tomada

1. **Implementación de Gobernanza Cuantitativa (Nivel 4)**:
   - Cobertura de pruebas unitarias $\ge 80\%$ en servicios y facades.
   - Complejidad Ciclomática máxima $v(G) \le 10$ por función.
   - Límite de tamaño de bundle inicial gzipped $\le 250\text{ KB}$.
   - Matriz de Trazabilidad formal en `docs/architecture/sdd/06-matriz-de-trazabilidad.md`.
2. **Optimizaciones de Mejora Continua (Nivel 5)**:
   - Verificación de límites de arquitectura con reglas linter personalizadas.
   - Proceso automatizado de refactorización continua sin romper contratos API mediante Facades.

### Consecuencias

* **Positivas**:
  * Control predictivo sobre la calidad técnica de cada entregable.
  * Trazabilidad directa de cualquier falla o requerimiento de negocio hasta el código exacto y sus tests.
  * Reducción sistemática de deuda técnica.
