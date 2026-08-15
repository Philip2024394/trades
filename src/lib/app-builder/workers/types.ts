// NEX App Builder · Worker types (Philip 2026-08-14).
//
// Common shapes every worker uses. Workers are pure functions:
//   input → deterministic report → next worker.
//
// Constitutional rules — every worker must respect:
//   - Never invent customer facts
//   - Never invent registry ids
//   - Never invent integration credentials
//   - Never invent images/assets
//   - Silence over fabrication: mark REQUIRED or MISSING, do not fill
//
// Phase 19B (Philip 2026-08-14) · Eight-state evidence model.
//   Every worker returns an EvidenceVerdict that answers three questions:
//     - evidence[]  what did the worker observe?
//     - diagnosis   what does that observation mean?
//     - decision    what should the operator/orchestrator do next?
//   Central rule: state → evidence → diagnosis → decision.
//   NEVER: state → guess → restart.
//   The 8-state taxonomy is additive to WorkerStatus (the coarse 4-level
//   verdict is preserved so existing consumers keep working).

import type { AppBlueprint } from "../blueprint-schema";

/** Status envelope every worker returns. Never throws. */
export type WorkerStatus = "ok" | "warn" | "blocked" | "failed";

/**
 * Phase 19B · Eight-state evidence taxonomy.
 *
 * Every state is grounded in evidence the worker actually observed.
 * Workers may NEVER emit a state that isn't backed by an EvidenceRecord.
 */
export type EvidenceState =
  /** Evidence confirms all preconditions met. Worker can hand off downstream. */
  | "HEALTHY"
  /** Evidence shows non-blocking gaps (warnings the operator should see but
   *  which do not prevent build). */
  | "DEGRADED"
  /** Evidence points at a missing customer/owner-supplied fact. */
  | "BLOCKED_INPUT"
  /** Evidence points at missing runtime configuration (env vars, credentials). */
  | "BLOCKED_CONFIG"
  /** Evidence points at an upstream worker verdict (this worker cannot proceed
   *  because a dependency isn't HEALTHY/DEGRADED). */
  | "BLOCKED_UPSTREAM"
  /** Evidence confirms a defect the worker cannot resolve on its own. */
  | "FAILED"
  /** Evidence gathering is intentionally deferred — this state requires an
   *  explicit execution step (e.g. Playwright QA run) to move to PASS/FAIL. */
  | "PENDING"
  /** Evidence gathering itself failed — the worker could not reach the data
   *  source. Silence, not guess. */
  | "UNKNOWN";

/** Where the observation came from. Extensible when new sources appear. */
export type EvidenceSource =
  | "blueprint"      // read from AppBlueprint
  | "env"            // read from process.env (presence-only, never value)
  | "adapter"        // read from blueprint→pipeline adapter
  | "hero-library"   // read from scripts/hero-library.json
  | "playwright"     // observed by headless browser run
  | "upstream"       // derived from an upstream worker's verdict
  | "runtime"        // observed at worker runtime (durations, counts)
  | "registry";      // read from the section registry

/**
 * A single evidence record. Workers append these as they observe.
 * The `observation` string is human-readable; the `path` + `value` fields
 * are for machine consumers.
 *
 * Constitutional rule: only include `value` when it is safe to log (never
 * secrets, never full credentials — env presence is boolean-only).
 */
export type EvidenceRecord = {
  observation: string;
  source: EvidenceSource;
  path?: string;
  value?: unknown;
};

/**
 * The verdict every worker report carries.
 *
 * `evidence` is the raw observation set. `diagnosis` explains what those
 * observations mean. `decision` tells the operator/orchestrator what to do
 * next. This shape is the operational contract for Phase 19B onward.
 */
export type EvidenceVerdict = {
  state: EvidenceState;
  evidence: EvidenceRecord[];
  diagnosis: string;
  decision: string;
};

export type WorkerReport<T> = {
  worker: string;
  status: WorkerStatus;
  /** Actionable-by-workers structured payload. */
  data: T;
  /** Human-readable, deterministic. Shown to Studio operator + logs. */
  messages: WorkerMessage[];
  /** Machine-readable errors. */
  errors: WorkerIssue[];
  /** Machine-readable warnings. */
  warnings: WorkerIssue[];
  /** Phase 19B · eight-state evidence-based verdict. */
  verdict: EvidenceVerdict;
  /** Metadata for observability. */
  meta: {
    durationMs: number;
    startedAt: string;
    ranAt: string;
  };
};

export type WorkerMessage = {
  level: "info" | "warn" | "error";
  text: string;
  /** Blueprint dotted path this message concerns, if any. */
  path?: string;
};

export type WorkerIssue = {
  code: string;
  message: string;
  /** Blueprint dotted path this issue concerns, if any. */
  path?: string;
  /** What Studio should surface to the operator to resolve. */
  resolution?: string;
};

/** Ambient context every worker gets — kept minimal on purpose. */
export type WorkerContext = {
  /** Passed by the orchestrator; workers set correlation ids for logs. */
  runId: string;
  /** Blueprint under construction. Workers may READ but MUST NOT MUTATE. */
  blueprint: AppBlueprint;
};

/** Helper to seed a report with timings + evidence-verdict. */
export function startReport(worker: string): {
  finish: <T>(
    status: WorkerStatus,
    data: T,
    verdict: EvidenceVerdict,
    extras?: Partial<Pick<WorkerReport<T>, "messages" | "errors" | "warnings">>
  ) => WorkerReport<T>;
} {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  return {
    finish<T>(
      status: WorkerStatus,
      data: T,
      verdict: EvidenceVerdict,
      extras: Partial<Pick<WorkerReport<T>, "messages" | "errors" | "warnings">> = {}
    ) {
      return {
        worker,
        status,
        data,
        messages: extras.messages ?? [],
        errors: extras.errors ?? [],
        warnings: extras.warnings ?? [],
        verdict,
        meta: {
          durationMs: Date.now() - t0,
          startedAt,
          ranAt: new Date().toISOString()
        }
      };
    }
  };
}
