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

### Frontend type-check & build

```bash
cd frontend
npm run build
```

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

## Milestones

- [x] **M0** – Monorepo foundation: shells, health endpoint, DB, Docker Compose
- [ ] **M1** – Database schema + Alembic migrations (actuals, forecasts tables)
- [ ] **M2** – Elexon FUELHH & WINDFOR ingestion jobs
- [ ] **M3** – Forecast selection engine (look-ahead bias prevention)
- [ ] **M4** – Analytics API (MAE, RMSE, bias per settlement period)
- [ ] **M5** – Frontend charts (Recharts time series, metrics cards)
- [ ] **M6** – Integration tests + deployment

---

## AI disclosure

This project was developed with assistance from **Claude Code** (Anthropic), an AI-powered CLI engineering assistant. All generated code was reviewed and tested by the author. Claude Code was used for scaffolding, boilerplate generation, and API integration guidance.
