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


