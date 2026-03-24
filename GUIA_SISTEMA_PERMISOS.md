# Sistema de Permisos & Roles - Guía de Implementación

## Resumen Ejecutivo

Se ha implementado un sistema completo de gestión de permisos y roles en el Frontend Angular que:
- ✅ Integra con el Backend que devuelve JWT + lista de permisos en login
- ✅ Maneja 3 roles: ADMIN, MESERO, COCINA
- ✅ Protege rutas con `PermissionGuard`
- ✅ Valida permisos en el AuthService
- ✅ Incluye interceptor HTTP que agrega Bearer token automáticamente
- ✅ Proporciona pantalla administración de roles/permisos con UI moderna

## 📁 Estructura de Archivos Creados

```
src/app/auth/
├── auth.service.ts                 ← Actualizado: maneja permisos + roles
├── permission.guard.ts              ← NUEVO: Guard para proteger rutas
├── admin-permission.service.ts      ← NUEVO: Servicio API admin de permisos
└── login/
    ├── login.component.ts           ← Actualizado: soporta tenantId
    └── login.component.html         ← Actualizado: campo tenantId agregado

src/app/interceptors/
├── auth.interceptor.ts              ← NUEVO: Agrega Bearer token
├── error.interceptor.ts             ← Existente
└── loading.interceptor.ts           ← Existente

src/app/pages/admin-roles-permissions/
├── admin-roles-permissions.component.ts       ← NUEVO: Componente principal
├── admin-roles-permissions.component.html     ← NUEVO: Template
└── admin-roles-permissions.component.scss     ← NUEVO: Estilos

src/
└── app.config.ts                    ← Actualizado: registra interceptores
    app.routes.ts                    ← Actualizado: agrega ruta admin + PermissionGuard
```

## 🔑 Conceptos Clave

### 1. AuthService - Gestión de Autenticación y Permisos

**Métodos principales:**

```typescript
// Autenticación
authService.login(credentials)              // POST /api/tenant/auth/login
authService.loginAndStore(credentials)      // Login + guarda token + permisos
authService.logout()                        // Limpiar storage

// Usuario
authService.getCurrentUser()                // Obtener usuario as Object
authService.getCurrentUser$()               // Observable del usuario
authService.getTenantId()                   // ID del tenant del usuario
authService.getUserRole()                   // Rol: ADMIN | MESERO | COCINA

// Permisos
authService.getPermissions()                // Array de códigos de permisos
authService.getPermissions$()               // Observable de permisos
authService.hasPermission(code)             // Boolean: usuario tiene permiso?
authService.hasAnyPermission([...])         // Boolean: tiene ALGUNO de los permisos?
authService.hasAllPermissions([...])        // Boolean: tiene TODOS los permisos?
authService.refreshPermissions()            // Fuerza refresh desde BE
```

**Token:**

```typescript
authService.getToken()                      // Obtener JWT token actual
```

### 2. PermissionGuard - Protección de Rutas

**Uso en rutas:**

```typescript
{
  path: 'campaigns',
  component: CampaignListComponent,
  canActivate: [PermissionGuardClass],
  data: { permission: 'view_campaigns' }
}
```

El guard:
- Valida que el usuario tenga el permiso especificado
- ADMIN siempre tiene acceso (bypass)
- Redirige a `/dashboard/kpis` si no tiene permiso
- Muestra mensaje de error

### 3. AuthInterceptor - Token en Requests

**Agrega automáticamente a TODAS las solicitudes HTTP:**

```
Authorization: Bearer <token>
X-Tenant-Id: <tenantId>
```

**Maneja errores:**
- 401: Token expirado → Logout y redirige a login
- 403: Permiso denegado → Muestra mensaje de error

### 4. Admin Permissions Service - Gestión de Permisos

```typescript
// Obtener datos
adminService.getAllPermissions()            // GET /api/admin/permissions
adminService.getRolePermissions('MESERO')   // GET /api/admin/roles/MESERO/permissions
adminService.getRolePermissionCodes('MESERO') // GET /api/admin/roles/MESERO/permission-codes

// Actualizar
adminService.assignPermissionsToRole(
  'MESERO',
  [1, 2, 3],          // IDs de permisos
  true                // replace=true (reemplaza todos)
)
```

## 🎯 Casos de Uso Comunes

### Caso 1: Proteger una ruta por permiso

```typescript
// En app.routes.ts
{
  path: 'campaigns/create',
  component: CreateCampaignComponent,
  canActivate: [PermissionGuardClass],
  data: { permission: 'create_campaign' }
}
```

### Caso 2: Mostrar/ocultar botón según permiso

```typescript
// En componente
export class MyComponent {
  constructor(private authService: AuthService) {}

  canEditCampaign(): boolean {
    return this.authService.hasPermission('edit_campaign');
  }
}
```

```html
<!-- En template -->
<button *ngIf="canEditCampaign()" (click)="edit()">
  Editar
</button>
```

### Caso 3: Validar permisos en componente

```typescript
export class CampaignFormComponent implements OnInit {
  constructor(private authService: AuthService) {}

  ngOnInit() {
    // Verificar antes de cargar datos sensibles
    if (!this.authService.hasPermission('create_campaign')) {
      // Redirigir o mostrar error
      return;
    }

    this.loadCampaignData();
  }

  canDelete(): boolean {
    return this.authService.hasPermission('delete_campaign');
  }
}
```

### Caso 4: Cambiar contenido según rol

```typescript
export class DashboardComponent {
  userRole$ = this.authService.getCurrentUser$().pipe(
    map(user => user?.rol)
  );

  constructor(private authService: AuthService) {}
}
```

```html
<div [ngSwitch]="(userRole$ | async)">
  <div *ngSwitchCase="'ADMIN'">
    <!-- Vista para ADMIN -->
  </div>
  <div *ngSwitchCase="'MESERO'">
    <!-- Vista para MESERO -->
  </div>
  <div *ngSwitchCase="'COCINA'">
    <!-- Vista para COCINA -->
  </div>
</div>
```

### Caso 5: Admin gestiona permisos

```typescript
// En la pantalla de Admin Roles & Permisos (ya implementada)
// Ruta: /dashboard/admin/roles-permissions
// Permiso requerido: manage_roles
```

Navega a `/dashboard/admin/roles-permissions` para gestionar permisos.

## 🔐 Flujo de Seguridad

### Login

```
1. Usuario ingresa: Tenant ID, Email, Password
   ↓
2. POST /api/tenant/auth/login { tenantId, email, password }
   ↓
3. Backend valida y retorna:
   {
     "code": 200,
     "message": "Login exitoso",
     "data": {
       "user": { id, nombre, email, rol, tenantId },
       "permissions": ["view_menu", "create_order", ...],
       "token": "eyJhbGc..."
     }
   }
   ↓
4. AuthService.loginAndStore() guarda:
   - localStorage.accessToken
   - localStorage.currentUser
   - localStorage.permissions
   ↓
5. Redirige a dashboard
```

### Solicitud HTTP Protegida

```
1. Componente llama: this.http.get('/api/orders')
   ↓
2. AuthInterceptor intercepta:
   - Agrega header: Authorization: Bearer <token>
   - Agrega header: X-Tenant-Id: 24
   (automáticamente)
   ↓
3. Solicitud llega al Backend:
   GET /api/orders?tenantId=24
   Headers: Authorization: Bearer <token>, X-Tenant-Id: 24
   ↓
4. Backend valida token + permisos en el endpoint
   ↓
5. Respuesta 200 OK o 403 Forbidden
   Si 403 → Muestra mensaje de error
   Si 401 → AuthInterceptor → Logout + redirige a login
```

### Validación de Ruta

```
1. Usuario intenta acceder: /dashboard/campaigns/create
   ↓
2. Router carga ruta con canActivate: [PermissionGuardClass]
   ↓
3. PermissionGuardClass verifica:
   - ¿Token válido? (AuthGuard ya lo chequeó)
   - ¿Rol = ADMIN? → Permitir
   - ¿Tiene permiso 'create_campaign'? 
     - SI → Permitir acceso
     - NO → Denegar acceso + mensaje error
```

## 📊 Roles y Permisos Predefinidos

Ver [ANALISIS_PERMISOS_ROLES.md](../ANALISIS_PERMISOS_ROLES.md) para detalles completos.

### ADMIN
- Acceso total al sistema
- Todos los permisos automáticamente
- Puede gestionar roles y permisos

### MESERO
- Permisos: view_menu, create_order, edit_order, process_payment, process_redemption
- Acceso a comanda, órdenes, redenciones
- No acceso a configuración

### COCINA
- Permisos: view_pending_orders, update_order_status
- Solo ver órdenes pendientes
- Actualizar estado de órdenes

## 🧪 Testing del Sistema

### 1. Testear Login

```bash
# Usar credenciales de test:
Tenant ID: 24
Email: mesero@test.com
Password: <contraseña>
```

### 2. Testear Permisos en Ruta

```typescript
// En devtools console
localStorage.getItem('permissions')        // Ver permisos
localStorage.getItem('currentUser')        // Ver usuario
localStorage.getItem('accessToken')        // Ver token truncado
```

### 3. Testear Pantalla Admin

1. Login como ADMIN
2. Navega a `/dashboard/admin/roles-permissions`
3. Selecciona rol (MESERO, COCINA)
4. Toglea permisos
5. Guarda cambios
6. Verifica que otros usuarios refresquen sus permisos

### 4. Testear Refresh de Permisos

Después de cambiar permisos en Admin:

```typescript
// En cualquier componente:
this.authService.refreshPermissions().subscribe(perms => {
  console.log('Permisos refrescados:', perms);
});
```

## ⚠️ Consideraciones Importantes

### Seguridad

1. **Nunca confiar solo en el Frontend:**
   - El Backend SIEMPRE valida permisos
   - El Frontend solo es para UX (mostrar/ocultar)

2. **Token en localStorage:**
   - Preferir HttpOnly cookies en producción
   - Proteger contra XSS
   - Token con expiración

3. **Manejo de 401/403:**
   - 401: Token inválido → Forzar re-login
   - 403: Permiso denegado → Mostrar error

### Performance

1. **Permisos en cache:**
   - Se guardan en localStorage después del login
   - Minimiza llamadas al Backend

2. **Refresh de permisos:**
   - Solo cuando se cambian permisos en Admin
   - O después de logout + login

3. **Rutas protegidas:**
   - Se validan al navegar (no en tiempo de compilación)
   - Permitir ADMIN por defecto

## 🚀 Próximos Pasos Recomendados

### Fase 1: Integración Completa (YA HECHO)
- ✅ AuthService con permisos
- ✅ PermissionGuard en rutas
- ✅ AuthInterceptor con token
- ✅ Pantalla Admin Roles & Permisos

### Fase 2: Integración en Componentes
- [ ] Proteger todas las rutas sensibles con PermissionGuard
- [ ] Mostrar/ocultar opciones en menú según permisos
- [ ] Validar permisos antes de operaciones críticas (delete, edit)
- [ ] Agregar toasts de confirmación para acciones sensibles

### Fase 3: Mejoras Futuras
- [ ] Auditoria de quién cambió permisos y cuándo
- [ ] Permisos custom por usuario (además de rol)
- [ ] Exportar/importar configuración de permisos
- [ ] Dashboard de uso de permisos/auditoría

## 📞 Soporte y Debugging

### Problema: No veo pantalla de Admin Roles

**Solución:**
```
1. Verifica que seas ADMIN
2. Navega a /dashboard/admin/roles-permissions
3. Verifica en console: authService.hasPermission('manage_roles')
4. Verifica en Backend que el endpoint existe
```

### Problema: Permisos no se actualizan después de cambiarlos en Admin

**Solución:**
```
1. El usuario actual debe hacer refresh
2. O puedes forzar: authService.refreshPermissions()
3. Verifica que el Backend actualice la BD correctamente
```

### Problema: Token expira y el usuario sigue en la página

**Solución:**
```
1. AuthInterceptor debe interceptar 401
2. Llamar authService.logout()
3. Redirigir a /dashboard/auth/login
```

### Debug en Console

```typescript
// Acceder al servicio en console
import { AuthService } from 'app/auth/auth.service'
const auth = ng.getComponent($0).injector.get(AuthService)

// Ver estado actual
auth.getCurrentUser()
auth.getPermissions()
auth.getToken()
auth.hasPermission('view_campaigns')
```

## 📝 Notas Técnicas

### Estructura de Response del Backend

```json
{
  "code": 200,
  "message": "Login exitoso",
  "data": {
    "user": {
      "id": 1,
      "nombre": "Juan Pérez",
      "email": "juan@example.com",
      "rol": "MESERO",
      "tenantId": 24
    },
    "permissions": [
      "view_menu",
      "create_order",
      "edit_order",
      "process_payment",
      "process_redemption",
      "view_customers"
    ],
    "token": "eyJhbGciOiJIUzI1NiIsIn..."
  }
}
```

### Headers HTTP

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsIn...
X-Tenant-Id: 24
Content-Type: application/json
```

### Codigo de Permisos Soportados

Ver en [ANALISIS_PERMISOS_ROLES.md](../ANALISIS_PERMISOS_ROLES.md) sección "Catálogo de Permisos".

Ejemplos:
- `view_campaigns`
- `create_campaign`
- `edit_campaign`
- `delete_campaign`
- `view_orders`
- `create_order`
- `process_payment`
- `etc...`

---

**Última actualización:** Marzo 2026
**Versión:** 1.0
**Status:** ✅ Implementado
