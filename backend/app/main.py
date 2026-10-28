from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import health
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

app.include_router(health.router, prefix="/api/v1", tags=["health"])


@app.get("/")
def root():
    return {"message": "Wind Forecast API", "docs": "/docs"}
