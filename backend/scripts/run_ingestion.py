#!/usr/bin/env python
"""
Run the January 2026 historical ingestion directly against the configured database.

Usage (from backend/):
    uv run python scripts/run_ingestion.py
"""

import asyncio
import sys

sys.path.insert(0, ".")

from app.db.session import _get_session_factory  # noqa: E402
from app.services.ingestion import ingest_january_2026  # noqa: E402


async def main() -> None:
    SessionLocal = _get_session_factory()
    db = SessionLocal()
    try:
        print("Starting January 2026 ingestion…")
        result = await ingest_january_2026(db)
    finally:
        db.close()

    print(
        f"\nActuals  : fetched={result.actuals_fetched}  inserted={result.actuals_inserted}"
        f"  skipped={result.actuals_skipped}"
    )
    print(
        f"Forecasts: fetched={result.forecasts_fetched}  inserted={result.forecasts_inserted}"
        f"  skipped={result.forecasts_skipped}"
    )
    print(f"Duration : {result.duration_seconds}s")
    if result.errors:
        print("\nErrors:")
        for e in result.errors:
            print(f"  - {e}")
        sys.exit(1)
    else:
        print(f"\nok={result.ok}  — ingestion complete")


asyncio.run(main())
