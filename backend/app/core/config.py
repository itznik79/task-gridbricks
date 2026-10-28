from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    APP_ENV: str = "development"
    LOG_LEVEL: str = "INFO"

    # Database
    DATABASE_URL: str = "postgresql+psycopg2://wind:wind@localhost:5432/wind_forecast"

    # Elexon API
    ELEXON_BASE_URL: str = "https://data.elexon.co.uk/bmrs/api/v1"

    # CORS
    ALLOWED_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]


settings = Settings()
