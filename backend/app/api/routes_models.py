from __future__ import annotations

import json
import logging
from pathlib import Path

import trimesh
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.core.storage import delete_dir, model_dir
from app.models.schemas import ExportRequest, ExportResponse, ModelResponse
from app.pipeline import mesh_cleanup, mesh_diagnostics, printability, stl_export

logger = logging.getLogger("photo_to_stl.api.models")
router = APIRouter()


def _load_state(model_id: str) -> tuple[dict, Path]:
    mdir = model_dir(model_id)
    state_path = mdir / "state.json"
    if not state_path.exists():
        raise HTTPException(404, "Model bulunamadı veya süresi dolmuş olabilir.")
    return json.loads(state_path.read_text()), mdir


def _to_response(state: dict) -> ModelResponse:
    mid = state["model_id"]
    return ModelResponse(
        model_id=mid,
        name=state["model_name"],
        created_at=state["created_at"],
        reconstruction=state["reconstruction"],
        diagnostics=state["diagnostics"],
        printability=state["printability"],
        dimensions=state["dimensions"],
        preview_url=f"/api/models/{mid}/preview.glb",
        stl_url=f"/api/models/{mid}/download",
    )


@router.get("/api/models/{model_id}", response_model=ModelResponse)
async def get_model(model_id: str):
    state, _ = _load_state(model_id)
    return _to_response(state)


@router.get("/api/models/{model_id}/preview.glb")
async def get_preview(model_id: str):
    _, mdir = _load_state(model_id)
    path = mdir / "preview.glb"
    if not path.exists():
        raise HTTPException(404, "Önizleme bulunamadı.")
    return FileResponse(path, media_type="model/gltf-binary")


@router.get("/api/models/{model_id}/download")
async def download_stl(model_id: str):
    state, mdir = _load_state(model_id)
    path = mdir / "model.stl"
    if not path.exists():
        raise HTTPException(404, "STL dosyası bulunamadı.")
    filename = state.get("last_export", {}).get("filename") or stl_export.stl_filename(state["model_name"])
    return FileResponse(path, media_type="model/stl", filename=filename)


@router.post("/api/models/{model_id}/repair", response_model=ModelResponse)
async def repair_model(model_id: str):
    state, mdir = _load_state(model_id)
    normalized_path = mdir / "normalized.ply"
    if not normalized_path.exists():
        raise HTTPException(404, "Onarım için ham mesh bulunamadı.")

    mesh = trimesh.load(normalized_path, process=False)
    # Re-run the cleanup pipeline at the highest effort setting to try harder
    # than the original pass, regardless of the quality mode originally chosen.
    cleaned, report = mesh_cleanup.clean_mesh(mesh, quality="ultra", mesh_density=state["mesh_density"])
    diagnostics = mesh_diagnostics.compute_diagnostics(cleaned)
    diagnostics.update(
        duplicate_face_count_removed=report.duplicate_faces_removed,
        duplicate_vertex_count_removed=report.duplicate_vertices_removed,
        degenerate_face_count_removed=report.degenerate_faces_removed,
        floating_components_removed=report.isolated_components_removed,
        tiny_triangles_removed=report.tiny_triangles_removed,
    )

    cleaned.export(normalized_path)

    last = state.get("last_export", {})
    scaled, dims = stl_export.scale_to_dimensions(
        cleaned, unit=last.get("unit", "mm"), width=last.get("width") or 120.0,
        height=last.get("height"), depth=last.get("depth"), keep_aspect=last.get("keep_aspect", True),
    )
    scaled = stl_export.auto_center_and_drop_to_bed(scaled)
    stl_export.export_binary_stl(scaled, mdir / "model.stl")
    stl_export.export_glb_preview(scaled, mdir / "preview.glb")
    diagnostics.update(mesh_diagnostics.compute_size_metrics(scaled))
    printability_report = printability.analyze_printability(scaled, last.get("nozzle_mm", 0.4))

    state["diagnostics"] = diagnostics
    state["dimensions"] = dims
    state["printability"] = printability_report
    (mdir / "state.json").write_text(json.dumps(state, indent=2))
    return _to_response(state)


@router.post("/api/models/{model_id}/export", response_model=ExportResponse)
async def export_model(model_id: str, req: ExportRequest):
    state, mdir = _load_state(model_id)
    normalized_path = mdir / "normalized.ply"
    if not normalized_path.exists():
        raise HTTPException(404, "Dışa aktarım için ham mesh bulunamadı.")

    mesh = trimesh.load(normalized_path, process=False)
    scaled, dims = stl_export.scale_to_dimensions(
        mesh, unit=req.unit.value, width=req.width, height=req.height, depth=req.depth,
        keep_aspect=req.keep_aspect,
    )
    scaled = stl_export.auto_center_and_drop_to_bed(scaled)

    stl_export.export_binary_stl(scaled, mdir / "model.stl")
    stl_export.export_glb_preview(scaled, mdir / "preview.glb")
    printability_report = printability.analyze_printability(scaled, req.nozzle_mm)

    filename = stl_export.stl_filename(req.name or state["model_name"])
    state["model_name"] = req.name or state["model_name"]
    state["dimensions"] = dims
    state["printability"] = printability_report
    state["diagnostics"].update(mesh_diagnostics.compute_size_metrics(scaled))
    state["last_export"] = dict(
        unit=req.unit.value, width=req.width, height=req.height, depth=req.depth,
        keep_aspect=req.keep_aspect, nozzle_mm=req.nozzle_mm, name=state["model_name"], filename=filename,
    )
    (mdir / "state.json").write_text(json.dumps(state, indent=2))

    return ExportResponse(
        stl_url=f"/api/models/{model_id}/download",
        filename=filename,
        dimensions=dims,
        printability=printability_report,
        diagnostics=state["diagnostics"],
    )


@router.delete("/api/models/{model_id}")
async def delete_model(model_id: str):
    mdir = model_dir(model_id)
    delete_dir(mdir)
    return {"deleted": True}
