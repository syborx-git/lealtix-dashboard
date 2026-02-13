# API Endpoints - Gestión de Clientes

Este documento describe los endpoints necesarios para implementar en el Backend para el módulo de **Gestión de Clientes**.

---

## 📋 Tabla de Contenidos

1. [Listar Clientes (con Paginación y Filtros)](#1-listar-clientes-con-paginación-y-filtros)
2. [Obtener Cliente por ID](#2-obtener-cliente-por-id)
3. [Crear Nuevo Cliente](#3-crear-nuevo-cliente)
4. [Actualizar Cliente](#4-actualizar-cliente)
5. [Eliminar Cliente](#5-eliminar-cliente)
6. [Carga Masiva de Clientes (CSV/XLSX)](#6-carga-masiva-de-clientes-csvxlsx)
7. [Modelos de Datos](#7-modelos-de-datos)

---

## 1. Listar Clientes (con Paginación y Filtros)

### **GET** `/api/clientes`

Obtiene una lista paginada de clientes filtrada por tenantId y opcionalmente por email.

#### Query Parameters:
```
tenantId: number (requerido)
email: string (opcional)
page: number (opcional, default: 0)
pageSize: number (opcional, default: 10)
```

#### Request Example:
```
GET /api/clientes?tenantId=123&email=juan@example.com&page=0&pageSize=10
```

#### Response Success (200 OK):
```json
{
  "success": true,
  "message": "Clientes obtenidos exitosamente",
  "object": {
    "content": [
      {
        "id": 1,
        "tenantId": 123,
        "nombreCompleto": "Juan Pérez García",
        "email": "juan@example.com",
        "fechaNacimiento": "1990-05-15",
        "genero": "Hombre",
        "telefono": "555-123-456",
        "activo": true,
        "fechaCreacion": "2024-01-15T10:30:00",
        "fechaActualizacion": "2024-01-15T10:30:00"
      },
      {
        "id": 2,
        "tenantId": 123,
        "nombreCompleto": "María López",
        "email": "maria@example.com",
        "fechaNacimiento": "1985-08-22",
        "genero": "Mujer",
        "telefono": null,
        "activo": true,
        "fechaCreacion": "2024-01-16T14:20:00",
        "fechaActualizacion": null
      }
    ],
    "totalElements": 45,
    "totalPages": 5,
    "currentPage": 0,
    "pageSize": 10
  }
}
```

#### Response Error (400 Bad Request):
```json
{
  "success": false,
  "message": "TenantId es requerido",
  "object": null
}
```

---

## 2. Obtener Cliente por ID

### **GET** `/api/clientes/{id}`

Obtiene un cliente específico por su ID.

#### Path Parameters:
```
id: number (requerido)
```

#### Request Example:
```
GET /api/clientes/1
```

#### Response Success (200 OK):
```json
{
  "success": true,
  "message": "Cliente encontrado",
  "object": {
    "id": 1,
    "tenantId": 123,
    "nombreCompleto": "Juan Pérez García",
    "email": "juan@example.com",
    "fechaNacimiento": "1990-05-15",
    "genero": "Hombre",
    "telefono": "555-123-456",
    "activo": true,
    "fechaCreacion": "2024-01-15T10:30:00",
    "fechaActualizacion": "2024-01-15T10:30:00"
  }
}
```

#### Response Error (404 Not Found):
```json
{
  "success": false,
  "message": "Cliente no encontrado",
  "object": null
}
```

---

## 3. Crear Nuevo Cliente

### **POST** `/api/clientes`

Crea un nuevo cliente en el sistema.

#### Request Body:
```json
{
  "nombreCompleto": "Juan Pérez García",
  "email": "juan@example.com",
  "fechaNacimiento": "1990-05-15",
  "genero": "Hombre",
  "telefono": "555-123-456"
}
```

**Campos Opcionales:**
- `telefono`: string | null

**Validaciones:**
- `nombreCompleto`: requerido, mínimo 3 caracteres
- `email`: requerido, formato válido de email, único por tenantId
- `fechaNacimiento`: requerido, formato YYYY-MM-DD, fecha válida
- `genero`: requerido, enum ["Hombre", "Mujer", "Otro"]
- `telefono`: opcional, máximo 20 caracteres

#### Response Success (201 Created):
```json
{
  "success": true,
  "message": "Cliente creado exitosamente",
  "object": {
    "id": 15,
    "tenantId": 123,
    "nombreCompleto": "Juan Pérez García",
    "email": "juan@example.com",
    "fechaNacimiento": "1990-05-15",
    "genero": "Hombre",
    "telefono": "555-123-456",
    "activo": true,
    "fechaCreacion": "2024-02-07T15:45:00",
    "fechaActualizacion": null
  }
}
```

#### Response Error (400 Bad Request):
```json
{
  "success": false,
  "message": "El email ya está registrado para este tenant",
  "object": null
}
```

---

## 4. Actualizar Cliente

### **PUT** `/api/clientes/{id}`

Actualiza la información de un cliente existente.

#### Path Parameters:
```
id: number (requerido)
```

#### Request Body:
```json
{
  "nombreCompleto": "Juan Pérez García",
  "email": "juan.nuevo@example.com",
  "fechaNacimiento": "1990-05-15",
  "genero": "Hombre",
  "telefono": "555-999-888",
  "activo": true
}
```

**Nota:** Todos los campos son opcionales, solo se actualizarán los campos proporcionados.

#### Response Success (200 OK):
```json
{
  "success": true,
  "message": "Cliente actualizado exitosamente",
  "object": {
    "id": 15,
    "tenantId": 123,
    "nombreCompleto": "Juan Pérez García",
    "email": "juan.nuevo@example.com",
    "fechaNacimiento": "1990-05-15",
    "genero": "Hombre",
    "telefono": "555-999-888",
    "activo": true,
    "fechaCreacion": "2024-02-07T15:45:00",
    "fechaActualizacion": "2024-02-07T16:20:00"
  }
}
```

#### Response Error (404 Not Found):
```json
{
  "success": false,
  "message": "Cliente no encontrado",
  "object": null
}
```

---

## 5. Eliminar Cliente

### **DELETE** `/api/clientes/{id}`

Elimina un cliente del sistema (soft delete - marca como inactivo).

#### Path Parameters:
```
id: number (requerido)
```

#### Request Example:
```
DELETE /api/clientes/15
```

#### Response Success (200 OK):
```json
{
  "success": true,
  "message": "Cliente eliminado exitosamente",
  "object": null
}
```

#### Response Error (404 Not Found):
```json
{
  "success": false,
  "message": "Cliente no encontrado",
  "object": null
}
```

---

## 6. Carga Masiva de Clientes (CSV/XLSX)

### **POST** `/api/clientes/bulk-upload`

Carga múltiples clientes desde un archivo CSV o XLSX.

#### Query Parameters:
```
tenantId: number (requerido)
```

#### Request Body:
```json
{
  "clientes": [
    {
      "nombreCompleto": "Juan Pérez",
      "email": "juan@example.com",
      "fechaNacimiento": "1990-05-15",
      "genero": "Hombre",
      "telefono": "555-123-456"
    },
    {
      "nombreCompleto": "María López",
      "email": "maria@example.com",
      "fechaNacimiento": "1985-08-22",
      "genero": "Mujer",
      "telefono": null
    },
    {
      "nombreCompleto": "Carlos Rodríguez",
      "email": "carlos@example.com",
      "fechaNacimiento": "1992-12-10",
      "genero": "Hombre",
      "telefono": "555-789-012"
    }
  ]
}
```

#### Response Success (200 OK):
```json
{
  "success": true,
  "message": "Carga masiva completada",
  "object": {
    "exitosos": 2,
    "fallidos": 1,
    "errores": [
      {
        "indice": 1,
        "mensaje": "El email maria@example.com ya está registrado"
      }
    ]
  }
}
```

#### Response Error (400 Bad Request):
```json
{
  "success": false,
  "message": "La lista de clientes no puede estar vacía",
  "object": null
}
```

**Notas de Implementación:**
- El endpoint debe procesar cada cliente de forma independiente
- Si un cliente falla, debe continuar con los demás
- Debe retornar un reporte detallado de éxitos y fallos
- Validaciones individuales por cada cliente (email único, formatos válidos, etc.)

---

## 7. Modelos de Datos

### Cliente (Entity)
```typescript
{
  id: number;                    // Auto-generado
  tenantId: number;              // Relación con Tenant
  nombreCompleto: string;        // Nombre completo del cliente
  email: string;                 // Email único por tenantId
  fechaNacimiento: string;       // Formato YYYY-MM-DD
  genero: "Hombre" | "Mujer" | "Otro";
  telefono: string | null;       // Opcional
  activo: boolean;               // Para soft-delete
  fechaCreacion: string;         // ISO 8601 timestamp
  fechaActualizacion: string | null; // ISO 8601 timestamp
}
```

### CreateClienteRequest
```typescript
{
  nombreCompleto: string;        // Requerido
  email: string;                 // Requerido, válido
  fechaNacimiento: string;       // Requerido, YYYY-MM-DD
  genero: "Hombre" | "Mujer" | "Otro"; // Requerido
  telefono?: string;             // Opcional
}
```

### UpdateClienteRequest
```typescript
{
  nombreCompleto?: string;
  email?: string;
  fechaNacimiento?: string;
  genero?: "Hombre" | "Mujer" | "Otro";
  telefono?: string;
  activo?: boolean;
}
```

### ClienteListResponse
```typescript
{
  content: Cliente[];            // Lista de clientes
  totalElements: number;         // Total de registros
  totalPages: number;            // Total de páginas
  currentPage: number;           // Página actual (0-indexed)
  pageSize: number;              // Tamaño de página
}
```

### BulkUploadClienteResponse
```typescript
{
  exitosos: number;              // Número de clientes creados
  fallidos: number;              // Número de clientes que fallaron
  errores: Array<{               // Detalles de errores
    indice: number;
    mensaje: string;
  }>;
}
```

### GenericResponse<T>
```typescript
{
  success: boolean;
  message: string;
  object: T | null;
}
```

---

## 🔒 Seguridad y Validaciones

### Autenticación
Todos los endpoints requieren autenticación mediante JWT token en el header:
```
Authorization: Bearer <token>
```

### Validaciones Requeridas

1. **Email:**
   - Formato válido
   - Único por tenantId
   - Máximo 100 caracteres

2. **Nombre Completo:**
   - Mínimo 3 caracteres
   - Máximo 100 caracteres

3. **Fecha de Nacimiento:**
   - Formato YYYY-MM-DD
   - Fecha válida
   - No puede ser futura

4. **Género:**
   - Solo valores: "Hombre", "Mujer", "Otro"

5. **Teléfono:**
   - Opcional
   - Máximo 20 caracteres

6. **TenantId:**
   - Debe coincidir con el tenant del usuario autenticado
   - Validar acceso a recursos del tenant

---

## 📝 Notas de Implementación

1. **Paginación:** Implementar paginación eficiente para grandes volúmenes de datos
2. **Índices de Base de Datos:** 
   - `(tenantId, email)` - Índice único compuesto
   - `(tenantId, activo)` - Para filtrado eficiente
3. **Soft Delete:** Marcar `activo = false` en lugar de eliminar físicamente
4. **Auditoría:** Mantener `fechaCreacion` y `fechaActualizacion` actualizados
5. **Validación de TenantId:** Asegurar que el usuario solo pueda acceder a clientes de su tenant
6. **Manejo de Errores:** Retornar mensajes descriptivos y códigos HTTP apropiados

---

## 🎯 Recomendaciones

- Implementar rate limiting en endpoints de creación y carga masiva
- Agregar logs de auditoría para operaciones CRUD
- Considerar caché para listados frecuentes
- Implementar validación de duplicados antes de bulk upload
- Agregar endpoint de exportación a CSV para descarga de clientes existentes

---

**Fecha de Creación:** 2024-02-07  
**Módulo:** Gestión de Clientes  
**Versión:** 1.0
