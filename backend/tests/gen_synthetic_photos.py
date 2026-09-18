"""Generates synthetic but realistic-looking test photos of a simple upright
"bottle" shape (rounded body, narrow neck) photographed against a plain but
textured studio background, viewed from 6 angles. These are not renders of a
3D model -- they are independently drawn 2D silhouettes per view, so running
them through the real segmentation + visual-hull pipeline is a genuine test
of the geometry pipeline, not a round-trip of a hidden 3D asset.
"""
from __future__ import annotations

import pathlib

import cv2
import numpy as np


def _textured_background(h: int, w: int, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    bg = np.full((h, w, 3), 235, dtype=np.uint8)
    noise = rng.normal(0, 6, (h, w, 3))
    bg = np.clip(bg.astype(np.float32) + noise, 0, 255).astype(np.uint8)
    # subtle vignette / gradient so it's not a flat color
    yy, xx = np.mgrid[0:h, 0:w]
    grad = ((xx / w) * 10).astype(np.uint8)
    bg = cv2.subtract(bg, np.dstack([grad] * 3))
    return bg


def _bottle_mask_front(h: int, w: int) -> np.ndarray:
    mask = np.zeros((h, w), np.uint8)
    cx = w // 2
    body_top = int(h * 0.32)
    body_bot = int(h * 0.92)
    body_w = int(w * 0.30)
    cv2.rectangle(mask, (cx - body_w, body_top), (cx + body_w, body_bot), 255, -1)
    cv2.ellipse(mask, (cx, body_top), (body_w, int(h * 0.05)), 0, 180, 360, 255, -1)
    cv2.ellipse(mask, (cx, body_bot), (body_w, int(h * 0.04)), 0, 0, 180, 255, -1)
    neck_w = int(w * 0.10)
    neck_top = int(h * 0.08)
    cv2.rectangle(mask, (cx - neck_w, neck_top), (cx + neck_w, body_top + 5), 255, -1)
    cv2.rectangle(mask, (cx - int(neck_w * 1.4), neck_top - 5), (cx + int(neck_w * 1.4), neck_top + 12), 255, -1)
    return mask


def _bottle_mask_side(h: int, w: int) -> np.ndarray:
    # narrower depth profile than the front view -> a real asymmetric object
    mask = np.zeros((h, w), np.uint8)
    cx = w // 2
    body_top = int(h * 0.32)
    body_bot = int(h * 0.92)
    body_w = int(w * 0.20)
    cv2.rectangle(mask, (cx - body_w, body_top), (cx + body_w, body_bot), 255, -1)
    cv2.ellipse(mask, (cx, body_top), (body_w, int(h * 0.05)), 0, 180, 360, 255, -1)
    cv2.ellipse(mask, (cx, body_bot), (body_w, int(h * 0.04)), 0, 0, 180, 255, -1)
    neck_w = int(w * 0.08)
    neck_top = int(h * 0.08)
    cv2.rectangle(mask, (cx - neck_w, neck_top), (cx + neck_w, body_top + 5), 255, -1)
    cv2.rectangle(mask, (cx - int(neck_w * 1.3), neck_top - 5), (cx + int(neck_w * 1.3), neck_top + 12), 255, -1)
    return mask


def _bottle_mask_top(h: int, w: int) -> np.ndarray:
    mask = np.zeros((h, w), np.uint8)
    cx, cy = w // 2, h // 2
    cv2.ellipse(mask, (cx, cy), (int(w * 0.30), int(h * 0.20)), 0, 0, 360, 255, -1)
    return mask


def _bottle_mask_bottom(h: int, w: int) -> np.ndarray:
    return _bottle_mask_top(h, w)


def make_view(view: str, h: int = 640, w: int = 480, seed: int = 0) -> np.ndarray:
    bg = _textured_background(h, w, seed)
    if view in ("front", "back"):
        mask = _bottle_mask_front(h, w)
    elif view in ("left", "right"):
        mask = _bottle_mask_side(h, w)
    elif view == "top":
        mask = _bottle_mask_top(h, w)
    elif view == "bottom":
        mask = _bottle_mask_bottom(h, w)
    else:
        mask = _bottle_mask_front(h, w)

    rng = np.random.default_rng(seed + 100)
    body_color = np.array([70, 140, 190], dtype=np.float32)  # amber-ish bottle (BGR)
    shade = rng.normal(0, 8, (h, w, 1))
    obj = np.clip(body_color + shade, 0, 255).astype(np.uint8)
    obj_img = np.tile(obj, (1, 1, 1)) if obj.shape[-1] == 3 else obj
    obj_full = np.zeros((h, w, 3), np.uint8)
    obj_full[:, :] = body_color
    obj_full = np.clip(obj_full.astype(np.float32) + rng.normal(0, 8, (h, w, 3)), 0, 255).astype(np.uint8)

    img = bg.copy()
    m3 = cv2.merge([mask, mask, mask])
    img = np.where(m3 > 0, obj_full, img)
    return img


def write_test_set(out_dir: pathlib.Path, views: list[str]) -> list[pathlib.Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for i, v in enumerate(views):
        img = make_view(v, seed=i)
        p = out_dir / f"{v}.jpg"
        cv2.imwrite(str(p), img, [cv2.IMWRITE_JPEG_QUALITY, 95])
        paths.append(p)
    return paths


if __name__ == "__main__":
    out = pathlib.Path(__file__).parent / "fixtures"
    paths = write_test_set(out, ["front", "back", "left", "right", "top", "bottom"])
    print("wrote", [str(p) for p in paths])
