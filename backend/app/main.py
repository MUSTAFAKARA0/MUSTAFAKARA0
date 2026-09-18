from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import routes_jobs, routes_models, routes_reconstruct, routes_upload
from app.config import settings
from app.core.storage import cleanup_loop

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(cleanup_loop())
    try:
        yield
    finally:
        task.cancel()


app = FastAPI(
    title="Photo to STL",
    description="Fotoğraftan 3D baskıya hazır STL üretimi",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes_upload.router)
app.include_router(routes_reconstruct.router)
app.include_router(routes_jobs.router)
app.include_router(routes_models.router)


@app.get("/api/health")
async def health():
    from app.pipeline.reconstruction.registry import commercial_providers_configured

    return {
        "status": "ok",
        "local_providers": ["visual_hull", "silhouette_inflate"],
        "commercial_providers_configured": commercial_providers_configured(),
    }
