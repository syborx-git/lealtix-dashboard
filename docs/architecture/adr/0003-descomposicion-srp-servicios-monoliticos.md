# ADR-0003: Refactorización y Descomposición SRP de Servicios Monolíticos ("God Services")

* **Estatus**: Aceptado
* **Autores**: Equipo de Arquitectura de Lealtix
* **Fecha**: 2026-08-20

## Contexto y Formulación del Problema

El servicio [`src/app/pages/service/customer.service.ts`](file:///c:/Users/kike2/OneDrive/Escritorio/Lealtix/workspace/FE/lealtix-dashboard/src/app/pages/service/customer.service.ts) acumuló ~284 KB de código con más de 9,000 líneas mezclando lógica de simulación mock, consultas HTTP de clientes, datos de premios, campañas y utilidades. Esto viola flagrantemente el **Single Responsibility Principle (SRP)** de SOLID.

## Decisión Tomada

Descomponer el servicio monolítico mediante el patrón de **Refactorización en Capas Ref-Safe**:

1. **Creación de Sub-servicios Especializados en `src/app/core/services/`**:
   - `CustomerApiService`: Operaciones sobre clientes/fidelizados.
   - `CampaignApiService`: Gestión de campañas de incentivos.
   - `RedemptionApiService`: Redenciones de puntos e historial.
   - `RewardApiService`: Catálogo de premios.
2. **Transformación del `CustomerService` original en un Facade de Transición**:
   - La clase `CustomerService` mantendrá sus firmas de métodos públicas originales (`getCustomers`, `getCustomersLarge`, etc.) delegando internamente el trabajo a los sub-servicios especializados de `core/services/`.

### Consecuencias

* **Positivas**:
  * Cumplimiento del principio SRP y SOLID.
  * Cero breaking changes en los componentes que actualmente inyectan `CustomerService`.
  * Reducción dramática del riesgo de regresiones durante despliegues.
  * Facilidad para añadir pruebas unitarias a los servicios desacoplados.
