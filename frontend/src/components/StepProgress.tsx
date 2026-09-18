import type { JobStatusResponse } from "../types";

const ICON: Record<string, string> = { done: "✓", in_progress: "", error: "✕", pending: "", skipped: "–" };

export default function StepProgress({ job }: { job: JobStatusResponse }) {
  return (
    <div className="card">
      <h2><span className="step-no">3</span> İşlem Durumu</h2>
      <div className="steps">
        {job.steps.map((s) => (
          <div className={`step-item ${s.status}`} key={s.key}>
            <div className="line" />
            <div className="marker">
              {s.status === "in_progress" ? <span className="spinner" /> : ICON[s.status]}
            </div>
            <div className="content">
              <div className="title">{s.label}</div>
              {s.detail && <div className="detail">{s.detail}</div>}
            </div>
          </div>
        ))}
      </div>
      {job.state === "error" && (
        <div className="warning-item critical" style={{ marginTop: 10 }}>
          {job.error || "Beklenmeyen bir hata oluştu."}
        </div>
      )}
    </div>
  );
}
