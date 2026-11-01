# Cyber Incident Response and Threat Intelligence Management Platform

DBMS Level 3 project, PES University.

| Member | SRN | Area |
|---|---|---|
| Kallepalli Sai Meghana | PES1UG24AM911 | Incident response core, auth, vector search |
| D R Rushmitha | PES1UG24AM910 | Threat intelligence, alerts (MongoDB), analytics |

A web platform for a security operations team. Raw alerts from security tools land in MongoDB. Analysts promote real threats into incidents in PostgreSQL, link them to indicators of compromise and threat actors, run response playbooks, and track SLAs. pgvector finds past incidents that read like the current one so analysts can reuse earlier fixes.

## Why three data stores

| Data | Store | Reason |
|---|---|---|
| Users, incidents, tasks, playbooks, IOCs, threat actors | PostgreSQL | Related records that need foreign keys, constraints, transactions and triggers |
| Raw alerts and threat feed records | MongoDB | Each source sends a different JSON shape at high volume; old alerts expire through a TTL index |
| Incident text embeddings | pgvector | Similar incidents are found by meaning, which keyword search cannot do |

## Setup

Requirements: Docker, Node.js 20+.

```bash
cp .env.example .env        # fill in the passwords and JWT_SECRET
docker compose up -d        # Postgres runs db/postgres/*.sql on first start
```

To rebuild the database from scratch:

```bash
docker compose down -v && docker compose up -d
```

## Running the app

```bash
npm install
npm run create-admin -- "Your Name" you@example.com   # asks for a password
npm run dev                                          # http://localhost:3000
```

Sign in as the admin, then add analysts and viewers from the Users page.

| Role | Can do |
|---|---|
| Admin | Everything, plus users, reassigning to anyone, deleting incidents |
| Analyst | Report and work incidents, take or auto-assign, apply playbooks, manage tasks |
| Viewer | Read-only access to dashboard and incidents |

## Database tests

The helper functions live in a temporary schema, so they have to run in the same session as the tests:

```bash
cat db/tests/00_test_helpers.sql db/tests/01_core_tests.sql  | docker exec -i cirt-postgres psql -U cirt_app -d cirt -q
```

Each script runs in a transaction and rolls back, so the database is left unchanged.

## Repository layout

```
db/postgres/      schema, triggers, procedures, views (run in name order)
db/tests/         SQL test scripts
docs/             ER diagram
scripts/          create-admin
src/proxy.ts      blocks every page and API route without a valid session
src/lib/          db pool and transactions, auth, validation, error mapping
src/server/       all SQL the app runs, grouped by feature
src/app/api/      route handlers (the API layer)
src/app/(app)/    dashboard, incidents, admin pages
src/components/   shared UI pieces
```
