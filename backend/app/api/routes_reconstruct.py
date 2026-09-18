from __future__ import annotations

import asyncio
import functools

from fastapi import APIRouter, HTTPException

from app.core.jobs import job_store
from app.core.storage import new_id, upload_dir
from app.models.schemas import ReconstructRequest, ReconstructResponse
from app.pipeline.orchestrator import run_job

router = APIRouter()


@router.post("/api/reconstruct", response_model=ReconstructResponse)
async def start_reconstruction(req: ReconstructRequest):
    udir = upload_dir(req.upload_id)
    if not (udir / "manifest.json").exists():
        raise HTTPException(404, "Yükleme bulunamadı veya süresi dolmuş olabilir.")

    job_id = new_id()
    job = job_store.create(job_id, req.upload_id)

    loop = asyncio.get_running_loop()
    loop.run_in_executor(
        None,
        functools.partial(run_job, job, udir, req.quality.value, req.mesh_density.value, req.model_name),
    )

    return ReconstructResponse(job_id=job_id)
