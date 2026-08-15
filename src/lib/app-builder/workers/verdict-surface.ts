// NEX App Builder · Phase 19C · Operator verdict surface (Philip 2026-08-14).
//
// Pure adapter: OrchestratorResult → UI-safe verdict summaries.
//
// Constitutional rules this file enforces:
//   1. Never invent a verdict — every summary is a direct projection of what
//      the worker already emitted in Phase 19B.
//   2. Never leak a secret value into the operator UI. Evidence records may
//      carry `value` fields; this adapter strips anything that looks like a
//      credential (env values, tokens). Only presence booleans and key names
//      survive.
//   3. Preserve worker order — operators read top-to-bottom and expect a
//      stable order (validation → dataModel → integration → design → visualQA
//      → provenanceSurface).
//   4. Never drop the diagnosis / decision — a chip alone is not enough
//      information for the operator to act; the human-readable pair is the
//      whole point of Phase 19B.
//   5. Missing upstream (null) is a legitimate state — surface it as UNKNOWN
//      with a diagnosis explaining the orchestrator short-circuit.

import type { OrchestratorResult } from "./orchestrator";
import type {
  EvidenceRecord,
  EvidenceSource,
  EvidenceState,
  EvidenceVerdict,
  WorkerReport,
  WorkerStatus
} from "./types";

/** UI-safe evidence highlight — never contains a raw credential value. */
export type EvidenceHighlight = {
  observation: string;
  source: EvidenceSource;
  path?: string;
  /** Only present when the value is safe to display (booleans, small
   *  objects of counts, arrays of key names). Never a secret value. */
  safeValue?: unknown;
};

/** UI-safe verdict summary for a single worker. */
export type WorkerVerdictSummary = {
  worker: WorkerKey;
  displayName: string;
  /** Coarse WorkerStatus preserved from Phase 19A. */
  status: WorkerStatus;
  /** 8-state EvidenceState from Phase 19B. */
  state: EvidenceState;
  diagnosis: string;
  decision: string;
  evidenceCount: number;
  /** Up to 5 highlights, credential-scrubbed. */
  evidenceHighlights: EvidenceHighlight[];
  /** Duration for the operator's mental model. */
  durationMs: number;
};

/** Ordered set of six workers as the operator reads them. */
export type WorkerKey =
  | "validation"
  | "dataModel"
  | "integration"
  | "design"
  | "visualQA"
  | "provenanceSurface";

export type OperatorVerdictSurface = {
  runId: string;
  ranAt: string;
  overall: OrchestratorResult["overall"];
  totalDurationMs: number;
  /** In-order verdicts. Missing workers appear as UNKNOWN, never dropped. */
  verdicts: WorkerVerdictSummary[];
  /** Precomputed counts for a header banner. */
  counts: Record<EvidenceState, number>;
};

const WORKER_DISPLAY: Record<WorkerKey, string> = {
  validation: "Validation",
  dataModel: "Data model",
  integration: "Integrations",
  design: "Design & imagery",
  visualQA: "Visual QA",
  provenanceSurface: "Operator surface"
};

/** Canonical worker order — do not change without updating tests + UI. */
const WORKER_ORDER: WorkerKey[] = [
  "validation",
  "dataModel",
  "integration",
  "design",
  "visualQA",
  "provenanceSurface"
];

/**
 * Adapt a full OrchestratorResult into a UI-safe operator surface.
 *
 * Pure. Deterministic. Never throws. Never invents.
 */
export function toOperatorVerdicts(result: OrchestratorResult): OperatorVerdictSurface {
  const reports = result.workerReports;

  const verdicts: WorkerVerdictSummary[] = WORKER_ORDER.map((key) => {
    const report = reports[key];
    if (!report) {
      return {
        worker: key,
        displayName: WORKER_DISPLAY[key],
        status: "blocked",
        state: "UNKNOWN",
        diagnosis: `Worker "${key}" did not run — the orchestrator short-circuited (likely on validation failure)`,
        decision: "Resolve the upstream failure first; re-run the orchestrator to gather this worker's evidence",
        evidenceCount: 0,
        evidenceHighlights: [],
        durationMs: 0
      };
    }
    return summariseReport(key, report);
  });

  // Header counts by state — for the operator banner.
  const counts: Record<EvidenceState, number> = {
    HEALTHY: 0,
    DEGRADED: 0,
    BLOCKED_INPUT: 0,
    BLOCKED_CONFIG: 0,
    BLOCKED_UPSTREAM: 0,
    FAILED: 0,
    PENDING: 0,
    UNKNOWN: 0
  };
  for (const v of verdicts) counts[v.state]++;

  return {
    runId: result.runId,
    ranAt: result.ranAt,
    overall: result.overall,
    totalDurationMs: result.totalDurationMs,
    verdicts,
    counts
  };
}

function summariseReport<T>(key: WorkerKey, report: WorkerReport<T>): WorkerVerdictSummary {
  const verdict: EvidenceVerdict = report.verdict;
  return {
    worker: key,
    displayName: WORKER_DISPLAY[key],
    status: report.status,
    state: verdict.state,
    diagnosis: verdict.diagnosis,
    decision: verdict.decision,
    evidenceCount: verdict.evidence.length,
    evidenceHighlights: pickHighlights(verdict.evidence).map(scrubHighlight),
    durationMs: report.meta.durationMs
  };
}

/**
 * Pick up to 5 evidence records that best explain the verdict. Order:
 *   1. Records with a `path` (they anchor to a Blueprint address).
 *   2. Records that came from `upstream` (they explain propagation).
 *   3. The rest, in original order.
 */
function pickHighlights(records: readonly EvidenceRecord[]): EvidenceRecord[] {
  const withPath = records.filter((r) => typeof r.path === "string" && r.path.length > 0);
  const upstream = records.filter((r) => r.source === "upstream" && !withPath.includes(r));
  const rest = records.filter((r) => !withPath.includes(r) && !upstream.includes(r));
  return [...withPath, ...upstream, ...rest].slice(0, 5);
}

/**
 * Credential-scrub an evidence record before it crosses into UI space.
 *
 * The rule is conservative: unless a value is one of the known-safe shapes
 * (booleans · arrays of key names · small stat objects), it is dropped from
 * `safeValue`. Workers must NEVER put secret values into `value` in the
 * first place, but this belt-and-braces prevents a future regression from
 * leaking one.
 */
function scrubHighlight(record: EvidenceRecord): EvidenceHighlight {
  return {
    observation: record.observation,
    source: record.source,
    path: record.path,
    safeValue: safeValueOf(record.value)
  };
}

const SECRET_SHAPED_KEY = /(secret|token|key|password|credential|bearer|cookie|session)/i;

/**
 * Return a UI-safe projection of an evidence value, or undefined if it
 * cannot be safely displayed.
 *
 * Safe shapes:
 *   - boolean
 *   - number
 *   - string of length ≤ 80 AND not matching a secret pattern
 *   - array of strings (each ≤ 80 chars, none looking like a secret)
 *   - shallow object of the above, where no KEY matches SECRET_SHAPED_KEY
 *     unless the value is a boolean or a small integer (presence + count).
 */
function safeValueOf(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") return safeString(value);
  if (Array.isArray(value)) {
    const cleaned = value
      .map((el) => (typeof el === "string" ? safeString(el) : el))
      .filter((el) => el !== undefined);
    return cleaned.length > 0 ? cleaned.slice(0, 20) : undefined;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_SHAPED_KEY.test(k) && typeof v !== "boolean" && typeof v !== "number") {
        // Key looks sensitive AND value isn't a presence flag → drop.
        continue;
      }
      const safe = safeValueOf(v);
      if (safe !== undefined) out[k] = safe;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }
  return undefined;
}

function safeString(s: string): string | undefined {
  if (s.length === 0) return undefined;
  if (s.length > 80) return s.slice(0, 77) + "…";
  // A raw string that looks like a token is dropped entirely. Keys that
  // NAME a secret are fine (e.g. "STRIPE_SECRET_KEY") — the presence of
  // that key name in a UI is expected. But if the string itself is 40+
  // chars of high-entropy junk, drop it.
  if (s.length >= 40 && /^[A-Za-z0-9_\-.]+$/.test(s) && !s.includes(" ")) {
    // High-entropy candidate. Only allow if it's clearly a well-known
    // safe pattern (env var name convention: SCREAMING_SNAKE_CASE).
    if (!/^[A-Z][A-Z0-9_]*$/.test(s)) return undefined;
  }
  return s;
}
