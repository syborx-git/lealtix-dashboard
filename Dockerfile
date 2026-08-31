# ==============================================================================
# LEALTIX DASHBOARD - DOCKERFILE
# ==============================================================================
# 
# 📌 NOTA IMPORTANTE PARA CONFIGURAR LA URL DEL BACKEND (BE):
# Angular es una aplicación cliente (SPA). La URL de tu Backend se compila
# dentro del código JavaScript antes de generar el contenedor.
#
# Dónde cambiar la URL de tu Backend (BE):
# 👉 Archivo: src/app/pages/commons/environment.ts (o environment.dev.ts)
# 👉 Propiedad: apiUrl: 'http://TU-NUEVA-IP-O-DOMINIO:8080/api'
#
# Asegúrate de modificar ese archivo ANTES de ejecutar `docker build` o `docker compose up`.
# ==============================================================================

# ------------------------------------------------------------------------------
# ETAPA 1: Construcción (Build) con Node.js
# ------------------------------------------------------------------------------
FROM node:20-alpine AS build

WORKDIR /app

# Copiar archivos de dependencias para aprovechar la caché de Docker
COPY package*.json ./

ENV NODE_OPTIONS="--max-old-space-size=2048"
RUN npm ci --legacy-peer-deps || npm install

# Copiar todo el código fuente de la aplicación
COPY . .

# Compilar la aplicación para producción
RUN npm run build

# ------------------------------------------------------------------------------
# ETAPA 2: Servidor Web de Producción con Nginx
# ------------------------------------------------------------------------------
FROM nginx:alpine

# Copiar la configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar los archivos compilados de Angular desde la Etapa 1
# Nota: Angular 20 genera los archivos estáticos en dist/lealtix_dashboard/browser
COPY --from=build /app/dist/lealtix_dashboard/browser /usr/share/nginx/html

# Respetando el puerto de salida del proyecto (4201 para desarrollo / 80 dentro del contenedor)
EXPOSE 80 4201

CMD ["nginx", "-g", "daemon off;"]
