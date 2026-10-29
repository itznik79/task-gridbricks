# Architecture & API Research Notes

## Elexon BMRS API — verified findings (2026-10-28)

All observations below come from live API calls made during M1 implementation.
Base URL: `https://data.elexon.co.uk/bmrs/api/v1`

---

### FUELHH — half-hourly actuals

**Endpoint:** `GET /datasets/FUELHH/stream`

| Parameter | Type | Notes |
|---|---|---|
| `fuelType` | string | Must be `WIND` for wind actuals |
| `publishDateTimeFrom` | ISO 8601 UTC | Filters by publishTime lower bound |
| `publishDateTimeTo` | ISO 8601 UTC | Filters by publishTime upper bound |

> **Important:** `from`/`to` and `settlementDate` parameters do NOT filter by settlement date — they appear to return today's data regardless.  Only `publishDateTimeFrom`/`publishDateTimeTo` reliably filters historical records.

**Response shape (one record):**
```json
{
  "dataset": "FUELHH",
  "publishTime": "2026-01-02T00:30:00Z",
  "startTime": "2026-01-02T00:00:00Z",
  "settlementDate": "2026-01-02",
  "settlementPeriod": 1,
  "fuelType": "WIND",
  "generation": 14133
}
```

**Key facts:**
- Resolution: **30-minute** half-hourly settlement periods
- Units: **MW**
- `publishTime` ≈ `startTime + 30 min` (published when the half-hour closes)
- No duplicate `startTime` values (one authoritative actual per period)
- January 2026: **1,488 records** (31 days × 48 periods, some crossing midnight boundary)
- `settlementPeriod` is 1–48 normally; 46 on spring forward, 50 on fall back
- No API key required, no rate-limit headers observed

---

### WINDFOR — hourly wind forecasts

**Endpoint:** `GET /datasets/WINDFOR/stream`

| Parameter | Type | Notes |
|---|---|---|
| `publishDateTimeFrom` | ISO 8601 UTC | Filters by publishTime lower bound |
| `publishDateTimeTo` | ISO 8601 UTC | Filters by publishTime upper bound |

**Response shape (one record):**
```json
{
  "dataset": "WINDFOR",
  "publishTime": "2026-01-02T11:30:00Z",
  "startTime": "2026-01-02T00:00:00Z",
  "generation": 13500
}
```

**Key facts:**
- Resolution: **60-minute** hourly (NOT half-hourly like FUELHH)
- Units: **MW**
- ~**8 publishes per day** at approximately: 02:30, 04:30, 07:30, 09:30, 11:30, 15:30, 18:30, 22:30 UTC
- Each publish covers **~73 hours** of lookahead (3+ days)
- Multiple `publishTime` values per `startTime` = **forecast versioning** — this is the foundation for look-ahead bias prevention
- January 2026: **18,104 records** (248 unique publishTimes × ~73 startTimes each)
- No `settlementDate` or `settlementPeriod` fields (unlike FUELHH)
- No API key required, no rate-limit headers observed

---

### Resolution mismatch

| Dataset | Interval | Records/day |
|---|---|---|
| FUELHH  | 30 min   | 48          |
| WINDFOR | 60 min   | ~24 per publish |

For comparison in accuracy analytics, either:
- **Aggregate FUELHH** to hourly (average pairs of half-hourly actuals), or
- **Duplicate/interpolate WINDFOR** to half-hourly

Recommendation: aggregate FUELHH actuals to hourly at the analytics layer, keeping raw half-hourly records in the database unchanged.

---

### Look-ahead bias prevention

For January 2026 day-ahead purchasing analysis, the decision cutoff is typically **11:00 UTC on day D-1** (gate closure). To select the correct forecast:

```
For each startTime S in delivery day D:
  Use the WINDFOR record with the latest publishTime P such that P ≤ cutoff
```

Because WINDFOR publishes ~8 times per day, the last publish before 11:00 on D-1 is typically at **09:30 UTC** — meaning the day-ahead forecast uses data available ~25 hours before delivery.

---

### Unresolved questions

1. **DST handling in January 2026:** January is standard time (UTC+0 in the UK), so no DST transitions to worry about for the analysis period. Still worth checking if `startTime` is always UTC or can be local time — observed values are all UTC (`Z` suffix).

2. **Backfill completeness:** Are there any gaps in January 2026 FUELHH data? The 1,488 records suggest complete coverage, but this should be verified during ingestion.

3. **WINDFOR late publishes:** The ~8 publishes/day cadence was observed for January 2026 and today. Whether publishes are ever delayed (e.g. missing a 09:30 publish) is unknown — the ingestion job should handle missing publish slots gracefully.

4. **Units consistency:** Both datasets report `generation` in MW. No currency or energy (MWh) conversion is needed for comparisons, but the analytics layer should document the unit assumption.

---

---

## Database schema (M2, applied 2026-10-28)

PostgreSQL 16, port **5434** (5432 occupied by local macOS Postgres, 5433 by another Docker project).

### `wind_actuals`

| Column | Type | Constraint |
|---|---|---|
| `id` | `BIGINT` PK | auto-increment |
| `settlement_date` | `DATE` NOT NULL | — |
| `settlement_period` | `SMALLINT` NOT NULL | — |
| `start_time` | `TIMESTAMPTZ` NOT NULL | — |
| `publish_time` | `TIMESTAMPTZ` NOT NULL | — |
| `generation_mw` | `INTEGER` NOT NULL | — |
| `created_at` | `TIMESTAMPTZ` NOT NULL | `DEFAULT now()` |

Unique: `(settlement_date, settlement_period)` → `uq_wind_actuals_date_period`

Indexes: `ix_wind_actuals_start_time`, `ix_wind_actuals_settlement_date`

**Assumption:** FUELHH publishes exactly one authoritative actual per settlement period, never revised. Verified from Jan 2026 sample (zero duplicates). If this breaks, the ingestion job should UPSERT on conflict.

### `wind_forecasts`

| Column | Type | Constraint |
|---|---|---|
| `id` | `BIGINT` PK | auto-increment |
| `start_time` | `TIMESTAMPTZ` NOT NULL | — |
| `publish_time` | `TIMESTAMPTZ` NOT NULL | — |
| `generation_mw` | `INTEGER` NOT NULL | — |
| `created_at` | `TIMESTAMPTZ` NOT NULL | `DEFAULT now()` |

Unique: `(start_time, publish_time)` → `uq_wind_forecasts_start_publish`

Indexes: `ix_wind_forecasts_start_time`, `ix_wind_forecasts_publish_time`, `ix_wind_forecasts_start_publish` (composite — covers the look-ahead bias filter query)

**Assumption:** Each (startTime, publishTime) pair is unique within a WINDFOR publication run. Verified from Jan 2026 sample. Multiple publishTimes per startTime are intentional and are the source of forecast versioning.

**No `settlementDate` or `settlementPeriod` on forecasts** — WINDFOR doesn't include them, and hourly resolution means a 1:2 mapping to FUELHH periods. The analytics layer handles the resolution mismatch at query time (aggregate actuals to hourly).

### Alembic revision

`4c4a342c92d7` — `add_wind_actuals_and_forecasts`

Applied with `uv run alembic upgrade head`. Downgrade drops both tables and all indexes.

---

## Ingestion service (M3)

### Files

| File | Purpose |
|---|---|
| `app/services/ingestion.py` | Core logic: fetch → map → bulk upsert |
| `app/api/v1/ingest.py` | `POST /api/v1/ingest` endpoint with token auth |
| `app/schemas/ingestion.py` | `IngestionResult` Pydantic response model |
| `scripts/run_ingestion.py` | Standalone CLI for the first ingest run |

### Fetch window

```
publishDateTimeFrom = 2026-01-01T00:00:00Z
publishDateTimeTo   = 2026-02-01T01:00:00Z   # +1 h to capture SP48 of Jan 31
```

The generous upper bound catches the last FUELHH actual for January 31 (SP48), whose
`publishTime` is approximately `2026-02-01T00:00:00Z`.  WINDFOR records published in
January may have `startTime` values outside January (±73 h lookahead); they are stored
as-is so the analytics layer has full context.

### Idempotency

Both inserts use `INSERT … ON CONFLICT DO NOTHING`:
- `wind_actuals` conflicts on `(settlement_date, settlement_period)`
- `wind_forecasts` conflicts on `(start_time, publish_time)`

Re-running the ingestion inserts 0 rows and counts everything as skipped.

### Batch commit strategy

Records are committed in batches of 500.  Already-committed batches survive a
mid-run failure; the next run picks up where it left off via the conflict skip.

### Ingestion token

`POST /api/v1/ingest` requires the `X-Ingestion-Token` header to match
`INGESTION_TOKEN` in `.env`.  Leaving `INGESTION_TOKEN` empty (the default) disables
the endpoint entirely (returns 401 on every request).

### Failure behaviour

| Failure point | Outcome |
|---|---|
| FUELHH API error | Error logged to `result.errors`; forecast fetch proceeds normally |
| WINDFOR API error | Error logged to `result.errors`; actuals already fetched are inserted |
| DB insert batch fails | That batch is rolled back; prior batches remain committed |
| Both APIs fail | `result.ok = False`; no DB writes |

### Live January 2026 results (verified 2026-10-28)

| Dataset | Fetched | Inserted | Skipped |
|---|---|---|---|
| FUELHH (actuals) | 1,491 | 1,491 | 0 |
| WINDFOR (forecasts) | 18,104 | 18,104 | 0 |

Duration ≈ 2.6 s.  Second run: 0 inserted, all skipped (idempotency confirmed).

---

## Data flow

```
Elexon BMRS API
   ├── FUELHH /stream  ──► wind_actuals  table  (30-min, MW)   ✓ M3
   └── WINDFOR /stream ──► wind_forecasts table (60-min, MW, keyed by publishTime) ✓ M3
                                │
                    Forecast selection engine                  ✓ M4
                    (latest publishTime ≤ decision cutoff)
                                │
                    Analytics layer (MAE, RMSE, bias)         ✓ M4
                                │
                    FastAPI REST endpoints                     ✓ M5
                                │
                    React dashboard                            ✓ M6
```

---

## Analytics service (M4)

### Files

| File | Purpose |
|---|---|
| `app/services/analytics.py` | Forecast selection and accuracy metrics |
| `app/schemas/analytics.py` | `IntervalError`, `AccuracyReport` Pydantic models |
| `tests/test_analytics.py` | 33 tests — unit + DB integration |

### Decision-cutoff model

For delivery date D, the forecast is selected using the latest WINDFOR
`publish_time` that satisfies `publish_time ≤ (D−1) at cutoff_hour:00 UTC`.

Default `cutoff_hour = 11` (11:00 UTC), configurable per call.

**Unresolved assumption:** 11:00 UTC on D−1 is taken from the architecture doc
as a proxy for the UK N2EX/EPEX day-ahead gate closure.  The actual gate
closure time for the balancing mechanism used by the energy utility should be
confirmed before relying on this figure for production decisions.

### Time-alignment strategy

WINDFOR is hourly; FUELHH is 30-min.  Each 30-min actual is mapped to the
containing WINDFOR forecast hour by flooring `actual.start_time` to the hour:

```
SP11  05:00–05:30  →  floor(05:00) = 05:00  →  WINDFOR forecast at 05:00
SP12  05:30–06:00  →  floor(05:30) = 05:00  →  WINDFOR forecast at 05:00 (same)
SP13  06:00–06:30  →  floor(06:00) = 06:00  →  WINDFOR forecast at 06:00
```

The same forecast MW value is applied to both half-hours within each hour.
This is not interpolation — WINDFOR does not publish sub-hourly data.
Consequence: each forecast hour with a large error contributes two samples
to the aggregate statistics (one per 30-min actual).

### Metric definitions

| Metric | Formula | Sign convention |
|---|---|---|
| MAE | mean(\|forecast − actual\|) | always ≥ 0 |
| RMSE | sqrt(mean((forecast − actual)²)) | always ≥ 0 |
| Mean bias | mean(forecast − actual) | positive = systematic over-forecast |

### January 2026 results (verified 2026-10-28)

Delivery window: 2026-01-01 → 2026-01-31, cutoff 11:00 UTC on D−1.

| Metric | Value |
|---|---|
| Actuals in range | 1,488 (settlement_date Jan 1–31) |
| Paired (with forecast) | 1,440 |
| Missing forecast | 48 (Jan 1 — Dec 31 publication not ingested; see limitation below) |
| MAE | **2,055 MW** |
| RMSE | **2,546 MW** |
| Mean bias | **+1,760 MW** (systematic over-forecast) |

The large positive bias indicates WINDFOR consistently over-predicted national
wind generation throughout January 2026.  The MAE of ~2,055 MW against a
typical generation of ~14,000–16,000 MW represents roughly 13–14% error.

**Unresolved assumption:** WINDFOR `generation` is treated as average MW for
the hour, consistent with FUELHH.  This was not independently confirmed from
the Elexon BMRS API documentation.

### Known limitation: Jan 1 delivery date

The ingestion fetch window starts at `2026-01-01T00:00Z`.  For Jan 1 delivery,
the decision cutoff is `2025-12-31T11:00Z`, and the last valid pre-cutoff
publication would have been the `2025-12-31T09:30Z` WINDFOR run — which was
not ingested.  All 48 Jan 1 actuals are counted as `missing_forecast` and
excluded from metrics.

To fix: extend the ingestion fetch window back to `2025-12-31T00:00Z`.

### Ingestion boundary records (1,491 vs 1,488)

The generous ingestion window (`publishDateTimeTo = 2026-02-01T01:00:00Z`)
captured 3 records outside January 2026:

| Record | Explanation |
|---|---|
| `settlement_date=2025-12-31, SP48` | Published at 2026-01-01T00:00Z (within window) |
| `settlement_date=2026-02-01, SP1` | Published at ~2026-02-01T00:30Z (within window) |
| `settlement_date=2026-02-01, SP2` | Published at ~2026-02-01T01:00Z (within window) |

All three are valid API data.  The analytics service filters by
`settlement_date BETWEEN '2026-01-01' AND '2026-01-31'`, so they are excluded
from metrics automatically.

---

## REST API (M5)

All endpoints are versioned under `/api/v1`.  Handlers contain no analytics
logic — `/analysis/*` reuse the M4 `compute_accuracy_report`.

### Shared conventions

- **Delivery range** (`delivery_start`, `delivery_end`): inclusive dates, both
  default to the ingested window (`2026-01-01` … `2026-01-31`).  Validated by a
  shared dependency: `delivery_end ≥ delivery_start`, span ≤ **62 days**,
  else **422**.
- **Pagination** (`limit`, `offset`): `limit` 1–2000 (default 500), `offset` ≥ 0.
  Responses carry `total` (full match count before pagination), `limit`, `offset`.
- **Empty results** return `200` with `items: []` — never an error, never
  fabricated zeros.
- **Database errors** are caught by a global handler returning
  `500 {"detail": "Database error"}`.

| File | Endpoints |
|---|---|
| `app/api/v1/explorer.py` | `GET /actuals`, `GET /forecasts` |
| `app/api/v1/analysis.py` | `GET /analysis/accuracy`, `GET /analysis/comparison` |
| `app/api/v1/deps.py` | shared `delivery_range` dependency + bounds |

### `GET /actuals`

Half-hourly FUELHH actuals, filtered by `settlement_date`, ordered by `start_time`.

```
GET /api/v1/actuals?delivery_start=2026-01-02&delivery_end=2026-01-02&limit=48
→ 200 { total, limit, offset, items: [{settlement_date, settlement_period,
         start_time, publish_time, generation_mw}, …] }
```

### `GET /forecasts`

Hourly WINDFOR forecasts, filtered by delivery `start_time` in the range.

- `cutoff` (ISO 8601, optional): only publications with `publish_time ≤ cutoff`.
  Naive values are treated as UTC.  **This is how look-ahead bias is prevented** —
  later publications are never returned when a cutoff is set.
- `latest_only` (bool, requires `cutoff`): collapse to the single latest eligible
  publication per delivery hour (reuses `select_forecast_for_hour`).
  Without `cutoff` → **422**.

```
GET /api/v1/forecasts?delivery_start=2026-01-02&delivery_end=2026-01-02
    &cutoff=2026-01-01T11:00:00Z&latest_only=true
→ 200 { total, limit, offset, cutoff, latest_only,
         items: [{start_time, publish_time, generation_mw}, …] }
```

### `GET /analysis/accuracy`

Aggregate MAE / RMSE / bias + sample and missing-data counts + methodology.
No per-interval detail (see `/analysis/comparison`).

- `cutoff_hour` (int 0–23, default 11): decision-cutoff hour on day D-1.

```
GET /api/v1/analysis/accuracy?delivery_start=2026-01-01&delivery_end=2026-01-31
→ 200 {
    delivery_start, delivery_end, decision_cutoff_hour_utc,
    sample_count, paired_count, missing_forecast_count,
    mae_mw, rmse_mw, mean_bias_mw,          # null when paired_count == 0
    methodology: { decision_cutoff, forecast_resolution,
                   actual_resolution, alignment, notes[] }
  }
```

Verified live (full January 2026, cutoff 11:00): `sample_count=1488`,
`paired_count=1440`, `missing_forecast_count=48`, `mae_mw≈2055`,
`rmse_mw≈2546`, `mean_bias_mw≈+1760`.

### `GET /analysis/comparison`

Paginated aligned forecast-vs-actual intervals with per-interval `error_mw`.

- `cutoff_hour` (int 0–23, default 11), plus `limit` / `offset`.

```
GET /api/v1/analysis/comparison?delivery_start=2026-01-02&delivery_end=2026-01-02
→ 200 {
    delivery_start, delivery_end, decision_cutoff_hour_utc,
    total,                       # paired_count (full, before pagination)
    limit, offset, missing_forecast_count,
    items: [{settlement_date, settlement_period, start_time,
             forecast_publish_time, actual_mw, forecast_mw, error_mw}, …]
  }
```

### Methodology disclosure in responses

`/analysis/accuracy` embeds a `methodology` object stating the current
assumptions **as assumptions, not verified facts**:

- Decision cutoff `11:00 UTC on D-1` — not independently verified against UK
  market gate-closure rules.
- Forecast resolution hourly (WINDFOR); actual resolution 30-min (FUELHH);
  alignment by flooring each actual to its forecast hour, no interpolation.
- 2026-01-01 has no eligible forecast under the current ingestion window.
- Metrics apply only to paired observations.
- WINDFOR generation treated as average MW/hour (not confirmed from Elexon docs).

---

## Frontend (M6)

React 19 + TypeScript + Vite, Tailwind CSS v4, TanStack Query v5, Axios, Recharts.
Single-page dashboard; navigation is React state (no router).

### Structure

| Path | Purpose |
|---|---|
| `src/api/client.ts` | Axios instance; `baseURL = VITE_API_URL ?? '/api/v1'` |
| `src/api/analytics.ts` | `fetchAccuracy`, `fetchComparison` + response types |
| `src/api/wind.ts` | `fetchActuals`, `fetchForecasts` + response types |
| `src/lib/format.ts` | UTC date/time + numeric formatting helpers |
| `src/components/` | `Sidebar`, `TopHeader`, `KpiCard(s)`, `Panel`, `DataTable`, `Pagination`, `DateRangeFilter`, `ComparisonChart`, placeholders |
| `src/pages/` | `Overview`, `Forecasts`, `Actuals`, `Accuracy`, `Comparison` |

### Page → endpoint mapping

| Page | Endpoint(s) |
|---|---|
| Overview | `/analysis/accuracy` (KPIs) + `/analysis/comparison` (preview, 48 rows) |
| Forecasts | `/forecasts` (paginated, 50/page) |
| Actuals | `/actuals` (paginated, 50/page) |
| Accuracy | `/analysis/accuracy` (KPIs + methodology) |
| Comparison | `/analysis/comparison` (chart + table, 48/page, date-range filter) |

### Conventions

- **Query cache:** keyed by params (e.g. `['comparison', startDate, endDate, offset]`);
  `keepPreviousData` avoids flicker on page/filter changes.
- **Timestamps:** rendered in UTC (`Intl.DateTimeFormat`, `timeZone: 'UTC'`), e.g.
  `01 Jan 2026, 09:30 UTC`.
- **States:** every data view handles loading (skeletons), error, and empty explicitly;
  null metrics render as `—`, never fabricated zeros.
- **Look-ahead safety:** the Comparison/Overview views consume only paired intervals
  returned by the API; excluded (missing-forecast) counts are surfaced, not hidden.
- **Dev proxy:** Vite proxies `/api` → backend (default `:8000`, override with
  `VITE_PROXY_TARGET`), so the browser is same-origin and CORS is not exercised locally.

---

## Deployment configuration
 
 - **CORS** (`ALLOWED_ORIGINS` in `app/core/config.py`): `http://localhost:5173`,
   `http://localhost:3000`. Parsed from comma-separated string or JSON array in cloud env vars.
 - **Database URL driver normalization:** Render and other cloud databases inject a bare
   `postgresql://` (or `postgres://`) URL. Because only `psycopg2-binary` is installed,
   `app/core/config.py` uses a Pydantic `field_validator` to automatically normalize it to
   `postgresql+psycopg2://` at load time, preventing driver resolution crashes in both the
   FastAPI app and Alembic migrations.
 - **Render Blueprint (`render.yaml`):** Provisions PostgreSQL 16 and a Python 3.12 service.
   Runs `uv run alembic upgrade head` as a `preDeployCommand` before the web service goes live.
 - **Vercel (`frontend/vercel.json`):** Serves the Vite SPA with client-side fallback to
   `/index.html` and rewrites `/api/*` to the Render backend service, maintaining same-origin
   semantics without CORS configuration.
 - **Docker Compose:** `db` (Postgres 16, host port 5434), `backend` (:8000, waits for
   db health), `frontend` (nginx :3000 → proxies `/api/` to `backend:8000`). The
   schema must be migrated (`alembic upgrade head`) and data ingested before the API
   returns results.
