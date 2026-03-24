# Análisis de Permisos por Rol - Lealtix Dashboard

**Fecha:** Marzo 2026  
**Aplicación:** Lealtix Dashboard (PrimeNG + Angular Standalone)  
**Roles Identificados:** ADMIN, MESERO, COCINA

---

## 1. Pantallas/Módulos Identificados

De acuerdo al análisis de rutas y menú de la aplicación:

### 1.1 Dashboard & Admin
- **Dashboard (KPIs)** - `/dashboard/kpis` - Métricas generales del sistema
- **Admin Page (Landing Editor)** - `/dashboard/adminPage` - Administración general
- **Gestión de Clientes** - `/dashboard/clientes` - Gestión de clientes minoristas
- **Gestión de Equipo** - `/dashboard/users` - Gestión de usuarios y roles

### 1.2 Configuración & Sistema
- **Categorías** - `/dashboard/categoriesMenu` - Gestión de categorías de productos
- **Productos** - `/dashboard/adminMenu` - Gestión del catálogo de productos
- **Mi Página** - `/dashboard/mi-pagina` - Configuración de página pública
- **Imprimir Menú** - `/dashboard/menu-classic-print` - Impresión de menú clásico

### 1.3 Campañas & Marketing
- **Campañas (CRUD)** - `/dashboard/campaigns` - Gestión de campañas de promoción
- **Plantillas de Campañas** - `/dashboard/campaign-templates` - Plantillas de campañas
- **Redención Manual** - `/dashboard/manual-redemption` - Redención manual de cupones

### 1.4 Operaciones
- **Mi Comanda** - `/dashboard/comandix` - Sistema de comanda inteligente (POS)
- **Reportes** - `/dashboard/uikit/charts` - Reportes analíticos [Actualmente oculto]
- **Redención Pública** - `/redeem/*` - Redención de cupones (acceso público)

---

## 2. Funcionalidades por Pantalla

### Dashboard (KPIs)
- Ver métricas de desempeño
- Ver gráficos de ventas/campañas
- Acceso a reportes ejecutivos

### Admin Page
- Editar configuración de landing page
- Gestionar tema visual
- Configurar redirecciones

### Gestión de Clientes
- Listar clientes
- Crear/Editar cliente
- Eliminar cliente
- Ver historial de compras
- Ver puntos de lealtad

### Gestión de Equipo
- Listar usuarios
- Crear usuario (con asignación de rol)
- Editar usuario
- Eliminar usuario
- Asignar permisos específicos
- Ver actividad del usuario

### Categorías (Productos)
- Crear categoría
- Editar categoría
- Eliminar categoría
- Reordenar categorías

### Productos
- Crear producto
- Editar producto
- Eliminar producto
- Importar/Exportar productos
- Ver inventario

### Campañas
- Listar campañas
- Crear campaña (con validación de datos)
- Editar campaña
- Eliminar campaña
- Publicar/Pausar campaña
- Ver estadísticas de campaña

### Plantillas de Campañas
- Ver plantillas disponibles
- Crear plantilla personalizada
- Editar plantilla
- Eliminar plantilla

### Redención Manual
- Procesar cupones manualmente (MESERO + ADMIN)
- Validar código de cupón (MESERO + ADMIN)
- Registrar redención (MESERO + ADMIN)
- Ver historial de redenciones (MESERO + ADMIN)

### Mi Página
- Editar información de página pública (ADMIN)

### Mi Comanda (POS)
- Ver órdenes abiertas
- Crear nueva orden
- Editar orden
- Aplicar descuentos
- Procesar pago
- Imprimir comanda/ticket

---

## 3. Matriz de Permisos por Rol (Recomendado)

### 3.1 ADMIN - Acceso Total (Superusuario)
```
✓ Dashboard (KPIs)              - FULL ACCESS
✓ Admin Page                     - FULL ACCESS
✓ Gestión de Clientes           - FULL ACCESS
✓ Gestión de Equipo             - FULL ACCESS (crear, editar, eliminar, asignar roles)
✓ Categorías (Productos)        - FULL ACCESS
✓ Productos                     - FULL ACCESS
✓ Campanias                     - FULL ACCESS
✓ Plantillas de Campañas       - FULL ACCESS
✓ Redención Manual              - FULL ACCESS
✓ Mi Página                     - FULL ACCESS
✓ Mi Comanda (POS)              - FULL ACCESS
✓ Reportes                      - FULL ACCESS
✓ Imprimir Menú                 - FULL ACCESS
```

**Permisos Base:** `view_all`, `manage_all`, `admin_access`

---

### 3.2 MESERO - Toma de Pedidos y Atención al Cliente
```
✗ Dashboard (KPIs)              - NO ACCESS
✗ Admin Page                     - NO ACCESS
✓ Gestión de Clientes           - READ ONLY (consultar información)
✗ Gestión de Equipo             - NO ACCESS
✗ Categorías (Productos)        - NO ACCESS
✓ Productos                     - READ ONLY (ver menú para crear órdenes)
✗ Campañas                      - NO ACCESS
✗ Plantillas de Campañas       - NO ACCESS
✓ Redención Manual              - FULL ACCESS (crear, procesar redenciones)
✗ Mi Página                     - NO ACCESS
✓ Mi Comanda (POS)              - FULL ACCESS (crear, editar, pagar órdenes)
✗ Reportes                      - NO ACCESS
✓ Imprimir Menú                 - READ ONLY
```

**Funcionalidades Específicas:**
- Crear pedidos (órdenes)
- Consultar pedidos existentes
- Editar pedidos (mientras no estén pagados)
- Procesar pagos de órdenes
- Aplicar descuentos/cupones
- Procesar redenciones de cupones
- Consultar código de cupones
- Ver estado de redenciones

**Permisos Base:** `view_menu`, `create_order`, `edit_order`, `view_orders`, `process_payment`, `process_redemption`, `query_coupons`, `apply_discount`

---

### 3.3 COCINA - Preparación de Pedidos
```
✗ Dashboard (KPIs)              - NO ACCESS
✗ Admin Page                     - NO ACCESS
✗ Gestión de Clientes           - NO ACCESS
✗ Gestión de Equipo             - NO ACCESS
✗ Categorías (Productos)        - NO ACCESS
✓ Productos                     - READ ONLY (ver ingredientes/detalles/preparación)
✗ Campañas                      - NO ACCESS
✗ Plantillas de Campañas       - NO ACCESS
✗ Redención Manual              - NO ACCESS
✗ Mi Página                     - NO ACCESS
✓ Mi Comanda (POS)              - PARTIAL (ver órdenes pendientes, actualizar estado)
✗ Reportes                      - NO ACCESS
✗ Imprimir Menú                 - NO ACCESS
```

**Funcionalidades Específicas:**
- Ver órdenes pendientes de preparación
- Recibir notificaciones de nuevas órdenes
- Ver detalles de cada orden
- Actualizar estado de órdenes (En preparación → Listo)
- Marcar orden como completada

**Permisos Base:** `view_kitchen_orders`, `update_order_status`, `view_pending_orders`, `view_order_details`

---

## 4. Tabla de Permisos - Estructura para Base de Datos

### 4.1 Tabla `permissions` (Backend)

```sql
CREATE TABLE permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    resource VARCHAR(100),           -- comanda, menu, redemptions, kitchen, etc
    action VARCHAR(50),               -- view, create, edit, delete, process
    category VARCHAR(50),             -- operations, admin
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 4.2 Tabla `role_permissions` (Backend)

```sql
CREATE TABLE role_permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    role VARCHAR(50) NOT NULL,        -- ADMIN, MESERO, COCINA
    permission_id INT NOT NULL,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (permission_id) REFERENCES permissions(id),
    UNIQUE KEY unique_role_permission (role, permission_id)
);
```

### 4.3 Tabla `user_custom_permissions` (Backend) - Opcional para permisos específicos

```sql
CREATE TABLE user_custom_permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    permission_id INT NOT NULL,
    granted BOOLEAN DEFAULT true,
    granted_by INT,                   -- ID del usuario admin que otorgó
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuarios(id),
    FOREIGN KEY (permission_id) REFERENCES permissions(id),
    FOREIGN KEY (granted_by) REFERENCES usuarios(id),
    UNIQUE KEY unique_user_permission (user_id, permission_id)
);
```

---

## 5. Catálogo de Permisos Recomendados

### Permisos de Gestión de Usuarios (ADMIN)
| Código | Nombre | Recurso | Acción | Roles |
|--------|--------|---------|--------|-------|
| `view_users` | Ver Usuarios | users | view | ADMIN |
| `create_user` | Crear Usuario | users | create | ADMIN |
| `edit_user` | Editar Usuario | users | edit | ADMIN |
| `delete_user` | Eliminar Usuario | users | delete | ADMIN |
| `manage_user_roles` | Asignar Roles | users | assign_roles | ADMIN |

### Permisos de Gestión de Clientes
| Código | Nombre | Recurso | Acción | Roles |
|--------|--------|---------|--------|-------|
| `view_customers` | Ver Clientes | customers | view | ADMIN, MESERO |
| `create_customer` | Crear Cliente | customers | create | ADMIN, MESERO |
| `edit_customer` | Editar Cliente | customers | edit | ADMIN, MESERO |
| `delete_customer` | Eliminar Cliente | customers | delete | ADMIN |

### Permisos de Menú y Productos
| Código | Nombre | Recurso | Acción | Roles |
|--------|--------|---------|--------|-------|
| `view_menu` | Ver Menú de Productos | menu | view | MESERO, COCINA |
| `view_products` | Ver Productos | products | view | ADMIN, MESERO, COCINA |
| `create_product` | Crear Producto | products | create | ADMIN |
| `edit_product` | Editar Producto | products | edit | ADMIN |
| `delete_product` | Eliminar Producto | products | delete | ADMIN |
| `manage_categories` | Gestionar Categorías | products | manage | ADMIN |

### Permisos de POS/Comanda
| Código | Nombre | Recurso | Acción | Roles |
|--------|--------|---------|--------|-------|
| `create_order` | Crear Orden | comanda | create | MESERO |
| `view_orders` | Ver Órdenes | comanda | view | MESERO, COCINA |
| `edit_order` | Editar Orden | comanda | edit | MESERO |
| `view_pending_orders` | Ver Órdenes Pendientes | kitchen | view_pending | COCINA |
| `update_order_status` | Actualizar Estado Orden | kitchen | update_status | COCINA |
| `view_order_details` | Ver Detalles Orden | comanda | view_details | MESERO, COCINA |
| `process_payment` | Procesar Pago | comanda | process_payment | MESERO |
| `apply_discount` | Aplicar Descuento | comanda | apply_discount | MESERO |

### Permisos de Redenciones
| Código | Nombre | Recurso | Acción | Roles |
|--------|--------|---------|--------|-------|
| `view_redemptions` | Ver Redenciones | redemptions | view | ADMIN, MESERO |
| `process_redemption` | Procesar Redención | redemptions | process | MESERO, ADMIN |
| `query_coupons` | Consultar Cupones | redemptions | query | MESERO |
| `view_coupon_status` | Ver Estado Cupón | redemptions | view_status | MESERO |

### Permisos de Configuración (ADMIN)
| Código | Nombre | Recurso | Acción | Roles |
|--------|--------|---------|--------|-------|
| `manage_settings` | Gestionar Configuración | settings | manage | ADMIN |
| `manage_admin_page` | Editar Admin Page | settings | manage_admin | ADMIN |
| `manage_landing_page` | Editar Landing Page | settings | manage_landing | ADMIN |
| `manage_campaigns` | Gestionar Campañas | campaigns | manage | ADMIN |
| `view_dashboard` | Ver Dashboard | dashboard | view | ADMIN |

---

## 6. Flujo de Validación de Permisos en Backend

### 6.1 Validación en Cada Endpoint

```
1. Usuario hace request a endpoint
2. Middleware extrae JWT/token
3. Valida que usuario esté autenticado
4. Obtiene rol del usuario
5. Consulta tabla role_permissions para ese rol
6. Verifica si tiene permiso específico requerido
7. Si es ADMIN → acceso permitido
8. Si NO es ADMIN → verifica tabla user_custom_permissions
9. Retorna 403 FORBIDDEN si no tiene permiso
10. Procesa request si tiene permiso
```

### 6.2 Endpoints que REQUIEREN Validación de Permisos

**Usuarios (ADMIN):**
- `GET /api/admin/users` → Requiere: `view_users`
- `POST /api/admin/users` → Requiere: `create_user` + `manage_user_roles`
- `PUT /api/admin/users/:id` → Requiere: `edit_user`
- `DELETE /api/admin/users/:id` → Requiere: `delete_user`

**Clientes:**
- `GET /api/customers` → Requiere: `view_customers`
- `POST /api/customers` → Requiere: `create_customer`
- `PUT /api/customers/:id` → Requiere: `edit_customer`
- `DELETE /api/customers/:id` → Requiere: `delete_customer` (ADMIN solo)

**Menú/Productos:**
- `GET /api/menu` → Requiere: `view_menu`
- `GET /api/products` → Requiere: `view_products`
- `POST /api/products` → Requiere: `create_product` (ADMIN solo)
- `PUT /api/products/:id` → Requiere: `edit_product` (ADMIN solo)
- `DELETE /api/products/:id` → Requiere: `delete_product` (ADMIN solo)

**POS/Comanda (MESERO):**
- `GET /api/orders` → Requiere: `view_orders`
- `POST /api/orders` → Requiere: `create_order`
- `PUT /api/orders/:id` → Requiere: `edit_order`
- `PUT /api/orders/:id/payment` → Requiere: `process_payment`

**Cocina (Orden Status):**
- `GET /api/kitchen/orders` → Requiere: `view_pending_orders`
- `PUT /api/orders/:id/status` → Requiere: `update_order_status`

**Redenciones (MESERO):**
- `GET /api/redemptions` → Requiere: `view_redemptions`
- `POST /api/redemptions` → Requiere: `process_redemption`
- `GET /api/coupons/query` → Requiere: `query_coupons`

---

## 7. Consideraciones Importantes

### 7.1 Excepciones y Casos Especiales

1. **ADMIN siempre tiene acceso total** - No validar permisos para rol ADMIN
2. **MESERO es el rol operativo principal** - Acceso a comanda completa, pagos y redenciones
3. **COCINA es especializado** - Solo ver y actualizar estado de órdenes
4. **Redención Pública** - La URL `/redeem/**` NO requiere autenticación (acceso público)
5. **Menú Dinámico** - Frontend debe recibir lista de permisos del usuario para mostrar/ocultar items
6. **Órdenes en Cocina** - Solo COCINA puede cambiar estado a "Listo" o "Cancelado"
7. **Pagos** - Solo MESERO puede procesar pagos en órdenes de clientes

### 7.2 Implementación en Frontend

```typescript
// Angular - Guard de permisos
export class PermissionGuard implements CanActivate {
  canActivate(route: ActivatedRouteSnapshot): Observable<boolean> {
    const requiredPermission = route.data['permission'];
    return this.authService.hasPermission(requiredPermission);
  }
}

// Uso en rutas
{
  path: 'campaigns',
  component: CampaignListComponent,
  canActivate: [AuthGuard, PermissionGuard],
  data: { permission: 'view_campaigns' }
}

// En templates
<button *ngIf="authService.hasPermission('edit_campaign')">
  Editar Campaña
</button>
```

### 7.3 Implementación en Backend (Node/Express ejemplo)

```javascript
// Middleware de validación de permisos
async function checkPermission(req, res, next) {
  const user = req.user;
  const requiredPermission = req.route.permission;
  
  // ADMIN siempre tiene acceso
  if (user.rol === 'ADMIN') {
    return next();
  }
  
  // Verificar permisos del rol
  const hasPermission = await rolePermissionService.hasPermission(
    user.rol, 
    requiredPermission
  );
  
  if (!hasPermission) {
    return res.status(403).json({ 
      message: 'No tienes permiso para esta acción' 
    });
  }
  
  next();
}

// Uso en rutas
router.post('/campaigns', 
  checkPermission({ permission: 'create_campaign' }),
  campaignController.create
);
```

---

## 8. Roadmap de Implementación

### Fase 1: Base
- [ ] Crear tablas `permissions` y `role_permissions` en BD
- [ ] Insertar permisos base del catálogo
- [ ] Implementar middleware de validación en Backend

### Fase 2: Integración
- [ ] Incluir permisos en respuesta de login (JWT claims)
- [ ] Implementar PermissionGuard en Angular
- [ ] Validar permisos en cada endpoint crítico

### Fase 3: Frontend
- [ ] Obtener lista de permisos del usuario al login
- [ ] Mostrar/ocultar menú items según permisos
- [ ] Mostrar/ocultar botones (edit, delete, create) según permisos
- [ ] Validar localmente antes de enviar requests

### Fase 4: Auditoría (Opcional)
- [ ] Crear tabla `permission_logs` para auditar cambios
- [ ] Registrar quién otorgó/revocó permisos
- [ ] Registrar intentos fallidos de acceso

---

## 9. Ejemplo de Estructura de Respuesta Login con Permisos

```json
{
  "code": 200,
  "message": "Login exitoso",
  "data": {
    "user": {
      "id": 1,
      "nombre": "Juan Pérez",
      "email": "juan@lealtix.com",
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

---

## 10. Resumen de Permisos por Rol

| Rol | Pantallas Accesibles | Acciones Principales | Restricciones |
|-----|-----------|------|------|
| **ADMIN** | Todas (14 pantallas) | Gestión total del sistema | Ninguna - Acceso total |
| **MESERO** | Comanda, Menú, Clientes, Redenciones | Crear/editar pedidos, procesar pagos, procesar redenciones | No acceso a admin/configuración |
| **COCINA** | Comanda (vista parcial), Menú | Actualizar estado de pedidos | Solo órdenes pendientes, sin modificar datos sensibles |

---

**Notas:** 
- Este análisis es una recomendación basada en la estructura de la aplicación
- Ajusta según tus requerimientos específicos del negocio
- Considera agregar permisos ultra específicos si es necesario
- Implementa auditoría para cambios de permisos críticos
