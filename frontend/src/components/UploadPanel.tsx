import { useRef, useState } from "react";
import type { MeshDensity, QualityMode, ViewLabel } from "../types";

const VIEW_OPTIONS: { value: ViewLabel; label: string }[] = [
  { value: "unspecified", label: "Belirtilmedi" },
  { value: "front", label: "Ön" },
  { value: "back", label: "Arka" },
  { value: "left", label: "Sol" },
  { value: "right", label: "Sağ" },
  { value: "top", label: "Üst" },
  { value: "bottom", label: "Alt" },
];

const QUALITY_OPTIONS: { value: QualityMode; label: string; hint: string }[] = [
  { value: "fast", label: "Hızlı", hint: "En hızlı işlem, düşük detay" },
  { value: "standard", label: "Standart", hint: "Dengeli hız/kalite" },
  { value: "professional", label: "Profesyonel", hint: "Daha uzun işlem, yüksek kalite" },
  { value: "ultra", label: "Ultra", hint: "En uzun işlem, maksimum kalite" },
];

const DENSITY_OPTIONS: { value: MeshDensity; label: string; hint: string }[] = [
  { value: "low", label: "Low", hint: "Hızlı baskı / prototip" },
  { value: "medium", label: "Medium", hint: "Normal kullanım" },
  { value: "high", label: "High", hint: "Detaylı model" },
  { value: "ultra", label: "Ultra", hint: "Maksimum detay" },
];

export interface PendingPhoto {
  file: File;
  url: string;
  view: ViewLabel;
}

interface Props {
  photos: PendingPhoto[];
  setPhotos: (p: PendingPhoto[]) => void;
  quality: QualityMode;
  setQuality: (q: QualityMode) => void;
  density: MeshDensity;
  setDensity: (d: MeshDensity) => void;
  modelName: string;
  setModelName: (n: string) => void;
  onAnalyze: () => void;
  analyzing: boolean;
}

export default function UploadPanel({
  photos, setPhotos, quality, setQuality, density, setDensity, modelName, setModelName, onAnalyze, analyzing,
}: Props) {
  const [dragActive, setDragActive] = useState(false);
  const galleryInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const accepted = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    const next: PendingPhoto[] = [];
    Array.from(fileList).forEach((file) => {
      if (!accepted.includes(file.type)) return;
      next.push({ file, url: URL.createObjectURL(file), view: "unspecified" });
    });
    const merged = [...photos, ...next].slice(0, 6);
    setPhotos(merged);
  };

  const removePhoto = (idx: number) => {
    setPhotos(photos.filter((_, i) => i !== idx));
  };

  const setView = (idx: number, view: ViewLabel) => {
    setPhotos(photos.map((p, i) => (i === idx ? { ...p, view } : p)));
  };

  return (
    <div className="card">
      <h2><span className="step-no">1</span> Fotoğraf Yükle</h2>

      <div
        className={`dropzone${dragActive ? " active" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => { e.preventDefault(); setDragActive(false); addFiles(e.dataTransfer.files); }}
        onClick={() => galleryInput.current?.click()}
      >
        <strong>Fotoğrafları buraya sürükleyin</strong> veya seçmek için tıklayın
        <div style={{ marginTop: 6, fontSize: "0.78rem" }}>JPG, JPEG, PNG, WEBP · en fazla 6 fotoğraf</div>
      </div>

      <input
        ref={galleryInput} type="file" accept="image/jpeg,image/png,image/webp" multiple
        style={{ display: "none" }} onChange={(e) => addFiles(e.target.files)}
      />
      <input
        ref={cameraInput} type="file" accept="image/*" capture="environment"
        style={{ display: "none" }} onChange={(e) => addFiles(e.target.files)}
      />

      <div className="btn-row">
        <button onClick={() => cameraInput.current?.click()}>📷 Fotoğraf Çek</button>
        <button onClick={() => galleryInput.current?.click()}>🖼️ Galeriden Seç</button>
      </div>

      {photos.length > 0 && (
        <div className="photo-grid">
          {photos.map((p, idx) => (
            <div className="photo-card" key={p.url}>
              <img src={p.url} alt={`fotoğraf ${idx + 1}`} />
              <div className="body">
                <button className="remove" onClick={() => removePhoto(idx)} title="Kaldır">✕</button>
                <select value={p.view} onChange={(e) => setView(idx, e.target.value as ViewLabel)}>
                  {VIEW_OPTIONS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {photos.length === 1 && (
        <div className="warning-item" style={{ marginTop: 12 }}>
          Model doğruluğunu artırmak için nesnenin farklı açılardan 3-6 fotoğrafını yükleyebilirsiniz
          (ön / arka / sol / sağ / üst / alt).
        </div>
      )}

      <div className="field" style={{ marginTop: 16 }}>
        <label htmlFor="upload-model-name">Model adı (opsiyonel)</label>
        <input id="upload-model-name" type="text" value={modelName} placeholder="ör. Kahve Fincanı"
               onChange={(e) => setModelName(e.target.value)} />
      </div>

      <div className="field">
        <label>Kalite modu</label>
        <div className="segmented">
          {QUALITY_OPTIONS.map((q) => (
            <button key={q.value} className={quality === q.value ? "active" : ""} title={q.hint}
                    onClick={() => setQuality(q.value)}>{q.label}</button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Mesh yoğunluğu</label>
        <div className="segmented">
          {DENSITY_OPTIONS.map((d) => (
            <button key={d.value} className={density === d.value ? "active" : ""} title={d.hint}
                    onClick={() => setDensity(d.value)}>{d.label}</button>
          ))}
        </div>
      </div>

      <div className="btn-row">
        <button className="primary" disabled={photos.length === 0 || analyzing} onClick={onAnalyze}>
          {analyzing ? <><span className="spinner" /> Analiz ediliyor...</> : "Fotoğrafları Analiz Et"}
        </button>
      </div>
    </div>
  );
}
