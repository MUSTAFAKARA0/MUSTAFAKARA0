"""Runs the full upload -> reconstruct -> clean -> validate -> export pipeline
for one job, updating step-by-step progress on the Job object as it goes so
the frontend can show real (not simulated) status.
"""
from __future__ import annotations

import json
import logging
import time

import cv2
import numpy as np
import trimesh

from app.core.jobs import Job
from app.core.storage import model_dir, new_id
from app.models.schemas import ViewLabel
from app.pipeline import mesh_cleanup, mesh_diagnostics, printability, stl_export
from app.pipeline.reconstruction.provider_base import ViewInput
from app.pipeline.reconstruction.registry import pick_provider
from app.pipeline.segmentation import clean_mask, segment

logger = logging.getLogger("photo_to_stl.orchestrator")

RESOLUTION_BY_DENSITY = {"low": 56, "medium": 84, "high": 112, "ultra": 144}
DEFAULT_WIDTH_MM = 120.0
DEFAULT_NOZZLE_MM = 0.4


def _load_upload_manifest(upload_dir) -> list[dict]:
    manifest_path = upload_dir / "manifest.json"
    return json.loads(manifest_path.read_text())


def run_job(job: Job, upload_dir, quality: str, mesh_density: str, model_name: str | None) -> None:
    job.state = "running"
    job.model_id = new_id()
    try:
        manifest = _load_upload_manifest(upload_dir)

        # --- step 1: image analysis (already computed at upload time; just
        # surface the summary here so the UI sees an explicit step) ---
        job.begin_step("image_analysis")
        usable = [m for m in manifest if m["usable"]]
        if not usable:
            job.fail_step("image_analysis", "Yüklenen fotoğrafların hiçbiri işlenebilir kalitede değil.")
            return
        job.finish_step("image_analysis", f"{len(usable)}/{len(manifest)} fotoğraf kullanılabilir.")

        # --- step 2: segmentation ---
        job.begin_step("segmentation")
        views: list[ViewInput] = []
        for m in usable:
            bgr = cv2.imread(str(upload_dir / m["filename"]))
            if bgr is None:
                continue
            seg = segment(bgr)
            alpha = clean_mask(seg.alpha)
            views.append(ViewInput(filename=m["filename"], view=ViewLabel(m["view"]), bgr=bgr, alpha=alpha))
        if not views:
            job.fail_step("segmentation", "Hiçbir fotoğrafta nesne tespit edilemedi.")
            return
        job.finish_step("segmentation", f"{len(views)} fotoğrafta nesne arka plandan ayrıştırıldı.")

        # --- step 3: reconstruction ---
        job.begin_step("reconstruction")
        provider = pick_provider(len(views))
        resolution = RESOLUTION_BY_DENSITY.get(mesh_density, RESOLUTION_BY_DENSITY["medium"])
        t0 = time.time()
        recon = provider.reconstruct(views, resolution=resolution, quality=quality)
        if len(recon.mesh.faces) == 0:
            job.fail_step("reconstruction", "3D geometri oluşturulamadı (boş mesh).")
            return
        job.finish_step(
            "reconstruction",
            f"{recon.method_label} ile {len(recon.mesh.faces)} yüzeyli ham mesh oluşturuldu "
            f"({time.time()-t0:.1f}s).",
        )

        # --- step 4: mesh cleanup ---
        job.begin_step("mesh_cleanup")
        clean, cleanup_report = mesh_cleanup.clean_mesh(recon.mesh, quality=quality, mesh_density=mesh_density)
        job.finish_step(
            "mesh_cleanup",
            f"{cleanup_report.decimated_to} yüzeye sadeleştirildi, "
            f"{cleanup_report.isolated_components_removed} uçuşan parça ve "
            f"{cleanup_report.tiny_triangles_removed} mikro üçgen kaldırıldı.",
        )

        # --- step 5: geometry validation ---
        job.begin_step("geometry_check")
        diagnostics = mesh_diagnostics.compute_diagnostics(clean)
        diagnostics.update(
            duplicate_face_count_removed=cleanup_report.duplicate_faces_removed,
            duplicate_vertex_count_removed=cleanup_report.duplicate_vertices_removed,
            degenerate_face_count_removed=cleanup_report.degenerate_faces_removed,
            floating_components_removed=cleanup_report.isolated_components_removed,
            tiny_triangles_removed=cleanup_report.tiny_triangles_removed,
        )
        status_bits = []
        status_bits.append("Watertight" if diagnostics["watertight"] else "Watertight DEĞİL")
        status_bits.append("Manifold" if diagnostics["manifold"] else "Manifold DEĞİL")
        job.finish_step("geometry_check", ", ".join(status_bits))

        # --- step 6: STL export (default dimensions + preview) ---
        job.begin_step("stl_export")
        mdir = model_dir(job.model_id, create=True)  # type: ignore[arg-type]

        scaled, dims = stl_export.scale_to_dimensions(
            clean, unit="mm", width=DEFAULT_WIDTH_MM, height=None, depth=None, keep_aspect=True
        )
        scaled = stl_export.auto_center_and_drop_to_bed(scaled)

        stl_path = mdir / "model.stl"
        glb_path = mdir / "preview.glb"
        stl_export.export_binary_stl(scaled, stl_path)
        stl_export.export_glb_preview(scaled, glb_path)

        diagnostics.update(mesh_diagnostics.compute_size_metrics(scaled))
        printability_report = printability.analyze_printability(scaled, DEFAULT_NOZZLE_MM)

        state = dict(
            model_id=job.model_id,
            model_name=model_name or "model",
            created_at=time.time(),
            reconstruction=dict(
                method=recon.method,
                method_label=recon.method_label,
                confidence=recon.confidence,
                views_used=len(views),
                notes=recon.notes,
            ),
            diagnostics=diagnostics,
            printability=printability_report,
            dimensions=dims,
            quality=quality,
            mesh_density=mesh_density,
            last_export=dict(unit="mm", width=DEFAULT_WIDTH_MM, height=None, depth=None,
                              keep_aspect=True, nozzle_mm=DEFAULT_NOZZLE_MM, name=model_name or "model"),
        )
        (mdir / "state.json").write_text(json.dumps(state, indent=2))
        # keep the un-scaled, normalized mesh around so /export can re-scale
        # without re-running the whole pipeline
        clean.export(mdir / "normalized.ply")

        job.finish_step("stl_export", "Binary STL ve WebGL önizlemesi hazırlandı.")
        job.state = "done"

    except Exception as exc:  # pragma: no cover - defensive top-level guard
        logger.exception("job %s failed", job.job_id)
        current = next((s for s in job.steps if s.status == "in_progress"), None)
        if current:
            job.fail_step(current.key, f"Beklenmeyen hata: {exc}")
        else:
            job.state = "error"
            job.error = str(exc)
        job.skip_remaining()
