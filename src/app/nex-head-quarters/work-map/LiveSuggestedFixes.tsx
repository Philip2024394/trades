// src/app/nex-head-quarters/work-map/LiveSuggestedFixes.tsx
//
// Founder-locked 2026-09-13 · founder-facing CAP recommendation surface.
//
// Rendered above the detailed capability cards on the Master Work &
// Architecture Map. Polls /api/nex/work-map every 15s.
//
// Structure:
//   1. NEX CAP STATUS · founder summary (live counts)
//   2. RECOMMENDED NEXT ACTION · deterministic single next step
//   3. Live Suggested Fixes · production capability risks with tags
//   4. Full CAP list · every CAP, tagged (TEST_EVENT vs REAL vs SECURITY)
//   5. Recently resolved · with real evidence chain
//
// Buttons:
//   - "🤖 Send to NEX1 (diagnose)" · POST /api/nex/cap/nex1-diagnose
//     Produces an UNSIGNED proposal · founder Ed25519 signature still
//     required · does NOT grant execution authority.
//
// Doctrine display:
//   Every action button surface carries the disclaimer that today NEX
//   can govern, not resolve. Autonomous resolution requires
//   WO-CAP-EXECUTION-03 + founder signature.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type FounderClass =
  | "REAL_RISK" | "TEST_EVENT" | "SECURITY_ESCALATION"
  | "WAITING_FOUNDER" | "NEX1_ACTIONABLE" | "RESOLVED";

interface LiveFix {
  cap_id: string; kind: string; category: string; priority: string; status: string;
  title: string; detected_at: string; last_updated_at: string;
  detector_agent_id: string | null; resolver_outcome: string | null;
  proposed_wo_id: string | null;
  evidence_refs: { collection: string; record_id: string; kind: string }[];
  next_step: "NEEDS_DIAGNOSIS" | "NEEDS_FOUNDER_SIGNATURE" | "IN_PROGRESS" | "ESCALATED_TO_FOUNDER" | "RESOLVED";
  founder_class: FounderClass;
  founder_class_label: string;
  is_test_event: boolean;
  nex1_diagnose_available: boolean;
}

interface FounderSummary {
  total: number;
  critical_actions: number;
  high_priority: number;
  waiting_for_founder: number;
  security_escalations: number;
  nex1_actionable: number;
  test_events: number;
  resolved: number;
}

interface RecommendedNextAction {
  kind: "NEX1_DIAGNOSE" | "AWAIT_FOUNDER_SIGNATURE" | "FOUNDER_REVIEW" | "NONE";
  cap_id: string | null;
  cap_kind: string | null;
  cap_category: string | null;
  cap_priority: string | null;
  cap_title: string | null;
  proposed_wo_id: string | null;
  rationale: string;
}

interface LiveResponse {
  generated_at?: string;
  live_cap_registry?: {
    note: string;
    doctrine_note?: string;
    totals: { open: number; proposed: number; in_progress: number; escalated: number; resolved: number };
    founder_summary: FounderSummary;
    recommended_next_action: RecommendedNextAction;
    live_suggested_fixes: LiveFix[];
    recent_resolutions: LiveFix[];
    founder_facing_caps: LiveFix[];
  };
}

const CLASS_TONE: Record<FounderClass, { bg: string; text: string; border: string }> = {
  REAL_RISK:           { bg: "bg-red-100",     text: "text-red-800",    border: "border-red-500" },
  TEST_EVENT:          { bg: "bg-slate-100",   text: "text-slate-600",  border: "border-slate-300" },
  SECURITY_ESCALATION: { bg: "bg-purple-100",  text: "text-purple-800", border: "border-purple-500" },
  WAITING_FOUNDER:     { bg: "bg-amber-100",   text: "text-amber-800",  border: "border-amber-500" },
  NEX1_ACTIONABLE:     { bg: "bg-blue-100",    text: "text-blue-800",   border: "border-blue-500" },
  RESOLVED:            { bg: "bg-emerald-100", text: "text-emerald-800",border: "border-emerald-500" },
};

const PRIORITY_TONE: Record<string, string> = {
  CRITICAL: "bg-red-700 text-white",
  HIGH:     "bg-red-500 text-white",
  MEDIUM:   "bg-yellow-500 text-black",
  LOW:      "bg-slate-400 text-white",
};

const REC_KIND_LABEL: Record<RecommendedNextAction["kind"], string> = {
  NEX1_DIAGNOSE:            "🤖 NEX1 diagnose",
  AWAIT_FOUNDER_SIGNATURE:  "⏳ Awaiting founder Ed25519 signature",
  FOUNDER_REVIEW:           "🛡 Founder manual review required",
  NONE:                     "✅ No actionable production CAPs",
};

export default function LiveSuggestedFixes(): React.ReactElement {
  const [data, setData] = useState<LiveResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lastPollAt, setLastPollAt] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [flashes, setFlashes] = useState<Array<{ cap_id: string; text: string; ok: boolean }>>([]);
  const [showFullList, setShowFullList] = useState<boolean>(false);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/nex/work-map", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as LiveResponse);
      setErr(null);
      setLastPollAt(new Date().toISOString());
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 15_000);
    return () => clearInterval(id);
  }, [poll]);

  const sendToNex1 = useCallback(async (cap_id: string) => {
    setBusy((s) => new Set(s).add(cap_id));
    try {
      const res = await fetch("/api/nex/cap/nex1-diagnose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cap_id }),
      });
      const json = await res.json();
      const ok = res.ok && json.ok === true;
      const text = ok
        ? `Sent to NEX1 · outcome ${json.outcome}${json.proposal ? ` · proposal ${String(json.proposal.proposal_id).slice(0, 24)}…` : ""}`
        : `Refused: ${json.error ?? json.reason ?? "unknown"}`;
      setFlashes((f) => [...f.slice(-4), { cap_id, text, ok }]);
      await poll();
    } catch (e) {
      setFlashes((f) => [...f.slice(-4), { cap_id, text: `Error: ${(e as Error).message}`, ok: false }]);
    } finally {
      setBusy((s) => { const n = new Set(s); n.delete(cap_id); return n; });
    }
  }, [poll]);

  const reg = data?.live_cap_registry;
  const summary = reg?.founder_summary;
  const rec = reg?.recommended_next_action;
  const fixes = reg?.live_suggested_fixes ?? [];
  const recent = reg?.recent_resolutions ?? [];
  const full = reg?.founder_facing_caps ?? [];

  const listToShow = useMemo(() => (showFullList ? full : fixes), [showFullList, full, fixes]);

  return (
    <section className="mt-8 border-2 border-emerald-500 rounded-xl bg-white p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-emerald-700 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 nex-live-pulse" />
            NEX CAP STATUS
            <span className="text-xs font-normal text-slate-500 ml-2">(live registry · polls every 15s)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">{reg?.note ?? "loading…"}</p>
          {reg?.doctrine_note && (
            <p className="text-xs text-amber-700 mt-1 italic max-w-3xl">📜 {reg.doctrine_note}</p>
          )}
        </div>
        <div className="text-right text-xs text-slate-500">
          {lastPollAt && <div>last poll: {new Date(lastPollAt).toLocaleTimeString()}</div>}
          {err && <div className="text-red-600">error: {err}</div>}
        </div>
      </div>

      {/* Founder summary card · live counts */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-4 text-xs">
          <SummaryPill label="Total" n={summary.total} tone="bg-slate-500 text-white" />
          <SummaryPill label="CRITICAL" n={summary.critical_actions} tone="bg-red-700 text-white" />
          <SummaryPill label="HIGH" n={summary.high_priority} tone="bg-red-500 text-white" />
          <SummaryPill label="🤖 NEX1-actionable" n={summary.nex1_actionable} tone="bg-blue-500 text-white" />
          <SummaryPill label="⏳ Waiting founder" n={summary.waiting_for_founder} tone="bg-amber-500 text-black" />
          <SummaryPill label="🛡 Security" n={summary.security_escalations} tone="bg-purple-600 text-white" />
          <SummaryPill label="🧪 Test events" n={summary.test_events} tone="bg-slate-400 text-white" />
        </div>
      )}

      {/* Recommended Next Action */}
      {rec && (
        <div className="mb-5 rounded-lg border-2 border-emerald-600 bg-emerald-50 p-3">
          <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">Recommended Next Action</div>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-slate-800">
                {REC_KIND_LABEL[rec.kind]}
                {rec.cap_id && (
                  <span className="text-xs font-mono text-slate-600 ml-2">{rec.cap_id}</span>
                )}
              </div>
              {rec.cap_title && (
                <div className="text-sm text-slate-700 mt-1">{rec.cap_title}</div>
              )}
              <div className="text-xs text-slate-500 mt-1">{rec.rationale}</div>
            </div>
            {rec.kind === "NEX1_DIAGNOSE" && rec.cap_id && (
              <button
                onClick={() => sendToNex1(rec.cap_id as string)}
                disabled={busy.has(rec.cap_id)}
                className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-sm font-medium whitespace-nowrap"
              >
                {busy.has(rec.cap_id) ? "Sending…" : "🤖 Send to NEX1"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Flash messages from Send-to-NEX1 actions */}
      {flashes.length > 0 && (
        <div className="mb-4 grid gap-1">
          {flashes.map((f, i) => (
            <div key={i} className={`text-xs px-3 py-1.5 rounded ${f.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              <span className="font-mono">{f.cap_id.slice(0, 40)}…</span> · {f.text}
            </div>
          ))}
        </div>
      )}

      {/* Toggle · suggestions vs full list */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setShowFullList(false)}
          className={`text-xs px-2 py-1 rounded ${!showFullList ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"}`}
        >
          Suggested fixes ({fixes.length})
        </button>
        <button
          onClick={() => setShowFullList(true)}
          className={`text-xs px-2 py-1 rounded ${showFullList ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"}`}
        >
          Full CAP list ({full.length})
        </button>
      </div>

      {listToShow.length === 0 ? (
        <div className="text-sm text-slate-500 py-6 text-center border border-dashed rounded">
          No CAPs to show.
        </div>
      ) : (
        <div className="grid gap-2">
          {listToShow.map((f) => (
            <CapRow key={f.cap_id} f={f} busy={busy.has(f.cap_id)} onSend={sendToNex1} />
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-emerald-700 mb-2">Recently resolved · Capability Growth</h3>
          <div className="grid gap-1.5">
            {recent.slice(0, 8).map((r) => (
              <div key={r.cap_id} className="text-xs bg-emerald-50 rounded px-3 py-2 flex items-center gap-3">
                <span className="text-emerald-600 font-bold">+1</span>
                <span className="text-slate-800 flex-1 truncate">{r.cap_id} · {r.title}</span>
                <span className="text-slate-500 whitespace-nowrap">{new Date(r.last_updated_at).toLocaleDateString()}</span>
                <span className="text-emerald-700 font-medium whitespace-nowrap">
                  {r.evidence_refs.length > 0 ? "Evidence verified ✅" : "Evidence pending ⚠"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes nex-live-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        .nex-live-pulse { animation: nex-live-pulse 1.4s ease-in-out infinite; }
      `}} />
    </section>
  );
}

function SummaryPill({ label, n, tone }: { label: string; n: number; tone: string }): React.ReactElement {
  return (
    <div className={`rounded px-2 py-1.5 flex flex-col items-center ${tone}`}>
      <div className="text-lg font-bold leading-tight">{n}</div>
      <div className="text-[10px] uppercase tracking-wide leading-tight opacity-90">{label}</div>
    </div>
  );
}

function CapRow({ f, busy, onSend }: { f: LiveFix; busy: boolean; onSend: (cap_id: string) => void }): React.ReactElement {
  const cls = CLASS_TONE[f.founder_class];
  return (
    <div className={`border-l-4 ${cls.border} bg-slate-50 rounded p-3 flex items-start gap-3`}>
      <div className={`px-2 py-0.5 rounded text-xs font-semibold ${PRIORITY_TONE[f.priority] ?? "bg-slate-400 text-white"}`}>
        {f.priority}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={`text-[11px] px-2 py-0.5 rounded ${cls.bg} ${cls.text} font-medium`}>
            {f.founder_class_label}
          </span>
          {f.is_test_event && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 font-mono">
              test-namespace
            </span>
          )}
        </div>
        <div className="text-sm font-semibold text-slate-800">{f.title}</div>
        <div className="text-xs text-slate-500 mt-1 font-mono flex flex-wrap gap-x-3">
          <span>{f.cap_id}</span>
          <span>· {f.category}</span>
          <span>· {f.kind}</span>
          <span>· detected {new Date(f.detected_at).toLocaleDateString()}</span>
          {f.detector_agent_id && <span>· by {f.detector_agent_id}</span>}
        </div>
        {f.proposed_wo_id && (
          <div className="text-xs mt-1 font-mono text-slate-500">
            proposal: <span className="text-slate-700">{f.proposed_wo_id}</span>
          </div>
        )}
        {f.evidence_refs.length > 0 && (
          <details className="mt-1 text-xs">
            <summary className="cursor-pointer text-slate-500 hover:text-slate-700">
              Evidence ({f.evidence_refs.length})
            </summary>
            <ul className="mt-1 ml-4 space-y-0.5 font-mono text-slate-500">
              {f.evidence_refs.map((e, i) => (
                <li key={i}>{e.collection}/{e.record_id} · {e.kind}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="text-xs px-2 py-1 rounded bg-slate-200 text-slate-700 font-medium">
          {f.status}
        </span>
        {f.nex1_diagnose_available && !f.is_test_event && (
          <button
            onClick={() => onSend(f.cap_id)}
            disabled={busy}
            title="Send to NEX1 for deterministic diagnosis · produces unsigned proposal only · NEX1 cannot directly mutate protected code · all engineering mutation must pass authorization, scope enforcement, governed workstation execution and verification"
            className="text-[11px] px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-medium whitespace-nowrap"
          >
            {busy ? "Sending…" : "🤖 Send to NEX1"}
          </button>
        )}
      </div>
    </div>
  );
}
