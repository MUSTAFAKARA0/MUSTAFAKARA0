"""Real, measurement-based image quality heuristics (no ML weights required).

Every score here is computed directly from pixel statistics -- nothing is
hardcoded or simulated. Thresholds are conservative rules of thumb, not a
learned classifier, so the wording stays "olabilir" (may be) rather than
asserting certainty.
"""
from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np


@dataclass
class QualityMetrics:
    sharpness_score: float       # 0-100, from variance of Laplacian
    brightness_score: float      # 0-100, mean luma normalized
    background_complexity: float  # 0-100, edge density outside a central box
    warnings: list[str]


def _sharpness(gray: np.ndarray) -> float:
    lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    # Empirically, in-focus phone photos land well above ~150; heavily blurred
    # ones sit under ~40. Map to 0-100 on a log-ish curve for stable UI display.
    score = 100.0 * (1.0 - np.exp(-lap_var / 250.0))
    return float(np.clip(score, 0, 100))


def _brightness(gray: np.ndarray) -> float:
    mean = float(gray.mean())  # 0-255
    # Penalize both very dark and blown-out images.
    ideal = 128.0
    dist = abs(mean - ideal) / ideal
    return float(np.clip(100.0 * (1.0 - dist), 0, 100))


def _background_complexity(gray: np.ndarray) -> float:
    h, w = gray.shape
    edges = cv2.Canny(gray, 60, 160)
    cx0, cx1 = int(w * 0.3), int(w * 0.7)
    cy0, cy1 = int(h * 0.3), int(h * 0.7)
    mask = np.ones_like(edges, dtype=bool)
    mask[cy0:cy1, cx0:cx1] = False  # exclude presumed-subject center box
    border_edges = edges[mask]
    density = float(border_edges.mean()) / 255.0  # 0..1
    return float(np.clip(density * 400.0, 0, 100))  # scale for readability


def analyze_image(bgr: np.ndarray) -> QualityMetrics:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    sharpness = _sharpness(gray)
    brightness = _brightness(gray)
    complexity = _background_complexity(gray)

    warnings: list[str] = []
    if sharpness < 35:
        warnings.append("Fotoğraf bulanık görünüyor. Daha net bir fotoğraf 3D model kalitesini önemli ölçüde artırır.")
    if brightness < 30:
        warnings.append("Fotoğraf çok karanlık görünüyor. Daha iyi aydınlatma ile çekim önerilir.")
    if brightness > 92:
        gray_mean = float(gray.mean())
        if gray_mean > 235:
            warnings.append("Fotoğraf aşırı parlak / ışık patlaması olabilir.")
    if complexity > 55:
        warnings.append("Arka plan karmaşık görünüyor. Sade, tek renk bir arka plan nesne ayrıştırmayı iyileştirir.")

    return QualityMetrics(sharpness, brightness, complexity, warnings)


def subject_coverage_ratio(alpha_mask: np.ndarray) -> float:
    """Fraction of the frame occupied by the segmented subject (0..1)."""
    if alpha_mask.size == 0:
        return 0.0
    return float((alpha_mask > 127).mean())
