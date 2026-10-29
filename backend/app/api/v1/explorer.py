"""Data-explorer endpoints: GET /actuals and GET /forecasts."""

from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.v1.deps import delivery_range
from app.db.session import get_db
from app.models.wind import WindActual, WindForecast
from app.schemas.wind import (
    ActualRecord,
    ForecastRecord,
    PaginatedActuals,
    PaginatedForecasts,
)
from app.services.analytics import select_forecast_for_hour

router = APIRouter()


@router.get("/actuals", response_model=PaginatedActuals)
def get_actuals(
    rng: tuple[date, date] = Depends(delivery_range),
    limit: int = Query(500, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> PaginatedActuals:
    """Half-hourly FUELHH wind actuals for the data explorer.

    Filtered by settlement_date in the requested delivery range, ordered by
    start_time.  Returns an empty page (not an error) when nothing matches.
    """
    start, end = rng
    base = db.query(WindActual).filter(
        WindActual.settlement_date >= start,
        WindActual.settlement_date <= end,
    )
    total = base.count()
    rows = (
        base.order_by(WindActual.start_time, WindActual.settlement_period)
        .offset(offset)
        .limit(limit)
        .all()
    )
    return PaginatedActuals(
        total=total,
        limit=limit,
        offset=offset,
        items=[ActualRecord.model_validate(r) for r in rows],
    )


@router.get("/forecasts", response_model=PaginatedForecasts)
def get_forecasts(
    rng: tuple[date, date] = Depends(delivery_range),
    cutoff: datetime | None = Query(
        None,
        description=(
            "If set, only forecasts published at or before this UTC instant are "
            "returned — enforces look-ahead-bias prevention. ISO 8601; naive "
            "values are treated as UTC."
        ),
    ),
    latest_only: bool = Query(
        False,
        description=(
            "If true (requires cutoff), collapse to the single latest eligible "
            "forecast per delivery hour."
        ),
    ),
    limit: int = Query(500, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> PaginatedForecasts:
    """Hourly WINDFOR forecasts, optionally constrained to a decision cutoff.

    Without `cutoff`, all publication versions in the window are returned (the
    raw explorer view).  With `cutoff`, later publications are excluded so the
    response reflects only what was knowable at that instant.
    """
    start, end = rng

    if latest_only and cutoff is None:
        raise HTTPException(status_code=422, detail="latest_only requires cutoff")

    if cutoff is not None and cutoff.tzinfo is None:
        cutoff = cutoff.replace(tzinfo=UTC)

    win_start = datetime(start.year, start.month, start.day, tzinfo=UTC)
    win_end = datetime(end.year, end.month, end.day, tzinfo=UTC) + timedelta(days=1)

    base = db.query(WindForecast).filter(
        WindForecast.start_time >= win_start,
        WindForecast.start_time < win_end,
    )
    if cutoff is not None:
        base = base.filter(WindForecast.publish_time <= cutoff)

    if latest_only:
        # Collapse to the latest eligible publication per delivery hour, reusing
        # the M4 selection helper.  Bounded by MAX_RANGE_DAYS at the dependency.
        rows = base.order_by(WindForecast.start_time, WindForecast.publish_time).all()
        index: dict[datetime, dict[datetime, int]] = {}
        for r in rows:
            index.setdefault(r.start_time, {})[r.publish_time] = r.generation_mw

        selected: list[ForecastRecord] = []
        for st in sorted(index):
            match = select_forecast_for_hour(index[st], cutoff)
            if match is not None:
                pt, mw = match
                selected.append(ForecastRecord(start_time=st, publish_time=pt, generation_mw=mw))

        total = len(selected)
        items = selected[offset : offset + limit]
        return PaginatedForecasts(
            total=total,
            limit=limit,
            offset=offset,
            cutoff=cutoff,
            latest_only=True,
            items=items,
        )

    total = base.count()
    rows = (
        base.order_by(WindForecast.start_time, WindForecast.publish_time)
        .offset(offset)
        .limit(limit)
        .all()
    )
    return PaginatedForecasts(
        total=total,
        limit=limit,
        offset=offset,
        cutoff=cutoff,
        latest_only=False,
        items=[ForecastRecord.model_validate(r) for r in rows],
    )
