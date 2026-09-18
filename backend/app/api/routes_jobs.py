from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.core.jobs import job_store
from app.models.schemas import JobStatusResponse, JobStep

router = APIRouter()


@router.get("/api/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job(job_id: str):
    job = job_store.get(job_id)
    if job is None:
        raise HTTPException(404, "İş bulunamadı.")
    return JobStatusResponse(
        job_id=job.job_id,
        state=job.state,
        steps=[JobStep(**vars(s)) for s in job.steps],
        model_id=job.model_id,
        error=job.error,
    )
