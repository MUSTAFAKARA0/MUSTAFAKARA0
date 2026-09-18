import { useEffect, useRef, useState } from "react";
import UploadPanel, { type PendingPhoto } from "./components/UploadPanel";
import AnalysisPanel from "./components/AnalysisPanel";
import StepProgress from "./components/StepProgress";
import Viewer3D from "./components/Viewer3D";
import DiagnosticsPanel from "./components/DiagnosticsPanel";
import ScaleExportPanel from "./components/ScaleExportPanel";
import * as api from "./api";
import type { JobStatusResponse, MeshDensity, ModelResponse, QualityMode, UploadResponse } from "./types";

type Stage = "upload" | "analysis" | "job" | "result";

export default function App() {
  const [stage, setStage] = useState<Stage>("upload");
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [quality, setQuality] = useState<QualityMode>("standard");
  const [density, setDensity] = useState<MeshDensity>("medium");
  const [modelName, setModelName] = useState("");

  const [analyzing, setAnalyzing] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [starting, setStarting] = useState(false);
  const [job, setJob] = useState<JobStatusResponse | null>(null);

  const [model, setModel] = useState<ModelResponse | null>(null);
  const [previewNonce, setPreviewNonce] = useState(0);
  const [repairing, setRepairing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastExportFilename, setLastExportFilename] = useState<string | undefined>();

  const pollRef = useRef<number | null>(null);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setUploadError(null);
    try {
      const files = photos.map((p) => p.file);
      const views = photos.map((p) => p.view);
      const res = await api.uploadPhotos(files, views);
      setUploadResult(res);
      setStage("analysis");
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Yükleme sırasında hata oluştu.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleReconstruct = async () => {
    if (!uploadResult) return;
    setStarting(true);
    try {
      const { job_id } = await api.startReconstruction({
        upload_id: uploadResult.upload_id,
        quality,
        mesh_density: density,
        model_name: modelName || undefined,
      });
      setStage("job");
      setJob(null);
      pollJob(job_id);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "İşlem başlatılamadı.");
    } finally {
      setStarting(false);
    }
  };

  const pollJob = (jobId: string) => {
    const tick = async () => {
      try {
        const status = await api.getJob(jobId);
        setJob(status);
        if (status.state === "done" && status.model_id) {
          const m = await api.getModel(status.model_id);
          setModel(m);
          setLastExportFilename(undefined);
          setStage("result");
          return;
        }
        if (status.state === "error") return;
        pollRef.current = window.setTimeout(tick, 900);
      } catch {
        pollRef.current = window.setTimeout(tick, 1500);
      }
    };
    tick();
  };

  useEffect(() => () => { if (pollRef.current) window.clearTimeout(pollRef.current); }, []);

  const handleRepair = async () => {
    if (!model) return;
    setRepairing(true);
    try {
      const updated = await api.repairModel(model.model_id);
      setModel(updated);
      setPreviewNonce((n) => n + 1);
    } finally {
      setRepairing(false);
    }
  };

  const handleExport = async (params: Parameters<typeof api.exportModel>[1]) => {
    if (!model) return;
    setExporting(true);
    try {
      const res = await api.exportModel(model.model_id, params);
      setModel({
        ...model, dimensions: res.dimensions, printability: res.printability,
        diagnostics: res.diagnostics, name: params.name || model.name,
      });
      setLastExportFilename(res.filename);
      setPreviewNonce((n) => n + 1);
    } finally {
      setExporting(false);
    }
  };

  const startOver = () => {
    setStage("upload");
    setPhotos([]);
    setUploadResult(null);
    setJob(null);
    setModel(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand"><span className="dot" /> Photo to STL</div>
        {stage !== "upload" && <button className="ghost small" onClick={startOver}>+ Yeni Model</button>}
      </header>

      {stage === "upload" && (
        <div className="hero">
          <h1>FOTOĞRAFTAN 3D MODEL</h1>
          <p>
            Fotoğrafınızı yükleyin, gerçek bir geometri işleme hattı (arka plan ayrıştırma, çoklu görünüm
            3D rekonstrüksiyon, mesh temizleme ve doğrulama) ile 3D baskıya hazır bir STL dosyası oluşturun.
            Tek fotoğrafta nesnenin görünmeyen arka yüzü <b>tahmin edilir</b> — en doğru sonuç için 3-6 farklı
            açıdan fotoğraf yükleyin.
          </p>
        </div>
      )}

      {uploadError && <div className="warning-item critical">{uploadError}</div>}

      {(stage === "upload") && (
        <UploadPanel
          photos={photos} setPhotos={setPhotos}
          quality={quality} setQuality={setQuality}
          density={density} setDensity={setDensity}
          modelName={modelName} setModelName={setModelName}
          onAnalyze={handleAnalyze} analyzing={analyzing}
        />
      )}

      {stage === "analysis" && uploadResult && (
        <AnalysisPanel result={uploadResult} onReconstruct={handleReconstruct} starting={starting} />
      )}

      {stage === "job" && job && <StepProgress job={job} />}

      {stage === "result" && model && (
        <div className="grid-2">
          <Viewer3D url={`${api.previewUrl(model.model_id)}&n=${previewNonce}`} />
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <DiagnosticsPanel
              diagnostics={model.diagnostics} reconstruction={model.reconstruction}
              onRepair={handleRepair} repairing={repairing}
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <ScaleExportPanel
              dimensions={model.dimensions}
              printability={model.printability}
              modelName={model.name}
              onExport={handleExport}
              exporting={exporting}
              downloadUrl={api.downloadUrl(model.model_id)}
              filename={lastExportFilename}
            />
          </div>
        </div>
      )}

      <div className="footer-note">
        Bu uygulama fotoğraflarınızı kalıcı olarak saklamaz; yüklenen dosyalar ve üretilen modeller belirli bir
        süre sonra otomatik olarak silinir. Tek fotoğraftan üretilen modellerde görünmeyen yüzeyler tahminidir.
      </div>
    </div>
  );
}
