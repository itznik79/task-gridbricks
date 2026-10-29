"""Response schemas for the data-explorer endpoints (/actuals, /forecasts)."""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class ActualRecord(BaseModel):
    """One half-hourly FUELHH wind actual."""

    model_config = ConfigDict(from_attributes=True)

    settlement_date: date
    settlement_period: int
    start_time: datetime
    publish_time: datetime
    generation_mw: int


class ForecastRecord(BaseModel):
    """One hourly WINDFOR forecast value for a given publication."""

    model_config = ConfigDict(from_attributes=True)

    start_time: datetime
    publish_time: datetime
    generation_mw: int


class PaginatedActuals(BaseModel):
    total: int  # total rows matching the filter (before pagination)
    limit: int
    offset: int
    items: list[ActualRecord]


class PaginatedForecasts(BaseModel):
    total: int  # total rows matching the filter (before pagination)
    limit: int
    offset: int
    cutoff: datetime | None  # publish_time upper bound applied, if any
    latest_only: bool  # whether rows were collapsed to the latest eligible version
    items: list[ForecastRecord]
