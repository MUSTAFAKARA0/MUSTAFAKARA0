"""The pluggable image -> 3D reconstruction interface.

Every reconstruction technique (the local geometric ones shipped today, or a
commercial neural API added later) implements ``ImageTo3DProvider``. Callers
never depend on a concrete technique -- ``registry.pick_provider`` is the only
place that chooses one, based on how many usable views were uploaded and
which API keys (if any) are configured.

Adding a new provider, e.g. a hosted neural single/multi-view model:
    1. Subclass ImageTo3DProvider, implement `reconstruct`.
    2. Register it in registry.py's PROVIDERS list with its availability check.
No other code needs to change.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

import numpy as np
import trimesh

from app.models.schemas import ViewLabel


@dataclass
class ViewInput:
    filename: str
    view: ViewLabel
    bgr: np.ndarray        # original (downscaled) image, BGR
    alpha: np.ndarray      # cleaned subject mask, H x W uint8


@dataclass
class ReconstructionOutput:
    mesh: trimesh.Trimesh
    method: str
    method_label: str
    confidence: str  # low | medium | high
    notes: list[str]


class ImageTo3DProvider(ABC):
    name: str

    @abstractmethod
    def is_available(self) -> bool:
        """Whether this provider can run right now (deps installed / API key set)."""

    @abstractmethod
    def min_views(self) -> int:
        ...

    @abstractmethod
    def max_views(self) -> Optional[int]:
        ...

    @abstractmethod
    def reconstruct(self, views: list[ViewInput], resolution: int, quality: str) -> ReconstructionOutput:
        ...
