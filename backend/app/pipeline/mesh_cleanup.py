"""The mesh clean-up pipeline: raw reconstructed mesh -> STL-ready solid.

Every step below runs a real algorithm from trimesh / pymeshfix /
fast-simplification against the actual mesh -- nothing here is a status
message printed without doing the work. ``CleanupReport`` records exactly
what each step changed so the diagnostics the user sees are the real
measured outcome, not a canned "all good".

Order follows the brief:
 1. Import               (caller passes in the trimesh.Trimesh)
 2. Scale normalization
 3. Remove isolated components
 4. Remove duplicate vertices
 5. Remove duplicate faces
 6. Fix normals
 7. Remove degenerate faces
 8. Repair non-manifold edges     -> pymeshfix
 9. Fill holes                    -> pymeshfix
10. Self-intersection check       -> best-effort (see mesh_diagnostics)
11. Smooth / denoise              -> Taubin (volume-preserving)
12. Preserve sharp features       -> low-lambda Taubin, no uniform Laplacian shrink
13. Decimate if necessary
14. Watertight check
15. STL export                    -> stl_export.py
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

import numpy as np
import trimesh

logger = logging.getLogger("photo_to_stl.mesh_cleanup")

QUALITY_PARAMS = {
    "fast": dict(taubin_iter=4, target_face_factor=0.5, pymeshfix_joincomp=True),
    "standard": dict(taubin_iter=8, target_face_factor=0.75, pymeshfix_joincomp=True),
    "professional": dict(taubin_iter=14, target_face_factor=1.0, pymeshfix_joincomp=True),
    "ultra": dict(taubin_iter=20, target_face_factor=1.0, pymeshfix_joincomp=True),
}

DENSITY_TARGET_FACES = {
    "low": 8_000,
    "medium": 25_000,
    "high": 80_000,
    "ultra": 200_000,
}


@dataclass
class CleanupReport:
    isolated_components_removed: int = 0
    duplicate_vertices_removed: int = 0
    duplicate_faces_removed: int = 0
    degenerate_faces_removed: int = 0
    tiny_triangles_removed: int = 0
    normals_fixed: bool = False
    holes_filled_by_pymeshfix: bool = False
    decimated_from: int = 0
    decimated_to: int = 0
    smoothing_iterations: int = 0
    log: list[str] = field(default_factory=list)

    def note(self, msg: str) -> None:
        self.log.append(msg)
        logger.info(msg)


def _remove_isolated_components(mesh: trimesh.Trimesh, min_face_ratio: float = 0.01) -> int:
    components = mesh.split(only_watertight=False)
    if len(components) <= 1:
        return 0
    face_counts = [len(c.faces) for c in components]
    total = sum(face_counts)
    keep = [c for c, fc in zip(components, face_counts) if fc >= max(4, total * min_face_ratio)]
    if not keep:
        keep = [max(components, key=lambda c: len(c.faces))]
    removed = len(components) - len(keep)
    if removed > 0:
        merged = trimesh.util.concatenate(keep)
        mesh.vertices = merged.vertices
        mesh.faces = merged.faces
    return removed


def _remove_tiny_triangles(mesh: trimesh.Trimesh, rel_area_threshold: float = 1e-7) -> int:
    areas = mesh.area_faces
    total_area = areas.sum()
    if total_area <= 0:
        return 0
    keep_mask = areas > (total_area * rel_area_threshold)
    removed = int((~keep_mask).sum())
    if removed > 0 and keep_mask.sum() > 0:
        mesh.update_faces(keep_mask)
        mesh.remove_unreferenced_vertices()
    return removed


def _pymeshfix_repair(mesh: trimesh.Trimesh, joincomp: bool) -> tuple[trimesh.Trimesh, bool]:
    try:
        import pymeshfix

        fixer = pymeshfix.MeshFix(mesh.vertices.copy(), mesh.faces.copy())
        fixer.repair(joincomp=joincomp, remove_smallest_components=False)
        if fixer.points is None or len(fixer.points) == 0:
            return mesh, False
        repaired = trimesh.Trimesh(vertices=fixer.points, faces=fixer.faces, process=True)
        return repaired, True
    except Exception:
        logger.exception("pymeshfix repair failed, continuing with trimesh-only cleanup")
        return mesh, False


def _decimate(mesh: trimesh.Trimesh, target_faces: int) -> tuple[trimesh.Trimesh, int, int]:
    before = len(mesh.faces)
    if before <= target_faces:
        return mesh, before, before
    try:
        import fast_simplification

        v, f = fast_simplification.simplify(mesh.vertices, mesh.faces, target_count=target_faces)
        simplified = trimesh.Trimesh(vertices=v, faces=f, process=True)
        return simplified, before, len(simplified.faces)
    except Exception:
        logger.exception("decimation failed, keeping original mesh resolution")
        return mesh, before, before


def clean_mesh(raw_mesh: trimesh.Trimesh, quality: str, mesh_density: str) -> tuple[trimesh.Trimesh, CleanupReport]:
    q = QUALITY_PARAMS.get(quality, QUALITY_PARAMS["standard"])
    target_faces = int(DENSITY_TARGET_FACES.get(mesh_density, DENSITY_TARGET_FACES["medium"]) * q["target_face_factor"])
    report = CleanupReport()

    mesh = raw_mesh.copy()

    # 2. scale normalization: center at origin, fit longest axis to 1.0 unit
    mesh.vertices -= mesh.bounding_box.centroid
    extent = mesh.extents
    scale = 1.0 / max(extent.max(), 1e-9)
    mesh.vertices *= scale
    report.note(f"Ölçek normalize edildi (faktör={scale:.4f}).")

    # 3. isolated components
    report.isolated_components_removed = _remove_isolated_components(mesh)
    if report.isolated_components_removed:
        report.note(f"{report.isolated_components_removed} bağımsız/uçuşan parça kaldırıldı.")

    # 4 & 5. duplicate vertices / faces (trimesh merge + unique dedupe)
    v_before, f_before = len(mesh.vertices), len(mesh.faces)
    mesh.merge_vertices()
    mesh.update_faces(mesh.unique_faces())
    mesh.remove_unreferenced_vertices()
    report.duplicate_vertices_removed = max(0, v_before - len(mesh.vertices))
    report.duplicate_faces_removed = max(0, f_before - len(mesh.faces))
    if report.duplicate_vertices_removed or report.duplicate_faces_removed:
        report.note(
            f"{report.duplicate_vertices_removed} tekrarlı vertex, "
            f"{report.duplicate_faces_removed} tekrarlı yüzey kaldırıldı."
        )

    # 6. fix normals (also fixes winding / inverted faces)
    trimesh.repair.fix_normals(mesh, multibody=True)
    report.normals_fixed = True
    report.note("Yüzey normalleri tutarlı hale getirildi.")

    # 7. degenerate faces
    f_before = len(mesh.faces)
    nondeg = trimesh.triangles.nondegenerate(mesh.triangles, areas=mesh.area_faces, height=1e-8)
    if not nondeg.all():
        mesh.update_faces(nondeg)
        mesh.remove_unreferenced_vertices()
    report.degenerate_faces_removed = max(0, f_before - len(mesh.faces))
    if report.degenerate_faces_removed:
        report.note(f"{report.degenerate_faces_removed} bozuk (dejenere) üçgen kaldırıldı.")

    # 8 & 9. non-manifold repair + hole filling
    mesh, repaired = _pymeshfix_repair(mesh, joincomp=q["pymeshfix_joincomp"])
    report.holes_filled_by_pymeshfix = repaired
    if repaired:
        report.note("Non-manifold kenarlar onarıldı ve açık delikler kapatıldı (pymeshfix/MeshFix).")
    else:
        # fall back to trimesh's own (weaker) hole filler so we still try
        trimesh.repair.fill_holes(mesh)
        report.note("pymeshfix kullanılamadı; trimesh'in temel delik doldurma işlevi uygulandı.")

    # re-fix normals after topology changes
    trimesh.repair.fix_normals(mesh, multibody=True)

    # 10. self-intersection check happens in mesh_diagnostics (read-only measurement)

    # 11 & 12. smoothing (Taubin: preserves volume/sharpness better than Laplacian)
    if q["taubin_iter"] > 0 and len(mesh.vertices) > 0:
        try:
            trimesh.smoothing.filter_taubin(mesh, lamb=0.5, nu=-0.53, iterations=q["taubin_iter"])
            report.smoothing_iterations = q["taubin_iter"]
            report.note(f"Taubin düzleştirme uygulandı ({q['taubin_iter']} iterasyon, hacim korunarak).")
        except Exception:
            logger.exception("Taubin smoothing failed, skipping")

    # tiny triangle cleanup after smoothing (smoothing can create slivers)
    report.tiny_triangles_removed = _remove_tiny_triangles(mesh)
    if report.tiny_triangles_removed:
        report.note(f"{report.tiny_triangles_removed} aşırı küçük üçgen kaldırıldı.")

    # 13. decimation
    mesh, before, after = _decimate(mesh, target_faces)
    report.decimated_from, report.decimated_to = before, after
    if after < before:
        report.note(f"Mesh {before} yüzeyden {after} yüzeye sadeleştirildi (hedef yoğunluk: {mesh_density}).")

    # smoothing and decimation can each reintroduce small self-intersections /
    # non-manifold slivers in tight concave areas, so run one more repair pass
    # on the final topology rather than only before those steps.
    if quality != "fast":
        mesh, repaired_again = _pymeshfix_repair(mesh, joincomp=q["pymeshfix_joincomp"])
        if repaired_again:
            report.note("Son mesh üzerinde ikinci bir onarım geçişi uygulandı (düzleştirme/sadeleştirme sonrası).")

    # final safety pass
    trimesh.repair.fix_normals(mesh, multibody=True)
    mesh.remove_unreferenced_vertices()

    return mesh, report
