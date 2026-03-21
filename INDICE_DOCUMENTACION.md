# ÍNDICE DE DOCUMENTACIÓN - USER MANAGEMENT LEALTIX

Referencia completa de todos los archivos generados para el módulo de Gestión de Usuarios.

---

## 📂 ARCHIVOS DE DOCUMENTACIÓN SPRING BOOT

| Archivo | Contenido | Para Qué Usar |
|---------|----------|--------------|
| **SPRING_BOOT_USER_MANAGEMENT_PROMPT.md** | 📋 Especificación detallada | Leer primero para entender requisitos completos |
| **SPRING_BOOT_USER_MANAGEMENT_EJEMPLOS.md** | 💻 Código Spring Boot completo | Copiar y adaptar el código para tu proyecto |
| **SPRING_BOOT_QUICK_START.md** | ⚡ Guía rápida paso-a-paso | Implementación rápida, checklist |
| **PROMPT_CHATGPT_COPIAR_PEGAR.md** | 🤖 Prompts listos para LLM | Generar código automático con ChatGPT/Claude |

---

## 📄 ARCHIVOS GENERADOS EN ANGULAR

| Archivo | Ruta | Para Qué Sirve |
|---------|------|--------|
| **user.model.ts** | `src/app/models/` | Enums, interfaces, permisos (UserRole, UserDTO, etc) |
| **user.service.ts** | `src/app/pages/user-management/services/` | Lógica de HTTP calls al backend |
| **user-management.component.ts** | `src/app/pages/user-management/` | Componente principal con CRUD |
| **user-management.component.html** | `src/app/pages/user-management/` | Template con tabla y dialog |
| **user-management.component.scss** | `src/app/pages/user-management/` | Estilos PrimeNG + Tailwind |
| **has-role.directive.ts** | `src/app/shared/directives/` | Control de visibilidad por rol |
| **README.md** | `src/app/pages/user-management/` | Documentación del módulo Angular |

---

## 🔗 FLUJO DE INTEGRACIÓN FRONTEND-BACKEND

```
FRONTEND ANGULAR (Ya generado)                BACKEND SPRING BOOT (Pendiente)
════════════════════════════════════════════════════════════════════════════

UserService                                    UserController
  ↓                                                    ↓
[GET /api/admin/users?page=0&pageSize=10]  →  [GET /api/admin/users]
                                                 UserService.listUsers()
[POST /api/admin/users]                     →  [POST /api/admin/users]
CreateUserRequest {...}                        UserService.createUser()
                                                 → Encriptar, validar tenant
[PUT /api/admin/users/{id}]                 →  [PUT /api/admin/users/{id}]
UpdateUserRequest {...}                        UserService.updateUser()
                                                 → Validar permisos
[DELETE /api/admin/users/{id}]              →  [DELETE /api/admin/users/{id}]
                                                 UserService.deleteUser()
                                                 → Soft delete (activo=false)

Response siempre:
GenericResponse<T> {
  code: 200/201/400/404,
  message: "...",
  object: {...}  ← ¡IMPORTANTE! No 'data'
}
```

---

## 📖 CÓMO USAR ESTA DOCUMENTACIÓN

### Escenario 1: "Necesito implementar los servicios en Spring Boot"

1. **Lee primero:** `SPRING_BOOT_USER_MANAGEMENT_PROMPT.md`
   - Entiende qué necesitas implementar
   - Revisa la estructura de requests/responses

2. **Luego mira:** `SPRING_BOOT_USER_MANAGEMENT_EJEMPLOS.md`
   - Ve el código Spring Boot completo
   - Copia y adapta a tu proyecto

3. **O usa:** `PROMPT_CHATGPT_COPIAR_PEGAR.md`
   - Copias el prompt
   - Lo pasas a ChatGPT/Claude
   - Te genera el código automáticamente

4. **Implementa:** `SPRING_BOOT_QUICK_START.md`
   - Sigue el checklist paso-a-paso
   - Testa con los ejemplos de Postman

---

### Escenario 2: "Necesito saber qué estructura de DTOs espera el frontend"

1. Abre: `src/app/models/user.model.ts`
   - Ve exactamente qué interfaces necesita
   
2. Revisa: `SPRING_BOOT_USER_MANAGEMENT_PROMPT.md` → Sección "DTOs Y MODELOS"
   - Entiende cómo mapear tus entidades a los DTOs

---

### Escenario 3: "El frontend no conecta al backend, qué falta?"

1. Checklist de verificación en `SPRING_BOOT_QUICK_START.md`:
   - ¿Endpoints implementados?
   - ¿Puerto correcto (8080)?
   - ¿GenericResponse con 'object'?
   - ¿CORS habilitado?

2. Revisa `src/app/pages/user-management/services/user.service.ts`:
   - Línea 14: `const baseUrl = ${environment.apiUrl}/admin/users`
   - Verifica que tu backend esté en esa URL

---

### Escenario 4: "Necesito validar que el backend está bien implementado"

1. Usa los ejemplos de Postman en: `SPRING_BOOT_QUICK_START.md` → "TESTING CON POSTMAN"
2. Verifica los 5 endpoints:
   - GET (listar)
   - GET (por ID)
   - POST (crear)
   - PUT (actualizar)
   - DELETE (eliminar)

---

### Escenario 5: "Quiero extender el módulo con nuevas funcionalidades"

1. Para FRONTEND: modifica `src/app/pages/user-management/`
2. Para BACKEND: modifica según estructura en `SPRING_BOOT_USER_MANAGEMENT_EJEMPLOS.md`
3. Mantén compatible el `GenericResponse<object>`

---

## 🎯 ESTRUCTURA RECOMENDADA DE TU PROYECTO SPRING BOOT

```
src/main/java/com/lealtix/
├── user/                                  (Nuevo módulo)
│   ├── controller/
│   │   └── UserController.java
│   ├── service/
│   │   ├── UserService.java
│   │   └── RolePermissionService.java
│   ├── repository/
│   │   └── UserRepository.java
│   ├── entity/
│   │   └── User.java
│   ├── dto/
│   │   ├── UserDTO.java
│   │   ├── CreateUserRequest.java
│   │   ├── UpdateUserRequest.java
│   │   └── UserListResponse.java
│   ├── mapper/
│   │   └── UserMapper.java
│   └── enums/
│       └── UserRole.java
├── common/                                (Existente)
│   ├── dto/
│   │   └── GenericResponse.java           (Reutilizar)
│   └── exception/
│       ├── GlobalExceptionHandler.java    (Reutilizar)
│       └── BusinessException.java         (Reutilizar)
```

---

## 📊 MAPEO DE RESPONSABILIDADES

### Usuario de Lealtix (Administrador)
**Acciones:** Crear, editar, eliminar usuarios de su tenant
**Interfaz:** `/dashboard/users` en Angular
**Backend:** POST/PUT/DELETE `/api/admin/users` con @PreAuthorize ADMIN

### Usuario de Lealtix (Mesero/Cocina/Caja)
**Acciones:** Ver su perfil (lectura), cambiar contraseña
**Interfaz:** Perfil de usuario (no incluido en este módulo)
**Backend:** GET `/api/users/me` (sin el /admin/)

---

## 🔐 SEGURIDAD - CHECKLIST

- [ ] Contraseñas encriptadas con BCrypt
- [ ] JWT tokens validados
- [ ] @PreAuthorize en endpoints CRUD
- [ ] Validación de tenantId en cada operación
- [ ] Soft delete para datos históricos
- [ ] Auditoría: createdBy, updatedBy, timestamps
- [ ] Email único por tenant
- [ ] CORS configurado solo para localhost:4200
- [ ] SQL Injection prevención (usar JPA, evitar queries raw)

---

## 🧪 TESTING - COMANDOS ÚTILES

```bash
# Test de creación
curl -X POST http://localhost:8080/api/admin/users \
  -H "Authorization: Bearer TOKEN" \
  -H "X-Tenant-Id: 1" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Test User",
    "email": "test@example.com",
    "contrasena": "Pass123456",
    "rol": "MESERO",
    "tenantId": 1
  }'

# Test de listado
curl http://localhost:8080/api/admin/users?page=0&pageSize=10 \
  -H "Authorization: Bearer TOKEN" \
  -H "X-Tenant-Id: 1"
```

---

## 📞 REFERENCIAS CRUZADAS

### Si necesitas informacion sobre...

**Roles y permisos:**
- Ver: `SPRING_BOOT_USER_MANAGEMENT_PROMPT.md` → "🔄 MAPEO DE PERMISOS POR ROL"
- O: `src/app/models/user.model.ts` → `ROLE_PERMISSIONS` constant

**Estructura de endpoints:**
- Ver: `SPRING_BOOT_USER_MANAGEMENT_PROMPT.md` → "📋 ESPECIFICACIÓN DE ENDPOINTS"

**Código de ejemplo:**
- Ver: `SPRING_BOOT_USER_MANAGEMENT_EJEMPLOS.md` → Cualquier sección

**Errores comunes:**
- Ver: `SPRING_BOOT_QUICK_START.md` → "🔗 TROUBLESHOOTING"

**Componente Angular:**
- Ver: `src/app/pages/user-management/README.md`

---

## ⚡ QUICKLINKS IMPORTANTES

| Necesito... | Ir a... |
|-------------|---------|
| Generar código automáticamente | PROMPT_CHATGPT_COPIAR_PEGAR.md |
| Entender la especificación completa | SPRING_BOOT_USER_MANAGEMENT_PROMPT.md |
| Ver código de ejemplo | SPRING_BOOT_USER_MANAGEMENT_EJEMPLOS.md |
| Implementar rápido | SPRING_BOOT_QUICK_START.md |
| Entender el frontend Angular | src/app/pages/user-management/README.md |
| Ver los DTOs | src/app/models/user.model.ts |

---

## 📈 PROGRESO ESPERADO

**Fase 1 - Frontend (COMPLETADO ✅)**
- [x] Component CRUD
- [x] Tablas y diálogos
- [x] Validaciones formulario
- [x] Directiva RBAC

**Fase 2 - Backend (TÚ ESTÁS AQUÍ)**
- [ ] Entidades JPA
- [ ] Repositorios
- [ ] Servicios
- [ ] Controllers
- [ ] Tests

**Fase 3 - Integración**
- [ ] Conectar frontend ↔ backend
- [ ] Tests E2E
- [ ] Deploy

---

## 🚀 PRÓXIMOS PASOS

1. **Lee** `SPRING_BOOT_USER_MANAGEMENT_PROMPT.md` completamente
2. **Elige** entre:
   - Opción A: Usar `PROMPT_CHATGPT_COPIAR_PEGAR.md` (rápido)
   - Opción B: Copiar ejemplos de `SPRING_BOOT_USER_MANAGEMENT_EJEMPLOS.md` (aprender)
3. **Implementa** siguiendo `SPRING_BOOT_QUICK_START.md`
4. **Testa** con postman/curl
5. **Integra** con frontend

---

**Documento generado:** 2026-03-21  
**Última actualización:** Ver commits de git  
**Mantener en sync:** Si cambias frontend/backend, actualiza la otra parte
