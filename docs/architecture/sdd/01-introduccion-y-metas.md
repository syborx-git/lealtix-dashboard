# SDD - Capítulo 1: Introducción, Propósito y Metas del Sistema

## 1.1 Propósito del Documento

Este documento de Especificación del Diseño de Software (**Software Design Description - SDD**) describe formalmente la arquitectura técnica, descomposición de módulos, patrones de diseño y controles cuantitativos de calidad del sistema **Lealtix Dashboard**.

El diseño está alineado con los estándares **IEEE 1016-2009**, el **Modelo C4** y los niveles de madurez **CMMI 4 (Gestión Cuantitativa)** y **CMMI 5 (Optimización Continua)**.

---

## 1.2 Alcance del Sistema Lealtix Dashboard

**Lealtix Dashboard** es la consola web administrativa y operativa para la plataforma de fidelización y gestión de clientes de Lealtix. Sus funcionalidades principales incluyen:

1. **Gestión de Clientes y Fidelización**: Consulta, registro individual y carga masiva CSV/XLSX de clientes, seguimiento de saldos de puntos y niveles de lealtad.
2. **Campañas e Incentivos**: Configuración y monitoreo de reglas de acumulación y promociones.
3. **Comandix y Cocina (Kitchen/Waiter)**: Control de comandas en tiempo real para negocios gastronómicos/retail integrados.
4. **Redención de Premios**: Canje manual de puntos por premios y recompensas en punto de venta.
5. **Administración y Permisos**: Control de roles, permisos, usuarios administradores y parámetros de tenant.

---

## 1.3 Drivers Arquitectónicos y Metas Técnicas

| Categoría | Meta / Driver | Mecanismo de Arquitectura |
|---|---|---|
| **Escalabilidad** | Soporte para crecimiento modular por subdominios | Arquitectura Domain-Driven (Core, Features, Shared) |
| **Mantenibilidad** | Alta cohesión y bajo acoplamiento | Principios SOLID, Descomposición SRP de servicios |
| **Rendimiento** | Renderizado reactivo a 60 FPS sin fugas de memoria | Angular Signals + RxJS + PrimeNG 20 |
| **Calidad L4/L5** | Control predictivo de fallas y pruebas continuas | Matriz de Trazabilidad, CI/CD Gates, Karma Coverage $\ge 80\%$ |
