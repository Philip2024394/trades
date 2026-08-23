// NEX Knowledge Control Centre
//
// The room where every KPE decision becomes visible + actionable.
//
// PANELS (top to bottom):
//   1. Knowledge Today · 10 counters
//   2. Six-Tier Distribution · horizontal bar per tier + % + count
//   3. Pending Human Decisions · one-click Approve / Reject
//   4. Recent Decisions Timeline · last 20 KPE routing decisions
//
// Client component · polls /api/nex/kpe/dashboard every 10s · zero prop drilling.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Counters = {
  received: number;
  skipped: number;
  rule_engine: number;
  no_ai: number;
  local_llm: number;
  frontier_llm: number;
  human_review: number;
  approved_today: number;
  rejected_today: number;
  pending: number;
  waiting_over_7d: number;
  avg_processing_seconds: number | null;
  ai_calls_saved: number;
  ai_call_reduction_pct: number;
  total_ai_cost_gbp: number;
};

type Distribution = { tier: string; count: number; pct: number };
type Pending = {
  chunk_id: string;
  document_title: string | null;
  classifier_label: string | null;
  classifier_confidence: number | null;
  age_hours: number;
  reason: string;
  chunk_excerpt: string;
};
type TierAlt = { tier: string; eligible: boolean; note: string };
type Recent = {
  chunk_id: string;
  tier: string;
  decided_at: string;
  provider_used: string | null;
  latency_ms: number | null;
  reason: string;
  cost_gbp: number;
  alternatives: TierAlt[];
  cheaper_route_available: boolean;
};

const T = {
  bg:       "#0b0d10",
  panel:    "#12161c",
  panelHi:  "#1a2028",
  border:   "#232b36",
  text:     "#e5e9ef",
  textDim:  "#8892a0",
  textFade: "#5c6572",
  accent:   "#4dd0a0",
  warning:  "#f0b45a",
  danger:   "#f0665a",
  info:     "#5aa6f0",
  purple:   "#9f7af0",
};

const TIER_COLOR: Record<string, string> = {
  skip:         T.textFade,
  rule_engine:  T.accent,
  no_ai:        T.info,
  local_llm:    T.purple,
  frontier_llm: T.warning,
  human_review: T.danger,
};

const TIER_LABEL: Record<string, string> = {
  skip:         "Skipped (duplicate)",
  rule_engine:  "Rule Engine",
  no_ai:        "Structured (no AI)",
  local_llm:    "Local LLM",
  frontier_llm: "Frontier LLM",
  human_review: "Human Review",
};

function Counter({ label, value, hint, tone = "neutral" }: { label: string; value: string | number; hint?: string; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const color = tone === "good" ? T.accent : tone === "warn" ? T.warning : tone === "bad" ? T.danger : T.text;
  return (
    <div className="rounded-lg border p-3" style={{ background: T.panel, borderColor: T.border }}>
      <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>{label}</div>
      <div className="mt-1 font-mono text-[22px] font-black leading-none" style={{ color }}>{value}</div>
      {hint ? <div className="mt-1 text-[9px]" style={{ color: T.textFade }}>{hint}</div> : null}
    </div>
  );
}

export default function KnowledgeControlCentre() {
  const [counters, setCounters] = useState<Counters | null>(null);
  const [distribution, setDistribution] = useState<Distribution[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/nex/kpe/dashboard", { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) { setError(j.error ?? "unknown"); return; }
      setCounters(j.counters);
      setDistribution(j.distribution);
      setPending(j.pending);
      setRecent(j.recent_decisions);
      setLastUpdatedAt(new Date(j.generated_at).toLocaleTimeString());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "fetch_failed");
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);

  const decide = useCallback(async (chunk_id: string, decision: "approve" | "reject") => {
    setBusy(chunk_id);
    try {
      const r = await fetch("/api/nex/kpe/human-queue", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chunk_id, decision, admin: "philip" }),
      });
      const j = await r.json();
      if (!j.ok) alert(`Decision failed: ${j.error ?? "unknown"}`);
      await load();
    } finally {
      setBusy(null);
    }
  }, [load]);

  const totalAll = useMemo(() => distribution.reduce((n, d) => n + d.count, 0), [distribution]);

  return (
    <div className="min-h-screen p-4" style={{ background: T.bg, color: T.text, fontFamily: "system-ui,-apple-system,Segoe UI,sans-serif" }}>
      {/* HEADER */}
      <div className="mb-4 flex items-baseline gap-3">
        <div>
          <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.accent }}>NEX Headquarters</div>
          <h1 className="mt-0.5 text-[22px] font-black leading-none">Knowledge Control Centre</h1>
          <div className="mt-1 text-[10.5px]" style={{ color: T.textDim }}>
            Every KPE decision · one place · human authority preserved where it matters
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[9px] uppercase tracking-widest" style={{ color: T.textFade }}>Last update</div>
          <div className="font-mono text-[11px]" style={{ color: T.text }}>{lastUpdatedAt || "—"}</div>
          {error ? <div className="mt-0.5 text-[10px]" style={{ color: T.danger }}>Error: {error}</div> : null}
        </div>
      </div>

      {/* KNOWLEDGE TODAY · 10 counters */}
      <div className="mb-4 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        {counters ? (
          <>
            <Counter label="Received today"    value={counters.received} hint="processing runs started" />
            <Counter label="Skipped"            value={counters.skipped} hint="duplicate documents" />
            <Counter label="Rule Engine"        value={counters.rule_engine} tone="good" hint="0 AI · deterministic" />
            <Counter label="Structured"         value={counters.no_ai} tone="good" hint="0 AI · pass-through" />
            <Counter label="Local LLM"          value={counters.local_llm} tone="neutral" hint="cheap AI tier" />
            <Counter label="Frontier LLM"       value={counters.frontier_llm} tone="warn" hint="paid AI tier" />
            <Counter label="Human Review"       value={counters.human_review} tone={counters.pending > 0 ? "bad" : "neutral"} hint={`${counters.pending} pending`} />
            <Counter label="Approved today"     value={counters.approved_today} tone="good" />
            <Counter label="Rejected today"     value={counters.rejected_today} tone="neutral" />
            <Counter label="AI-call reduction"  value={`${counters.ai_call_reduction_pct}%`} tone="good" hint={`${counters.ai_calls_saved} calls avoided`} />
            <Counter label="Real AI cost"       value={`£${counters.total_ai_cost_gbp.toFixed(4)}`} tone={counters.total_ai_cost_gbp > 0 ? "warn" : "good"} hint="cumulative · real provider spend" />
            <Counter label="Avg processing"     value={counters.avg_processing_seconds !== null ? `${counters.avg_processing_seconds}s` : "—"} />
            <Counter label="Waiting >7d"        value={counters.waiting_over_7d} tone={counters.waiting_over_7d > 0 ? "bad" : "neutral"} hint="escalation candidate" />
          </>
        ) : <div className="col-span-full text-[11px]" style={{ color: T.textFade }}>Loading counters…</div>}
      </div>

      {/* SIX-TIER DISTRIBUTION */}
      <div className="mb-4 rounded-lg border p-3" style={{ background: T.panel, borderColor: T.border }}>
        <div className="flex items-baseline gap-2">
          <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Six-Tier Routing Distribution</div>
          <div className="ml-auto text-[9px]" style={{ color: T.textFade }}>{totalAll} decisions total</div>
        </div>
        <div className="mt-2 space-y-1.5">
          {distribution.map((d) => (
            <div key={d.tier} className="grid items-center gap-2" style={{ gridTemplateColumns: "180px 1fr 60px 40px" }}>
              <div className="text-[11px]" style={{ color: T.text }}>{TIER_LABEL[d.tier] ?? d.tier}</div>
              <div className="h-3 rounded-sm" style={{ background: T.panelHi }}>
                <div className="h-full rounded-sm transition-all" style={{
                  width: `${Math.max(d.pct, d.count > 0 ? 1 : 0)}%`,
                  background: TIER_COLOR[d.tier] ?? T.text,
                }} />
              </div>
              <div className="text-right font-mono text-[10.5px]" style={{ color: T.textDim }}>{d.pct}%</div>
              <div className="text-right font-mono text-[10.5px]" style={{ color: T.text }}>{d.count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PENDING HUMAN DECISIONS */}
      <div className="mb-4 rounded-lg border p-3" style={{ background: T.panel, borderColor: T.border }}>
        <div className="flex items-baseline gap-2">
          <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Pending Human Decisions</div>
          <div className="ml-auto text-[9px]" style={{ color: T.textFade }}>{pending.length} in queue</div>
        </div>
        {pending.length === 0 ? (
          <div className="mt-2 text-[10.5px] italic" style={{ color: T.textFade }}>
            No pending decisions. All KPE-flagged chunks have been resolved.
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            {pending.map((p) => (
              <div key={p.chunk_id} className="rounded-md border p-2.5" style={{ background: T.panelHi, borderColor: T.border }}>
                <div className="flex items-baseline gap-2">
                  <div className="text-[11px] font-semibold" style={{ color: T.text }}>{p.document_title ?? "(untitled)"}</div>
                  <div className="text-[9px]" style={{ color: T.textFade }}>
                    label={p.classifier_label ?? "—"} · confidence={p.classifier_confidence ?? "—"} · age={p.age_hours}h
                  </div>
                  <div className="ml-auto flex gap-1.5">
                    <button
                      disabled={busy === p.chunk_id}
                      onClick={() => decide(p.chunk_id, "approve")}
                      className="rounded px-2.5 py-1 text-[10px] font-semibold"
                      style={{ background: T.accent, color: T.bg, opacity: busy === p.chunk_id ? 0.5 : 1 }}
                    >Approve</button>
                    <button
                      disabled={busy === p.chunk_id}
                      onClick={() => decide(p.chunk_id, "reject")}
                      className="rounded px-2.5 py-1 text-[10px] font-semibold"
                      style={{ background: T.danger, color: T.bg, opacity: busy === p.chunk_id ? 0.5 : 1 }}
                    >Reject</button>
                  </div>
                </div>
                <div className="mt-1 text-[10px] italic" style={{ color: T.textDim }}>Why flagged: {p.reason}</div>
                <div className="mt-1 rounded border p-2 font-mono text-[10px] whitespace-pre-wrap" style={{ background: T.bg, borderColor: T.border, color: T.text }}>
                  {p.chunk_excerpt}{p.chunk_excerpt.length >= 240 ? "…" : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RECENT DECISIONS TIMELINE */}
      <div className="rounded-lg border p-3" style={{ background: T.panel, borderColor: T.border }}>
        <div className="flex items-baseline gap-2">
          <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Recent Decisions</div>
          <div className="ml-auto text-[9px]" style={{ color: T.textFade }}>last 20</div>
        </div>
        {recent.length === 0 ? (
          <div className="mt-2 text-[10.5px] italic" style={{ color: T.textFade }}>No decisions yet.</div>
        ) : (
          <div className="mt-2 space-y-1">
            {recent.map((r) => (
              <div key={r.chunk_id} className="rounded-md border p-2" style={{
                background: T.panelHi,
                borderColor: r.cheaper_route_available ? T.warning : T.border,
              }}>
                <div className="flex items-baseline gap-2 text-[10.5px]">
                  <span className="font-mono" style={{ color: T.textFade }}>{new Date(r.decided_at).toLocaleTimeString()}</span>
                  <span className="font-semibold" style={{ color: TIER_COLOR[r.tier] ?? T.text }}>{TIER_LABEL[r.tier] ?? r.tier}</span>
                  {r.cheaper_route_available ? (
                    <span className="rounded-full px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-widest" style={{ background: `${T.warning}22`, color: T.warning }}>
                      cheaper route was available
                    </span>
                  ) : null}
                  <span className="ml-auto font-mono" style={{ color: T.textFade }}>chunk {r.chunk_id.slice(0, 8)}</span>
                </div>
                <div className="mt-0.5 text-[10px] italic" style={{ color: T.textDim }}>
                  Reason: {r.reason || "—"}
                </div>
                <div className="mt-0.5 flex gap-3 text-[9.5px]" style={{ color: T.textFade }}>
                  <span>provider: <span style={{ color: T.text }}>{r.provider_used ?? "—"}</span></span>
                  <span>cost: <span style={{ color: r.cost_gbp > 0 ? T.warning : T.accent }}>£{r.cost_gbp.toFixed(4)}</span></span>
                  <span>latency: <span style={{ color: T.text }}>{r.latency_ms !== null ? `${r.latency_ms}ms` : "—"}</span></span>
                </div>
                {r.alternatives.length > 0 ? (
                  <div className="mt-1 text-[9px]" style={{ color: T.textFade }}>
                    <span style={{ color: T.textDim }}>Alternatives:</span>{" "}
                    {r.alternatives.filter((a) => a.tier !== "skip").map((a, i) => (
                      <span key={a.tier}>
                        {i > 0 ? " · " : ""}
                        <span style={{ color: a.eligible ? T.accent : T.textFade }}>
                          {a.eligible ? "✓" : "✗"} {TIER_LABEL[a.tier]?.split(" ")[0] ?? a.tier}
                        </span>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 text-[9px] italic" style={{ color: T.textFade }}>
        Auto-refreshes every 10 seconds · backed by /api/nex/kpe/dashboard · reads from data/nex-kpe/
      </div>
    </div>
  );
}
