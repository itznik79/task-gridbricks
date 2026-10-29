"""Shared FastAPI dependencies and constants for v1 data/analysis endpoints."""

from datetime import date

from fastapi import HTTPException, Query

# Default analysis window — the dataset ingested in M3 (January 2026).
DEFAULT_START = date(2026, 1, 1)
DEFAULT_END = date(2026, 1, 31)

# Hard upper bound on any requested delivery-date span, to keep query/result
# sizes bounded regardless of caller input.
MAX_RANGE_DAYS = 62


def delivery_range(
    delivery_start: date = Query(
        DEFAULT_START, description="First delivery date, inclusive (UTC)."
    ),
    delivery_end: date = Query(DEFAULT_END, description="Last delivery date, inclusive (UTC)."),
) -> tuple[date, date]:
    """Validate and return an inclusive [start, end] delivery-date range.

    Raises 422 if end precedes start or the span exceeds MAX_RANGE_DAYS.
    """
    if delivery_end < delivery_start:
        raise HTTPException(
            status_code=422,
            detail="delivery_end must be on or after delivery_start",
        )
    if (delivery_end - delivery_start).days > MAX_RANGE_DAYS:
        raise HTTPException(
            status_code=422,
            detail=f"Delivery-date range must not exceed {MAX_RANGE_DAYS} days",
        )
    return delivery_start, delivery_end
