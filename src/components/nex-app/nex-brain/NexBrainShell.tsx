"use client";

// NexBrainShell — client surface for /nex-app/nex-brain.
//
// Composes:
//   · Hero + backend chip ("filesystem" or "supabase")
//   · Six stat cards (jobs waiting / in flight / completed 24h /
//     records authoritative / feedback lifetime / contradictions open)
//   · Worker pool table (per worker: waiting / in flight / done 24h)
//   · "Dispatch" + "Run one cycle" action buttons
//   · Recent records list (authoritative + under-review)
//   · Cycle report overlay after each run

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  Database,
  DownloadCloud,
  Feather,
  FileCheck,
  Flame,
  GitBranch,
  Inbox,
  Loader2,
  Play,
  RefreshCcw,
  ScanSearch,
  Send,
  Shield,
  Sparkles,
  Zap,
  X,
} from "lucide-react";
import type {
  BrainStatus,
  KnowledgeRecord,
  WorkerType,
} from "@/lib/nex/brain/types";

const TOKEN = {
  bg:           "var(--nex-cream)",
  surface:      "var(--nex-cream-elev)",
  card:         "var(--nex-neutral-0)",
  border:       "var(--nex-neutral-200)",
  divider:      "var(--nex-neutral-100)",
  text:         "var(--nex-neutral-900)",
  textSoft:     "var(--nex-neutral-500)",
  textMid:      "var(--nex-neutral-700)",
  accent:       "var(--nex-accent-500)",
  accentDark:   "var(--nex-accent-600)",
  accentSoft:   "var(--nex-accent-50)",
  accentPeach:  "var(--nex-accent-100)",
  success:      "var(--nex-success-500)",
  warning:      "var(--nex-warning-500)",
  info:         "var(--nex-info-500)",
  shadowSm:     "var(--nex-shadow-sm)",
  shadowMd:     "var(--nex-shadow-md)",
  shadowLg:     "var(--nex-shadow-lg)",
};

type Status = BrainStatus & { manager: { ready: boolean; last_dispatch_at: string | null } };
type CycleReport = {
  started_at: string;
  duration_ms: number;
  extracted_record_ids: string[];
  extraction_errors: string[];
  checked_records: Array<{ record_id: string; decision: string; confidence: number }>;
};
type GuardianReport = {
  started_at: string;
  duration_ms: number;
  records_scanned: number;
  edges_scanned: number;
  contradictions_created: number;
  audit_entries_created: number;
  findings: Array<{
    kind: string;
    severity: "low" | "medium" | "high";
    record_ids: string[];
    summary: string;
    suggested_action?: string;
  }>;
};
type ImportReport = {
  scanned: number;
  imported: number;
  updated: number;
  skipped_already_up_to_date: number;
  edges_created: number;
  claims_created: number;
  errors: Array<{ file: string; error: string }>;
};
type LlmVerify = {
  ok: boolean;
  provider: string;
  model?: string;
  is_real: boolean;
  response_text?: string;
  ms?: number;
  error?: string;
};
type Toast = { kind: "info" | "error" | "success"; message: string } | null;

const WORKER_LABEL: Record<WorkerType, { label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; color: string }> = {
  "knowledge-extractor": { label: "Knowledge Extractor", icon: BrainCircuit, color: TOKEN.accent },
  "quality-checker":     { label: "Quality Checker",     icon: FileCheck,    color: TOKEN.info },
  "memory-guardian":     { label: "Memory Guardian",     icon: Shield,       color: TOKEN.warning },
};

export function NexBrainShell() {
  const [status, setStatus] = useState<Status | null>(null);
  const [records, setRecords] = useState<KnowledgeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDispatching, setIsDispatching] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isGuardianRunning, setIsGuardianRunning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [lastCycle, setLastCycle] = useState<CycleReport | null>(null);
  const [lastGuardian, setLastGuardian] = useState<GuardianReport | null>(null);
  const [lastImport, setLastImport] = useState<ImportReport | null>(null);
  const [llm, setLlm] = useState<LlmVerify | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  const showToast = useCallback((next: NonNullable<Toast>) => {
    setToast(next);
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [statusRes, recordsRes, llmRes] = await Promise.all([
        fetch("/api/nex/brain/status", { cache: "no-store" }),
        fetch("/api/nex/brain/records?limit=30", { cache: "no-store" }),
        fetch("/api/nex/brain/verify-llm", { cache: "no-store" }),
      ]);
      if (statusRes.ok) {
        const j = await statusRes.json();
        if (j.ok) setStatus(j.status as Status);
      }
      if (recordsRes.ok) {
        const j = await recordsRes.json();
        if (j.ok) setRecords(j.records as KnowledgeRecord[]);
      }
      if (llmRes) {
        try {
          const j = await llmRes.json();
          setLlm(j as LlmVerify);
        } catch {
          /* verify-llm may 500 if the key is bad — leave llm as null */
        }
      }
    } catch (err) {
      console.error("[nex-brain] refresh failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleDispatch = useCallback(async () => {
    setIsDispatching(true);
    try {
      const res = await fetch("/api/nex/brain/dispatch", { method: "POST" });
      const j = await res.json();
      if (j.ok) {
        showToast({
          kind: "success",
          message: `Enqueued ${j.enqueued} · skipped ${j.skipped_already_queued + j.skipped_not_text_yet}`,
        });
      } else {
        throw new Error("dispatch not ok");
      }
    } catch (err) {
      console.error("[nex-brain] dispatch failed:", err);
      showToast({ kind: "error", message: "Dispatch failed." });
    } finally {
      setIsDispatching(false);
      refresh();
    }
  }, [refresh, showToast]);

  const handleRunGuardian = useCallback(async () => {
    setIsGuardianRunning(true);
    try {
      const res = await fetch("/api/nex/brain/guardian", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await res.json();
      if (j.ok) {
        setLastGuardian(j.report as GuardianReport);
        showToast({
          kind: "info",
          message: `Guardian: ${j.report.findings.length} finding${j.report.findings.length === 1 ? "" : "s"} · ${j.report.contradictions_created} contradiction${j.report.contradictions_created === 1 ? "" : "s"}`,
        });
      } else {
        throw new Error("guardian not ok");
      }
    } catch (err) {
      console.error("[nex-brain] guardian failed:", err);
      showToast({ kind: "error", message: "Guardian audit failed." });
    } finally {
      setIsGuardianRunning(false);
      refresh();
    }
  }, [refresh, showToast]);

  const handleImport = useCallback(async () => {
    setIsImporting(true);
    try {
      const res = await fetch("/api/nex/brain/import-existing", { method: "POST" });
      const j = await res.json();
      if (j.ok) {
        setLastImport(j.report as ImportReport);
        showToast({
          kind: "success",
          message: `Imported ${j.report.imported} new · ${j.report.updated} updated · ${j.report.skipped_already_up_to_date} skipped`,
        });
      } else {
        throw new Error("import not ok");
      }
    } catch (err) {
      console.error("[nex-brain] import failed:", err);
      showToast({ kind: "error", message: "Import failed." });
    } finally {
      setIsImporting(false);
      refresh();
    }
  }, [refresh, showToast]);

  const handleRunOnce = useCallback(async () => {
    setIsRunning(true);
    try {
      const res = await fetch("/api/nex/brain/run-once", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await res.json();
      if (j.ok) {
        setLastCycle(j.cycle as CycleReport);
        showToast({
          kind: "info",
          message: `Cycle: ${j.cycle.extracted_record_ids.length} drafted · ${j.cycle.checked_records.length} checked`,
        });
      } else {
        throw new Error("cycle not ok");
      }
    } catch (err) {
      console.error("[nex-brain] run cycle failed:", err);
      showToast({ kind: "error", message: "Cycle failed." });
    } finally {
      setIsRunning(false);
      refresh();
    }
  }, [refresh, showToast]);

  return (
    <div className="relative min-h-screen" style={{ background: TOKEN.bg, color: TOKEN.text }}>
      <div className="mx-auto max-w-[1120px] px-5 pb-24 pt-8 md:px-8 md:pt-12">
        <Hero backend={status?.backend ?? "filesystem"} llm={llm} />

        <StatStrip status={status} loading={loading} />

        <ActionRow
          onDispatch={handleDispatch}
          onRunOnce={handleRunOnce}
          onRunGuardian={handleRunGuardian}
          onImport={handleImport}
          isDispatching={isDispatching}
          isRunning={isRunning}
          isGuardianRunning={isGuardianRunning}
          isImporting={isImporting}
          onRefresh={refresh}
        />

        <WorkerPoolSection status={status} loading={loading} />

        <RecordsSection records={records} loading={loading} />
      </div>

      <AnimatePresence>
        {lastCycle ? <CycleOverlay cycle={lastCycle} onClose={() => setLastCycle(null)} /> : null}
      </AnimatePresence>

      <AnimatePresence>
        {lastGuardian ? <GuardianOverlay report={lastGuardian} onClose={() => setLastGuardian(null)} /> : null}
      </AnimatePresence>

      <AnimatePresence>
        {lastImport ? <ImportOverlay report={lastImport} onClose={() => setLastImport(null)} /> : null}
      </AnimatePresence>

      <AnimatePresence>
        {toast ? <ToastBanner toast={toast} /> : null}
      </AnimatePresence>
    </div>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────

function Hero({ backend, llm }: { backend: "filesystem" | "supabase"; llm: LlmVerify | null }) {
  return (
    <header>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em]"
          style={{ background: TOKEN.accentSoft, borderColor: TOKEN.accentPeach, color: TOKEN.accentDark }}
        >
          <BrainCircuit size={12} strokeWidth={2.4} />
          NEX · Brain
        </span>
        <BackendChip backend={backend} />
        <LlmChip llm={llm} />
      </div>
      <h1 className="mt-4 text-[36px] font-black leading-[1.05] tracking-tight md:text-[46px]" style={{ color: TOKEN.text }}>
        NEX Manager
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed md:text-base" style={{ color: TOKEN.textMid }}>
        Three-role architecture · Knowledge Extractor · Quality Checker · Memory Guardian.
        The manager routes; the workers author, verify, and audit.
      </p>
    </header>
  );
}

function BackendChip({ backend }: { backend: "filesystem" | "supabase" }) {
  const isSupabase = backend === "supabase";
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em]"
      style={{
        background: isSupabase ? "#DBEAFE" : TOKEN.divider,
        borderColor: isSupabase ? "#93C5FD" : TOKEN.border,
        color: isSupabase ? "#1D4ED8" : TOKEN.textMid,
      }}
    >
      <Database size={11} strokeWidth={2.4} />
      {isSupabase ? "Supabase live" : "Filesystem (dev)"}
    </span>
  );
}

function LlmChip({ llm }: { llm: LlmVerify | null }) {
  if (!llm) {
    return (
      <span
        className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em]"
        style={{ background: TOKEN.divider, borderColor: TOKEN.border, color: TOKEN.textSoft }}
      >
        <Zap size={11} strokeWidth={2.4} />
        LLM checking…
      </span>
    );
  }
  const isReal = llm.is_real === true;
  const label = isReal
    ? `${llm.provider}${llm.model ? ` · ${llm.model.split("-").slice(0, 3).join("-")}` : ""}`
    : "mock (no API key)";
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em]"
      style={{
        background: isReal ? "#D1FAE5" : TOKEN.divider,
        borderColor: isReal ? "#6EE7B7" : TOKEN.border,
        color: isReal ? "#065F46" : TOKEN.textMid,
      }}
      title={isReal ? `Response ok in ${llm.ms}ms` : "Add GROQ_API_KEY / GOOGLE_GEMINI_API_KEY to .env.local for real inference"}
    >
      <Zap size={11} strokeWidth={2.4} />
      {label}
    </span>
  );
}

// ── Stat strip ───────────────────────────────────────────────────────

function StatStrip({ status, loading }: { status: Status | null; loading: boolean }) {
  const s = status;
  const cards: Array<{ label: string; value: number; tone: "info" | "warning" | "success" | "accent" | "neutral"; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }> = [
    { label: "Jobs waiting",           value: s?.jobs_waiting ?? 0,           tone: "neutral", icon: Inbox },
    { label: "In flight",              value: s?.jobs_in_flight ?? 0,         tone: "info",    icon: Activity },
    { label: "Completed 24h",          value: s?.jobs_completed_24h ?? 0,     tone: "success", icon: CheckCircle2 },
    { label: "Records authoritative",  value: s?.records_authoritative ?? 0,  tone: "accent",  icon: Sparkles },
    { label: "Under review",           value: s?.records_under_review ?? 0,   tone: "warning", icon: AlertTriangle },
    { label: "Contradictions open",    value: s?.contradictions_open ?? 0,    tone: "warning", icon: GitBranch },
    { label: "Feedback (lifetime)",    value: s?.feedback_total_lifetime ?? 0,tone: "accent",  icon: Feather },
    { label: "LLM calls 24h",          value: s?.llm_calls_24h ?? 0,          tone: "neutral", icon: Cpu },
  ];
  return (
    <section className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      {cards.map((c) => (
        <StatCard key={c.label} label={c.label} value={c.value} tone={c.tone} icon={c.icon} loading={loading} />
      ))}
    </section>
  );
}

function StatCard({
  label, value, tone, icon: Icon, loading,
}: {
  label: string;
  value: number;
  tone: "info" | "warning" | "success" | "accent" | "neutral";
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  loading?: boolean;
}) {
  const colour = {
    info: TOKEN.info, warning: TOKEN.warning, success: TOKEN.success, accent: TOKEN.accentDark, neutral: TOKEN.textMid,
  }[tone];
  return (
    <motion.div layout className="rounded-2xl border p-4" style={{ background: TOKEN.card, borderColor: TOKEN.border, boxShadow: TOKEN.shadowSm }}>
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: TOKEN.textSoft }}>
          {label}
        </div>
        <Icon size={13} strokeWidth={2.2} style={{ color: colour }} />
      </div>
      {loading ? (
        <div className="nex-skeleton mt-2 h-7 w-14 rounded-md" aria-hidden />
      ) : (
        <div className="mt-2 text-[26px] font-black leading-none tracking-tight" style={{ color: colour }}>
          {value.toLocaleString()}
        </div>
      )}
    </motion.div>
  );
}

// ── Action row ───────────────────────────────────────────────────────

function ActionRow({
  onDispatch, onRunOnce, onRunGuardian, onImport,
  isDispatching, isRunning, isGuardianRunning, isImporting,
  onRefresh,
}: {
  onDispatch: () => void;
  onRunOnce: () => void;
  onRunGuardian: () => void;
  onImport: () => void;
  isDispatching: boolean;
  isRunning: boolean;
  isGuardianRunning: boolean;
  isImporting: boolean;
  onRefresh: () => void;
}) {
  return (
    <section className="mt-8 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onDispatch}
        disabled={isDispatching}
        className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors disabled:opacity-50"
        style={{ background: TOKEN.card, borderColor: TOKEN.border, color: TOKEN.text }}
      >
        {isDispatching ? <Loader2 size={14} strokeWidth={2.3} className="animate-spin" /> : <Send size={14} strokeWidth={2.3} />}
        Dispatch inbox → queue
      </button>
      <button
        type="button"
        onClick={onRunOnce}
        disabled={isRunning}
        className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-[13px] font-bold text-white shadow-md transition-all disabled:opacity-60"
        style={{ background: `linear-gradient(135deg, ${TOKEN.accent} 0%, ${TOKEN.accentDark} 100%)` }}
      >
        {isRunning ? <Loader2 size={14} strokeWidth={2.3} className="animate-spin" /> : <Play size={14} strokeWidth={2.3} />}
        Run one cycle
      </button>
      <button
        type="button"
        onClick={onRunGuardian}
        disabled={isGuardianRunning}
        className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors disabled:opacity-50"
        style={{
          background: TOKEN.card,
          borderColor: TOKEN.warning,
          color: TOKEN.warning,
        }}
        title="Run Memory Guardian audit (duplicates · under-connected · confidence rot · broken refs)"
      >
        {isGuardianRunning ? <Loader2 size={14} strokeWidth={2.3} className="animate-spin" /> : <ScanSearch size={14} strokeWidth={2.3} />}
        Run Guardian audit
      </button>
      <button
        type="button"
        onClick={onImport}
        disabled={isImporting}
        className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors disabled:opacity-50"
        style={{ background: TOKEN.card, borderColor: TOKEN.border, color: TOKEN.text }}
        title="Import existing governed records from data/knowledge/records/"
      >
        {isImporting ? <Loader2 size={14} strokeWidth={2.3} className="animate-spin" /> : <DownloadCloud size={14} strokeWidth={2.3} />}
        Import existing records
      </button>
      <button
        type="button"
        onClick={onRefresh}
        className="ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors hover:bg-black/5"
        style={{ background: TOKEN.card, borderColor: TOKEN.border, color: TOKEN.textMid }}
        aria-label="Refresh"
      >
        <RefreshCcw size={12} strokeWidth={2.2} />
        Refresh
      </button>
    </section>
  );
}

// ── Worker pool ──────────────────────────────────────────────────────

function WorkerPoolSection({ status, loading }: { status: Status | null; loading: boolean }) {
  const pool = status?.worker_pool ?? [];
  return (
    <section className="mt-10">
      <h2 className="text-[18px] font-black tracking-tight" style={{ color: TOKEN.text }}>
        Worker Pool
      </h2>
      <p className="mt-1 text-[12px]" style={{ color: TOKEN.textSoft }}>
        Real-time workers (Extractor + Checker) plus the batch Memory Guardian (Phase 1.5).
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {(pool.length ? pool : PLACEHOLDER_POOL).map((w) => (
          <WorkerCard key={w.worker_type} pool={w} loading={loading} />
        ))}
      </div>
    </section>
  );
}

const PLACEHOLDER_POOL: Status["worker_pool"] = [
  { worker_type: "knowledge-extractor", jobs_waiting: 0, jobs_in_flight: 0, jobs_completed_24h: 0 },
  { worker_type: "quality-checker",     jobs_waiting: 0, jobs_in_flight: 0, jobs_completed_24h: 0 },
  { worker_type: "memory-guardian",     jobs_waiting: 0, jobs_in_flight: 0, jobs_completed_24h: 0 },
];

function WorkerCard({ pool, loading }: { pool: Status["worker_pool"][number]; loading: boolean }) {
  const meta = WORKER_LABEL[pool.worker_type];
  const Icon = meta.icon;
  return (
    <div className="rounded-2xl border p-4" style={{ background: TOKEN.card, borderColor: TOKEN.border, boxShadow: TOKEN.shadowSm }}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: TOKEN.accentSoft, color: meta.color }}>
            <Icon size={16} strokeWidth={2} />
          </div>
          <div>
            <div className="text-[14px] font-bold" style={{ color: TOKEN.text }}>{meta.label}</div>
            <div className="text-[11px] uppercase tracking-widest" style={{ color: TOKEN.textSoft }}>{pool.worker_type}</div>
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <MetricPill label="Wait" value={pool.jobs_waiting} tone="neutral" loading={loading} />
        <MetricPill label="Live" value={pool.jobs_in_flight} tone="info" loading={loading} />
        <MetricPill label="24h" value={pool.jobs_completed_24h} tone="success" loading={loading} />
      </div>
      {pool.last_activity_at ? (
        <div className="mt-3 flex items-center gap-1.5 text-[11px]" style={{ color: TOKEN.textSoft }}>
          <Clock size={11} strokeWidth={2.2} />
          Last activity: {new Date(pool.last_activity_at).toLocaleTimeString()}
        </div>
      ) : null}
    </div>
  );
}

function MetricPill({ label, value, tone, loading }: { label: string; value: number; tone: "neutral" | "info" | "success"; loading?: boolean }) {
  const c = { neutral: TOKEN.textMid, info: TOKEN.info, success: TOKEN.success }[tone];
  return (
    <div className="rounded-xl border p-2" style={{ background: TOKEN.surface, borderColor: TOKEN.border }}>
      <div className="text-[9px] uppercase tracking-widest" style={{ color: TOKEN.textSoft }}>{label}</div>
      {loading ? <div className="nex-skeleton mx-auto mt-1 h-5 w-8 rounded" /> : (
        <div className="text-[18px] font-black" style={{ color: c }}>{value.toLocaleString()}</div>
      )}
    </div>
  );
}

// ── Records section ──────────────────────────────────────────────────

function RecordsSection({ records, loading }: { records: KnowledgeRecord[]; loading: boolean }) {
  return (
    <section className="mt-12">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-[18px] font-black tracking-tight" style={{ color: TOKEN.text }}>Recent Records</h2>
        <span className="text-[12px]" style={{ color: TOKEN.textSoft }}>
          {records.length.toLocaleString()} shown
        </span>
      </div>
      {loading ? (
        <div className="rounded-2xl border p-6 text-center" style={{ background: TOKEN.card, borderColor: TOKEN.border }}>
          <div className="nex-skeleton mx-auto h-4 w-40 rounded" />
        </div>
      ) : records.length === 0 ? (
        <EmptyRecords />
      ) : (
        <ul className="flex flex-col gap-2">
          {records.map((r) => (
            <li key={r.id} className="rounded-2xl border p-4" style={{ background: TOKEN.card, borderColor: TOKEN.border, boxShadow: TOKEN.shadowSm }}>
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip status={r.status} />
                <span className="text-[11px] uppercase tracking-widest" style={{ color: TOKEN.textSoft }}>
                  {r.primary_audience}
                </span>
                <span className="text-[11px]" style={{ color: TOKEN.textSoft }}>
                  · {new Date(r.created_at).toLocaleString()}
                </span>
              </div>
              <div className="mt-1.5 text-[14px] font-semibold" style={{ color: TOKEN.text }}>{r.title}</div>
              <div className="mt-1 line-clamp-2 text-[12px]" style={{ color: TOKEN.textSoft }}>{r.summary}</div>
              <div className="mt-2 text-[11px]" style={{ color: TOKEN.textSoft }}>
                <span className="rounded-full border px-2 py-0.5" style={{ background: TOKEN.divider, borderColor: TOKEN.border }}>
                  {r.category}
                </span>
                <span className="ml-2">{r.record_id}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EmptyRecords() {
  return (
    <div className="rounded-3xl border p-10 text-center" style={{ background: TOKEN.card, borderColor: TOKEN.border, boxShadow: TOKEN.shadowSm }}>
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl" style={{ background: TOKEN.accentSoft, color: TOKEN.accentDark }}>
        <Flame size={26} strokeWidth={1.6} />
      </div>
      <div className="mt-4 text-[16px] font-semibold" style={{ color: TOKEN.text }}>Corpus is empty.</div>
      <div className="mt-1 text-[13px]" style={{ color: TOKEN.textSoft }}>
        Dump content into the Knowledge Inbox, click Dispatch, then Run one cycle.
      </div>
    </div>
  );
}

const STATUS_STYLE: Record<KnowledgeRecord["status"], { label: string; bg: string; fg: string }> = {
  DRAFT:         { label: "Draft",         bg: "#EDECEA", fg: "#3D3D38" },
  UNDER_REVIEW:  { label: "Under review",  bg: "#FED7AA", fg: "#9A3412" },
  AUTHORITATIVE: { label: "Authoritative", bg: "#D1FAE5", fg: "#065F46" },
  DEPRECATED:    { label: "Deprecated",    bg: "#FEE2E2", fg: "#991B1B" },
  SUPERSEDED:    { label: "Superseded",    bg: "#E5E7EB", fg: "#374151" },
};

function StatusChip({ status }: { status: KnowledgeRecord["status"] }) {
  const s = STATUS_STYLE[status];
  return (
    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
}

// ── Cycle overlay ────────────────────────────────────────────────────

function CycleOverlay({ cycle, onClose }: { cycle: CycleReport; onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <button type="button" aria-label="Close" className="absolute inset-0" onClick={onClose} style={{ background: "rgba(15,17,21,0.4)" }} />
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 12 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[560px] rounded-3xl border p-6 md:p-7"
        style={{ background: TOKEN.card, borderColor: TOKEN.border, boxShadow: TOKEN.shadowLg }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: TOKEN.accentDark }}>
              Cycle Report
            </div>
            <div className="mt-1 text-[22px] font-black tracking-tight" style={{ color: TOKEN.text }}>
              {cycle.extracted_record_ids.length} drafted · {cycle.checked_records.length} checked
            </div>
            <div className="mt-1 text-[12px]" style={{ color: TOKEN.textSoft }}>
              {cycle.duration_ms}ms · started {new Date(cycle.started_at).toLocaleTimeString()}
            </div>
          </div>
          <button type="button" aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-black/5" onClick={onClose} style={{ color: TOKEN.textMid }}>
            <X size={17} strokeWidth={2} />
          </button>
        </div>
        {cycle.checked_records.length > 0 && (
          <div className="mt-4">
            <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: TOKEN.textSoft }}>Decisions</div>
            <ul className="mt-2 space-y-2">
              {cycle.checked_records.map((c) => (
                <li key={c.record_id} className="flex items-center justify-between rounded-2xl border p-2.5" style={{ background: TOKEN.surface, borderColor: TOKEN.border }}>
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-semibold" style={{ color: TOKEN.text }}>{c.record_id}</div>
                    <div className="text-[11px]" style={{ color: TOKEN.textSoft }}>confidence {(c.confidence * 100).toFixed(0)}%</div>
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
                    style={{
                      background:
                        c.decision === "AUTHORITATIVE" ? "#D1FAE5" :
                        c.decision === "UNDER_REVIEW" ? "#FED7AA" : "#FEE2E2",
                      color:
                        c.decision === "AUTHORITATIVE" ? "#065F46" :
                        c.decision === "UNDER_REVIEW" ? "#9A3412" : "#991B1B",
                    }}
                  >
                    {c.decision}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-[13px] font-semibold text-white" style={{ background: TOKEN.accent }}>
            <ChevronRight size={13} strokeWidth={2.4} />
            Done
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Guardian overlay ─────────────────────────────────────────────────

function GuardianOverlay({ report, onClose }: { report: GuardianReport; onClose: () => void }) {
  const severityStyle: Record<"low" | "medium" | "high", { bg: string; fg: string }> = {
    low:    { bg: "#EDECEA", fg: "#3D3D38" },
    medium: { bg: "#FED7AA", fg: "#9A3412" },
    high:   { bg: "#FEE2E2", fg: "#991B1B" },
  };
  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <button type="button" aria-label="Close" className="absolute inset-0" onClick={onClose} style={{ background: "rgba(15,17,21,0.4)" }} />
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 12 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[640px] rounded-3xl border p-6 md:p-7"
        style={{ background: TOKEN.card, borderColor: TOKEN.border, boxShadow: TOKEN.shadowLg }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: TOKEN.warning }}>
              Memory Guardian
            </div>
            <div className="mt-1 text-[22px] font-black tracking-tight" style={{ color: TOKEN.text }}>
              {report.findings.length} finding{report.findings.length === 1 ? "" : "s"}
            </div>
            <div className="mt-1 text-[12px]" style={{ color: TOKEN.textSoft }}>
              Scanned {report.records_scanned} records · {report.edges_scanned} edges · {report.duration_ms}ms
            </div>
          </div>
          <button type="button" aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-black/5" onClick={onClose} style={{ color: TOKEN.textMid }}>
            <X size={17} strokeWidth={2} />
          </button>
        </div>

        {report.findings.length === 0 ? (
          <div className="mt-6 rounded-2xl border p-6 text-center" style={{ background: TOKEN.surface, borderColor: TOKEN.border }}>
            <CheckCircle2 size={32} strokeWidth={1.5} style={{ color: TOKEN.success }} className="mx-auto" />
            <div className="mt-3 text-[15px] font-semibold" style={{ color: TOKEN.text }}>Corpus is clean.</div>
            <div className="mt-1 text-[12px]" style={{ color: TOKEN.textSoft }}>
              No duplicates, no confidence rot, no broken references. Nothing for you to do.
            </div>
          </div>
        ) : (
          <ul className="mt-5 max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {report.findings.map((f, i) => (
              <li key={i} className="rounded-2xl border p-3" style={{ background: TOKEN.surface, borderColor: TOKEN.border }}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest" style={{ background: severityStyle[f.severity].bg, color: severityStyle[f.severity].fg }}>
                    {f.severity}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: TOKEN.textSoft }}>
                    {f.kind}
                  </span>
                </div>
                <div className="mt-1 text-[13px]" style={{ color: TOKEN.text }}>{f.summary}</div>
                {f.suggested_action ? (
                  <div className="mt-1 text-[11px] italic" style={{ color: TOKEN.textSoft }}>
                    → {f.suggested_action}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex justify-end">
          <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-[13px] font-semibold text-white" style={{ background: TOKEN.warning }}>
            <ChevronRight size={13} strokeWidth={2.4} />
            Done
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Import overlay ───────────────────────────────────────────────────

function ImportOverlay({ report, onClose }: { report: ImportReport; onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <button type="button" aria-label="Close" className="absolute inset-0" onClick={onClose} style={{ background: "rgba(15,17,21,0.4)" }} />
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 12 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[560px] rounded-3xl border p-6 md:p-7"
        style={{ background: TOKEN.card, borderColor: TOKEN.border, boxShadow: TOKEN.shadowLg }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: TOKEN.accentDark }}>
              Existing Records Import
            </div>
            <div className="mt-1 text-[22px] font-black tracking-tight" style={{ color: TOKEN.text }}>
              {report.imported} imported · {report.updated} updated
            </div>
            <div className="mt-1 text-[12px]" style={{ color: TOKEN.textSoft }}>
              Scanned {report.scanned} markdown files · skipped {report.skipped_already_up_to_date} unchanged
            </div>
          </div>
          <button type="button" aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-black/5" onClick={onClose} style={{ color: TOKEN.textMid }}>
            <X size={17} strokeWidth={2} />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <ImportStat label="Records" value={report.imported} tone="success" />
          <ImportStat label="Edges" value={report.edges_created} tone="info" />
          <ImportStat label="Claims" value={report.claims_created} tone="accent" />
        </div>

        {report.errors.length > 0 && (
          <div className="mt-5">
            <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: TOKEN.warning }}>
              {report.errors.length} error{report.errors.length === 1 ? "" : "s"}
            </div>
            <ul className="mt-2 max-h-[160px] space-y-1 overflow-y-auto text-[11px]">
              {report.errors.slice(0, 20).map((e, i) => (
                <li key={i} className="rounded-lg border p-2" style={{ background: "#FEE2E2", borderColor: "#FCA5A5", color: "#991B1B" }}>
                  <span className="font-mono">{e.file}</span>: {e.error}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-[13px] font-semibold text-white" style={{ background: TOKEN.accent }}>
            <ChevronRight size={13} strokeWidth={2.4} />
            Done
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ImportStat({ label, value, tone }: { label: string; value: number; tone: "success" | "info" | "accent" }) {
  const c = { success: TOKEN.success, info: TOKEN.info, accent: TOKEN.accentDark }[tone];
  return (
    <div className="rounded-2xl border p-3" style={{ background: TOKEN.surface, borderColor: TOKEN.border }}>
      <div className="text-[10px] uppercase tracking-widest" style={{ color: TOKEN.textSoft }}>{label}</div>
      <div className="mt-1 text-[22px] font-black" style={{ color: c }}>{value.toLocaleString()}</div>
    </div>
  );
}

// ── Toast ────────────────────────────────────────────────────────────

function ToastBanner({ toast }: { toast: NonNullable<Toast> }) {
  const bg = toast.kind === "error" ? "#FEE2E2" : toast.kind === "success" ? "#D1FAE5" : TOKEN.card;
  const border = toast.kind === "error" ? "#EF4444" : toast.kind === "success" ? "#10B981" : TOKEN.border;
  const color = toast.kind === "error" ? "#991B1B" : toast.kind === "success" ? "#065F46" : TOKEN.text;
  return (
    <motion.div
      initial={{ y: 32, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 32, opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-0 bottom-5 z-40 mx-auto flex max-w-[420px] items-center gap-2 rounded-full border px-4 py-2.5 text-[13px] font-semibold"
      style={{ background: bg, borderColor: border, color, boxShadow: TOKEN.shadowMd }}
    >
      {toast.kind === "error" ? <AlertTriangle size={15} strokeWidth={2.3} /> : <CheckCircle2 size={15} strokeWidth={2.3} />}
      {toast.message}
    </motion.div>
  );
}
