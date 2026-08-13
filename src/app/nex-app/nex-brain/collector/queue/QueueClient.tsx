"use client";

// Client shell for /nex-app/nex-brain/collector/queue.
//
// Three regions:
//   1. Stats row · counts by status
//   2. Paste box · POST /api/nex/collection/queue
//   3. Process Now button · POST /api/nex/collection/process-url-queue
//   4. Queue table · what's queued/processing/completed/duplicate/needs_review/failed
//
// The table refreshes automatically after paste and after processing.

import { useState, useTransition, useCallback } from "react";
import Link from "next/link";
import type { QueueItem, QueueStatus } from "@/lib/nex/collection/urlQueueDb";

type Stats = Record<QueueStatus, number> & { total: number };

type Props = {
  initialItems: QueueItem[];
  initialStats: Stats;
  collectionType: string;
  campaignDisplayName: string;
};

type RejectedRow = { url: string; reason: string; category: string };

type BatchOutcome =
  | { kind: "completed"; queue_item_id: string; listing_id: string; slug: string; qualification: string }
  | { kind: "duplicate"; queue_item_id: string; matched_slug: string; signal: string }
  | { kind: "needs_review"; queue_item_id: string; reason: string }
  | { kind: "failed"; queue_item_id: string; error_category: string; error_message: string };

type BatchReport = {
  processed: number;
  completed: number;
  duplicate: number;
  needs_review: number;
  failed: number;
  outcomes: BatchOutcome[];
  drained: boolean;
  time_ms: number;
  auto_recovered_stuck?: number;
};

export function QueueClient({ initialItems, initialStats, collectionType, campaignDisplayName }: Props) {
  const [items, setItems] = useState<QueueItem[]>(initialItems);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [pasteText, setPasteText] = useState("");
  const [pasteMsg, setPasteMsg] = useState<string | null>(null);
  const [rejectedRows, setRejectedRows] = useState<RejectedRow[]>([]);
  const [processMsg, setProcessMsg] = useState<string | null>(null);
  const [lastReport, setLastReport] = useState<BatchReport | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/nex/collection/queue?collection_type=${encodeURIComponent(collectionType)}&limit=200`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.items ?? []);
    setStats(data.stats ?? stats);
  }, [stats, collectionType]);

  const submitPaste = () => {
    startTransition(async () => {
      setPasteMsg(null);
      setRejectedRows([]);
      const trimmed = pasteText.trim();
      if (!trimmed) {
        setPasteMsg("Paste one or more URLs first.");
        return;
      }
      // Server parses labelled dump: `DISCOVERY <url>` / `CANDIDATE <url>` /
      // plain URL (kind inferred from host). Comments (#) and blank lines OK.
      const res = await fetch("/api/nex/collection/queue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ collection_type: collectionType, dump: trimmed }),
      });
      const data = await res.json();
      if (!data.ok) {
        setPasteMsg(`Error: ${data.error ?? "unknown"}`);
        return;
      }
      const candidateBit  = `${data.enqueued} candidate URL${data.enqueued === 1 ? "" : "s"} queued`;
      const discoveryBit  = data.discoveryBookmarks
        ? ` · ${data.discoveryBookmarks} discovery bookmark${data.discoveryBookmarks === 1 ? "" : "s"} saved`
        : "";
      const dupBit        = data.duplicates ? ` · ${data.duplicates} already known` : "";
      // Split "rejected" into typed causes so the operator sees WHY a URL didn't
      // enter the queue. DNS-rejected is a collection problem · not a company
      // judgement (per URL Provenance rule).
      const dnsBit        = data.dnsRejected ? ` · ${data.dnsRejected} rejected (DNS · domain does not resolve)` : "";
      const invalidBit    = data.invalidUrl  ? ` · ${data.invalidUrl} rejected (invalid URL)` : "";
      const otherFailBit  = (data.failed - (data.dnsRejected ?? 0) - (data.invalidUrl ?? 0)) > 0
        ? ` · ${data.failed - (data.dnsRejected ?? 0) - (data.invalidUrl ?? 0)} rejected (other)`
        : "";
      setPasteMsg(`${candidateBit}${discoveryBit}${dupBit}${dnsBit}${invalidBit}${otherFailBit}.`);

      // Per-URL rejection surface — operator can see WHICH URLs didn't make it
      // (Philip 2026-08-14 · URL Provenance rule requires visibility, not just counts).
      const rejected: RejectedRow[] = Array.isArray(data.results)
        ? data.results
            .filter((r: { ok: boolean; url: string; error?: string; error_category?: string }) => !r.ok)
            .map((r: { url: string; error?: string; error_category?: string }) => ({
              url: r.url,
              reason: r.error ?? "unknown",
              category: r.error_category ?? "unclassified",
            }))
        : [];
      setRejectedRows(rejected);

      setPasteText("");
      await refresh();
    });
  };

  const processNow = () => {
    startTransition(async () => {
      setProcessMsg("Worker running · this may take up to a few minutes...");
      setLastReport(null);
      const res = await fetch("/api/nex/collection/process-url-queue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ collection_type: collectionType, max_items: 25 }),
      });
      const data = await res.json();
      if (!data.ok) {
        setProcessMsg(`Worker failed: ${data.error ?? "unknown"}`);
        return;
      }
      const report: BatchReport = data.report;
      setLastReport(report);
      const recoveryBit = report.auto_recovered_stuck
        ? ` · auto-recovered ${report.auto_recovered_stuck} stuck row${report.auto_recovered_stuck === 1 ? "" : "s"}`
        : "";
      setProcessMsg(
        `Processed ${report.processed} URL${report.processed === 1 ? "" : "s"} in ${Math.round(report.time_ms / 100) / 10}s · ${report.completed} saved · ${report.duplicate} duplicate · ${report.needs_review} need review · ${report.failed} failed${recoveryBit}${report.drained ? " · queue drained" : ""}.`,
      );
      await refresh();
    });
  };

  return (
    <div className="space-y-6">
      {/* ── Stats ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {statPill("Queued",         stats.queued,          "bg-slate-100 text-slate-800")}
        {statPill("Processing",     stats.processing,      "bg-blue-100 text-blue-800")}
        {statPill("Completed",      stats.completed,       "bg-emerald-100 text-emerald-800")}
        {statPill("Duplicate",      stats.duplicate,       "bg-amber-100 text-amber-800")}
        {statPill("Needs review",   stats.needs_review,    "bg-orange-100 text-orange-800")}
        {statPill("Failed",         stats.failed,          "bg-rose-100 text-rose-800")}
        {statPill("Retry",          stats.retry_scheduled, "bg-violet-100 text-violet-800")}
        {statPill("Total",          stats.total,           "bg-black text-white")}
      </div>

      {/* ── Paste + Process actions ─────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-black/10 bg-white p-4">
          <div className="mb-2 text-xs font-black uppercase tracking-widest text-black/60">
            Paste candidate URLs · {campaignDisplayName}
          </div>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={"https://example-staircases.co.uk\nhttps://another-refurb.co.uk/services\nhttps://…"}
            rows={7}
            className="w-full rounded-xl border border-black/10 bg-neutral-50 p-3 font-mono text-sm outline-none focus:border-orange-400"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="text-[11px] text-black/50">
              One URL per line · same domain may appear multiple times (different pages).
            </div>
            <button
              type="button"
              onClick={submitPaste}
              disabled={pending}
              className="rounded-full bg-orange-500 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-white shadow disabled:opacity-50"
            >
              {pending ? "Working..." : "Add to queue"}
            </button>
          </div>
          {pasteMsg && <div className="mt-2 text-[12px] text-black/70">{pasteMsg}</div>}
          {rejectedRows.length > 0 && (
            <details className="mt-3" open>
              <summary className="cursor-pointer text-[11px] font-black uppercase tracking-wider text-rose-700">
                {rejectedRows.length} URL{rejectedRows.length === 1 ? "" : "s"} rejected · did not enter the queue
              </summary>
              <div className="mt-2 max-h-64 space-y-1 overflow-y-auto text-[11px]">
                {rejectedRows.map((r) => (
                  <div key={r.url} className="rounded bg-rose-50 px-2 py-1 font-mono text-rose-900">
                    <span className="mr-2 rounded bg-rose-200 px-1.5 text-[9.5px] font-black uppercase tracking-wider">
                      {r.category.replace(/_/g, " ")}
                    </span>
                    {r.url}
                    <div className="mt-0.5 pl-1 text-[10px] text-rose-800/80">{r.reason}</div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10.5px] leading-snug text-black/50">
                DNS-rejected URLs are a collection problem, not a company judgement — the domain
                doesn&apos;t resolve, so no worker fetch is spent on it. Never fabricated. (URL Provenance rule)
              </p>
            </details>
          )}
        </div>

        <div className="rounded-2xl border border-black/10 bg-white p-4">
          <div className="mb-2 text-xs font-black uppercase tracking-widest text-black/60">
            Run worker
          </div>
          <p className="mb-3 text-[12px] text-black/60">
            Processes up to 25 queued URLs. Fails on any single URL don&apos;t stop the next.
          </p>
          <button
            type="button"
            onClick={processNow}
            disabled={pending || stats.queued === 0}
            className="w-full rounded-full bg-black px-4 py-2 text-xs font-black uppercase tracking-widest text-white shadow disabled:opacity-50"
          >
            {pending ? "Running..." : `Process ${stats.queued} queued`}
          </button>
          {processMsg && <div className="mt-2 text-[12px] text-black/70">{processMsg}</div>}
          {lastReport && (
            <details className="mt-3">
              <summary className="cursor-pointer text-[11px] font-semibold text-black/50">Batch outcomes</summary>
              <div className="mt-2 space-y-1 text-[11px]">
                {lastReport.outcomes.map((o) => (
                  <div key={o.queue_item_id} className="rounded bg-neutral-50 px-2 py-1 font-mono">
                    <span className={outcomeColor(o.kind)}>{o.kind}</span>
                    {" · "}
                    {outcomeSummary(o)}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>

      {/* ── Queue table ─────────────────────────────────────── */}
      <div className="rounded-2xl border border-black/10 bg-white">
        <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
          <div className="text-xs font-black uppercase tracking-widest text-black/60">
            Queue · newest first
          </div>
          <button
            type="button"
            onClick={() => startTransition(refresh)}
            className="rounded-full border border-black/10 px-3 py-1 text-[11px] font-semibold text-black/70 hover:bg-black/5"
          >
            Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-[10px] font-black uppercase tracking-widest text-black/60">
              <tr>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">URL</th>
                <th className="px-3 py-2 text-left">Extracted</th>
                <th className="px-3 py-2 text-left">Result</th>
                <th className="px-3 py-2 text-right">Attempts</th>
                <th className="px-3 py-2 text-right">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-black/40">
                    Queue is empty — paste some URLs above to begin.
                  </td>
                </tr>
              )}
              {items.map((it) => (
                <tr key={it.id} className="border-t border-black/5 align-top">
                  <td className="px-3 py-2">
                    <StatusPill status={it.status} />
                  </td>
                  <td className="px-3 py-2">
                    <a href={it.candidate_url} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
                      {truncate(it.candidate_url, 60)}
                    </a>
                    <div className="text-[10px] text-black/40">{it.target_domain}</div>
                  </td>
                  <td className="px-3 py-2 text-[11px] text-black/70">
                    {it.extracted_company_name && <div className="font-semibold text-black/85">{it.extracted_company_name}</div>}
                    {it.extracted_email && <div>{it.extracted_email}</div>}
                    {it.extracted_phone && <div className="font-mono">{it.extracted_phone}</div>}
                    {it.refacing_qualification && (
                      <div className="mt-0.5 inline-block rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                        {it.refacing_qualification}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-black/70">
                    {it.result_listing_slug && (
                      <Link
                        href={`/nex-app/refacing/companies?slug=${encodeURIComponent(it.result_listing_slug)}`}
                        className="text-emerald-700 hover:underline"
                      >
                        {it.result_listing_slug}
                      </Link>
                    )}
                    {it.result_summary && <div className="text-black/60">{it.result_summary}</div>}
                    {it.last_error && <div className="text-rose-600">{it.last_error}</div>}
                  </td>
                  <td className="px-3 py-2 text-right text-[11px] tabular-nums text-black/60">{it.attempt_count}</td>
                  <td className="px-3 py-2 text-right text-[10px] tabular-nums text-black/40">{fmt(it.submitted_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── UI atoms ─────────────────────────────────────────────────────

function statPill(label: string, count: number, cls: string) {
  return (
    <div className={`rounded-xl px-3 py-2 ${cls}`}>
      <div className="text-[10px] font-black uppercase tracking-widest opacity-80">{label}</div>
      <div className="text-lg font-black tabular-nums">{count}</div>
    </div>
  );
}

function StatusPill({ status }: { status: QueueStatus }) {
  const cls: Record<QueueStatus, string> = {
    queued:          "bg-slate-100 text-slate-800",
    processing:      "bg-blue-100 text-blue-800",
    completed:       "bg-emerald-100 text-emerald-800",
    duplicate:       "bg-amber-100 text-amber-800",
    needs_review:    "bg-orange-100 text-orange-800",
    failed:          "bg-rose-100 text-rose-800",
    retry_scheduled: "bg-violet-100 text-violet-800",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${cls[status]}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function outcomeColor(kind: BatchOutcome["kind"]): string {
  switch (kind) {
    case "completed":    return "text-emerald-700 font-bold";
    case "duplicate":    return "text-amber-700 font-bold";
    case "needs_review": return "text-orange-700 font-bold";
    case "failed":       return "text-rose-700 font-bold";
  }
}
function outcomeSummary(o: BatchOutcome): string {
  switch (o.kind) {
    case "completed":    return `${o.slug} (${o.qualification})`;
    case "duplicate":    return `${o.matched_slug} · ${o.signal}`;
    case "needs_review": return o.reason;
    case "failed":       return `${o.error_category} · ${o.error_message}`;
  }
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
function fmt(iso: string): string {
  try { return new Date(iso).toLocaleString("en-GB", { hour12: false }); } catch { return iso; }
}
