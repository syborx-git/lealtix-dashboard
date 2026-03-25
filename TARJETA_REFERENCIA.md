# 🚀 Tarjeta de Referencia Rápida - Sistema de Permisos

## 🔐 AuthService - Métodos Principales

### Autenticación (SIN tenantId manual)
```typescript
// Login: Solo email + password
// Backend responde con tenantId en user
authService.loginAndStore({ email, password })
  .subscribe()

// El tenantId se obtiene automáticamente de:
// response.data.user.tenantId

// Logout
authService.logout()

// ¿Está autenticado?
authService.isAuthenticated() → boolean
```

### Usuario
```typescript
// Obtener snapshot
authService.getCurrentUser() → User | null
  // { id, nombre, email, rol, tenantId }

// Obtener observable
authService.getCurrentUser$() → Observable<User | null>

// Obtener rol
authService.getUserRole() → 'ADMIN' | 'MESERO' | 'COCINA' | null

// Obtener tenant ID
authService.getTenantId() → number
```

### Permisos
```typescript
// Obtener permisos (snapshot)
authService.getPermissions() → string[]

// Obtener permisos (observable)
authService.getPermissions$() → Observable<string[]>

// ¿Tiene permiso?
authService.hasPermission('view_campaigns') → boolean

// ¿Tiene ALGUNO?
authService.hasAnyPermission(['edit', 'create']) → boolean

// ¿Tiene TODOS?
authService.hasAllPermissions(['edit', 'delete']) → boolean

// Refrescar permisos
authService.refreshPermissions() → Observable<string[]>
```

### Token
```typescript
// Obtener token actual
authService.getToken() → string | null
```

---

## 🛡️ PermissionGuard - Uso en Rutas

### Sintaxis Básica
```typescript
{
  path: 'campaigns',
  component: CampaignListComponent,
  canActivate: [PermissionGuardClass],
  data: { permission: 'view_campaigns' }
}
```

### Múltiples Rutas
```typescript
const adminRoutes = [
  {
    path: 'users',
    component: UserListComponent,
    canActivate: [PermissionGuardClass],
    data: { permission: 'view_users' }
  },
  {
    path: 'users/create',
    component: UserCreateComponent,
    canActivate: [PermissionGuardClass],
    data: { permission: 'create_user' }
  }
];
```

### Rutas sin Guardia (Públicas)
```typescript
{
  path: 'redeem/:code',
  component: RedeemComponent
  // NO canActivate - es pública
}
```

---

## 📝 Componentes - Patrones Comunes

### Patrón: Validar en OnInit
```typescript
export class CampaignListComponent implements OnInit {
  constructor(private authService: AuthService) {}

  ngOnInit() {
    if (!this.authService.hasPermission('view_campaigns')) {
      // No debería llegar aquí (PermissionGuard detiene)
      return;
    }
    this.loadCampaigns();
  }
}
```

### Patrón: Mostrar/Ocultar Botón
```typescript
export class ToolbarComponent {
  get canCreate(): boolean {
    return this.authService.hasPermission('create_campaign');
  }

  constructor(private authService: AuthService) {}
}
```

```html
<button *ngIf="canCreate" (click)="create()">
  Nueva Campaña
</button>
```

### Patrón: Observable en Template
```typescript
export class DashboardComponent {
  user$ = this.authService.getCurrentUser$();
  permisos$ = this.authService.getPermissions$();

  constructor(private authService: AuthService) {}
}
```

```html
<div *ngIf="(user$ | async)?.rol === 'ADMIN'">
  Panel ADMIN
</div>

<button *ngIf="(permisos$ | async)?.includes('create_order')">
  Crear Orden
</button>
```

### Patrón: RxJS + Validación
```typescript
export class OrderComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  ngOnInit() {
    this.authService.getCurrentUser$().pipe(
      first(),
      map(user => user?.rol),
      tap(rol => {
        if (rol !== 'MESERO' && rol !== 'COCINA') {
          this.router.navigate(['/dashboard/kpis']);
        }
      }),
      switchMap(() => this.loadOrders())
    ).subscribe();
  }
}
```

### Patrón: Permisos Condicionales
```typescript
export class ActionsComponent {
  private authService = inject(AuthService);

  get actions() {
    const base = [{ label: 'Ver', icon: 'eye' }];
    
    if (this.authService.hasPermission('edit_campaign')) {
      base.push({ label: 'Editar', icon: 'edit' });
    }
    
    if (this.authService.hasPermission('delete_campaign')) {
      base.push({ label: 'Eliminar', icon: 'trash' });
    }

    return base;
  }
}
```

---

## 🎯 AdminPermissionService - Métodos

### Obtener Datos
```typescript
// Todos los permisos
adminService.getAllPermissions() → Observable<Permission[]>

// Permisos de un rol
adminService.getRolePermissions('MESERO') 
  → Observable<RolePermissions>

// Códigos de permiso
adminService.getRolePermissionCodes('MESERO')
  → Observable<string[]>

// Todos los roles
adminService.getAllRolesPermissions() → Observable<RolePermissions[]>
```

### Actualizar Permisos
```typescript
// Asignar permisos a rol
adminService.assignPermissionsToRole(
  'MESERO',
  [1, 2, 3],  // IDs de permisos
  true        // replace=true (reemplaza todos)
) → Observable<{ message: string; permissions: Permission[] }>
```

### Utilidades
```typescript
// Filtrar por categoría
adminService.filterPermissionsByCategory(perms, 'admin')

// Agrupar por recurso
adminService.groupPermissionsByResource(perms)
  // { "menu": [...], "orders": [...] }
```

---

## 🌐 Rutas Protegidas - Ejemplos Reales

### Campañas
```typescript
{ path: 'campaigns', component: CampaignList, canActivate: [PermissionGuardClass], data: { permission: 'view_campaigns' } }
{ path: 'campaigns/create', component: CampaignCreate, canActivate: [PermissionGuardClass], data: { permission: 'create_campaign' } }
{ path: 'campaigns/:id', component: CampaignDetail, canActivate: [PermissionGuardClass], data: { permission: 'view_campaigns' } }
```

### Órdenes/Comanda
```typescript
{ path: 'comandix', component: OrderList, canActivate: [PermissionGuardClass], data: { permission: 'view_orders' } }
{ path: 'comandix/create', component: OrderCreate, canActivate: [PermissionGuardClass], data: { permission: 'create_order' } }
```

### Admin
```typescript
{ path: 'users', component: UserList, canActivate: [PermissionGuardClass], data: { permission: 'view_users' } }
{ path: 'admin/roles-permissions', component: AdminRoles, canActivate: [PermissionGuardClass], data: { permission: 'manage_roles' } }
```

---

## 🔄 Flujos Comunes

### Login
```typescript
// 1. Usuario completa formulario (SOLO 2 campos)
this.authService.loginAndStore({ email, password })
  .subscribe({
    next: (res) => {
      // 2. Automáticamente guardado en localStorage:
      // - localStorage.accessToken (JWT token desde object.accessToken)
      // - localStorage.currentUser (User con email, id, etc)
      // - localStorage.permissions (permisos del usuario)
      
      // 3. Redirige a dashboard
      this.router.navigate(['/dashboard/kpis']);
    },
    error: (err) => {
      // Mostrar error (ej: "Usuario no encontrado")
    }
  });
```

### Refrescar Permisos (Después de cambios admin)
```typescript
this.authService.refreshPermissions().subscribe(
  perms => console.log('Permisos actualizados:', perms)
);
```

### Logout
```typescript
this.authService.logout();
this.router.navigate(['/dashboard/auth/login']);
```

### Cambiar Permisos de un Rol (Admin)
```typescript
const rolePermissionIds = [1, 2, 5, 8]; // IDs de permisos

this.adminService
  .assignPermissionsToRole('MESERO', rolePermissionIds)
  .subscribe(
    res => console.log('Actualizado:', res),
    err => console.error('Error:', err)
  );
```

---

## 📊 localStorage - Keys

```typescript
// Acceso directo
localStorage.accessToken           // JWT token
localStorage.currentUser           // Usuario actual (JSON)
localStorage.permissions           // Array de permisos (JSON)
localStorage.lastTenantId          // Tenant ID del último login
localStorage.usuario               // Usuario antiguo (compat)

// Ejemplo: Limpiar todo
localStorage.clear();

// Ejemplo: Ver token
console.log(localStorage.getItem('accessToken'));

// Ejemplo: Ver permisos
console.log(JSON.parse(localStorage.getItem('permissions')));
```

---

## 🚨 Errores Comunes - Soluciones

### Error: "No tienes permiso..."
```typescript
// Solución:
1. Verifica que tengas el permiso:
   authService.hasPermission('view_campaigns')

2. Login como ADMIN y ve a:
   /dashboard/admin/roles-permissions

3. Asigna el permiso al rol

4. Haz login nuevamente
```

### Error: "Unauthorized 401"
```typescript
// Solución:
1. Token expiró
2. AuthInterceptor debería logout automático
3. Vérifica que esté registrado en app.config.ts
4. Si no, haz login nuevamente
```

### Error: "Forbidden 403"
```typescript
// Solución:
1. No tienes el permiso requerido
2. Mismo que arriba:
   - Verifica permiso
   - Solicita a admin que lo asigne
   - Haz login nuevamente
```

### Error: Token no se envía
```typescript
// Verificar:
1. localStorage.getItem('accessToken') ← Debe tener algo
2. DevTools Network → Headers → Authorization
3. Si no está → AuthInterceptor no está registrado

// Solución:
// En app.config.ts

{ provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
```

---

## ⚡ Tips de Performance

### Cache de Permisos
```typescript
// Los permisos se cachean en localStorage
// No hagas llamadas innecesarias al backend

// ✅ BIEN
const perm = this.authService.hasPermission('create_order');

// ❌ EVITAR
this.adminService.getRolePermissions('MESERO').subscribe(...);
```

### Observables Eficientes
```typescript
// ✅ BIEN - Usar async pipe
<button *ngIf="(authService.getPermissions$ | async) as perms">

// ❌ EVITAR - Múltiples subscripciones
permission1$ = this.authService.getPermissions$();
permission2$ = this.authService.getPermissions$();
permission3$ = this.authService.getPermissions$();
```

### Validación en OnInit
```typescript
// ✅ BIEN
ngOnInit() {
  if (!this.authService.hasPermission('view')) {
    return; // No cargar datos innecesarios
  }
  this.loadData();
}

// ❌ EVITAR
ngOnInit() {
  this.loadData(); // Siempre carga, luego valida
}
```

---

## 📱 Mobile/Responsive

### Componente Admin en Mobile
```html
<!-- Automáticamente responsive -->
<!-- Ver SCSS en admin-roles-permissions.component.scss -->

<!-- En mobile: Stack vertical -->
<!-- En desktop: Grid 3 columnas -->
```

### DevTools
```
F12 → Toggle device toolbar
Permite probar en diferentes tamaños
```

---

## 🧪 Testing Rápido

### En DevTools Console
```javascript
// Ver usuario actual
ng.getComponent($0).injector.get(AuthService).getCurrentUser()

// Ver permisos
ng.getComponent($0).injector.get(AuthService).getPermissions()

// Ver token
ng.getComponent($0).injector.get(AuthService).getToken()

// Validar permiso
ng.getComponent($0).injector.get(AuthService).hasPermission('create_order')

// Simular logout
ng.getComponent($0).injector.get(AuthService).logout()
```

---

## 🎯 Próximas Acciones

### Hoy
- [ ] Test login con diferentes usuarios
- [ ] Verifica pantalla admin roles
- [ ] Agrega PermissionGuard a rutas críticas

### Esta Semana
- [ ] Protege TODAS las rutas sensibles
- [ ] Actualiza UI menú/botones por permisos
- [ ] Prueba cambios de permisos en admin

### Próxima Semana
- [ ] Implementa permisos custom por usuario
- [ ] Agrega audit logging
- [ ] Documentación interna del equipo

---

## 📞 Comandos Útiles Angular

```bash
# Servir en desarrollo
ng serve

# Build producción
ng build --prod

# Linting
ng lint

# Tests
ng test

# Generar componente
ng generate component pages/nueva-pagina

# Generar servicio
ng generate service servicios/nuevo-servicio
```

---

## 🔗 Enlaces Rápidos

| Documento | Contenido |
|-----------|----------|
| INICIO_RAPIDO.md | Tutorial de inicio rápido |
| GUIA_SISTEMA_PERMISOS.md | Guía completa y ejemplos |
| IMPLEMENTACION_PERMISOS_CHECKLIST.md | Checklist y troubleshooting |
| RESUMEN_VISUAL.md | Diagramas y flujos |
| ANALISIS_PERMISOS_ROLES.md | Análisis de permisos del Backend |

---

## ✅ Validación Final

```
✅ Login funciona?
✅ Permisos se guardan?
✅ Rutas protegidas funcionan?
✅ Admin puede cambiar permisos?
✅ Token en cada request?
✅ 401 hace logout?
✅ UI se actualiza con permisos?
```

Si todo ✅ → ¡Estás listo para producción!

---

**Última actualización:** Marzo 2026  
**Versión:** 1.0  
**Status:** ✅ IMPLEMENTADO
