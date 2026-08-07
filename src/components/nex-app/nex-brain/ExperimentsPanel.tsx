// NEX A/B Testing · Communications Centre panel · Phase 5.2
//
// Focused MVP:
//   · list experiments with status pill
//   · view variants + per-variant conversion stats
//   · activate/pause/end
//   · create draft experiment (form)
//
// Journey integration lives in the Journey Designer via the new
// `experiment` node type (add via Designer palette in a follow-up).

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Status = "draft" | "active" | "paused" | "ended";
type Experiment = {
  experiment_id: string; slug: string; name: string; description: string | null;
  version: number; status: Status; scope_type: string; scope_ref: string | null;
  goal_event_type: string; goal_within_seconds: number; seed: number;
  activated_at: string | null; created_at: string;
};
type Variant = { experiment_id: string; variant_id: string; name: string | null; allocation_pct: number; target_node_id: string | null; target_campaign_id: string | null };
type VariantStats = {
  variant_id: string; name: string | null; allocation_pct: number;
  assigned_contacts: number; sent: number; delivered: number; opens: number; clicks: number; goal_hits: number;
  conversion_rate: number | null; delivery_rate: number | null; open_rate: number | null; click_rate: number | null;
};
type StatsResponse = { ok: boolean; goal_event_type: string; window_seconds: number; variants: VariantStats[] };

const T = {
  panel: "#12161c", panelHi: "#1a2028", border: "#232b36",
  text: "#e5e9ef", textDim: "#8892a0", textFade: "#5c6572",
  accent: "#4dd0a0", warning: "#f0b45a", danger: "#f0665a", info: "#5aa6f0", purple: "#b48cf0",
};
const STATUS_TONE: Record<Status, string> = { draft: T.textDim, active: T.accent, paused: T.warning, ended: T.textFade };
const inputStyle: React.CSSProperties = { background: T.panel, borderColor: T.border, color: T.text };

export function ExperimentsPanel() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/nex/experiments").then((x) => x.json()) as { ok: boolean; experiments: Experiment[] };
    if (r.ok) setExperiments(r.experiments);
  }, []);
  useEffect(() => { void load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, [load]);

  useEffect(() => {
    if (!selectedId) { setVariants([]); setStats(null); return; }
    void fetch(`/api/nex/experiments/${selectedId}`).then((r) => r.json()).then((d: { ok: boolean; variants: Variant[] }) => { if (d.ok) setVariants(d.variants); });
    void fetch(`/api/nex/experiments/${selectedId}/stats`).then((r) => r.json()).then((d: StatsResponse) => { if (d.ok) setStats(d); });
  }, [selectedId]);

  const selected = useMemo(() => experiments.find((e) => e.experiment_id === selectedId) ?? null, [experiments, selectedId]);

  const changeStatus = async (exp: Experiment, to: "active" | "paused" | "ended") => {
    const r = await fetch(`/api/nex/experiments/${exp.experiment_id}/status`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to }) });
    const d = await r.json() as { ok: boolean; error?: string };
    if (!d.ok) window.alert(`Failed: ${d.error}`);
    await load();
    // Refresh stats
    if (selectedId === exp.experiment_id) void fetch(`/api/nex/experiments/${exp.experiment_id}/stats`).then((rr) => rr.json()).then((s: StatsResponse) => { if (s.ok) setStats(s); });
  };

  return (
    <div className="space-y-3">
      {/* Overview */}
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        <Kpi label="Experiments" value={experiments.length} tone="neutral" />
        <Kpi label="Active"      value={experiments.filter((e) => e.status === "active").length} tone={experiments.filter((e) => e.status === "active").length > 0 ? "good" : "unset"} />
        <Kpi label="Paused"      value={experiments.filter((e) => e.status === "paused").length} tone="warn" />
        <Kpi label="Ended"       value={experiments.filter((e) => e.status === "ended").length}  tone="neutral" />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 rounded-md border p-2" style={{ background: T.panelHi, borderColor: T.border }}>
        <button type="button" onClick={() => setShowCreate((s) => !s)}
          className="rounded-md border px-3 py-1 text-[10px] font-semibold"
          style={{ background: T.info, borderColor: T.info, color: T.panel }}>
          {showCreate ? "Cancel" : "+ New experiment"}
        </button>
        <span className="ml-auto text-[9.5px] italic" style={{ color: T.textFade }}>
          Sticky deterministic assignment · invariant #13 · charter §12
        </span>
      </div>

      {showCreate ? <CreateExperimentForm onCreated={() => { void load(); setShowCreate(false); }} /> : null}

      {/* Split-pane */}
      <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1.4fr" }}>
        <div className="rounded-md border" style={{ background: T.panelHi, borderColor: T.border }}>
          <div className="border-b p-2 text-[9px] font-black uppercase tracking-widest" style={{ borderColor: T.border, color: T.textFade }}>
            All versions · {experiments.length}
          </div>
          <div className="max-h-[440px] overflow-auto">
            {experiments.length === 0 ? (
              <div className="p-3 text-[10.5px]" style={{ color: T.textFade }}>No experiments yet.</div>
            ) : experiments.map((e) => {
              const on = e.experiment_id === selectedId;
              return (
                <button key={e.experiment_id} type="button" onClick={() => setSelectedId(e.experiment_id)}
                  className="grid w-full items-baseline gap-1 border-b px-2 py-2 text-left text-[11px]"
                  style={{
                    borderColor: T.border,
                    background: on ? T.panel : "transparent",
                    borderLeft: on ? `3px solid ${STATUS_TONE[e.status]}` : "3px solid transparent",
                  }}>
                  <div className="flex items-center justify-between">
                    <span className="truncate font-semibold" style={{ color: T.text }}>{e.name}</span>
                    <span className="ml-2 rounded-full px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-widest"
                      style={{ background: `${STATUS_TONE[e.status]}20`, color: STATUS_TONE[e.status] }}>
                      {e.status}
                    </span>
                  </div>
                  <div className="flex justify-between text-[9.5px]" style={{ color: T.textFade }}>
                    <span className="font-mono">{e.slug} · v{e.version}</span>
                    <span>goal: {e.goal_event_type}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail */}
        <div className="rounded-md border" style={{ background: T.panelHi, borderColor: T.border }}>
          {!selected ? (
            <div className="p-3 text-[11px]" style={{ color: T.textFade }}>Select an experiment on the left.</div>
          ) : (
            <div className="p-3">
              <div className="mb-2 flex items-baseline justify-between">
                <div>
                  <div className="font-semibold" style={{ color: T.text }}>{selected.name}</div>
                  <div className="font-mono text-[9.5px]" style={{ color: T.textFade }}>{selected.slug} · v{selected.version} · seed {selected.seed}</div>
                </div>
                <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest"
                  style={{ background: `${STATUS_TONE[selected.status]}20`, color: STATUS_TONE[selected.status] }}>{selected.status}</span>
              </div>

              <div className="mb-2 text-[10.5px]" style={{ color: T.textDim }}>{selected.description ?? "—"}</div>

              <div className="mb-2 flex flex-wrap gap-1">
                {selected.status === "draft" || selected.status === "paused" ? (
                  <button type="button" onClick={() => changeStatus(selected, "active")}
                    className="rounded-md border px-2 py-1 text-[10px]" style={{ background: T.accent, borderColor: T.accent, color: T.panel }}>Activate</button>
                ) : null}
                {selected.status === "active" ? (
                  <button type="button" onClick={() => changeStatus(selected, "paused")}
                    className="rounded-md border px-2 py-1 text-[10px]" style={{ background: T.warning, borderColor: T.warning, color: T.panel }}>Pause</button>
                ) : null}
                {selected.status !== "ended" ? (
                  <button type="button" onClick={() => changeStatus(selected, "ended")}
                    className="rounded-md border px-2 py-1 text-[10px]" style={{ background: T.panel, borderColor: T.border, color: T.danger }}>End experiment</button>
                ) : null}
              </div>

              <div className="mb-2 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>
                Variants · goal={selected.goal_event_type} · window={Math.round(selected.goal_within_seconds / 3600)}h
              </div>
              {stats && stats.variants.length > 0 ? (
                <div className="space-y-1">
                  {stats.variants.map((v) => {
                    const winner = stats.variants.every((other) => (other.conversion_rate ?? 0) <= (v.conversion_rate ?? 0)) && (v.conversion_rate ?? 0) > 0 && stats.variants.length > 1;
                    return (
                      <div key={v.variant_id} className="rounded-md border p-2" style={{ background: T.panel, borderColor: winner ? T.accent : T.border }}>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="font-mono font-semibold" style={{ color: T.text }}>
                            variant {v.variant_id}{v.name ? ` · ${v.name}` : ""}
                          </span>
                          {winner ? <span className="rounded-full px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-widest" style={{ background: `${T.accent}20`, color: T.accent }}>leading · not yet declared</span> : null}
                          <span className="font-mono text-[9.5px]" style={{ color: T.textFade }}>allocation {v.allocation_pct}%</span>
                        </div>
                        <div className="grid gap-1 text-[10px]" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
                          <SubStat label="Assigned"   value={v.assigned_contacts.toLocaleString()} />
                          <SubStat label="Sent"       value={v.sent.toLocaleString()} />
                          <SubStat label="Delivered"  value={v.delivered.toLocaleString()} hint={v.delivery_rate !== null ? `${v.delivery_rate}%` : undefined} />
                          <SubStat label="Opened"     value={v.opens.toLocaleString()} hint={v.open_rate !== null ? `${v.open_rate}%` : undefined} tone={v.opens > 0 ? "good" : "neutral"} />
                          <SubStat label="Clicked"    value={v.clicks.toLocaleString()} hint={v.click_rate !== null ? `${v.click_rate}%` : undefined} tone={v.clicks > 0 ? "good" : "neutral"} />
                        </div>
                        <div className="mt-1 grid gap-1 text-[10px]" style={{ gridTemplateColumns: "1fr 1fr" }}>
                          <SubStat label={`Goal · ${selected.goal_event_type}`} value={v.goal_hits.toLocaleString()} tone={v.goal_hits > 0 ? "good" : "neutral"} />
                          <SubStat label="Conversion" value={v.conversion_rate !== null ? `${v.conversion_rate}%` : "—"} tone={winner ? "good" : "neutral"} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-md border p-2 text-[10.5px]" style={{ background: T.panel, borderColor: T.border, color: T.textFade }}>
                  Variants list · {variants.length} configured · run this experiment to populate stats.
                </div>
              )}

              <div className="mt-2 text-[9px] italic" style={{ color: T.textFade }}>
                A/B Testing does not auto-choose the winner · that belongs to 5.4 Predictive. This UI reports · you decide.
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="text-[9.5px] italic" style={{ color: T.textFade }}>
        Add an <span className="font-mono">experiment</span> node in the Journey Designer to route contacts through variants · deterministic sticky assignment (invariant #13) · experiment_id + variant_id propagate to every analytics event downstream.
      </div>
    </div>
  );
}

function CreateExperimentForm({ onCreated }: { onCreated: () => void }) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [goal, setGoal] = useState<"queued"|"delivered"|"opened"|"clicked"|"bounced"|"complaint"|"unsubscribed">("clicked");
  const [windowH, setWindowH] = useState(168);
  const [scope, setScope] = useState<"journey_node"|"campaign">("journey_node");
  const [variants, setVariants] = useState<Array<{ variant_id: string; name: string; allocation_pct: number; target_node_id: string }>>([
    { variant_id: "A", name: "Control",   allocation_pct: 50, target_node_id: "" },
    { variant_id: "B", name: "Treatment", allocation_pct: 50, target_node_id: "" },
  ]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const setVariant = (i: number, patch: Partial<typeof variants[number]>) => setVariants((cur) => cur.map((v, j) => j === i ? { ...v, ...patch } : v));
  const addVariant = () => setVariants((cur) => [...cur, { variant_id: String.fromCharCode(65 + cur.length), name: "", allocation_pct: 0, target_node_id: "" }]);
  const removeVariant = (i: number) => setVariants((cur) => cur.filter((_, j) => j !== i));

  const totalPct = variants.reduce((a, v) => a + Number(v.allocation_pct), 0);

  const submit = async () => {
    setErr(null); setBusy(true);
    try {
      const body = {
        slug: slug.trim(), name: name.trim(), scope_type: scope,
        goal_event_type: goal, goal_within_seconds: windowH * 3600,
        variants: variants.map((v) => ({ variant_id: v.variant_id.trim(), name: v.name.trim() || null, allocation_pct: Number(v.allocation_pct), target_node_id: v.target_node_id.trim() || null })),
      };
      const r = await fetch("/api/nex/experiments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json() as { ok: boolean; error?: string };
      if (!d.ok) { setErr(d.error ?? "create_failed"); return; }
      onCreated();
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-md border p-3" style={{ background: T.panelHi, borderColor: T.border }}>
      <div className="mb-2 text-[10px] font-black uppercase tracking-widest" style={{ color: T.info }}>New experiment</div>
      <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr 140px 100px" }}>
        <label className="block"><div className="text-[9px] uppercase tracking-widest" style={{ color: T.textFade }}>Slug</div><input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="welcome-ab-1" className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle} /></label>
        <label className="block"><div className="text-[9px] uppercase tracking-widest" style={{ color: T.textFade }}>Name</div><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Welcome A/B" className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle} /></label>
        <label className="block"><div className="text-[9px] uppercase tracking-widest" style={{ color: T.textFade }}>Goal event</div>
          <select value={goal} onChange={(e) => setGoal(e.target.value as typeof goal)} className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle}>
            {(["queued","delivered","opened","clicked","bounced","complaint","unsubscribed"] as const).map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <label className="block"><div className="text-[9px] uppercase tracking-widest" style={{ color: T.textFade }}>Window (h)</div><input type="number" min={1} value={windowH} onChange={(e) => setWindowH(Number(e.target.value))} className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle} /></label>
      </div>
      <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: "1fr 3fr" }}>
        <label className="block"><div className="text-[9px] uppercase tracking-widest" style={{ color: T.textFade }}>Scope</div>
          <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className="w-full rounded-md border px-2 py-1 text-[11px]" style={inputStyle}>
            <option value="journey_node">journey_node</option>
            <option value="campaign">campaign</option>
          </select>
        </label>
        <div className="text-[9.5px]" style={{ color: T.textFade }}>
          MVP: `journey_node` scope · variants route to a journey node id · set target_node_ids to match your Journey Designer node ids · then add an <code>experiment</code> node in the Designer pointing at this experiment.
        </div>
      </div>

      <div className="mt-3 mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Variants · total allocation {totalPct}% (must equal 100)</div>
      <div className="space-y-1">
        {variants.map((v, i) => (
          <div key={i} className="grid items-center gap-1" style={{ gridTemplateColumns: "60px 1fr 90px 1fr auto" }}>
            <input value={v.variant_id} onChange={(e) => setVariant(i, { variant_id: e.target.value })} placeholder="A" className="rounded-md border px-2 py-1 font-mono text-[11px]" style={inputStyle} />
            <input value={v.name} onChange={(e) => setVariant(i, { name: e.target.value })} placeholder="Control · Treatment · …" className="rounded-md border px-2 py-1 text-[11px]" style={inputStyle} />
            <input type="number" min={0} max={100} value={v.allocation_pct} onChange={(e) => setVariant(i, { allocation_pct: Number(e.target.value) })} className="rounded-md border px-2 py-1 text-[11px]" style={inputStyle} />
            <input value={v.target_node_id} onChange={(e) => setVariant(i, { target_node_id: e.target.value })} placeholder="target_node_id (e.g. sendA)" className="rounded-md border px-2 py-1 font-mono text-[10.5px]" style={inputStyle} />
            <button type="button" onClick={() => removeVariant(i)} className="rounded-md border px-2 py-1 text-[10px]" style={{ background: T.panel, borderColor: T.border, color: T.danger }}>✕</button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={addVariant} className="rounded-md border px-2 py-1 text-[10px]" style={{ background: T.panel, borderColor: T.border, color: T.info }}>+ Add variant</button>
        <button type="button" onClick={submit} disabled={busy || !slug.trim() || !name.trim() || Math.abs(totalPct - 100) > 0.01} className="rounded-md border px-3 py-1 text-[10px] font-semibold" style={{ background: T.accent, borderColor: T.accent, color: T.panel, opacity: (busy || !slug.trim() || !name.trim() || Math.abs(totalPct - 100) > 0.01) ? 0.6 : 1 }}>
          {busy ? "Creating…" : "Create draft"}
        </button>
      </div>
      {err ? <div className="mt-1 text-[10px]" style={{ color: T.danger }}>{err}</div> : null}
    </div>
  );
}

function Kpi({ label, value, tone = "neutral", hint }: { label: string; value: string | number; tone?: "neutral" | "good" | "warn" | "bad" | "unset"; hint?: string }) {
  const color = tone === "good" ? T.accent : tone === "warn" ? T.warning : tone === "bad" ? T.danger : tone === "unset" ? T.textFade : T.text;
  return (
    <div className="rounded-md border p-3" style={{ background: T.panelHi, borderColor: T.border }}>
      <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>{label}</div>
      <div className="mt-1 font-mono text-[16px] font-black leading-none" style={{ color }}>{value}</div>
      {hint ? <div className="mt-1 text-[9.5px]" style={{ color: T.textFade }}>{hint}</div> : null}
    </div>
  );
}
function SubStat({ label, value, hint, tone = "neutral" }: { label: string; value: string; hint?: string; tone?: "good" | "warn" | "neutral" }) {
  const color = tone === "good" ? T.accent : tone === "warn" ? T.warning : T.text;
  return (
    <div className="rounded-md border p-1.5" style={{ background: T.panelHi, borderColor: T.border }}>
      <div className="text-[8.5px] uppercase tracking-widest" style={{ color: T.textFade }}>{label}</div>
      <div className="font-mono text-[11.5px]" style={{ color }}>{value}</div>
      {hint ? <div className="text-[8.5px]" style={{ color: T.textFade }}>{hint}</div> : null}
    </div>
  );
}
