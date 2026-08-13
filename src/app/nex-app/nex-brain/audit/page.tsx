// NEX Worker Activity Audit — /nex-app/nex-brain/audit
//
// Renders the audit computed by /api/nex/brain/worker-audit. Every value
// shown is real telemetry. Metrics that cannot yet be computed are
// labelled "Not yet available" with the prescribed new telemetry that
// would unlock them.
//
// Doctrine:
// · feedback_nex_observable_ai_doctrine_2026_08_07.md — audit is part of the doctrine
// · feedback_nex_never_pretends_work_done_2026_08_07.md — no fabricated numbers

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { WorkerActivityAudit, Maybe } from "@/lib/nex/brain/worker-audit";
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

export default function WorkerAuditPage() {
  const [audit, setAudit] = useState<WorkerActivityAudit | null>(null);
  const [rowCounts, setRowCounts] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hours, setHours] = useState(24);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/nex/brain/worker-audit?hours=${hours}`, { cache: "no-store" });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "audit_failed");
      setAudit(j.audit as WorkerActivityAudit);
      setRowCounts(j.row_counts ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "load_failed");
    } finally {
      setLoading(false);
    }
  }, [hours]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="nex-app-root" style={{ background: TOKEN.bg, color: TOKEN.text, minHeight: "100vh" }}>
      <div className="mx-auto max-w-[1120px] px-5 pb-24 pt-8 md:px-8 md:pt-10">

        {/* Header */}
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-widest"
             style={{ background: TOKEN.accentSoft, borderColor: TOKEN.accentDark, color: TOKEN.accentDark }}>
          NEX Operations History
        </div>
        <h1 className="text-[28px] font-black leading-tight tracking-tight md:text-[34px]">
          What NEX has been doing
        </h1>
        <p className="mt-2 max-w-[720px] text-[13px]" style={{ color: TOKEN.textMid }}>
          Permanent record. Every value is real telemetry — worker_jobs · worker_results · worker_audit_events ·
          worker_heartbeats · contradictions · knowledge_records. Metrics that cannot yet be
          computed are labelled <span className="font-semibold">&quot;Not yet available&quot;</span> with the
          prescribed new telemetry that would unlock them. As the audit-events log accumulates weeks
          of history, this page becomes the primary way to answer questions like &quot;why was NEX slower
          last Tuesday?&quot; without ever inspecting Fly logs.
        </p>

        {/* Controls */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <label className="text-[12px] font-semibold" style={{ color: TOKEN.textMid }}>
            Window:
          </label>
          {([
            { h: 1,   label: "1h" },
            { h: 6,   label: "6h" },
            { h: 24,  label: "Today" },
            { h: 48,  label: "Yesterday+" },
            { h: 168, label: "7d" },
            { h: 720, label: "30d" },
          ] as const).map(({ h, label }) => (
            <button
              key={h}
              type="button"
              onClick={() => setHours(h)}
              className="rounded-full border px-3 py-1 text-[11px] font-semibold"
              style={{
                background: h === hours ? TOKEN.accentDark : TOKEN.card,
                borderColor: h === hours ? TOKEN.accentDark : TOKEN.border,
                color:      h === hours ? "#fff" : TOKEN.textMid,
              }}
            >
              {label}
            </button>
          ))}
          <span className="text-[10px] italic" style={{ color: TOKEN.textSoft }}>
            (Custom range picker · future)
          </span>
          <button
            type="button"
            onClick={load}
            className="ml-auto rounded-full border px-3 py-1 text-[11px] font-semibold"
            style={{ background: TOKEN.card, borderColor: TOKEN.border, color: TOKEN.textMid }}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
          <Link
            href="/nex-app/nex-brain"
            className="rounded-full border px-3 py-1 text-[11px] font-semibold"
            style={{ background: TOKEN.card, borderColor: TOKEN.border, color: TOKEN.textMid }}
          >
            ← Back to Brain
          </Link>
        </div>

        {/* Error state */}
        {error ? (
          <div className="mt-6 rounded-2xl border p-4 text-[13px]" style={{ background: "#FEF2F2", borderColor: "#DC2626", color: "#7F1D1D" }}>
            Failed to load audit: <span className="font-mono">{error}</span>
          </div>
        ) : null}

        {/* Loading state */}
        {!audit && !error ? (
          <div className="mt-6 rounded-2xl border p-6 text-center text-[13px]" style={{ background: TOKEN.card, borderColor: TOKEN.border, color: TOKEN.textSoft }}>
            Loading audit… (may take a few seconds for larger windows)
          </div>
        ) : null}

        {audit ? (
          <>
            <ObservationsPanel observations={audit.observations} />

            <KnowledgeProductionPanel audit={audit} />

            <SystemPanel audit={audit} />

            <TimelinePanel audit={audit} />

            <PerWorkerPanel audit={audit} />

            <MissingTelemetryPanel audit={audit} />

            <FooterMeta audit={audit} rowCounts={rowCounts} />
          </>
        ) : null}
      </div>
    </div>
  );
}

// ── Observations panel — the auto-generated narrative ──────────────

function ObservationsPanel({ observations }: { observations: WorkerActivityAudit["observations"] }) {
  if (observations.length === 0) {
    return null;
  }
  return (
    <section className="mt-8">
      <SectionTitle title="Observations" />
      <div
        className="mt-3 space-y-2 rounded-2xl border p-4"
        style={{ background: TOKEN.card, borderColor: TOKEN.border, boxShadow: TOKEN.shadowSm }}
      >
        {observations.map((o, i) => {
          const chip =
            o.kind === "critical" ? { bg: "#FEE2E2", fg: "#991B1B", label: "Critical" } :
            o.kind === "warn"     ? { bg: "#FEF3C7", fg: "#92400E", label: "Warning" } :
                                    { bg: "#DBEAFE", fg: "#1D4ED8", label: "Info" };
          return (
            <div key={i} className="flex items-start gap-2 text-[13px]">
              <span
                className="mt-0.5 flex-none rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                style={{ background: chip.bg, color: chip.fg }}
              >
                {chip.label}
              </span>
              <span style={{ color: TOKEN.text }}>{o.text}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Knowledge Production panel — the "what NEX built" measure ────
// Doctrine: `project_nex_operations_history_and_explainability_2026_08_07.md`
// "You aren't measuring LLM usage. You're measuring knowledge creation."
function KnowledgeProductionPanel({ audit }: { audit: WorkerActivityAudit }) {
  const k = audit.knowledge_production;
  return (
    <section className="mt-8">
      <SectionTitle title="Knowledge Production" />
      <p className="mt-1 text-[12px]" style={{ color: TOKEN.textMid }}>
        What NEX <span className="font-semibold">built</span> in this window — a more meaningful measure of progress than call counts.
      </p>
      <div
        className="mt-3 grid grid-cols-2 gap-3 rounded-2xl border p-4 md:grid-cols-4"
        style={{ background: TOKEN.card, borderColor: TOKEN.border, boxShadow: TOKEN.shadowSm }}
      >
        <Metric label="Articles analysed"                  value={k.articles_analysed.toLocaleString()} />
        <Metric label="Records → Authoritative"            value={k.authoritative_records_added.toLocaleString()} tone={k.authoritative_records_added > 0 ? "success" : "info"} />
        <Metric label="Records → Under review"             value={k.under_review_records_added.toLocaleString()} />
        <Metric label="New draft records"                  value={k.draft_records_added.toLocaleString()} />
        <Metric label="Contradictions opened"              value={k.contradictions_opened.toLocaleString()} tone={k.contradictions_opened > 0 ? "warn" : "info"} />
        <Metric label="Contradictions resolved"            value={k.contradictions_resolved.toLocaleString()} tone={k.contradictions_resolved > 0 ? "success" : "info"} />
        <Metric label="Avg confidence"                     value={k.average_confidence != null ? `${Math.round(k.average_confidence * 100)}%` : "—"} />
        <MetricMaybe label="Knowledge graph edges added"   maybe={k.knowledge_graph_edges_added} formatter={(n) => n.toLocaleString()} />
      </div>
    </section>
  );
}

// ── System-level panel ────────────────────────────────────────────

function SystemPanel({ audit }: { audit: WorkerActivityAudit }) {
  const s = audit.system;
  return (
    <section className="mt-8">
      <SectionTitle title="System overview" />
      <div
        className="mt-3 grid grid-cols-2 gap-3 rounded-2xl border p-4 md:grid-cols-4"
        style={{ background: TOKEN.card, borderColor: TOKEN.border, boxShadow: TOKEN.shadowSm }}
      >
        <Metric label="Jobs completed"                value={s.jobs_completed_total.toLocaleString()} />
        <Metric label="Jobs failed"                   value={s.jobs_failed_total.toLocaleString()} tone={s.jobs_failed_total > 0 ? "warn" : "info"} />
        <Metric label="Cloud workers online"          value={s.cloud_workers_online.toString()} tone={s.cloud_workers_online > 0 ? "success" : "warn"} />
        <Metric label="Avg jobs / hour"               value={s.avg_jobs_per_hour.toString()} />
        <Metric label="Combined active processing"    value={formatMs(s.combined_active_processing_ms)} />
        <MetricMaybe label="Combined idle time"       maybe={s.combined_idle_ms} formatter={formatMs} />
        <MetricMaybe label="Queue utilisation"        maybe={s.queue_utilisation_pct} formatter={(n) => `${n.toFixed(1)}%`} />
        <Metric label="Avg LLM response"              value={s.avg_llm_response_ms != null ? `${s.avg_llm_response_ms} ms` : "—"} />
        <Metric label="Avg end-to-end job"            value={s.avg_end_to_end_job_ms != null ? formatMs(s.avg_end_to_end_job_ms) : "—"} />
        <Metric label="Queue growth (new jobs)"       value={`+${s.queue_growth_events.toLocaleString()}`} />
        <Metric label="Queue reduction (completed)"   value={`-${s.queue_reduction_events.toLocaleString()}`} />
        <Metric label="Records → Authoritative"       value={s.records_promoted_to_authoritative.toString()} tone={s.records_promoted_to_authoritative > 0 ? "success" : "info"} />
        <MetricMaybe label="Records rejected"         maybe={s.records_rejected} formatter={(n) => n.toString()} />
        <Metric label="Contradictions opened"         value={s.contradictions_opened.toString()} tone={s.contradictions_opened > 0 ? "warn" : "info"} />
        <Metric label="Contradictions resolved"       value={s.contradictions_resolved.toString()} tone={s.contradictions_resolved > 0 ? "success" : "info"} />
        <Metric label="Peak processing hour"          value={s.peak_processing_hour ? `${new Date(s.peak_processing_hour.start_iso).toISOString().slice(11, 16)} UTC · ${s.peak_processing_hour.jobs} jobs` : "—"} />
      </div>
    </section>
  );
}

// ── Timeline panel ────────────────────────────────────────────────

function TimelinePanel({ audit }: { audit: WorkerActivityAudit }) {
  const buckets = audit.timeline;
  const maxJobs = Math.max(1, ...buckets.map((b) => b.jobs_completed));
  return (
    <section className="mt-8">
      <SectionTitle title="Hourly timeline" />
      <div
        className="mt-3 overflow-hidden rounded-2xl border"
        style={{ background: TOKEN.card, borderColor: TOKEN.border, boxShadow: TOKEN.shadowSm }}
      >
        {buckets.map((b, i) => {
          const barPct = (b.jobs_completed / maxJobs) * 100;
          return (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-2"
              style={{ borderTop: i === 0 ? "none" : `1px solid ${TOKEN.divider}` }}
            >
              <span className="w-[110px] flex-none font-mono text-[11px]" style={{ color: TOKEN.textSoft }}>
                {b.hour_label}
              </span>
              <div className="relative flex-1 overflow-hidden rounded-md" style={{ background: TOKEN.divider, height: 14 }}>
                <div
                  className="h-full"
                  style={{
                    width: `${barPct}%`,
                    background: b.jobs_failed > 0 ? TOKEN.warning : TOKEN.accent,
                  }}
                />
              </div>
              <span className="w-[70px] flex-none text-right font-mono text-[11px]" style={{ color: TOKEN.text }}>
                {b.jobs_completed.toLocaleString()} jobs
              </span>
              <span className="w-[60px] flex-none text-right font-mono text-[11px]" style={{ color: b.jobs_failed > 0 ? TOKEN.warning : TOKEN.textSoft }}>
                {b.jobs_failed > 0 ? `${b.jobs_failed} fail` : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Per-worker panel ──────────────────────────────────────────────

function PerWorkerPanel({ audit }: { audit: WorkerActivityAudit }) {
  return (
    <section className="mt-8">
      <SectionTitle title="Per-worker breakdown" />
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {audit.per_worker.map((w) => (
          <div
            key={w.worker_type}
            className="rounded-2xl border p-4"
            style={{ background: TOKEN.card, borderColor: TOKEN.border, boxShadow: TOKEN.shadowSm }}
          >
            <div className="flex items-baseline justify-between">
              <div className="text-[13px] font-black" style={{ color: TOKEN.text }}>
                {w.worker_type}
              </div>
              <div className="text-[11px]" style={{ color: TOKEN.textSoft }}>
                {w.jobs_completed} done · {w.jobs_failed} failed · {w.total_retries} retries
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
              <RowMaybe label="Success rate" maybe={w.success_pct} formatter={(n) => `${n.toFixed(1)}%`} />
              <RowMaybe label="Failure rate" maybe={w.failure_pct} formatter={(n) => `${n.toFixed(1)}%`} />
              <RowMaybe label="Avg job duration" maybe={w.avg_job_duration_ms} formatter={formatMs} />
              <RowMaybe label="Avg queue wait" maybe={w.avg_queue_wait_ms} formatter={formatMs} />
              <RowMaybe label="Longest job" maybe={w.max_job_duration_ms} formatter={formatMs} />
              <RowMaybe label="Shortest job" maybe={w.min_job_duration_ms} formatter={formatMs} />
              <RowMaybe label="Active processing" maybe={w.total_active_ms} formatter={formatMs} />
              <RowMaybe label="Time failed" maybe={w.total_time_failed_ms} formatter={formatMs} />
              <RowMaybe label="Idle time" maybe={w.total_idle_ms} formatter={formatMs} />
              <RowMaybe label="Wait for LLM providers" maybe={w.total_time_waiting_for_llm_providers_ms} formatter={formatMs} />
              <RowMaybe label="Wait for retries" maybe={w.total_time_waiting_for_retries_ms} formatter={formatMs} />
              <RowMaybe label="Provider failures" maybe={w.provider_failures} formatter={(n) => n.toString()} />
            </div>

            {/* Provider usage breakdown */}
            {w.provider_usage.length > 0 ? (
              <div className="mt-3">
                <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: TOKEN.textSoft }}>
                  Provider usage (successful calls)
                </div>
                <div className="mt-1 space-y-1">
                  {w.provider_usage.map((p) => (
                    <div key={p.provider} className="flex items-center gap-2 text-[11px]" style={{ color: TOKEN.textMid }}>
                      <span
                        className="rounded-full px-2 py-0.5 font-bold uppercase tracking-widest"
                        style={{
                          background: p.provider === "mock" ? "#FEE2E2" : TOKEN.divider,
                          color:      p.provider === "mock" ? "#991B1B" : TOKEN.textMid,
                          fontSize:   9,
                        }}
                      >
                        {p.provider}
                      </span>
                      <span className="flex-1 font-mono">{p.successes.toLocaleString()} calls</span>
                      {p.avg_ms != null ? <span className="font-mono">{p.avg_ms} ms avg</span> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Missing telemetry panel — first-class + prescriptive ─────────

function MissingTelemetryPanel({ audit }: { audit: WorkerActivityAudit }) {
  if (audit.missing_telemetry.length === 0) return null;
  return (
    <section className="mt-10">
      <SectionTitle title="Missing telemetry (prescriptions)" />
      <p className="mt-1 text-[12px]" style={{ color: TOKEN.textMid }}>
        These metrics cannot be computed from current telemetry. Below is exactly what to add to
        make the audit complete. Adding these enables the &quot;Not yet available&quot; fields above to
        become real numbers with no other UI change needed.
      </p>
      <div className="mt-3 space-y-3">
        {audit.missing_telemetry.map((m, i) => (
          <div
            key={i}
            className="rounded-2xl border p-4"
            style={{ background: "#FFFBEB", borderColor: "#F59E0B" }}
          >
            <div className="text-[13px] font-bold" style={{ color: "#92400E" }}>
              {m.metric}
            </div>
            <div className="mt-1 text-[12px]" style={{ color: "#78350F" }}>
              <span className="font-semibold">Why not available:</span> {m.reason}
            </div>
            <div className="mt-1 text-[12px]" style={{ color: "#78350F" }}>
              <span className="font-semibold">Prescription:</span> {m.prescription}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Footer metadata ───────────────────────────────────────────────

function FooterMeta({ audit, rowCounts }: { audit: WorkerActivityAudit; rowCounts: Record<string, number> | null }) {
  return (
    <div className="mt-8 text-[11px]" style={{ color: TOKEN.textSoft }}>
      Window: {audit.window.from} → {audit.window.to} ({audit.window.duration_hours}h) · generated {new Date(audit.generated_at).toLocaleString()}
      {rowCounts ? (
        <>
          {" · "}
          rows: jobs {rowCounts.jobs.toLocaleString()} · results {rowCounts.results.toLocaleString()} · heartbeats {rowCounts.cloud_workers.toLocaleString()} · contradictions {rowCounts.contradictions.toLocaleString()} · records {rowCounts.record_changes.toLocaleString()}
        </>
      ) : null}
    </div>
  );
}

// ── Reusable small components ─────────────────────────────────────

function SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="text-[16px] font-black tracking-tight" style={{ color: TOKEN.text }}>
      {title}
    </h2>
  );
}

function Metric({ label, value, tone = "info" }: { label: string; value: string; tone?: "info" | "success" | "warn" }) {
  const toneColour = tone === "success" ? TOKEN.success : tone === "warn" ? TOKEN.warning : TOKEN.text;
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: TOKEN.textSoft }}>
        {label}
      </div>
      <div className="mt-0.5 text-[16px] font-black" style={{ color: toneColour }}>
        {value}
      </div>
    </div>
  );
}

function MetricMaybe<T>({ label, maybe, formatter }: { label: string; maybe: Maybe<T>; formatter: (v: T) => string }) {
  if (maybe.available) {
    return <Metric label={label} value={formatter(maybe.value)} />;
  }
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: TOKEN.textSoft }}>
        {label}
      </div>
      <div className="mt-0.5 text-[11px] italic" style={{ color: TOKEN.warning }}>
        Not yet available
      </div>
      <div className="text-[10px]" style={{ color: TOKEN.textSoft }}>
        See prescriptions ↓
      </div>
    </div>
  );
}

function RowMaybe<T>({ label, maybe, formatter }: { label: string; maybe: Maybe<T>; formatter: (v: T) => string }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: TOKEN.textSoft }}>{label}</span>
      {maybe.available ? (
        <span className="font-mono" style={{ color: TOKEN.text }}>{formatter(maybe.value)}</span>
      ) : (
        <span className="text-[10px] italic" style={{ color: TOKEN.warning }} title={maybe.reason}>—</span>
      )}
    </div>
  );
}

// ── Formatters ────────────────────────────────────────────────────

function formatMs(ms: number): string {
  if (ms < 1000)          return `${Math.round(ms)} ms`;
  if (ms < 60_000)        return `${(ms / 1000).toFixed(1)} s`;
  if (ms < 3_600_000)     return `${(ms / 60_000).toFixed(1)} min`;
  return `${(ms / 3_600_000).toFixed(1)} h`;
}
