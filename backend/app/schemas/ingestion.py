from pydantic import BaseModel, Field, computed_field


class IngestionResult(BaseModel):
    actuals_fetched: int = 0
    actuals_inserted: int = 0
    actuals_skipped: int = 0
    forecasts_fetched: int = 0
    forecasts_inserted: int = 0
    forecasts_skipped: int = 0
    errors: list[str] = Field(default_factory=list)
    duration_seconds: float = 0.0

    @computed_field
    @property
    def ok(self) -> bool:
        return len(self.errors) == 0
