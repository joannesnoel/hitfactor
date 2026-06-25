# syntax=docker/dockerfile:1
# Build context = repo root:  docker build -f backend/Dockerfile -t <img> .
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci

FROM deps AS build
COPY shared/ shared/
COPY backend/ backend/
RUN npm run build:shared && npm run build:backend
# Drop dev dependencies for the runtime image
RUN npm prune --omit=dev

FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/shared/package.json ./shared/package.json
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/drizzle ./backend/drizzle
WORKDIR /app/backend
EXPOSE 3000
# JWT keys are mounted as a Secret at dist/config/keys (see k8s manifests).
# Migrations run via the migrate Job: node dist/db/migrate.js
CMD ["node", "dist/server.js"]
