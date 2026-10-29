# Deployment Guide

This guide covers deploying the **UK Wind Forecast & Accuracy Analytics** application to production using **Render** (PostgreSQL + FastAPI backend) and **Vercel** (React Vite frontend).

---

## Architecture Overview

```
                               ┌────────────────────────────────┐
                               │       Vercel (Frontend)        │
                               │  React 19 + Vite SPA (dist)    │
                               └───────────────┬────────────────┘
                                               │
                                       /api/* rewrites (or VITE_API_URL)
                                               │
                                               ▼
                               ┌────────────────────────────────┐
                               │        Render (Backend)        │
                               │  FastAPI + SQLAlchemy (Python) │
                               └───────────────┬────────────────┘
                                               │
                                     Internal Postgres URL
                                               │
                                               ▼
                               ┌────────────────────────────────┐
                               │       Render (Database)        │
                               │         PostgreSQL 16          │
                               └────────────────────────────────┘
```

- **Render** hosts the PostgreSQL database and FastAPI service.
- **Alembic migrations** run automatically during deployment via Render's `preDeployCommand`.
- **Vercel** hosts the static frontend build. Requests to `/api/*` are transparently rewritten to the Render backend service via `frontend/vercel.json`, avoiding CORS constraints and maintaining same-origin semantics.

---

## 1. Deploy Backend & Database on Render

### Option A: Using the Render Blueprint (`render.yaml`) — Recommended

1. Push your repository to GitHub or GitLab.
2. In the [Render Dashboard](https://dashboard.render.com/), click **New +** → **Blueprint**.
3. Connect your repository. Render will automatically detect [`render.yaml`](../render.yaml).
4. Review the detected resources:
   - **Database:** `wind-forecast-db` (PostgreSQL 16)
   - **Web Service:** `wind-forecast-backend` (Python 3.12, root directory: `backend`)
5. Click **Apply**.
   - Render provisions the database.
   - Render runs `buildCommand`: `pip install uv && uv sync --no-dev`.
   - Render runs `preDeployCommand`: `uv run alembic upgrade head` (automatically applying migrations).
   - Render starts `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.

### Option B: Manual Setup via Render Dashboard

If you prefer configuring resources manually in the Render UI:

1. **Create PostgreSQL Database:**
   - **Name:** `wind-forecast-db`
   - **Database:** `wind_forecast`
   - **User:** `wind`
   - **PostgreSQL Version:** 16
2. **Create Web Service:**
   - **Name:** `wind-forecast-backend`
   - **Root Directory:** `backend`
   - **Runtime:** `Python`
   - **Build Command:** `pip install uv && uv sync --no-dev`
   - **Pre-Deploy Command:** `uv run alembic upgrade head`
   - **Start Command:** `uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. **Environment Variables:**
   - `APP_ENV`: `production`
   - `DATABASE_URL`: Link to your Render database's internal connection string (`postgresql://...`).
     > *Note:* The application's `app/core/config.py` automatically normalizes `postgresql://` to `postgresql+psycopg2://` at runtime.
   - `ALLOWED_ORIGINS`: `http://localhost:5173,http://localhost:3000,https://<your-vercel-app>.vercel.app`
   - `INGESTION_TOKEN`: Generate a secure random token (e.g. `openssl rand -hex 16`).

---

## 2. Populate Historical Data (Ingestion)

Once the backend is deployed and migrations have run, load the January 2026 data using either method below:

### Method 1: Using the Render Web Shell (Easiest)

1. In the Render Dashboard, open the `wind-forecast-backend` web service.
2. Click **Shell** in the left sidebar.
3. Run the standalone ingestion script:
   ```bash
   uv run python scripts/run_ingestion.py
   ```
4. Output will confirm:
   ```
   Actuals  : fetched=1491  inserted=1491  skipped=0
   Forecasts: fetched=18104  inserted=18104  skipped=0
   Duration : ~3s
   ok=True  — ingestion complete
   ```

### Method 2: Via HTTP API

If you set `INGESTION_TOKEN`:

```bash
curl -X POST "https://<your-render-service>.onrender.com/api/v1/ingest" \
     -H "X-Ingestion-Token: <your-token>"
```

---

## 3. Deploy Frontend on Vercel

1. In the [Vercel Dashboard](https://vercel.com/), click **Add New…** → **Project**.
2. Import your Git repository.
3. Configure the project:
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click **Edit** and select `frontend`
   - **Build Command:** `npm run build` (runs `tsc -b && vite build`)
   - **Output Directory:** `dist`
4. Update `frontend/vercel.json`:
   - Replace `https://wind-forecast-backend.onrender.com` in `frontend/vercel.json` with your actual Render service URL:
     ```json
     {
       "$schema": "https://openapi.vercel.sh/vercel.json",
       "cleanUrls": true,
       "rewrites": [
         {
           "source": "/api/:path*",
           "destination": "https://<your-render-service>.onrender.com/api/:path*"
         },
         {
           "source": "/(.*)",
           "destination": "/index.html"
         }
       ]
     }
     ```
5. *(Optional Alternative)* Instead of Vercel proxy rewrites, you can set the environment variable `VITE_API_URL=https://<your-render-service>.onrender.com/api/v1` in Vercel. Make sure the backend's `ALLOWED_ORIGINS` includes your Vercel deployment domain.
6. Click **Deploy**.

---

## 4. Verification Checklist

1. **Backend Health Check:**
   ```bash
   curl -s "https://<your-render-service>.onrender.com/api/v1/health/db"
   # Response: {"status":"healthy","database":"connected"}
   ```

2. **Analytics API Check:**
   ```bash
   curl -s "https://<your-render-service>.onrender.com/api/v1/analysis/accuracy" | jq .
   # Verify sample_count = 1488, paired_count = 1440, mae_mw ≈ 2055
   ```

3. **Frontend Dashboard:**
   - Open `https://<your-vercel-app>.vercel.app`.
   - **Overview:** KPI cards show live MAE (2,055 MW), RMSE (2,546 MW), Bias (+1,760 MW), and paired sample counts.
   - **Forecasts & Actuals:** Tables paginate through January 2026 data.
   - **Accuracy:** Shows metric breakdowns and transparent methodology notes.
   - **Comparison:** Interactive Recharts chart plots forecasts vs actuals with date-range filtering.
