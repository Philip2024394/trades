// NEX Alerts Centre · HQ panel for the operational alerting layer.
//
// Composes /api/nex/alerts/* into a single admin surface.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Severity = "info" | "warning" | "critical";
type AlertState = "open" | "acknowledged" | "resolved";
type DispatchChannel = "email" | "webhook" | "slack";
type DispatchStatus = "sent" | "failed" | "skipped";

type Alert = {
  alert_id: string; rule_id: string; incident_id: string | null;
  severity: Severity; state: AlertState;
  title: string; detail: string | null;
  snapshot: Record<string, unknown>;
  first_detected_at: string; last_triggered_at: string; trigger_count: number;
  acknowledged_at: string | null; acknowledged_by: string | null;
  resolved_at: string | null; resolved_reason: string | null; resolved_by: string | null;
};

type Rule = {
  rule_id: string; name: string; category: string; severity: Severity;
  description: string | null; params: Record<string, number | string | boolean>;
  enabled: boolean; dedup_window_sec: number;
  notify_channels: DispatchChannel[]; root_cause_of: string[];
};

type Dispatch = {
  dispatch_id: string; alert_id: string; channel: DispatchChannel;
  destination: string | null; status: DispatchStatus;
  error: string | null; latency_ms: number | null;
  attempt_no: number; dispatched_at: string;
};

type Metrics = {
  ok: boolean;
  open: number; acknowledged: number; resolved_24h: number;
  mttd_ms: number | null; mtta_ms: number | null; mttr_ms: number | null;
  by_rule_last_7d: Array<{ rule_id: string; count: number; last_fired_at: string }>;
};

const T = {
  panel: "#12161c", panelHi: "#1a2028", border: "#232b36",
  text: "#e5e9ef", textDim: "#8892a0", textFade: "#5c6572",
  accent: "#4dd0a0", warning: "#f0b45a", danger: "#f0665a",
  info: "#5aa6f0", purple: "#b48cf0",
};

const SEV_TONE: Record<Severity, string>  = { info: T.info, warning: T.warning, critical: T.danger };
const STATE_TONE: Record<AlertState, string> = { open: T.danger, acknowledged: T.warning, resolved: T.accent };
const STATUS_TONE: Record<DispatchStatus, string> = { sent: T.accent, failed: T.danger, skipped: T.textFade };

export function AlertsCentrePanel() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDispatches, setSelectedDispatches] = useState<Dispatch[]>([]);
  const [filter, setFilter] = useState<AlertState | "all">("open");
  const [evaluating, setEvaluating] = useState(false);
  const [lastEval, setLastEval] = useState<string>("");

  const loadAll = useCallback(async () => {
    const [a, r, d, m] = await Promise.all([
      fetch(`/api/nex/alerts?state=${filter === "all" ? "" : filter}&limit=200`).then((x) => x.json()) as Promise<{ ok: boolean; alerts: Alert[] }>,
      fetch("/api/nex/alerts/rules").then((x) => x.json())      as Promise<{ ok: boolean; rules: Rule[] }>,
      fetch("/api/nex/alerts/dispatches?limit=50").then((x) => x.json()) as Promise<{ ok: boolean; dispatches: Dispatch[] }>,
      fetch("/api/nex/alerts/metrics").then((x) => x.json())    as Promise<Metrics>,
    ]);
    if (a.ok) setAlerts(a.alerts);
    if (r.ok) setRules(r.rules);
    if (d.ok) setDispatches(d.dispatches);
    if (m.ok) setMetrics(m);
  }, [filter]);

  useEffect(() => { void loadAll(); const t = setInterval(loadAll, 15_000); return () => clearInterval(t); }, [loadAll]);

  useEffect(() => {
    if (!selectedId) { setSelectedDispatches([]); return; }
    void fetch(`/api/nex/alerts/${selectedId}`).then((r) => r.json()).then((d: { ok: boolean; dispatches: Dispatch[] }) => { if (d.ok) setSelectedDispatches(d.dispatches); });
  }, [selectedId]);

  const runEvaluate = async () => {
    setEvaluating(true);
    try {
      const r = await fetch("/api/nex/alerts/evaluate", { method: "POST" });
      const data = await r.json() as { ran_rules: number; fired: number; new_alerts: number; auto_resolved: number; dispatched: number; dispatch_failed: number };
      setLastEval(`ran ${data.ran_rules} · fired ${data.fired} · new ${data.new_alerts} · auto-resolved ${data.auto_resolved} · dispatched ${data.dispatched} (${data.dispatch_failed} failed)`);
      await loadAll();
    } finally { setEvaluating(false); }
  };

  const acknowledge = async (alert: Alert) => {
    await fetch(`/api/nex/alerts/${alert.alert_id}/acknowledge`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ actor: "admin" }) });
    await loadAll();
  };
  const resolve = async (alert: Alert) => {
    const reason = prompt("Resolution reason (audit trail · required):");
    if (!reason || reason.trim().length < 3) { if (reason !== null) alert && console.warn("min 3 chars"); return; }
    const r = await fetch(`/api/nex/alerts/${alert.alert_id}/resolve`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ actor: "admin", reason: reason.trim() }) });
    const data = await r.json() as { ok: boolean; error?: string };
    if (!data.ok) { window.alert(`Failed: ${data.error}`); return; }
    await loadAll();
  };

  const toggleRule = async (rule: Rule) => {
    await fetch(`/api/nex/alerts/rules/${rule.rule_id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled: !rule.enabled }) });
    await loadAll();
  };

  const selected = useMemo(() => alerts.find((a) => a.alert_id === selectedId) ?? null, [alerts, selectedId]);
  const openIncidents = useMemo(() => {
    const groups = new Map<string, Alert[]>();
    for (const a of alerts) {
      if (a.state !== "open") continue;
      const k = a.incident_id ?? a.alert_id;
      const list = groups.get(k) ?? []; list.push(a); groups.set(k, list);
    }
    return Array.from(groups.entries()).filter(([, list]) => list.length > 1);
  }, [alerts]);

  return (
    <div className="space-y-3">
      {/* Ops metrics */}
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        <Kpi label="Open"           value={metrics?.open ?? 0}         tone={(metrics?.open ?? 0) > 0 ? "bad" : "neutral"} />
        <Kpi label="Acknowledged"   value={metrics?.acknowledged ?? 0} tone={(metrics?.acknowledged ?? 0) > 0 ? "warn" : "neutral"} />
        <Kpi label="Resolved · 24h" value={metrics?.resolved_24h ?? 0} tone={(metrics?.resolved_24h ?? 0) > 0 ? "good" : "unset"} />
        <Kpi label="MTTA · 30d"     value={fmtDuration(metrics?.mtta_ms)} tone="neutral" hint="mean time to acknowledge" />
        <Kpi label="MTTR · 30d"     value={fmtDuration(metrics?.mttr_ms)} tone="neutral" hint="mean time to resolve" />
        <Kpi label="Rules enabled"  value={`${rules.filter((r) => r.enabled).length}/${rules.length}`} tone="neutral" />
      </div>

      {/* Manual evaluate */}
      <div className="flex items-center gap-2 rounded-md border p-2" style={{ background: T.panelHi, borderColor: T.border }}>
        <span className="text-[10px] uppercase tracking-widest" style={{ color: T.textFade }}>Manual evaluation (dev)</span>
        <button type="button" onClick={runEvaluate} disabled={evaluating}
          className="rounded-md border px-3 py-1 text-[10px] font-semibold"
          style={{ background: T.accent, borderColor: T.accent, color: T.panel, opacity: evaluating ? 0.6 : 1 }}>
          {evaluating ? "Evaluating…" : "Run evaluation"}
        </button>
        {lastEval ? <span className="ml-2 text-[10px]" style={{ color: T.accent }}>{lastEval}</span> : null}
        <span className="ml-auto text-[9.5px] italic" style={{ color: T.textFade }}>
          Production: cron POSTs /api/nex/alerts/evaluate every 30-60 s.
        </span>
      </div>

      {/* Incidents (correlated groups) */}
      {openIncidents.length > 0 ? (
        <div className="rounded-md border p-2" style={{ background: T.panelHi, borderColor: T.border }}>
          <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.danger }}>Active incidents · {openIncidents.length}</div>
          {openIncidents.map(([incident_id, list]) => (
            <div key={incident_id} className="rounded-md border p-2 text-[10.5px] mb-1" style={{ background: T.panel, borderColor: T.danger }}>
              <div className="font-mono text-[9px]" style={{ color: T.textFade }}>incident {incident_id.slice(0, 8)} · {list.length} correlated alerts</div>
              <div className="mt-0.5" style={{ color: T.text }}>{list.map((a) => a.rule_id).join(" · ")}</div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Filter + alerts list */}
      <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="rounded-md border" style={{ background: T.panelHi, borderColor: T.border }}>
          <div className="flex items-center gap-2 border-b p-2" style={{ borderColor: T.border }}>
            <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Alerts · {alerts.length}</div>
            {(["open","acknowledged","resolved","all"] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)}
                className="rounded-md border px-2 py-0.5 text-[10px]"
                style={{
                  background: filter === f ? T.info : T.panel,
                  borderColor: filter === f ? T.info : T.border,
                  color: filter === f ? T.panel : T.textDim,
                }}>{f}</button>
            ))}
          </div>
          <div className="max-h-[440px] overflow-auto">
            {alerts.length === 0 ? (
              <div className="p-3 text-[10.5px]" style={{ color: T.textFade }}>No alerts in this filter.</div>
            ) : alerts.map((a) => {
              const on = a.alert_id === selectedId;
              return (
                <button key={a.alert_id} type="button" onClick={() => setSelectedId(a.alert_id)}
                  className="grid w-full items-baseline gap-1 border-b px-2 py-2 text-left text-[11px]"
                  style={{
                    borderColor: T.border,
                    background: on ? T.panel : "transparent",
                    borderLeft: on ? `3px solid ${SEV_TONE[a.severity]}` : "3px solid transparent",
                  }}>
                  <div className="flex items-center justify-between">
                    <span className="truncate font-semibold" style={{ color: T.text }}>{a.title}</span>
                    <span className="ml-2 rounded-full px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-widest"
                      style={{ background: `${SEV_TONE[a.severity]}20`, color: SEV_TONE[a.severity] }}>
                      {a.severity}
                    </span>
                  </div>
                  <div className="flex justify-between text-[9.5px]" style={{ color: T.textFade }}>
                    <span className="font-mono">{a.rule_id}</span>
                    <span style={{ color: STATE_TONE[a.state] }}>{a.state}</span>
                  </div>
                  <div className="text-[9.5px]" style={{ color: T.textDim }}>
                    triggers {a.trigger_count} · last {new Date(a.last_triggered_at).toLocaleString()}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail */}
        <div className="rounded-md border" style={{ background: T.panelHi, borderColor: T.border }}>
          {!selected ? (
            <div className="p-3 text-[11px]" style={{ color: T.textFade }}>Select an alert on the left.</div>
          ) : (
            <div className="p-3">
              <div className="mb-2 flex items-baseline justify-between">
                <div>
                  <div className="font-semibold" style={{ color: T.text }}>{selected.title}</div>
                  <div className="font-mono text-[9.5px]" style={{ color: T.textFade }}>{selected.rule_id}</div>
                </div>
                <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest"
                  style={{ background: `${SEV_TONE[selected.severity]}20`, color: SEV_TONE[selected.severity] }}>{selected.severity}</span>
              </div>

              <div className="mb-2 text-[10.5px]" style={{ color: T.textDim }}>{selected.detail ?? "—"}</div>

              <div className="mb-2 space-y-0.5 text-[10.5px]">
                <div><span style={{ color: T.textFade }}>state · </span><span style={{ color: STATE_TONE[selected.state] }}>{selected.state}</span></div>
                <div><span style={{ color: T.textFade }}>trigger count · </span><span className="font-mono" style={{ color: T.text }}>{selected.trigger_count}</span></div>
                <div><span style={{ color: T.textFade }}>first detected · </span><span className="font-mono" style={{ color: T.text }}>{new Date(selected.first_detected_at).toLocaleString()}</span></div>
                <div><span style={{ color: T.textFade }}>last triggered · </span><span className="font-mono" style={{ color: T.text }}>{new Date(selected.last_triggered_at).toLocaleString()}</span></div>
                {selected.acknowledged_at ? <div><span style={{ color: T.textFade }}>acknowledged · </span><span style={{ color: T.text }}>{selected.acknowledged_by} · {new Date(selected.acknowledged_at).toLocaleString()}</span></div> : null}
                {selected.resolved_at ? <div><span style={{ color: T.textFade }}>resolved · </span><span style={{ color: T.text }}>{selected.resolved_by} · {new Date(selected.resolved_at).toLocaleString()}</span><div className="text-[9.5px]" style={{ color: T.textFade }}>reason: {selected.resolved_reason ?? "—"}</div></div> : null}
                {selected.incident_id && selected.incident_id !== selected.alert_id ? (
                  <div><span style={{ color: T.textFade }}>incident · </span><span className="font-mono text-[9.5px]" style={{ color: T.warning }}>{selected.incident_id}</span></div>
                ) : null}
              </div>

              <div className="mb-2 flex gap-1">
                <button type="button" onClick={() => acknowledge(selected)} disabled={selected.state !== "open"}
                  className="rounded-md border px-2 py-1 text-[10px]"
                  style={{ background: selected.state === "open" ? T.warning : T.panelHi, borderColor: selected.state === "open" ? T.warning : T.border, color: selected.state === "open" ? T.panel : T.textFade, opacity: selected.state === "open" ? 1 : 0.5 }}>
                  Acknowledge
                </button>
                <button type="button" onClick={() => resolve(selected)} disabled={selected.state === "resolved"}
                  className="rounded-md border px-2 py-1 text-[10px]"
                  style={{ background: selected.state === "resolved" ? T.panelHi : T.accent, borderColor: selected.state === "resolved" ? T.border : T.accent, color: selected.state === "resolved" ? T.textFade : T.panel, opacity: selected.state === "resolved" ? 0.5 : 1 }}>
                  Resolve
                </button>
              </div>

              <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Dispatch history · {selectedDispatches.length}</div>
              <div className="mt-1 max-h-[200px] overflow-auto">
                {selectedDispatches.length === 0 ? (
                  <div className="text-[10.5px]" style={{ color: T.textFade }}>No dispatch attempts.</div>
                ) : selectedDispatches.map((d) => (
                  <div key={d.dispatch_id} className="mb-1 rounded-md border p-1.5 text-[10px]" style={{ background: T.panel, borderColor: T.border }}>
                    <div className="flex justify-between">
                      <span style={{ color: T.text }}>{d.channel}</span>
                      <span style={{ color: STATUS_TONE[d.status] }}>{d.status}{d.latency_ms ? ` · ${d.latency_ms}ms` : ""}</span>
                    </div>
                    {d.destination ? <div className="text-[9.5px]" style={{ color: T.textFade }}>→ {d.destination}</div> : null}
                    {d.error ? <div className="text-[9.5px] font-mono" style={{ color: T.danger }}>{d.error}</div> : null}
                    <div className="text-[9px]" style={{ color: T.textFade }}>{new Date(d.dispatched_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rules config */}
      <div className="rounded-md border" style={{ background: T.panelHi, borderColor: T.border }}>
        <div className="border-b p-2 text-[9px] font-black uppercase tracking-widest" style={{ borderColor: T.border, color: T.textFade }}>Rule catalogue · {rules.length}</div>
        <div className="max-h-[280px] overflow-auto">
          {rules.map((r) => (
            <div key={r.rule_id}
              className="grid items-center gap-2 border-b px-2 py-2 text-[10.5px]"
              style={{ borderColor: T.border, gridTemplateColumns: "auto 1fr 90px 80px 60px 100px 60px" }}>
              <input type="checkbox" checked={r.enabled} onChange={() => toggleRule(r)} />
              <div>
                <div className="font-semibold" style={{ color: T.text }}>{r.name}</div>
                <div className="font-mono text-[9.5px]" style={{ color: T.textFade }}>{r.rule_id}</div>
              </div>
              <span className="font-mono text-[9.5px]" style={{ color: T.textFade }}>{r.category}</span>
              <span className="rounded-full px-1.5 py-0.5 text-center text-[9px] font-black uppercase tracking-widest" style={{ background: `${SEV_TONE[r.severity]}20`, color: SEV_TONE[r.severity] }}>{r.severity}</span>
              <span className="font-mono text-[9.5px]" style={{ color: T.textFade }}>dedup {r.dedup_window_sec}s</span>
              <span className="font-mono text-[9.5px]" style={{ color: T.textDim }}>{r.notify_channels.join(",")}</span>
              <span className="font-mono text-[9.5px]" style={{ color: r.enabled ? T.accent : T.textFade }}>{r.enabled ? "on" : "off"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent dispatches */}
      <div className="rounded-md border" style={{ background: T.panelHi, borderColor: T.border }}>
        <div className="border-b p-2 text-[9px] font-black uppercase tracking-widest" style={{ borderColor: T.border, color: T.textFade }}>Recent dispatches · {dispatches.length}</div>
        <div className="max-h-[220px] overflow-auto">
          {dispatches.length === 0 ? (
            <div className="p-3 text-[10.5px]" style={{ color: T.textFade }}>No dispatches yet · set NEX_ALERTS_EMAIL_TO / NEX_ALERTS_WEBHOOK_URL / NEX_ALERTS_SLACK_WEBHOOK_URL to activate a channel.</div>
          ) : dispatches.map((d) => (
            <div key={d.dispatch_id} className="grid items-center gap-2 border-b px-2 py-1 text-[10px]" style={{ borderColor: T.border, gridTemplateColumns: "70px 70px 1fr 90px 100px" }}>
              <span style={{ color: T.text }}>{d.channel}</span>
              <span style={{ color: STATUS_TONE[d.status] }}>{d.status}</span>
              <span className="truncate font-mono text-[9.5px]" style={{ color: T.textFade }} title={d.error ?? d.destination ?? ""}>{d.error ?? d.destination ?? "—"}</span>
              <span className="font-mono text-[9.5px]" style={{ color: T.textFade }}>{d.latency_ms ? `${d.latency_ms}ms` : "—"}</span>
              <span className="font-mono text-[9.5px]" style={{ color: T.textFade }}>{new Date(d.dispatched_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-[9.5px] italic" style={{ color: T.textFade }}>
        Dispatchers deliver already-evaluated alerts · they contain no evaluation logic. Alert rules run against a single platform snapshot per tick. Every dispatch attempt (sent · failed · skipped) is immutably audited.
      </div>
    </div>
  );
}

function Kpi({ label, value, tone = "neutral", hint }: { label: string; value: string | number; tone?: "neutral" | "good" | "warn" | "bad" | "unset"; hint?: string }) {
  const color = tone === "good" ? T.accent : tone === "warn" ? T.warning : tone === "bad" ? T.danger : tone === "unset" ? T.textFade : T.text;
  return (
    <div className="rounded-md border p-3" style={{ background: T.panelHi, borderColor: T.border }}>
      <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>{label}</div>
      <div className="mt-1 font-mono text-[16px] font-black leading-none" style={{ color }}>{value}</div>
      {hint ? <div className="mt-1 text-[9.5px] truncate" style={{ color: T.textFade }} title={hint}>{hint}</div> : null}
    </div>
  );
}

function fmtDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms === 0) return "—";
  if (ms < 1000)   return `${ms}ms`;
  if (ms < 60000)  return `${Math.round(ms / 1000)}s`;
  if (ms < 3.6e6)  return `${Math.round(ms / 60000)}m`;
  return `${(ms / 3.6e6).toFixed(1)}h`;
}
