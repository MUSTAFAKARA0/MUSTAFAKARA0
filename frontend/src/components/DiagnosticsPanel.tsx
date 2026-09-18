import type { MeshDiagnostics, ReconstructionInfo } from "../types";

interface Props {
  diagnostics: MeshDiagnostics;
  reconstruction: ReconstructionInfo;
  onRepair: () => void;
  repairing: boolean;
}

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`diag-pill ${ok ? "ok" : "bad"}`}>
      <span className="icon">{ok ? "✓" : "✕"}</span> {label}
    </div>
  );
}

export default function DiagnosticsPanel({ diagnostics: d, reconstruction: r, onRepair, repairing }: Props) {
  return (
    <div className="card">
      <h2>
        <span className="step-no">4</span> Geometri Kontrolü
        <span className={`confidence-badge ${r.confidence}`} style={{ marginLeft: "auto" }}>
          {r.method_label} · güven: {r.confidence === "high" ? "yüksek" : r.confidence === "medium" ? "orta" : "düşük"}
        </span>
      </h2>

      <div className="diag-grid">
        <Pill ok={d.watertight} label="Watertight" />
        <Pill ok={d.manifold} label="Manifold" />
        <Pill ok={d.inverted_normals_fixed} label="Normals OK" />
        <Pill ok={d.is_stl_ready} label="STL Ready" />
      </div>

      {!d.is_stl_ready && d.remaining_issues.length > 0 && (
        <>
          <div className="warning-list">
            {d.remaining_issues.map((issue, i) => (
              <div className="warning-item critical" key={i}>Model STL olarak oluşturuldu ancak: {issue}</div>
            ))}
          </div>
          <div className="btn-row" style={{ justifyContent: "flex-start", marginTop: 10 }}>
            <button onClick={onRepair} disabled={repairing}>
              {repairing ? <><span className="spinner" /> Onarılıyor...</> : "Otomatik düzeltmeyi dene"}
            </button>
          </div>
        </>
      )}

      <div className="diag-stats">
        <div><b>{d.vertex_count.toLocaleString("tr-TR")}</b>vertex</div>
        <div><b>{d.face_count.toLocaleString("tr-TR")}</b>yüzey</div>
        <div><b>{d.open_edge_count}</b>açık kenar</div>
        <div><b>{d.non_manifold_edge_count}</b>non-manifold kenar</div>
        <div><b>{d.self_intersecting_faces ?? "—"}</b>kendiyle kesişen yüzey</div>
        <div><b>{d.euler_number}</b>Euler sayısı</div>
        {d.volume_mm3 != null && <div><b>{(d.volume_mm3 / 1000).toFixed(1)} cm³</b>hacim</div>}
        {d.surface_area_mm2 != null && <div><b>{(d.surface_area_mm2 / 100).toFixed(1)} cm²</b>yüzey alanı</div>}
      </div>

      <div style={{ fontSize: "0.7rem", color: "var(--text-faint)", marginTop: 10 }}>
        Self-intersection kontrol yöntemi: {d.self_intersection_check_method}
      </div>

      {r.notes.length > 0 && (
        <ul className="notes-list">
          {r.notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      )}
    </div>
  );
}
