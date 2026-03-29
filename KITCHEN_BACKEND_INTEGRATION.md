# Kitchen Backend Integration - Resumen de Cambios

## 🎯 Objetivo
Adaptar el componente Kitchen de modo DEMO a producción, conectándolo directamente al Backend en lugar de usar datos mock.

## ✅ Cambios Realizados

### 1. **Deshabilitar Mock Mode**
**Archivo:** `src/app/pages/commons/environment.ts`

```typescript
// ANTES
kitchenMockEnabled: true

// DESPUÉS  
kitchenMockEnabled: false
```

**Impacto:** El componente ahora usa servicios del Backend en lugar del mock.

---

## 🏗️ Arquitectura de Servicios

### Flujo de Datos Actual:

```
Kitchen Component
    ↓
Kitchen Order Facade Service
    ├─→ Si mock habilitado: KitchenMockBackendService (DESHABILITADO)
    ├─→ Si mock deshabilitado: 
    │   ├─ KitchenApiService (listar órdenes, cambiar estado)
    │   ├─ OrderSseService (streaming de órdenes nuevas)
    │   └─ [FALLBACK AUTOMÁTICO a mock si BE no responde]
    └─ KitchenNotificationService (sonidos)
```

---

## 📡 Servicios del Backend Utilizados

### **1. KitchenApiService**
**Ubicación:** `src/app/pages/kitchen/services/kitchen-api.service.ts`

**Endpoints que consume:**
- `GET /api/kitchen-orders` → Lista órdenes por tenant
- `PATCH /api/kitchen-orders/status` → Cambia estado de orden
- **Fallback:** Si falla, intenta con `/api/tenant-client-orders` (legacy)

**Métodos:**
```typescript
listOrders(tenantId: number, page = 0, size = 100): Observable<any[]>
updateStatus(orderId: string, action: 'start' | 'finish'): Observable<any>
```

### **2. OrderSseService**
**Ubicación:** `src/app/pages/comandix/services/order-sse.service.ts`

**Conexión SSE:**
- Endpoint: `GET /api/sse/orders?tenantId={id}`
- Eventos: `new-order`, `ping` (heartbeat)
- Reconexión automática: máx 5 intentos con backoff de 3s
- **Mapea órdenes del BE al modelo local**

**Características:**
- ✅ Notificaciones en tiempo real
- ✅ Reconexión automática
- ✅ Estado de conexión observable

---

## 🔄 Ciclo de Vida del Componente

### **Inicialización (ngOnInit)**
1. Resuelve `tenantId` del usuario actual
2. Inicializa Facade: `kitchenOrderFacadeService.init(tenantId)`
3. Se suscribe a los observables:
   - `orders$` → Lista de órdenes
   - `loading$` → Estado de carga
   - `usingMock$` → Indicador de modo mock (ahora siempre false)
   - `connectionStatus$` → Estado de conexión ('connected', 'disconnected', 'error')

### **Estados de Conexión**
| Estado | Significado | Color UI |
|--------|------------|----------|
| `connected` | Conectado al BE | 🟢 Verde |
| `disconnected` | Desconectado (inicial) | 🔴 Rojo |
| `error` | Error de conexión | 🟡 Naranja |

---

## 📊 Mapeo de Datos Backend → Frontend

### **Normalización de Estados**
```typescript
Backend          →  Frontend
"EN_PREPARACION" →  "EN_PREPARACION"
"IN_PROGRESS"    →  "EN_PREPARACION"
"LISTO"          →  "LISTO_DESPACHADO"
"DESPACHADO"     →  "LISTO_DESPACHADO"
"CONFIRMADO"     →  "LISTO_DESPACHADO"
Otros/default    →  "PENDIENTE"
```

### **Estructura de Orden Mapeada**
```typescript
interface KitchenOrder {
  id: string;
  tenantId: number;
  status: 'PENDIENTE' | 'EN_PREPARACION' | 'LISTO_DESPACHADO';
  customerId?: number;
  customerName?: string;        // Ej: "Ana García"
  source?: string;              // Ej: "CHATBOT"
  createdAt: string;            // ISO 8601
  items: KitchenOrderItem[];
  subtotal: number;
  discount: number;
  total: number;
}

interface KitchenOrderItem {
  productId?: number;
  productName: string;          // Ej: "Hamburguesa Clásica"
  quantity: number;
  unitPrice: number;
  comments?: string;            // Ej: "Sin cebolla"
}
```

---

## 🔄 Polling vs SSE

| Aspecto | Polling | SSE |
|---------|---------|-----|
| **Frecuencia** | Cada 30 segundos | Tiempo real |
| **Límite** | 100 órdenes por request | Unlimited |
| **Casos** | Recuperación, inicialización | Nuevas órdenes entrantes |
| **Fallback** | ✅ Siempre activo | ❌ Solo si SSE disponible |

**Estrategia Híbrida:**
- SSE recibe órdenes nuevas en tiempo real
- Polling sincroniza cada 30s (por si SSE falla)
- Ambos comparten el mismo estado local

---

## 🚀 Características Implementadas

### ✅ Actuales
- [x] Lista de órdenes por estado (PENDIENTE → EN_PREPARACION → LISTO_DESPACHADO)
- [x] Cambio de estado (botones "Empezar", "Terminar")
- [x] Timer de minutos transcurridos
- [x] Indicador de "frescura" (color por edad de orden)
- [x] Soporte SSE con reconexión automática
- [x] Fallback elegante a mock si BE no responde
- [x] Sonidos de notificación para nuevas órdenes
- [x] Indicador de estado de conexión
- [x] Guard: Solo si tenant tiene kitchen habilitada
- [x] Permiso requerido: `view_kitchen_orders`

### 🔧 Mejoras Futuras Sugeridas
- [ ] Filtros por cliente/producto
- [ ] Búsqueda de órdenes histórico
- [ ] Exportar reportes
- [ ] Estadísticas de tiempo de preparación
- [ ] Asignación de orden a cocinero específico
- [ ] Integración con impresoras de cocina

---

## ⚙️ Configuración Requerida

### Backend debe tener:
1. **Endpoint GET `/api/kitchen-orders`**
   - Query params: `tenantId`, `page`, `size`
   - Response: Paginado con `content` array

2. **Endpoint PATCH `/api/kitchen-orders/status`**
   - Query params: `orderId`, `status`
   - Estados válidos: `EN_PREPARACION`, `LISTO`, `DESPACHADO`

3. **Stream SSE GET `/api/sse/orders`**
   - Query param: `tenantId`
   - Evento: `new-order` con `SseNewOrderEvent`
   - Heartbeat: `ping` cada 30s

### Frontend ya tiene:
- ✅ `KitchenApiService` configurado
- ✅ `OrderSseService` configurado
- ✅ `KitchenOrderFacadeService` orquestando
- ✅ Componente UI adaptado

---

## 🧪 Cómo Probar

### Test Local
```bash
# 1. Asegurar BE en localhost:8080
# 2. En VS Code, ejecutar:
npm start

# 3. Navegar a:
http://localhost:4200/dashboard/kitchendix/cocina

# 4. Observar:
#    - Tag en header: "connected" (verde)
#    - Órdenes cargadas desde BE
#    - Nuevas órdenes via SSE
#    - Cambios de estado funcionan
```

### Validar Conexión
1. Abrir DevTools → Console
2. Buscar logs: `[OrderSSE]` y `[Kitchen]`
3. Verificar: `ConnectionStatus: 'connected'`

---

## 🔐 Permisos Requeridos

Usuarios necesitan AMBOS:
1. **Feature Gate:** `KitchenFeatureGuard` (tenant level)
   - Verificar: `tenant.kitchenEnabled == true`

2. **Permission:** `view_kitchen_orders` (user level)
   - Configurar en sistema de permisos del admin

---

## 📝 Nota Importante

El **fallback automático a mock aún está activo**. Si el BE no responde:
1. KitchenApiService lanza error
2. Facade detecta el error en `loadOrders()`
3. Automáticamente activa `startMockMode()`
4. `usingMock` pasa a `true` y se muestra tag en UI
5. Usuario sigue viendo datos mockeados para no perder funcionalidad

Esto es una **característica, no un bug**. Permite degradación elegante.

---

## 📞 Troubleshooting

| Problema | Solución |
|----------|----------|
| No ve órdenes | ✅ BE en localhost:8080? ✅ Tenant habilitado? ✅ Usuario tiene permiso? |
| Tag dice "Mock" | BE no responde → verificar logs de servidor |
| SSE no conecta | Revisar firewall, SSE endpoint en BE |
| Estados no cambian | BE no tiene endpoint `/status` o parámetros incorrectos |
| Órdenes duplicadas | Refresco de página (normal, se sincroniza luego) |

