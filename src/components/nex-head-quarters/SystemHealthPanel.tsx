// NEX System Health · HQ at-a-glance panel
//
// When something goes wrong in production, this is the FIRST place an
// administrator looks (Philip 2026-08-08 doctrine · production
// hardening · Phase 4f). Composes /api/nex/system/health · refreshes
// every 15 s · never fabricates a signal.

"use client";

import { useCallback, useEffect, useState } from "react";

type OverallStatus = "healthy" | "degraded" | "down";
type HealthResponse = {
  ok: boolean;
  overall: OverallStatus;
  reasons: string[];
  checked_at: string;
  provider: {
    active: { id: string; label: string };
    mode: "simulation" | "runtime";
    registered: Array<{ id: string; label: string }>;
  };
  queue: {
    by_status: Record<string, number>;
    pending: number; running: number; dead_letter: number;
    oldest_pending_age_seconds: number;
  };
  workers: { registered: number; alive: number; last_heartbeat: string | null };
  activity: {
    last_successful_send: { at: string; campaign_id: string | null; job_type: string } | null;
    last_ingest: { at: string; event_type: string; provider: string; synthetic: boolean } | null;
    throughput_last_hour: number;
  };
  suppression: { total: number; never_contact: number; unsubscribed: number };
  limiter: { config: { global_per_sec: number; provider_per_sec: number; domain_per_sec: number; burst_multiplier: number }; buckets: Array<{ key: string; tokens: number; per_sec: number }> };
};

const T = {
  panel: "#12161c", panelHi: "#1a2028", border: "#232b36",
  text: "#e5e9ef", textDim: "#8892a0", textFade: "#5c6572",
  accent: "#4dd0a0", warning: "#f0b45a", danger: "#f0665a",
  info: "#5aa6f0", purple: "#b48cf0",
};

const STATUS_TONE: Record<OverallStatus, { bg: string; fg: string; label: string }> = {
  healthy:  { bg: T.accent,  fg: T.panel, label: "HEALTHY"  },
  degraded: { bg: T.warning, fg: T.panel, label: "DEGRADED" },
  down:     { bg: T.danger,  fg: T.panel, label: "DOWN"     },
};

export function SystemHealthPanel() {
  const [h, setH] = useState<HealthResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    setChecking(true);
    try {
      const r = await fetch("/api/nex/system/health", { cache: "no-store" });
      const data = await r.json() as HealthResponse;
      if (data.ok) { setH(data); setErr(null); }
      else setErr("health endpoint returned not-ok");
    } catch (e) { setErr(e instanceof Error ? e.message : "fetch_failed"); }
    finally { setChecking(false); }
  }, []);

  useEffect(() => { void load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, [load]);

  if (!h) {
    return (
      <div className="rounded-xl border p-3 text-[11px]" style={{ background: T.panel, borderColor: T.border, color: T.textFade }}>
        {err ? `System Health · error: ${err}` : "Loading system health…"}
      </div>
    );
  }

  const tone = STATUS_TONE[h.overall];
  return (
    <div className="rounded-xl border p-3" style={{ background: T.panel, borderColor: T.border }}>
      {/* Header · overall status pill + reasons + checked time */}
      <div className="mb-3 flex items-center gap-3">
        <span className="rounded-md px-3 py-1 text-[11px] font-black uppercase tracking-widest"
          style={{ background: tone.bg, color: tone.fg }}>
          {tone.label}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: T.accent }}>System Health · Communications Platform</div>
          <div className="mt-0.5 truncate text-[11px]" style={{ color: h.reasons.length > 0 ? T.warning : T.textDim }} title={h.reasons.join(" · ")}>
            {h.reasons.length === 0 ? "All signals within tolerance." : h.reasons.join(" · ")}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-widest" style={{ color: T.textFade }}>Last check</div>
          <div className="font-mono text-[10.5px]" style={{ color: T.text }}>{new Date(h.checked_at).toLocaleTimeString()}</div>
          <button type="button" onClick={load} disabled={checking}
            className="mt-1 rounded-md border px-2 py-0.5 text-[9.5px]"
            style={{ background: T.panelHi, borderColor: T.border, color: T.textDim }}>
            {checking ? "Checking…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Signal grid · 10 tiles */}
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <Signal
          label="Active provider"
          value={h.provider.active.id}
          tone={h.provider.mode === "runtime" ? "good" : "warn"}
          hint={`${h.provider.registered.length} registered · mode: ${h.provider.mode}`}
        />
        <Signal
          label="Mode"
          value={h.provider.mode}
          tone={h.provider.mode === "runtime" ? "good" : "warn"}
          hint={h.provider.mode === "simulation" ? "no real sends · switch by env var" : "real delivery"}
        />
        <Signal
          label="Live workers"
          value={h.workers.alive}
          tone={h.workers.alive > 0 ? "good" : h.queue.pending > 0 ? "bad" : "neutral"}
          hint={`${h.workers.registered} registered · last heartbeat ${h.workers.last_heartbeat ? relTime(h.workers.last_heartbeat) : "—"}`}
        />
        <Signal
          label="Queue depth"
          value={h.queue.pending + h.queue.running}
          tone={h.queue.pending > 100 ? "warn" : h.queue.pending > 500 ? "bad" : "neutral"}
          hint={`${h.queue.pending} pending · ${h.queue.running} running`}
        />
        <Signal
          label="Oldest queued age"
          value={h.queue.oldest_pending_age_seconds > 0 ? prettyAge(h.queue.oldest_pending_age_seconds) : "—"}
          tone={h.queue.oldest_pending_age_seconds > 300 ? "bad" : h.queue.oldest_pending_age_seconds > 60 ? "warn" : "neutral"}
          hint="pending jobs whose scheduled_for is already past"
        />
        <Signal
          label="Dead letter"
          value={h.queue.dead_letter}
          tone={h.queue.dead_letter > 0 ? "bad" : "neutral"}
          hint="jobs past max_attempts"
        />
        <Signal
          label="Last successful send"
          value={h.activity.last_successful_send ? relTime(h.activity.last_successful_send.at) : "—"}
          tone={h.activity.last_successful_send ? "good" : "neutral"}
          hint={h.activity.last_successful_send ? h.activity.last_successful_send.job_type : "no sends yet"}
        />
        <Signal
          label="Last event ingested"
          value={h.activity.last_ingest ? relTime(h.activity.last_ingest.at) : "—"}
          tone={h.activity.last_ingest ? "good" : "neutral"}
          hint={h.activity.last_ingest ? `${h.activity.last_ingest.event_type} · ${h.activity.last_ingest.provider}${h.activity.last_ingest.synthetic ? " · synthetic" : " · webhook"}` : "no ingest yet"}
        />
        <Signal
          label="Suppression list"
          value={h.suppression.total.toLocaleString()}
          tone="neutral"
          hint={`${h.suppression.never_contact} never-contact · ${h.suppression.unsubscribed} unsubscribed`}
        />
        <Signal
          label="Rate limiter"
          value={`${h.limiter.config.global_per_sec}/${h.limiter.config.provider_per_sec}/${h.limiter.config.domain_per_sec}/s`}
          tone="neutral"
          hint={`global/provider/domain · ${h.limiter.buckets.length} active buckets`}
        />
      </div>
    </div>
  );
}

function Signal({ label, value, tone, hint }: { label: string; value: string | number; tone: "good" | "warn" | "bad" | "neutral"; hint?: string }) {
  const color = tone === "good" ? T.accent : tone === "warn" ? T.warning : tone === "bad" ? T.danger : T.text;
  return (
    <div className="rounded-md border p-2" style={{ background: T.panelHi, borderColor: T.border }}>
      <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>{label}</div>
      <div className="mt-1 truncate font-mono text-[14px] font-black leading-none" style={{ color }}>{value}</div>
      {hint ? <div className="mt-1 truncate text-[9.5px]" style={{ color: T.textFade }} title={hint}>{hint}</div> : null}
    </div>
  );
}

function relTime(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
function prettyAge(s: number): string {
  if (s < 60)    return `${s}s`;
  if (s < 3600)  return `${Math.round(s / 60)}m`;
  return `${(s / 3600).toFixed(1)}h`;
}
