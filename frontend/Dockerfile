# syntax=docker/dockerfile:1
# Build context = repo root:  docker build -f frontend/Dockerfile \
#   --build-arg VITE_API_URL=https://api.hitfactor.creativelogik.net -t <img> .
FROM node:20-bookworm-slim AS build
WORKDIR /app
ARG VITE_API_URL
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci
COPY shared/ shared/
COPY frontend/ frontend/
# Expose VITE_API_URL via process.env so Vite's loadEnv inlines import.meta.env.VITE_*
# (Quasar's build does not reliably read a .env file from this directory).
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build:shared && npm run build -w frontend

FROM nginx:alpine AS runtime
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist/pwa /usr/share/nginx/html
EXPOSE 80
