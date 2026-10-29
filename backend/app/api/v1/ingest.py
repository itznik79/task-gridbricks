"""POST /api/v1/ingest — trigger January 2026 historical data ingestion."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.schemas.ingestion import IngestionResult
from app.services.ingestion import ingest_january_2026

router = APIRouter()

# Prevents concurrent ingestion runs in a single-process deployment.
# The check and set are atomic in asyncio (no await between them).
_ingestion_running: bool = False


@router.post("/ingest", response_model=IngestionResult)
async def trigger_ingest(
    db: Session = Depends(get_db),
    x_ingestion_token: Annotated[str, Header()] = "",
) -> IngestionResult:
    """Fetch and store January 2026 FUELHH actuals and WINDFOR forecasts.

    Requires the **X-Ingestion-Token** header to match **INGESTION_TOKEN** in .env.
    An empty or unset INGESTION_TOKEN disables the endpoint.

    Returns fetched / inserted / skipped / error counts for both datasets.
    Returns 409 if ingestion is already running.
    """
    global _ingestion_running

    if not settings.INGESTION_TOKEN or x_ingestion_token != settings.INGESTION_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid or missing ingestion token")

    if _ingestion_running:
        raise HTTPException(status_code=409, detail="Ingestion already running")

    _ingestion_running = True
    try:
        return await ingest_january_2026(db)
    finally:
        _ingestion_running = False
