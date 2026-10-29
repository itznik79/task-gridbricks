from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.api.v1 import analysis, explorer, health, ingest
from app.core.config import settings

app = FastAPI(
    title="Wind Forecast & Accuracy Analytics API",
    description="UK national wind generation forecasts vs actuals for day-ahead purchasing.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(SQLAlchemyError)
async def _sqlalchemy_error_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """Return a consistent 500 for any unhandled database error."""
    return JSONResponse(status_code=500, content={"detail": "Database error"})


app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(ingest.router, prefix="/api/v1", tags=["ingestion"])
app.include_router(explorer.router, prefix="/api/v1", tags=["data"])
app.include_router(analysis.router, prefix="/api/v1", tags=["analysis"])


@app.get("/")
def root():
    return {"message": "Wind Forecast API", "docs": "/docs"}
