// NEX Delivery Engine · Mission Control section for the Communications
// Centre. Job queue by status · worker heartbeats · dead-letter list ·
// rate-limiter buckets · manual "Run tick" for dev.

"use client";

import { useCallback, useEffect, useState } from "react";

type Worker = { worker_id: string; hostname: string | null; started_at: string; last_seen_at: string; jobs_processed: number; jobs_failed: number; mode: "simulation" | "runtime"; seconds_since_seen: number; alive: boolean };
type DeadLetter = { job_id: string; job_type: string; campaign_id: string | null; last_error: string | null; updated_at: string };
type LimiterBucket = { key: string; tokens: number; per_sec: number };
type MetricsResponse = {
  ok: boolean;
  mode: "simulation" | "runtime";
  active_provider: { id: string; label: string };
  registered_providers: Array<{ id: string; label: string }>;
  limiter: { config: { global_per_sec: number; provider_per_sec: number; domain_per_sec: number; burst_multiplier: number }; buckets: LimiterBucket[] };
  by_status: Record<string, number>;
  workers: Worker[];
  dead_letter: DeadLetter[];
  throughput_last_hour: number;
  errors_last_hour: number;
  recent_by_type: Record<string, number>;
  next_scheduled_at: string | null;
};

const T = {
  panel: "#12161c", panelHi: "#1a2028", border: "#232b36",
  text: "#e5e9ef", textDim: "#8892a0", textFade: "#5c6572",
  accent: "#4dd0a0", warning: "#f0b45a", danger: "#f0665a",
  info: "#5aa6f0", purple: "#b48cf0",
};

const STATUS_TONE: Record<string, string> = {
  pending: T.textDim, running: T.info, completed: T.accent,
  failed: T.danger, cancelled: T.textFade, dead_letter: T.danger,
};

export function DeliveryEnginePanel() {
  const [m, setM] = useState<MetricsResponse | null>(null);
  const [ticking, setTicking] = useState(false);
  const [lastTick, setLastTick] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/nex/delivery/metrics", { cache: "no-store" });
      const data = await r.json() as MetricsResponse;
      if (data.ok) setM(data);
    } catch { /* swallow · surface via UI empty state */ }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);

  const runTick = async () => {
    setTicking(true);
    try {
      const r = await fetch("/api/nex/delivery/tick?max=10", { method: "POST" });
      const data = await r.json() as { ok: boolean; summary: { ticks_attempted: number; jobs_processed: number; successes: number; failures: number } };
      setLastTick(`${data.summary.jobs_processed} processed · ${data.summary.successes} ok · ${data.summary.failures} failed`);
      await load();
    } finally { setTicking(false); }
  };

  if (!m) {
    return <div className="rounded-md border p-3 text-[11px]" style={{ background: T.panelHi, borderColor: T.border, color: T.textFade }}>Loading delivery engine…</div>;
  }

  const totalJobs = Object.values(m.by_status).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-3">
      {/* Overview */}
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        <Metric label="Mode" value={m.mode} tone={m.mode === "simulation" ? "warn" : "good"} hint={m.active_provider.label} />
        <Metric label="Active provider" value={m.active_provider.id} tone="neutral" hint={`${m.registered_providers.length} registered`} />
        <Metric label="Jobs (all-time)" value={totalJobs} tone="neutral" hint={Object.entries(m.by_status).map(([k, v]) => `${k}:${v}`).join(" · ")} />
        <Metric label="Throughput · 1h" value={m.throughput_last_hour} tone={m.throughput_last_hour > 0 ? "good" : "unset"} hint="successful attempts in last hour" />
        <Metric label="Errors · 1h" value={m.errors_last_hour} tone={m.errors_last_hour > 0 ? "warn" : "neutral"} hint="transient + permanent attempts" />
        <Metric label="Dead letter" value={m.dead_letter.length} tone={m.dead_letter.length > 0 ? "bad" : "neutral"} />
        <Metric label="Live workers" value={m.workers.filter((w) => w.alive).length} tone={m.workers.filter((w) => w.alive).length > 0 ? "good" : "unset"} hint={`${m.workers.length} total registered`} />
        <Metric label="Next scheduled" value={m.next_scheduled_at ? new Date(m.next_scheduled_at).toLocaleString() : "—"} tone={m.next_scheduled_at ? "neutral" : "unset"} />
      </div>

      {/* Manual tick */}
      <div className="flex items-center gap-2 rounded-md border p-2" style={{ background: T.panelHi, borderColor: T.border }}>
        <span className="text-[10px] uppercase tracking-widest" style={{ color: T.textFade }}>Manual worker tick (dev)</span>
        <button type="button" onClick={runTick} disabled={ticking}
          className="rounded-md border px-3 py-1 text-[10px] font-semibold"
          style={{ background: T.accent, borderColor: T.accent, color: T.panel, opacity: ticking ? 0.6 : 1 }}>
          {ticking ? "Ticking…" : "Run tick"}
        </button>
        <button type="button" onClick={load}
          className="rounded-md border px-3 py-1 text-[10px]"
          style={{ background: T.panelHi, borderColor: T.border, color: T.textDim }}>
          Refresh
        </button>
        {lastTick ? <span className="ml-2 text-[10px]" style={{ color: T.accent }}>last tick: {lastTick}</span> : null}
        <span className="ml-auto text-[9.5px] italic" style={{ color: T.textFade }}>
          In production a cron POSTs /api/nex/delivery/tick every 15-30s.
        </span>
      </div>

      {/* Job status pills */}
      <div className="rounded-md border p-2" style={{ background: T.panelHi, borderColor: T.border }}>
        <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Job queue · by status</div>
        <div className="flex flex-wrap gap-1">
          {["pending","running","completed","failed","cancelled","dead_letter"].map((s) => (
            <span key={s} className="rounded-full border px-2 py-0.5 text-[10px]"
              style={{ background: T.panel, borderColor: T.border, color: STATUS_TONE[s] ?? T.textDim }}>
              {s} · <span style={{ color: T.text }}>{m.by_status[s] ?? 0}</span>
            </span>
          ))}
        </div>
        {Object.keys(m.recent_by_type).length > 0 ? (
          <div className="mt-2 text-[10px]" style={{ color: T.textFade }}>
            last 24 h by type · {Object.entries(m.recent_by_type).map(([k, v]) => `${k}(${v})`).join(" · ")}
          </div>
        ) : null}
      </div>

      {/* Workers */}
      <div className="rounded-md border p-2" style={{ background: T.panelHi, borderColor: T.border }}>
        <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Workers · {m.workers.length}</div>
        {m.workers.length === 0 ? (
          <div className="text-[10.5px]" style={{ color: T.textFade }}>No worker has ticked yet · press Run tick to register one.</div>
        ) : (
          <div className="space-y-1">
            {m.workers.map((w) => (
              <div key={w.worker_id}
                className="grid items-center gap-2 rounded-md border p-2 text-[10.5px]"
                style={{ background: T.panel, borderColor: T.border, gridTemplateColumns: "1fr 90px 90px 100px 120px" }}>
                <div>
                  <div className="font-mono" style={{ color: T.text }}>{w.worker_id}</div>
                  <div className="text-[9px]" style={{ color: T.textFade }}>{w.hostname ?? "—"} · started {new Date(w.started_at).toLocaleTimeString()}</div>
                </div>
                <div style={{ color: w.alive ? T.accent : T.textFade }}>{w.alive ? "● alive" : "○ stale"}</div>
                <div style={{ color: T.textDim }}>{w.mode}</div>
                <div className="font-mono" style={{ color: T.text }}>{w.jobs_processed}✓ · {w.jobs_failed}✗</div>
                <div className="font-mono text-[9.5px]" style={{ color: T.textFade }}>seen {w.seconds_since_seen}s ago</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rate limiter */}
      <div className="rounded-md border p-2" style={{ background: T.panelHi, borderColor: T.border }}>
        <div className="mb-1 flex items-baseline gap-2">
          <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Rate limiter · buckets</div>
          <span className="text-[9.5px]" style={{ color: T.textFade }}>
            global {m.limiter.config.global_per_sec}/s · provider {m.limiter.config.provider_per_sec}/s · domain {m.limiter.config.domain_per_sec}/s
          </span>
        </div>
        {m.limiter.buckets.length === 0 ? (
          <div className="text-[10.5px]" style={{ color: T.textFade }}>No sends yet · buckets are idle.</div>
        ) : (
          <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            {m.limiter.buckets.map((b) => (
              <div key={b.key} className="rounded-md border p-2" style={{ background: T.panel, borderColor: T.border }}>
                <div className="flex justify-between text-[10px]">
                  <span className="font-mono" style={{ color: T.text }}>{b.key}</span>
                  <span style={{ color: T.textFade }}>{b.per_sec}/s</span>
                </div>
                <div className="mt-1 h-1 rounded-full" style={{ background: T.panelHi }}>
                  <div className="h-1 rounded-full" style={{ background: T.info, width: `${Math.min(100, (b.tokens / (b.per_sec * m.limiter.config.burst_multiplier)) * 100)}%` }} />
                </div>
                <div className="mt-0.5 text-[9.5px] font-mono" style={{ color: T.textFade }}>{b.tokens} tokens</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dead letter */}
      <div className="rounded-md border p-2" style={{ background: T.panelHi, borderColor: T.border }}>
        <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>
          Dead letter · {m.dead_letter.length} · jobs that exceeded max attempts or hit a permanent failure
        </div>
        {m.dead_letter.length === 0 ? (
          <div className="text-[10.5px]" style={{ color: T.textFade }}>Empty · nothing has failed permanently.</div>
        ) : (
          <div className="space-y-1">
            {m.dead_letter.map((d) => (
              <div key={d.job_id} className="rounded-md border p-2 text-[10.5px]" style={{ background: T.panel, borderColor: T.border }}>
                <div className="flex justify-between">
                  <span style={{ color: T.text }}>{d.job_type}</span>
                  <span style={{ color: T.textFade }} className="font-mono text-[9.5px]">{new Date(d.updated_at).toLocaleString()}</span>
                </div>
                {d.last_error ? <div className="mt-0.5 font-mono text-[10px]" style={{ color: T.danger }}>{d.last_error.slice(0, 200)}</div> : null}
                {d.campaign_id ? <div className="mt-0.5 font-mono text-[9.5px]" style={{ color: T.textFade }}>campaign {d.campaign_id}</div> : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-[9.5px] italic" style={{ color: T.textFade }}>
        Simulation mode is ON by default · everything runs at production fidelity except the actual send. Switch by setting NEX_DELIVERY_PROVIDER once a real provider adapter (SMTP · SES · SendGrid · Mailgun · Postmark) is registered.
      </div>
    </div>
  );
}

function Metric({ label, value, tone = "neutral", hint }: { label: string; value: string | number; tone?: "neutral" | "good" | "warn" | "bad" | "unset"; hint?: string }) {
  const color = tone === "good" ? T.accent : tone === "warn" ? T.warning : tone === "bad" ? T.danger : tone === "unset" ? T.textFade : T.text;
  return (
    <div className="rounded-md border p-3" style={{ background: T.panelHi, borderColor: T.border }}>
      <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>{label}</div>
      <div className="mt-1 font-mono text-[16px] font-black leading-none" style={{ color }}>{value}</div>
      {hint ? <div className="mt-1 text-[9.5px] truncate" style={{ color: T.textFade }} title={hint}>{hint}</div> : null}
    </div>
  );
}
