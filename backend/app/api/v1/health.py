from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.db.session import get_db

router = APIRouter()


@router.get("/health")
def health_check():
    return {"status": "ok", "service": "wind-forecast-api"}


@router.get("/health/db")
def db_health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except OperationalError as exc:
        raise HTTPException(status_code=500, detail="Database unavailable") from exc
