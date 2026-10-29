from datetime import date, datetime

from pydantic import BaseModel


class IntervalError(BaseModel):
    """Forecast error for one 30-minute actual settlement period."""

    settlement_date: date
    settlement_period: int
    start_time: datetime  # half-hour actual start (UTC)
    forecast_publish_time: datetime  # publication used for this interval
    actual_mw: int
    forecast_mw: int
    error_mw: int  # forecast_mw - actual_mw; positive = over-forecast


class AccuracyReport(BaseModel):
    """Forecast accuracy over a range of January 2026 delivery dates."""

    delivery_start: date
    delivery_end: date
    decision_cutoff_hour_utc: int  # hour on day D-1 used as the cut-off (default 11)
    sample_count: int  # total actuals in the date range
    paired_count: int  # actuals with a valid day-ahead forecast
    missing_forecast_count: int  # actuals with no pre-cutoff forecast
    mae_mw: float | None  # None when paired_count == 0
    rmse_mw: float | None
    mean_bias_mw: float | None  # mean(forecast - actual); positive = systematic over-forecast
    intervals: list[IntervalError]


# ---------------------------------------------------------------------------
# API response models (M5) — wrap the M4 AccuracyReport for the REST layer
# ---------------------------------------------------------------------------


class Methodology(BaseModel):
    """Current analysis assumptions, surfaced in API responses.

    These describe modelling choices, not independently verified market rules.
    """

    decision_cutoff: str
    forecast_resolution: str
    actual_resolution: str
    alignment: str
    notes: list[str]


class AccuracySummary(BaseModel):
    """Aggregate accuracy metrics plus methodology (no per-interval detail)."""

    delivery_start: date
    delivery_end: date
    decision_cutoff_hour_utc: int
    sample_count: int
    paired_count: int
    missing_forecast_count: int
    mae_mw: float | None
    rmse_mw: float | None
    mean_bias_mw: float | None
    methodology: Methodology


class PaginatedComparison(BaseModel):
    """Paginated aligned forecast-vs-actual intervals with per-interval errors."""

    delivery_start: date
    delivery_end: date
    decision_cutoff_hour_utc: int
    total: int  # paired_count — intervals with a valid forecast
    limit: int
    offset: int
    missing_forecast_count: int
    items: list[IntervalError]
