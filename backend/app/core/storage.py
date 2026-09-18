"""Temporary file storage with a TTL-based cleanup sweep.

Nothing the user uploads is kept indefinitely: every upload/model directory is
stamped with its creation time and a background sweep (started in main.py's
lifespan handler) deletes anything older than ``settings.upload_ttl_minutes``.
"""
from __future__ import annotations

import asyncio
import logging
import shutil
import time
import uuid
from pathlib import Path

from app.config import settings

logger = logging.getLogger("photo_to_stl.storage")


def new_id() -> str:
    return uuid.uuid4().hex[:16]


def upload_dir(upload_id: str, create: bool = False) -> Path:
    d = settings.uploads_dir / upload_id
    if create:
        d.mkdir(parents=True, exist_ok=True)
        (d / ".created_at").write_text(str(time.time()))
    return d


def model_dir(model_id: str, create: bool = False) -> Path:
    d = settings.models_dir / model_id
    if create:
        d.mkdir(parents=True, exist_ok=True)
        (d / ".created_at").write_text(str(time.time()))
    return d


def _dir_age_minutes(d: Path) -> float:
    marker = d / ".created_at"
    try:
        created = float(marker.read_text())
    except (FileNotFoundError, ValueError):
        created = d.stat().st_mtime
    return (time.time() - created) / 60.0


def sweep_expired() -> int:
    """Delete upload/model directories past their TTL. Returns count removed."""
    removed = 0
    for base in (settings.uploads_dir, settings.models_dir):
        if not base.exists():
            continue
        for child in base.iterdir():
            if not child.is_dir():
                continue
            if _dir_age_minutes(child) > settings.upload_ttl_minutes:
                try:
                    shutil.rmtree(child, ignore_errors=True)
                    removed += 1
                    logger.info("cleanup: removed expired dir %s", child)
                except OSError:
                    logger.exception("cleanup: failed to remove %s", child)
    return removed


async def cleanup_loop() -> None:
    while True:
        try:
            sweep_expired()
        except Exception:
            logger.exception("cleanup sweep failed")
        await asyncio.sleep(settings.cleanup_interval_seconds)


def delete_dir(d: Path) -> None:
    shutil.rmtree(d, ignore_errors=True)
