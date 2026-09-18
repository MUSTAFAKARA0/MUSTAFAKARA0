"""Single-photo reconstruction fallback: silhouette inflation.

With exactly one photo there is no way to measure depth at all -- this is a
hard limitation, not a design choice, and the UI/README say so explicitly.
What we *can* do honestly is turn the real, measured 2D silhouette into a
closed 3D solid: a distance-transform "balloon inflation" (front and back
surfaces bulge outward from the silhouette's medial thickness, meeting at the
silhouette edge), which is the same idea classic photo-to-relief / photo-to-
keychain tools use. It reproduces the true outline faithfully; the *depth* of
every point is a geometric guess, clearly reported as low confidence.
"""
from __future__ import annotations

from typing import Optional

import cv2
import numpy as np
import trimesh
from scipy import ndimage as ndi
from skimage import measure

from app.pipeline.reconstruction.provider_base import (
    ImageTo3DProvider,
    ReconstructionOutput,
    ViewInput,
)


class SilhouetteInflateProvider(ImageTo3DProvider):
    name = "silhouette_inflate"

    def is_available(self) -> bool:
        return True

    def min_views(self) -> int:
        return 1

    def max_views(self) -> Optional[int]:
        return 1

    def reconstruct(self, views: list[ViewInput], resolution: int, quality: str) -> ReconstructionOutput:
        v = views[0]
        alpha = v.alpha
        ys, xs = np.where(alpha > 127)
        if len(xs) == 0:
            raise RuntimeError("Segmentation produced an empty mask; cannot reconstruct.")
        x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
        crop = (alpha[y0:y1 + 1, x0:x1 + 1] > 127).astype(np.uint8)

        h, w = crop.shape
        long_edge = max(h, w)
        scale = resolution / long_edge
        rw, rh = max(8, int(w * scale)), max(8, int(h * scale))
        small = cv2.resize(crop, (rw, rh), interpolation=cv2.INTER_NEAREST)

        dist = ndi.distance_transform_edt(small)
        if dist.max() > 0:
            dist = dist / dist.max()
        # Depth profile: a rounded (superellipse-like) bulge based on distance
        # to the silhouette edge -- a common, explainable relief heuristic.
        depth = np.sqrt(np.clip(dist, 0, 1)) * (0.35 * max(rw, rh))

        # Build a volume: voxel is inside if |z_offset_from_center| < depth(x,y)
        depth_res = max(12, resolution // 3)
        zc = np.linspace(-depth.max(), depth.max(), depth_res)
        occupancy = np.zeros((rh, rw, depth_res), dtype=bool)
        for k, z in enumerate(zc):
            occupancy[:, :, k] = (np.abs(z) <= depth) & (small > 0)

        padded = np.pad(occupancy, 1, mode="constant", constant_values=False).astype(np.float32)
        verts, faces, _, _ = measure.marching_cubes(padded, level=0.5)

        # verts axes are (row=y, col=x, depth=z) in voxel units -> convert to
        # a right-handed (x=width, y=depth-into-object, z=height) mesh, with
        # image y flipped so the model stands upright.
        vy, vx, vz = verts[:, 0] - 1, verts[:, 1] - 1, verts[:, 2] - 1
        out_x = vx - rw / 2
        out_z = (rh - vy) - rh / 2
        out_y = vz - depth_res / 2
        mesh_verts = np.stack([out_x, out_y, out_z], axis=1)
        # normalize scale to match visual-hull provider's [-0.5,0.5]-ish convention
        norm = max(rw, rh, depth_res)
        mesh_verts = mesh_verts / norm

        mesh = trimesh.Trimesh(vertices=mesh_verts, faces=faces, process=True)

        notes = [
            "Tek fotoğraftan üretildi: yalnızca görünen siluet ölçülebildi, derinlik "
            "(ön-arka kalınlık) geometrik olarak TAHMİN edildi ve gerçek nesne derinliğini "
            "yansıtmayabilir.",
            "Model doğruluğunu artırmak için nesnenin farklı açılardan 3-6 fotoğrafını "
            "yüklemeniz önerilir.",
        ]

        return ReconstructionOutput(
            mesh=mesh,
            method=self.name,
            method_label="Tek Görünüm Siluet Şişirme (yaklaşık, düşük güven)",
            confidence="low",
            notes=notes,
        )
