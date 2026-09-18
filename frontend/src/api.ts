import type {
  ExportResponse,
  JobStatusResponse,
  MeshDensity,
  ModelResponse,
  QualityMode,
  Unit,
  UploadResponse,
  ViewLabel,
} from "./types";

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export async function uploadPhotos(files: File[], views: ViewLabel[]): Promise<UploadResponse> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  form.append("views", JSON.stringify(views));
  const res = await fetch("/api/upload", { method: "POST", body: form });
  return asJson(res);
}

export async function startReconstruction(params: {
  upload_id: string;
  quality: QualityMode;
  mesh_density: MeshDensity;
  model_name?: string;
}): Promise<{ job_id: string }> {
  const res = await fetch("/api/reconstruct", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return asJson(res);
}

export async function getJob(jobId: string): Promise<JobStatusResponse> {
  const res = await fetch(`/api/jobs/${jobId}`);
  return asJson(res);
}

export async function getModel(modelId: string): Promise<ModelResponse> {
  const res = await fetch(`/api/models/${modelId}`);
  return asJson(res);
}

export async function repairModel(modelId: string): Promise<ModelResponse> {
  const res = await fetch(`/api/models/${modelId}/repair`, { method: "POST" });
  return asJson(res);
}

export async function exportModel(
  modelId: string,
  params: {
    name?: string;
    unit: Unit;
    width?: number;
    height?: number;
    depth?: number;
    keep_aspect: boolean;
    nozzle_mm: number;
  },
): Promise<ExportResponse> {
  const res = await fetch(`/api/models/${modelId}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return asJson(res);
}

export async function deleteModel(modelId: string): Promise<void> {
  await fetch(`/api/models/${modelId}`, { method: "DELETE" });
}

export function previewUrl(modelId: string): string {
  return `/api/models/${modelId}/preview.glb?t=${Date.now()}`;
}

export function downloadUrl(modelId: string): string {
  return `/api/models/${modelId}/download`;
}
