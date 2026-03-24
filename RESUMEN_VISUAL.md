# 📊 Resumen Visual - Sistema de Permisos Implementado

## ✅ TODO COMPLETADO Y SIN ERRORES

```
✅ AuthService     - Permisos + Roles + Token
✅ PermissionGuard - Protección de rutas
✅ AuthInterceptor - Bearer token automático
✅ AdminService    - Gestión de permisos
✅ Component Admin  - UI moderna para permisos
✅ LoginComponent  - Con soporte a tenantId
✅ App Config      - Interceptores registrados
✅ App Routes      - PermissionGuard agregado
✅ Documentación   - Guías completas
✅ Sin errores     - ✓ Compila perfectamente
```

---

## 📈 Arquitetura Implementada

```
┌─────────────────────────────────────────────────┐
│                 FRONTEND (ANGULAR)              │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌────────────────────────────────────────┐    │
│  │  COMPONENTES                            │    │
│  │  • Login                                │    │
│  │  • Dashboard                            │    │
│  │  • Admin Roles & Permisos               │    │
│  │  • [Otras páginas protegidas]           │    │
│  └────────────────────────────────────────┘    │
│           ↑                ↑                    │
│           │                │                    │
│  ┌────────┴────────┐  ┌────┴─────────────┐     │
│  │  PermissionGuard│  │ AuthService      │     │
│  │  -Valida rutas  │  │ -Permisos        │     │
│  │  -Permisos      │  │ -Rol             │     │
│  │  -Redirije      │  │ -Token           │     │
│  └────────┬────────┘  └────┬─────────────┘     │
│           │                │                    │
│           └────────┬───────┘                    │
│                    │                            │
│           ┌────────▼─────────┐                  │
│           │ AuthInterceptor   │                 │
│           │ • Bearer token    │                 │
│           │ • X-Tenant-Id     │                 │
│           │ • 401 handling    │                 │
│           │ • 403 handling    │                 │
│           └────────┬──────────┘                 │
│                    │                            │
/// ─ ─ ─ ─ HTTP REQUESTS ─ ─ ─ ─ ///            │
│                    │                            │
└────────────────────┼──────────────────────────┘
                     │
                     │ HTTPS
                     │ Authorization: Bearer <token>
                     │ X-Tenant-Id: 24
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│                  BACKEND (NODE/EXPRESS)        │
├─────────────────────────────────────────────────┤
│                                                 │
│  POST /api/tenant/auth/login                    │
│  ├─ Valida credenciales                         │
│  ├─ Genera JWT token                            │
│  ├─ Obtiene permisos del rol                    │
│  └─ Retorna { user, permissions, token }       │
│                                                 │
│  GET/POST /api/admin/roles/:role/permissions   │
│  ├─ Valida ADMIN                                │
│  ├─ Gestiona permisos por rol                   │
│  └─ Persiste en BD                              │
│                                                 │
│  [Endpoints protegidos]                         │
│  ├─ Valida JWT token (401)                      │
│  ├─ Valida permisos (403)                       │
│  └─ Procesa request                             │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 🔄 Flujo Completo de Login

```
PASO 1: Usuario abre login
        ↓
PASO 2: Ingresa Tenant ID (24), Email, Password
        ↓
PASO 3: POST /api/tenant/auth/login
        ↓
PASO 4: Backend valida credenciales
        ├─ ✅ Válidas → Genera JWT
        │               Obtiene permisos del rol
        │               Retorna { user, permissions, token }
        │
        └─ ❌ Inválidas → Error 401
                         Muestra toast error
                         Permanece en login
        ↓
PASO 5: AuthService.loginAndStore()
        ├─ Guarda token → localStorage.accessToken
        ├─ Guarda usuario → localStorage.currentUser
        └─ Guarda permisos → localStorage.permissions
        ↓
PASO 6: Redirige a /dashboard/kpis
        ↓
PASO 7: Todas las solicitudes futuras incluyen:
        Authorization: Bearer <token>
        X-Tenant-Id: 24
```

---

## 🛡️ Flujo de Protección de Ruta

```
Usuario intenta navegar a: /dashboard/campaigns

         ↓

Router detecta ruta con:
canActivate: [PermissionGuardClass]
data: { permission: 'view_campaigns' }

         ↓

PermissionGuard ejecuta:

┌─ ¿Token válido?
│  ├─ NO → AuthGuard redirige a login
│  └─ SÍ → Continuar
│
├─ ¿Rol = ADMIN?
│  ├─ SÍ → ✅ PERMITIR (ADMIN tiene todos)
│  └─ NO → Continuar
│
├─ ¿authService.hasPermission('view_campaigns')?
│  ├─ SÍ → ✅ PERMITIR (Usuario tiene permiso)
│  └─ NO → ❌ DENEGAR
│         → Toast: "No tienes permiso..."
│         → Redirige a /dashboard/kpis
│
└─ Navega a componente o muestra error

```

---

## 🔐 Flujo de Solicitud HTTP Protegida

```
Componente: this.http.get('/api/orders')

         ↓

AuthInterceptor.intercept():

┌─ Obtiene: authService.getToken()
│           authService.getTenantId()
│
├─ Clona request y agrega:
│  ├─ Header: Authorization: Bearer <token>
│  ├─ Header: X-Tenant-Id: <tenantId>
│  └─ Param: ?tenantId=<tenantId> (si no existe)
│
└─ Envía request al Backend

         ↓

Backend recibe:
GET /api/orders?tenantId=24
Headers: Authorization: Bearer <token>, X-Tenant-Id: 24

         ↓

Backend valida:
├─ ¿Token válido?
│  ├─ NO → 401 Unauthorized
│
├─ ¿Usuario tiene permiso para 'view_orders'?
│  ├─ NO → 403 Forbidden
│
└─ SÍ → 200 OK + datos

         ↓

AuthInterceptor.catchError():
├─ Si 401 → authService.logout() → Redirige a login
├─ Si 403 → Muestra toast error
└─ Si 200 → Procesa datos normalmente
```

---

## 📋 Permisos por Rol - Estructura

```
ADMIN (Todos los permisos automáticos)
├─ manage_*      (Gestión del sistema)
├─ create_*      (Crear cualquier cosa)
├─ edit_*        (Editar cualquier cosa)
├─ delete_*      (Eliminar cualquier cosa)
└─ view_*        (Ver cualquier cosa)

MESERO
├─ view_menu
├─ view_customers
├─ create_customer
├─ create_order
├─ edit_order
├─ view_orders
├─ process_payment
├─ apply_discount
├─ process_redemption
├─ view_redemptions
└─ query_coupons

COCINA
├─ view_menu (read-only)
├─ view_pending_orders
├─ update_order_status
└─ view_order_details
```

---

## 🎯 Cómo Proteger una Nueva Ruta

### Paso 1: Identificar el permiso

```typescript
// Ej: Crear campaña necesita 'create_campaign'
const requiredPermission = 'create_campaign';
```

### Paso 2: Agregar a rutas

```typescript
// En app.routes.ts

{
  path: 'campaigns/create',
  component: CreateCampaignComponent,
  canActivate: [PermissionGuardClass],  // ← Guard
  data: { permission: 'create_campaign' } // ← Permiso requerido
}
```

### Paso 3: Optional - Actualizar UI

```typescript
// En componente
export class ToolbarComponent {
  canCreateCampaign = this.authService.hasPermission('create_campaign');
  
  constructor(private authService: AuthService) {}
}
```

```html
<!-- En template -->
<button *ngIf="canCreateCampaign" routerLink="/dashboard/campaigns/create">
  Nueva Campaña
</button>
```

**RESULT:**
- ✅ Si usuario tiene permiso → Acceso + botón visible
- ❌ Si no tiene permiso → Redirige + botón oculto

---

## 🖥️ Pantalla Admin Roles & Permisos

### Ubicación
```
/dashboard/admin/roles-permissions
Requiere: rol = ADMIN
Permiso: manage_roles
```

### Funcionalidades

```
┌─────────────────────────────────┐
│  ADMIN - Roles & Permisos        │
├─────────────────────────────────┤
│                                 │
│  Seleccionar Rol:               │
│  ┌──────────┬──────────┬──────┐ │
│  │ 🔐 ADMIN │ 👤 MESERO│ 🔥 COC│
│  └──────────┴──────────┴──────┘ │
│                                 │
│  Permisos por Recurso:          │
│  ┌─────────────────────────┐   │
│  │ ✓ Menú (4/4)            │   │
│  │  □ ver_menú             │   │
│  │  □ editar_menú          │   │
│  │  □ crear_producto       │   │
│  │  □ eliminar_producto    │   │
│  │                         │   │
│  │ ○ Órdenes (0/5)        │   │
│  │  □ ver_órdenes         │   │
│  │  □ crear_orden         │   │
│  │  □ editar_orden        │   │
│  │  □ pagar_orden         │   │
│  │  □ cancelar_orden      │   │
│  └─────────────────────────┘   │
│                                 │
│  Estadísticas:                  │
│  • Total Permisos: 24          │
│  • Asignados: 9                │
│                                 │
│  [Descartar] [Guardar Permisos]│
└─────────────────────────────────┘
```

---

## 💾 Almacenamiento de Datos

### localStorage

```javascript
// Token JWT
localStorage.accessToken
  → "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

// Usuario actual
localStorage.currentUser
  → {
      id: 1,
      nombre: "Juan Pérez",
      email: "juan@lealtix.com",
      rol: "MESERO",
      tenantId: 24
    }

// Permisos del usuario
localStorage.permissions
  → [
      "view_menu",
      "create_order",
      "edit_order",
      "process_payment",
      ...
    ]

// Tenant ID para próximo login
localStorage.lastTenantId
  → "24"
```

---

## 📊 Request/Response Example

### LOGIN REQUEST

```bash
POST /api/tenant/auth/login
Content-Type: application/json

{
  "tenantId": 24,
  "email": "mesero@lealtix.com",
  "password": "password123"
}
```

### LOGIN RESPONSE

```json
{
  "code": 200,
  "message": "Login exitoso",
  "data": {
    "user": {
      "id": 5,
      "nombre": "Carlos Mesero",
      "nombre_usuario": "carlos",
      "email": "mesero@lealtix.com",
      "rol": "MESERO",
      "tenantId": 24
    },
    "permissions": [
      "view_menu",
      "view_customers",
      "create_customer",
      "create_order",
      "edit_order",
      "view_orders",
      "process_payment",
      "apply_discount",
      "process_redemption",
      "view_redemptions",
      "query_coupons"
    ],
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### PROTECTED REQUEST

```bash
GET /api/orders?tenantId=24
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
X-Tenant-Id: 24
```

### PROTECTED RESPONSE

```json
{
  "code": 200,
  "message": "Success",
  "data": [
    {
      "id": 101,
      "numorden": "#001",
      "cliente": "Juan",
      "total": 150.00,
      "estado": "pendiente"
    }
  ]
}
```

---

## 🚨 Códigos de Error

```
200 OK
└─ Solicitud exitosa

401 UNAUTHORIZED
├─ Causa: Token inválido o expirado
├─ Action: AuthInterceptor → Logout → Redirige a login
└─ Response: { code: 401, message: "Token inválido" }

403 FORBIDDEN
├─ Causa: Usuario no tiene permiso
├─ Action: Muestra toast error
└─ Response: { code: 403, message: "No tienes permiso" }

400 BAD REQUEST
├─ Causa: Datos inválidos
└─ Response: { code: 400, message: "..." }

500 INTERNAL SERVER ERROR
├─ Causa: Error del servidor
└─ Response: { code: 500, message: "..." }
```

---

## 🧪 Checklist de Verificación

```
ANTES DE USAR:

□ Backend devuelve { token, user, permissions } en login
□ Permisos están configurados en BD del Backend
□ PermissionGuard está en app.routes.ts
□ AuthInterceptor está en app.config.ts
□ localStorage no tiene datos viejos (limpiar si es necesario)

TESTING:

□ Login funciona y guarda token
□ Token aparece en headers HTTP (DevTools Network)
□ Rutas protegidas redirigen si no hay permiso
□ Admin puede acceder a /dashboard/admin/roles-permissions
□ Cambios de permisos se persisten
□ Logout limpia localStorage

SEGURIDAD:

□ Token solo se envía a endpoints autenticados
□ 401 hace logout automático
□ 403 muestra error sin exponer información
□ tenantId se valida en Backend
□ ADMIN bypass funciona correctamente
```

---

## 🎓 Casos de Uso Reales

### Caso 1: Mostrar solo si es MESERO

```typescript
if (this.authService.getUserRole() === 'MESERO') {
  // Mostrar panel de mesero
}
```

### Caso 2: Múltiples permisos (ANY)

```typescript
if (this.authService.hasAnyPermission(['create_order', 'process_payment'])) {
  // Mostrar si tiene uno u otro
}
```

### Caso 3: Múltiples permisos (ALL)

```typescript
if (this.authService.hasAllPermissions(['create_order', 'process_payment'])) {
  // Mostrar solo si tiene ambos
}
```

### Caso 4: Reaccionar a cambios

```typescript
this.authService.getPermissions$().pipe(
  tap(perms => console.log('Permisos actualizados:', perms))
).subscribe();
```

---

## 📚 Archivos de Referencia

| Archivo | Descripción | Ubicación |
|---------|-------------|-----------|
| INICIO_RAPIDO.md | Este documento | Raíz |
| GUIA_SISTEMA_PERMISOS.md | Guía detallada | Raíz |
| IMPLEMENTACION_PERMISOS_CHECKLIST.md | Checklist | Raíz |
| auth.service.ts | Lógica principal | src/app/auth/ |
| permission.guard.ts | Protección rutas | src/app/auth/ |
| auth.interceptor.ts | HTTP Bearer | src/app/interceptors/ |
| admin-permission.service.ts | Admin API | src/app/auth/ |
| AdminRolesPermissions* | Componente UI | src/app/pages/admin-roles-permissions/ |

---

## ✨ Resumen Rápido

```
✅ LOGIN
  → Tenant ID + Email + Password
  → JWT token guardado
  → Permisos guardados

✅ PROTECCIÓN DE RUTAS
  → PermissionGuard en rutas
  → Valida permisos automáticamente
  → Redirige si no tiene acceso

✅ HTTP SEGURO
  → AuthInterceptor agrega Bearer token
  → Maneja 401/403 automáticamente
  → X-Tenant-Id en todos los requests

✅ ADMIN INTERFACE
  → /dashboard/admin/roles-permissions
  → Gestión visual de permisos
  → Toggle de permisos por rol

✅ UI CONDICIONAL
  → Mostrar/ocultar según permisos
  → Validación en componentes
  → Observables reactivos

✅ SEGURIDAD
  → Token en localStorage
  → Validación en Backend
  → Logout automático si expira
```

---

**¡Sistema completamente implementado y listo para usar!** 🚀

Para más detalles, consulta los otros documentos de documentación.
