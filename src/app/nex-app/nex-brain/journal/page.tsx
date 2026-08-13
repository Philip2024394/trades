// NEX Worker Journal — /nex-app/nex-brain/journal
//
// The per-job / per-worker event timeline. Reads worker_audit_events
// via /api/nex/brain/audit-events and renders chronologically.
//
// Doctrine:
// · project_nex_operations_centre_living_digital_twin_2026_08_07.md
//   ("the biggest feature next" — Philip 2026-08-07)
// · feedback_nex_never_pretends_work_done_2026_08_07.md
//   (empty states are honest, never fake)
//
// URL params for shareable views:
//   /journal?job=<uuid>              — single-job trace
//   /journal?worker=knowledge-context — recent activity by worker
//   /journal?event=provider_response_failed — all failures
//   /journal?provider=cloudflare     — all attempts on one provider
//   /journal?hours=24                — window (default 24, max 720)

"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import "../../nex-app.css";

const TOKEN = {
  bg:          "var(--nex-cream)",
  card:        "var(--nex-neutral-0)",
  border:      "var(--nex-neutral-200)",
  divider:     "var(--nex-neutral-100)",
  text:        "var(--nex-neutral-900)",
  textSoft:    "var(--nex-neutral-500)",
  textMid:     "var(--nex-neutral-700)",
  accent:      "var(--nex-accent-500)",
  accentDark:  "var(--nex-accent-600)",
  accentSoft:  "var(--nex-accent-50)",
  success:     "var(--nex-success-500)",
  warning:     "var(--nex-warning-500)",
  info:        "var(--nex-info-500)",
  shadowSm:    "var(--nex-shadow-sm)",
};

type AuditEventRow = {
  id: string;
  worker_type: string;
  worker_host_id: string | null;
  job_id: string | null;
  input_ref: string | null;
  event_type: string;
  actor: string;
  at: string;
  latency_ms: number | null;
  provider: string | null;
  model: string | null;
  confidence: number | null;
  outcome: string | null;
  error_snippet: string | null;
  details?: Record<string, unknown>;
};

export default function WorkerJournalPage() {
  return (
    <Suspense fallback={<div className="p-8 text-[13px]" style={{ color: TOKEN.textSoft }}>Loading…</div>}>
      <JournalInner />
    </Suspense>
  );
}

function JournalInner() {
  const searchParams = useSearchParams();
  const jobFilter = searchParams.get("job") ?? "";
  const workerFilter = searchParams.get("worker") ?? "";
  const eventFilter = searchParams.get("event") ?? "";
  const providerFilter = searchParams.get("provider") ?? "";
  const hoursFilter = Math.min(Math.max(1, Number(searchParams.get("hours") ?? "24") || 24), 720);

  const [events, setEvents] = useState<AuditEventRow[]>([]);
  const [tableReady, setTableReady] = useState<boolean | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(200);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("since_hours", String(hoursFilter));
      if (jobFilter) params.set("job_id", jobFilter);
      if (workerFilter) params.set("worker_type", workerFilter);
      if (eventFilter) params.set("event_type", eventFilter);
      if (providerFilter) params.set("provider", providerFilter);
      const res = await fetch(`/api/nex/brain/audit-events?${params.toString()}`, { cache: "no-store" });
      const j = await res.json();
      if (j.ok) {
        setEvents(j.events as AuditEventRow[]);
        setTableReady(j.table_ready ?? true);
        setNote(j.note ?? null);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [jobFilter, workerFilter, eventFilter, providerFilter, hoursFilter, limit]);

  useEffect(() => { load(); }, [load]);

  // Live polling (5s), Page Visibility gated — same doctrine as other panels
  useEffect(() => {
    let id: number | null = null;
    const start = () => { if (id === null) id = window.setInterval(load, 5000); };
    const stop = () => { if (id !== null) { window.clearInterval(id); id = null; } };
    const onVis = () => { document.hidden ? stop() : start(); };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVis);
    return () => { stop(); document.removeEventListener("visibilitychange", onVis); };
  }, [load]);

  // Group by job_id for single-job trace mode
  const groupedByJob = jobFilter ? events.slice().sort((a, b) => a.at.localeCompare(b.at)) : events;

  return (
    <div className="nex-app-root" style={{ background: TOKEN.bg, color: TOKEN.text, minHeight: "100vh" }}>
      <div className="mx-auto max-w-[1120px] px-5 pb-24 pt-8 md:px-8 md:pt-10">
        {/* Header */}
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-widest"
             style={{ background: TOKEN.accentSoft, borderColor: TOKEN.accentDark, color: TOKEN.accentDark }}>
          NEX Worker Journal
        </div>
        <h1 className="text-[28px] font-black leading-tight tracking-tight md:text-[34px]">
          {jobFilter    ? `Trace · job ${jobFilter.slice(0, 8)}` :
           workerFilter ? `Recent activity · ${workerFilter}` :
           eventFilter  ? `All ${eventFilter} events` :
           providerFilter ? `All ${providerFilter} attempts` :
                          "Everything that happened"}
        </h1>
        <p className="mt-2 max-w-[720px] text-[13px]" style={{ color: TOKEN.textMid }}>
          Every provider attempt · every job transition · every promotion. Sourced from
          {" "}<span className="font-mono">worker_audit_events</span>. This is the raw event
          stream that powers Operations History, Explain-this-record, and future Replay mode.
        </p>

        {/* Filter row (active-filter chips + clear) */}
        {(jobFilter || workerFilter || eventFilter || providerFilter) && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold" style={{ color: TOKEN.textSoft }}>Filters:</span>
            {jobFilter    && <FilterChip label={`job=${jobFilter.slice(0, 8)}…`} />}
            {workerFilter && <FilterChip label={`worker=${workerFilter}`} />}
            {eventFilter  && <FilterChip label={`event=${eventFilter}`} />}
            {providerFilter && <FilterChip label={`provider=${providerFilter}`} />}
            <Link
              href="/nex-app/nex-brain/journal"
              className="rounded-full border px-2.5 py-0.5 text-[10px] font-semibold"
              style={{ background: TOKEN.card, borderColor: TOKEN.border, color: TOKEN.textMid }}
            >
              Clear
            </Link>
          </div>
        )}

        {/* Controls */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: TOKEN.textSoft }}>
            Window · {hoursFilter}h
          </span>
          {[
            { h: 1,   l: "1h" },
            { h: 6,   l: "6h" },
            { h: 24,  l: "Today" },
            { h: 168, l: "7d" },
            { h: 720, l: "30d" },
          ].map(({ h, l }) => (
            <Link
              key={h}
              href={`/nex-app/nex-brain/journal?${buildQuery({ hoursFilter: h, jobFilter, workerFilter, eventFilter, providerFilter })}`}
              className="rounded-full border px-3 py-1 text-[11px] font-semibold"
              style={{
                background: h === hoursFilter ? TOKEN.accentDark : TOKEN.card,
                borderColor: h === hoursFilter ? TOKEN.accentDark : TOKEN.border,
                color:      h === hoursFilter ? "#fff" : TOKEN.textMid,
              }}
            >
              {l}
            </Link>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px]" style={{ color: TOKEN.textSoft }}>Limit</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="rounded-md border px-2 py-1 text-[11px]"
              style={{ background: TOKEN.card, borderColor: TOKEN.border, color: TOKEN.textMid }}
            >
              {[50, 100, 200, 500].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <Link
              href="/nex-app/nex-brain"
              className="rounded-full border px-3 py-1 text-[11px] font-semibold"
              style={{ background: TOKEN.card, borderColor: TOKEN.border, color: TOKEN.textMid }}
            >
              ← Brain
            </Link>
          </div>
        </div>

        {/* Table-not-ready state */}
        {tableReady === false ? (
          <div className="mt-6 rounded-2xl border p-4 text-[13px]"
               style={{ background: "#FFFBEB", borderColor: "#F59E0B", color: "#78350F" }}>
            <div className="font-bold">Worker Audit Log table not yet created</div>
            <div className="mt-1">{note}</div>
            <div className="mt-2 text-[12px]">
              The LLM chain is already emitting events (see <span className="font-mono">src/lib/nex/brain/llm.ts</span>) — they&apos;re being dropped
              silently until the table exists. Apply <span className="font-mono">db/migrations/004_worker_audit_events.sql</span> in the Supabase Studio SQL Editor to activate this Journal.
            </div>
          </div>
        ) : loading && events.length === 0 ? (
          <div className="mt-6 rounded-2xl border p-6 text-center text-[13px]"
               style={{ background: TOKEN.card, borderColor: TOKEN.border, color: TOKEN.textSoft }}>
            Loading journal…
          </div>
        ) : events.length === 0 ? (
          <div className="mt-6 rounded-2xl border p-6 text-center text-[13px]"
               style={{ background: TOKEN.card, borderColor: TOKEN.border, color: TOKEN.textSoft }}>
            No events matching these filters in the last {hoursFilter}h.
            {jobFilter || workerFilter || eventFilter || providerFilter ? " Try widening the filters." : " When real work flows through the pipeline, events will appear here."}
          </div>
        ) : (
          <JournalTimeline events={groupedByJob} focusJob={Boolean(jobFilter)} />
        )}

        <div className="mt-6 text-[11px]" style={{ color: TOKEN.textSoft }}>
          Live · refreshes every 5s · pauses when tab hidden · {events.length} events shown
        </div>
      </div>
    </div>
  );
}

// ── Timeline component ────────────────────────────────────────────

function JournalTimeline({ events, focusJob }: { events: AuditEventRow[]; focusJob: boolean }) {
  return (
    <div
      className="mt-4 overflow-hidden rounded-2xl border"
      style={{ background: TOKEN.card, borderColor: TOKEN.border, boxShadow: TOKEN.shadowSm }}
    >
      {events.map((e, i) => {
        const chip = eventChip(e.event_type);
        const time = new Date(e.at);
        const timeStr = time.toLocaleTimeString();
        const dayStr = time.toLocaleDateString();
        const durationSinceFirst = focusJob && events[0]
          ? Math.max(0, time.getTime() - new Date(events[0].at).getTime())
          : null;
        return (
          <div
            key={e.id}
            className="flex items-start gap-3 px-4 py-3"
            style={{ borderTop: i === 0 ? "none" : `1px solid ${TOKEN.divider}` }}
          >
            {/* Timestamp column */}
            <div className="w-[110px] flex-none">
              <div className="font-mono text-[11px]" style={{ color: TOKEN.textMid }}>
                {timeStr}
              </div>
              <div className="text-[10px]" style={{ color: TOKEN.textSoft }}>
                {dayStr}
              </div>
              {durationSinceFirst !== null && durationSinceFirst > 0 ? (
                <div className="mt-0.5 text-[10px]" style={{ color: TOKEN.info }}>
                  +{(durationSinceFirst / 1000).toFixed(1)}s
                </div>
              ) : null}
            </div>

            {/* Event chip + main content */}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                  style={{ background: chip.bg, color: chip.fg }}
                >
                  {e.event_type}
                </span>
                <span className="text-[13px] font-semibold" style={{ color: TOKEN.text }}>
                  {e.worker_type}
                </span>
                {e.provider ? (
                  <span className="text-[11px]" style={{ color: TOKEN.textMid }}>
                    · <span className="font-mono">{e.provider}</span>
                    {e.model ? <span style={{ color: TOKEN.textSoft }}> / {e.model}</span> : null}
                  </span>
                ) : null}
              </div>

              {/* Second line: outcome, error, details */}
              {e.error_snippet ? (
                <div className="text-[11px]" style={{ color: "#991B1B" }}>
                  {e.error_snippet}
                </div>
              ) : null}
              {e.outcome && e.outcome !== "ok" && !e.error_snippet ? (
                <div className="text-[11px]" style={{ color: TOKEN.textMid }}>
                  outcome: <span className="font-mono">{e.outcome}</span>
                </div>
              ) : null}

              {/* Job trace link when not already filtered to that job */}
              {e.job_id && !focusJob ? (
                <Link
                  href={`/nex-app/nex-brain/journal?job=${e.job_id}`}
                  className="text-[11px] hover:underline"
                  style={{ color: TOKEN.accentDark }}
                >
                  Trace this job →
                </Link>
              ) : null}
            </div>

            {/* Right column: metrics */}
            <div className="flex flex-none flex-col items-end gap-0.5">
              {e.latency_ms != null ? (
                <span className="font-mono text-[11px]" style={{ color: TOKEN.textMid }}>
                  {e.latency_ms} ms
                </span>
              ) : null}
              {e.confidence != null ? (
                <span className="font-mono text-[11px]" style={{ color: TOKEN.info }}>
                  {Math.round(e.confidence * 100)}%
                </span>
              ) : null}
              {e.worker_host_id ? (
                <span className="font-mono text-[10px]" style={{ color: TOKEN.textSoft }}>
                  {e.worker_host_id.slice(0, 10)}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

function FilterChip({ label }: { label: string }) {
  return (
    <span
      className="rounded-full border px-2.5 py-0.5 text-[10px] font-semibold"
      style={{ background: TOKEN.accentSoft, borderColor: TOKEN.accentDark, color: TOKEN.accentDark }}
    >
      {label}
    </span>
  );
}

function buildQuery(args: { hoursFilter: number; jobFilter: string; workerFilter: string; eventFilter: string; providerFilter: string }): string {
  const p = new URLSearchParams();
  if (args.hoursFilter !== 24)  p.set("hours", String(args.hoursFilter));
  if (args.jobFilter)           p.set("job", args.jobFilter);
  if (args.workerFilter)        p.set("worker", args.workerFilter);
  if (args.eventFilter)         p.set("event", args.eventFilter);
  if (args.providerFilter)      p.set("provider", args.providerFilter);
  return p.toString();
}

function eventChip(evt: string): { bg: string; fg: string } {
  if (evt.includes("failed") || evt.includes("rejected") || evt.includes("circuit_opened") || evt === "job_failed") {
    return { bg: "#FEE2E2", fg: "#991B1B" };
  }
  if (evt.includes("budget_exhausted") || evt.includes("contradiction_detected")) {
    return { bg: "#FEF3C7", fg: "#92400E" };
  }
  if (evt.includes("ok") || evt.includes("promoted") || evt === "job_completed" || evt.includes("resolved")) {
    return { bg: "#DCFCE7", fg: "#166534" };
  }
  if (evt.includes("started") || evt.includes("sent") || evt.includes("extracted") || evt.includes("linked")) {
    return { bg: "#DBEAFE", fg: "#1D4ED8" };
  }
  return { bg: TOKEN.divider, fg: TOKEN.textMid };
}
