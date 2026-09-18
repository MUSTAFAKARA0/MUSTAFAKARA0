import { useState } from "react";
import type { ModelDimensions, PrintabilityReport, Unit } from "../types";

const NOZZLE_OPTIONS = ["0.4", "0.6", "0.8", "1.0"];

interface Props {
  dimensions: ModelDimensions;
  printability: PrintabilityReport;
  modelName: string;
  onExport: (params: {
    name?: string; unit: Unit; width?: number; height?: number; depth?: number;
    keep_aspect: boolean; nozzle_mm: number;
  }) => Promise<void>;
  exporting: boolean;
  downloadUrl: string;
  filename?: string;
}

export default function ScaleExportPanel({
  dimensions, printability, modelName, onExport, exporting, downloadUrl, filename,
}: Props) {
  const [unit, setUnit] = useState<Unit>(dimensions.unit);
  const [width, setWidth] = useState(dimensions.width.toFixed(2));
  const [height, setHeight] = useState(dimensions.height.toFixed(2));
  const [depth, setDepth] = useState(dimensions.depth.toFixed(2));
  const [keepAspect, setKeepAspect] = useState(true);
  const [nozzle, setNozzle] = useState(printability.nozzle_mm.toFixed(1));
  const [name, setName] = useState(modelName);

  const handleDimChange = (axis: "w" | "h" | "d", value: string) => {
    const ratioW = parseFloat(width) || 1;
    const ratioH = parseFloat(height) || 1;
    const ratioD = parseFloat(depth) || 1;
    if (axis === "w") setWidth(value);
    if (axis === "h") setHeight(value);
    if (axis === "d") setDepth(value);
    if (!keepAspect) return;
    const v = parseFloat(value);
    if (!v || v <= 0) return;
    if (axis === "w") {
      setHeight(((v / ratioW) * ratioH).toFixed(2));
      setDepth(((v / ratioW) * ratioD).toFixed(2));
    } else if (axis === "h") {
      setWidth(((v / ratioH) * ratioW).toFixed(2));
      setDepth(((v / ratioH) * ratioD).toFixed(2));
    } else {
      setWidth(((v / ratioD) * ratioW).toFixed(2));
      setHeight(((v / ratioD) * ratioH).toFixed(2));
    }
  };

  const submit = () => {
    onExport({
      name: name || undefined,
      unit,
      width: parseFloat(width) || undefined,
      height: keepAspect ? undefined : parseFloat(height) || undefined,
      depth: keepAspect ? undefined : parseFloat(depth) || undefined,
      keep_aspect: keepAspect,
      nozzle_mm: parseFloat(nozzle),
    });
  };

  const worstSeverity = printability.warnings.some((w) => w.severity === "critical")
    ? "critical"
    : printability.warnings.some((w) => w.severity === "warning")
    ? "warning"
    : null;

  return (
    <div className="card">
      <h2><span className="step-no">5</span> Ölçek &amp; 3D Baskı Ayarları</h2>

      <div className="field">
        <label htmlFor="export-name">Model adı</label>
        <input id="export-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="model" />
      </div>

      <div className="field">
        <label>Birim</label>
        <div className="segmented">
          {(["mm", "cm", "inch"] as Unit[]).map((u) => (
            <button key={u} className={unit === u ? "active" : ""} onClick={() => setUnit(u)}>{u}</button>
          ))}
        </div>
      </div>

      <div className="field-row field">
        <div>
          <label htmlFor="dim-width">Genişlik</label>
          <input id="dim-width" type="number" value={width} onChange={(e) => handleDimChange("w", e.target.value)} />
        </div>
        <div>
          <label htmlFor="dim-height">Yükseklik</label>
          <input id="dim-height" type="number" value={height} disabled={keepAspect}
                 onChange={(e) => handleDimChange("h", e.target.value)} />
        </div>
        <div>
          <label htmlFor="dim-depth">Derinlik</label>
          <input id="dim-depth" type="number" value={depth} disabled={keepAspect}
                 onChange={(e) => handleDimChange("d", e.target.value)} />
        </div>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
        <input type="checkbox" style={{ width: "auto" }} checked={keepAspect}
               onChange={(e) => setKeepAspect(e.target.checked)} />
        Oranı koru
      </label>

      <div className="field" style={{ marginTop: 14 }}>
        <label>Nozzle çapı</label>
        <div className="segmented">
          {NOZZLE_OPTIONS.map((n) => (
            <button key={n} className={nozzle === n ? "active" : ""} onClick={() => setNozzle(n)}>{n} mm</button>
          ))}
        </div>
      </div>

      <div className="btn-row" style={{ justifyContent: "flex-start" }}>
        <button className="primary" onClick={submit} disabled={exporting}>
          {exporting ? <><span className="spinner" /> Uygulanıyor...</> : "Ölçeği Uygula / STL Güncelle"}
        </button>
      </div>

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <strong style={{ fontSize: "0.88rem" }}>3D Baskı Uygunluğu</strong>
          {worstSeverity && (
            <span className={`badge ${worstSeverity === "critical" ? "bad" : "ok"}`}>
              {worstSeverity === "critical" ? "Kritik uyarı" : "Uyarı var"}
            </span>
          )}
        </div>
        {printability.min_wall_thickness_mm != null && (
          <div style={{ fontSize: "0.78rem", color: "var(--text-dim)", marginBottom: 6 }}>
            En ince duvar kalınlığı: <b style={{ color: "var(--text)" }}>{printability.min_wall_thickness_mm.toFixed(2)} mm</b>
          </div>
        )}
        {printability.warnings.length === 0 ? (
          <div style={{ fontSize: "0.8rem", color: "var(--ok)" }}>Bilinen bir baskı sorunu tespit edilmedi.</div>
        ) : (
          <div className="warning-list">
            {printability.warnings.map((w, i) => (
              <div className={`warning-item ${w.severity === "critical" ? "critical" : ""}`} key={i}>{w.message}</div>
            ))}
          </div>
        )}
      </div>

      <div className="btn-row" style={{ marginTop: 16 }}>
        <a href={downloadUrl} download={filename}>
          <button className="primary">⬇ STL İndir{filename ? ` (${filename})` : ""}</button>
        </a>
      </div>
    </div>
  );
}
