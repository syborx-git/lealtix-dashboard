# Lelatix-Dashboard

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.0.5.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4201/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

---

## 🐳 Despliegue con Docker y Configuración de Entorno

Esta aplicación cuenta con soporte completo para Docker (multietapa) y Docker Compose para facilitar su compilación, instalación y despliegue en cualquier servidor o entorno local.

### 📊 Resumen de Arquitectura y Puertos
* **Framework:** Angular 20 SPA.
* **Puerto de Salida predeterminado:** `4201` (definido en `angular.json`).
* **Servidor Web Producción:** Nginx en contenedor (escucha internamente en el puerto `80`).
* **Mapeo de Puerto en Host:** `4201:80` (la app responde en `http://localhost:4201`).

---

### 📍 Paso 1: Configurar la URL del Backend (BE)

Angular es un Framework Client-Side (SPA), lo que significa que la URL de tu API Backend se compila dentro de los archivos JavaScript finales.

**Archivo a modificar antes del build:**
👉 [`src/app/pages/commons/environment.ts`](file:///c:/Users/kike2/OneDrive/Escritorio/Lealtix/workspace/FE/lealtix-dashboard/src/app/pages/commons/environment.ts)

```typescript
export const environment = {
  production: false,
  /** 📌 Cambiar por la URL real de tu Backend (Spring Boot / API) */
  apiUrl: 'http://localhost:8080/api',
  landingPageBaseUrl: 'http://localhost:4200/landing-page',
  kitchenMockEnabled: false
};
```

> ⚠️ **Nota Importante:** Modifica la propiedad `apiUrl` **ANTES** de construir la imagen de Docker. Si cambias la URL posteriormente, necesitarás reconstruir la imagen (`docker compose up -d --build`).

---

### 🚀 Paso 2: Construcción y Ejecución

#### Opción A: Con Docker Compose (Recomendado)
Ejecuta un solo comando para compilar, empaquetar y levantar la aplicación:

```bash
# Compilar e iniciar el contenedor en segundo plano
docker compose up -d --build

# Ver logs del contenedor
docker compose logs -f

# Detener el contenedor
docker compose down
```

#### Opción B: Con comandos de Docker CLI
```bash
# 1. Construir la imagen de Docker
docker build -t lealtix-dashboard .

# 2. Correr el contenedor mapeando el puerto de salida 4201
docker run -d -p 4201:80 --name lealtix_dashboard_container lealtix-dashboard

# 3. Ver los logs de la aplicación
docker logs -f lealtix_dashboard_container
```

Una vez levantado, ingresa desde tu navegador a: **`http://localhost:4201`**

---

### 📂 Archivos de Configuración del Despliegue

* **[`Dockerfile`](file:///c:/Users/kike2/OneDrive/Escritorio/Lealtix/workspace/FE/lealtix-dashboard/Dockerfile):** Compilación multietapa (Node 20 Alpine para build -> Nginx Alpine para servir).
* **[`nginx.conf`](file:///c:/Users/kike2/OneDrive/Escritorio/Lealtix/workspace/FE/lealtix-dashboard/nginx.conf):** Configuración de Nginx optimizada para Angular SPA (soporte de recarga de rutas y compresión Gzip).
* **[`docker-compose.yml`](file:///c:/Users/kike2/OneDrive/Escritorio/Lealtix/workspace/FE/lealtix-dashboard/docker-compose.yml):** Orquestación simple de contenedores con reinicio automático.
* **[`.dockerignore`](file:///c:/Users/kike2/OneDrive/Escritorio/Lealtix/workspace/FE/lealtix-dashboard/.dockerignore):** Exclusión de `node_modules` y `.git` para builds súper rápidos.

---

## 🎯 Datos de Demo / Pruebas

El script de seed [`demo_seed.sql`](../lealtix-BE/src/main/resources/db/demo_seed.sql) carga un entorno de pruebas completo en la base de datos Neon.

### 🏪 Negocio de Demo

| Campo       | Valor                                           |
|-------------|-------------------------------------------------|
| Nombre      | La Taquería Demo                                |
| Tipo        | Restaurante                                     |
| Slug        | `la-taqueria-demo`                              |
| Dirección   | Av. Insurgentes Sur 1234, Col. Del Valle, CDMX  |
| Teléfono    | +52 55 9876 5432                                |

---

### 🔑 Credenciales de Acceso

> **Contraseña de todos los usuarios:** `Demo2025!`

| Rol           | Email                        | Panel en Dashboard            |
|---------------|------------------------------|-------------------------------|
| **ADMIN**     | `admin@lealtix-demo.com`     | Dashboard completo (propietario) |
| **ADMIN**     | `admin.demo@taqueria.com`    | Dashboard completo (interno)  |
| **MESERO**    | `carlos@taqueria.com`        | Vista comanda                 |
| **COCINA**    | `ana.cocina@taqueria.com`    | Vista cocina                  |
| **CAJA**      | `luis.caja@taqueria.com`     | Vista caja                    |
| **MARKETING** | `sofia.mkt@taqueria.com`     | Vista campañas y analytics    |

---

### 👥 Clientes de Demo (10 registros)

| Nombre          | Email                     | Género | Cumpleaños  |
|-----------------|---------------------------|--------|-------------|
| Maria Gonzalez  | `maria.g@gmail.com`       | F      | 10 Mar 1992 |
| Juan Perez      | `juan.p@hotmail.com`      | M      | 22 Jul 1985 |
| Laura Martinez  | `laura.m@gmail.com`       | F      | 30 Nov 1998 |
| Roberto Silva   | `roberto.s@yahoo.com`     | M      | 15 Ene 1979 |
| Carmen Lopez    | `carmen.l@gmail.com`      | F      | 05 Jun 2000 |
| Diego Ramirez   | `diego.r@outlook.com`     | M      | 18 Sep 1995 |
| Valentina Cruz  | `vale.c@gmail.com`        | F      | 25 Dic 1990 |
| Arturo Mendoza  | `arturo.m@hotmail.com`    | M      | 02 Abr 1988 |
| Isabela Torres  | `isabela.t@gmail.com`     | F      | 14 Ago 1997 |
| Marcos Herrera  | `marcos.h@yahoo.com`      | M      | 28 Feb 1983 |

---

### 📣 Campaña Activa de Demo

| Campo         | Valor                                    |
|---------------|------------------------------------------|
| Título        | Tacolandia de Verano 2025                |
| Estado        | `ACTIVE`                                 |
| Tipo de Promo | `DISCOUNT` — 20% de descuento            |
| Reward        | 20% off, compra mínima $150              |
| Vigencia      | Últimos 5 días → próximos 25 días        |
| Métricas demo | 145 views · 52 clicks · 8 redenciones    |

#### 🎟️ Cupones de Demo

| Código           | Cliente        | Estado     | Nota                          |
|------------------|----------------|------------|-------------------------------|
| `DEMO-SUMMER-01` | Maria Gonzalez | `ACTIVE`   | Disponible para canjear       |
| `DEMO-SUMMER-02` | Juan Perez     | `REDEEMED` | Canjeado por Carlos (Mesero)  |

---

### 🗄️ Menú Cargado

| Categoría  | Productos                                                            |
|------------|----------------------------------------------------------------------|
| Tacos      | Taco de Pastor $35 · Taco de Suadero $38 · Taco de Canasta $25      |
| Bebidas    | Agua de Jamaica $25 · Refresco $22 · Michelada $65                   |
| Antojitos  | Quesadilla de Hongos $55 · Sope de Chorizo $45                       |
| Postres    | Nieve de Limon $30 · Churros con Chocolate $40                       |

---

### ▶️ Cómo cargar los datos de demo

```bash
# Opción A: SQL Editor de Neon
# Pegar el contenido de lealtix-BE/src/main/resources/db/demo_seed.sql

# Opción B: psql desde Hetzner
psql "postgresql://neondb_owner:TU_PASSWORD@tu-host.neon.tech/neondb?sslmode=require" \
  -f /var/www/lealtix/lealtix-BE/src/main/resources/db/demo_seed.sql
```

Para limpiar los datos al terminar la demo, ejecutar la sección `LIMPIEZA` comentada al final del script SQL.

