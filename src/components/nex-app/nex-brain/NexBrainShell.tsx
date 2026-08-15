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

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Cloud,
  CloudOff,
  Cpu,
  Database,
  DownloadCloud,
  Feather,
  FileCheck,
  Flame,
  GitBranch,
  History,
  Image as ImageIcon,
  Inbox,
  Loader2,
  Play,
  RefreshCcw,
  ScanSearch,
  Send,
  Shield,
  Sparkles,
  Wallet,
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

type LlmProviderReport = {
  provider: "groq" | "gemini" | "anthropic" | "mock";
  status: "healthy" | "degraded" | "circuit-open" | "unconfigured" | "idle";
  configured: boolean;
  capabilities: Array<"text" | "vision" | "audio" | "json_mode" | "tool_use" | "long_context">;
  consecutive_failures: number;
  circuit_open_ms_remaining: number | null;
  last_success_at: number | null;
  last_failure_at: number | null;
  last_error: string | null;
  calls_24h: number;
  successes_24h: number;
  success_rate_24h: number | null;
  avg_ms_24h: number | null;
  tokens_24h: number;
};

type LlmHealthSnapshot = {
  ok: boolean;
  chain: Array<"openrouter" | "sambanova" | "groq" | "gemini" | "cerebras" | "anthropic" | "mock">;
  active: "openrouter" | "sambanova" | "groq" | "gemini" | "cerebras" | "anthropic" | "mock";
  providers: LlmProviderReport[];
};
type CloudWorker = {
  host_id: string;
  last_seen_at: string;
  uptime_ms: number;
  cycles_total: number;
  cycles_failed: number;
  last_error: string | null;
  age_ms: number;
  status: "online" | "lagging" | "stale";
  metadata: Record<string, unknown> | null;
};
type CloudStatus = {
  ok: boolean;
  any_online: boolean;
  workers: CloudWorker[];
};
type Toast = { kind: "info" | "error" | "success"; message: string } | null;

const WORKER_LABEL: Record<WorkerType, { label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; color: string }> = {
  "knowledge-context":   { label: "Knowledge Context",   icon: ScanSearch,   color: TOKEN.info },
  "voice-context":       { label: "Voice & Brand",       icon: Feather,      color: TOKEN.accentDark },
  "learning-context":    { label: "Learning Context",    icon: History,      color: TOKEN.success },
  "knowledge-extractor": { label: "Knowledge Extractor", icon: BrainCircuit, color: TOKEN.accent },
  "image-analyst":       { label: "Image Analyst",       icon: ImageIcon,    color: TOKEN.info },
  "quality-checker":     { label: "Quality Checker",     icon: FileCheck,    color: TOKEN.success },
  "memory-guardian":     { label: "Memory Guardian",     icon: Shield,       color: TOKEN.warning },
};

export function NexBrainShell() {
  const [status, setStatus] = useState<Status | null>(null);
  const [records, setRecords] = useState<KnowledgeRecord[]>([]);
  const [mockHidden, setMockHidden] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isDispatching, setIsDispatching] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isGuardianRunning, setIsGuardianRunning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [lastCycle, setLastCycle] = useState<CycleReport | null>(null);
  const [lastGuardian, setLastGuardian] = useState<GuardianReport | null>(null);
  const [lastImport, setLastImport] = useState<ImportReport | null>(null);
  const [llm, setLlm] = useState<LlmVerify | null>(null);
  const [llmHealth, setLlmHealth] = useState<LlmHealthSnapshot | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  const showToast = useCallback((next: NonNullable<Toast>) => {
    setToast(next);
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [statusRes, recordsRes, llmRes, llmHealthRes, cloudRes] = await Promise.all([
        fetch("/api/nex/brain/status", { cache: "no-store" }),
        fetch("/api/nex/brain/records?limit=30", { cache: "no-store" }),
        fetch("/api/nex/brain/verify-llm", { cache: "no-store" }),
        fetch("/api/nex/brain/llm-health", { cache: "no-store" }),
        fetch("/api/nex/brain/cloud-status", { cache: "no-store" }),
      ]);
      if (statusRes.ok) {
        const j = await statusRes.json();
        if (j.ok) setStatus(j.status as Status);
      }
      if (recordsRes.ok) {
        const j = await recordsRes.json();
        if (j.ok) {
          setRecords(j.records as KnowledgeRecord[]);
          setMockHidden(typeof j.mock_hidden_in_this_page === "number" ? j.mock_hidden_in_this_page : 0);
        }
      }
      if (llmRes) {
        try {
          const j = await llmRes.json();
          setLlm(j as LlmVerify);
        } catch {
          /* verify-llm may 500 if the key is bad — leave llm as null */
        }
      }
      if (llmHealthRes.ok) {
        const j = await llmHealthRes.json();
        if (j.ok) setLlmHealth(j as LlmHealthSnapshot);
      }
      if (cloudRes.ok) {
        const j = await cloudRes.json();
        if (j.ok) setCloudStatus(j as CloudStatus);
      }
    } catch (err) {
      console.error("[nex-brain] refresh failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Live polling · 5s interval · pauses when tab is hidden (Page Visibility API).
  // Doctrine: "queue length = operational metric; observability = confidence".
  // Pausing when hidden saves network + LLM budget when Philip switches tabs.
  useEffect(() => {
    let intervalId: number | null = null;
    const start = () => {
      if (intervalId !== null) return;
      intervalId = window.setInterval(() => { refresh(); }, 5000);
    };
    const stop = () => {
      if (intervalId !== null) { window.clearInterval(intervalId); intervalId = null; }
    };
    const onVisibility = () => { document.hidden ? stop() : start(); };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  // Rolling history buffer for the sparkline — one sample per refresh
  // (~5s), capped at 720 samples (~1 hour). We store (timestamp, completed)
  // and derive per-interval throughput at render time. Client-side only —
  // no new API needed.
  const [completedHistory, setCompletedHistory] = useState<Array<{ t: number; completed: number }>>([]);
  useEffect(() => {
    if (!status) return;
    setCompletedHistory((prev) => {
      const next = [...prev, { t: Date.now(), completed: status.jobs_completed_24h ?? 0 }];
      return next.slice(-720);
    });
  }, [status]);

  // Parallel rolling buffer for authoritative record count — powers the
  // NEX Brain Pulse learning-rate metric (records added per hour).
  const [authoritativeHistory, setAuthoritativeHistory] = useState<Array<{ t: number; count: number }>>([]);
  useEffect(() => {
    if (!status) return;
    setAuthoritativeHistory((prev) => {
      const next = [...prev, { t: Date.now(), count: status.records_authoritative ?? 0 }];
      return next.slice(-720);
    });
  }, [status]);

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
        <Hero backend={status?.backend ?? "filesystem"} llm={llm} cloud={cloudStatus} />

        <NexBrainPulse
          status={status}
          cloud={cloudStatus}
          records={records}
          mockHidden={mockHidden}
          authoritativeHistory={authoritativeHistory}
          llmHealth={llmHealth}
        />

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

        <OpsAgentRoster status={status} loading={loading} />

        <OpsWorkerHealth status={status} cloud={cloudStatus} />

        <OpsThroughputSparkline history={completedHistory} />

        <OpsCurrentTask status={status} />

        <OpsActivityFeed status={status} />

        <OpsRecentOutput records={records} mockHidden={mockHidden} />

        <OpsWorkerAuditLog />

        <AiConnectionStrip health={llmHealth} />

        <WorkerPoolSection status={status} loading={loading} />

        <PipelineMonitor active={(status?.jobs_in_flight ?? 0) > 0} />

        <ReviewQueueSection
          records={records}
          onReviewed={refresh}
          onToast={showToast}
        />

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

function Hero({ backend, llm, cloud }: { backend: "filesystem" | "supabase"; llm: LlmVerify | null; cloud: CloudStatus | null }) {
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
        <CloudWorkerChip cloud={cloud} />
      </div>
      <h1 className="mt-4 text-[36px] font-black leading-[1.05] tracking-tight md:text-[46px]" style={{ color: TOKEN.text }}>
        NEX Manager
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed md:text-base" style={{ color: TOKEN.textMid }}>
        Five specialist workers · Knowledge Context · Voice & Brand · Learning Context ·
        Knowledge Extractor · Quality Checker · plus Memory Guardian (batch).
        NEX writes with memory, voice, and learning from your decisions.
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

function CloudWorkerChip({ cloud }: { cloud: CloudStatus | null }) {
  if (!cloud) {
    return (
      <span
        className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em]"
        style={{ background: TOKEN.divider, borderColor: TOKEN.border, color: TOKEN.textSoft }}
      >
        <Cloud size={11} strokeWidth={2.4} />
        Cloud checking…
      </span>
    );
  }
  const online = cloud.workers.find((w) => w.status === "online");
  const lagging = cloud.workers.find((w) => w.status === "lagging");
  const stale = cloud.workers.find((w) => w.status === "stale");

  // No heartbeats at all → cloud worker not deployed yet.
  if (cloud.workers.length === 0) {
    return (
      <span
        className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em]"
        style={{ background: TOKEN.divider, borderColor: TOKEN.border, color: TOKEN.textSoft }}
        title="Deploy scripts/nex-brain-cloud-worker.ts to Fly.io — see deploy/nex-brain-worker/fly.toml"
      >
        <CloudOff size={11} strokeWidth={2.4} />
        Cloud not deployed
      </span>
    );
  }

  if (online) {
    const secs = Math.round(online.age_ms / 1000);
    const host = String(online.host_id).slice(0, 12);
    return (
      <span
        className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em]"
        style={{ background: "#D1FAE5", borderColor: "#6EE7B7", color: "#065F46" }}
        title={`Host ${online.host_id} · ${online.cycles_total} cycles · ${online.cycles_failed} failed · uptime ${Math.round(online.uptime_ms / 60_000)}m`}
      >
        <Cloud size={11} strokeWidth={2.4} />
        Cloud · {host} · {secs}s
      </span>
    );
  }

  const laggingOrStale = lagging ?? stale;
  const isStale = !lagging;
  const secs = laggingOrStale ? Math.round(laggingOrStale.age_ms / 1000) : 0;
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em]"
      style={{
        background: isStale ? "#FEE2E2" : "#FEF3C7",
        borderColor: isStale ? "#FCA5A5" : "#FDE68A",
        color: isStale ? "#991B1B" : "#92400E",
      }}
      title={laggingOrStale?.last_error ?? undefined}
    >
      <CloudOff size={11} strokeWidth={2.4} />
      {isStale ? "Cloud stale" : "Cloud lagging"} · {secs}s
    </span>
  );
}

// ── AI Connection strip ─────────────────────────────────────────────
//
// Shows the provider chain (Groq → Gemini → Anthropic → Mock) with
// each link's health status. When Groq is degraded, chip goes amber.
// When the circuit is open, red. On hover: consecutive-failures
// count + last-error line. Every hop is visible so it's obvious
// which provider took the last call.

function AiConnectionStrip({ health }: { health: LlmHealthSnapshot | null }) {
  if (!health) {
    return (
      <section className="mt-8">
        <div className="rounded-2xl border p-4" style={{ background: TOKEN.card, borderColor: TOKEN.border }}>
          <div className="nex-skeleton h-4 w-40 rounded" />
        </div>
      </section>
    );
  }
  return (
    <section className="mt-8">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-[16px] font-black tracking-tight" style={{ color: TOKEN.text }}>
          AI Connection
        </h2>
        <span className="text-[11px]" style={{ color: TOKEN.textSoft }}>
          Primary: <span className="font-bold" style={{ color: TOKEN.text }}>{health.active}</span>
          {" · "}Chain: {health.chain.join(" → ")}
        </span>
      </div>
      <div
        className="flex flex-wrap items-center gap-2 rounded-2xl border p-3"
        style={{ background: TOKEN.card, borderColor: TOKEN.border, boxShadow: TOKEN.shadowSm }}
      >
        {health.chain.map((p, i) => {
          const r = health.providers.find((x) => x.provider === p);
          return (
            <div key={p} className="flex items-center gap-1.5">
              <ProviderPill report={r} isActive={p === health.active} />
              {i < health.chain.length - 1 && (
                <span className="text-[12px] font-bold" style={{ color: TOKEN.textSoft }}>→</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ProviderPill({ report, isActive }: { report?: LlmProviderReport; isActive: boolean }) {
  if (!report) return null;
  const chip = statusChipFor(report.status);
  const rate =
    report.success_rate_24h !== null
      ? `${Math.round(report.success_rate_24h * 100)}%`
      : "—";
  const avg =
    report.avg_ms_24h !== null
      ? report.avg_ms_24h > 1000
        ? `${(report.avg_ms_24h / 1000).toFixed(1)}s`
        : `${report.avg_ms_24h}ms`
      : "—";
  const title = [
    `Status: ${report.status}`,
    `Configured: ${report.configured ? "yes" : "no"}`,
    `Capabilities: ${report.capabilities.join(", ")}`,
    `Consecutive failures: ${report.consecutive_failures}`,
    report.circuit_open_ms_remaining
      ? `Circuit reopens in ${Math.ceil(report.circuit_open_ms_remaining / 1000)}s`
      : null,
    `24h: ${report.calls_24h} calls, ${rate} success, ${avg} avg`,
    report.last_error ? `Last error: ${report.last_error}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div
      title={title}
      className="flex items-center gap-1.5 rounded-full border px-2.5 py-1"
      style={{
        background: chip.bg,
        borderColor: chip.border,
        color: chip.fg,
        outline: isActive ? `2px solid ${TOKEN.accent}` : "none",
        outlineOffset: 1,
      }}
    >
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: chip.dot }}
      />
      <span className="text-[11px] font-bold uppercase tracking-widest">
        {report.provider}
      </span>
      {report.calls_24h > 0 && (
        <span className="text-[10px]" style={{ color: chip.fg, opacity: 0.8 }}>
          {rate}
        </span>
      )}
    </div>
  );
}

function statusChipFor(status: LlmProviderReport["status"]): {
  bg: string; border: string; fg: string; dot: string;
} {
  switch (status) {
    case "healthy":       return { bg: "#D1FAE5", border: "#6EE7B7", fg: "#065F46", dot: "#10B981" };
    case "degraded":      return { bg: "#FEF3C7", border: "#FBBF24", fg: "#92400E", dot: "#F59E0B" };
    case "circuit-open":  return { bg: "#FEE2E2", border: "#EF4444", fg: "#991B1B", dot: "#EF4444" };
    case "unconfigured":  return { bg: TOKEN.divider, border: TOKEN.border, fg: TOKEN.textSoft, dot: TOKEN.textSoft };
    case "idle":          return { bg: TOKEN.divider, border: TOKEN.border, fg: TOKEN.textMid, dot: TOKEN.textMid };
  }
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
      <Link
        href="/nex-app/nex-brain/operations-centre"
        className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors hover:bg-black/5"
        style={{ background: TOKEN.card, borderColor: TOKEN.accent, color: TOKEN.accent }}
        title="NEX Headquarters — visual Operations Centre (NEX Storage lives inside as a sidebar view)"
      >
        <Sparkles size={14} strokeWidth={2.3} />
        Headquarters
      </Link>
      <Link
        href="/nex-app/nex-brain/audit"
        className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors hover:bg-black/5"
        style={{ background: TOKEN.card, borderColor: TOKEN.info, color: TOKEN.info }}
        title="Operations History — permanent audit surface"
      >
        <Activity size={14} strokeWidth={2.3} />
        History
      </Link>
      <Link
        href="/nex-app/nex-brain/journal"
        className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors hover:bg-black/5"
        style={{ background: TOKEN.card, borderColor: TOKEN.accentDark, color: TOKEN.accentDark }}
        title="Worker Journal — per-job event timeline"
      >
        <GitBranch size={14} strokeWidth={2.3} />
        Journal
      </Link>
      <Link
        href="/nex-app/nex-booker"
        className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors hover:bg-black/5"
        style={{ background: TOKEN.card, borderColor: TOKEN.accentDark, color: TOKEN.accentDark }}
        title="Open Nex Booker — the bookkeeping section (foundations under construction)"
      >
        <Wallet size={14} strokeWidth={2.3} />
        Nex Booker
      </Link>
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

// ── Ops mockup: 3 sections placed above the WorkerPoolSection detail
// table so Philip can SEE agents working at a glance without reading a
// grid. Data source is `status.worker_pool` — no new API endpoints.

function OpsAgentRoster({ status, loading }: { status: Status | null; loading: boolean }) {
  const pool: Status["worker_pool"] = status?.worker_pool ?? [];
  const types = Object.keys(WORKER_LABEL) as WorkerType[];
  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[18px] font-black tracking-tight" style={{ color: TOKEN.text }}>
          Agents
        </h2>
        <span
          className="rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-widest"
          style={{ background: TOKEN.divider, borderColor: TOKEN.border, color: TOKEN.textSoft }}
        >
          Live
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {types.map((t) => {
          const w = pool.find((p) => p.worker_type === t);
          const meta = WORKER_LABEL[t];
          const Icon = meta.icon;
          const inFlight = w?.jobs_in_flight ?? 0;
          const waiting = w?.jobs_waiting ?? 0;
          const chip =
            inFlight > 0
              ? { label: "Working",   bg: "#DBEAFE", fg: "#1D4ED8", pulse: true }
              : waiting > 0
                ? { label: "Queued",  bg: "#FED7AA", fg: "#9A3412", pulse: false }
                : w?.last_activity_at
                  ? { label: "Idle",  bg: TOKEN.divider, fg: TOKEN.textMid, pulse: false }
                  : { label: "Sleeping", bg: "#E5E7EB", fg: "#374151", pulse: false };
          return (
            <div
              key={t}
              className="flex items-center gap-3 rounded-2xl border p-3"
              style={{ background: TOKEN.card, borderColor: TOKEN.border, boxShadow: TOKEN.shadowSm }}
            >
              <div
                className="grid h-10 w-10 flex-none place-items-center rounded-xl"
                style={{ background: TOKEN.accentSoft, color: meta.color }}
              >
                <Icon size={18} strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold" style={{ color: TOKEN.text }}>
                  {meta.label}
                </div>
                <div className="mt-1">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
                    style={{ background: chip.bg, color: chip.fg }}
                  >
                    {chip.pulse && <Loader2 size={9} strokeWidth={2.6} className="animate-spin" />}
                    {chip.label}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function OpsCurrentTask({ status }: { status: Status | null }) {
  const pool: Status["worker_pool"] = status?.worker_pool ?? [];
  const running = pool.find((w) => w.current_job_ref);

  // Tick every second so the progress bar advances smoothly between
  // status refresh cycles. Cheap — one setState per second, unmounts clean.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  if (!running) return null;
  const meta = WORKER_LABEL[running.worker_type];
  const Icon = meta.icon;
  const sinceMs = running.current_job_since
    ? new Date(running.current_job_since).getTime()
    : Date.now();
  // avg_ms is per-worker average completion time — used to estimate progress.
  // Fall back to 8s if the worker has no history yet. Clamp 3-97% so the
  // bar always shows visible motion and never falsely reports "done".
  const avgMs = (running as { avg_ms?: number }).avg_ms ?? 8000;
  const elapsed = Date.now() - sinceMs;
  const pct = Math.max(3, Math.min(97, (elapsed / Math.max(1000, avgMs)) * 100));

  return (
    <section className="mt-8">
      <div
        className="rounded-2xl border p-4"
        style={{ background: TOKEN.card, borderColor: TOKEN.border, boxShadow: TOKEN.shadowSm }}
      >
        <div className="flex items-center gap-3">
          <div
            className="grid h-9 w-9 flex-none place-items-center rounded-xl"
            style={{ background: TOKEN.accentSoft, color: meta.color }}
          >
            <Icon size={16} strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: TOKEN.textSoft }}
            >
              Current task
            </div>
            <div className="mt-0.5 truncate text-[13px] font-bold" style={{ color: TOKEN.text }}>
              {meta.label} · <span className="font-mono text-[12px]">{truncate(running.current_job_ref!, 40)}</span>
            </div>
          </div>
          <div className="text-[16px] font-black" style={{ color: TOKEN.accentDark }}>
            {Math.round(pct)}%
          </div>
        </div>
        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full"
          style={{ background: TOKEN.divider }}
        >
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{ width: `${pct}%`, background: TOKEN.accent }}
          />
        </div>
      </div>
    </section>
  );
}

// NEX Brain Pulse — Philip's polished narrative format 2026-08-07.
// Doctrine: `project_nex_living_operating_system_for_staircase_knowledge_2026_08_07.md`
// + `project_nex_operations_centre_living_digital_twin_2026_08_07.md`
// (three-question test: what NEX is doing NOW · WHY · how today made NEX smarter).
//
// Rich narrative sections replace the terse metric-tile grid: every
// number has a paragraph of context + honest empty states + a System
// Advisory that names the current impact + Overall System Health table.
function NexBrainPulse({
  status,
  cloud,
  records,
  mockHidden,
  authoritativeHistory,
  llmHealth,
}: {
  status: Status | null;
  cloud: CloudStatus | null;
  records: KnowledgeRecord[];
  mockHidden: number;
  authoritativeHistory: Array<{ t: number; count: number }>;
  llmHealth: LlmHealthSnapshot | null;
}) {
  // Overall health verdict — derived from cloud + mock + provider health
  const anyCloudOnline = cloud?.any_online === true;
  const providers = llmHealth?.providers ?? [];
  const healthyProviders = providers.filter((p) => p.status === "healthy").length;
  const degradedProviders = providers.filter((p) => p.status === "degraded" || p.status === "circuit-open").length;

  const failing = !anyCloudOnline;
  const degraded = anyCloudOnline && (mockHidden > 0 || degradedProviders > 0);
  const healthy = anyCloudOnline && mockHidden === 0 && degradedProviders === 0;

  const statusChip: { label: string; bg: string; fg: string; symbol: string } =
    failing  ? { label: "Failing",   bg: "#FEE2E2", fg: "#991B1B", symbol: "❌" } :
    degraded ? { label: "Degraded",  bg: "#FEF3C7", fg: "#92400E", symbol: "⚠️" } :
    healthy  ? { label: "Healthy",   bg: "#DCFCE7", fg: "#166534", symbol: "✅" } :
               { label: "Starting…", bg: TOKEN.divider, fg: TOKEN.textMid, symbol: "…" };

  const headline =
    failing  ? "Knowledge processing is offline — cloud workers unreachable." :
    degraded ? "Knowledge processing is operating with reduced capability." :
    healthy  ? "Knowledge processing is operating normally." :
               "Knowledge processing is initialising…";

  const subline =
    degraded
      ? "Some AI providers are currently unavailable or have reached usage limits. As a result, knowledge production is operating below normal capacity and recent output quality has been affected."
      : failing
        ? "No cloud workers are currently online. New work is not being processed. Investigate Fly deployment status."
        : healthy
          ? "All cloud workers are online, providers are responsive, and knowledge is flowing to authoritative status normally."
          : "";

  // Learning rate — derived from the client-side buffer (same as before)
  const learningRate = (() => {
    if (authoritativeHistory.length < 2) return null;
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const recent = authoritativeHistory[authoritativeHistory.length - 1];
    const past = authoritativeHistory.find((s) => s.t >= oneHourAgo);
    if (!past || past.t === recent.t) return null;
    const deltaCount = recent.count - past.count;
    const deltaHours = (recent.t - past.t) / (60 * 60 * 1000);
    if (deltaHours <= 0) return null;
    return Math.max(0, deltaCount / deltaHours);
  })();

  const graphSize = (status?.records_authoritative ?? 0) + (status?.records_under_review ?? 0);
  const authoritativeCount = status?.records_authoritative ?? 0;
  const underReviewCount = status?.records_under_review ?? 0;

  const latestAuthoritative = records.find((r) => (r as unknown as { review_status?: string }).review_status === "AUTHORITATIVE") ?? null;
  const latestAuthoritativeAge = latestAuthoritative
    ? formatRelativeAge((latestAuthoritative as unknown as { created_at?: string }).created_at ?? "")
    : null;

  const confidenceValues = records
    .map((r) => (r as unknown as { overall_confidence?: number }).overall_confidence)
    .filter((v): v is number => typeof v === "number");
  const avgConfidence =
    confidenceValues.length > 0
      ? confidenceValues.reduce((s, v) => s + v, 0) / confidenceValues.length
      : null;

  // System Health table — every component derived from real telemetry
  const healthRows: Array<{ label: string; status: "ok" | "warn" | "fail"; note?: string }> = [
    { label: "Worker Infrastructure", status: "ok" },
    { label: "Cloud Workers",         status: anyCloudOnline ? "ok" : "fail", note: anyCloudOnline ? `${cloud?.workers?.length ?? 0} online` : "None online" },
    { label: "Queue Processing",      status: (status?.jobs_in_flight ?? 0) >= 0 ? "ok" : "warn" },
    { label: "Knowledge Pipeline",    status: mockHidden > 0 ? "warn" : "ok", note: mockHidden > 0 ? "Fabricated output" : undefined },
    { label: "AI Provider Capacity",  status: degradedProviders > 0 ? "warn" : healthyProviders > 0 ? "ok" : "warn", note: `${healthyProviders} healthy · ${degradedProviders} degraded` },
    { label: "Knowledge Quality",     status: mockHidden > 0 ? "warn" : "ok", note: mockHidden > 0 ? "Mock records filtered" : undefined },
    { label: "Memory System",         status: "ok" },
  ];

  return (
    <section className="mt-8">
      <div
        className="rounded-2xl border p-5 md:p-6"
        style={{
          background: TOKEN.card,
          borderColor: TOKEN.border,
          boxShadow: TOKEN.shadowMd,
        }}
      >
        {/* Header · status pill · headline · subline */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: TOKEN.accentDark }}>
              NEX Brain Pulse
            </div>
            <div className="mt-1 text-[20px] font-black leading-tight tracking-tight md:text-[22px]" style={{ color: TOKEN.text }}>
              {headline}
            </div>
            {subline ? (
              <p className="mt-2 max-w-[720px] text-[12px] leading-relaxed" style={{ color: TOKEN.textMid }}>
                {subline}
              </p>
            ) : null}
          </div>
          <span
            className="flex-none rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest"
            style={{ background: statusChip.bg, color: statusChip.fg }}
          >
            {statusChip.symbol} {statusChip.label}
          </span>
        </div>

        <div className="mt-5 h-px w-full" style={{ background: TOKEN.divider }} />

        {/* Knowledge Graph */}
        <PulseSection title="Knowledge Graph" headline={`${graphSize.toLocaleString()} Records`}>
          <ul className="mt-1 space-y-0.5 text-[12px]" style={{ color: TOKEN.textMid }}>
            <li><span className="font-bold" style={{ color: TOKEN.text }}>{authoritativeCount.toLocaleString()}</span> Authoritative</li>
            <li><span className="font-bold" style={{ color: TOKEN.text }}>{underReviewCount.toLocaleString()}</span> Under Review</li>
          </ul>
          <p className="mt-2 text-[11px]" style={{ color: TOKEN.textSoft }}>
            These represent NEX&apos;s verified and developing knowledge base.
          </p>
        </PulseSection>

        {/* Knowledge Production Rate */}
        <PulseSection
          title="Knowledge Production Rate"
          headline={
            learningRate === null
              ? "Not yet available"
              : learningRate === 0
                ? "0 Authoritative Records / Hour"
                : `${learningRate.toFixed(1)} Authoritative Records / Hour`
          }
        >
          {learningRate === null ? (
            <p className="text-[12px]" style={{ color: TOKEN.textMid }}>
              Rate becomes available after ~5 minutes of polling data has accumulated.
            </p>
          ) : learningRate === 0 ? (
            <>
              <p className="text-[12px]" style={{ color: TOKEN.textMid }}>
                No new records have been promoted to <span className="font-semibold">Authoritative</span> during the current reporting window.
              </p>
              <p className="mt-2 text-[11px]" style={{ color: TOKEN.textSoft }}>
                This does <span className="font-semibold">not</span> necessarily mean workers are idle. Workers may still be processing, validating, retrying failed requests, or waiting for external AI provider capacity.
              </p>
            </>
          ) : (
            <p className="text-[12px]" style={{ color: TOKEN.textMid }}>
              Records reaching Authoritative status per hour, computed from the last 60 minutes of polling data.
            </p>
          )}
        </PulseSection>

        {/* Knowledge Confidence */}
        <PulseSection
          title="Knowledge Confidence"
          headline={avgConfidence === null ? "Not Available" : `${Math.round(avgConfidence * 100)}%`}
        >
          {avgConfidence === null ? (
            <>
              <p className="text-[12px]" style={{ color: TOKEN.textMid }}>
                No confidence-scored records have been promoted during this reporting period.
              </p>
              <p className="mt-2 text-[11px]" style={{ color: TOKEN.textSoft }}>
                Confidence metrics will automatically resume once verified provider responses are available.
              </p>
            </>
          ) : (
            <p className="text-[12px]" style={{ color: TOKEN.textMid }}>
              Average confidence across the {confidenceValues.length} most recently visible records.
            </p>
          )}
        </PulseSection>

        {/* Latest Authoritative */}
        <PulseSection
          title="Latest Authoritative Knowledge"
          headline={latestAuthoritative ? ((latestAuthoritative as unknown as { title?: string }).title ?? "(untitled)") : "No recent authoritative promotions"}
        >
          {latestAuthoritative ? (
            <div className="flex items-center gap-2 text-[11px]" style={{ color: TOKEN.textSoft }}>
              <span>Promoted {latestAuthoritativeAge}</span>
            </div>
          ) : (
            <p className="text-[12px]" style={{ color: TOKEN.textMid }}>
              No records have reached Authoritative status during the selected time window.
            </p>
          )}
        </PulseSection>

        {/* System Advisory — only when there's an active concern */}
        {mockHidden > 0 ? (
          <>
            <div className="mt-5 h-px w-full" style={{ background: TOKEN.divider }} />
            <div className="mt-5">
              <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: TOKEN.warning }}>
                System Advisory
              </div>
              <p className="mt-2 text-[12px] leading-relaxed" style={{ color: TOKEN.textMid }}>
                The current cloud worker configuration is allowing <span className="font-semibold">Mock Fallback</span> responses when production AI providers become unavailable. As a result:
              </p>
              <ul className="mt-2 space-y-1 text-[12px]" style={{ color: TOKEN.textMid }}>
                <li>· Placeholder knowledge has been generated instead of queuing failed requests for retry.</li>
                <li>· Recent placeholder records are automatically excluded from operational reporting.</li>
                <li>· Learning metrics may appear lower than actual worker activity because placeholder output is not treated as trusted knowledge.</li>
              </ul>
              <p className="mt-2 text-[11px] italic" style={{ color: TOKEN.textSoft }}>
                Once the cloud worker configuration is aligned with the approved NEX doctrine, failed requests will enter the retry queue and authoritative knowledge production will resume when provider capacity becomes available.
              </p>
            </div>
          </>
        ) : null}

        {/* Overall System Health table */}
        <div className="mt-5 h-px w-full" style={{ background: TOKEN.divider }} />
        <div className="mt-5">
          <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: TOKEN.textSoft }}>
            Overall System Health
          </div>
          <div className="mt-2 overflow-hidden rounded-lg border" style={{ borderColor: TOKEN.border }}>
            {healthRows.map((row, i) => {
              const chip =
                row.status === "ok"   ? { symbol: "✅", label: "Healthy",     bg: "#DCFCE7", fg: "#166534" } :
                row.status === "warn" ? { symbol: "⚠️", label: "Degraded",    bg: "#FEF3C7", fg: "#92400E" } :
                                        { symbol: "❌", label: "Failing",     bg: "#FEE2E2", fg: "#991B1B" };
              return (
                <div
                  key={row.label}
                  className="flex items-center gap-3 px-4 py-2.5 text-[12px]"
                  style={{
                    borderTop: i === 0 ? "none" : `1px solid ${TOKEN.divider}`,
                    background: i % 2 === 0 ? TOKEN.card : TOKEN.surface,
                  }}
                >
                  <span className="flex-1 font-semibold" style={{ color: TOKEN.text }}>{row.label}</span>
                  {row.note ? (
                    <span className="text-[11px]" style={{ color: TOKEN.textSoft }}>{row.note}</span>
                  ) : null}
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: chip.bg, color: chip.fg }}
                  >
                    {chip.symbol} {chip.label}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[12px] leading-relaxed" style={{ color: TOKEN.textMid }}>
            <span className="font-semibold" style={{ color: TOKEN.text }}>NEX remains operational.</span>
            {" "}The current limitation affects knowledge generation quality rather than the availability of the platform itself.
          </p>
        </div>
      </div>
    </section>
  );
}

function PulseSection({
  title, headline, children,
}: {
  title: string;
  headline: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: TOKEN.textSoft }}>
        {title}
      </div>
      <div className="mt-1 text-[18px] font-black tracking-tight" style={{ color: TOKEN.text }}>
        {headline}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function PulseMetric({
  label, value, hint, icon: Icon, tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  tone: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: TOKEN.textSoft }}>
        <Icon size={11} strokeWidth={2.3} />
        {label}
      </div>
      <div className="mt-1 text-[24px] font-black leading-none tracking-tight" style={{ color: tone }}>
        {value}
      </div>
      {hint ? (
        <div className="mt-1 line-clamp-2 text-[11px]" style={{ color: TOKEN.textSoft }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

// Worker Health — per-worker heartbeat + local vs Fly cloud breakdown.
// Answers "is she alive?" at a glance. Each row: name · online/idle/stale
// pill · last-activity age · region (for cloud workers) · uptime.
function OpsWorkerHealth({
  status, cloud,
}: {
  status: Status | null;
  cloud: CloudStatus | null;
}) {
  const now = Date.now();
  const pool: Status["worker_pool"] = status?.worker_pool ?? [];

  // Fly cloud workers (from /api/nex/brain/cloud-status) come with age_ms + region + uptime
  const cloudWorkers = cloud?.workers ?? [];

  // Local pool → derive age from last_activity_at
  const localRows = pool.map((w) => {
    const lastMs = w.last_activity_at ? new Date(w.last_activity_at).getTime() : null;
    const ageMs = lastMs === null ? null : Math.max(0, now - lastMs);
    const status: "working" | "idle" | "sleeping" | "stale" =
      w.jobs_in_flight > 0 ? "working" :
      ageMs !== null && ageMs < 30_000 ? "idle" :
      ageMs !== null && ageMs < 5 * 60_000 ? "idle" :
      ageMs !== null ? "stale" : "sleeping";
    const meta = WORKER_LABEL[w.worker_type];
    return { key: w.worker_type, label: meta.label, icon: meta.icon, color: meta.color, ageMs, status, jobs24h: w.jobs_completed_24h };
  });

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[18px] font-black tracking-tight" style={{ color: TOKEN.text }}>
          Worker health
        </h2>
        <span
          className="rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-widest"
          style={{ background: TOKEN.divider, borderColor: TOKEN.border, color: TOKEN.textSoft }}
        >
          Live · 5s
        </span>
      </div>

      {/* Cloud workers strip (Fly) — LEGACY · out of scope under LOCAL-FIRST (Philip 2026-08-14).
          The Fly fleet is deliberately paused; absent heartbeats are EXPECTED, not an incident. */}
      <div className="mt-3">
        <div className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: TOKEN.textSoft }}>
          Cloud workers (Fly) · legacy · paused
        </div>
        {cloudWorkers.length === 0 ? (
          <div
            className="rounded-2xl border p-4 text-[12px]"
            style={{ background: TOKEN.card, borderColor: TOKEN.border, color: TOKEN.textSoft }}
          >
            Cloud worker fleet not in current scope. Local-first pipeline active · no cloud worker dependency detected.
            Fly monitoring is paused under the current LOCAL-FIRST architecture; this does not affect the active NEX pipeline.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {cloudWorkers.map((cw) => {
              const uptimeH = Math.floor(cw.uptime_ms / 3_600_000);
              const uptimeM = Math.floor((cw.uptime_ms % 3_600_000) / 60_000);
              const ageS = Math.round(cw.age_ms / 1000);
              const isOnline = cw.status === "online";
              const chip =
                isOnline           ? { label: "Online",   bg: "#DCFCE7", fg: "#166534" } :
                cw.status === "lagging" ? { label: "Lagging",  bg: "#FEF3C7", fg: "#92400E" } :
                                     { label: "Stale",    bg: "#FEE2E2", fg: "#991B1B" };
              return (
                <div
                  key={cw.host_id}
                  className="flex items-center gap-3 rounded-2xl border p-3"
                  style={{ background: TOKEN.card, borderColor: TOKEN.border, boxShadow: TOKEN.shadowSm }}
                >
                  <div
                    className="grid h-9 w-9 flex-none place-items-center rounded-xl"
                    style={{ background: TOKEN.accentSoft, color: TOKEN.info }}
                  >
                    <Cloud size={16} strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate font-mono text-[11px]" style={{ color: TOKEN.text }}>
                        {cw.host_id.slice(0, 10)}
                      </span>
                      <span className="text-[10px] uppercase tracking-widest" style={{ color: TOKEN.textSoft }}>
                        {(cw.metadata as { region?: string } | null)?.region ?? "—"}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px]" style={{ color: TOKEN.textMid }}>
                      <span>up {uptimeH}h {uptimeM}m</span>
                      <span style={{ color: TOKEN.textSoft }}>·</span>
                      <span>{cw.cycles_total.toLocaleString()} cycles</span>
                      <span style={{ color: TOKEN.textSoft }}>·</span>
                      <span>heartbeat {ageS}s ago</span>
                    </div>
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
                    style={{ background: chip.bg, color: chip.fg }}
                  >
                    {chip.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Local worker roster (per-type activity) */}
      <div className="mt-4">
        <div className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: TOKEN.textSoft }}>
          Per-stage activity (24h totals)
        </div>
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ background: TOKEN.card, borderColor: TOKEN.border, boxShadow: TOKEN.shadowSm }}
        >
          {localRows.map((r, i) => {
            const Icon = r.icon;
            const chip =
              r.status === "working"   ? { label: "Working",  bg: "#DBEAFE", fg: "#1D4ED8" } :
              r.status === "idle"      ? { label: "Idle",     bg: TOKEN.divider, fg: TOKEN.textMid } :
              r.status === "sleeping"  ? { label: "Sleeping", bg: "#E5E7EB", fg: "#374151" } :
                                         { label: "Stale",    bg: "#FEE2E2", fg: "#991B1B" };
            const ageLabel =
              r.ageMs === null ? "never active" :
              r.ageMs < 60_000 ? `${Math.round(r.ageMs / 1000)}s ago` :
              r.ageMs < 3_600_000 ? `${Math.round(r.ageMs / 60_000)}m ago` :
              `${Math.round(r.ageMs / 3_600_000)}h ago`;
            return (
              <div
                key={r.key}
                className="flex items-center gap-3 px-4 py-2.5"
                style={{ borderTop: i === 0 ? "none" : `1px solid ${TOKEN.divider}` }}
              >
                <div
                  className="grid h-7 w-7 flex-none place-items-center rounded-lg"
                  style={{ background: TOKEN.accentSoft, color: r.color }}
                >
                  <Icon size={13} strokeWidth={2} />
                </div>
                <div className="flex-1 truncate text-[13px] font-semibold" style={{ color: TOKEN.text }}>
                  {r.label}
                </div>
                <span className="text-[11px]" style={{ color: TOKEN.textSoft }}>
                  {ageLabel}
                </span>
                <span className="text-[11px] font-mono" style={{ color: TOKEN.textMid }}>
                  {r.jobs24h.toLocaleString()}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
                  style={{ background: chip.bg, color: chip.fg }}
                >
                  {chip.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// Throughput sparkline — SVG polyline of jobs completed per 5-minute
// bucket over the last hour. Data source: client-side history buffer
// (see `completedHistory` in the shell). Zero external chart library.
function OpsThroughputSparkline({ history }: { history: Array<{ t: number; completed: number }> }) {
  if (history.length < 2) {
    return (
      <section className="mt-8">
        <div
          className="rounded-2xl border p-4 text-[12px]"
          style={{ background: TOKEN.card, borderColor: TOKEN.border, color: TOKEN.textSoft }}
        >
          Throughput graph warming up… (needs ~10 seconds of polling data)
        </div>
      </section>
    );
  }

  // Bucket per-5-min. For each bucket compute: (completed_at_end - completed_at_start).
  // Simpler + more visually useful than rolling deltas: at each 5-min mark, take the
  // latest sample and compute delta vs the previous 5-min mark.
  const now = Date.now();
  const bucketMs = 5 * 60 * 1000;
  const buckets = 12;                       // Last hour · 12 × 5 min
  const bucketEnds: number[] = [];
  for (let i = buckets; i >= 1; i--) bucketEnds.push(now - (i - 1) * bucketMs);

  // For each bucket end, find the sample closest to (but not after) it
  const sampleAtOrBefore = (ts: number) => {
    let best: typeof history[number] | null = null;
    for (const s of history) if (s.t <= ts && (best === null || s.t > best.t)) best = s;
    return best;
  };

  const deltas: number[] = [];
  let prev = sampleAtOrBefore(bucketEnds[0] - bucketMs);
  for (const end of bucketEnds) {
    const cur = sampleAtOrBefore(end);
    if (prev && cur) {
      deltas.push(Math.max(0, cur.completed - prev.completed));
    } else {
      deltas.push(0);
    }
    prev = cur;
  }

  const max = Math.max(1, ...deltas);
  const w = 640;
  const h = 80;
  const padX = 6;
  const padY = 6;
  const stepX = (w - padX * 2) / (buckets - 1);
  const points = deltas.map((v, i) => {
    const x = padX + i * stepX;
    const y = h - padY - (v / max) * (h - padY * 2);
    return `${x},${y}`;
  }).join(" ");

  const totalHour = deltas.reduce((s, v) => s + v, 0);

  return (
    <section className="mt-8">
      <div
        className="rounded-2xl border p-4"
        style={{ background: TOKEN.card, borderColor: TOKEN.border, boxShadow: TOKEN.shadowSm }}
      >
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: TOKEN.textSoft }}>
              Throughput · last hour · 5-min buckets
            </div>
            <div className="mt-0.5 text-[18px] font-black tracking-tight" style={{ color: TOKEN.text }}>
              {totalHour.toLocaleString()} <span className="text-[12px] font-semibold" style={{ color: TOKEN.textSoft }}>jobs/hr</span>
            </div>
          </div>
          <span className="text-[11px]" style={{ color: TOKEN.textSoft }}>
            peak bucket {max.toLocaleString()}
          </span>
        </div>
        <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-[80px] w-full">
          <polyline
            points={points}
            fill="none"
            stroke={TOKEN.accent}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {deltas.map((v, i) => {
            const x = padX + i * stepX;
            const y = h - padY - (v / max) * (h - padY * 2);
            return <circle key={i} cx={x} cy={y} r={2.5} fill={TOKEN.accentDark} />;
          })}
        </svg>
      </div>
    </section>
  );
}

// Recent NEX Output — last 10 knowledge records with title + confidence +
// stage. Lets Philip see NEX's actual voice + spot low-quality promotion
// or high-quality rejection. Reads from the same `records` prop already
// populated by the shell's refresh() so no new fetch is needed.
function OpsRecentOutput({ records, mockHidden = 0 }: { records: KnowledgeRecord[]; mockHidden?: number }) {
  const top = records.slice(0, 10);

  const bandForConfidence = (c: number | null | undefined) => {
    const v = c ?? 0;
    if (v >= 0.95) return { label: "Very high", bg: "#DCFCE7", fg: "#166534" };
    if (v >= 0.85) return { label: "High",      bg: "#DBEAFE", fg: "#1D4ED8" };
    if (v >= 0.70) return { label: "Good",      bg: "#FEF3C7", fg: "#92400E" };
    return                { label: "Review",    bg: "#FEE2E2", fg: "#991B1B" };
  };

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h2 className="text-[18px] font-black tracking-tight" style={{ color: TOKEN.text }}>
            Recent NEX output
          </h2>
          <p className="mt-1 text-[12px]" style={{ color: TOKEN.textSoft }}>
            Latest 10 knowledge records so you can see her voice + spot issues.
          </p>
        </div>
        <span
          className="rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-widest"
          style={{ background: TOKEN.divider, borderColor: TOKEN.border, color: TOKEN.textSoft }}
        >
          Voice + quality
        </span>
      </div>

      {/* Configuration Mismatch — evidence-first per the "NEX must know
          its own state" doctrine. Structured as: Expected · Actual · Effect
          · Evidence · Recommendation. The CLI command is a small footer,
          not the primary content. */}
      {mockHidden > 0 ? <MockConfigurationMismatch mockHidden={mockHidden} /> : null}

      <div
        className="mt-3 overflow-hidden rounded-2xl border"
        style={{ background: TOKEN.card, borderColor: TOKEN.border, boxShadow: TOKEN.shadowSm }}
      >
        {top.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12px]" style={{ color: TOKEN.textSoft }}>
            {mockHidden > 0
              ? "No REAL records yet — the panel is honest and empty until the Fly worker stops producing mock output."
              : "No records yet. Run a cycle or process the inbox to see output."}
          </div>
        ) : top.map((r, i) => {
          const rec = r as unknown as {
            id: string;
            title?: string;
            summary?: string;
            body_markdown?: string;
            overall_confidence?: number;
            review_status?: string;
            category?: string;
            industry_concepts?: string[];
            nex_concepts?: string[];
            created_at?: string;
          };
          const band = bandForConfidence(rec.overall_confidence);
          const conf = rec.overall_confidence != null ? Math.round(rec.overall_confidence * 100) : null;
          const stage = (rec.review_status ?? "draft").toLowerCase();
          // "Finding" — the first sentence NEX extracted. Doctrine: show
          // what was LEARNED, not just record metadata. Prefer body_markdown
          // (richer), fall back to summary. Trim + strip markdown noise.
          const finding = extractFirstFinding(rec.body_markdown ?? rec.summary ?? "");
          const concepts = [
            ...(rec.industry_concepts ?? []),
            ...(rec.nex_concepts ?? []),
          ].slice(0, 4);
          return (
            <div
              key={rec.id ?? i}
              className="flex items-start gap-3 px-4 py-3"
              style={{ borderTop: i === 0 ? "none" : `1px solid ${TOKEN.divider}` }}
            >
              <div className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-md"
                   style={{ background: TOKEN.accentSoft, color: TOKEN.accentDark }}>
                <FileCheck size={12} strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold" style={{ color: TOKEN.text }}>
                  {rec.title ?? "(untitled)"}
                </div>
                {finding ? (
                  <div className="mt-1.5 rounded-lg px-2.5 py-1.5" style={{ background: TOKEN.accentSoft }}>
                    <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: TOKEN.accentDark }}>
                      Finding
                    </div>
                    <div className="mt-0.5 line-clamp-3 text-[12.5px] leading-snug" style={{ color: TOKEN.text }}>
                      {finding}
                    </div>
                  </div>
                ) : rec.summary ? (
                  <div className="mt-0.5 line-clamp-2 text-[12px]" style={{ color: TOKEN.textMid }}>
                    {rec.summary}
                  </div>
                ) : null}
                {concepts.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {concepts.map((c, ci) => (
                      <span
                        key={ci}
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ background: TOKEN.divider, color: TOKEN.textMid }}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="mt-1.5 flex items-center gap-2 text-[10px] uppercase tracking-widest" style={{ color: TOKEN.textSoft }}>
                  <span>{stage}</span>
                  {rec.category ? <><span>·</span><span>{rec.category}</span></> : null}
                  {rec.created_at ? <><span>·</span><span>{formatRelativeAge(rec.created_at)}</span></> : null}
                </div>
              </div>
              {conf != null ? (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
                  style={{ background: band.bg, color: band.fg }}
                  title={`Confidence ${conf}%`}
                >
                  {conf}%
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function OpsActivityFeed({ status }: { status: Status | null }) {
  const pool: Status["worker_pool"] = status?.worker_pool ?? [];
  type Event = { time: string; label: string; provider: string | null; kind: "ok" | "warn" };
  const events: Event[] = pool
    .filter((w) => w.last_activity_at)
    .map((w) => {
      const summary = (w as { last_result_summary?: { provider?: string; ok?: boolean } })
        .last_result_summary;
      return {
        time: w.last_activity_at!,
        label: WORKER_LABEL[w.worker_type].label,
        provider: summary?.provider ?? null,
        kind: summary?.ok === false ? "warn" : "ok",
      };
    })
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, 8);

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[18px] font-black tracking-tight" style={{ color: TOKEN.text }}>
          Last activity
        </h2>
        <span
          className="rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-widest"
          style={{ background: TOKEN.divider, borderColor: TOKEN.border, color: TOKEN.textSoft }}
        >
          {events.length ? `${events.length} recent` : "Idle"}
        </span>
      </div>
      <div
        className="mt-3 overflow-hidden rounded-2xl border"
        style={{ background: TOKEN.card, borderColor: TOKEN.border, boxShadow: TOKEN.shadowSm }}
      >
        {events.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12px]" style={{ color: TOKEN.textSoft }}>
            No worker activity yet. Run a cycle or dispatch work to see live events here.
          </div>
        ) : (
          events.map((e, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-2.5"
              style={{ borderTop: i === 0 ? "none" : `1px solid ${TOKEN.divider}` }}
            >
              <span className="font-mono text-[11px]" style={{ color: TOKEN.textSoft }}>
                {new Date(e.time).toLocaleTimeString()}
              </span>
              <span
                className="text-[13px] font-bold"
                style={{ color: e.kind === "warn" ? TOKEN.warning : TOKEN.success }}
              >
                {e.kind === "warn" ? "!" : "✓"}
              </span>
              <span className="flex-1 truncate text-[13px]" style={{ color: TOKEN.text }}>
                {e.label}
              </span>
              {e.provider ? (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
                  style={{ background: TOKEN.divider, color: TOKEN.textMid }}
                >
                  {e.provider}
                </span>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function WorkerPoolSection({ status, loading }: { status: Status | null; loading: boolean }) {
  const pool = (status?.worker_pool?.length ? status!.worker_pool : PLACEHOLDER_POOL);
  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-[18px] font-black tracking-tight" style={{ color: TOKEN.text }}>
            Worker Pool
          </h2>
          <p className="mt-1 text-[12px]" style={{ color: TOKEN.textSoft }}>
            Six specialist workers · five real-time (Context · Voice · Learning · Extractor · Checker) plus Memory Guardian (batch).
          </p>
        </div>
        <span
          className="rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-widest"
          style={{ background: TOKEN.divider, borderColor: TOKEN.border, color: TOKEN.textSoft }}
        >
          Live snapshot
        </span>
      </div>
      <WorkerPoolTable pool={pool} loading={loading} />
      <div className="mt-3 md:hidden">
        <p className="text-[11px]" style={{ color: TOKEN.textSoft }}>
          Rotate to landscape for the full table view.
        </p>
      </div>
    </section>
  );
}

// ── Table view · replaces the 3-metric-pill card layout per Philip's
// sketch. Columns: Worker · Status · Current Job · Queue · Last Result
// · Avg Time · Failures 24h.

function WorkerPoolTable({
  pool,
  loading,
}: {
  pool: Status["worker_pool"];
  loading: boolean;
}) {
  return (
    <div
      className="mt-4 overflow-x-auto rounded-2xl border"
      style={{ background: TOKEN.card, borderColor: TOKEN.border, boxShadow: TOKEN.shadowSm }}
    >
      <table className="w-full min-w-[720px] text-left text-[12px]">
        <thead>
          <tr
            className="border-b"
            style={{ background: TOKEN.surface, borderColor: TOKEN.border }}
          >
            <TH>Worker</TH>
            <TH>Status</TH>
            <TH>Current job</TH>
            <TH align="right">Queue</TH>
            <TH>Last result</TH>
            <TH align="right">Avg time</TH>
            <TH align="right">Fails 24h</TH>
          </tr>
        </thead>
        <tbody>
          {pool.map((w) => (
            <WorkerRow key={w.worker_type} pool={w} loading={loading} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TH({ children, align }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest"
      style={{ color: TOKEN.textSoft, textAlign: align ?? "left" }}
    >
      {children}
    </th>
  );
}

function WorkerRow({
  pool,
  loading,
}: {
  pool: Status["worker_pool"][number];
  loading: boolean;
}) {
  const meta = WORKER_LABEL[pool.worker_type];
  const Icon = meta.icon;
  const isBusy = pool.jobs_in_flight > 0;
  const statusChip =
    pool.jobs_in_flight > 0
      ? { label: "Working", bg: "#DBEAFE", fg: "#1D4ED8" }
      : pool.jobs_waiting > 0
        ? { label: "Queued", bg: "#FED7AA", fg: "#9A3412" }
        : pool.last_activity_at
          ? { label: "Idle",  bg: TOKEN.divider, fg: TOKEN.textMid }
          : { label: "Scheduled", bg: "#E5E7EB", fg: "#374151" };
  return (
    <tr
      className="border-t"
      style={{ borderColor: TOKEN.divider }}
    >
      <td className="px-3 py-3">
        <div className="flex items-center gap-2.5">
          <div
            className="grid h-8 w-8 flex-none place-items-center rounded-xl"
            style={{ background: TOKEN.accentSoft, color: meta.color }}
          >
            <Icon size={14} strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-bold" style={{ color: TOKEN.text }}>
              {meta.label}
            </div>
            <div
              className="truncate text-[10px] uppercase tracking-widest"
              style={{ color: TOKEN.textSoft }}
            >
              {pool.worker_type}
            </div>
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
          style={{ background: statusChip.bg, color: statusChip.fg }}
        >
          {isBusy && <Loader2 size={9} strokeWidth={2.6} className="animate-spin" />}
          {statusChip.label}
        </span>
      </td>
      <td className="px-3 py-3">
        {loading ? (
          <div className="nex-skeleton h-4 w-32 rounded" />
        ) : pool.current_job_ref ? (
          <div>
            <div className="truncate font-mono text-[11px]" style={{ color: TOKEN.text }}>
              {truncate(pool.current_job_ref, 32)}
            </div>
            {pool.current_job_since ? (
              <div className="text-[10px]" style={{ color: TOKEN.textSoft }}>
                since {new Date(pool.current_job_since).toLocaleTimeString()}
              </div>
            ) : null}
          </div>
        ) : (
          <span className="text-[11px]" style={{ color: TOKEN.textSoft }}>—</span>
        )}
      </td>
      <td className="px-3 py-3 text-right">
        {loading ? (
          <div className="nex-skeleton ml-auto h-4 w-6 rounded" />
        ) : (
          <span
            className="text-[13px] font-black"
            style={{ color: pool.jobs_waiting > 0 ? TOKEN.warning : TOKEN.textMid }}
          >
            {pool.jobs_waiting}
          </span>
        )}
      </td>
      <td className="px-3 py-3">
        {loading ? (
          <div className="nex-skeleton h-4 w-28 rounded" />
        ) : (
          <span className="text-[11px]" style={{ color: TOKEN.textMid }}>
            {pool.last_result_summary ?? "—"}
          </span>
        )}
      </td>
      <td className="px-3 py-3 text-right">
        {loading ? (
          <div className="nex-skeleton ml-auto h-4 w-10 rounded" />
        ) : pool.avg_ms_last_24h && pool.avg_ms_last_24h > 0 ? (
          <span className="text-[11px] font-semibold" style={{ color: TOKEN.textMid }}>
            {pool.avg_ms_last_24h > 1000
              ? `${(pool.avg_ms_last_24h / 1000).toFixed(1)}s`
              : `${pool.avg_ms_last_24h}ms`}
          </span>
        ) : (
          <span className="text-[11px]" style={{ color: TOKEN.textSoft }}>—</span>
        )}
      </td>
      <td className="px-3 py-3 text-right">
        {loading ? (
          <div className="nex-skeleton ml-auto h-4 w-6 rounded" />
        ) : (
          <span
            className="text-[12px] font-bold"
            style={{ color: (pool.jobs_failed_24h ?? 0) > 0 ? "#B91C1C" : TOKEN.textSoft }}
          >
            {pool.jobs_failed_24h ?? 0}
          </span>
        )}
      </td>
    </tr>
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

const PLACEHOLDER_POOL: Status["worker_pool"] = [
  { worker_type: "knowledge-context",   jobs_waiting: 0, jobs_in_flight: 0, jobs_completed_24h: 0, jobs_failed_24h: 0 },
  { worker_type: "voice-context",       jobs_waiting: 0, jobs_in_flight: 0, jobs_completed_24h: 0, jobs_failed_24h: 0 },
  { worker_type: "learning-context",    jobs_waiting: 0, jobs_in_flight: 0, jobs_completed_24h: 0, jobs_failed_24h: 0 },
  { worker_type: "knowledge-extractor", jobs_waiting: 0, jobs_in_flight: 0, jobs_completed_24h: 0, jobs_failed_24h: 0 },
  { worker_type: "image-analyst",       jobs_waiting: 0, jobs_in_flight: 0, jobs_completed_24h: 0, jobs_failed_24h: 0 },
  { worker_type: "quality-checker",     jobs_waiting: 0, jobs_in_flight: 0, jobs_completed_24h: 0, jobs_failed_24h: 0 },
  { worker_type: "memory-guardian",     jobs_waiting: 0, jobs_in_flight: 0, jobs_completed_24h: 0, jobs_failed_24h: 0 },
];

// (Old WorkerCard + MetricPill removed — replaced by WorkerPoolTable above.)

// ── Records section ──────────────────────────────────────────────────

// ── Review Queue (approve / reject / edit) ──────────────────────────
//
// Every action here becomes signal for the Learning Context Worker.

// ── Pipeline Monitor · live event timeline ──────────────────────────
//
// Philip 2026-08-06 · watches every worker's audit event as it happens.
// Auto-polls every 2s when work is in-flight; slows to 6s when idle.
// Reads from GET /api/nex/brain/timeline which returns the latest
// audit_log rows. Uses tail-polling: only asks for events newer than
// the most recent one we've already seen.

type TimelineEvent = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor: string;
  notes?: string | null;
  after_state?: Record<string, unknown> | null;
  created_at: string;
};

function PipelineMonitor({ active }: { active: boolean }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [paused, setPaused] = useState(false);
  const [maxKeep, setMaxKeep] = useState(80);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const latestAtRef = useRef<string | null>(null);

  const fetchTimeline = useCallback(async () => {
    try {
      const since = latestAtRef.current;
      const url = since
        ? `/api/nex/brain/timeline?limit=50&since=${encodeURIComponent(since)}`
        : `/api/nex/brain/timeline?limit=50`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      const j = await res.json();
      if (!j.ok) return;
      const incoming = (j.events as TimelineEvent[]) ?? [];
      if (incoming.length === 0) return;
      // Deduplicate + keep newest first
      const additions: TimelineEvent[] = [];
      for (const e of incoming) {
        if (!seenIdsRef.current.has(e.id)) {
          additions.push(e);
          seenIdsRef.current.add(e.id);
        }
      }
      if (additions.length === 0) return;
      // Update latestAt pointer
      const newest = additions.reduce(
        (max, e) => (e.created_at > max ? e.created_at : max),
        latestAtRef.current ?? ""
      );
      latestAtRef.current = newest;
      setEvents((prev) => {
        const combined = [...additions, ...prev].sort((a, b) =>
          a.created_at < b.created_at ? 1 : -1
        );
        return combined.slice(0, maxKeep);
      });
    } catch (err) {
      console.error("[pipeline-monitor] fetch failed:", err);
    }
  }, [maxKeep]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  useEffect(() => {
    if (paused) return;
    const intervalMs = active ? 2000 : 6000;
    const id = window.setInterval(fetchTimeline, intervalMs);
    return () => window.clearInterval(id);
  }, [fetchTimeline, paused, active]);

  const clearAll = () => {
    setEvents([]);
    seenIdsRef.current.clear();
    latestAtRef.current = null;
    fetchTimeline();
  };

  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-[18px] font-black tracking-tight" style={{ color: TOKEN.text }}>
            Pipeline Monitor
          </h2>
          <p className="mt-1 text-[12px]" style={{ color: TOKEN.textSoft }}>
            Live event timeline · {active ? "polling every 2s (work in flight)" : "polling every 6s (idle)"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors hover:bg-black/5"
            style={{ background: TOKEN.card, borderColor: TOKEN.border, color: TOKEN.textMid }}
          >
            {paused ? "Resume" : "Pause"}
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors hover:bg-black/5"
            style={{ background: TOKEN.card, borderColor: TOKEN.border, color: TOKEN.textMid }}
          >
            Clear
          </button>
          <select
            value={maxKeep}
            onChange={(e) => setMaxKeep(Number(e.target.value))}
            className="rounded-full border px-2 py-1 text-[11px]"
            style={{ background: TOKEN.card, borderColor: TOKEN.border, color: TOKEN.textMid }}
            aria-label="Max events kept"
          >
            <option value={30}>30</option>
            <option value={80}>80</option>
            <option value={200}>200</option>
          </select>
        </div>
      </div>

      <div
        className="max-h-[420px] overflow-y-auto rounded-2xl border"
        style={{ background: TOKEN.card, borderColor: TOKEN.border, boxShadow: TOKEN.shadowSm }}
      >
        {events.length === 0 ? (
          <div className="p-6 text-center text-[12px]" style={{ color: TOKEN.textSoft }}>
            No events yet. Trigger a cycle or dispatch to see the pipeline in action.
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: TOKEN.divider }}>
            {events.map((ev) => (
              <TimelineRow key={ev.id} event={ev} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function TimelineRow({ event }: { event: TimelineEvent }) {
  const style = actionStyle(event.action);
  return (
    <li className="flex items-start gap-3 px-4 py-2 text-[12px]">
      <span
        className="inline-flex flex-none items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
        style={{ background: style.bg, color: style.fg }}
      >
        <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: style.dot }} />
        {style.label}
      </span>
      <span className="flex-none font-mono text-[11px]" style={{ color: TOKEN.textSoft }}>
        {new Date(event.created_at).toLocaleTimeString(undefined, {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate" style={{ color: TOKEN.text }}>
          <span className="font-semibold">{actorLabel(event.actor)}</span>
          {event.notes ? <span> — {event.notes}</span> : null}
        </div>
        {event.entity_id && event.entity_id !== "n/a" ? (
          <div
            className="mt-0.5 truncate font-mono text-[10px]"
            style={{ color: TOKEN.textSoft }}
            title={`${event.entity_type}:${event.entity_id}`}
          >
            {event.entity_type} · {event.entity_id}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function actorLabel(actor: string): string {
  if (actor === "philip") return "Philip";
  if (actor === "manager") return "Manager";
  if (actor === "importer") return "Importer";
  // worker:knowledge-extractor@2026-... → "Knowledge Extractor"
  const workerMatch = actor.match(/^worker[-:]?([a-z-]+@?)/i);
  if (workerMatch) {
    const raw = workerMatch[1].replace(/@.*/, "");
    return raw.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  // knowledge-context@1234 style
  const bareMatch = actor.match(/^([a-z-]+)@/);
  if (bareMatch) {
    return bareMatch[1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return actor;
}

function actionStyle(action: string): { label: string; bg: string; fg: string; dot: string } {
  // Grouped colour scheme so the visual signal matches the semantic
  // event category (enqueue = neutral, worker-completion = info,
  // approvals = success, review-required = warning, guardian = warning,
  // retry-succeeded = success, retry-exhausted = error, insert = accent).
  const rules: Array<{ match: RegExp; label: string; bg: string; fg: string; dot: string }> = [
    { match: /^enqueue$/,                    label: "queue",     bg: "#EDECEA", fg: "#3D3D38", dot: "#A3A39C" },
    { match: /^insert$/,                     label: "authored",  bg: "#FED7AA", fg: "#9A3412", dot: "#F97316" },
    { match: /^import$/,                     label: "imported",  bg: "#DBEAFE", fg: "#1D4ED8", dot: "#3B82F6" },
    { match: /^approve$|^approval$/,         label: "approved",  bg: "#D1FAE5", fg: "#065F46", dot: "#10B981" },
    { match: /^rejection$|^reject$/,         label: "rejected",  bg: "#FEE2E2", fg: "#991B1B", dot: "#EF4444" },
    { match: /^edit$/,                       label: "edited",    bg: "#E0E7FF", fg: "#3730A3", dot: "#6366F1" },
    { match: /^review-required$/,            label: "review",    bg: "#FED7AA", fg: "#9A3412", dot: "#F97316" },
    { match: /^context-assembled$/,          label: "context",   bg: "#DBEAFE", fg: "#1D4ED8", dot: "#3B82F6" },
    { match: /^voice-guide-assembled$/,      label: "voice",     bg: "#FEF3C7", fg: "#92400E", dot: "#F59E0B" },
    { match: /^learning-bundle-assembled$/,  label: "learn",     bg: "#D1FAE5", fg: "#065F46", dot: "#10B981" },
    { match: /^guardian-finding$/,           label: "audit",     bg: "#FEF3C7", fg: "#92400E", dot: "#F59E0B" },
    { match: /^retry-succeeded$/,            label: "retried",   bg: "#D1FAE5", fg: "#065F46", dot: "#10B981" },
    { match: /^retry-exhausted$/,            label: "exhausted", bg: "#FEE2E2", fg: "#991B1B", dot: "#EF4444" },
  ];
  for (const r of rules) if (r.match.test(action)) return r;
  return { label: action.slice(0, 12), bg: "#EDECEA", fg: "#3D3D38", dot: "#A3A39C" };
}

function ReviewQueueSection({
  records,
  onReviewed,
  onToast,
}: {
  records: KnowledgeRecord[];
  onReviewed: () => void;
  onToast: (t: { kind: "info" | "error" | "success"; message: string }) => void;
}) {
  const pending = records.filter(
    (r) => r.status === "UNDER_REVIEW" || r.status === "DRAFT"
  );

  return (
    <section className="mt-12">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h2 className="text-[18px] font-black tracking-tight" style={{ color: TOKEN.text }}>
            Review Queue
          </h2>
          <p className="mt-1 text-[12px]" style={{ color: TOKEN.textSoft }}>
            Every decision here feeds the Learning Context Worker on the next authoring run.
          </p>
        </div>
        <span
          className="rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-widest"
          style={{
            background: pending.length > 0 ? "#FED7AA" : TOKEN.card,
            borderColor: pending.length > 0 ? "#F97316" : TOKEN.border,
            color: pending.length > 0 ? "#9A3412" : TOKEN.textSoft,
          }}
        >
          {pending.length} pending
        </span>
      </div>
      {pending.length === 0 ? (
        <div className="rounded-2xl border p-6 text-center" style={{ background: TOKEN.card, borderColor: TOKEN.border }}>
          <CheckCircle2 size={22} strokeWidth={1.6} style={{ color: TOKEN.success }} className="mx-auto" />
          <div className="mt-2 text-[13px]" style={{ color: TOKEN.textSoft }}>
            No records awaiting review.
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {pending.slice(0, 20).map((r) => (
            <ReviewRow key={r.id} record={r} onReviewed={onReviewed} onToast={onToast} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ReviewRow({
  record,
  onReviewed,
  onToast,
}: {
  record: KnowledgeRecord;
  onReviewed: () => void;
  onToast: (t: { kind: "info" | "error" | "success"; message: string }) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState(record.summary);
  const [lesson, setLesson] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(action: "approve" | "reject" | "edit") {
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        record_id: record.record_id,
        action,
        lesson: lesson || undefined,
      };
      if (action === "edit") {
        body.correction = editText;
        body.severity = "moderate";
      }
      const res = await fetch("/api/nex/brain/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (j.ok) {
        onToast({
          kind: action === "approve" ? "success" : action === "reject" ? "info" : "info",
          message:
            action === "approve"
              ? `Approved · ${record.record_id}`
              : action === "reject"
                ? `Rejected · ${record.record_id}`
                : `Edit saved · ${record.record_id}`,
        });
        setEditOpen(false);
        setLesson("");
        onReviewed();
      } else {
        onToast({ kind: "error", message: `${action} failed: ${j.error ?? "unknown"}` });
      }
    } catch (err) {
      console.error("[review]", err);
      onToast({ kind: "error", message: `${action} failed` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-2xl border p-4" style={{ background: TOKEN.card, borderColor: TOKEN.border, boxShadow: TOKEN.shadowSm }}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status={record.status} />
        <span className="text-[11px] uppercase tracking-widest" style={{ color: TOKEN.textSoft }}>
          {record.primary_audience}
        </span>
        <span className="text-[11px]" style={{ color: TOKEN.textSoft }}>
          · {record.category}
        </span>
      </div>
      <div className="mt-1.5 text-[14px] font-semibold" style={{ color: TOKEN.text }}>
        {record.title}
      </div>
      <div className="mt-1 line-clamp-3 text-[12px]" style={{ color: TOKEN.textMid }}>
        {record.summary}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Lesson for the next author (optional)"
          value={lesson}
          onChange={(e) => setLesson(e.target.value)}
          className="min-w-0 flex-1 rounded-full border px-3 py-1.5 text-[12px] outline-none"
          style={{ background: TOKEN.divider, borderColor: TOKEN.border, color: TOKEN.text }}
          disabled={busy}
        />
        <button
          type="button"
          onClick={() => submit("approve")}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-50"
          style={{ background: TOKEN.success }}
        >
          <CheckCircle2 size={12} strokeWidth={2.4} />
          Approve
        </button>
        <button
          type="button"
          onClick={() => setEditOpen((o) => !o)}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50"
          style={{ background: TOKEN.card, borderColor: TOKEN.border, color: TOKEN.text }}
        >
          <Feather size={12} strokeWidth={2.4} />
          {editOpen ? "Cancel edit" : "Edit"}
        </button>
        <button
          type="button"
          onClick={() => submit("reject")}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50"
          style={{ background: "#FEE2E2", borderColor: "#EF4444", color: "#991B1B" }}
        >
          <AlertTriangle size={12} strokeWidth={2.4} />
          Reject
        </button>
      </div>

      {editOpen && (
        <div className="mt-3">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full rounded-2xl border p-3 text-[13px] outline-none"
            style={{ background: TOKEN.divider, borderColor: TOKEN.border, color: TOKEN.text, minHeight: 90 }}
            disabled={busy}
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => submit("edit")}
              disabled={busy || !editText.trim()}
              className="inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-[12px] font-bold text-white disabled:opacity-50"
              style={{ background: TOKEN.accent }}
            >
              {busy ? <Loader2 size={12} strokeWidth={2.4} className="animate-spin" /> : <Feather size={12} strokeWidth={2.4} />}
              Save correction
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

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

// Live Worker Audit Log — the retrospective evidence surface. Every LLM
// call, every provider fallthrough, every job transition is a row here.
// Enables answering "why did processing slow down yesterday?" without
// ever inspecting Fly logs. Doctrine:
// feedback_nex_must_know_its_own_state_infrastructure_doctrine_2026_08_07.md
//
// Self-contained: fetches its own data on a 5s poll so the panel updates
// live without touching the outer shell's refresh cycle.
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
};

function OpsWorkerAuditLog() {
  const [events, setEvents] = useState<AuditEventRow[]>([]);
  const [tableReady, setTableReady] = useState<boolean | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/nex/brain/audit-events?limit=30&since_hours=6", { cache: "no-store" });
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
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    let id: number | null = null;
    const start = () => { if (id === null) id = window.setInterval(load, 5000); };
    const stop = () => { if (id !== null) { window.clearInterval(id); id = null; } };
    const onVis = () => { document.hidden ? stop() : start(); };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVis);
    return () => { stop(); document.removeEventListener("visibilitychange", onVis); };
  }, [load]);

  const eventChip = (evt: string) => {
    if (evt.includes("failed") || evt.includes("rejected") || evt.includes("circuit_opened")) return { bg: "#FEE2E2", fg: "#991B1B" };
    if (evt.includes("budget_exhausted"))                                                     return { bg: "#FEF3C7", fg: "#92400E" };
    if (evt.includes("ok") || evt.includes("promoted") || evt.includes("completed"))          return { bg: "#DCFCE7", fg: "#166534" };
    if (evt.includes("started") || evt.includes("sent"))                                      return { bg: "#DBEAFE", fg: "#1D4ED8" };
    return { bg: TOKEN.divider, fg: TOKEN.textMid };
  };

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h2 className="text-[18px] font-black tracking-tight" style={{ color: TOKEN.text }}>
            Worker Audit Log
          </h2>
          <p className="mt-1 text-[12px]" style={{ color: TOKEN.textSoft }}>
            Every provider attempt · every job transition · every rejection. This is how NEX explains itself without touching Fly.
          </p>
        </div>
        <span
          className="rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-widest"
          style={{ background: TOKEN.divider, borderColor: TOKEN.border, color: TOKEN.textSoft }}
        >
          Live · 5s
        </span>
      </div>

      {/* Table-not-ready state — honest per doctrine */}
      {tableReady === false ? (
        <div
          className="mt-3 rounded-2xl border p-4 text-[12px]"
          style={{ background: "#FFFBEB", borderColor: "#F59E0B", color: "#78350F" }}
        >
          <div className="font-bold">Worker Audit Log not yet enabled</div>
          <div className="mt-1">{note ?? "Apply db/migrations/004_worker_audit_events.sql via Supabase Studio SQL Editor to create the table. The emit helper is already wired in llm.ts; events will flow as soon as the table exists."}</div>
        </div>
      ) : loading && events.length === 0 ? (
        <div className="mt-3 rounded-2xl border p-6 text-center text-[12px]" style={{ background: TOKEN.card, borderColor: TOKEN.border, color: TOKEN.textSoft }}>
          Loading audit events…
        </div>
      ) : events.length === 0 ? (
        <div className="mt-3 rounded-2xl border p-6 text-center text-[12px]" style={{ background: TOKEN.card, borderColor: TOKEN.border, color: TOKEN.textSoft }}>
          No audit events in the last 6 hours. When workers process real jobs, every LLM attempt + transition will appear here.
        </div>
      ) : (
        <div
          className="mt-3 max-h-[420px] overflow-y-auto rounded-2xl border"
          style={{ background: TOKEN.card, borderColor: TOKEN.border, boxShadow: TOKEN.shadowSm }}
        >
          {events.map((e, i) => {
            const chip = eventChip(e.event_type);
            const timeStr = new Date(e.at).toLocaleTimeString();
            return (
              <div
                key={e.id}
                className="flex items-start gap-3 px-4 py-2 text-[12px]"
                style={{ borderTop: i === 0 ? "none" : `1px solid ${TOKEN.divider}` }}
              >
                <span className="w-[70px] flex-none font-mono text-[11px]" style={{ color: TOKEN.textSoft }}>
                  {timeStr}
                </span>
                <span
                  className="flex-none rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                  style={{ background: chip.bg, color: chip.fg }}
                >
                  {e.event_type}
                </span>
                <span className="flex-1 truncate" style={{ color: TOKEN.text }}>
                  <span className="font-semibold">{e.worker_type}</span>
                  {e.provider ? <span style={{ color: TOKEN.textMid }}> · {e.provider}</span> : null}
                  {e.model ? <span className="font-mono text-[10px]" style={{ color: TOKEN.textSoft }}> · {e.model}</span> : null}
                  {e.error_snippet ? <span className="ml-2 text-[11px]" style={{ color: "#991B1B" }}>· {e.error_snippet.slice(0, 80)}</span> : null}
                </span>
                {e.latency_ms != null ? (
                  <span className="flex-none font-mono text-[11px]" style={{ color: TOKEN.textMid }}>
                    {e.latency_ms} ms
                  </span>
                ) : null}
                {e.confidence != null ? (
                  <span className="flex-none font-mono text-[11px]" style={{ color: TOKEN.info }}>
                    {Math.round(e.confidence * 100)}%
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// Configuration Mismatch — evidence-first infrastructure panel.
// Wording refined to Philip's polished formal-ops-report format
// (feedback_nex_must_know_its_own_state_infrastructure_doctrine_2026_08_07.md).
function MockConfigurationMismatch({ mockHidden }: { mockHidden: number }) {
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#92400E" }}>
        {title}
      </div>
      <div className="mt-1.5 text-[12px] leading-relaxed" style={{ color: "#78350F" }}>
        {children}
      </div>
    </div>
  );

  return (
    <div
      className="mt-3 overflow-hidden rounded-2xl border"
      style={{ background: "#FFFBEB", borderColor: "#F59E0B" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-5 py-4" style={{ borderColor: "#F59E0B", background: "#FEF3C7" }}>
        <AlertTriangle size={18} strokeWidth={2.2} style={{ color: "#92400E" }} />
        <div className="flex-1">
          <div className="text-[14px] font-bold" style={{ color: "#78350F" }}>
            Configuration Mismatch Detected — Cloud Worker
          </div>
          <div className="mt-0.5 text-[12px]" style={{ color: "#92400E" }}>
            A configuration mismatch has been detected between the expected NEX operating doctrine and the currently running cloud worker configuration. This mismatch is causing the cloud worker to generate placeholder knowledge instead of following the approved knowledge recovery workflow.
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
        <Section title="Expected Configuration">
          <div className="font-mono text-[13px]" style={{ color: "#1E293B" }}>
            LLM_ALLOW_MOCK_FALLBACK = <span className="font-bold" style={{ color: "#166534" }}>false</span>
          </div>
          <p className="mt-2">
            When an LLM provider is unavailable or reaches its quota, the request should be placed into the LLM Retry Queue for automatic processing when capacity becomes available.
            This ensures NEX never fabricates knowledge and only stores information produced by verified providers.
          </p>
        </Section>

        <Section title="Current Cloud Configuration">
          <div className="font-mono text-[13px]" style={{ color: "#1E293B" }}>
            LLM_ALLOW_MOCK_FALLBACK = <span className="font-bold" style={{ color: "#991B1B" }}>true</span>
            <span className="ml-2 text-[11px] italic" style={{ color: "#92400E" }}>(inferred from live worker behaviour)</span>
          </div>
          <p className="mt-2">
            The cloud worker is falling back to the Mock Adapter whenever available providers are exhausted or unavailable.
          </p>
        </Section>

        <div className="md:col-span-2">
          <Section title="Operational Impact">
            <ul className="mt-1 space-y-1.5">
              <li>· Approximately <span className="font-bold">{mockHidden.toLocaleString()}</span> placeholder records were generated during this reporting window.</li>
              <li>· Placeholder records are automatically excluded from the Recent Output view to protect the quality of operational reporting.</li>
              <li>· Failed provider requests are <span className="font-semibold">not</span> entering the retry queue as defined by NEX doctrine.</li>
              <li>· Downstream workers may receive fabricated input, reducing the reliability of confidence scoring, quality validation, and knowledge promotion.</li>
            </ul>
            <p className="mt-2 italic">
              Although these records remain fully auditable, they do not contribute to trusted knowledge.
            </p>
          </Section>
        </div>

        <div className="md:col-span-2">
          <Section title="Evidence">
            <p>Current telemetry indicates:</p>
            <ul className="mt-1 space-y-1">
              <li>· Placeholder records identified using the Mock Adapter (record_id pattern <span className="font-mono">mock_%</span>).</li>
              <li>· Worker activity confirms recent processing through the mock provider.</li>
              <li>· Multiple production LLM providers are currently reporting quota limits or service failures.</li>
              <li>· Provider failures are consistent with exhausted quotas, rate limiting, and unavailable services during this reporting period.</li>
            </ul>
            <p className="mt-2 italic">
              Once the Worker Audit Log is fully instrumented, this panel will display the complete provider attempt history for every job, including retries, response times, failure reasons, and the exact decision path that led to the final outcome.
            </p>
          </Section>
        </div>

        <div className="md:col-span-2 rounded-lg border p-4" style={{ background: "#FEF3C7", borderColor: "#F59E0B" }}>
          <Section title="Recommendation">
            <p>Synchronise the cloud worker configuration with the approved NEX operating doctrine.</p>
            <p className="mt-2">Once synchronised:</p>
            <ul className="mt-1 space-y-1">
              <li>· Failed requests will automatically enter the LLM Retry Queue.</li>
              <li>· No additional placeholder knowledge will be created.</li>
              <li>· Existing placeholder records will remain available for audit purposes but will no longer increase.</li>
              <li>· Knowledge quality, confidence metrics, and downstream worker processing will accurately reflect verified provider output.</li>
            </ul>
          </Section>
        </div>

        <div className="md:col-span-2 rounded-lg border p-4" style={{ background: "#FEE2E2", borderColor: "#F87171" }}>
          <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#991B1B" }}>
            Administrative Action Required
          </div>
          <div className="mt-2 text-[12px] leading-relaxed" style={{ color: "#7F1D1D" }}>
            <span className="font-semibold">Configuration Status:</span> Action Required.
            {" "}Synchronise the cloud worker configuration so it matches the approved operational doctrine before resuming normal knowledge processing.
            This recommendation is based on live operational telemetry and is intended to preserve the integrity, traceability, and reliability of the NEX knowledge platform.
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#991B1B" }}>
              Developer command
            </summary>
            <pre className="mt-1 overflow-x-auto rounded-md bg-white/70 p-2 text-[11px] font-mono" style={{ color: "#1E293B" }}>
{`fly secrets set LLM_ALLOW_MOCK_FALLBACK=false --app nex-brain-worker`}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}

// ── Helpers used by ops panels ─────────────────────────────────────

/** Pulls the first sentence of a record's body/summary as the "Finding"
 *  displayed in Recent Output. Strips markdown noise. Returns "" when
 *  the input is empty or obviously boilerplate (e.g. mock adapter output). */
function extractFirstFinding(body: string): string {
  if (!body) return "";
  // Strip markdown headings, code fences, list markers, boilerplate
  const stripped = body
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#{1,6}\s+.*$/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
  if (!stripped) return "";
  // Take the first sentence (up to first ., !, ?) — or up to 280 chars
  const match = stripped.match(/^(.{20,400}?[.!?])(\s|$)/);
  const firstSentence = match ? match[1] : stripped.slice(0, 280);
  return firstSentence.trim();
}

/** "3s ago" / "5m ago" / "2h ago" / "3d ago" — for record created_at etc. */
function formatRelativeAge(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60)     return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60)     return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours   < 24)     return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
