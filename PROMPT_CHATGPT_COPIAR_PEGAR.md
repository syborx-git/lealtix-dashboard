# PROMPT PARA GENERAR CÓDIGO SPRING BOOT - COPIAR Y PEGAR

Copia y pega este prompt directamente en ChatGPT o Claude para generar el código Spring Boot.

---

## PROMPT PARA ChatGPT/Claude

```
Actúa como un experto en Spring Boot y genera código production-ready para 
un módulo de Gestión de Usuarios y Roles que se integre con un frontend Angular.

CONTEXTO:
- El frontend Angular utiliza los siguientes DTOs:
  * UserDTO con campos: id, nombre, email, rol, permissions[], activo, createdAt, updatedAt
  * CreateUserRequest: nombre, email, contrasena, rol, tenantId  
  * UpdateUserRequest: nombre?, email?, contrasena?, rol?
  * UserListResponse: total (int), usuarios (List<UserDTO>)
  * GenericResponse<T>: code, message, object (IMPORTANTE: usar 'object' no 'data')

- Roles disponibles: ADMIN, MESERO, COCINA, CAJA, MARKETING
- Cada rol tiene permisos específicos (ver tabla abajo)
- Sistema multi-tenant (SaaS): cada usuario vinculado a un tenantId
- La respuesta debe ser con el campo 'object', no 'data'

PERMISO POR ROL:
- ADMIN: view_dashboard, manage_users, manage_campaigns, manage_categories, manage_products, view_reports, manage_settings
- MESERO: view_comanda, create_order, edit_own_order
- COCINA: view_kitchen_orders, update_order_status, view_pending_orders
- CAJA: view_sales, process_payment, manage_transactions, view_cash_register
- MARKETING: view_campaigns, create_campaign, view_analytics, manage_redemptions

ENDPOINTS REQUERIDOS:
- GET /api/admin/users?page=0&pageSize=10&search=? → Listar con paginación
- GET /api/admin/users/{id} → Obtener usuario
- POST /api/admin/users → Crear (Body: CreateUserRequest)
- PUT /api/admin/users/{id} → Actualizar (Body: UpdateUserRequest)
- DELETE /api/admin/users/{id} → Eliminar (soft delete)

REQUISITOS TÉCNICOS:
1. Usar Spring Data JPA con PostgreSQL
2. Implementar auditoría: createdAt, updatedAt, createdBy, updatedBy
3. Soft delete: activo=false, usar @SQLDelete + @Where
4. Encriptar contraseña con BCrypt PasswordEncoder
5. Validar aislamiento de tenant en cada operación
6. @PreAuthorize("hasRole('ADMIN')") en todos los endpoints
7. Responder con GenericResponse<T> donde T es el DTO
8. Codigos HTTP: 201 para CREATE, 200 para OK, 400 para error, 404 para not found

GENERAR:
1. User.java (Entity JPA con auditoría y soft delete)
2. UserRole.java (Enum con permisos por defecto)
3. UserDTO.java (Response DTO)
4. CreateUserRequest.java (Request DTO con validaciones)
5. UpdateUserRequest.java (Request DTO opcional)
6. UserListResponse.java (Wrapper para listado)
7. UserRepository.java (JPA Repository con queries)
8. UserService.java (Lógica de negocio) - Métodos:
   - createUser(CreateUserRequest, createdBy)
   - updateUser(id, UpdateUserRequest, tenantId, updatedBy)  
   - deleteUser(id, tenantId, deletedBy)
   - getUserById(id, tenantId)
   - listUsers(tenantId, page, pageSize, search)
9. RolePermissionService.java (Mapeo de permisos)
10. UserMapper.java (Entity <-> DTO)
11. UserController.java (REST Endpoints con @PreAuthorize)

VALIDACIONES IMPORTANTES:
- Email único por tenant
- Nombre mínimo 2 caracteres
- Contraseña mínimo 6 caracteres
- Tenant de request debe coincidir con tenant autenticado
- No permitir acceder a usuarios de otro tenant

CONSIDERACIONES:
- Usar @Transactional en Service
- Lanzar BusinessException para errores de negocio
- Usar Lombok para reducir boilerplate
- Incluir logs con @Slf4j
- Comentarios claros en métodos importantes

Por favor, genera código limpio, bien estructurado y listo para producción.
```

---

## PROMPT ALTERNATIVO - MÁS COMPACTO

```
Genera un módulo Spring Boot CRUD de usuarios para el endpoint /api/admin/users
con los siguientes requisitos:

ENTIDAD: 
- id, nombre, email, contrasena (BCrypt), rol (ADMIN|MESERO|COCINA|CAJA|MARKETING)
- activo (soft delete), tenantId, permissions[], createdAt, updatedAt, createdBy, updatedBy

DTOs:
- UserDTO para responses
- CreateUserRequest con validaciones
- UpdateUserRequest
- UserListResponse {total, usuarios[]}
- GenericResponse<T> con campo 'object' (no 'data')

Endpoints:
- GET  /api/admin/users?page&pageSize&search
- GET  /api/admin/users/{id}
- POST /api/admin/users → 201
- PUT  /api/admin/users/{id}
- DELETE /api/admin/users/{id} (soft delete)

Seguridad:
- @PreAuthorize ADMIN
- Validar tenantId en cada operación
- Email único por tenant

Permisos automáticos según rol:
ADMIN: [view_dashboard,manage_users,manage_campaigns,manage_categories,manage_products,view_reports,manage_settings]
MESERO: [view_comanda,create_order,edit_own_order]
COCINA: [view_kitchen_orders,update_order_status,view_pending_orders]
CAJA: [view_sales,process_payment,manage_transactions,view_cash_register]
MARKETING: [view_campaigns,create_campaign,view_analytics,manage_redemptions]

Generar: Entity, Enums, DTOs, Repository, Service, Mapper, Controller (production-ready)
```

---

## EJEMPLO DE RESPUESTA ESPERADA

Cuando ejecutes el prompt en ChatGPT/Claude, deberías recibir como mínimo:
- 11 archivos Java (.java) con código completo
- Todos los imports y anotaciones correctas
- Manejo de excepciones
- Logs integrados
- Comentarios en métodos principales
- Siguiendo principios SOLID

---

## DESPUÉS DE GENERAR EL CÓDIGO

1. **Copiar los archivos** a tu proyecto Spring Boot
   ```
   src/main/java/com/lealtix/user/
   ├── entity/User.java
   ├── repository/UserRepository.java
   ├── service/UserService.java
   ├── service/RolePermissionService.java
   ├── controller/UserController.java
   ├── dto/UserDTO.java
   ├── dto/CreateUserRequest.java
   ├── dto/UpdateUserRequest.java
   ├── dto/UserListResponse.java
   ├── mapper/UserMapper.java
   └── enums/UserRole.java
   ```

2. **Crear la tabla en PostgreSQL:**
   ```sql
   CREATE TABLE users (
       id SERIAL PRIMARY KEY,
       nombre VARCHAR(100) NOT NULL,
       email VARCHAR(255) NOT NULL,
       contrasena VARCHAR(255) NOT NULL,
       rol VARCHAR(50) NOT NULL,
       activo BOOLEAN DEFAULT true,
       tenant_id BIGINT NOT NULL,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       created_by VARCHAR(100),
       updated_by VARCHAR(100),
       UNIQUE(email, tenant_id),
       FOREIGN KEY(tenant_id) REFERENCES tenants(id)
   );

   CREATE TABLE user_permissions (
       user_id BIGINT NOT NULL,
       permission VARCHAR(100),
       FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
   );

   CREATE INDEX idx_users_tenant_active ON users(tenant_id, activo);
   CREATE INDEX idx_users_email_tenant ON users(email, tenant_id);
   ```

3. **Testear los endpoints con Postman** (ver archivo SPRING_BOOT_QUICK_START.md)

4. **Actualizar properties:** Asegurar que CORS está habilitado para http://localhost:4200

---

## NOTAS IMPORTANTES

✅ **Usar GenericResponse con 'object' no 'data'** - Esto es crítico para que el frontend funcione

✅ **Soft delete** - Cambiar activo=false, no hacer DELETE físico

✅ **Permisos automáticos** - Se asignan según el rol, no enviarlos en request

✅ **TenantId crítico** - Verificar en CADA operación para SaaS

✅ **Encripción** - SIEMPRE usar BCryptPasswordEncoder, nunca plain text

✅ **Validaciones** - Implementar @Valid en controller + validaciones en service

---

## ALTERNATIVA: GENERAR PASO A PASO

Si prefieres generar paso a paso, usa estos prompts en orden:

1. "Genera la entidad User con JPA, auditoría y soft delete"
2. "Genera UserRole enum con permisos por rol"
3. "Genera los DTOs para User (UserDTO, CreateUserRequest, etc)"
4. "Genera UserRepository con queries de búsqueda"
5. "Genera UserService con métodos CRUD"
6. "Genera UserController con 5 endpoints REST"
7. "Genera UserMapper para convertir Entity <-> DTO"

---

**¡Usa este prompt con ChatGPT, Claude u otro LLM para generar el código completo!**
