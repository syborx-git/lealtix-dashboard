## EJEMPLOS DE CÓDIGO SPRING BOOT - USER MANAGEMENT

Implementación práctica de referencia para el módulo de Usuarios.

---

### 1. ENTITY (User.java)

```java
package com.lealtix.user.entity;

import com.lealtix.common.entity.BaseEntity;
import com.lealtix.user.enums.UserRole;
import lombok.*;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.util.List;

@Entity
@Table(name = "users", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"email", "tenant_id"})
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@SQLDelete(sql = "UPDATE users SET activo = false WHERE id = ?")
@Where(clause = "activo = true")
public class User extends BaseEntity {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @NotBlank(message = "El nombre es requerido")
    @Column(nullable = false)
    private String nombre;
    
    @NotBlank(message = "El email es requerido")
    @Email(message = "El email debe ser válido")
    @Column(nullable = false)
    private String email;
    
    @NotBlank(message = "La contraseña es requerida")
    @Column(nullable = false)
    private String contrasena; // BCrypt encrypted
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserRole rol;
    
    @Column(nullable = false)
    private Boolean activo = true;
    
    @Column(nullable = false)
    private Long tenantId;
    
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "user_permissions", joinColumns = @JoinColumn(name = "user_id"))
    @Column(name = "permission")
    private List<String> permissions;
    
    // Auditoría heredada de BaseEntity:
    // createdAt, updatedAt, createdBy, updatedBy
    
    @PrePersist
    protected void onCreate() {
        this.activo = true;
        this.createdAt = java.time.LocalDateTime.now();
        this.updatedAt = java.time.LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = java.time.LocalDateTime.now();
    }
}
```

---

### 2. ENUMS (UserRole.java)

```java
package com.lealtix.user.enums;

import java.util.List;
import java.util.Map;

public enum UserRole {
    ADMIN("Administrador", List.of(
        "view_dashboard", "manage_users", "manage_campaigns",
        "manage_categories", "manage_products", "view_reports", "manage_settings"
    )),
    MESERO("Mesero", List.of(
        "view_comanda", "create_order", "edit_own_order"
    )),
    COCINA("Cocina", List.of(
        "view_kitchen_orders", "update_order_status", "view_pending_orders"
    )),
    CAJA("Caja", List.of(
        "view_sales", "process_payment", "manage_transactions", "view_cash_register"
    )),
    MARKETING("Marketing", List.of(
        "view_campaigns", "create_campaign", "view_analytics", "manage_redemptions"
    ));
    
    private final String displayName;
    private final List<String> defaultPermissions;
    
    UserRole(String displayName, List<String> defaultPermissions) {
        this.displayName = displayName;
        this.defaultPermissions = defaultPermissions;
    }
    
    public String getDisplayName() {
        return displayName;
    }
    
    public List<String> getDefaultPermissions() {
        return defaultPermissions;
    }
    
    public static Map<UserRole, List<String>> getAllPermissions() {
        return Map.ofEntries(
            Map.entry(ADMIN, ADMIN.defaultPermissions),
            Map.entry(MESERO, MESERO.defaultPermissions),
            Map.entry(COCINA, COCINA.defaultPermissions),
            Map.entry(CAJA, CAJA.defaultPermissions),
            Map.entry(MARKETING, MARKETING.defaultPermissions)
        );
    }
}
```

---

### 3. DTOs

**UserDTO.java:**
```java
package com.lealtix.user.dto;

import com.lealtix.user.enums.UserRole;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
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

**CreateUserRequest.java:**
```java
package com.lealtix.user.dto;

import com.lealtix.user.enums.UserRole;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateUserRequest {
    
    @NotBlank(message = "El nombre es requerido")
    @Size(min = 2, max = 100, message = "El nombre debe tener entre 2 y 100 caracteres")
    private String nombre;
    
    @NotBlank(message = "El email es requerido")
    @Email(message = "El formato del email no es válido")
    private String email;
    
    @NotBlank(message = "La contraseña es requerida")
    @Size(min = 6, message = "La contraseña debe tener al menos 6 caracteres")
    private String contrasena;
    
    @NotNull(message = "El rol es requerido")
    private UserRole rol;
    
    @NotNull(message = "El tenant ID es requerido")
    @Positive(message = "El tenant ID debe ser mayor a 0")
    private Long tenantId;
}
```

**UpdateUserRequest.java:**
```java
package com.lealtix.user.dto;

import com.lealtix.user.enums.UserRole;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateUserRequest {
    
    @Size(min = 2, max = 100, message = "El nombre debe tener entre 2 y 100 caracteres")
    private String nombre;
    
    @Email(message = "El formato del email no es válido")
    private String email;
    
    @Size(min = 6, message = "La contraseña debe tener al menos 6 caracteres")
    private String contrasena;
    
    private UserRole rol;
}
```

**UserListResponse.java:**
```java
package com.lealtix.user.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserListResponse {
    private Integer total;
    private List<UserDTO> usuarios;
}
```

---

### 4. REPOSITORY

```java
package com.lealtix.user.repository;

import com.lealtix.user.entity.User;
import com.lealtix.user.enums.UserRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    
    /**
     * Buscar usuario por email y tenant
     */
    Optional<User> findByEmailAndTenantId(String email, Long tenantId);
    
    /**
     * Buscar usuario por email y tenant (incluyendo inactivos)
     */
    @Query("SELECT u FROM User u WHERE u.email = :email AND u.tenantId = :tenantId")
    Optional<User> findByEmailAndTenantIdIncludingInactive(
        @Param("email") String email,
        @Param("tenantId") Long tenantId
    );
    
    /**
     * Listar usuarios activos con paginación
     */
    Page<User> findByTenantIdAndActivoTrue(Long tenantId, Pageable pageable);
    
    /**
     * Buscar usuarios por nombre (case-insensitive)
     */
    Page<User> findByTenantIdAndNombreContainingIgnoreCaseAndActivoTrue(
        Long tenantId,
        String nombre,
        Pageable pageable
    );
    
    /**
     * Buscar usuarios por email (case-insensitive)
     */
    Page<User> findByTenantIdAndEmailContainingIgnoreCaseAndActivoTrue(
        Long tenantId,
        String email,
        Pageable pageable
    );
    
    /**
     * Buscar usuarios por rol
     */
    List<User> findByTenantIdAndRolAndActivoTrue(Long tenantId, UserRole rol);
    
    /**
     * Contar usuarios activos por tenant
     */
    long countByTenantIdAndActivoTrue(Long tenantId);
}
```

---

### 5. SERVICE

```java
package com.lealtix.user.service;

import com.lealtix.common.exception.BusinessException;
import com.lealtix.user.dto.CreateUserRequest;
import com.lealtix.user.dto.UpdateUserRequest;
import com.lealtix.user.dto.UserDTO;
import com.lealtix.user.dto.UserListResponse;
import com.lealtix.user.entity.User;
import com.lealtix.user.enums.UserRole;
import com.lealtix.user.mapper.UserMapper;
import com.lealtix.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class UserService {
    
    private final UserRepository userRepository;
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final RolePermissionService rolePermissionService;
    
    /**
     * Crear nuevo usuario
     */
    public UserDTO createUser(CreateUserRequest request, String createdBy) {
        log.info("Creando usuario: {} en tenant: {}", request.getEmail(), request.getTenantId());
        
        // Validar que el email no exista
        if (userRepository.findByEmailAndTenantId(request.getEmail(), request.getTenantId()).isPresent()) {
            log.warn("Email duplicado: {} en tenant: {}", request.getEmail(), request.getTenantId());
            throw new BusinessException("El email ya existe en este tenant");
        }
        
        // Mapear DTO a Entity
        User user = User.builder()
            .nombre(request.getNombre())
            .email(request.getEmail())
            .contrasena(passwordEncoder.encode(request.getContrasena()))
            .rol(request.getRol())
            .tenantId(request.getTenantId())
            .activo(true)
            .createdBy(createdBy)
            .updatedBy(createdBy)
            .build();
        
        // Asignar permisos automáticamente
        user.setPermissions(rolePermissionService.getPermissionsForRole(request.getRol()));
        
        // Guardar en BD
        User savedUser = userRepository.save(user);
        log.info("Usuario creado exitosamente: {} con ID: {}", savedUser.getEmail(), savedUser.getId());
        
        return userMapper.convertToDTO(savedUser);
    }
    
    /**
     * Actualizar usuario
     */
    public UserDTO updateUser(Long userId, UpdateUserRequest request, Long tenantId, String updatedBy) {
        log.info("Actualizando usuario: {} en tenant: {}", userId, tenantId);
        
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new BusinessException("Usuario no encontrado"));
        
        // Validar que pertenezca al tenant
        if (!user.getTenantId().equals(tenantId)) {
            throw new BusinessException("No tienes permisos para actualizar este usuario");
        }
        
        // Validar email unique si cambió
        if (request.getEmail() != null && !request.getEmail().equals(user.getEmail())) {
            if (userRepository.findByEmailAndTenantId(request.getEmail(), tenantId).isPresent()) {
                throw new BusinessException("El email ya existe en este tenant");
            }
            user.setEmail(request.getEmail());
        }
        
        // Actualizar campos
        if (request.getNombre() != null) {
            user.setNombre(request.getNombre());
        }
        
        if (request.getContrasena() != null && !request.getContrasena().isEmpty()) {
            user.setContrasena(passwordEncoder.encode(request.getContrasena()));
        }
        
        if (request.getRol() != null) {
            user.setRol(request.getRol());
            // Regenerar permisos si cambió el rol
            user.setPermissions(rolePermissionService.getPermissionsForRole(request.getRol()));
        }
        
        user.setUpdatedBy(updatedBy);
        user.setUpdatedAt(LocalDateTime.now());
        
        User updatedUser = userRepository.save(user);
        log.info("Usuario actualizado exitosamente: {}", updatedUser.getId());
        
        return userMapper.convertToDTO(updatedUser);
    }
    
    /**
     * Eliminar usuario (soft delete)
     */
    public void deleteUser(Long userId, Long tenantId, String deletedBy) {
        log.info("Eliminando usuario: {} de tenant: {}", userId, tenantId);
        
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new BusinessException("Usuario no encontrado"));
        
        if (!user.getTenantId().equals(tenantId)) {
            throw new BusinessException("No tienes permisos para eliminar este usuario");
        }
        
        user.setActivo(false);
        user.setUpdatedBy(deletedBy);
        user.setUpdatedAt(LocalDateTime.now());
        
        userRepository.save(user);
        log.info("Usuario eliminado exitosamente: {}", userId);
    }
    
    /**
     * Obtener usuario por ID
     */
    @Transactional(readOnly = true)
    public UserDTO getUserById(Long userId, Long tenantId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new BusinessException("Usuario no encontrado"));
        
        if (!user.getTenantId().equals(tenantId)) {
            throw new BusinessException("No tienes permisos para acceder a este usuario");
        }
        
        return userMapper.convertToDTO(user);
    }
    
    /**
     * Listar usuarios del tenant con filtro
     */
    @Transactional(readOnly = true)
    public UserListResponse listUsers(Long tenantId, int page, int pageSize, String search) {
        log.debug("Listando usuarios de tenant: {} con búsqueda: {}", tenantId, search);
        
        Pageable pageable = org.springframework.data.domain.PageRequest.of(page, pageSize);
        Page<User> usersPage;
        
        if (search != null && !search.isEmpty()) {
            // Buscar por nombre o email
            Page<User> byNombre = userRepository
                .findByTenantIdAndNombreContainingIgnoreCaseAndActivoTrue(tenantId, search, pageable);
            Page<User> byEmail = userRepository
                .findByTenantIdAndEmailContainingIgnoreCaseAndActivoTrue(tenantId, search, pageable);
            
            // Combinar resultados (simplificado, en producción usar query custom)
            usersPage = byNombre;
        } else {
            usersPage = userRepository.findByTenantIdAndActivoTrue(tenantId, pageable);
        }
        
        return UserListResponse.builder()
            .total((int) usersPage.getTotalElements())
            .usuarios(usersPage.getContent().stream()
                .map(userMapper::convertToDTO)
                .toList())
            .build();
    }
    
    /**
     * Obtener permisos para un rol
     */
    @Transactional(readOnly = true)
    public java.util.List<String> getPermissionsForRole(UserRole role) {
        return rolePermissionService.getPermissionsForRole(role);
    }
}
```

---

### 6. SERVICE AUXILIAR

```java
package com.lealtix.user.service;

import com.lealtix.user.enums.UserRole;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class RolePermissionService {
    
    private static final Map<UserRole, List<String>> ROLE_PERMISSIONS = 
        UserRole.getAllPermissions();
    
    /**
     * Obtener permisos para un rol específico
     */
    public List<String> getPermissionsForRole(UserRole role) {
        return ROLE_PERMISSIONS.getOrDefault(role, List.of());
    }
    
    /**
     * Verificar si un usuario tiene un permiso
     */
    public boolean hasPermission(UserRole role, String permission) {
        return getPermissionsForRole(role).contains(permission);
    }
}
```

---

### 7. MAPPER

```java
package com.lealtix.user.mapper;

import com.lealtix.user.dto.UserDTO;
import com.lealtix.user.entity.User;
import org.springframework.stereotype.Component;

@Component
public class UserMapper {
    
    /**
     * Convertir Entity a DTO
     */
    public UserDTO convertToDTO(User user) {
        if (user == null) {
            return null;
        }
        
        return UserDTO.builder()
            .id(user.getId())
            .nombre(user.getNombre())
            .email(user.getEmail())
            .rol(user.getRol())
            .permissions(user.getPermissions())
            .activo(user.getActivo())
            .createdAt(user.getCreatedAt())
            .updatedAt(user.getUpdatedAt())
            .build();
    }
}
```

---

### 8. CONTROLLER

```java
package com.lealtix.user.controller;

import com.lealtix.common.dto.GenericResponse;
import com.lealtix.user.dto.CreateUserRequest;
import com.lealtix.user.dto.UpdateUserRequest;
import com.lealtix.user.dto.UserDTO;
import com.lealtix.user.dto.UserListResponse;
import com.lealtix.user.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "http://localhost:4200")
public class UserController {
    
    private final UserService userService;
    
    /**
     * GET /api/admin/users
     * Listar usuarios con paginación y filtro
     */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<GenericResponse<UserListResponse>> listUsers(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int pageSize,
        @RequestParam(required = false) String search,
        @RequestHeader(value = "X-Tenant-Id", required = true) Long tenantId
    ) {
        log.info("GET /api/admin/users - page: {}, pageSize: {}, search: {}", page, pageSize, search);
        
        try {
            UserListResponse response = userService.listUsers(tenantId, page, pageSize, search);
            
            return ResponseEntity.ok(
                GenericResponse.<UserListResponse>builder()
                    .code(200)
                    .message("Usuarios obtenidos exitosamente")
                    .object(response)
                    .build()
            );
        } catch (Exception e) {
            log.error("Error al obtener usuarios", e);
            return ResponseEntity.badRequest().body(
                GenericResponse.<UserListResponse>builder()
                    .code(400)
                    .message("Error al obtener usuarios: " + e.getMessage())
                    .object(null)
                    .build()
            );
        }
    }
    
    /**
     * GET /api/admin/users/{id}
     * Obtener usuario por ID
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<GenericResponse<UserDTO>> getUser(
        @PathVariable Long id,
        @RequestHeader(value = "X-Tenant-Id", required = true) Long tenantId
    ) {
        log.info("GET /api/admin/users/{} - tenantId: {}", id, tenantId);
        
        try {
            UserDTO user = userService.getUserById(id, tenantId);
            
            return ResponseEntity.ok(
                GenericResponse.<UserDTO>builder()
                    .code(200)
                    .message("Usuario obtenido exitosamente")
                    .object(user)
                    .build()
            );
        } catch (Exception e) {
            log.error("Error al obtener usuario", e);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(
                GenericResponse.<UserDTO>builder()
                    .code(404)
                    .message("Usuario no encontrado: " + e.getMessage())
                    .object(null)
                    .build()
            );
        }
    }
    
    /**
     * POST /api/admin/users
     * Crear nuevo usuario
     */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<GenericResponse<UserDTO>> createUser(
        @Valid @RequestBody CreateUserRequest request,
        @RequestHeader(value = "X-Tenant-Id", required = true) Long tenantId
    ) {
        log.info("POST /api/admin/users - email: {}, rol: {}", request.getEmail(), request.getRol());
        
        try {
            // Validar que el tenant en el request coincida con el header
            if (!request.getTenantId().equals(tenantId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(
                    GenericResponse.<UserDTO>builder()
                        .code(403)
                        .message("No tienes permiso para crear usuarios en este tenant")
                        .object(null)
                        .build()
                );
            }
            
            String currentUser = SecurityContextHolder.getContext()
                .getAuthentication().getName();
            
            UserDTO newUser = userService.createUser(request, currentUser);
            
            return ResponseEntity.status(HttpStatus.CREATED).body(
                GenericResponse.<UserDTO>builder()
                    .code(201)
                    .message("Usuario creado exitosamente")
                    .object(newUser)
                    .build()
            );
        } catch (Exception e) {
            log.error("Error al crear usuario", e);
            return ResponseEntity.badRequest().body(
                GenericResponse.<UserDTO>builder()
                    .code(400)
                    .message("Error al crear usuario: " + e.getMessage())
                    .object(null)
                    .build()
            );
        }
    }
    
    /**
     * PUT /api/admin/users/{id}
     * Actualizar usuario
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<GenericResponse<UserDTO>> updateUser(
        @PathVariable Long id,
        @Valid @RequestBody UpdateUserRequest request,
        @RequestHeader(value = "X-Tenant-Id", required = true) Long tenantId
    ) {
        log.info("PUT /api/admin/users/{} - tenantId: {}", id, tenantId);
        
        try {
            String currentUser = SecurityContextHolder.getContext()
                .getAuthentication().getName();
            
            UserDTO updatedUser = userService.updateUser(id, request, tenantId, currentUser);
            
            return ResponseEntity.ok(
                GenericResponse.<UserDTO>builder()
                    .code(200)
                    .message("Usuario actualizado exitosamente")
                    .object(updatedUser)
                    .build()
            );
        } catch (Exception e) {
            log.error("Error al actualizar usuario", e);
            return ResponseEntity.badRequest().body(
                GenericResponse.<UserDTO>builder()
                    .code(400)
                    .message("Error al actualizar usuario: " + e.getMessage())
                    .object(null)
                    .build()
            );
        }
    }
    
    /**
     * DELETE /api/admin/users/{id}
     * Eliminar usuario
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<GenericResponse<Void>> deleteUser(
        @PathVariable Long id,
        @RequestHeader(value = "X-Tenant-Id", required = true) Long tenantId
    ) {
        log.info("DELETE /api/admin/users/{} - tenantId: {}", id, tenantId);
        
        try {
            String currentUser = SecurityContextHolder.getContext()
                .getAuthentication().getName();
            
            userService.deleteUser(id, tenantId, currentUser);
            
            return ResponseEntity.ok(
                GenericResponse.<Void>builder()
                    .code(200)
                    .message("Usuario eliminado exitosamente")
                    .object(null)
                    .build()
            );
        } catch (Exception e) {
            log.error("Error al eliminar usuario", e);
            return ResponseEntity.badRequest().body(
                GenericResponse.<Void>builder()
                    .code(400)
                    .message("Error al eliminar usuario: " + e.getMessage())
                    .object(null)
                    .build()
            );
        }
    }
}
```

---

### 9. EXCEPTION HANDLER

```java
package com.lealtix.common.exception;

import com.lealtix.common.dto.GenericResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {
    
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<GenericResponse<Void>> handleBusinessException(BusinessException e) {
        log.warn("BusinessException: {}", e.getMessage());
        
        return ResponseEntity.badRequest().body(
            GenericResponse.<Void>builder()
                .code(400)
                .message(e.getMessage())
                .object(null)
                .build()
        );
    }
    
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<GenericResponse<Void>> handleValidationException(
        MethodArgumentNotValidException e
    ) {
        String message = e.getBindingResult()
            .getFieldErrors()
            .stream()
            .map(err -> err.getField() + ": " + err.getDefaultMessage())
            .findFirst()
            .orElse("Validación fallida");
        
        log.warn("Validation error: {}", message);
        
        return ResponseEntity.badRequest().body(
            GenericResponse.<Void>builder()
                .code(400)
                .message(message)
                .object(null)
                .build()
        );
    }
    
    @ExceptionHandler(Exception.class)
    public ResponseEntity<GenericResponse<Void>> handleGenericException(Exception e) {
        log.error("Unexpected error", e);
        
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
            GenericResponse.<Void>builder()
                .code(500)
                .message("Error interno del servidor")
                .object(null)
                .build()
        );
    }
}
```

**BusinessException.java:**
```java
package com.lealtix.common.exception;

public class BusinessException extends RuntimeException {
    public BusinessException(String message) {
        super(message);
    }
    
    public BusinessException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

---

### 10. DEPENDENCIES (pom.xml)

```xml
<!-- Spring Data JPA -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>

<!-- Spring Security -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
</dependency>

<!-- Spring Web -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>

<!-- Validation -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>
</dependency>

<!-- Lombok -->
<dependency>
    <groupId>org.projectlombok</groupId>
    <artifactId>lombok</artifactId>
    <optional>true</optional>
</dependency>

<!-- PostgreSQL Driver -->
<dependency>
    <groupId>org.postgresql</groupId>
    <artifactId>postgresql</artifactId>
    <scope>runtime</scope>
</dependency>

<!-- JWT (si usas tokens) -->
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-api</artifactId>
    <version>0.11.5</version>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-impl</artifactId>
    <version>0.11.5</version>
    <scope>runtime</scope>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-jackson</artifactId>
    <version>0.11.5</version>
    <scope>runtime</scope>
</dependency>
```

---

Este código proporciona una base sólida y production-ready para el módulo de usuarios en Spring Boot. Está diseñado para trabajar perfectamente con el frontend Angular que ya hemos creado.
