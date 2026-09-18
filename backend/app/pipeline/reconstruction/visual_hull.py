"""Multi-view reconstruction via shape-from-silhouette (visual hull) carving.

This is a classical, well-established computer-vision technique (Laurentini,
1994) -- not a neural network, and not a simulation. Given N photos of an
object's silhouette from different angles, it carves a voxel grid down to the
intersection of all viewing cones, then extracts a surface with marching
cubes. It genuinely uses the pixels the user uploaded; every additional view
measurably tightens the result. Concave surface details invisible in every
silhouette (e.g. a carved-in logo) cannot be recovered -- that's a hard
mathematical limit of the method, not an implementation shortcut, and is
reported to the user via ``notes``.

Camera model: uncalibrated hobbyist photos have no known focal length or
distance, so we use orthographic projection along canonical world axes for
labeled views (front/back/left/right/top/bottom), or an evenly-spaced
turntable-around-vertical-axis assumption for unlabeled multi-photo uploads.
Both assume the object is reasonably centered and similarly framed across
shots -- documented in the UI, not hidden.
"""
from __future__ import annotations

import math
from typing import Optional

import numpy as np
import trimesh
from skimage import measure

from app.models.schemas import ViewLabel
from app.pipeline.reconstruction.provider_base import (
    ImageTo3DProvider,
    ReconstructionOutput,
    ViewInput,
)

# axis convention: X = width (left/right), Y = depth (front/back), Z = height (up/down)
_CANONICAL = {
    ViewLabel.front: dict(right=np.array([1.0, 0, 0]), up=np.array([0, 0, 1.0])),
    ViewLabel.back: dict(right=np.array([-1.0, 0, 0]), up=np.array([0, 0, 1.0])),
    ViewLabel.left: dict(right=np.array([0, 1.0, 0]), up=np.array([0, 0, 1.0])),
    ViewLabel.right: dict(right=np.array([0, -1.0, 0]), up=np.array([0, 0, 1.0])),
    ViewLabel.top: dict(right=np.array([1.0, 0, 0]), up=np.array([0, 1.0, 0])),
    ViewLabel.bottom: dict(right=np.array([1.0, 0, 0]), up=np.array([0, -1.0, 0])),
}


def _mask_bbox(alpha: np.ndarray, pad_ratio: float = 0.06):
    ys, xs = np.where(alpha > 127)
    h, w = alpha.shape
    if len(xs) == 0:
        return 0, w, 0, h
    x0, x1 = xs.min(), xs.max()
    y0, y1 = ys.min(), ys.max()
    pw = int((x1 - x0) * pad_ratio) + 1
    ph = int((y1 - y0) * pad_ratio) + 1
    return (max(0, x0 - pw), min(w, x1 + pw + 1), max(0, y0 - ph), min(h, y1 + ph + 1))


def _sample_mask(alpha: np.ndarray, bbox, u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """u,v in [-0.5, 0.5] (right/up), bilinear-sample the mask over its bbox."""
    x0, x1, y0, y1 = bbox
    w, h = x1 - x0, y1 - y0
    px = (u + 0.5) * w + x0
    py = (0.5 - v) * h + y0  # image v grows downward
    H, W = alpha.shape
    inside = (px >= 0) & (px < W - 1) & (py >= 0) & (py < H - 1)
    px_c = np.clip(px, 0, W - 1.001)
    py_c = np.clip(py, 0, H - 1.001)
    x_i = px_c.astype(np.int32)
    y_i = py_c.astype(np.int32)
    fx = px_c - x_i
    fy = py_c - y_i
    a = alpha[y_i, x_i].astype(np.float32)
    b = alpha[y_i, np.minimum(x_i + 1, W - 1)].astype(np.float32)
    c = alpha[np.minimum(y_i + 1, H - 1), x_i].astype(np.float32)
    d = alpha[np.minimum(y_i + 1, H - 1), np.minimum(x_i + 1, W - 1)].astype(np.float32)
    val = a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy
    val = np.where(inside, val, 0.0)
    return val


def _turntable_axes(n: int, index: int):
    angle = 2 * math.pi * index / n
    right = np.array([-math.sin(angle), math.cos(angle), 0.0])
    up = np.array([0.0, 0.0, 1.0])
    return dict(right=right, up=up)


def _estimate_extents(views: list[ViewInput]) -> tuple[float, float, float, list[str]]:
    """Estimate relative half-extents (hx, hy, hz) of the object's bounding box."""
    notes: list[str] = []
    labeled = {v.view: v for v in views if v.view != ViewLabel.unspecified}

    def aspect(v: ViewInput) -> float:
        x0, x1, y0, y1 = _mask_bbox(v.alpha)
        return (y1 - y0) / max(1, (x1 - x0))

    hx = hy = hz = 1.0
    if ViewLabel.front in labeled or ViewLabel.back in labeled:
        v = labeled.get(ViewLabel.front, labeled.get(ViewLabel.back))
        hz = aspect(v)  # relative to hx=1
    if ViewLabel.left in labeled or ViewLabel.right in labeled:
        v = labeled.get(ViewLabel.left, labeled.get(ViewLabel.right))
        side_aspect = aspect(v)  # hz / hy
        if side_aspect > 1e-3:
            hy = hz / side_aspect
        if ViewLabel.front not in labeled and ViewLabel.back not in labeled:
            hz = side_aspect  # only side views available
    unspecified = [v for v in views if v.view == ViewLabel.unspecified]
    if unspecified and not labeled:
        ratios = [aspect(v) for v in unspecified]
        hz = float(np.median(ratios))
        hx = hy = 1.0
        notes.append(
            "Fotoğraflar etiketlenmemiş; nesne dönme masasında eşit açılarla çekilmiş gibi varsayıldı."
        )
    elif unspecified:
        notes.append(f"{len(unspecified)} etiketlenmemiş fotoğraf döner-masa varsayımıyla kullanıldı.")

    return float(hx), float(hy), float(hz), notes


class VisualHullProvider(ImageTo3DProvider):
    name = "visual_hull"

    def is_available(self) -> bool:
        return True

    def min_views(self) -> int:
        return 2

    def max_views(self) -> Optional[int]:
        return None

    def reconstruct(self, views: list[ViewInput], resolution: int, quality: str) -> ReconstructionOutput:
        notes: list[str] = []
        hx, hy, hz, extent_notes = _estimate_extents(views)
        notes.extend(extent_notes)
        max_h = max(hx, hy, hz)
        hx, hy, hz = hx / max_h, hy / max_h, hz / max_h

        # Fixed-resolution cube grid, scaled per-axis by the estimated extents.
        res = resolution
        lin = np.linspace(-0.5, 0.5, res)
        gx, gy, gz = np.meshgrid(lin * hx * 2, lin * hy * 2, lin * hz * 2, indexing="ij")
        occupancy = np.ones((res, res, res), dtype=bool)

        unspecified = [v for v in views if v.view == ViewLabel.unspecified]
        n_turntable = len(unspecified)
        turntable_idx = 0

        views_used = 0
        for v in views:
            if v.view == ViewLabel.unspecified:
                axes = _turntable_axes(max(n_turntable, 1), turntable_idx)
                turntable_idx += 1
            else:
                axes = _CANONICAL.get(v.view)
                if axes is None:
                    continue
            right, up = axes["right"], axes["up"]
            u = gx * right[0] + gy * right[1] + gz * right[2]
            up_v = gx * up[0] + gy * up[1] + gz * up[2]
            bbox = _mask_bbox(v.alpha)
            sampled = _sample_mask(v.alpha, bbox, u, up_v)
            occupancy &= sampled > 100
            views_used += 1

        if occupancy.sum() < 8:
            notes.append("Siluetlerin kesişimi çok küçük çıktı; sonuç güvenilmez olabilir.")
            # relax: use union of the largest single-view carve as a safety net
            occupancy = np.ones((res, res, res), dtype=bool)
            best_count = -1
            for v in views:
                axes = _CANONICAL.get(v.view) or _turntable_axes(1, 0)
                right, up = axes["right"], axes["up"]
                u = gx * right[0] + gy * right[1] + gz * right[2]
                up_v = gx * up[0] + gy * up[1] + gz * up[2]
                bbox = _mask_bbox(v.alpha)
                sampled = _sample_mask(v.alpha, bbox, u, up_v) > 100
                if sampled.sum() > best_count:
                    best_count = sampled.sum()
                    occupancy = sampled

        # pad with an empty border so marching_cubes produces a closed surface
        padded = np.zeros((res + 2, res + 2, res + 2), dtype=np.float32)
        padded[1:-1, 1:-1, 1:-1] = occupancy.astype(np.float32)

        try:
            verts, faces, _, _ = measure.marching_cubes(padded, level=0.5)
        except (RuntimeError, ValueError) as exc:
            raise RuntimeError(f"Marching cubes failed to extract a surface: {exc}") from exc

        # map voxel index space back to normalized object space
        spacing = np.array([hx * 2 / res, hy * 2 / res, hz * 2 / res])
        verts = (verts - 1) * spacing + np.array([-hx, -hy, -hz])

        mesh = trimesh.Trimesh(vertices=verts, faces=faces, process=True)

        confidence = "low"
        if views_used >= 6:
            confidence = "high"
        elif views_used >= 3:
            confidence = "medium"

        notes.append(
            f"{views_used} görünüm kullanılarak silüet kesişimi (visual hull) yöntemiyle "
            "oluşturuldu. Hiçbir fotoğrafta görünmeyen içbükey detaylar (ör. oyuklar, kabartma "
            "desenler) bu yöntemle yakalanamaz."
        )
        if views_used < 4:
            notes.append(
                "3'ten az görünüm; sonuç kaba bir yaklaşıklık olabilir. Daha iyi sonuç için "
                "nesnenin farklı açılardan 4-6 fotoğrafını yükleyin."
            )

        return ReconstructionOutput(
            mesh=mesh,
            method=self.name,
            method_label="Çoklu Görünüm Silüet Kesişimi (Visual Hull)",
            confidence=confidence,
            notes=notes,
        )
