# HitFactor

PSMOC practical shooting match management app with offline-first scoring.

Match admins create and configure matches, range officers score shooters at stages (works offline at outdoor ranges), and shooters view results and history.

## Tech Stack

- **Frontend:** Quasar (Vue 3, TypeScript) SPA
- **Backend:** Fastify (Node.js, TypeScript)
- **Database:** PostgreSQL 16
- **Offline Sync:** PowerSync (CDC from PostgreSQL to SQLite in browser)
- **ORM:** Drizzle (pg-core on server, sqlite-core on client)
- **Auth:** JWT (RS256)
- **Monorepo:** npm workspaces

## Prerequisites

- Node.js >= 20
- Docker & Docker Compose
- npm

## Dev Environment Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

The defaults work out of the box for local development. Edit `.env` if you need to change ports or credentials.

### 3. Start PostgreSQL and PowerSync

```bash
docker compose up -d
```

This starts:
- **PostgreSQL 16** on port `5432` (with `wal_level=logical` for PowerSync CDC)
- **PowerSync Service** on port `8080`

Wait for both containers to be healthy:

```bash
docker compose ps
```

### 4. Build the shared package

The shared package must be built before the backend or frontend can use it:

```bash
npm run build:shared
```

### 5. Run database migrations

Generate the migration files from the Drizzle schema, then apply them:

```bash
npm run db:generate
npm run db:migrate
```

### 6. Seed the database

Creates test users, a sample match, and stages:

```bash
npm run db:seed
```

### 7. Start the backend

```bash
npm run dev:backend
```

The Fastify API starts on `http://localhost:3000`. Verify with:

```bash
curl http://localhost:3000/api/health
```

### 8. Start the frontend

In a separate terminal:

```bash
npm run dev:frontend
```

The Quasar dev server starts on `http://localhost:9000`.

## Test Accounts

The owner admin account uses the password **`password`**; the other test
accounts use **`password123`**.

| Email | Password | Roles | Classification | Division |
|---|---|---|---|---|
| `admin@hitfactor.com` | `password` | admin, officer, shooter | Master | Limited |
| `officer@hitfactor.com` | `password123` | officer, shooter | A | Carry Optics |
| `shooter@hitfactor.com` | `password123` | shooter | B | Production |

The seed also creates 20 officer accounts with **random** `officer-<hex>@hitfactor.com`
emails, all with password **`password`** (roles: officer, shooter). The seed prints
each generated email when it runs.

The admin account is also set up as the match admin for the seeded sample match "Spring Classic 2026".

## Sample Data

The seed script creates:

- **Match:** Spring Classic 2026 (Level I, registration open, 4 stages, 80 max shooters)
- **Stages:**
  1. El Presidente — Comstock, 12 rounds, classifier CM 99-11
  2. Speed Drill — Virginia Count, 18 rounds, 3 poppers, 2 no-shoots
  3. Standards — Fixed Time (30s), 24 rounds, 4 plates
  4. Jungle Run — Comstock, 28 rounds, 4 poppers, 3 no-shoots

## Project Structure

```
hitfactor/
├── shared/          # Types, constants, Zod schemas, scoring engine
├── backend/         # Fastify API, Drizzle PG schema, auth, all modules
├── frontend/        # Quasar SPA, PowerSync client, scoring UI
└── docker-compose.yml
```

## Common Commands

| Command | Description |
|---|---|
| `npm run dev:backend` | Start backend dev server (port 3000) |
| `npm run dev:frontend` | Start frontend dev server (port 9000) |
| `npm run build:shared` | Build shared package |
| `npm run test:shared` | Run scoring engine tests |
| `npm run db:generate` | Generate Drizzle migrations from schema |
| `npm run db:migrate` | Apply database migrations |
| `npm run db:seed` | Seed database with test data |
| `docker compose up -d` | Start PostgreSQL + PowerSync |
| `docker compose down` | Stop services |
| `docker compose down -v` | Stop services and delete data |

## PowerSync & Offline Sync

PowerSync requires a **secure context** (`https://` or `http://localhost`) for the `navigator.locks` API. If you access the frontend from a LAN IP over plain HTTP (e.g. `http://192.168.x.x:9000`), PowerSync will be disabled and the app runs without offline sync.

For full offline-sync support during development, access the app at `http://localhost:9000`.

## API Overview

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/auth/register` | Register user |
| `POST` | `/api/auth/login` | Login, returns JWT |
| `POST` | `/api/auth/refresh` | Refresh token |
| `GET` | `/api/auth/powersync-token` | JWT for PowerSync client |
| `GET` | `/api/auth/keys` | JWKS endpoint |
| `GET/POST` | `/api/matches` | List / create matches |
| `GET/PUT/DELETE` | `/api/matches/:id` | Match CRUD |
| `GET/POST` | `/api/matches/:id/stages` | Stage CRUD |
| `PUT/DELETE` | `/api/matches/:id/stages/:stageId` | Stage CRUD |
| `GET/POST` | `/api/matches/:id/stages/:stageId/scores` | Score CRUD |
| `POST` | `/api/matches/:id/results/compute` | Compute results |
| `GET` | `/api/matches/:id/results` | Get match results |
| `GET/PUT` | `/api/users/me` | User profile |
| `PUT/PATCH/DELETE` | `/api/powersync/data` | PowerSync upload endpoint |
