"""Pydantic request/response models shared across the API."""
from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class ViewLabel(str, Enum):
    front = "front"
    back = "back"
    left = "left"
    right = "right"
    top = "top"
    bottom = "bottom"
    unspecified = "unspecified"


class QualityMode(str, Enum):
    fast = "fast"           # Hızlı
    standard = "standard"   # Standart
    professional = "professional"  # Profesyonel
    ultra = "ultra"         # Ultra


class MeshDensity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    ultra = "ultra"


class Unit(str, Enum):
    mm = "mm"
    cm = "cm"
    inch = "inch"


class NozzleSize(str, Enum):
    n04 = "0.4"
    n06 = "0.6"
    n08 = "0.8"
    n10 = "1.0"


# ---- /api/upload ----

class ImageQualityReport(BaseModel):
    filename: str
    view: ViewLabel
    width: int
    height: int
    sharpness_score: float
    brightness_score: float
    background_complexity: float
    subject_coverage_ratio: float
    warnings: list[str] = Field(default_factory=list)
    usable: bool


class UploadResponse(BaseModel):
    upload_id: str
    images: list[ImageQualityReport]
    overall_warnings: list[str] = Field(default_factory=list)
    recommended_multi_photo: bool


# ---- /api/reconstruct ----

class ReconstructRequest(BaseModel):
    upload_id: str
    quality: QualityMode = QualityMode.standard
    mesh_density: MeshDensity = MeshDensity.medium
    model_name: Optional[str] = None
    assume_symmetric_single_view: bool = True


class ReconstructResponse(BaseModel):
    job_id: str


class JobStep(BaseModel):
    key: str
    label: str
    status: str  # pending | in_progress | done | error | skipped
    detail: Optional[str] = None
    started_at: Optional[float] = None
    finished_at: Optional[float] = None


class JobStatusResponse(BaseModel):
    job_id: str
    state: str  # queued | running | done | error
    steps: list[JobStep]
    model_id: Optional[str] = None
    error: Optional[str] = None


# ---- /api/models ----

class MeshDiagnostics(BaseModel):
    watertight: bool
    manifold: bool
    open_edge_count: int
    non_manifold_edge_count: int
    duplicate_face_count_removed: int
    duplicate_vertex_count_removed: int
    degenerate_face_count_removed: int
    inverted_normals_fixed: bool
    self_intersection_check_method: str
    self_intersecting_faces: Optional[int] = None
    floating_components_removed: int
    tiny_triangles_removed: int
    euler_number: int
    vertex_count: int
    face_count: int
    volume_mm3: Optional[float] = None
    surface_area_mm2: Optional[float] = None
    is_stl_ready: bool
    remaining_issues: list[str] = Field(default_factory=list)


class PrintabilityWarning(BaseModel):
    kind: str  # thin_wall | unsupported_overhang | isolated_feature | small_detail
    message: str
    severity: str  # info | warning | critical
    location_hint: Optional[list[float]] = None
    measured_mm: Optional[float] = None


class PrintabilityReport(BaseModel):
    nozzle_mm: float
    min_wall_thickness_mm: Optional[float]
    warnings: list[PrintabilityWarning] = Field(default_factory=list)


class ModelDimensions(BaseModel):
    unit: Unit
    width: float
    height: float
    depth: float
    keep_aspect: bool = True


class ReconstructionInfo(BaseModel):
    method: str
    method_label: str
    confidence: str  # low | medium | high
    views_used: int
    notes: list[str] = Field(default_factory=list)


class ModelResponse(BaseModel):
    model_id: str
    name: str
    created_at: float
    reconstruction: ReconstructionInfo
    diagnostics: MeshDiagnostics
    printability: PrintabilityReport
    dimensions: ModelDimensions
    preview_url: str
    stl_url: str


class RepairRequest(BaseModel):
    pass


class ExportRequest(BaseModel):
    name: Optional[str] = None
    unit: Unit = Unit.mm
    width: Optional[float] = None
    height: Optional[float] = None
    depth: Optional[float] = None
    keep_aspect: bool = True
    nozzle_mm: float = 0.4


class ExportResponse(BaseModel):
    stl_url: str
    filename: str
    dimensions: ModelDimensions
    printability: PrintabilityReport
    diagnostics: MeshDiagnostics
