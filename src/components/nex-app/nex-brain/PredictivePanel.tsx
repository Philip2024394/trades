// NEX Predictive · Communications Centre panel · Phase 5.4 · invariant #15
//
// v0.1 focuses on the ONE measurable prediction we lock first:
//   "Probability a contact will complete the configured conversion
//    goal within the attribution window."
//
// The panel reads the model registry, the global kill switch, and the
// recent predictions feed, and offers a one-off inference form so
// Philip can eyeball the explainability output. It NEVER sends,
// enrols, or optimises — matches invariant #15.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ModelStatus = "shadow" | "active" | "retired";
type Model = {
  model_id: string;
  target: string;
  model_version: string;
  model_kind: string;
  status: ModelStatus;
  feature_spec: Array<{ name: string; weight: number }>;
  hyperparameters: Record<string, unknown>;
  calibration: Record<string, unknown>;
  deployed_at: string | null;
  deployed_by: string | null;
  notes: string | null;
  created_at: string;
};
type Prediction = {
  prediction_id: string;
  target: string;
  model_version: string;
  contact_id: string | null;
  prediction: { value: number };
  confidence: number;
  reason: Array<{ feature: string; weight: number; contribution: number }>;
  window_days: number | null;
  mode: "recommendation" | "optimisation" | "shadow";
  created_at: string;
};
type Controls = { paused: boolean; paused_at: string | null; paused_by: string | null; paused_reason: string | null; confidence_threshold: number };

const T = {
  panel: "#12161c", panelHi: "#1a2028", border: "#232b36",
  text: "#e5e9ef", textDim: "#8892a0", textFade: "#5c6572",
  accent: "#4dd0a0", warning: "#f0b45a", danger: "#f0665a", info: "#5aa6f0", purple: "#b48cf0",
};

type CalibrationBin = { bucket: string; bucket_min: number; bucket_max: number; n: number; mean_predicted: number; observed_rate: number };
type DriftBucket = { window_label: string; n: number; base_rate: number | null; brier: number | null };
type PrecisionRecallRow = { threshold: number; predicted_positive: number; actual_positive: number; true_positive: number; precision: number | null; recall: number | null; f1: number | null };
type CalibrationReport = {
  ok: true; target: string; model_version_filter: string | null;
  n_predictions: number; n_resolved: number; n_pending: number; n_positive: number;
  base_rate: number | null; brier: number | null; brier_reference: number | null; brier_skill: number | null; auc: number | null;
  calibration_bins: CalibrationBin[]; precision_recall: PrecisionRecallRow[]; drift: DriftBucket[]; computed_at: string;
};

export function PredictivePanel() {
  const [models, setModels] = useState<Model[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [controls, setControls] = useState<Controls | null>(null);
  const [contactId, setContactId] = useState("");
  const [windowDays, setWindowDays] = useState(30);
  const [mode, setMode] = useState<"recommendation" | "optimisation">("recommendation");
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<Prediction | null>(null);
  const [threshold, setThreshold] = useState(0.6);
  const [calibration, setCalibration] = useState<CalibrationReport | null>(null);
  const [calibrationNow, setCalibrationNow] = useState<string>("");

  const loadAll = useCallback(async () => {
    const qs = calibrationNow ? `?now=${encodeURIComponent(calibrationNow)}` : "";
    const [m, p, c, cal] = await Promise.all([
      fetch("/api/nex/predictive/models").then((r) => r.json()),
      fetch("/api/nex/predictive/predictions?limit=25").then((r) => r.json()),
      fetch("/api/nex/predictive/controls").then((r) => r.json()),
      fetch(`/api/nex/predictive/calibration${qs}`).then((r) => r.json()),
    ]);
    if (m.ok) setModels(m.models);
    if (p.ok) setPredictions(p.predictions);
    if (c.ok) { setControls(c.controls); setThreshold(Number(c.controls.confidence_threshold)); }
    if (cal.ok) setCalibration(cal as CalibrationReport);
  }, [calibrationNow]);
  useEffect(() => { void loadAll(); const t = setInterval(loadAll, 20_000); return () => clearInterval(t); }, [loadAll]);

  const activeModel = useMemo(() => models.find((m) => m.status === "active" && m.target === "conversion_probability") ?? null, [models]);

  const runInference = async () => {
    if (!contactId) return;
    setBusy(true); setLastResult(null);
    try {
      const r = await fetch("/api/nex/predictive/predict", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ target: "conversion_probability", contact_id: contactId.trim(), window_days: windowDays, mode }),
      });
      const d = await r.json() as { ok: boolean; prediction?: Prediction; error?: string };
      if (d.ok && d.prediction) setLastResult(d.prediction);
      await loadAll();
    } finally { setBusy(false); }
  };

  const togglePause = async () => {
    if (!controls) return;
    const next = !controls.paused;
    await fetch("/api/nex/predictive/controls", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(next ? { paused: true, paused_by: "hq", paused_reason: "manual pause from HQ" } : { paused: false }),
    });
    await loadAll();
  };

  const saveThreshold = async () => {
    await fetch("/api/nex/predictive/controls", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ confidence_threshold: threshold }),
    });
    await loadAll();
  };

  const activate = async (model_id: string) => {
    await fetch("/api/nex/predictive/models/activate", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ model_id, deployed_by: "hq" }),
    });
    await loadAll();
  };

  return (
    <div className="space-y-3">
      {/* KPI row */}
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <Kpi label="Engine" value={controls?.paused ? "PAUSED" : "LIVE"} tone={controls?.paused ? "warn" : "good"} hint={controls?.paused ? controls.paused_reason ?? "" : "receiving inference calls"} />
        <Kpi label="Active model" value={activeModel?.model_version ?? "—"} tone={activeModel ? "good" : "unset"} hint={activeModel ? `${activeModel.model_kind} · ${activeModel.feature_spec.length} features` : "no active model"} />
        <Kpi label="Confidence threshold" value={controls ? controls.confidence_threshold.toFixed(2) : "—"} tone="neutral" hint="optimisation mode requires this or higher" />
        <Kpi label="Predictions logged" value={predictions.length} tone="neutral" hint="last 25 · INSERT-only" />
        <Kpi label="Doctrine" value="#15 held" tone="good" hint="prediction is not execution" />
      </div>

      {/* Controls */}
      <div className="rounded-md border p-2" style={{ background: T.panelHi, borderColor: T.border }}>
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Controls</span>
          <button type="button" onClick={togglePause}
            className="rounded-md border px-3 py-1 text-[10px] font-semibold"
            style={{ background: controls?.paused ? T.accent : T.warning, borderColor: controls?.paused ? T.accent : T.warning, color: T.panel }}>
            {controls?.paused ? "Resume engine" : "Pause engine (kill switch)"}
          </button>
          <span className="ml-3 text-[10px]" style={{ color: T.textFade }}>Confidence threshold</span>
          <input type="number" step="0.05" min="0" max="1" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-20 rounded-md border px-2 py-1 font-mono text-[10px]"
            style={{ background: T.panel, borderColor: T.border, color: T.text }} />
          <button type="button" onClick={saveThreshold} className="rounded-md border px-2 py-1 text-[10px]"
            style={{ background: T.info, borderColor: T.info, color: T.panel }}>Save</button>
        </div>
        <div className="text-[9.5px] italic" style={{ color: T.textFade }}>
          Pause blocks optimisation commands globally without a redeploy · predictions still run as `shadow` so calibration is not blinded.
        </div>
      </div>

      {/* Inference form */}
      <div className="rounded-md border p-3" style={{ background: T.panelHi, borderColor: T.border }}>
        <div className="mb-2 flex items-baseline justify-between">
          <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>One-off inference · conversion probability</div>
          <span className="text-[9px]" style={{ color: T.textFade }}>reads analytics + attribution · zero side effects</span>
        </div>
        <div className="grid items-center gap-2" style={{ gridTemplateColumns: "1fr 90px 140px 100px" }}>
          <input value={contactId} onChange={(e) => setContactId(e.target.value)}
            placeholder="contact_id (UUID)"
            className="rounded-md border px-2 py-1 font-mono text-[10.5px]"
            style={{ background: T.panel, borderColor: T.border, color: T.text }} />
          <input type="number" min={1} value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))}
            className="rounded-md border px-2 py-1 font-mono text-[10.5px]"
            style={{ background: T.panel, borderColor: T.border, color: T.text }} />
          <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}
            className="rounded-md border px-2 py-1 font-mono text-[10.5px]"
            style={{ background: T.panel, borderColor: T.border, color: T.text }}>
            <option value="recommendation">recommendation</option>
            <option value="optimisation">optimisation</option>
          </select>
          <button type="button" onClick={runInference} disabled={busy || !contactId}
            className="rounded-md border px-2 py-1 text-[10px] font-semibold"
            style={{ background: T.accent, borderColor: T.accent, color: T.panel, opacity: busy || !contactId ? 0.55 : 1 }}>
            {busy ? "Inferring…" : "Predict"}
          </button>
        </div>
        {lastResult ? (
          <div className="mt-3 rounded-md border p-2" style={{ background: T.panel, borderColor: T.border }}>
            <div className="mb-1 flex items-baseline justify-between">
              <div className="font-mono text-[11px]" style={{ color: T.accent }}>
                {(lastResult.prediction.value * 100).toFixed(1)}% likely to convert in {lastResult.window_days ?? "?"} days
              </div>
              <span className="font-mono text-[9.5px]" style={{ color: lastResult.mode === "shadow" ? T.warning : T.info }}>
                mode: {lastResult.mode} · confidence {lastResult.confidence.toFixed(3)}
              </span>
            </div>
            <div className="text-[9.5px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Why did Nex think that?</div>
            <div className="mt-1 space-y-0.5">
              {lastResult.reason.map((r) => (
                <div key={r.feature} className="grid items-center gap-2 text-[10px]" style={{ gridTemplateColumns: "180px 60px 60px 1fr" }}>
                  <span className="font-mono" style={{ color: T.text }}>{r.feature}</span>
                  <span className="font-mono text-right" style={{ color: T.textFade }}>w {r.weight.toFixed(3)}</span>
                  <span className="font-mono text-right" style={{ color: r.contribution >= 0 ? T.accent : T.danger }}>{r.contribution >= 0 ? "+" : ""}{r.contribution.toFixed(3)}</span>
                  <div className="h-1 rounded-full" style={{ background: T.panelHi }}>
                    <div className="h-1 rounded-full"
                      style={{ width: `${Math.min(100, Math.abs(r.contribution) * 30)}%`, background: r.contribution >= 0 ? T.accent : T.danger }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Model registry */}
      <div className="rounded-md border" style={{ background: T.panelHi, borderColor: T.border }}>
        <div className="border-b p-2 text-[9px] font-black uppercase tracking-widest" style={{ borderColor: T.border, color: T.textFade }}>
          Model registry · {models.length} · rollback = activate a prior version
        </div>
        {models.length === 0 ? (
          <div className="p-3 text-[10.5px]" style={{ color: T.textFade }}>No models registered — the first inference will seed `conv-prob@v0.1.0`.</div>
        ) : (
          <div>
            {models.map((m) => (
              <div key={m.model_id} className="grid items-center gap-2 border-b px-2 py-1.5 text-[10.5px]"
                style={{ borderColor: T.border, gridTemplateColumns: "220px 160px 90px 130px 1fr 90px" }}>
                <span className="font-mono" style={{ color: T.text }}>{m.model_version}</span>
                <span className="font-mono text-[9.5px]" style={{ color: T.textFade }}>{m.target}</span>
                <span className="rounded-full border px-2 py-0.5 text-center font-mono text-[9px]"
                  style={{
                    background: m.status === "active" ? T.accent : m.status === "shadow" ? T.info : T.panel,
                    borderColor: m.status === "active" ? T.accent : m.status === "shadow" ? T.info : T.border,
                    color: m.status === "active" || m.status === "shadow" ? T.panel : T.textFade,
                  }}>
                  {m.status}
                </span>
                <span className="font-mono text-[9.5px]" style={{ color: T.textFade }}>{m.model_kind} · {m.feature_spec.length}f</span>
                <span className="truncate text-[9.5px]" style={{ color: T.textFade }} title={m.notes ?? ""}>{m.notes ?? ""}</span>
                {m.status !== "active" ? (
                  <button type="button" onClick={() => activate(m.model_id)}
                    className="rounded-md border px-2 py-1 text-[9.5px] font-semibold"
                    style={{ background: T.info, borderColor: T.info, color: T.panel }}>
                    Activate
                  </button>
                ) : <span className="text-[9px] text-center" style={{ color: T.textFade }}>current</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Calibration + measurement (read-only observability pass) */}
      <div className="rounded-md border" style={{ background: T.panelHi, borderColor: T.border }}>
        <div className="flex items-center justify-between border-b p-2" style={{ borderColor: T.border }}>
          <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>
            Calibration · does prediction match reality?
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9.5px]" style={{ color: T.textFade }}>as-of (blank = now)</span>
            <input type="datetime-local" value={calibrationNow} onChange={(e) => setCalibrationNow(e.target.value)}
              className="rounded-md border px-2 py-1 font-mono text-[10px]"
              style={{ background: T.panel, borderColor: T.border, color: T.text }} />
            <button type="button" onClick={() => setCalibrationNow("")}
              className="rounded-md border px-2 py-1 text-[9.5px]"
              style={{ background: T.panel, borderColor: T.border, color: T.textDim }}>clear</button>
          </div>
        </div>
        <div className="grid gap-2 p-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
          <Kpi label="Resolved" value={calibration?.n_resolved ?? 0} tone="neutral" hint={`${calibration?.n_pending ?? 0} pending · window not closed`} />
          <Kpi label="Positive" value={calibration?.n_positive ?? 0} tone={calibration && calibration.n_positive > 0 ? "good" : "unset"} hint={calibration?.base_rate != null ? `base rate ${(calibration.base_rate * 100).toFixed(1)}%` : ""} />
          <Kpi label="Brier" value={calibration?.brier != null ? calibration.brier.toFixed(4) : "—"} tone="neutral" hint="lower is better · MSE of prob vs 0/1" />
          <Kpi label="Brier skill" value={calibration?.brier_skill != null ? calibration.brier_skill.toFixed(3) : "—"} tone={calibration?.brier_skill != null ? (calibration.brier_skill > 0 ? "good" : "bad") : "unset"} hint="+ve = beats always-predict-base-rate" />
          <Kpi label="AUC" value={calibration?.auc != null ? calibration.auc.toFixed(3) : "—"} tone={calibration?.auc != null ? (calibration.auc >= 0.7 ? "good" : calibration.auc >= 0.5 ? "warn" : "bad") : "unset"} hint="rank quality · needs both classes" />
        </div>

        {/* Calibration curve · predicted (x) vs observed (y) per decile */}
        <div className="p-2">
          <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Calibration curve · predicted vs observed</div>
          {calibration && calibration.calibration_bins.some((b) => b.n > 0) ? (
            <div className="space-y-0.5">
              {calibration.calibration_bins.map((b) => (
                <div key={b.bucket} className="grid items-center gap-2 text-[10px]" style={{ gridTemplateColumns: "80px 40px 1fr 70px 70px" }}>
                  <span className="font-mono" style={{ color: T.textDim }}>{b.bucket}</span>
                  <span className="font-mono text-right" style={{ color: b.n > 0 ? T.text : T.textFade }}>n={b.n}</span>
                  <div className="relative h-2 rounded-full" style={{ background: T.panel }}>
                    <div className="absolute inset-y-0 rounded-full" style={{ background: T.info, left: `${b.mean_predicted * 100}%`, width: 2 }} title={`predicted ${(b.mean_predicted * 100).toFixed(1)}%`} />
                    <div className="absolute inset-y-0 rounded-full" style={{ background: T.accent, left: `${b.observed_rate * 100}%`, width: 2 }} title={`observed ${(b.observed_rate * 100).toFixed(1)}%`} />
                  </div>
                  <span className="font-mono text-right text-[9.5px]" style={{ color: T.info }}>p̂ {(b.mean_predicted * 100).toFixed(1)}%</span>
                  <span className="font-mono text-right text-[9.5px]" style={{ color: T.accent }}>obs {(b.observed_rate * 100).toFixed(1)}%</span>
                </div>
              ))}
              <div className="mt-1 text-[9px] italic" style={{ color: T.textFade }}>Blue tick = mean predicted · green tick = observed rate. Perfect calibration = ticks overlap in every populated bin.</div>
            </div>
          ) : (
            <div className="text-[10.5px]" style={{ color: T.textFade }}>
              No resolved predictions with populated bins yet. Populate by (a) letting real predictions age past their window, or (b) using the as-of picker to fast-forward.
            </div>
          )}
        </div>

        {/* Drift · by time bucket */}
        <div className="border-t p-2" style={{ borderColor: T.border }}>
          <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Drift · Brier + base rate by age of window</div>
          <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
            {(calibration?.drift ?? []).map((d) => (
              <div key={d.window_label} className="rounded-md border p-2" style={{ background: T.panel, borderColor: T.border }}>
                <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>{d.window_label}</div>
                <div className="mt-1 font-mono text-[11px]" style={{ color: d.n > 0 ? T.text : T.textFade }}>n {d.n}</div>
                <div className="font-mono text-[9.5px]" style={{ color: T.textFade }}>brier {d.brier != null ? d.brier.toFixed(4) : "—"}</div>
                <div className="font-mono text-[9.5px]" style={{ color: T.textFade }}>base {d.base_rate != null ? (d.base_rate * 100).toFixed(1) + "%" : "—"}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Precision / recall sweep */}
        <div className="border-t p-2" style={{ borderColor: T.border }}>
          <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Precision / recall / F1 at threshold sweep</div>
          <div className="grid gap-1" style={{ gridTemplateColumns: "60px 70px 70px 70px 70px 1fr" }}>
            <span className="text-[9px] font-black" style={{ color: T.textFade }}>threshold</span>
            <span className="text-[9px] font-black text-right" style={{ color: T.textFade }}>pred+</span>
            <span className="text-[9px] font-black text-right" style={{ color: T.textFade }}>TP</span>
            <span className="text-[9px] font-black text-right" style={{ color: T.textFade }}>precision</span>
            <span className="text-[9px] font-black text-right" style={{ color: T.textFade }}>recall</span>
            <span className="text-[9px] font-black text-right" style={{ color: T.textFade }}>F1</span>
          </div>
          {(calibration?.precision_recall ?? []).map((r) => (
            <div key={r.threshold} className="grid items-baseline gap-1 text-[10px]" style={{ gridTemplateColumns: "60px 70px 70px 70px 70px 1fr" }}>
              <span className="font-mono" style={{ color: T.textDim }}>{r.threshold.toFixed(2)}</span>
              <span className="font-mono text-right" style={{ color: T.text }}>{r.predicted_positive}</span>
              <span className="font-mono text-right" style={{ color: T.accent }}>{r.true_positive}</span>
              <span className="font-mono text-right" style={{ color: T.text }}>{r.precision != null ? r.precision.toFixed(3) : "—"}</span>
              <span className="font-mono text-right" style={{ color: T.text }}>{r.recall != null ? r.recall.toFixed(3) : "—"}</span>
              <span className="font-mono text-right" style={{ color: r.f1 != null ? T.accent : T.textFade }}>{r.f1 != null ? r.f1.toFixed(3) : "—"}</span>
            </div>
          ))}
        </div>

        <div className="border-t p-2 text-[9px] italic" style={{ borderColor: T.border, color: T.textFade }}>
          Read-only pass · joins nex.predictions × nex.conversion_events on (contact_id, window). Writes to no table. Populates as real windows close.
        </div>
      </div>

      {/* Recent predictions */}
      <div className="rounded-md border" style={{ background: T.panelHi, borderColor: T.border }}>
        <div className="border-b p-2 text-[9px] font-black uppercase tracking-widest" style={{ borderColor: T.border, color: T.textFade }}>
          Recent predictions · {predictions.length} · INSERT-only audit
        </div>
        <div className="max-h-[300px] overflow-auto">
          {predictions.length === 0 ? (
            <div className="p-3 text-[10.5px]" style={{ color: T.textFade }}>No predictions yet.</div>
          ) : predictions.map((p) => (
            <div key={p.prediction_id} className="grid items-baseline gap-2 border-b px-2 py-1.5 text-[10px]"
              style={{ borderColor: T.border, gridTemplateColumns: "150px 1fr 80px 90px 100px 120px" }}>
              <span className="font-mono" style={{ color: T.text }}>{p.target}</span>
              <span className="truncate font-mono text-[9.5px]" style={{ color: T.textFade }}>{p.contact_id ? p.contact_id.slice(0, 8) + "…" : "—"} · {p.model_version}</span>
              <span className="font-mono" style={{ color: T.accent }}>{(p.prediction.value * 100).toFixed(1)}%</span>
              <span className="font-mono text-[9.5px]" style={{ color: T.textFade }}>conf {p.confidence.toFixed(3)}</span>
              <span className="rounded-full border px-2 py-0.5 text-center font-mono text-[9px]"
                style={{
                  background: p.mode === "shadow" ? T.warning : p.mode === "optimisation" ? T.info : T.panel,
                  borderColor: p.mode === "shadow" ? T.warning : p.mode === "optimisation" ? T.info : T.border,
                  color: p.mode === "shadow" || p.mode === "optimisation" ? T.panel : T.textFade,
                }}>
                {p.mode}
              </span>
              <span className="font-mono text-[9.5px]" style={{ color: T.textFade }}>{new Date(p.created_at).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-[9.5px] italic" style={{ color: T.textFade }}>
        Predictive is not an execution authority · invariant #15 · charter §14. It scores, ranks, and recommends;
        Journey → Campaign → Scheduler → Compliance → Delivery remain the only paths that cause side effects.
      </div>
    </div>
  );
}

function Kpi({ label, value, tone = "neutral", hint }: { label: string; value: string | number; tone?: "neutral" | "good" | "warn" | "bad" | "unset"; hint?: string }) {
  const color = tone === "good" ? "#4dd0a0" : tone === "warn" ? "#f0b45a" : tone === "bad" ? "#f0665a" : tone === "unset" ? "#5c6572" : "#e5e9ef";
  return (
    <div className="rounded-md border p-3" style={{ background: "#1a2028", borderColor: "#232b36" }}>
      <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: "#5c6572" }}>{label}</div>
      <div className="mt-1 truncate font-mono text-[14px] font-black leading-none" style={{ color }}>{value}</div>
      {hint ? <div className="mt-1 text-[9.5px] truncate" style={{ color: "#5c6572" }} title={hint}>{hint}</div> : null}
    </div>
  );
}
