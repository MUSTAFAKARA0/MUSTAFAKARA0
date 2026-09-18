export type ViewLabel = "front" | "back" | "left" | "right" | "top" | "bottom" | "unspecified";
export type QualityMode = "fast" | "standard" | "professional" | "ultra";
export type MeshDensity = "low" | "medium" | "high" | "ultra";
export type Unit = "mm" | "cm" | "inch";

export interface ImageQualityReport {
  filename: string;
  view: ViewLabel;
  width: number;
  height: number;
  sharpness_score: number;
  brightness_score: number;
  background_complexity: number;
  subject_coverage_ratio: number;
  warnings: string[];
  usable: boolean;
}

export interface UploadResponse {
  upload_id: string;
  images: ImageQualityReport[];
  overall_warnings: string[];
  recommended_multi_photo: boolean;
}

export interface JobStep {
  key: string;
  label: string;
  status: "pending" | "in_progress" | "done" | "error" | "skipped";
  detail?: string | null;
}

export interface JobStatusResponse {
  job_id: string;
  state: "queued" | "running" | "done" | "error";
  steps: JobStep[];
  model_id?: string | null;
  error?: string | null;
}

export interface ReconstructionInfo {
  method: string;
  method_label: string;
  confidence: "low" | "medium" | "high";
  views_used: number;
  notes: string[];
}

export interface MeshDiagnostics {
  watertight: boolean;
  manifold: boolean;
  open_edge_count: number;
  non_manifold_edge_count: number;
  duplicate_face_count_removed: number;
  duplicate_vertex_count_removed: number;
  degenerate_face_count_removed: number;
  inverted_normals_fixed: boolean;
  self_intersection_check_method: string;
  self_intersecting_faces?: number | null;
  floating_components_removed: number;
  tiny_triangles_removed: number;
  euler_number: number;
  vertex_count: number;
  face_count: number;
  volume_mm3?: number | null;
  surface_area_mm2?: number | null;
  is_stl_ready: boolean;
  remaining_issues: string[];
}

export interface PrintabilityWarning {
  kind: string;
  message: string;
  severity: "info" | "warning" | "critical";
  location_hint?: number[] | null;
  measured_mm?: number | null;
}

export interface PrintabilityReport {
  nozzle_mm: number;
  min_wall_thickness_mm?: number | null;
  warnings: PrintabilityWarning[];
}

export interface ModelDimensions {
  unit: Unit;
  width: number;
  height: number;
  depth: number;
  keep_aspect: boolean;
}

export interface ModelResponse {
  model_id: string;
  name: string;
  created_at: number;
  reconstruction: ReconstructionInfo;
  diagnostics: MeshDiagnostics;
  printability: PrintabilityReport;
  dimensions: ModelDimensions;
  preview_url: string;
  stl_url: string;
}

export interface ExportResponse {
  stl_url: string;
  filename: string;
  dimensions: ModelDimensions;
  printability: PrintabilityReport;
  diagnostics: MeshDiagnostics;
}
