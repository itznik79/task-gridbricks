"""
Historical Elexon data ingestion for January 2026.

Fetches FUELHH wind actuals and WINDFOR wind forecasts for the January 2026
publish window, then bulk-inserts them using ON CONFLICT DO NOTHING for
idempotency.  Network requests run outside any database transaction; data is
committed in batches of 500 rows.
"""

import time
from datetime import UTC, date, datetime

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.models.wind import WindActual, WindForecast
from app.schemas.ingestion import IngestionResult
from app.services.elexon_client import ElexonClient, ElexonError, FuelHHRecord, WindForRecord

# Publish window for January 2026.
# Upper bound is 2026-02-01T01:00:00Z (generous +1 h) to capture SP48 of Jan 31,
# whose publishTime is approximately 2026-02-01T00:00:00Z.
_INGEST_FROM = datetime(2026, 1, 1, 0, 0, tzinfo=UTC)
_INGEST_TO = datetime(2026, 2, 1, 1, 0, tzinfo=UTC)

_BATCH_SIZE = 500


# ---------------------------------------------------------------------------
# Row-mapping helpers
# ---------------------------------------------------------------------------


def _fuelhh_to_row(r: FuelHHRecord) -> dict:
    return {
        "settlement_date": date.fromisoformat(r.settlementDate),
        "settlement_period": r.settlementPeriod,
        "start_time": r.startTime,
        "publish_time": r.publishTime,
        "generation_mw": r.generation,
    }


def _windfor_to_row(r: WindForRecord) -> dict:
    return {
        "start_time": r.startTime,
        "publish_time": r.publishTime,
        "generation_mw": r.generation,
    }


# ---------------------------------------------------------------------------
# Bulk insert
# ---------------------------------------------------------------------------


def _bulk_upsert(
    db: Session,
    model_cls: type,
    rows: list[dict],
    conflict_constraint: str,
) -> tuple[int, int]:
    """Bulk insert *rows* with ON CONFLICT DO NOTHING, committing every _BATCH_SIZE rows.

    Returns (total_inserted, total_skipped).  Each committed batch is durable even
    if a later batch fails; callers should treat partial success as normal and rely on
    idempotency (repeat runs skip already-stored rows).
    """
    total_inserted = 0
    total_skipped = 0

    for i in range(0, len(rows), _BATCH_SIZE):
        batch = rows[i : i + _BATCH_SIZE]
        stmt = pg_insert(model_cls.__table__).values(batch)
        stmt = stmt.on_conflict_do_nothing(constraint=conflict_constraint)
        result = db.execute(stmt)
        db.commit()
        batch_inserted = result.rowcount
        total_inserted += batch_inserted
        total_skipped += len(batch) - batch_inserted

    return total_inserted, total_skipped


# ---------------------------------------------------------------------------
# Ingestion orchestrator
# ---------------------------------------------------------------------------


async def ingest_january_2026(
    db: Session,
    *,
    elexon_client: ElexonClient | None = None,
) -> IngestionResult:
    """Fetch and store January 2026 FUELHH actuals and WINDFOR forecasts.

    Network requests are made before any database write.  Each dataset is
    inserted independently: a failure in one does not prevent the other from
    being stored.

    Pass *elexon_client* to inject a pre-configured client (useful for tests).
    When None (default), a new ElexonClient is created and closed automatically.
    """
    result = IngestionResult()
    t0 = time.monotonic()

    # --- fetch (outside DB transaction) ---
    async with elexon_client or ElexonClient() as client:
        try:
            actuals = await client.get_wind_actuals(_INGEST_FROM, _INGEST_TO)
            result.actuals_fetched = len(actuals)
        except ElexonError as exc:
            result.errors.append(f"Actuals fetch failed: {exc}")
            actuals = []

        try:
            forecasts = await client.get_wind_forecasts(_INGEST_FROM, _INGEST_TO)
            result.forecasts_fetched = len(forecasts)
        except ElexonError as exc:
            result.errors.append(f"Forecasts fetch failed: {exc}")
            forecasts = []

    # --- insert actuals ---
    if actuals:
        rows = [_fuelhh_to_row(r) for r in actuals]
        try:
            ins, skip = _bulk_upsert(db, WindActual, rows, "uq_wind_actuals_date_period")
            result.actuals_inserted = ins
            result.actuals_skipped = skip
        except Exception as exc:  # noqa: BLE001
            db.rollback()
            result.errors.append(f"Actuals insert failed: {exc}")

    # --- insert forecasts ---
    if forecasts:
        rows = [_windfor_to_row(r) for r in forecasts]
        try:
            ins, skip = _bulk_upsert(db, WindForecast, rows, "uq_wind_forecasts_start_publish")
            result.forecasts_inserted = ins
            result.forecasts_skipped = skip
        except Exception as exc:  # noqa: BLE001
            db.rollback()
            result.errors.append(f"Forecasts insert failed: {exc}")

    result.duration_seconds = round(time.monotonic() - t0, 2)
    return result
