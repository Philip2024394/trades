"use client";

// NEX Brain · Awaiting Review page · Phase 10.8
//
// The human end of the knowledge production line. Records that passed
// the structural gate at 0.70-0.84 confidence land here for Philip's
// judgement. Every action (approve / reject / edit) POSTs to the
// existing /api/nex/brain/review endpoint which:
//   · updates the record status
//   · writes a knowledge_feedback row (the moat the learning loop reads)
//   · writes an audit_log row
//
// UI is deliberately spartan · this is a control room, not a marketing
// page. Composes with the Warehouse's "Awaiting your review" barrel.
// No shadow state · every action re-fetches from the server.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type LatestCheck = {
  overall_confidence: number | null;
  decision:           string | null;
  flags:              string[];
  checked_at:         string | null;
};

type ReviewRecord = {
  record_id:         string;
  title:             string;
  category:          string;
  subcategory:       string | null;
  summary:           string;
  primary_audience:  string;
  authored_by:       string;
  last_reviewed_at:  string | null;
  created_at:        string;
  industry_concepts: string[];
  nex_concepts:      string[];
  latest_check:      LatestCheck | null;
};

const T = {
  bg: "#0b0f14", panel: "#12161c", panelElev: "#1a2028", border: "#232b36",
  text: "#e5e9ef", textDim: "#8892a0", textFade: "#5c6572",
  success: "#22C55E", warning: "#EAB308", danger: "#f0665a", info: "#5aa6f0",
};

function humaniseFlag(flag: string): string {
  return flag
    .replace(/^clause-fail:c\d+_/, "structural: ")
    .replace(/^below-review-threshold$/, "below review threshold")
    .replace(/^tone-mismatch$/, "tone mismatch")
    .replace(/^contradictions-detected$/, "contradictions detected")
    .replace(/_/g, " ");
}

function formatConfidence(c: number | null): string {
  if (c == null) return "—";
  return `${Math.round(c * 100)}%`;
}

function relativeAge(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

export default function ReviewPage() {
  const [records, setRecords] = useState<ReviewRecord[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [offset, setOffset] = useState<number>(0);
  const [busyId, setBusyId] = useState<string>("");
  const limit = 25;

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch(`/api/nex/brain/review?limit=${limit}&offset=${offset}`, { cache: "no-store" });
      const d = await r.json() as { ok: boolean; records?: ReviewRecord[]; total?: number; error?: string };
      if (!d.ok) { setError(d.error ?? "load_failed"); setRecords([]); setTotal(0); }
      else { setRecords(d.records ?? []); setTotal(d.total ?? 0); }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => { void load(); }, [load]);

  const act = useCallback(async (record_id: string, action: "approve" | "reject") => {
    setBusyId(record_id);
    try {
      const r = await fetch(`/api/nex/brain/review`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ record_id, action, severity: "moderate" }),
      });
      const d = await r.json() as { ok: boolean; error?: string };
      if (!d.ok) alert(`Action failed: ${d.error ?? "unknown"}`);
      await load();
    } finally {
      setBusyId("");
    }
  }, [load]);

  return (
    <div className="min-h-screen p-4 pt-16 sm:p-8 sm:pt-16" style={{ background: T.bg }}>
      <div className="mx-auto max-w-[1100px] space-y-4">
        <Link href="/nex-app/nex-brain/operations-centre" className="inline-flex items-center gap-1 text-[12px]" style={{ color: T.textDim }}>
          ← Back to Operations Centre
        </Link>
        <header className="rounded-lg border p-5" style={{ background: T.panel, borderColor: T.border }}>
          <div className="text-[11px] font-black uppercase tracking-widest" style={{ color: T.info }}>NEX Brain · Awaiting Review</div>
          <h1 className="mt-1 text-[24px] font-black" style={{ color: T.text }}>
            Records requiring your judgement
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: T.textDim }}>
            Passed the structural gate at 0.70–0.84 confidence · quality-checker escalated to you rather than auto-promote to AUTHORITATIVE.
          </p>
          <div className="mt-3 text-[12px]" style={{ color: T.text }}>
            <span className="font-black tabular-nums" style={{ color: T.info }}>{total.toLocaleString()}</span> awaiting review · showing {records.length} on this page.
          </div>
        </header>

        {loading && (
          <div className="rounded-lg border p-6" style={{ background: T.panel, borderColor: T.border, color: T.textDim }}>
            Loading review queue…
          </div>
        )}

        {error && (
          <div className="rounded-lg border p-4" style={{ background: T.panel, borderColor: T.danger, color: T.danger }}>
            {error}
          </div>
        )}

        {!loading && !error && records.length === 0 && (
          <div className="rounded-lg border p-6" style={{ background: T.panel, borderColor: T.border, color: T.textDim }}>
            <span className="text-[16px]" style={{ color: T.success }}>✓</span> Queue empty · nothing awaiting your review right now.
          </div>
        )}

        {records.map((rec) => (
          <article key={rec.record_id} className="rounded-lg border p-4 space-y-2" style={{ background: T.panel, borderColor: T.border }}>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>{rec.category}{rec.subcategory ? ` · ${rec.subcategory}` : ""}</span>
              <span className="text-[10px]" style={{ color: T.textFade }}>· {rec.primary_audience}</span>
              <span className="ml-auto text-[10px]" style={{ color: T.textFade }}>authored {relativeAge(rec.created_at)}</span>
            </div>
            <h2 className="text-[16px] font-bold" style={{ color: T.text }}>{rec.title}</h2>
            <p className="text-[13px] leading-relaxed" style={{ color: T.textDim }}>{rec.summary}</p>

            {rec.latest_check && (
              <div className="rounded-md border px-3 py-2 text-[12px]" style={{ background: T.panelElev, borderColor: T.border, color: T.text }}>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span>
                    <span style={{ color: T.textFade }}>Confidence: </span>
                    <span className="font-bold tabular-nums" style={{ color: T.info }}>{formatConfidence(rec.latest_check.overall_confidence)}</span>
                  </span>
                  <span>
                    <span style={{ color: T.textFade }}>Decision: </span>
                    <span className="font-semibold" style={{ color: T.warning }}>{rec.latest_check.decision ?? "—"}</span>
                  </span>
                  {rec.latest_check.checked_at && (
                    <span style={{ color: T.textFade }}>checked {relativeAge(rec.latest_check.checked_at)}</span>
                  )}
                </div>
                {rec.latest_check.flags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {rec.latest_check.flags.map((f, i) => (
                      <span key={i} className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: T.panel, color: T.warning, border: `1px solid ${T.border}` }}>
                        {humaniseFlag(f)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(rec.industry_concepts.length > 0 || rec.nex_concepts.length > 0) && (
              <div className="text-[11px]" style={{ color: T.textFade }}>
                {rec.industry_concepts.length > 0 && <span>Industry: {rec.industry_concepts.join(", ")} </span>}
                {rec.nex_concepts.length > 0 && <span>· NEX: {rec.nex_concepts.join(", ")}</span>}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => void act(rec.record_id, "approve")}
                disabled={busyId === rec.record_id}
                className="rounded-md px-4 py-1.5 text-[12.5px] font-bold"
                style={{ background: T.success, color: T.bg, opacity: busyId === rec.record_id ? 0.55 : 1 }}
              >
                Approve → Authoritative
              </button>
              <button
                type="button"
                onClick={() => void act(rec.record_id, "reject")}
                disabled={busyId === rec.record_id}
                className="rounded-md border px-4 py-1.5 text-[12.5px] font-semibold"
                style={{ borderColor: T.danger, color: T.danger, opacity: busyId === rec.record_id ? 0.55 : 1 }}
              >
                Reject → Deprecated
              </button>
              <span className="ml-auto text-[10px] font-mono" style={{ color: T.textFade }}>{rec.record_id}</span>
            </div>
          </article>
        ))}

        {total > limit && (
          <div className="flex items-center gap-3 justify-center py-4">
            <button type="button" onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="rounded-md border px-3 py-1 text-[12px]" style={{ borderColor: T.border, color: T.text, opacity: offset === 0 ? 0.5 : 1 }}>
              ← Previous
            </button>
            <span className="text-[11px]" style={{ color: T.textDim }}>
              {offset + 1}–{Math.min(offset + limit, total)} of {total.toLocaleString()}
            </span>
            <button type="button" onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= total}
              className="rounded-md border px-3 py-1 text-[12px]" style={{ borderColor: T.border, color: T.text, opacity: offset + limit >= total ? 0.5 : 1 }}>
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
