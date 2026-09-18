import type { UploadResponse } from "../types";

interface Props {
  result: UploadResponse;
  onReconstruct: () => void;
  starting: boolean;
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 60 ? "var(--ok)" : value >= 35 ? "var(--warn)" : "var(--critical)";
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem" }}>
        <span>{label}</span><span>{Math.round(value)}</span>
      </div>
      <div style={{ height: 4, borderRadius: 4, background: "var(--border)", overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", background: color }} />
      </div>
    </div>
  );
}

export default function AnalysisPanel({ result, onReconstruct, starting }: Props) {
  const usableCount = result.images.filter((i) => i.usable).length;

  return (
    <div className="card">
      <h2><span className="step-no">2</span> Fotoğraf Analizi</h2>

      <div className="diag-stats" style={{ marginTop: 0, marginBottom: 4 }}>
        <div><b>{usableCount}/{result.images.length}</b>kullanılabilir fotoğraf</div>
      </div>

      {result.overall_warnings.length > 0 && (
        <div className="warning-list">
          {result.overall_warnings.map((w, i) => <div className="warning-item" key={i}>{w}</div>)}
        </div>
      )}

      <div className="photo-grid">
        {result.images.map((img) => (
          <div className="photo-card" key={img.filename}>
            <div className="body">
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                {img.view !== "unspecified" ? img.view : "görünüm"}
                <span className={`badge ${img.usable ? "ok" : "bad"}`} style={{ float: "right" }}>
                  {img.usable ? "OK" : "Zayıf"}
                </span>
              </div>
              <ScoreBar label="Netlik" value={img.sharpness_score} />
              <ScoreBar label="Işık" value={img.brightness_score} />
              <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", marginTop: 4 }}>
                Nesne kaplama: %{Math.round(img.subject_coverage_ratio * 100)}
              </div>
              {img.warnings.map((w, i) => (
                <div key={i} style={{ fontSize: "0.68rem", color: "var(--warn)", marginTop: 4 }}>{w}</div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="btn-row">
        <button className="primary" disabled={usableCount === 0 || starting} onClick={onReconstruct}>
          {starting ? <><span className="spinner" /> Başlatılıyor...</> : "3D Model Oluştur"}
        </button>
      </div>
    </div>
  );
}
