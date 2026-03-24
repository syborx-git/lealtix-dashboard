# 🔐 Próximos Pasos - Setup Final

## 📋 Estado Actual

La implementación del sistema de permisos está **100% completa**:
- ✅ AuthService con JWT + Roles
- ✅ PermissionGuard para proteger rutas
- ✅ AdminRolesPermissionsComponent UI
- ✅ AuthInterceptor con Bearer token
- ✅ Login funcionando con passwords en **plaintext**

## 🚀 PASO 1: Limpiar Dependencias

Se han removido bcryptjs y sus tipos tipos. Sincroniza npm:

```bash
npm install
```

Esto actualizará node_modules sin las librerías innecesarias.

### Resultado esperado:
```
$ npm install
up to date, audited 1355 packages in X.XXs
```

## ✅ PASO 2: Verificar Compilación

```bash
ng serve
```

**Resultado esperado:**
```
✔ Compiled successfully.
✔ Application bundle generated successfully in X.XXs
```

## 🧪 PASO 3: Probar Login Con Plaintext Password

### Test 3.1: Verificar en Developer Tools

1. Abre http://localhost:4200/auth/login
2. Abre **DevTools → Network tab**
3. Ingresa:
   - Email: `nesedo2586@gxuzi.com`
   - Password: `123qwe` (plaintext)

4. Presiona Login
5. En Network tab, busca la solicitud `login` (POST):
   - Expand **Request body**
   - Debe mostrar: `password: "123qwe"` (plaintext)

**Si ves hasheado:** Algo está mal en login.component.ts

### Test 3.2: Verificar Console

En DevTools → Console, debería estar limpia sin warnings.

## 🔍 PASO 4: Verificar Que Backend Acepta Password Plaintext

El backend debe validar que recibe el password en plaintext:

✅ Frontend envía:
```json
POST /api/tenant/auth/login
{
  "email": "nesedo2586@gxuzi.com",
  "password": "123qwe"
}
```

✅ Backend responde:
```json
{
  "code": 200,
  "message": "Login exitoso",
  "object": {
    "accessToken": "eyJhbGc...",
    "userEmail": "nesedo2586@gxuzi.com",
    "userId": 38,
    "permissions": ["view_menu", "create_order"]
  }
}
```

❌ Si backend rechaza:
```json
{
  "code": 401,
  "message": "Credenciales inválidas"
}
```

**Causa:** Backend espera plaintext o diferente hash. Contacta al team backend.

## 🔐 PASO 5: Verificar Bearer Token

Después de login exitoso, cualquier solicitud API debe incluir el token:

1. En DevTools → Network tab
2. Haz click en cualquier solicitud a `/api/...`
3. Ve a **Request Headers**
4. Busca: `Authorization: Bearer eyJhbGc...`

**Si NO ves:** AuthInterceptor no está funcionando, revisa [auth.interceptor.ts](src/app/interceptors/auth.interceptor.ts)

## ⚙️ PASO 6: Probar PermissionGuard

Intenta acceder a ruta protegida como usuario NO-ADMIN:

```
🔗 URL: http://localhost:4200/dashboard/admin/roles-permissions
```

**Resultado esperado:**

- ✅ Si eres ADMIN → Ve la página
- ✅ Si eres MESERO/COCINA → Ves error o redirect a login

## 📦 PASO 7: Test End-To-End Completo

### Escenario 1: Login → Ir a Dashboard

```
1. Haz logout (limpia localStorage)
2. Login con email + password plaintext
3. Verifica localStorage:
   console.log(localStorage.getItem('accessToken'))
   console.log(JSON.parse(localStorage.getItem('currentUser')))
4. Deberías estar en /dashboard/kpis
```

### Escenario 2: Refresh Token Persiste

```
1. Login exitoso
2. Recarga página (F5)
3. Deberías seguir autenticado (token en localStorage)
4. NO deberías ver login page
5. Refresh debería automáticamente restaurar sesión
```

### Escenario 3: Token Expirado (Mock)

```
1. Login exitoso
2. En DevTools Console:
   localStorage.setItem('accessToken', 'invalid-token')
3. Intenta hacer una solicitud API
4. Deberías ver error 401 → redirect a login
```

## 🆘 Troubleshooting

### ❌ Error: "Cannot find module 'bcryptjs'"

```bash
# Solución:
npm install bcryptjs@^2.4.3

# Si eso no funciona:
rm -r node_modules
rm package-lock.json
npm install
ng serve --poll=2000
```

### ❌ Error: "password is already hashed"

Backend espera texto plano, pero enviamos hash:
```
Contacta backend: "¿Debemos hashear en frontend?"
```

### ❌ No veo "Bcryptjs loaded" en console

```typescript
// En login.component.ts, abre console y ejecuta:
this.loadBcryptLib()  // Si es public method
// O en archivo:
import * as bcrypt from 'bcryptjs'
console.log('bcrypt:', bcrypt)
```

### ❌ Login exitoso pero no redirige

Revisa [login.component.ts](src/app/auth/login/login.component.ts) línea 85+:
```typescript
// Debe redirigir a dashboard
this.router.navigate([...])
```

## 📝 Checklist Final

- [ ] Ejecuté `npm install`
- [ ] Compilación sin errores (`ng serve`)
- [ ] Veo "Bcryptjs loaded" en console
- [ ] Network tab muestra password hasheado (comienza con `$10$`)
- [ ] Backend acepta hash y retorna accessToken
- [ ] Authorization header presente en requests API
- [ ] PermissionGuard bloquea usuarios sin permiso
- [ ] Logout limpia localStorage
- [ ] Login nuevo restaura tokens

## 🎯 Siguientes Fases (Después de Tests)

### Fase 2: Integración Completa
- [ ] Conectar todas las rutas con PermissionGuard
- [ ] Validar permisos en todos los componentes
- [ ] Agregar indicadores visuales de "sin acceso"

### Fase 3: Producción
- [ ] Cambiar localStorage → HttpOnly cookies
- [ ] Configurar HTTPS
- [ ] Rate limiting en login
- [ ] Audit logging

### Fase 4: Mantenimiento
- [ ] Monitoreo de errores de autenticación
- [ ] Análisis de permisos no utilizados
- [ ] Rotación de secretos JWT

---

**¿Tienes dudas?**
```
Si algo falla, proporciona:
1. Error message exacto
2. Output de console.log
3. Response del backend (Network tab)
4. Versión de Node/npm: node -v && npm -v
```

**Última actualización:** Integración bcryptjs completada
**Status:** ✅ Listo para instalar y probar
