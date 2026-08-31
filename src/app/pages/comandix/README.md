# Comandix - Comanda Inteligente

## 📋 Descripción
Comandix es el módulo de comanda inteligente de Lealtix que permite a pequeños negocios (cafeterías, tiendas) gestionar ventas de manera eficiente transformándolas en relaciones con clientes.

## 🏗️ Arquitectura

### Capa de Datos (Services)

#### MenuService
- **Ubicación**: `src/app/pages/comandix/services/menu.service.ts`
- **Endpoint**: `GET /api/tenant-menu-categories/catalog/categories-with-products?tenantId={id}`
- **Método principal**: `getCatalog(tenantId: number): Observable<MenuCategory[]>`
- **Descripción**: Obtiene el catálogo completo de categorías con sus productos

#### OrderService
- **Ubicación**: `src/app/pages/comandix/services/order.service.ts`
- **Endpoint**: `POST /api/tenant-client-orders`
- **Método principal**: `createOrder(order: TenantClientOrderCreateRequest): Observable<TenantClientOrderResponse>`
- **Descripción**: Crea una nueva orden de cliente con items, descuentos y totales

#### RedemptionService (Integrado)
- **Ubicación**: `src/app/pages/redeem/services/redemption.service.ts`
- **Método usado**: `validateCouponByCode(code: string, tenantId: number)`
- **Descripción**: Valida cupones de descuento y calcula el valor aplicable

### Modelos de Datos

#### Menu Models (`models/menu.model.ts`)
```typescript
interface Product {
  id: number;
  name: string;
  price: number;
  imageUrl?: string | null;
  description?: string;
}

interface MenuCategory {
  id: number;
  name: string;
  products: Product[];
}
```

#### Order Models (`models/order.model.ts`)
```typescript
interface OrderItem {
  productId: number;
  cantidad: number;
  precioUnitario: number;
  comentarios?: string;
}

interface TenantClientOrderCreateRequest {
  customerId?: number | null;  // null para "Venta General"
  items: OrderItem[];
  subtotal: number;
  descuento: number;
  totalFinal: number;
}
```

## 🎨 Interfaz de Usuario

### Componente Principal
- **Ubicación**: `src/app/pages/comandix/comandix.component.ts`
- **Tipo**: Angular Standalone Component con Signals
- **Ruta**: `/dashboard/comandix`

### Características UI/UX

#### 1. Identificación del Cliente
- **Componente**: `p-autoComplete`
- **Funcionalidad**:
  - Búsqueda de clientes existentes por nombre o email
  - Opción "Nuevo Cliente" para abrir diálogo de creación
  - Si no se selecciona cliente, se registra como "Venta General" (customerId = null)

#### 2. Catálogo Interactivo
- **Componente**: PrimeNG `p-tabs` con `p-tablist` y `p-tabpanels`
- **Estructura**:
  - Tabs para navegación entre categorías
  - Grid responsive de productos (cards)
  - Imagen de producto o placeholder
  - Precio visible
  - Botón "+" para añadir al carrito con un clic

#### 3. Gestión de Comanda (Carrito)
- **Vista**: Sticky sidebar en desktop, full-width en mobile
- **Funcionalidades**:
  - Lista de productos seleccionados
  - Controles +/- para ajustar cantidades
  - Campo de texto para notas de personalización por ítem (ej. "sin cebolla", "frío")
  - Eliminar productos del carrito
  - Cálculo automático de subtotales

#### 4. Checkout y Fidelización
- **Campo de Cupón**:
  - Input para código de cupón
  - Botón "Validar" que verifica contra RedemptionService
  - Muestra descuento aplicado en color verde
- **Resumen de Totales**:
  - Subtotal
  - Descuento (si aplica)
  - Total Final
- **Botones de Acción**:
  - "Finalizar y Registrar Venta" (principal, severity="success")
  - "Limpiar Carrito" (secundario, severity="secondary", styleClass="p-button-sm")

## 🎯 Principios de Diseño

### Mobile-First
- Grid responsivo con PrimeFlex
- Optimizado para tablets (operación por meseros)
- Sticky sidebar en desktop, full-width en mobile

### Estilos Consistentes
- Botones: `severity="secondary"`, `styleClass="p-button-sm"`
- Colores del tema PrimeNG del dashboard
- Transiciones suaves en hover

### Responsabilidad Única (SRP)
- Servicios separados para cada dominio (Menu, Order, Redemption)
- Interfaces bien definidas
- Lógica de negocio desacoplada de la UI

## 🚀 Uso

### Acceso
Navegar a: `http://localhost:4200/dashboard/comandix`

### Flujo de Trabajo Típico
1. **Identificar Cliente** (opcional)
   - Buscar cliente existente en autoComplete
   - O crear nuevo cliente con el diálogo
   - O dejar vacío para "Venta General"

2. **Seleccionar Productos**
   - Navegar por categorías en tabs
   - Hacer clic en productos para añadirlos al carrito
   - Ajustar cantidades con botones +/-
   - Añadir notas de personalización

3. **Aplicar Descuento** (opcional)
   - Ingresar código de cupón
   - Validar cupón
   - Ver descuento aplicado en el resumen

4. **Finalizar Venta**
   - Revisar resumen de totales
   - Clic en "Finalizar y Registrar Venta"
   - Recibir confirmación con número de orden

## 📦 Dependencias
- Angular 20+ (Standalone Components)
- PrimeNG 20.4.0+
- PrimeFlex (para grid system)
- RxJS (para manejo de observables)
- Angular Signals (para estado reactivo)

## 🔧 Integración con Backend
Todos los endpoints están configurados para usar `environment.apiUrl`:
- Menú: `/api/tenant-menu-categories/catalog/categories-with-products`
- Órdenes: `/api/tenant-client-orders`
- Cupones: `/api/redemptions/validate/code/{code}`

## ✅ Estado de Implementación
- ✅ Modelos e interfaces
- ✅ Servicios (MenuService, OrderService)
- ✅ Componente principal con UI completa
- ✅ Integración con RedemptionService
- ✅ Integración con ClienteService y ClienteDialog
- ✅ Routing configurado
- ✅ Validación de compilación
- ✅ Diseño mobile-first
- ✅ Estilos PrimeNG consistentes

## 🎓 Notas de Desarrollo
- El componente usa Angular Signals para estado reactivo
- Los computed values (subtotal, totalFinal) se recalculan automáticamente
- La validación de cupones es asíncrona y muestra loading state
- El formulario de cliente se resetea después de cada creación exitosa
- No se afectó la funcionalidad existente del sistema
