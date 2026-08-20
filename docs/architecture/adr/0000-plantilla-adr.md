# ADR-0000: Plantilla Estándar para Architecture Decision Records

* **Estatus**: Aceptado
* **Autores**: Equipo de Arquitectura de Lealtix
* **Fecha**: 2026-08-20
* **Decisores**: Arquitecto Lead, Tech Lead Frontend

## Contexto y Formulación del Problema

Para mantener la coherencia y evolución del proyecto **Lealtix Dashboard** a medida que escala en funcionalidades y miembros del equipo, es indispensable documentar las decisiones arquitectónicas significativas. La falta de registro de decisiones pasadas provoca re-discusiones innecesarias, pérdida de visión arquitectónica y erosión de la calidad del código (deuda técnica incontrolada).

## Drivers de la Decisión

* Necesidad de trazabilidad en decisiones de diseño técnico.
* Facilitar el onboarding de desarrolladores.
* Transparencia y alineación entre frontend, backend y negocio.

## Opciones Consideradas

1. **Documentación Informal (Wiki/Notion diseminada)**: Flexible pero propensa a volverse obsoleta y desconectada del código.
2. **ADR Formato Nygard / MADR (Markdown colocalizado en repositorio)**: Directamente vinculado con el código fuente en `docs/architecture/adr/`, rastreable con Git.

## Decisión Tomada

Adoptar el formato **MADR (Markdown Architectural Decision Records)** integrado en la carpeta `docs/architecture/adr/` de la raíz del proyecto.

### Consecuencias

* **Positivas**:
  * Las decisiones evolucionan junto al código mediante Pull Requests.
  * Trazabilidad directa de cambios arquitectónicos vía control de versiones Git.
* **Negativas**:
  * Requiere disciplina de equipo para escribir un ADR antes de realizar cambios estructurales mayores.
