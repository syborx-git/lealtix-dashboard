# Resumen de Implementación - Sistema de Permisos & Roles

## ✅ Checklist de Implementación Completada

### Autenticación y Permisos
- ✅ **AuthService** - Actualizado para manejar permisos + roles + JWT token
- ✅ **PermissionGuard** - Nuevo guard para proteger rutas por permiso
- ✅ **AdminPermissionService** - Servicio para gestionar permisos en Admin
- ✅ **AuthInterceptor** - Nuevo interceptor que agrega Bearer token + maneja 401/403
- ✅ **Password Authentication** - Passwords enviados en plaintext al backend

### Componentes y Rutas
- ✅ **LoginComponent** - Actualizado para soportar hashing de password
- ✅ **AdminRolesPermissionsComponent** - Nuevo componente UI moderna para admin
  - Selección de roles (ADMIN, MESERO, COCINA)
  - Gestión de permisos por roles
  - Agrupación de permisos por recurso
  - Interfaz con toggle one-click para agregar/quitar permisos
  - Búsqueda y estadísticas
  - Toast de confirmación antes de guardar

### Configuración Angular
- ✅ **app.config.ts** - Registrados todos los interceptores
- ✅ **app.routes.ts** - Agregada ruta de admin + PermissionGuard en rutas sensibles
- ✅ **Importaciones** - Todo correctamente importado en standalone mode

### Documentación
- ✅ **GUIA_SISTEMA_PERMISOS.md** - Documentación completa de uso
- ✅ **Este documento** - Checklist e instrucciones finales

## Próximos Pasos

⚠️ **PASO CRÍTICO:** Ejecuta `npm install` para sincronizar dependencias (removidas bcryptjs)

Consulta [NEXT_STEPS.md](NEXT_STEPS.md) para instrucciones completas de testing y deployment.

---

### 1. Login

```
URL: http://localhost:8080/api/tenant/auth/login

Campos (Solo 2):
- Email: usuario@example.com
- Contraseña: xxxxxx
- Recuérdame: [checkbox]

Ejemplo:
- Email: nesedo2586@gxuzi.com
- Password: 123qwe...
```

**Flujo de Login:**
1. Usuario ingresa Email + Contraseña
2. FrontEnd envía: `POST /api/tenant/auth/login { email, password }` (plaintext)
3. Backend valida credenciales y responde: `{ code: 200, message: "...", object: { accessToken, userEmail, userId, permissions } }`
4. FrontEnd guarda automáticamente:
   - `localStorage.accessToken` (JWT token)
   - `localStorage.currentUser` (información del usuario actual)
   - `localStorage.permissions` (array de permisos del usuario)
5. AuthInterceptor usa accessToken para agregar header `Authorization: Bearer <token>` en requests

**Respuesta exitosa:**
```json
{
  "code": 200,
  "message": "Login exitoso",
  "object": {
    "accessToken": "eyJhbGc...",
    "userEmail": "nesedo2586@gxuzi.com",
    "userId": 38,
    "permissions": []
  }
}
```

**Respuesta error:**
```json
{
  "code": 401,
  "message": "Usuario no encontrado",
  "object": null
}
```

### 2. Gestionar Permisos (Admin Only)

```
URL: http://localhost:puerto/dashboard/admin/roles-permissions

Función:
1. Selecciona un rol (ADMIN, MESERO, COCINA)
2. Ve los permisos disponibles (agrupados por recurso)
3. Toggle permisos individuales o por grupos
4. Presiona "Guardar Permisos"
5. Confirma en dialog
6. Los cambios se aplican inmediatamente en Backend

Nota: ADMIN no puede tener permisos removidos (siempre total acceso)
```

### 3. Proteger Rutas

En `app.routes.ts`, agregue `PermissionGuard` a rutas:

```typescript
{
  path: 'campaigns',
  component: CampaignListComponent,
  canActivate: [PermissionGuardClass],
  data: { permission: 'view_campaigns' }  // Permiso requerido
}
```

### 4. Usar en Componentes

**Template:**
```html
<!-- Mostrar/ocultar según permiso -->
<button *ngIf="authService.hasPermission('edit_campaign')">
  Editar
</button>

<!-- Cambiar contenido según rol -->
<div *ngIf="(authService.getUserRole$ | async) === 'ADMIN'">
  Panel de Administrador
</div>
```

**TypeScript:**
```typescript
export class MiComponente {
  constructor(private authService: AuthService) {}

  canEdit(): boolean {
    return this.authService.hasPermission('edit_campaign');
  }

  get user$() {
    return this.authService.getCurrentUser$();
  }
}
```

---

## 🔍 Verificación de Funcionamiento

### Test 1: Login con diferentes usuarios

```
✓ Login como ADMIN
  - Debería ver todos los permisos
  - Debería tener acceso a /dashboard/admin/roles-permissions
  
✓ Login como MESERO
  - Debería tener permisos limitados
  - NO debería ver /dashboard/admin/roles-permissions
  
✓ Login como COCINA
  - Debería tener permisos de cocina únicamente
  - NO debería acceder a órdenes/comanda del mesero
```

### Test 2: Verificar Storage

```typescript
// En DevTools Console:

// Ver token
localStorage.getItem('accessToken')
// Debe mostrar: "eyJhbGc..." (JWT token)

// Ver usuario
JSON.parse(localStorage.getItem('currentUser'))
// Debe mostrar: { id, nombre, email, rol, tenantId }

// Ver permisos
JSON.parse(localStorage.getItem('permissions'))
// Debe mostrar: ["view_menu", "create_order", ...]
```

### Test 3: Verificar Headers HTTP

```
En DevTools → Network tab:

1. Cualquier solicitud HTTP autenticada debe tener:
   - Header: Authorization: Bearer <accessToken>

2. Si 401 → Debe redirigir a login
3. Si 403 → Debe mostrar toast de error
```

### Test 4: Cambiar Permisos

```
1. Login como ADMIN
2. Ir a /dashboard/admin/roles-permissions
3. Seleccionar rol MESERO
4. Desmarcar permiso "create_order"
5. Guardar
6. Login como MESERO
7. Verificar que NO puede crear órdenes
8. Regresar a admin y restaurar permiso
```

---

## 📋 Permisos Disponibles para Proteger Rutas

Ver lista completa en `ANALISIS_PERMISOS_ROLES.md`

### Permisos Comunes Implementados

```
ADMIN
├── view_users
├── create_user
├── edit_user
├── delete_user
└── manage_roles

CAMPAIGNS
├── view_campaigns
├── create_campaign
├── edit_campaign
├── delete_campaign
└── view_templates

CUSTOMERS
├── view_customers
├── create_customer
├── edit_customer
└── delete_customer

MENU/PRODUCTS
├── view_menu
├── view_products
├── create_product
├── edit_product
└── delete_product

COMANDA/POS
├── create_order
├── view_orders
├── edit_order
├── process_payment
└── apply_discount

KITCHEN
├── view_pending_orders
├── update_order_status
└── view_order_details

REDEMPTIONS
├── process_redemption
├── query_coupons
├── view_redemptions
└── view_coupon_status
```

---

## 🚨 Problemas Comunes y Soluciones

### ❌ "No tienes permiso para acceder a esta sección"

**Causa:** Usuario no tiene el permiso requerido
**Solución:**
1. Login como ADMIN
2. Ir a /dashboard/admin/roles-permissions
3. Asignar el permiso al rol del usuario
4. Usuario debe hacer login nuevamente
5. O llamar: `authService.refreshPermissions()`

### ❌ Token no se envía en requests

**Causa:** AuthInterceptor no está registrado
**Solución:**
- Verificar que app.config.ts tenga el interceptor registrado
- Rebootear la app (ng serve)

### ❌ No veo el botón de Admin Roles

**Causa:**
1. No eres ADMIN
2. No tienes el permiso `manage_roles`
3. La ruta no existe

**Solución:**
- Verificar rol: `authService.getUserRole()`
- Verificar permiso: `authService.hasPermission('manage_roles')`
- Navegar directamente: `/dashboard/admin/roles-permissions`

### ❌ 401 Unauthorized en múltiples requests

**Causa:** Token expirado o inválido
**Solución:**
- AuthInterceptor debería logout automáticamente
- Vérifica que el interceptor esté interceptando requests
- Limpia localStorage y haz login nuevamente

---

## 📦 Archivos Importantes

| Archivo | Cambios | Propósito |
|---------|---------|----------|
| `src/app/auth/auth.service.ts` | ✏️ Actualizado | Gestión usuario + permisos + token |
| `src/app/auth/permission.guard.ts` | ✨ NUEVO | Protege rutas por permiso |
| `src/app/auth/admin-permission.service.ts` | ✨ NUEVO | API admin para permisos |
| `src/app/interceptors/auth.interceptor.ts` | ✨ NUEVO | Agrega Bearer token |
| `src/app/auth/login/login.component.ts` | ✏️ Actualizado | Soporta tenantId |
| `src/app/auth/login/login.component.html` | ✏️ Actualizado | Campo tenantId |
| `src/app/pages/admin-roles-permissions/` | ✨ NUEVO | Componente admin UI |
| `src/app.config.ts` | ✏️ Actualizado | Registra interceptores |
| `src/app.routes.ts` | ✏️ Actualizado | Agrega ruta + PermissionGuard |

---

## 🔄 Flujo de Integración con Backend

### Login

```
Usuario → FrontEnd (login)
    ↓
POST /api/tenant/auth/login
{ email, password }
    ↓
Backend ↓
Valida credenciales
Genera JWT
Obtiene permisos del usuario
    ↓
Respuesta 200:
{ code: 200, message: "Login exitoso", object: { accessToken, userEmail, userId, permissions } }
    ↓
FrontEnd ↓
AuthService.loginAndStore()
Guarda en localStorage
Redirige a dashboard
```

### Solicitud Protegida

```
Componente → this.http.get('/api/orders')
    ↓
AuthInterceptor ↓
Agrega: Authorization: Bearer <accessToken>
    ↓
POST /api/orders
    ↓
Backend ↓
Valida token (401 si expiró)
Valida permisos (403 si no tiene)
Retorna datos si OK (200)
    ↓
FrontEnd ↓
Si 401 → Logout + Redirige a login
Si 403 → Toast error
Si 200 → Procesa datos
```

---

## 🎓 Ejemplos de Uso Avanzado

### Validar múltiples permisos

```typescript
// Verificar que tenga ALGUNO de estos permisos
if (this.authService.hasAnyPermission(['edit_campaign', 'edit_product'])) {
  // Mostrar botón de edición
}

// Verificar que tenga TODOS estos permisos
if (this.authService.hasAllPermissions(['create_order', 'process_payment'])) {
  // Permitir procesamiento completo
}

// ADMIN siempre pasa
if (this.authService.getUserRole() === 'ADMIN') {
  // Acceso admin completo
}
```

### Reaccionar a cambios de permisos

```typescript
export class MiComponente implements OnInit {
  permisos$ = this.authService.getPermissions$().pipe(
    tap(perms => console.log('Permisos actualizados:', perms)),
    map(perms => ({
      puedeVerCampañas: perms.includes('view_campaigns'),
      puedeCreatear: perms.includes('create_campaign'),
      puedeEliminar: perms.includes('delete_campaign')
    }))
  );

  constructor(private authService: AuthService) {}
}
```

### Refrescar permisos después de cambios admin

```typescript
// En Admin component, después de guardar permisos:
this.adminService.assignPermissionsToRole('MESERO', permIds).subscribe(() => {
  // Notificar a usuarios conectados
  // O forzar que refresquen:
  this.authService.refreshPermissions().subscribe(() => {
    this.messageService.add({
      severity: 'success',
      summary: 'Permisos Actualizados'
    });
  });
});
```

---

## 📞 Soporte Técnico

### Preguntas Frecuentes

**P: ¿Cómo agrego un nuevo permiso?**
A: 
1. Agregarlo en Backend (tabla permissions)
2. Asignarlo a roles en Backend
3. Usarlo en rutas con PermissionGuard
4. O validar en componentes con authService.hasPermission()

**P: ¿Qué pasa si token expira?**
A: AuthInterceptor intercepta 401 → Logout → Redirige a login

**P: ¿Puedo tener permisos por usuario además de rol?**
A: Sí, pero requiere cambios en Backend (tabla user_custom_permissions)

**P: ¿Se pueden exportar/importar permisos?**
A: Actualmente no, pero se puede agregar en Admin UI

---

## 🚀 Deploy a Producción

### Checklist Pre-Deploy

- [ ] Todos los tests pasando
- [ ] Token usando HttpOnly cookies (no localStorage)
- [ ] HTTPS habilitado
- [ ] CORS configurado correctamente
- [ ] Backend compartiendo el mismo secret para JWT
- [ ] Rate limiting en login endpoint
- [ ] Audit logging habilitado
- [ ] Monitoreo de 401/403 errors
- [ ] Base de datos de permisos respaldada

---

**Creado:** Marzo 2026
**Versión:** 1.0
**Última Actualización:** [Hoy]
**Estado:** ✅ IMPLEMENTADO Y LISTO PARA USAR
