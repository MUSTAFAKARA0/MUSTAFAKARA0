"""Scaling to real-world dimensions and file export (binary STL + GLB preview)."""
from __future__ import annotations

from pathlib import Path

import numpy as np
import trimesh

_UNIT_TO_MM = {"mm": 1.0, "cm": 10.0, "inch": 25.4}


def unit_to_mm(value: float, unit: str) -> float:
    return value * _UNIT_TO_MM.get(unit, 1.0)


def mm_to_unit(value_mm: float, unit: str) -> float:
    return value_mm / _UNIT_TO_MM.get(unit, 1.0)


def scale_to_dimensions(
    normalized_mesh: trimesh.Trimesh,
    unit: str,
    width: float | None,
    height: float | None,
    depth: float | None,
    keep_aspect: bool,
) -> tuple[trimesh.Trimesh, dict]:
    """``normalized_mesh`` has X=width, Y=depth, Z=height, longest extent = 1.0.
    Returns a new mesh scaled to millimeters plus the resulting dimensions
    dict (in the requested display unit)."""
    mesh = normalized_mesh.copy()
    ex, ey, ez = mesh.extents  # current (unitless) extents

    width_mm = unit_to_mm(width, unit) if width else None
    height_mm = unit_to_mm(height, unit) if height else None
    depth_mm = unit_to_mm(depth, unit) if depth else None

    if keep_aspect or sum(v is not None for v in (width_mm, height_mm, depth_mm)) == 1:
        driver_mm, driver_extent = next(
            ((v, e) for v, e in [(width_mm, ex), (height_mm, ez), (depth_mm, ey)] if v is not None),
            (120.0, max(ex, ey, ez)),
        )
        factor = driver_mm / max(driver_extent, 1e-9)
        sx = sy = sz = factor
    else:
        sx = (width_mm / ex) if width_mm and ex > 1e-9 else 1.0
        sy = (depth_mm / ey) if depth_mm and ey > 1e-9 else 1.0
        sz = (height_mm / ez) if height_mm and ez > 1e-9 else 1.0
        if width_mm is None:
            sx = sy if depth_mm else sz
        if depth_mm is None:
            sy = sx if width_mm else sz
        if height_mm is None:
            sz = sx if width_mm else sy

    mesh.apply_scale([sx, sy, sz])
    mesh.vertices -= mesh.bounds[0]  # sit at z=0 / positive octant

    fx, fy, fz = mesh.extents
    dims_mm = dict(width=fx, depth=fy, height=fz)
    dims_display = {k: mm_to_unit(v, unit) for k, v in dims_mm.items()}
    return mesh, dict(unit=unit, width=dims_display["width"], height=dims_display["height"],
                       depth=dims_display["depth"], keep_aspect=keep_aspect)


def auto_center_and_drop_to_bed(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    mesh = mesh.copy()
    centroid_xy = mesh.bounding_box.centroid
    mesh.vertices[:, 0] -= centroid_xy[0]
    mesh.vertices[:, 1] -= centroid_xy[1]
    mesh.vertices[:, 2] -= mesh.bounds[0][2]
    return mesh


def export_binary_stl(mesh_mm: trimesh.Trimesh, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    data = trimesh.exchange.stl.export_stl(mesh_mm)  # binary by default
    out_path.write_bytes(data)


def export_glb_preview(mesh_mm: trimesh.Trimesh, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    scene = trimesh.Scene(mesh_mm)
    data = scene.export(file_type="glb")
    out_path.write_bytes(data)


def stl_filename(model_name: str) -> str:
    import datetime

    from slugify import slugify

    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M")
    base = slugify(model_name) if model_name else "model"
    return f"{base}_{ts}.stl"
