"""Application settings, loaded from environment / .env file."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- app ---
    app_name: str = "DocuMind AI"
    api_prefix: str = "/api"
    debug: bool = True

    # --- gemini / langgraph ---
    google_api_key: str = ""
    gemini_model: str = "gemini-3.7-flash"
    gemini_temperature: float = 0.4
    gemini_max_output_tokens: int = 8192
    history_window: int = 24  # how many past messages are replayed to the model

    # --- persistence ---
    database_url: str = f"sqlite+aiosqlite:///{DATA_DIR / 'documind.db'}"
    export_dir: Path = DATA_DIR / "documents"

    # --- cors (comma separated) ---
    cors_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:5174,http://127.0.0.1:5174,http://localhost:4173"
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def has_api_key(self) -> bool:
        key = self.google_api_key.strip()
        # The .env.example placeholder must not read as a working key.
        return bool(key) and "your-gemini-api-key" not in key


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    settings.export_dir.mkdir(parents=True, exist_ok=True)
    return settings


settings = get_settings()
