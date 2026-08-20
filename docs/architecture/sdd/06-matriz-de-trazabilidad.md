# SDD - Capítulo 6: Matriz de Trazabilidad (Requirements Traceability Matrix - RTM)

## 6.1 Matriz de Trazabilidad Requisito $\rightarrow$ Componente $\rightarrow$ Test

La Matriz de Trazabilidad garantiza que cada requerimiento funcional de negocio esté respaldado por módulos de arquitectura y suites de pruebas unitarias/E2E observables.

| ID Req | Descripciones del Requerimiento Funcional | Módulo / Componentes Frontend | Servicios de Dominio (Core) | Suite de Pruebas Unitarias |
|---|---|---|---|---|
| **REQ-CLI-01** | Consulta paginada y filtrado de clientes por tenant | `clientes/components/` | `CustomerApiService` | `customer-api.service.spec.ts` |
| **REQ-CLI-02** | Registro y edición individual de datos de cliente | `clientes/components/` | `CustomerApiService` | `customer-api.service.spec.ts` |
| **REQ-CLI-03** | Carga masiva de clientes mediante CSV/XLSX | `clientes/components/` | `ClienteService` | `cliente.service.spec.ts` |
| **REQ-CAM-01** | Visualización y gestión de campañas promocionales | `campaigns/` | `CampaignApiService` | `campaign-api.service.spec.ts` |
| **REQ-RED-01** | Redención manual de premios e incentivos de clientes | `manual-redemption/`, `redeem/` | `RedemptionApiService` | `redemption-api.service.spec.ts` |
| **REQ-KITCH-01**| Tablero comanderas y pedidos de cocina en tiempo real | `kitchen/`, `waiter/` | `ComandixApiService` | `comandix-api.service.spec.ts` |
| **REQ-AUTH-01** | Autenticación JWT y control de acceso por Roles | `auth/`, `interceptors/` | `AuthInterceptor` | `auth.interceptor.spec.ts` |
