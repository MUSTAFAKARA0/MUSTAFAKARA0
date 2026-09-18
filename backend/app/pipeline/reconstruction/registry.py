"""Chooses which ImageTo3DProvider handles a given upload.

Today only the two local geometric providers are registered because no
commercial Image-to-3D API key is configured in this environment (see
README's "Image-to-3D provider research" section for the comparison that
went into this decision). Wiring in a hosted provider later means adding a
class to this list -- ``routes_reconstruct`` and the orchestrator never
change.
"""
from __future__ import annotations

from app.config import settings
from app.pipeline.reconstruction.provider_base import ImageTo3DProvider
from app.pipeline.reconstruction.silhouette_inflate import SilhouetteInflateProvider
from app.pipeline.reconstruction.visual_hull import VisualHullProvider

_visual_hull = VisualHullProvider()
_silhouette = SilhouetteInflateProvider()


def commercial_providers_configured() -> list[str]:
    configured = []
    if settings.tripo_api_key:
        configured.append("tripo")
    if settings.meshy_api_key:
        configured.append("meshy")
    if settings.rodin_api_key:
        configured.append("rodin")
    if settings.stability_api_key:
        configured.append("stability")
    return configured


def pick_provider(n_views: int) -> ImageTo3DProvider:
    # NOTE: commercial providers are not yet implemented (no API key present
    # in this deployment); this is the single place to add them once one is
    # configured -- see provider_base.ImageTo3DProvider.
    if n_views >= _visual_hull.min_views():
        return _visual_hull
    return _silhouette
