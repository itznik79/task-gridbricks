"""
Async HTTP client for the Elexon BMRS API v1.

Verified endpoints (2026-10-28 live API calls):
  - FUELHH /stream  → half-hourly (30-min) wind actuals, one record per settlement period
  - WINDFOR /stream → hourly (60-min) wind forecasts, ~8 publishes per day, ~73 hours lookahead

Both endpoints filter by publishDateTimeFrom / publishDateTimeTo.
Neither endpoint exposes pagination; the stream returns all matching records in one JSON array.
No API key or rate-limit headers observed.
"""

from datetime import datetime
from typing import Any

import httpx
from pydantic import BaseModel, ValidationError

from app.core.config import settings

# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class ElexonError(Exception):
    """Base class for all Elexon client errors."""


class ElexonTimeoutError(ElexonError):
    """Raised when a request to the Elexon API times out."""


class ElexonAPIError(ElexonError):
    """Raised when the Elexon API returns a non-2xx HTTP status."""

    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(f"HTTP {status_code}: {detail}")
        self.status_code = status_code
        self.detail = detail


class ElexonDataError(ElexonError):
    """Raised when the API response cannot be parsed into the expected schema."""


# ---------------------------------------------------------------------------
# Response schemas  (field names match the wire format exactly)
# ---------------------------------------------------------------------------


class FuelHHRecord(BaseModel):
    """One half-hourly wind actual from FUELHH.

    - generation: national wind generation in MW
    - settlementPeriod: 1–48 (or 1–46/50 on DST transitions)
    - publishTime ≈ startTime + 30 min (published when the half-hour closes)
    """

    dataset: str
    publishTime: datetime
    startTime: datetime
    settlementDate: str  # "YYYY-MM-DD"
    settlementPeriod: int
    fuelType: str
    generation: int  # MW


class WindForRecord(BaseModel):
    """One hourly wind forecast from WINDFOR.

    - generation: forecast wind generation in MW
    - publishTime: when this forecast version was published (~8 times per day)
    - startTime: forecast valid hour (hourly resolution, unlike FUELHH's 30-min)

    Multiple records share the same publishTime (one publish covers ~73 hours ahead).
    Multiple publishTimes may exist for the same startTime (forecast versioning).
    For look-ahead bias prevention, select only records where publishTime ≤ decision_cutoff.
    """

    dataset: str
    publishTime: datetime
    startTime: datetime
    generation: int  # MW


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

_FUELHH_PATH = "/datasets/FUELHH/stream"
_WINDFOR_PATH = "/datasets/WINDFOR/stream"
_DT_FMT = "%Y-%m-%dT%H:%M:%SZ"


class ElexonClient:
    """Async client for Elexon BMRS API.

    Usage as a context manager (preferred):
        async with ElexonClient() as client:
            actuals = await client.get_wind_actuals(date_from, date_to)

    Usage with a custom httpx.AsyncClient (useful for testing):
        async with ElexonClient(http_client=my_mock_client) as client:
            ...
    """

    def __init__(self, http_client: httpx.AsyncClient | None = None) -> None:
        self._owns_client = http_client is None
        self._client = http_client or httpx.AsyncClient(
            base_url=settings.ELEXON_BASE_URL,
            timeout=settings.ELEXON_TIMEOUT,
            headers={"Accept": "application/json"},
        )

    async def __aenter__(self) -> "ElexonClient":
        return self

    async def __aexit__(self, *_: Any) -> None:
        if self._owns_client:
            await self._client.aclose()

    # ------------------------------------------------------------------
    # Public methods
    # ------------------------------------------------------------------

    async def get_wind_actuals(
        self,
        date_from: datetime,
        date_to: datetime,
    ) -> list[FuelHHRecord]:
        """Fetch half-hourly WIND actuals from FUELHH for the given publish window.

        Both datetimes are interpreted as UTC.  The API filters by publishTime,
        which for actuals is approximately 30 minutes after each settlement period ends.
        To cover a full calendar day D, use:
            date_from = D 00:00:00Z, date_to = D+1 00:00:00Z  (exclusive upper bound)
        """
        raw = await self._get(
            _FUELHH_PATH,
            params={
                "fuelType": "WIND",
                "publishDateTimeFrom": _fmt_dt(date_from),
                "publishDateTimeTo": _fmt_dt(date_to),
            },
        )
        return _parse_list(raw, FuelHHRecord)

    async def get_wind_forecasts(
        self,
        date_from: datetime,
        date_to: datetime,
    ) -> list[WindForRecord]:
        """Fetch all WINDFOR forecast records whose publishTime falls in the given window.

        Each publish covers ~73 hours of hourly startTimes.  To retrieve every
        forecast version published across a date range, set a wide publish window.
        Callers are responsible for filtering to the desired startTime range and
        selecting the appropriate publishTime for look-ahead bias prevention.
        """
        raw = await self._get(
            _WINDFOR_PATH,
            params={
                "publishDateTimeFrom": _fmt_dt(date_from),
                "publishDateTimeTo": _fmt_dt(date_to),
            },
        )
        return _parse_list(raw, WindForRecord)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get(self, path: str, params: dict[str, str]) -> list[dict[str, Any]]:
        try:
            response = await self._client.get(path, params=params)
            response.raise_for_status()
        except httpx.TimeoutException as exc:
            raise ElexonTimeoutError(f"Request timed out: {path}") from exc
        except httpx.HTTPStatusError as exc:
            raise ElexonAPIError(
                status_code=exc.response.status_code,
                detail=exc.response.text[:200],
            ) from exc
        except httpx.RequestError as exc:
            raise ElexonError(f"Request failed: {exc}") from exc

        try:
            return response.json()
        except Exception as exc:
            raise ElexonDataError(f"Response is not valid JSON: {exc}") from exc


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _fmt_dt(dt: datetime) -> str:
    return dt.strftime(_DT_FMT)


def _parse_list(raw: list[dict[str, Any]], model: type) -> list:
    try:
        return [model.model_validate(item) for item in raw]
    except ValidationError as exc:
        raise ElexonDataError(f"Response schema mismatch: {exc}") from exc
