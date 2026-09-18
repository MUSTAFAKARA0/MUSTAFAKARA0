"""3D-print manufacturability checks against real target dimensions.

Wall thickness is measured with trimesh's max-inscribed-sphere method
(``trimesh.proximity.thickness``) evaluated at sampled surface points on the
mesh scaled to the print's actual millimeter size -- not a guess. Because a
full per-vertex sweep can be slow on dense meshes, we sample up to
``MAX_SAMPLES`` points (uniform over faces, area-weighted) which is enough to
reliably find thin regions without adding noticeable latency.
"""
from __future__ import annotations

import numpy as np
import trimesh

MAX_SAMPLES = 4000
MIN_FEATURE_SAMPLES = 1500


def _sample_surface_points(mesh: trimesh.Trimesh, n: int) -> tuple[np.ndarray, np.ndarray]:
    n = min(n, max(64, len(mesh.faces)))
    points, face_idx = trimesh.sample.sample_surface(mesh, n)
    normals = mesh.face_normals[face_idx]
    return points, normals


def analyze_printability(mesh_mm: trimesh.Trimesh, nozzle_mm: float) -> dict:
    """``mesh_mm`` must already be scaled to real-world millimeters."""
    warnings: list[dict] = []
    min_thickness: float | None = None

    if len(mesh_mm.faces) > 0 and mesh_mm.is_watertight:
        points, normals = _sample_surface_points(mesh_mm, MAX_SAMPLES)
        try:
            thickness = trimesh.proximity.thickness(mesh_mm, points, normals=normals, method="max_sphere")
            thickness = thickness[np.isfinite(thickness) & (thickness > 0)]
            if len(thickness) > 0:
                min_thickness = float(np.min(thickness))
                thin_ratio = float((thickness < nozzle_mm).mean())
                worst_idx = np.argsort(thickness)[: min(5, len(thickness))]
                for i in worst_idx:
                    t = float(thickness[i])
                    if t < nozzle_mm:
                        severity = "critical" if t < nozzle_mm * 0.6 else "warning"
                        warnings.append(dict(
                            kind="thin_wall",
                            message=f"Bu bölgede yaklaşık {t:.2f} mm kalınlık tespit edildi. "
                                     f"{nozzle_mm:.1f} mm nozzle için çok ince olabilir.",
                            severity=severity,
                            location_hint=points[i].tolist(),
                            measured_mm=t,
                        ))
                if thin_ratio > 0.15:
                    warnings.append(dict(
                        kind="thin_wall",
                        message=f"Yüzeyin yaklaşık %{thin_ratio*100:.0f}'i seçilen nozzle çapına göre ince. "
                                 "Modeli büyütmeyi veya daha küçük nozzle kullanmayı düşünebilirsiniz.",
                        severity="warning",
                        location_hint=None,
                        measured_mm=min_thickness,
                    ))
        except Exception:
            warnings.append(dict(
                kind="thin_wall",
                message="Duvar kalınlığı analizi bu mesh için tamamlanamadı (mesh çok karmaşık olabilir).",
                severity="info",
                location_hint=None,
                measured_mm=None,
            ))
    else:
        warnings.append(dict(
            kind="thin_wall",
            message="Mesh su geçirmez olmadığı için duvar kalınlığı analizi güvenilir şekilde yapılamadı.",
            severity="info",
            location_hint=None,
            measured_mm=None,
        ))

    # Isolated / sharp small-feature heuristic: tiny connected components
    # relative to the whole model are unlikely to survive printing/handling.
    try:
        components = mesh_mm.split(only_watertight=False)
        if len(components) > 1:
            total_vol = sum(c.volume if c.is_volume else c.area for c in components)
            for c in components:
                size = c.volume if c.is_volume else c.area
                if total_vol > 0 and size / total_vol < 0.01:
                    bbox = c.extents
                    warnings.append(dict(
                        kind="isolated_feature",
                        message=f"Ana gövdeden bağımsız, yaklaşık {bbox.max():.1f} mm boyutunda küçük bir "
                                 "parça tespit edildi. Baskı sırasında kopabilir.",
                        severity="warning",
                        location_hint=c.centroid.tolist(),
                        measured_mm=float(bbox.max()),
                    ))
    except Exception:
        pass

    # Minimum feature size heuristic via bounding box of thin local regions
    extents = mesh_mm.extents
    smallest_extent = float(np.min(extents)) if len(extents) else 0.0
    if 0 < smallest_extent < nozzle_mm:
        warnings.append(dict(
            kind="small_detail",
            message=f"Modelin bir ekseni ({smallest_extent:.2f} mm) seçilen nozzle çapından küçük.",
            severity="critical",
            location_hint=None,
            measured_mm=smallest_extent,
        ))

    return dict(
        nozzle_mm=nozzle_mm,
        min_wall_thickness_mm=min_thickness,
        warnings=warnings,
    )
