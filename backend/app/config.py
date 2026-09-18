"""Central configuration, loaded from environment variables (.env)."""
from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="PTS_", extra="ignore")

    # Storage
    data_dir: Path = Path("data")
    upload_ttl_minutes: int = 120  # temp files auto-deleted after this long
    cleanup_interval_seconds: int = 300

    # CORS
    allowed_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # Reconstruction limits
    max_upload_files: int = 6
    max_upload_mb: int = 25
    max_image_dimension: int = 2048  # longer edge is downscaled to this before processing

    # Optional commercial Image-to-3D provider API keys (never sent to frontend).
    # Leave unset to use the built-in local geometric providers only.
    tripo_api_key: str | None = None
    meshy_api_key: str | None = None
    rodin_api_key: str | None = None
    stability_api_key: str | None = None

    # Which provider to prefer when multiple are usable. "auto" picks the best
    # available local provider based on how many usable views were uploaded.
    image_to_3d_provider: str = "auto"

    @property
    def uploads_dir(self) -> Path:
        return self.data_dir / "uploads"

    @property
    def models_dir(self) -> Path:
        return self.data_dir / "models"


settings = Settings()
settings.uploads_dir.mkdir(parents=True, exist_ok=True)
settings.models_dir.mkdir(parents=True, exist_ok=True)
