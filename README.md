# Doctor Tracker API

REST API for the Doctor Tracker clinical admin assignment — **Express, TypeScript, PostgreSQL, Prisma, and Zod**.

> **Note:** The written brief mentions MongoDB; this implementation uses **PostgreSQL** as specified in the technical stack. `docker-compose.yml` spins up Postgres locally, or point `DATABASE_URL` at any existing instance.

## Elevator pitch

Doctor Tracker gives clinic admins a single place to manage doctors and patients, with session-based auth, searchable lists, dashboard analytics, and predictable pagination — all backed by a typed Express API and a normalized Postgres schema.

## Architecture

```text
Client (Next.js) → /api proxy → Express (/api/*)
                      ↓
                 Prisma → PostgreSQL
```

- **Auth:** bcrypt password hashes, opaque session tokens in HttpOnly cookies, server-side `Session` rows with expiry, rate-limited login.
- **Data:** `Admin`, `Session`, `Doctor`, `Patient` (patients require `doctorId`).
- **Dashboard:** SQL aggregates with indexes on `createdAt`, `specialization`, and foreign keys.

### Date range convention

Filter query params `from` and `to` are **inclusive UTC calendar days** (`YYYY-MM-DD`), interpreted as `00:00:00.000Z` through `23:59:59.999Z`.

## Technical decisions

1. **Server-side sessions (vs JWT in localStorage)**  
   - *Pro:* Easy revocation on logout, HttpOnly cookies reduce XSS token theft.  
   - *Con:* Requires sticky session lookup on each request and a shared DB; less ideal for massive horizontal scale without a session store.

2. **PostgreSQL + Prisma (vs MongoDB)**  
   - *Pro:* Relational integrity for `doctorId`, strong filtering/sorting, raw SQL for daily rollups.  
   - *Con:* Schema migrations and connection management; heavier local setup than a document store.

## Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 16+ (`docker compose up -d` in this repo, or your own `DATABASE_URL`)

### Commands

```bash
cd backend-interview
cp .env.example .env
# Edit DATABASE_URL and SESSION_SECRET if needed

docker compose up -d   # optional local Postgres

# Alternative without Docker (downloads a local cluster on first run):
# node scripts/start-embedded-db.mjs
# Use the printed DATABASE_URL in .env

npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

API: [http://localhost:4000](http://localhost:4000)  
Health: `GET /api/health`

### Demo admin (from seed)

| Field    | Default                      |
|----------|------------------------------|
| Email    | `admin@doctortracker.local`  |
| Password | `Admin123!`                  |

Override with `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `.env`.

### Scripts

| Script            | Description              |
|-------------------|--------------------------|
| `npm run dev`     | Watch mode API           |
| `npm run build`   | Compile TypeScript       |
| `npm run start`   | Run compiled `dist/`     |
| `npm run typecheck` | Type-check only        |
| `npm run db:seed` | Idempotent seed data     |

## API overview

| Area      | Endpoints |
|-----------|-----------|
| Health    | `GET /api/health` |
| Auth      | `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` |
| Doctors   | `POST/GET /api/doctors`, `GET /api/doctors/:id`, patients nested under `/api/doctors/:id/patients` |
| Patients  | `GET/PATCH/DELETE /api/patients`, `GET /api/patients/conditions` |
| Dashboard | `GET /api/dashboard?from=&to=` |

Protected routes return `401` without a valid session cookie (`session`).
