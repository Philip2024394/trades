// NEX Attribution · Communications Centre panel · Phase 5.3
//
// Descriptive · reports what happened · never rewrites journeys or
// picks winners (that belongs to 5.4 Predictive).
//
// UI:
//   Top row · totals for the selected model
//   Model + window pickers
//   Per-source drill-downs (campaign · journey · experiment · variant · provider · country · domain)
//   Recent conversions feed with "Compute" button
//
// The panel is READ-only against v1.0 kernel state. Conversions come
// from POST /api/nex/attribution/conversions (webhook or manual).

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Model = "first_touch" | "last_touch" | "linear";
type ReportRow = { key: string; label: string | null; conversions: number; contacts: number; attributed_value: number; currency: string };
type Report = {
  ok: boolean;
  window_days: number; model: Model;
  totals: { conversions: number; contacts: number; attributed_value: number; currency: string };
  by_source_type: Record<"campaign"|"journey"|"experiment"|"variant"|"provider"|"country"|"domain", ReportRow[]>;
  computed_at: string;
};
type Conversion = {
  conversion_id: string; contact_id: string; event_type: string;
  conversion_value: number; currency: string; occurred_at: string;
  window_days: number; source: string; external_ref: string | null;
  correlation_id: string | null;
};

const T = {
  panel: "#12161c", panelHi: "#1a2028", border: "#232b36",
  text: "#e5e9ef", textDim: "#8892a0", textFade: "#5c6572",
  accent: "#4dd0a0", warning: "#f0b45a", danger: "#f0665a", info: "#5aa6f0", purple: "#b48cf0",
};
const inputStyle: React.CSSProperties = { background: T.panel, borderColor: T.border, color: T.text };

const MODEL_LABEL: Record<Model, string> = { first_touch: "First touch", last_touch: "Last touch", linear: "Linear" };
const WINDOW_PRESETS = [7, 30, 90];

const SOURCE_LABELS: Record<keyof Report["by_source_type"], string> = {
  campaign: "Campaign", journey: "Journey", experiment: "Experiment", variant: "Variant",
  provider: "Provider", country: "Country", domain: "Domain",
};

export function AttributionPanel() {
  const [model, setModel] = useState<Model>("last_touch");
  const [windowDays, setWindowDays] = useState<number | "any">("any");
  const [report, setReport] = useState<Report | null>(null);
  const [conversions, setConversions] = useState<Conversion[]>([]);
  const [busy, setBusy] = useState(false);
  const [computeMsg, setComputeMsg] = useState<string>("");

  const loadReport = useCallback(async () => {
    const qs = new URLSearchParams({ model });
    if (windowDays !== "any") qs.set("window_days", String(windowDays));
    const r = await fetch(`/api/nex/attribution/reports?${qs}`).then((x) => x.json()) as Report;
    if (r.ok) setReport(r);
  }, [model, windowDays]);
  const loadConversions = useCallback(async () => {
    const r = await fetch("/api/nex/attribution/conversions").then((x) => x.json()) as { ok: boolean; conversions: Conversion[] };
    if (r.ok) setConversions(r.conversions);
  }, []);
  useEffect(() => { void loadReport(); const t = setInterval(loadReport, 20_000); return () => clearInterval(t); }, [loadReport]);
  useEffect(() => { void loadConversions(); }, [loadConversions]);

  const computeAll = async () => {
    setBusy(true); setComputeMsg("");
    try {
      const r = await fetch("/api/nex/attribution/compute", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
      const d = await r.json() as { ok: boolean; processed?: number };
      setComputeMsg(d.ok ? `computed ${d.processed} pending conversions` : "compute failed");
      await Promise.all([loadReport(), loadConversions()]);
    } finally { setBusy(false); }
  };

  const bestByType = useMemo(() => {
    if (!report) return null;
    const winner = (list: ReportRow[]): ReportRow | null => list.length > 0 ? list[0] : null;
    return {
      campaign: winner(report.by_source_type.campaign),
      journey: winner(report.by_source_type.journey),
      experiment: winner(report.by_source_type.experiment),
      variant: winner(report.by_source_type.variant),
    };
  }, [report]);

  return (
    <div className="space-y-3">
      {/* Top KPIs */}
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <Kpi label="Revenue attributed" value={report ? `£${report.totals.attributed_value.toLocaleString()}` : "£0"} tone="good" hint={report ? `${report.model} · ${windowDays === "any" ? "all windows" : `${windowDays}d`}` : ""} />
        <Kpi label="Conversions" value={report?.totals.conversions ?? 0} tone="neutral" />
        <Kpi label="Contacts" value={report?.totals.contacts ?? 0} tone="neutral" />
        <Kpi label="Best campaign" value={bestByType?.campaign?.label ?? bestByType?.campaign?.key.slice(0, 8) ?? "—"} tone="neutral" hint={bestByType?.campaign ? `£${bestByType.campaign.attributed_value.toLocaleString()}` : ""} />
        <Kpi label="Best journey" value={bestByType?.journey?.label ?? bestByType?.journey?.key.slice(0, 8) ?? "—"} tone="neutral" hint={bestByType?.journey ? `£${bestByType.journey.attributed_value.toLocaleString()}` : ""} />
        <Kpi label="Best variant" value={bestByType?.variant?.key ?? "—"} tone="neutral" hint={bestByType?.variant ? `£${bestByType.variant.attributed_value.toLocaleString()}` : ""} />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 rounded-md border p-2" style={{ background: T.panelHi, borderColor: T.border }}>
        <span className="text-[10px] uppercase tracking-widest" style={{ color: T.textFade }}>Model</span>
        {(["first_touch","last_touch","linear"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setModel(m)}
            className="rounded-md border px-2 py-1 text-[10px] font-semibold"
            style={{ background: model === m ? T.info : T.panel, borderColor: model === m ? T.info : T.border, color: model === m ? T.panel : T.textDim }}>
            {MODEL_LABEL[m]}
          </button>
        ))}
        <span className="ml-3 text-[10px] uppercase tracking-widest" style={{ color: T.textFade }}>Window</span>
        {WINDOW_PRESETS.map((w) => (
          <button key={w} type="button" onClick={() => setWindowDays(w)}
            className="rounded-md border px-2 py-1 text-[10px]"
            style={{ background: windowDays === w ? T.info : T.panel, borderColor: windowDays === w ? T.info : T.border, color: windowDays === w ? T.panel : T.textDim }}>
            {w}d
          </button>
        ))}
        <button type="button" onClick={() => setWindowDays("any")}
          className="rounded-md border px-2 py-1 text-[10px]"
          style={{ background: windowDays === "any" ? T.info : T.panel, borderColor: windowDays === "any" ? T.info : T.border, color: windowDays === "any" ? T.panel : T.textDim }}>
          any
        </button>
        <button type="button" onClick={computeAll} disabled={busy}
          className="ml-auto rounded-md border px-3 py-1 text-[10px] font-semibold"
          style={{ background: T.accent, borderColor: T.accent, color: T.panel, opacity: busy ? 0.6 : 1 }}>
          {busy ? "Computing…" : "Compute pending"}
        </button>
        {computeMsg ? <span className="text-[9.5px]" style={{ color: T.accent }}>{computeMsg}</span> : null}
      </div>

      {/* Per-source drill-downs */}
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        {(["campaign","journey","experiment","variant","provider","country","domain"] as const).map((g) => (
          <SourceCard key={g} title={SOURCE_LABELS[g]} rows={report?.by_source_type[g] ?? []} />
        ))}
      </div>

      {/* Conversions feed */}
      <div className="rounded-md border" style={{ background: T.panelHi, borderColor: T.border }}>
        <div className="border-b p-2 text-[9px] font-black uppercase tracking-widest" style={{ borderColor: T.border, color: T.textFade }}>
          Recent conversions · {conversions.length}
        </div>
        <div className="max-h-[280px] overflow-auto">
          {conversions.length === 0 ? (
            <div className="p-3 text-[10.5px]" style={{ color: T.textFade }}>
              No conversions yet. POST to <code>/api/nex/attribution/conversions</code> with { `{contact_id, event_type, conversion_value, currency}` } to record one.
            </div>
          ) : conversions.map((c) => (
            <div key={c.conversion_id} className="grid items-baseline gap-2 border-b px-2 py-1.5 text-[10.5px]"
              style={{ borderColor: T.border, gridTemplateColumns: "140px 1fr 90px 100px" }}>
              <span className="font-mono" style={{ color: T.text }}>{c.event_type}</span>
              <span className="truncate font-mono text-[9.5px]" style={{ color: T.textFade }}>{c.contact_id.slice(0, 8)}…{c.external_ref ? ` · ref ${c.external_ref}` : ""}</span>
              <span className="font-mono" style={{ color: T.accent }}>£{c.conversion_value.toLocaleString()}</span>
              <span className="font-mono text-[9.5px]" style={{ color: T.textFade }}>{new Date(c.occurred_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-[9.5px] italic" style={{ color: T.textFade }}>
        Attribution is observational · invariant #14 · charter §13. Reports credit, never rewrites. Automatic optimisation lives in 5.4 Predictive.
      </div>
    </div>
  );
}

function SourceCard({ title, rows }: { title: string; rows: ReportRow[] }) {
  const total = rows.reduce((a, r) => a + r.attributed_value, 0);
  return (
    <div className="rounded-md border p-2" style={{ background: T.panelHi, borderColor: T.border }}>
      <div className="mb-1 flex items-baseline justify-between">
        <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>{title}</div>
        <span className="font-mono text-[9.5px]" style={{ color: T.textFade }}>{rows.length} · £{total.toLocaleString()}</span>
      </div>
      {rows.length === 0 ? (
        <div className="text-[10.5px]" style={{ color: T.textFade }}>—</div>
      ) : (
        <div className="space-y-0.5">
          {rows.slice(0, 8).map((r) => {
            const pct = total > 0 ? Math.round((r.attributed_value / total) * 100) : 0;
            return (
              <div key={r.key} className="grid items-baseline gap-2 text-[10px]" style={{ gridTemplateColumns: "1fr 70px 40px" }}>
                <div>
                  <div className="truncate" style={{ color: T.text }} title={r.label ?? r.key}>{r.label ?? r.key.slice(0, 20)}</div>
                  <div className="h-1 rounded-full" style={{ background: T.panel }}>
                    <div className="h-1 rounded-full" style={{ background: T.info, width: `${pct}%` }} />
                  </div>
                </div>
                <span className="font-mono text-right" style={{ color: T.text }}>£{r.attributed_value.toLocaleString()}</span>
                <span className="font-mono text-right text-[9.5px]" style={{ color: T.textFade }}>{pct}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, tone = "neutral", hint }: { label: string; value: string | number; tone?: "neutral" | "good" | "warn" | "bad" | "unset"; hint?: string }) {
  const color = tone === "good" ? T.accent : tone === "warn" ? T.warning : tone === "bad" ? T.danger : tone === "unset" ? T.textFade : T.text;
  return (
    <div className="rounded-md border p-3" style={{ background: T.panelHi, borderColor: T.border }}>
      <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>{label}</div>
      <div className="mt-1 truncate font-mono text-[15px] font-black leading-none" style={{ color }}>{value}</div>
      {hint ? <div className="mt-1 text-[9.5px] truncate" style={{ color: T.textFade }} title={hint}>{hint}</div> : null}
    </div>
  );
}
