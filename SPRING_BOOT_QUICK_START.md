## GUÍA RÁPIDA - IMPLEMENTACIÓN USER MANAGEMENT SPRING BOOT

Resumen ejecutivo de cómo implementar los servicios de usuarios en Spring Boot compatible con el frontend Angular.

---

## ⚡ RESUMEN DE ARCHIVOS A CREAR

```
src/main/java/com/lealtix/user/
├── controller/
│   └── UserController.java              # REST Endpoints
├── service/
│   ├── UserService.java                 # Lógica de negocio
│   └── RolePermissionService.java       # Mapeo de permisos
├── repository/
│   └── UserRepository.java              # JPA Queries
├── entity/
│   └── User.java                        # Entidad JPA
├── dto/
│   ├── UserDTO.java
│   ├── CreateUserRequest.java
│   ├── UpdateUserRequest.java
│   └── UserListResponse.java
├── mapper/
│   └── UserMapper.java                  # Entity <-> DTO
├── enums/
│   └── UserRole.java                    # 5 Roles predefinidos
└── exception/
    └── (Usar GlobalExceptionHandler compartido)
```

---

## 📋 PASO A PASO

### PASO 1: Crear la Entidad User

**Archivo:** `User.java` en `entity/`

✅ Incluir campos: id, nombre, email, contrasena, rol, activo, tenantId, permissions
✅ Usar @SQLDelete + @Where para soft delete
✅ Hereda de BaseEntity (createdAt, updatedAt, createdBy, updatedBy)
✅ Validar en BD: unique(email, tenant_id)

**Script SQL sugerido:**
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
    FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX idx_users_tenant_email ON users(tenant_id, email);
```

---

### PASO 2: Crear Enums y DTOs

**Archivos:**
- `UserRole.java` - enum con 5 roles y sus permisos por defecto
- `UserDTO.java` - Response DTO
- `CreateUserRequest.java` - Validado con @Valid
- `UpdateUserRequest.java` - Opcional, campos actualizables
- `UserListResponse.java` - Wrapper para listado

✅ Usar @Data, @Builder, @NoArgsConstructor, @AllArgsConstructor (Lombok)
✅ DTOs con @JsonInclude(NON_NULL)
✅ Request con validaciones: @NotBlank, @Email, @NotNull

---

### PASO 3: Crear Repository

**Archivo:** `UserRepository.java`

✅ Extender JpaRepository<User, Long>
✅ Métodos importantes:
```
findByEmailAndTenantId(String, Long)
findByTenantIdAndActivoTrue(Long, Pageable)
findByTenantIdAndNombreContainingIgnoreCaseAndActivoTrue(Long, String, Pageable)
findByTenantIdAndEmailContainingIgnoreCaseAndActivoTrue(Long, String, Pageable)
```

---

### PASO 4: Crear Services

**Archivos:**
- `RolePermissionService.java` - Mapeo de permisos por rol (simple)
- `UserService.java` - Lógica completa

**UserService métodos principales:**
```
createUser(CreateUserRequest, String createdBy): UserDTO
updateUser(Long id, UpdateUserRequest, Long tenantId, String updatedBy): UserDTO
deleteUser(Long id, Long tenantId, String deletedBy): void
getUserById(Long id, Long tenantId): UserDTO
listUsers(Long tenantId, int page, int pageSize, String search): UserListResponse
```

✅ Usar @Transactional
✅ Encriptar contraseña con PasswordEncoder.encode()
✅ Asignar permisos automáticamente según rol
✅ Validar tenantId en cada operación
✅ Lanzar BusinessException si hay errores

---

### PASO 5: Crear Mapper

**Archivo:** `UserMapper.java`

✅ Convertir User (Entity) → UserDTO
✅ Mapear todos los campos necesarios
✅ Excluir contraseña en DTO

---

### PASO 6: Crear Controller REST

**Archivo:** `UserController.java`

✅ @RestController
✅ @RequestMapping("/api/admin/users")
✅ 5 Endpoints:
   - GET / (listar con paginación)
   - GET /{id}
   - POST (crear)
   - PUT /{id} (actualizar)
   - DELETE /{id}

✅ @PreAuthorize("hasRole('ADMIN')") en todos
✅ Recibir tenantId del header: @RequestHeader("X-Tenant-Id")
✅ Responder con GenericResponse<T> (object, no data)
✅ Atrapar excepciones y devolver mensaje claro

---

### PASO 7: Configurar Security & TenantId

**En SecurityConfig:**
```java
@Bean
public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
}

@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        .authorizeHttpRequests(authz -> authz
            .requestMatchers("/api/admin/**").hasRole("ADMIN")
            .anyRequest().authenticated()
        )
        .csrf().disable();
    
    return http.build();
}
```

**En FilterChain o Interceptor (obtener tenantId del JWT):**
```
Extraer userId del token JWT
Consultar usuario en BD
Obtener su tenantId
Pasar en RequestContext (ThreadLocal) o header
```

---

## 🔄 FLUJO DE INTEGRACIÓN

```
FRONTEND Angular (UserService)
         ↓
POST /api/admin/users
     {"nombre": "...", "email": "...", "contrasena": "...", "rol": "MESERO"}
         ↓
BACKEND Controller
     - Validar @RequestBody
     - Extraer tenantId del contexto
     - Verificar @PreAuthorize("hasRole('ADMIN')")
         ↓
UserService.createUser()
     - Validar email único por tenant
     - Encriptar contraseña
     - Asignar permisos automáticamente
     - Guardar en BD
         ↓
UserMapper.convertToDTO()
     - Convertir Entity → DTO (sin contraseña)
         ↓
GenericResponse<UserDTO>
     {"code": 201, "message": "...", "object": {...}}
         ↓
FRONTEND Angular recibe respuesta
     - Toast: "Usuario creado correctamente"
     - Actualiza tabla
```

---

## 🧪 TESTING CON POSTMAN

### 1. Crear Usuario
```
POST http://localhost:8080/api/admin/users
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
  X-Tenant-Id: 1
  Content-Type: application/json

Body:
{
  "nombre": "Juan Pérez",
  "email": "juan@lealtix.com",
  "contrasena": "Pass123456",
  "rol": "MESERO",
  "tenantId": 1
}

Expected Response (201):
{
  "code": 201,
  "message": "Usuario creado exitosamente",
  "object": {
    "id": 5,
    "nombre": "Juan Pérez",
    "email": "juan@lealtix.com",
    "rol": "MESERO",
    "permissions": ["view_comanda", "create_order", "edit_own_order"],
    "activo": true,
    "createdAt": "2026-03-21T10:30:00",
    "updatedAt": "2026-03-21T10:30:00"
  }
}
```

### 2. Listar Usuarios
```
GET http://localhost:8080/api/admin/users?page=0&pageSize=10&search=juan
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
  X-Tenant-Id: 1

Expected Response (200):
{
  "code": 200,
  "message": "Usuarios obtenidos exitosamente",
  "object": {
    "total": 5,
    "usuarios": [...]
  }
}
```

### 3. Actualizar Usuario
```
PUT http://localhost:8080/api/admin/users/5
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
  X-Tenant-Id: 1

Body:
{
  "nombre": "Juan Pérez Actualizado",
  "rol": "CAJA"
}

Expected Response (200): Usuario actualizado
```

### 4. Eliminar Usuario
```
DELETE http://localhost:8080/api/admin/users/5
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
  X-Tenant-Id: 1

Expected Response (200): Usuario eliminado (soft delete)
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### Base de Datos
- [ ] Crear tabla `users` con columnas correctas
- [ ] Crear tabla `user_permissions` para permisos
- [ ] Índices en (tenant_id, email)
- [ ] Foreign key a tenants

### Entidades & Modelos
- [ ] Crear User.java con auditoría
- [ ] Crear UserRole enum con 5 roles
- [ ] Crear DTOs (UserDTO, CreateUserRequest, UpdateUserRequest)
- [ ] Crear UserListResponse

### Lógica de Negocio
- [ ] Crear UserRepository con queries necesarias
- [ ] Crear UserService con 6 métodos principales
- [ ] Crear RolePermissionService
- [ ] Crear UserMapper

### API REST
- [ ] Crear UserController con 5 endpoints
- [ ] Implementar paginación
- [ ] Implementar filtros (búsqueda)
- [ ] Configurar @PreAuthorize

### Seguridad
- [ ] BCrypt para encriptación de contraseñas
- [ ] Validar tenantId en cada operación
- [ ] Soft delete (activo=false)
- [ ] Auditoría (createdBy, updatedAt)

### Testing
- [ ] Testear creación de usuario
- [ ] Testear email único
- [ ] Testear cambio de rol
- [ ] Testear eliminación (soft delete)
- [ ] Testear listado con búsqueda
- [ ] Testear validaciones

### Documentación
- [ ] Documentar endpoints en Swagger (si aplica)
- [ ] Ejemplos de request/response
- [ ] Posibles códigos de error

---

## 🔗 INTEGRACIÓN CON FRONTEND

El frontend Angular ya está preparado para:

**1. Modo Mock (sin Backend):**
   - Usa datos simulados en UserService
   - Toast de éxito/error
   - Tabla actualiza automáticamente

**2. Modo Backend (con esta implementación):**
   - Conecta a http://localhost:8080/api/admin/users
   - Envía requests con estructura exacta
   - Espera respuestas con estructura GenericResponse<object>
   - Renderiza permisos automáticamente según rol

**Cambios mínimos en Frontend si es necesario:**
   - Actualizar environment.ts con URL del backend
   - Probablemente ya está configurado a localhost:8080

---

## 🎯 RESULTADO ESPERADO

Cuando todo esté integrado:

1. **En Frontend Angular:**
   - Ir a /dashboard/users
   - Ver tabla con 3 usuarios mock
   - Clic en "Nuevo Miembro"
   - Llenar formulario y crear usuario
   - POST a /api/admin/users
   - Backend crea usuario en BD
   - Frontend recibe respuesta y actualiza tabla
   - Toast verde: "Usuario creado correctamente"

2. **En Backend Spring Boot:**
   - Logs muestran creación del usuario
   - BD contiene nuevo usuario con permisos asignados
   - Contraseña encriptada con BCrypt

---

## 📞 TROUBLESHOOTING

**Error: "El email ya existe"**
- ✓ Validación funcionando correctamente
- ✓ Usar otro email para prueba

**Error: 403 Forbidden**
- ✗ Token JWT inválido o expirado
- ✗ Usuario no tiene rol ADMIN
- ✓ Usar token válido con rol ADMIN

**Error: No mapping found for HTTP GET /api/admin/users**
- ✗ Controller no está siendo escaneado por Spring
- ✓ Verificar @ComponentScan o @SpringBootApplication
- ✓ Controller en paquete correcto

**Error: 500 Internal Server Error**
- ✗ Likely database connection issue
- ✓ Verificar connection string en application.properties
- ✓ Verificar que la tabla existe

---

## 📚 REFERENCIAS

Archivos de referencia en este repositorio:
- `SPRING_BOOT_USER_MANAGEMENT_PROMPT.md` - Especificación completa
- `SPRING_BOOT_USER_MANAGEMENT_EJEMPLOS.md` - Código de ejemplo
- `src/app/pages/user-management/README.md` - Documentación del frontend

---

**¡Listo! Ahora tienes todo lo necesario para implementar el módulo de usuarios en Spring Boot.**
