from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    Index,
    Integer,
    SmallInteger,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class WindActual(Base):
    """Half-hourly national wind generation actuals from Elexon FUELHH.

    Source: GET /datasets/FUELHH/stream?fuelType=WIND
    Resolution: 30-minute settlement periods (48 per day, 46/50 on DST transitions).
    Units: MW.

    Uniqueness assumption: Live FUELHH data (Jan 2026, 1 488 records) shows exactly
    one published actual per (settlement_date, settlement_period) — the API does not
    revise actuals after publication.  The unique constraint encodes this invariant.
    """

    __tablename__ = "wind_actuals"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # Settlement identity
    settlement_date: Mapped[date] = mapped_column(Date, nullable=False)
    settlement_period: Mapped[int] = mapped_column(SmallInteger, nullable=False)

    # Timestamps (always UTC)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    publish_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Measurement
    generation_mw: Mapped[int] = mapped_column(Integer, nullable=False)

    # Audit
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "settlement_date",
            "settlement_period",
            name="uq_wind_actuals_date_period",
        ),
        # Primary query pattern: range scans over delivery time
        Index("ix_wind_actuals_start_time", "start_time"),
        # Useful for settlement-date–based filtering
        Index("ix_wind_actuals_settlement_date", "settlement_date"),
    )

    def __repr__(self) -> str:
        return (
            f"WindActual(date={self.settlement_date} SP{self.settlement_period} "
            f"gen={self.generation_mw}MW)"
        )


class WindForecast(Base):
    """Hourly national wind generation forecasts from Elexon WINDFOR.

    Source: GET /datasets/WINDFOR/stream
    Resolution: 60-minute intervals (hourly, unlike FUELHH's 30-min).
    Units: MW.

    Forecast versioning: each publication (~8 per day) produces one record per startTime,
    covering ~73 hours ahead.  Multiple publishTimes may exist for the same startTime —
    this is intentional and essential for look-ahead bias prevention (M4).

    Uniqueness assumption: Live WINDFOR data shows exactly one (startTime, publishTime)
    pair per record — the API never revises a specific publication.  The unique constraint
    encodes this.  If future data violates it, the ingestion job should upsert on conflict.
    """

    __tablename__ = "wind_forecasts"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # Delivery interval and forecast version
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    publish_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Forecast value
    generation_mw: Mapped[int] = mapped_column(Integer, nullable=False)

    # Audit
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        # One forecast value per delivery hour per publication version
        UniqueConstraint(
            "start_time",
            "publish_time",
            name="uq_wind_forecasts_start_publish",
        ),
        # Range scans over delivery time (e.g. "all forecasts for January 2026")
        Index("ix_wind_forecasts_start_time", "start_time"),
        # Look-ahead bias filter: WHERE publish_time <= :cutoff
        Index("ix_wind_forecasts_publish_time", "publish_time"),
        # Covering index for the key query:
        # "latest publishTime ≤ cutoff for each startTime in delivery window"
        Index("ix_wind_forecasts_start_publish", "start_time", "publish_time"),
    )

    def __repr__(self) -> str:
        return (
            f"WindForecast(start={self.start_time.isoformat()} "
            f"pub={self.publish_time.isoformat()} gen={self.generation_mw}MW)"
        )
