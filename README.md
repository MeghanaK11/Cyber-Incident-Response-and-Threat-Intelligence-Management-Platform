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

### MongoDB Configuration

MongoDB runs in Docker and is exposed on host port `27018`. The container uses its internal port `27017`.

| Setting | Value |
|---|---|
| Database | `cirt` |
| Host | `localhost` |
| Host port | `27018` |
| Container port | `27017` |
| Collections | `raw_alerts`, `threat_feeds` |

The MongoDB connection settings are configured in `.env`:

```env
MONGO_ROOT_USER=cirt_root
MONGO_ROOT_PASSWORD=your_mongodb_password
MONGO_DB=cirt
MONGO_PORT=27018
MONGODB_URI=mongodb://cirt_root:<MONGO_ROOT_PASSWORD>@localhost:27018/?authSource=admin
```

Replace the password placeholder with your actual MongoDB root password. Keep `.env` private and never commit it to GitHub. The `.env.example` file contains placeholder values for other developers.

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

### Demo data

```bash
npm run seed
```

This adds four analysts and a viewer (passwords are printed once), 16 assets, 8 response playbooks based on the NIST SP 800-61 phases, and about six months of incidents. Each incident is driven through the real workflow (stored procedures, triggers, status transitions) with historical timestamps, so SLAs, history and the dashboard behave as they would in use. Attacker IPs come from the RFC 5737 documentation ranges. The seed only runs on an empty incidents table.

The seed also embeds every incident for semantic search. The first run downloads the embedding model (about 90 MB) into `.cache/`. If you add incidents another way, `npm run embed` fills in any missing vectors.

| Role | Can do |
|---|---|
| Admin | Everything, plus users, reassigning to anyone, deleting incidents |
| Analyst | Report and work incidents, take or auto-assign, apply playbooks, manage tasks |
| Viewer | Read-only access to dashboard and incidents |

## Semantic search with pgvector

| Question | Answer |
|---|---|
| What is embedded | Incident title, description and resolution summary |
| Model | sentence-transformers/all-MiniLM-L6-v2 (ONNX), 384 dimensions, run locally in the Node server with transformers.js |
| Storage | `incident_embeddings.embedding VECTOR(384)`, one row per incident, with a SHA-256 of the embedded text |
| Index | HNSW, `vector_cosine_ops` |
| Similarity | Cosine: `1 - (a <=> b)` |
| Retrieval | `fn_similar_incidents()` for "similar past incidents" on each incident page; free-text search by meaning on the Incidents page |
| Keeping it fresh | A trigger marks the vector stale when the incident text changes; the app re-embeds it after the write |

## Database tests

The helper functions live in a temporary schema, so they have to run in the same session as the tests:

```bash
cat db/tests/00_test_helpers.sql db/tests/01_core_tests.sql | docker exec -i cirt-postgres psql -U cirt_app -d cirt -q
```

Each script runs in a transaction and rolls back, so the database is left unchanged.

## Repository layout

```text
db/postgres/      schema, triggers, procedures, views (run in name order)
db/tests/         SQL test scripts
docs/             ER diagram
scripts/          create-admin, seed and embed
src/proxy.ts      blocks every page and API route without a valid session
src/lib/          db pool and transactions, auth, validation, error mapping
src/server/       all SQL the app runs, grouped by feature
src/app/api/      route handlers (the API layer)
src/app/(app)/    dashboard, incidents, admin pages
src/components/   shared UI pieces
```