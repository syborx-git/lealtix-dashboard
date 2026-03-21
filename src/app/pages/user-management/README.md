# Gestión de Equipo - User Management Module

## Descripción General

El módulo **User Management** es una solución completa de administración de usuarios y roles para la plataforma Lealtix. Permite que los administradores gestionen su equipo de trabajo con asignación de roles específicos (Admin, Mesero, Cocina, Caja, Marketing) y permisos granulares.

## Características Principales

✅ **CRUD Completo** - Crear, leer, actualizar y eliminar usuarios
✅ **Sistema de Roles** - 5 roles predefinidos con permisos específicos
✅ **Control de Permisos** - RBAC (Role-Based Access Control)
✅ **Interfaz Reactiva** - Construida con PrimeNG y Tailwind CSS
✅ **Validaciones** - Formulario reactivo con validaciones integradas
✅ **Notificaciones** - Mensajes de éxito/error con p-toast
✅ **Confirmaciones** - Diálogos de confirmación para acciones críticas
✅ **Suporte a Mock** - Funciona con datos simulados si el backend falla
✅ **Responsivo** - Diseño adaptativo para todos los dispositivos

## Estructura de Carpetas

```
src/app/
├── pages/
│   └── user-management/
│       ├── user-management.component.ts      # Lógica principal
│       ├── user-management.component.html    # Template
│       ├── user-management.component.scss    # Estilos
│       └── services/
│           └── user.service.ts               # Lógica de API
├── models/
│   └── user.model.ts                         # Interfaces y enums
├── shared/
│   └── directives/
│       └── has-role.directive.ts             # Directiva de control de roles
```

## Modelos y Enums

### UserRole Enum
```typescript
export enum UserRole {
  ADMIN = 'ADMIN',
  MESERO = 'MESERO',
  COCINA = 'COCINA',
  CAJA = 'CAJA',
  MARKETING = 'MARKETING'
}
```

### Roles y sus Permisos

| Rol | Permisos | Descripción |
|-----|----------|-------------|
| **ADMIN** | view_dashboard, manage_users, manage_campaigns, manage_categories, manage_products, view_reports, manage_settings | Acceso total a todas las funciones |
| **MESERO** | view_comanda, create_order, edit_own_order | Acceso a módulo de comanda rápida |
| **COCINA** | view_kitchen_orders, update_order_status, view_pending_orders | Acceso a listado de órdenes pendientes |
| **CAJA** | view_sales, process_payment, manage_transactions, view_cash_register | Gestión de caja y transacciones |
| **MARKETING** | view_campaigns, create_campaign, view_analytics, manage_redemptions | Gestión de campañas y redenciones |

## Uso del Componente

### Importar el Componente

```typescript
import { UserManagementComponent } from '@/pages/user-management/user-management.component';
```

### Registrar la Ruta

```typescript
// En app.routes.ts
{
  path: 'users',
  component: UserManagementComponent,
  title: 'Gestión de Equipo'
}
```

### Acceder desde el Menú

El componente ya está integrado en el menú principal:
- **Ruta**: `/dashboard/users`
- **Icono**: `pi pi-id-card`
- **Etiqueta**: `Gestión de Equipo`

## Servicio (UserService)

### Métodos Disponibles

```typescript
// Obtener lista de usuarios
getUsuarios(tenantId: number, params?: { page?, pageSize?, searchTerm? }): Observable<UserListResponse>

// Obtener usuario por ID
getUsuarioById(id: number): Observable<UserDTO>

// Crear nuevo usuario
createUsuario(request: CreateUserRequest): Observable<UserDTO>

// Actualizar usuario
updateUsuario(id: number, request: UpdateUserRequest): Observable<UserDTO>

// Eliminar usuario
deleteUsuario(id: number): Observable<any>

// Obtener roles disponibles
getAvailableRoles(): UserRole[]

// Obtener permisos para un rol
getPermissionsForRole(role: UserRole): string[]
```

## Directiva HasRole

### Propósito

Controlar la visibilidad de elementos basándose en el rol del usuario autenticado.

### Uso en Template

```html
<!-- Mostrar solo para administradores -->
<div *appHasRole="'ADMIN'">
  Solo visible para admins
</div>

<!-- Mostrar para múltiples roles -->
<div *appHasRole="['ADMIN', 'MARKETING']">
  Visible para admin o marketing
</div>
```

### Implementación

La directiva obtiene el rol del usuario desde `sessionStorage` o `localStorage` bajo la clave `usuario`.

## Flujo de Operaciones

### 1. Crear Usuario
1. Click en "Nuevo Miembro"
2. Dialog abre con formulario vacío
3. Usuario ingresa: Nombre, Email, Contraseña, Rol
4. Sistema valida los campos
5. Click en "Crear"
6. Usuario se crea en el backend (o mock si falla)
7. Toast de éxito muestra "Usuario creado correctamente"
8. Tabla se actualiza

### 2. Editar Usuario
1. Click en icono "Editar" en la fila del usuario
2. Dialog abre con datos del usuario
3. Contraseña es opcional en modo edición
4. Usuario modifica datos necesarios
5. Click en "Actualizar"
6. Dialog se cierra y tabla se actualiza

### 3. Eliminar Usuario
1. Click en icono "Eliminar" en la fila
2. Dialog de confirmación aparece
3. Si confirma, usuario se elimina
4. Toast de éxito muestra "Usuario eliminado correctamente"
5. Tabla se actualiza

## Integración SaaS

Cada usuario creado está asociado al `tenantId` del administrador. Esto asegura:

- **Aislamiento de datos**: Cada tenant solo ve sus usuarios
- **Seguridad**: Los usuarios de un tenant no pueden acceder a otro
- **Escalabilidad**: Sistema preparado para múltiples tenants

## Validaciones del Formulario

| Campo | Validaciones |
|-------|--------------|
| **Nombre** | Requerido, mínimo 2 caracteres |
| **Email** | Requerido, formato válido de email |
| **Contraseña** | Requerido (crear), mínimo 6 caracteres |
| **Rol** | Requerido, debe ser un rol válido |

## Seguridad (Frontend)

⚠️ **Nota**: Las validaciones en frontend son solo para UX. La seguridad real se implementa en el backend con Spring Security.

### Implementado
- Validaciones de formulario
- Control de visibilidad basado en roles (directiva *hasRole)
- Confirmación antes de eliminar

### Próximo paso (Backend)
- @PreAuthorize en endpoints REST
- JWT token validation
- Authorization checks en la lógica de negocio

## Manejo de Errores

El componente implementa fallback a datos mock si:
- El backend no responde
- Los endpoints aún no están implementados
- Hay error de conectividad

Esto permite tener un demo funcional mientras se desarrolla el backend.

## Estilos Aplicados

- **Bordes redondeados**: `border-round-xl` en tarjetas
- **Sombras sutiles**: `shadow-1` para profundidad
- **Paleta de colores**: Coherente con el dashboard existente
- **Responsive**: Funciona en mobile, tablet y desktop

## Próximos Pasos

1. **Backend**: Implementar endpoints `/api/admin/users` en Spring Boot
2. **Seguridad**: Agregar @PreAuthorize y validaciones del lado servidor
3. **Auditoría**: Registrar cambios de usuarios (quién, cuándo, qué)
4. **Notificaciones**: Enviar emails a usuarios cuando se crean
5. **Exportación**: Permitir exportar listado de usuarios a CSV/Excel

## Archivos Creados/Modificados

### Nuevos
- `src/app/models/user.model.ts`
- `src/app/pages/user-management/user-management.component.ts`
- `src/app/pages/user-management/user-management.component.html`
- `src/app/pages/user-management/user-management.component.scss`
- `src/app/pages/user-management/services/user.service.ts`
- `src/app/shared/directives/has-role.directive.ts`

### Modificados
- `src/app.routes.ts` - Agregada ruta `/dashboard/users`
- `src/app/layout/component/app.menu.ts` - Agregado item "Gestión de Equipo"

## Referencia de API (Backend)

```
GET    /api/admin/users?page=0&pageSize=10&search=   # Listar usuarios
GET    /api/admin/users/:id                           # Obtener usuario
POST   /api/admin/users                               # Crear usuario
PUT    /api/admin/users/:id                           # Actualizar usuario
DELETE /api/admin/users/:id                           # Eliminar usuario
```

### Request/Response Examples

**Crear usuario:**
```json
POST /api/admin/users
{
  "nombre": "Juan Pérez",
  "email": "juan@example.com",
  "contrasena": "miContraseña123",
  "rol": "MESERO",
  "tenantId": 1
}

Response:
{
  "code": 200,
  "message": "Usuario creado exitosamente",
  "object": {
    "id": 5,
    "nombre": "Juan Pérez",
    "email": "juan@example.com",
    "rol": "MESERO",
    "permissions": ["view_comanda", "create_order", "edit_own_order"],
    "activo": true
  }
}
```

## Soporte y Troubleshooting

### El componente no carga
- Verificar que UserManagementComponent esté importado en las rutas
- Revisar que los módulos PrimeNG estén correctamente importados

### Los datos mock no aparecen
- Verificar que no haya errores en la consola
- El servicio intenta conectar al backend primero

### Rol no se actualiza en directiva
- Verificar que el usuario esté guardado en `localStorage` o `sessionStorage` bajo la clave `usuario`
- El objeto debe tener una propiedad `rol`

## Contacto

Para preguntas o sugerencias sobre este módulo, contactar al equipo de desarrollo.
