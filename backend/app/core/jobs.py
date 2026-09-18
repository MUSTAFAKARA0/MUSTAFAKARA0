"""In-process job tracking for the reconstruction pipeline.

A single-process in-memory store is intentional for this first version (see
README "Roadmap" section) -- it keeps the system simple to run and reason
about. Swapping this for Redis/Celery later is straightforward since routes
only talk to the small interface below.
"""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from typing import Callable, Optional

STEP_DEFS: list[tuple[str, str]] = [
    ("image_analysis", "Fotoğraf analiz ediliyor"),
    ("segmentation", "Nesne ayrıştırılıyor"),
    ("reconstruction", "3D geometri oluşturuluyor"),
    ("mesh_cleanup", "Mesh temizleniyor"),
    ("geometry_check", "Geometri kontrol ediliyor"),
    ("stl_export", "STL hazırlanıyor"),
]


@dataclass
class Step:
    key: str
    label: str
    status: str = "pending"
    detail: Optional[str] = None
    started_at: Optional[float] = None
    finished_at: Optional[float] = None


@dataclass
class Job:
    job_id: str
    upload_id: str
    state: str = "queued"  # queued | running | done | error
    steps: list[Step] = field(default_factory=lambda: [Step(k, l) for k, l in STEP_DEFS])
    model_id: Optional[str] = None
    error: Optional[str] = None

    def step(self, key: str) -> Step:
        for s in self.steps:
            if s.key == key:
                return s
        raise KeyError(key)

    def begin_step(self, key: str, detail: str | None = None) -> None:
        s = self.step(key)
        s.status = "in_progress"
        s.started_at = time.time()
        if detail:
            s.detail = detail

    def finish_step(self, key: str, detail: str | None = None) -> None:
        s = self.step(key)
        s.status = "done"
        s.finished_at = time.time()
        if detail:
            s.detail = detail

    def fail_step(self, key: str, detail: str) -> None:
        s = self.step(key)
        s.status = "error"
        s.finished_at = time.time()
        s.detail = detail
        self.state = "error"
        self.error = detail

    def skip_remaining(self) -> None:
        for s in self.steps:
            if s.status == "pending":
                s.status = "skipped"


class JobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()

    def create(self, job_id: str, upload_id: str) -> Job:
        job = Job(job_id=job_id, upload_id=upload_id)
        with self._lock:
            self._jobs[job_id] = job
        return job

    def get(self, job_id: str) -> Optional[Job]:
        with self._lock:
            return self._jobs.get(job_id)


job_store = JobStore()
