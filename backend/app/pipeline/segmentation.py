"""Subject / background separation.

Uses rembg (U^2-Net, ONNX runtime, CPU) -- a real pretrained saliency
segmentation network, not a heuristic. Weights download once on first use
(cached under ~/.u2net) and inference runs in well under a second per image
on CPU at the resolutions this app uses.

If the model cannot be loaded (e.g. no network on first run), we fall back to
a classical GrabCut segmentation seeded from a border rectangle, and this is
reported to the caller via ``method`` so the UI never claims a neural result
that didn't actually happen.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

import cv2
import numpy as np

logger = logging.getLogger("photo_to_stl.segmentation")

_session = None
_session_failed = False


def _get_rembg_session():
    global _session, _session_failed
    if _session is not None or _session_failed:
        return _session
    try:
        from rembg import new_session

        _session = new_session("u2netp")
    except Exception:
        logger.exception("rembg session init failed, will fall back to GrabCut")
        _session_failed = True
        _session = None
    return _session


@dataclass
class SegmentationResult:
    rgba: np.ndarray  # H x W x 4, uint8
    alpha: np.ndarray  # H x W, uint8
    method: str


def _grabcut_fallback(bgr: np.ndarray) -> np.ndarray:
    h, w = bgr.shape[:2]
    mask = np.zeros((h, w), np.uint8)
    rect = (int(w * 0.04), int(h * 0.04), int(w * 0.92), int(h * 0.92))
    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)
    try:
        cv2.grabCut(bgr, mask, rect, bgd_model, fgd_model, 5, cv2.GC_INIT_WITH_RECT)
        alpha = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    except cv2.error:
        logger.exception("GrabCut failed, using full-frame mask")
        alpha = np.full((h, w), 255, np.uint8)
    return alpha


def segment(bgr: np.ndarray) -> SegmentationResult:
    session = _get_rembg_session()
    if session is not None:
        try:
            from rembg import remove

            rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
            out = remove(rgb, session=session)  # H x W x 4 RGBA
            alpha = out[:, :, 3]
            # Guard against a degenerate (near-empty or near-full) mask -- if
            # the network produced something unusable, fall back honestly
            # rather than silently shipping a bad cutout.
            coverage = float((alpha > 127).mean())
            if 0.01 < coverage < 0.98:
                rgba = np.dstack([cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB), alpha])
                return SegmentationResult(rgba=rgba, alpha=alpha, method="u2netp_onnx")
            logger.warning("rembg mask coverage=%.3f looked degenerate, falling back", coverage)
        except Exception:
            logger.exception("rembg inference failed, falling back to GrabCut")

    alpha = _grabcut_fallback(bgr)
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    rgba = np.dstack([rgb, alpha])
    return SegmentationResult(rgba=rgba, alpha=alpha, method="grabcut_classical")


def clean_mask(alpha: np.ndarray, min_area_ratio: float = 0.003) -> np.ndarray:
    """Keep only the largest connected component and smooth its edges."""
    h, w = alpha.shape
    binary = (alpha > 127).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
    if n <= 1:
        return alpha
    areas = stats[1:, cv2.CC_STAT_AREA]
    best = int(np.argmax(areas)) + 1
    if stats[best, cv2.CC_STAT_AREA] < min_area_ratio * h * w:
        return alpha
    cleaned = np.where(labels == best, 255, 0).astype(np.uint8)
    kernel = np.ones((5, 5), np.uint8)
    cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_CLOSE, kernel)
    cleaned = cv2.GaussianBlur(cleaned, (5, 5), 0)
    _, cleaned = cv2.threshold(cleaned, 127, 255, cv2.THRESH_BINARY)
    return cleaned
