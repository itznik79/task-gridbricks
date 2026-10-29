# UK Wind Forecast & Accuracy Analytics — API Reference

This document provides a comprehensive API reference for the UK Wind Generation Forecast and Actuals Analytics service.

---

## Interactive Documentation & Collections

- **Interactive Swagger UI:** [`http://localhost:8000/docs`](http://localhost:8000/docs) (or `https://<your-render-url>/docs` in production)
- **Interactive ReDoc:** [`http://localhost:8000/redoc`](http://localhost:8000/redoc)
- **OpenAPI 3.1 JSON Specification:** [`docs/openapi.json`](docs/openapi.json) (Import directly into Swagger Editor, Postman, Insomnia, or Bruno)
- **Postman Collection v2.1:** [`docs/postman_collection.json`](docs/postman_collection.json) (Pre-configured requests with variables and query parameters)

---

## Base URLs

| Environment | Base URL |
|---|---|
| **Local Development** | `http://localhost:8000` |
| **Local Frontend Proxy** | `http://localhost:5173/api/v1` |
| **Production** | `https://<your-render-service>.onrender.com` |

All application endpoints are prefixed with `/api/v1`.

---

## Look-Ahead Bias Prevention Concept

In electricity trading, purchasing decisions are made before gate closure (e.g. 11:00 UTC on day D−1). 
To prevent **look-ahead bias**:
- Analytics endpoints accept a `cutoff_hour` (default `11` = 11:00 UTC on D−1).
- The forecast endpoint accepts an ISO 8601 `cutoff` timestamp and optional `latest_only=true`.
- The system **only considers forecast versions published at or before the cutoff time**, strictly simulating what an energy trader had available at decision time.

---

## Endpoints Summary

| Method | Endpoint | Description | Auth / Headers |
|---|---|---|---|
| `GET` | `/` | API root & Swagger redirect link | None |
| `GET` | `/api/v1/health` | Service liveness health check | None |
| `GET` | `/api/v1/health/db` | Database connectivity readiness check | None |
| `GET` | `/api/v1/analysis/accuracy` | Summary accuracy metrics (MAE, RMSE, bias) | None |
| `GET` | `/api/v1/analysis/comparison` | Aligned forecast vs actual interval comparison | None |
| `GET` | `/api/v1/actuals` | Half-hourly national wind actuals (FUELHH) | None |
| `GET` | `/api/v1/forecasts` | Hourly national wind forecasts (WINDFOR) | None |
| `POST` | `/api/v1/ingest` | Trigger historical January 2026 data ingestion | `X-Ingestion-Token` |

---

## Detailed Endpoint Reference

### 1. Health Checks

#### `GET /api/v1/health`
Checks if the web server is responsive.

**Response `200 OK`:**
```json
{
  "status": "ok"
}
```

```bash
curl -s http://localhost:8000/api/v1/health
```

---

#### `GET /api/v1/health/db`
Verifies database connectivity by executing a lightweight `SELECT 1` query.

**Response `200 OK`:**
```json
{
  "status": "healthy",
  "database": "connected"
}
```

**Response `503 Service Unavailable`:**
```json
{
  "status": "unhealthy",
  "database": "disconnected",
  "detail": "connection to server at 'localhost' failed"
}
```

```bash
curl -s http://localhost:8000/api/v1/health/db
```

---

### 2. Analytics Endpoints

#### `GET /api/v1/analysis/accuracy`
Calculates aggregate error metrics (**MAE**, **RMSE**, **Mean Bias**) across delivery dates using day-ahead forecasts selected at the decision cutoff.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `delivery_start` | `date` (YYYY-MM-DD) | No | `2026-01-01` | Start of delivery date range (inclusive). |
| `delivery_end` | `date` (YYYY-MM-DD) | No | `2026-01-31` | End of delivery date range (inclusive). Maximum span: 62 days. |
| `cutoff_hour` | `integer` (0–23) | No | `11` | Decision cutoff hour on day D−1 in UTC (e.g. 11 = 11:00 UTC). |

**Response `200 OK`:**
```json
{
  "delivery_start": "2026-01-01",
  "delivery_end": "2026-01-31",
  "decision_cutoff_hour_utc": 11,
  "sample_count": 1488,
  "paired_count": 1440,
  "missing_forecast_count": 48,
  "mae_mw": 2055.23,
  "rmse_mw": 2546.12,
  "mean_bias_mw": 1759.85,
  "methodology": {
    "decision_cutoff": "Latest WINDFOR publish_time <= (delivery_date - 1 day) at 11:00 UTC.",
    "forecast_resolution": "60-minute (WINDFOR)",
    "actual_resolution": "30-minute (FUELHH)",
    "alignment": "Each 30-min actual is paired with the forecast covering its hour (floor to hour).",
    "notes": [
      "January 1 actuals have missing forecasts because Dec 31 publications were not ingested.",
      "Metrics apply only to paired observations."
    ]
  }
}
```

```bash
curl -s "http://localhost:8000/api/v1/analysis/accuracy?delivery_start=2026-01-01&delivery_end=2026-01-31&cutoff_hour=11"
```

---

#### `GET /api/v1/analysis/comparison`
Returns time-series intervals aligning half-hourly actuals with day-ahead hourly forecasts, including the error for each period (`forecast_mw - actual_mw`).

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `delivery_start` | `date` (YYYY-MM-DD) | No | `2026-01-01` | Start of delivery date range (inclusive). |
| `delivery_end` | `date` (YYYY-MM-DD) | No | `2026-01-31` | End of delivery date range (inclusive). |
| `cutoff_hour` | `integer` (0–23) | No | `11` | Decision cutoff hour on day D−1 in UTC. |
| `limit` | `integer` (1–2000) | No | `500` | Number of items to return. |
| `offset` | `integer` (≥ 0) | No | `0` | Number of items to skip for pagination. |

**Response `200 OK`:**
```json
{
  "delivery_start": "2026-01-02",
  "delivery_end": "2026-01-02",
  "decision_cutoff_hour_utc": 11,
  "total": 48,
  "limit": 2,
  "offset": 0,
  "missing_forecast_count": 0,
  "items": [
    {
      "settlement_date": "2026-01-02",
      "settlement_period": 1,
      "start_time": "2026-01-02T00:00:00Z",
      "forecast_publish_time": "2026-01-01T09:30:00Z",
      "actual_mw": 14133,
      "forecast_mw": 15820,
      "error_mw": 1687
    },
    {
      "settlement_date": "2026-01-02",
      "settlement_period": 2,
      "start_time": "2026-01-02T00:30:00Z",
      "forecast_publish_time": "2026-01-01T09:30:00Z",
      "actual_mw": 13950,
      "forecast_mw": 15820,
      "error_mw": 1870
    }
  ]
}
```

```bash
curl -s "http://localhost:8000/api/v1/analysis/comparison?delivery_start=2026-01-02&delivery_end=2026-01-02&limit=48"
```

---

### 3. Data Explorer Endpoints

#### `GET /api/v1/actuals`
Retrieves raw national wind generation actuals from Elexon BMRS (`FUELHH`).

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `delivery_start` | `date` (YYYY-MM-DD) | No | `2026-01-01` | Filter by settlement date start. |
| `delivery_end` | `date` (YYYY-MM-DD) | No | `2026-01-31` | Filter by settlement date end. |
| `limit` | `integer` (1–2000) | No | `500` | Pagination page size. |
| `offset` | `integer` (≥ 0) | No | `0` | Pagination offset. |

**Response `200 OK`:**
```json
{
  "total": 1488,
  "limit": 2,
  "offset": 0,
  "items": [
    {
      "settlement_date": "2026-01-01",
      "settlement_period": 1,
      "start_time": "2026-01-01T00:00:00Z",
      "publish_time": "2026-01-01T00:30:00Z",
      "generation_mw": 14820
    },
    {
      "settlement_date": "2026-01-01",
      "settlement_period": 2,
      "start_time": "2026-01-01T00:30:00Z",
      "publish_time": "2026-01-01T01:00:00Z",
      "generation_mw": 14750
    }
  ]
}
```

```bash
curl -s "http://localhost:8000/api/v1/actuals?delivery_start=2026-01-01&delivery_end=2026-01-02&limit=10"
```

---

#### `GET /api/v1/forecasts`
Retrieves national wind generation forecasts from Elexon BMRS (`WINDFOR`). Supports point-in-time filtering to avoid look-ahead bias.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `delivery_start` | `date` (YYYY-MM-DD) | No | `2026-01-01` | Filter by target delivery start date. |
| `delivery_end` | `date` (YYYY-MM-DD) | No | `2026-01-31` | Filter by target delivery end date. |
| `cutoff` | `ISO 8601 datetime` | No | `null` | Only return forecasts published at or before this time. |
| `latest_only` | `boolean` | No | `false` | When `true`, returns only the latest eligible publication per delivery hour (requires `cutoff`). |
| `limit` | `integer` (1–2000) | No | `500` | Pagination page size. |
| `offset` | `integer` (≥ 0) | No | `0` | Pagination offset. |

**Response `200 OK`:**
```json
{
  "total": 24,
  "limit": 2,
  "offset": 0,
  "cutoff": "2026-01-01T11:00:00Z",
  "latest_only": true,
  "items": [
    {
      "start_time": "2026-01-02T00:00:00Z",
      "publish_time": "2026-01-01T09:30:00Z",
      "generation_mw": 15820
    },
    {
      "start_time": "2026-01-02T01:00:00Z",
      "publish_time": "2026-01-01T09:30:00Z",
      "generation_mw": 15740
    }
  ]
}
```

```bash
curl -s "http://localhost:8000/api/v1/forecasts?delivery_start=2026-01-02&delivery_end=2026-01-02&cutoff=2026-01-01T11:00:00Z&latest_only=true"
```

---

### 4. Ingestion Endpoint

#### `POST /api/v1/ingest`
Triggers an automated fetch of January 2026 FUELHH actuals and WINDFOR forecasts from the Elexon BMRS API and loads them into PostgreSQL with idempotent upsert (`ON CONFLICT DO NOTHING`).

**Headers:**
| Header | Required | Description |
|---|---|---|
| `X-Ingestion-Token` | Yes | Must match `INGESTION_TOKEN` configured in backend environment. |

**Response `200 OK`:**
```json
{
  "ok": true,
  "actuals_fetched": 1491,
  "actuals_inserted": 1491,
  "actuals_skipped": 0,
  "forecasts_fetched": 18104,
  "forecasts_inserted": 18104,
  "forecasts_skipped": 0,
  "duration_seconds": 2.85,
  "errors": []
}
```

**Response `401 Unauthorized`:**
```json
{
  "detail": "Invalid or missing X-Ingestion-Token header"
}
```

```bash
curl -s -X POST http://localhost:8000/api/v1/ingest \
     -H "X-Ingestion-Token: <your-token>"
```

---

## Error Handling Standards

| HTTP Code | Condition | Example Response Body |
|---|---|---|
| `401 Unauthorized` | Invalid or missing `X-Ingestion-Token` on ingestion | `{"detail": "Invalid or missing X-Ingestion-Token header"}` |
| `422 Unprocessable Entity` | Validation error (e.g. `delivery_end < delivery_start`, date span > 62 days, `latest_only=true` without `cutoff`) | `{"detail": [{"loc": ["query", "delivery_end"], "msg": "delivery_end must be >= delivery_start", "type": "value_error"}]}` |
| `500 Internal Server Error` | Database or unhandled server failure | `{"detail": "Database error"}` |
| `503 Service Unavailable` | Database connectivity failure on `/health/db` | `{"status": "unhealthy", "database": "disconnected", "detail": "..."}` |
