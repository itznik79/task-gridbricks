"""Analysis endpoints: GET /analysis/accuracy and GET /analysis/comparison.

Both reuse the M4 compute_accuracy_report service — no metric logic lives here.
"""

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.v1.deps import delivery_range
from app.db.session import get_db
from app.schemas.analytics import AccuracySummary, Methodology, PaginatedComparison
from app.services.analytics import compute_accuracy_report

router = APIRouter()


def _methodology(cutoff_hour: int) -> Methodology:
    """Describe the current (unverified) modelling assumptions for responses."""
    return Methodology(
        decision_cutoff=(
            f"{cutoff_hour:02d}:00 UTC on D-1 — current assumption, NOT independently "
            "verified against UK market gate-closure rules"
        ),
        forecast_resolution="hourly (Elexon WINDFOR)",
        actual_resolution="30-minute settlement periods (Elexon FUELHH)",
        alignment=(
            "each 30-min actual is aligned to its containing forecast hour (floor to "
            "the hour); forecast values are not interpolated or duplicated into "
            "sub-hourly points"
        ),
        notes=[
            "Metrics apply only to paired observations with an eligible pre-cutoff forecast.",
            "2026-01-01 has no eligible forecast under the current ingestion window "
            "(first WINDFOR publication is 2026-01-01T02:30Z); its actuals are counted "
            "in missing_forecast_count and excluded from metrics.",
            "error_mw = forecast_mw - actual_mw; a positive mean bias indicates "
            "systematic over-forecast.",
            "WINDFOR generation is treated as average MW per hour, consistent with "
            "FUELHH; this has not been independently confirmed from Elexon documentation.",
        ],
    )


@router.get("/analysis/accuracy", response_model=AccuracySummary)
def get_accuracy(
    rng: tuple[date, date] = Depends(delivery_range),
    cutoff_hour: int = Query(11, ge=0, le=23, description="Decision-cutoff hour (UTC) on day D-1."),
    db: Session = Depends(get_db),
) -> AccuracySummary:
    """Aggregate MAE / RMSE / bias with sample and missing-data counts.

    Per-interval detail is available from GET /analysis/comparison.
    """
    start, end = rng
    report = compute_accuracy_report(db, start, end, cutoff_hour=cutoff_hour)
    return AccuracySummary(
        delivery_start=report.delivery_start,
        delivery_end=report.delivery_end,
        decision_cutoff_hour_utc=report.decision_cutoff_hour_utc,
        sample_count=report.sample_count,
        paired_count=report.paired_count,
        missing_forecast_count=report.missing_forecast_count,
        mae_mw=report.mae_mw,
        rmse_mw=report.rmse_mw,
        mean_bias_mw=report.mean_bias_mw,
        methodology=_methodology(cutoff_hour),
    )


@router.get("/analysis/comparison", response_model=PaginatedComparison)
def get_comparison(
    rng: tuple[date, date] = Depends(delivery_range),
    cutoff_hour: int = Query(11, ge=0, le=23, description="Decision-cutoff hour (UTC) on day D-1."),
    limit: int = Query(500, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> PaginatedComparison:
    """Aligned forecast-vs-actual intervals with per-interval errors (paginated)."""
    start, end = rng
    report = compute_accuracy_report(db, start, end, cutoff_hour=cutoff_hour)
    items = report.intervals[offset : offset + limit]
    return PaginatedComparison(
        delivery_start=report.delivery_start,
        delivery_end=report.delivery_end,
        decision_cutoff_hour_utc=report.decision_cutoff_hour_utc,
        total=report.paired_count,
        limit=limit,
        offset=offset,
        missing_forecast_count=report.missing_forecast_count,
        items=items,
    )
