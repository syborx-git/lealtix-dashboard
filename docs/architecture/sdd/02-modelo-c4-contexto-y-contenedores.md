# SDD - Capítulo 2: Modelo C4 - Diagramas de Contexto (L1) y Contenedores (L2)

## 2.1 C4 Nivel 1: Diagrama de Contexto del Sistema

El diagrama de contexto ubica a **Lealtix Dashboard** en relación con sus usuarios finales y sistemas externos (Backend APIs, Servicios de Correo/Notificaciones, Pasarelas de Pago).

```mermaid
graph TD
    UserAdmin["Administrador de Comercio / Tenant"] -->|Administra clientes, campañas y reportes| Dash["Lealtix Dashboard (Frontend Angular 20)"]
    UserStaff["Mesero / Operador (Comandix)"] -->|Gestiona comandas y redenciones| Dash
    
    Dash -->|REST APIs HTTP / JSON / Auth Bearer JWT| BackendAPI["Lealtix Backend Services (Spring Boot / REST)"]
    Dash -->|Hojas de Cálculo / CSV| FileStorage["Sistema de Archivos Local (Import/Export XLSX)"]
    BackendAPI -->|Persistencia| DB[("Base de Datos Lealtix")]
```

---

## 2.2 C4 Nivel 2: Diagrama de Contenedores

Este diagrama detalla cómo la aplicación Single Page Application (SPA) interactúa con el servidor de contenido estático y las dependencias de ejecución.

```mermaid
graph TB
    subgraph Browser["Navegador Web del Cliente"]
        SPA["Lealtix Dashboard SPA (Angular 20 Standalone)"]
    end

    subgraph Hosting["Infraestructura de Despliegue"]
        Nginx["Nginx Web Server / Container Docker"]
    end

    subgraph CloudBackend["Servicios Cloud Backend"]
        API["Tenant Customer API (/tenant-customers)"]
        AuthService["Auth & Session API (/auth)"]
        CampaignAPI["Campaigns API (/campaigns)"]
    end

    Nginx -->|Sirve bundles JS / CSS / Assets| SPA
    SPA -->|HTTPS REST JSON| API
    SPA -->|HTTPS REST JSON| AuthService
    SPA -->|HTTPS REST JSON| CampaignAPI
```

### Protocolos e Interfaces de Contenedor
- **SPA $\rightarrow$ Nginx**: HTTP/2 en puerto 80/443 (Gzip/Brotli compresión de assets).
- **SPA $\rightarrow$ REST APIs**: HTTP/HTTPS con payloads JSON y encabezado `Authorization: Bearer <JWT>`.
