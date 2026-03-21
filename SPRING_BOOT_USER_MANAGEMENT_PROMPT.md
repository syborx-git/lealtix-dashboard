## PROMPT PARA GENERAR SERVICIOS DE USUARIOS EN SPRING BOOT

Implementación de módulo de Gestión de Usuarios y Roles en Spring Boot que se integre perfectamente con el frontend Angular generado.

---

### 🎯 OBJETIVO

Crear un sistema CRUD completo de usuarios y roles en Spring Boot que:
- Responda exactamente con la estructura esperada por el frontend
- Implemente autenticación y autorización basada en roles (RBAC)
- Mantenga el aislamiento de datos por tenant (SaaS)
- Siga patrones de seguridad y clean architecture

---

### 📊 ESTRUCTURA DE ENTIDADES JPA

**Base de la entidad User:**
```
- id: Long (PK)
- nombre: String (requerido, 2+ caracteres)
- email: String (requerido, único por tenant, válido)
- contrasena: String (requerido, encriptado con BCrypt, 6+ caracteres)
- rol: UserRole enum (ADMIN, MESERO, COCINA, CAJA, MARKETING)
- activo: boolean (default: true)
- tenantId: Long (FK a Tenant, requerido para SaaS)
- permissions: List<String> (generada automáticamente según el rol)
- createdAt: LocalDateTime (auditoría)
- updatedAt: LocalDateTime (auditoría)
- createdBy: String (auditoría)
- updatedBy: String (auditoría)
```

---

### 📝 DTOs Y MODELOS

**1. UserRole Enum:**
```java
public enum UserRole {
    ADMIN("Administrador", "view_dashboard,manage_users,manage_campaigns,manage_categories,manage_products,view_reports,manage_settings"),
    MESERO("Mesero", "view_comanda,create_order,edit_own_order"),
    COCINA("Cocina", "view_kitchen_orders,update_order_status,view_pending_orders"),
    CAJA("Caja", "view_sales,process_payment,manage_transactions,view_cash_register"),
    MARKETING("Marketing", "view_campaigns,create_campaign,view_analytics,manage_redemptions");
    
    private final String displayName;
    private final String permissions; // Separados por comas
}
```

**2. CreateUserRequest DTO:**
```java
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateUserRequest {
    @NotBlank(message = "El nombre es requerido")
    @Size(min = 2, message = "El nombre debe tener al menos 2 caracteres")
    private String nombre;
    
    @NotBlank(message = "El email es requerido")
    @Email(message = "El email debe ser válido")
    private String email;
    
    @NotBlank(message = "La contraseña es requerida")
    @Size(min = 6, message = "La contraseña debe tener al menos 6 caracteres")
    private String contrasena;
    
    @NotNull(message = "El rol es requerido")
    private UserRole rol;
    
    @NotNull(message = "El tenant ID es requerido")
    private Long tenantId;
}
```

**3. UpdateUserRequest DTO:**
```java
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateUserRequest {
    @Size(min = 2, message = "El nombre debe tener al menos 2 caracteres")
    private String nombre;
    
    @Email(message = "El email debe ser válido")
    private String email;
    
    @Size(min = 6, message = "La contraseña debe tener al menos 6 caracteres")
    private String contrasena;
    
    private UserRole rol;
}
```

**4. UserDTO (Response):**
```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserDTO {
    private Long id;
    private String nombre;
    private String email;
    private UserRole rol;
    private List<String> permissions;
    private Boolean activo;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
```

**5. UserListResponse:**
```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserListResponse {
    private Integer total;
    private List<UserDTO> usuarios;
}
```

**6. GenericResponse Wrapper:**
```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class GenericResponse<T> {
    private Integer code;
    private String message;
    private T object; // Cambiar de 'data' a 'object' para ser consistente con frontend
}
```

---

### 🔌 ENDPOINTS REST

**Base URL:** `http://localhost:8080/api/admin/users`

| Método | Endpoint | Parámetros | Descripción |
|--------|----------|-----------|-------------|
| GET | `/api/admin/users` | page=0, pageSize=10, search=? | Listar usuarios del tenant |
| GET | `/api/admin/users/{id}` | - | Obtener usuario por ID |
| POST | `/api/admin/users` | body: CreateUserRequest | Crear nuevo usuario |
| PUT | `/api/admin/users/{id}` | body: UpdateUserRequest | Actualizar usuario |
| DELETE | `/api/admin/users/{id}` | - | Eliminar usuario (lógico) |

---

### 📋 ESPECIFICACIÓN DE ENDPOINTS

**1. GET /api/admin/users (Listar con paginación)**

Request:
```
GET /api/admin/users?page=0&pageSize=10&search=juan
```

Response (200 OK):
```json
{
  "code": 200,
  "message": "Usuarios obtenidos exitosamente",
  "object": {
    "total": 15,
    "usuarios": [
      {
        "id": 1,
        "nombre": "Juan Pérez",
        "email": "juan@lealtix.com",
        "rol": "MESERO",
        "permissions": ["view_comanda", "create_order", "edit_own_order"],
        "activo": true,
        "createdAt": "2026-03-15T08:30:00",
        "updatedAt": "2026-03-20T10:15:00"
      }
    ]
  }
}
```

Notas:
- Usar Spring Data JPA Pageable (page/pageSize)
- Filtrar por tenantId del usuario autenticado
- Si search está presente, buscar en nombre o email (LIKE case-insensitive)
- Devolver solo usuarios activos por defecto


**2. POST /api/admin/users (Crear usuario)**

Request:
```json
{
  "nombre": "Carlos López",
  "email": "carlos@lealtix.com",
  "contrasena": "MiContraseña123",
  "rol": "COCINA",
  "tenantId": 1
}
```

Response (201 Created):
```json
{
  "code": 201,
  "message": "Usuario creado exitosamente",
  "object": {
    "id": 4,
    "nombre": "Carlos López",
    "email": "carlos@lealtix.com",
    "rol": "COCINA",
    "permissions": ["view_kitchen_orders", "update_order_status", "view_pending_orders"],
    "activo": true,
    "createdAt": "2026-03-21T09:00:00",
    "updatedAt": "2026-03-21T09:00:00"
  }
}
```

Validaciones:
- Email único por tenant
- Contraseña debe encriptarse con BCrypt
- Asignar permisos automáticamente según el rol
- Registrar auditoría (createdBy, createdAt)

Error si email ya existe (400 Bad Request):
```json
{
  "code": 400,
  "message": "El email ya existe en este tenant",
  "object": null
}
```


**3. PUT /api/admin/users/{id} (Actualizar usuario)**

Request:
```json
{
  "nombre": "Carlos López Actualizado",
  "email": "carlos.nuevo@lealtix.com",
  "rol": "CAJA"
}
```

Response (200 OK):
```json
{
  "code": 200,
  "message": "Usuario actualizado exitosamente",
  "object": {
    "id": 4,
    "nombre": "Carlos López Actualizado",
    "email": "carlos.nuevo@lealtix.com",
    "rol": "CAJA",
    "permissions": ["view_sales", "process_payment", "manage_transactions", "view_cash_register"],
    "activo": true,
    "createdAt": "2026-03-21T09:00:00",
    "updatedAt": "2026-03-21T10:30:00"
  }
}
```

Notas:
- Si contrasena viene en request, re-encriptarla
- Si cambió el rol, regenerar los permisos
- Si cambió email, validar que sea único por tenant
- Actualizar updatedAt y updatedBy


**4. DELETE /api/admin/users/{id} (Eliminar usuario)**

Response (200 OK):
```json
{
  "code": 200,
  "message": "Usuario eliminado exitosamente",
  "object": null
}
```

Notas:
- Implementar eliminación lógica (soft delete): actualizar activo=false
- No eliminar físicamente de la BD
- Registrar auditoría

Error si usuario no existe (404 Not Found):
```json
{
  "code": 404,
  "message": "Usuario no encontrado",
  "object": null
}
```


**5. GET /api/admin/users/{id} (Obtener usuario por ID)**

Response (200 OK):
```json
{
  "code": 200,
  "message": "Usuario obtenido exitosamente",
  "object": {
    "id": 1,
    "nombre": "Admin",
    "email": "admin@lealtix.com",
    "rol": "ADMIN",
    "permissions": ["view_dashboard", "manage_users", ...],
    "activo": true,
    "createdAt": "2026-01-01T00:00:00",
    "updatedAt": "2026-03-20T15:00:00"
  }
}
```

---

### 🏗️ ARQUITECTURA Y COMPONENTES

**1. Entity (JPA):**
```
com.lealtix.user.entity.User
- Anotaciones: @Entity, @Table, @Data, @Builder
- OneToMany relationship con Tenant
- Antes de guardar: encriptar contraseña
- Después de crear: generar permissions automáticamente
```

**2. Repository:**
```
com.lealtix.user.repository.UserRepository extends JpaRepository<User, Long>
- findByEmailAndTenantId(email, tenantId): Optional<User>
- findByTenantIdAndActivoTrue(tenantId, Pageable): Page<User>
- findByTenantIdAndNombreContainingIgnoreCaseAndActivoTrue(...)
- findByTenantIdAndEmailContainingIgnoreCaseAndActivoTrue(...)
```

**3. Service:**
```
com.lealtix.user.service.UserService
- createUser(CreateUserRequest, tenantId): UserDTO
- updateUser(id, UpdateUserRequest, tenantId): UserDTO
- deleteUser(id, tenantId): void
- getUserById(id, tenantId): UserDTO
- listUsers(tenantId, page, pageSize, search): UserListResponse
- getPermissionsForRole(UserRole): List<String>
- mapUserToDTO(User): UserDTO
- mapDTOToUser(CreateUserRequest): User
```

**4. Controller:**
```
com.lealtix.user.controller.UserController
- @RestController
- @RequestMapping("/api/admin/users")
- @PreAuthorize("hasRole('ADMIN')") en CREATE, UPDATE, DELETE
- @PreAuthorize("hasRole('ADMIN')") en GET (leer a todos)
- Implementar GlobalExceptionHandler para manejo de errores
```

**5. Mapper (MapStruct o manual):**
```
UserMapper
- convertToDTO(User): UserDTO
- convertToEntity(CreateUserRequest): User
```

---

### 🔐 SEGURIDAD Y VALIDACIONES

**1. Request Validation:**
Usar @Valid en controlador:
```java
@PostMapping
public ResponseEntity<GenericResponse<UserDTO>> createUser(
    @Valid @RequestBody CreateUserRequest request,
    @RequestHeader("Authorization") String token
)
```

**2. Authorization:**
```java
@PreAuthorize("hasRole('ADMIN')")
@PostMapping
public ResponseEntity<GenericResponse<UserDTO>> createUser(...)

@PreAuthorize("hasRole('ADMIN')")
@PutMapping("/{id}")
public ResponseEntity<GenericResponse<UserDTO>> updateUser(...)

@PreAuthorize("hasRole('ADMIN')")
@DeleteMapping("/{id}")
public ResponseEntity<GenericResponse<Void>> deleteUser(...)
```

**3. Tenant Isolation:**
```
- Extraer tenantId del JWT token o de RequestContext
- Validar que el usuario autenticado pertenezca al mismo tenant
- Filtrar todas las consultas por tenantId
```

**4. Password Encryption:**
```java
@Bean
public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
}

// En servicio:
String hashedPassword = passwordEncoder.encode(request.getContrasena());
```

---

### 🔄 MAPEO DE PERMISOS POR ROL

```java
@Component
public class RolePermissionMapper {
    public static final Map<UserRole, List<String>> PERMISSIONS = Map.ofEntries(
        Map.entry(UserRole.ADMIN, List.of(
            "view_dashboard", "manage_users", "manage_campaigns",
            "manage_categories", "manage_products", "view_reports", "manage_settings"
        )),
        Map.entry(UserRole.MESERO, List.of(
            "view_comanda", "create_order", "edit_own_order"
        )),
        Map.entry(UserRole.COCINA, List.of(
            "view_kitchen_orders", "update_order_status", "view_pending_orders"
        )),
        Map.entry(UserRole.CAJA, List.of(
            "view_sales", "process_payment", "manage_transactions", "view_cash_register"
        )),
        Map.entry(UserRole.MARKETING, List.of(
            "view_campaigns", "create_campaign", "view_analytics", "manage_redemptions"
        ))
    );
    
    public List<String> getPermissionsForRole(UserRole role) {
        return PERMISSIONS.getOrDefault(role, List.of());
    }
}
```

---

### 📊 ESTRUCTURA DE PAQUETES RECOMENDADA

```
com.lealtix.user/
├── controller/
│   └── UserController.java
├── service/
│   ├── UserService.java
│   ├── UserServiceImpl.java
│   └── RolePermissionService.java
├── repository/
│   └── UserRepository.java
├── entity/
│   └── User.java
├── dto/
│   ├── UserDTO.java
│   ├── CreateUserRequest.java
│   └── UpdateUserRequest.java
├── mapper/
│   └── UserMapper.java
├── exception/
│   ├── UserNotFoundException.java
│   ├── DuplicateEmailException.java
│   └── UserServiceException.java
└── validator/
    └── UserValidator.java
```

---

### ⚙️ CONFIGURACIÓN DE APPLICATION.PROPERTIES

```properties
# Seguridad JWT
security.jwt.secret=tu_secret_key_super_segura_aqui
security.jwt.expiration=86400000

# Base de datos - Users
spring.jpa.hibernate.ddl-auto=validate
spring.jpa.show-sql=false
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQL10Dialect

# Logging
logging.level.com.lealtix.user=DEBUG
logging.level.org.springframework.security=INFO
```

---

### 🧪 CASOS DE PRUEBA

**1. Crear usuario válido:**
   - ✓ POST /api/admin/users con datos válidos
   - ✓ Verificar response 201
   - ✓ Contraseña esta encriptada en BD
   - ✓ Permisos asignados correctamente

**2. Validación de email único:**
   - ✗ POST /api/admin/users con email existente en tenant
   - ✓ Response 400 con mensaje de error

**3. Listar con filtro:**
   - ✓ GET /api/admin/users?search=juan
   - ✓ Retorna solo usuarios que coincidan en nombre o email

**4. Eliminar usuario:**
   - ✓ DELETE /api/admin/users/1
   - ✓ Verificar activo=false en BD (soft delete)

**5. Autorización:**
   - ✗ POST como usuario MESERO (sin token válido)
   - ✓ Response 403 Forbidden

---

### 🚀 PRÓXIMOS PASOS SUGERIDOS

1. **Crear entidad User** con validaciones y auditoría
2. **Crear UserRepository** con métodos paginados
3. **Crear UserService** con lógica de negocio
4. **Crear UserController** con endpoints REST
5. **Configurar seguridad** con Spring Security + JWT
6. **Implementar GlobalExceptionHandler** para errores uniformes
7. **Agregar logs** para auditoría y debugging
8. **Crear tests** unitarios y de integración

---

### 📌 NOTAS IMPORTANTES

1. **Respuesta Genérica:** El field debe ser `object` no `data`, para ser consistente con frontend
2. **Permisos Automáticos:** Los permisos se generan según el rol, no se requiere enviarlos en request
3. **Soft Delete:** No eliminar físicamente, solo marcar `activo=false`
4. **Tenant Isolation:** CRÍTICO verificar tenantId en cada operación
5. **Encriptación:** SIEMPRE encriptar contraseña con BCrypt, NUNCA guardar en plain text
6. **Auditoría:** Registrar createdBy, createdAt, updatedBy, updatedAt en cada usuario
7. **Validaciones:** Aplicar en DTO + validaciones adicionales en servicio
8. **Manejo de Errores:** Response consistente con structure GenericResponse
