# UK Wind Forecast & Accuracy Analytics

A web application for an energy utility's day-ahead electricity purchasing team. It fetches national wind generation actuals from Elexon BMRS (`FUELHH`, `fuelType=WIND`) and forecasts from `WINDFOR`, then surfaces MAE, RMSE, and bias metrics to support January 2026 purchasing decisions without look-ahead bias.

---

## Monorepo layout

```
wind-forecast/
├── backend/          # FastAPI + SQLAlchemy + Alembic (Python 3.12, uv)
├── frontend/         # React + TypeScript + Vite + Tailwind CSS + Recharts
├── docs/             # Architecture decisions, data dictionaries
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Quick start (local)

### Prerequisites

- Python 3.12+ and [uv](https://docs.astral.sh/uv/)
- Node.js 22+ and npm
- Docker & Docker Compose (for PostgreSQL)

### 1. Start the database

```bash
docker compose up db -d
```

### 2. Backend

```bash
cd backend
cp ../.env.example .env          # edit DATABASE_URL if needed
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

API available at <http://localhost:8000> · Swagger UI at <http://localhost:8000/docs>

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

App available at <http://localhost:5173>

The dev server proxies `/api` to the backend (default `http://localhost:8000`). If the
backend runs on a different port, override the proxy target:

```bash
VITE_PROXY_TARGET=http://127.0.0.1:8001 npm run dev
```

> The browser calls the API same-origin via this proxy, so no CORS configuration is
> needed in local development.

### Dashboard pages

| Page | Data source |
|---|---|
| **Overview** | KPI cards (`/analysis/accuracy`) + compact forecast-vs-actual preview (`/analysis/comparison`) |
| **Forecasts** | Paginated WINDFOR publications (`/forecasts`) |
| **Actuals** | Paginated FUELHH actuals (`/actuals`) |
| **Accuracy** | KPI cards + methodology (`/analysis/accuracy`) |
| **Comparison** | Recharts line chart + interval table with a date-range filter (`/analysis/comparison`) |

---

## Full Docker Compose stack

```bash
cp .env.example .env
docker compose up --build
```

| Service  | URL                         |
|----------|-----------------------------|
| Frontend | <http://localhost:3000>     |
| Backend  | <http://localhost:8000>     |
| Database | `localhost:5432`            |

---

## API endpoints

All under `/api/v1`. Interactive docs at <http://localhost:8000/docs>.
Full contracts and examples: [`docs/architecture.md`](docs/architecture.md).

| Method & path | Purpose |
|---|---|
| `GET /health`, `GET /health/db` | Liveness / DB connectivity |
| `POST /ingest` | Trigger Jan 2026 ingestion (requires `X-Ingestion-Token`) |
| `GET /actuals` | Half-hourly FUELHH actuals (data explorer) |
| `GET /forecasts` | Hourly WINDFOR forecasts; `cutoff` enforces look-ahead-bias prevention |
| `GET /analysis/accuracy` | MAE / RMSE / bias + counts + methodology |
| `GET /analysis/comparison` | Aligned forecast-vs-actual intervals with per-interval errors |

Common query params: `delivery_start` / `delivery_end` (inclusive dates, default
the ingested January 2026 window, max 62-day span), `limit` (1–2000, default 500),
`offset`. Analysis endpoints accept `cutoff_hour` (0–23, default 11 = decision
cutoff at 11:00 UTC on D−1 — **a current assumption, not a verified market rule**).

```bash
# Full January 2026 accuracy summary
curl -s "http://localhost:8000/api/v1/analysis/accuracy" | python -m json.tool

# Forecasts available for Jan 2 as of the day-ahead cutoff (latest version per hour)
curl -s "http://localhost:8000/api/v1/forecasts?delivery_start=2026-01-02\
&delivery_end=2026-01-02&cutoff=2026-01-01T11:00:00Z&latest_only=true" | python -m json.tool
```

---

## Development

### Backend tests

```bash
cd backend
uv run pytest -v
```

### Linting

```bash
cd backend
uv run ruff check .
uv run ruff format --check .
```

### Frontend type-check, build & lint

```bash
cd frontend
npm run build    # tsc -b (type-check) + vite build
npm run lint     # oxlint
```

### Frontend end-to-end smoke tests (Playwright)

Browser smoke tests covering navigation, KPI cards, the Recharts chart, tables,
pagination, and the date-range filter. They run against the **live API** via the
Vite dev proxy, so the backend must be running with the ingested dataset.

```bash
cd frontend
npx playwright install chromium   # one-time browser download
# point the proxy at your backend, then run:
VITE_PROXY_TARGET=http://127.0.0.1:8000 npm run test:e2e
```

Playwright starts the dev server on port 4321 automatically (no clash with 5173).

---

## Architecture

| Layer         | Technology                              |
|---------------|-----------------------------------------|
| Frontend      | React 19, TypeScript, Vite, Tailwind CSS v4, Recharts, TanStack Query v5 |
| Backend       | FastAPI, SQLAlchemy 2, Alembic, Pydantic v2 |
| Database      | PostgreSQL 16                           |
| Packaging     | uv (Python), npm (Node)                 |
| Deployment    | Vercel (frontend) + Render (backend + DB) |

---

## Deployment (Production)

The application is configured for zero-friction cloud deployment using **Render** and **Vercel**:

- **Backend + Database (Render):** Managed via [`render.yaml`](render.yaml). Provisions PostgreSQL 16 and a Python 3.12 web service. Migrations (`alembic upgrade head`) run automatically before each deploy via `preDeployCommand`. `DATABASE_URL` is automatically normalized from Render's `postgresql://` to `postgresql+psycopg2://`.
- **Frontend (Vercel):** Configured via [`frontend/vercel.json`](frontend/vercel.json) with SPA client-side routing and `/api` proxy rewrites to Render, ensuring seamless same-origin API requests without CORS issues.

For step-by-step setup instructions, environment variables, and ingestion procedures, see the comprehensive [**`DEPLOYMENT.md`**](DEPLOYMENT.md) guide.

---

## Ingestion — load January 2026 data

After starting the database and running migrations, fetch and store the January 2026
FUELHH actuals and WINDFOR forecasts with the standalone script:

```bash
cd backend
uv run python scripts/run_ingestion.py
```

Expected output (first run):
```
Actuals  : fetched=1491  inserted=1491  skipped=0
Forecasts: fetched=18104  inserted=18104  skipped=0
Duration : ~3s
ok=True  — ingestion complete
```

The script is idempotent — re-running inserts 0 rows and counts all 19,595 records as
skipped.

### HTTP endpoint (optional)

The `POST /api/v1/ingest` endpoint does the same thing over HTTP and is protected by a
configurable token.  Add `INGESTION_TOKEN=<your-secret>` to `backend/.env`, then:

```bash
curl -s -X POST http://localhost:8000/api/v1/ingest \
     -H "X-Ingestion-Token: <your-secret>" | python -m json.tool
```

---

## Milestones

- [x] **M0** – Monorepo foundation: shells, health endpoint, DB, Docker Compose
- [x] **M1** – Elexon API research + async client (13 tests)
- [x] **M2** – PostgreSQL models + Alembic migration (15 tests)
- [x] **M3** – Historical ingestion: FUELHH actuals + WINDFOR forecasts, idempotent, 18 tests
- [x] **M4** – Forecast selection + accuracy analytics: MAE/RMSE/bias, 33 tests
- [x] **M5** – REST API: `/actuals`, `/forecasts`, `/analysis/accuracy`, `/analysis/comparison`, 24 tests
- [x] **M6** – Frontend dashboard + API integration (see below)
- [x] **M7** – Integration tests + deployment configuration (`render.yaml`, `vercel.json`, `DEPLOYMENT.md`)

### M6 frontend sub-milestones

- [x] **M6.1** – Dashboard UI shell: sidebar, header, responsive layout, placeholders
- [x] **M6.2** – KPI cards wired to `GET /analysis/accuracy` (MAE / RMSE / bias / paired samples)
- [x] **M6.3** – Per-page navigation (Overview, Forecasts, Actuals, Accuracy, Comparison) via shared state
- [x] **M6.4** – Forecasts & Actuals pages: real paginated tables
- [x] **M6.5** – Comparison page: Recharts forecast-vs-actual line chart + interval table
- [x] **M6.6** – Overview page: compact chart + table preview reusing the comparison components
- [x] **M6.7** – Comparison page: date-range filter (`delivery_start` / `delivery_end`)
