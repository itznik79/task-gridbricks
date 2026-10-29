"""
Forecast accuracy analytics for January 2026.

--------------------------------------------------------------------------
Day-ahead decision model
--------------------------------------------------------------------------
For delivery date D the purchasing decision is locked at *cutoff_hour*:00 UTC
on day D-1 (the UK N2EX / EPEX day-ahead gate closure).  The default cutoff
of 11:00 UTC on D-1 comes from docs/architecture.md — see the "Unresolved
assumptions" section below for caveats.

The selected forecast for each delivery hour H is the WINDFOR publication
with the **latest** publish_time ≤ cutoff that covers H.

--------------------------------------------------------------------------
Time-alignment strategy (WINDFOR 60-min → FUELHH 30-min)
--------------------------------------------------------------------------
WINDFOR startTime is the start of a 60-minute forecast interval.  FUELHH
startTime is the start of a 30-minute settlement period.

Rule: floor the actual startTime to the nearest hour.

    SP11  05:00–05:30  →  floor → 05:00  →  WINDFOR forecast at 05:00
    SP12  05:30–06:00  →  floor → 05:00  →  WINDFOR forecast at 05:00 (same)
    SP13  06:00–06:30  →  floor → 06:00  →  WINDFOR forecast at 06:00

Both half-hours within the same forecast hour receive the *same* forecast MW
value.  This is not interpolation — WINDFOR does not publish sub-hourly data.
As a consequence, each forecast hour contributes *two* samples to the aggregate
statistics, so hours with large errors are doubly weighted.

--------------------------------------------------------------------------
Unresolved domain assumptions
--------------------------------------------------------------------------
1.  Decision cutoff at 11:00 UTC on D-1 is taken from the architecture doc.
    The actual UK balancing-mechanism gate closure time may differ, and the
    relevant market (N2EX / Elexon BM) should be confirmed before relying on
    this figure for production decisions.

2.  WINDFOR `generation` is treated as average MW for the forecast hour,
    consistent with FUELHH `generation` being average MW for the 30-min
    period.  This assumption was not independently confirmed from the Elexon
    BMRS documentation.

3.  January 1 delivery dates have **no valid day-ahead forecast** in the
    database because the ingestion window starts at 2026-01-01T00:00Z.  The
    last pre-cutoff publication for Jan 1 delivery would have been the
    2025-12-31T09:30Z WINDFOR run, which was not ingested.  Jan 1 actuals
    (48 records) are counted in missing_forecast_count and excluded from all
    metric calculations.
"""

import math
from datetime import UTC, date, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.wind import WindActual, WindForecast
from app.schemas.analytics import AccuracyReport, IntervalError

# ---------------------------------------------------------------------------
# Pure helpers — exposed for direct testing
# ---------------------------------------------------------------------------


def floor_to_hour(dt: datetime) -> datetime:
    """Truncate a UTC datetime to the start of its containing hour."""
    return dt.replace(minute=0, second=0, microsecond=0)


def decision_cutoff(delivery_date: date, cutoff_hour: int = 11) -> datetime:
    """Return the UTC decision cutoff datetime for *delivery_date*.

    The cutoff is cutoff_hour:00 UTC on the day before delivery.
    Assumption: see module docstring item 1.
    """
    d_minus_1 = delivery_date - timedelta(days=1)
    return datetime(d_minus_1.year, d_minus_1.month, d_minus_1.day, cutoff_hour, 0, tzinfo=UTC)


def select_forecast_for_hour(
    publish_to_mw: dict[datetime, int],
    cutoff: datetime,
) -> tuple[datetime, int] | None:
    """Select the best available forecast for one delivery hour.

    *publish_to_mw* maps every known publish_time to its generation_mw for a
    single WINDFOR startTime.  Returns (publish_time, generation_mw) for the
    latest publish_time ≤ cutoff, or None if no valid version exists.
    """
    valid = [(pt, mw) for pt, mw in publish_to_mw.items() if pt <= cutoff]
    if not valid:
        return None
    return max(valid, key=lambda x: x[0])


def compute_metrics(errors_mw: list[int]) -> tuple[float, float, float]:
    """Compute (MAE, RMSE, mean_bias) from a list of forecast errors in MW.

    error_i = forecast_i − actual_i  (positive = over-forecast)

    Raises ValueError if *errors_mw* is empty.
    """
    if not errors_mw:
        raise ValueError("Cannot compute metrics on an empty error list")
    n = len(errors_mw)
    mae = sum(abs(e) for e in errors_mw) / n
    rmse = math.sqrt(sum(e * e for e in errors_mw) / n)
    bias = sum(errors_mw) / n
    return mae, rmse, bias


# ---------------------------------------------------------------------------
# Main service function
# ---------------------------------------------------------------------------


def compute_accuracy_report(
    db: Session,
    delivery_start: date,
    delivery_end: date,
    *,
    cutoff_hour: int = 11,
) -> AccuracyReport:
    """Compute forecast accuracy for delivery dates [delivery_start, delivery_end] inclusive.

    Queries wind_actuals and wind_forecasts, pairs each 30-min actual with the
    best available day-ahead forecast, and returns aggregate accuracy metrics
    with per-interval detail.

    Actuals with no valid pre-cutoff forecast are counted in
    missing_forecast_count and excluded from MAE / RMSE / bias calculations.
    """
    # --- load actuals ----------------------------------------------------------
    actual_rows = (
        db.query(
            WindActual.settlement_date,
            WindActual.settlement_period,
            WindActual.start_time,
            WindActual.generation_mw,
        )
        .filter(
            WindActual.settlement_date >= delivery_start,
            WindActual.settlement_date <= delivery_end,
        )
        .order_by(WindActual.start_time)
        .all()
    )

    # --- load forecasts for the delivery window --------------------------------
    # Use start_time bounds matching the delivery window (hourly WINDFOR slots).
    win_start = datetime(delivery_start.year, delivery_start.month, delivery_start.day, tzinfo=UTC)
    win_end = datetime(
        delivery_end.year, delivery_end.month, delivery_end.day, tzinfo=UTC
    ) + timedelta(days=1)

    forecast_rows = (
        db.query(
            WindForecast.start_time,
            WindForecast.publish_time,
            WindForecast.generation_mw,
        )
        .filter(
            WindForecast.start_time >= win_start,
            WindForecast.start_time < win_end,
        )
        .all()
    )

    # Build forecast index: {start_time → {publish_time → mw}}
    forecast_index: dict[datetime, dict[datetime, int]] = {}
    for st, pt, mw in forecast_rows:
        if st not in forecast_index:
            forecast_index[st] = {}
        forecast_index[st][pt] = mw

    # --- pair actuals with forecasts -------------------------------------------
    intervals: list[IntervalError] = []
    missing = 0

    for sd, sp, st, actual_mw in actual_rows:
        forecast_hour = floor_to_hour(st)
        cutoff = decision_cutoff(sd, cutoff_hour)
        pub_to_mw = forecast_index.get(forecast_hour, {})
        match = select_forecast_for_hour(pub_to_mw, cutoff)

        if match is None:
            missing += 1
            continue

        pub_time, forecast_mw = match
        intervals.append(
            IntervalError(
                settlement_date=sd,
                settlement_period=sp,
                start_time=st,
                forecast_publish_time=pub_time,
                actual_mw=actual_mw,
                forecast_mw=forecast_mw,
                error_mw=forecast_mw - actual_mw,
            )
        )

    # --- compute aggregate metrics ---------------------------------------------
    mae: float | None = None
    rmse: float | None = None
    mean_bias: float | None = None

    if intervals:
        errors = [iv.error_mw for iv in intervals]
        mae, rmse, mean_bias = compute_metrics(errors)

    return AccuracyReport(
        delivery_start=delivery_start,
        delivery_end=delivery_end,
        decision_cutoff_hour_utc=cutoff_hour,
        sample_count=len(actual_rows),
        paired_count=len(intervals),
        missing_forecast_count=missing,
        mae_mw=mae,
        rmse_mw=rmse,
        mean_bias_mw=mean_bias,
        intervals=intervals,
    )
