// scripts/nex-canonical/directory-log.ts
//
// NEX Directory · state machine + append-only checkpoint log.
//
// Pure module · no DB · no network · no filesystem. The log is a value;
// IO is injected at the runner boundary.
//
// Design posture
//   · State is DERIVED from the log by a reducer · it is never stored
//     separately. The authoritative truth of "where are we?" is the
//     append-only sequence of events, and the reducer is pure.
//   · The log is JSONL-serialisable with stable key ordering so a
//     replay produces byte-identical output.
//   · Reasons/kinds that drive progress (candidate written, source
//     exhausted, country finished) are typed discriminated-union
//     literals so TypeScript catches drift at compile time.
//   · Candidate dedup on resume: if the log already contains
//     `candidate_written` for a candidate_id, the runner must NOT
//     re-process that id.
//
// The runner that consumes this log never relies on "console memory."
// Every meaningful progress step is a logged event.

// ═════════════════════════════════════════════════════════════════════
// §1 · Runner-level state (8 states required by the authorisation)
// ═════════════════════════════════════════════════════════════════════

export type RunnerState =
  | "PROCESSING"
  | "RETRYING"
  | "WAITING"
  | "BLOCKED_ON_RECORD"
  | "EXHAUSTED_SOURCE"
  | "FINISHED_COUNTRY"
  | "MOVING_TO_NEXT_COUNTRY"
  | "GENUINELY_FINISHED";

// ═════════════════════════════════════════════════════════════════════
// §2 · Per-source state
// ═════════════════════════════════════════════════════════════════════

export type SourceState =
  | "active"
  | "retrying"
  | "waiting"
  | "exhausted"
  | "failed";

// ═════════════════════════════════════════════════════════════════════
// §3 · Per-candidate outcome
// ═════════════════════════════════════════════════════════════════════

/** The terminal outcome recorded for a candidate within one run.
 *  Non-terminal states (awaiting approval, deferred) are represented
 *  by the absence of a `candidate_written` or `candidate_quarantined`
 *  event in the log · the reducer treats them as "pending". */
export type CandidateOutcome =
  | "written"
  | "shape_rejected"
  | "approval_rejected"
  | "approval_deferred"
  | "resolver_ambiguous"
  | "resolver_abstained"
  | "precheck_blocked"
  | "write_abstained"
  | "verification_mismatch"
  | "duplicate_skipped"; // dedup fired on resume

// ═════════════════════════════════════════════════════════════════════
// §4 · Checkpoint events · the only source of truth
// ═════════════════════════════════════════════════════════════════════

/** Opaque per-source cursor · owned by the source implementation.
 *  Serialised through stableStringify so dedup/replay is byte-stable. */
export type SourceCursor = Readonly<Record<string, string | number | boolean | null>>;

export type CheckpointEvent =
  // Run lifecycle
  | {
      readonly kind: "run_started";
      readonly ts: string;
      readonly country: string;
      readonly sources: readonly string[];
    }
  | {
      readonly kind: "country_finished";
      readonly ts: string;
      readonly country: string;
      readonly reason: "all_sources_exhausted" | "all_sources_failed" | "operator_stop";
    }
  // Source lifecycle
  | {
      readonly kind: "source_started";
      readonly ts: string;
      readonly country: string;
      readonly source_id: string;
      readonly cursor: SourceCursor | null;
    }
  | {
      readonly kind: "source_batch_fetched";
      readonly ts: string;
      readonly country: string;
      readonly source_id: string;
      readonly candidate_count: number;
      readonly next_cursor: SourceCursor | null;
    }
  | {
      readonly kind: "source_retrying";
      readonly ts: string;
      readonly country: string;
      readonly source_id: string;
      readonly attempt: number;
      readonly reason: string;
      readonly next_delay_ms: number;
    }
  | {
      readonly kind: "source_exhausted";
      readonly ts: string;
      readonly country: string;
      readonly source_id: string;
    }
  | {
      readonly kind: "source_failed";
      readonly ts: string;
      readonly country: string;
      readonly source_id: string;
      readonly reason: string;
    }
  // Candidate progression · each candidate accumulates events
  | {
      readonly kind: "candidate_discovered";
      readonly ts: string;
      readonly country: string;
      readonly source_id: string;
      readonly candidate_id: string;
    }
  | {
      readonly kind: "candidate_shape_rejected";
      readonly ts: string;
      readonly candidate_id: string;
      readonly detail: string;
    }
  | {
      readonly kind: "candidate_reviewed";
      readonly ts: string;
      readonly candidate_id: string;
      readonly anomaly_rules: readonly string[];
    }
  | {
      readonly kind: "candidate_decided";
      readonly ts: string;
      readonly candidate_id: string;
      readonly decision: "approve" | "reject" | "defer";
      readonly decision_record_id: string;
    }
  | {
      readonly kind: "candidate_resolved";
      readonly ts: string;
      readonly candidate_id: string;
      readonly verdict: "MATCH" | "NO_MATCH" | "AMBIGUOUS";
      readonly target_id: string | null;
      readonly score: number;
    }
  | {
      readonly kind: "candidate_resolver_abstained";
      readonly ts: string;
      readonly candidate_id: string;
      readonly reason_code: string;
    }
  | {
      readonly kind: "candidate_precheck_passed";
      readonly ts: string;
      readonly candidate_id: string;
      readonly plan_kind: "insert_new" | "merge_match";
    }
  | {
      readonly kind: "candidate_precheck_blocked";
      readonly ts: string;
      readonly candidate_id: string;
      readonly reason_kind: string;
      readonly detail: string;
    }
  | {
      readonly kind: "candidate_quarantined";
      readonly ts: string;
      readonly candidate_id: string;
      readonly outcome: CandidateOutcome;
      readonly reason: string;
    }
  | {
      readonly kind: "candidate_written";
      readonly ts: string;
      readonly candidate_id: string;
      readonly canonical_business_id: string;
      readonly evidence_id: string;
      readonly plan_kind: "insert_new" | "merge_match";
    }
  | {
      readonly kind: "candidate_write_abstained";
      readonly ts: string;
      readonly candidate_id: string;
      readonly reason_code: string;
      readonly reason: string;
    }
  | {
      readonly kind: "candidate_verified";
      readonly ts: string;
      readonly candidate_id: string;
      readonly canonical_business_id: string;
      readonly all_fields_match: boolean;
      readonly no_duplicates: boolean;
    }
  | {
      readonly kind: "candidate_verification_failed";
      readonly ts: string;
      readonly candidate_id: string;
      readonly reason: string;
    }
  | {
      readonly kind: "candidate_duplicate_skipped";
      readonly ts: string;
      readonly candidate_id: string;
      readonly original_event_ts: string;
    };

// ═════════════════════════════════════════════════════════════════════
// §5 · Deterministic JSONL serialisation
// ═════════════════════════════════════════════════════════════════════

export function stableStringify(obj: unknown): string {
  if (obj === null) return "null";
  if (typeof obj === "number") {
    if (!Number.isFinite(obj)) {
      throw new Error("stableStringify: non-finite number is not JSON-safe");
    }
    return JSON.stringify(obj);
  }
  if (typeof obj === "boolean" || typeof obj === "string") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map((e) => stableStringify(e)).join(",") + "]";
  }
  if (typeof obj === "object") {
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    return (
      "{" +
      keys
        .map(
          (k) =>
            JSON.stringify(k) +
            ":" +
            stableStringify((obj as Record<string, unknown>)[k]),
        )
        .join(",") +
      "}"
    );
  }
  throw new Error(
    `stableStringify: value of type "${typeof obj}" is not JSON-safe`,
  );
}

export function serializeCheckpointLog(
  events: readonly CheckpointEvent[],
): string {
  if (events.length === 0) return "";
  return events.map((e) => stableStringify(e)).join("\n") + "\n";
}

export class CheckpointLogParseError extends Error {
  readonly path: string;
  constructor(path: string, detail: string) {
    super(`CheckpointLogParseError at ${path}: ${detail}`);
    this.name = "CheckpointLogParseError";
    this.path = path;
  }
}

export function parseCheckpointLog(text: string): readonly CheckpointEvent[] {
  const lines = text.split("\n");
  const out: CheckpointEvent[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.length === 0) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new CheckpointLogParseError(
        `line ${i + 1}`,
        `invalid JSON · ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed) ||
      typeof (parsed as { kind?: unknown }).kind !== "string"
    ) {
      throw new CheckpointLogParseError(
        `line ${i + 1}`,
        "event must be an object with a string `kind`",
      );
    }
    out.push(parsed as CheckpointEvent);
  }
  return out;
}

// ═════════════════════════════════════════════════════════════════════
// §6 · Reducer · derive current state from the log
// ═════════════════════════════════════════════════════════════════════

export interface CandidateState {
  readonly candidate_id: string;
  readonly source_id: string | null;
  readonly outcome: CandidateOutcome | null; // null = still pending
  readonly canonical_business_id: string | null;
  readonly evidence_id: string | null;
  readonly verified: boolean;
}

export interface SourceStateEntry {
  readonly country: string;
  readonly source_id: string;
  readonly state: SourceState;
  readonly last_cursor: SourceCursor | null;
  readonly retry_attempts: number;
}

export interface DerivedState {
  readonly country: string | null;
  readonly sources: ReadonlyMap<string, SourceStateEntry>;
  readonly candidates: ReadonlyMap<string, CandidateState>;
  readonly country_finished: boolean;
  readonly country_finish_reason: string | null;
}

/** Deterministic reducer. Pure. Replaying the same log yields the same
 *  state. Later events supersede earlier events of the same kind for
 *  the same key. */
export function reduceCheckpointLog(
  events: readonly CheckpointEvent[],
): DerivedState {
  let country: string | null = null;
  const sources = new Map<string, SourceStateEntry>();
  const candidates = new Map<string, CandidateState>();
  let country_finished = false;
  let country_finish_reason: string | null = null;

  const setSource = (
    source_id: string,
    patch: Partial<SourceStateEntry>,
  ): void => {
    const existing: SourceStateEntry = sources.get(source_id) ?? {
      country: country ?? "",
      source_id,
      state: "active",
      last_cursor: null,
      retry_attempts: 0,
    };
    sources.set(source_id, { ...existing, ...patch });
  };

  const setCandidate = (
    candidate_id: string,
    patch: Partial<CandidateState>,
  ): void => {
    const existing: CandidateState = candidates.get(candidate_id) ?? {
      candidate_id,
      source_id: null,
      outcome: null,
      canonical_business_id: null,
      evidence_id: null,
      verified: false,
    };
    candidates.set(candidate_id, { ...existing, ...patch });
  };

  for (const ev of events) {
    switch (ev.kind) {
      case "run_started":
        country = ev.country;
        country_finished = false;
        country_finish_reason = null;
        for (const sid of ev.sources) {
          setSource(sid, { country: ev.country, state: "active" });
        }
        break;
      case "country_finished":
        country_finished = true;
        country_finish_reason = ev.reason;
        break;
      case "source_started":
        setSource(ev.source_id, {
          country: ev.country,
          state: "active",
          last_cursor: ev.cursor,
        });
        break;
      case "source_batch_fetched":
        setSource(ev.source_id, { last_cursor: ev.next_cursor });
        break;
      case "source_retrying":
        setSource(ev.source_id, {
          state: "retrying",
          retry_attempts: ev.attempt,
        });
        break;
      case "source_exhausted":
        setSource(ev.source_id, { state: "exhausted" });
        break;
      case "source_failed":
        setSource(ev.source_id, { state: "failed" });
        break;
      case "candidate_discovered":
        setCandidate(ev.candidate_id, { source_id: ev.source_id });
        break;
      case "candidate_shape_rejected":
        setCandidate(ev.candidate_id, { outcome: "shape_rejected" });
        break;
      case "candidate_reviewed":
      case "candidate_decided":
      case "candidate_resolved":
      case "candidate_precheck_passed":
        // Progress event · no terminal outcome yet.
        setCandidate(ev.candidate_id, {});
        break;
      case "candidate_resolver_abstained":
        setCandidate(ev.candidate_id, { outcome: "resolver_abstained" });
        break;
      case "candidate_precheck_blocked":
        setCandidate(ev.candidate_id, { outcome: "precheck_blocked" });
        break;
      case "candidate_quarantined":
        setCandidate(ev.candidate_id, { outcome: ev.outcome });
        break;
      case "candidate_written":
        setCandidate(ev.candidate_id, {
          outcome: "written",
          canonical_business_id: ev.canonical_business_id,
          evidence_id: ev.evidence_id,
        });
        break;
      case "candidate_write_abstained":
        setCandidate(ev.candidate_id, { outcome: "write_abstained" });
        break;
      case "candidate_verified":
        setCandidate(ev.candidate_id, { verified: ev.all_fields_match && ev.no_duplicates });
        break;
      case "candidate_verification_failed":
        setCandidate(ev.candidate_id, {
          outcome: "verification_mismatch",
          verified: false,
        });
        break;
      case "candidate_duplicate_skipped":
        setCandidate(ev.candidate_id, { outcome: "duplicate_skipped" });
        break;
    }
  }

  return {
    country,
    sources,
    candidates,
    country_finished,
    country_finish_reason,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §7 · Progress helpers
// ═════════════════════════════════════════════════════════════════════

/** True iff this candidate has an irreversible terminal outcome. The
 *  runner uses this to skip already-processed candidates on resume. */
export function isCandidateFinal(state: CandidateState): boolean {
  return state.outcome !== null;
}

/** True iff the candidate's end-state is a successful committed write. */
export function isCandidateWritten(state: CandidateState): boolean {
  return state.outcome === "written" || state.outcome === "duplicate_skipped";
}

/** Compute the overall runner state from the current derived state and
 *  the "most recent" event. A pure function on the log tail. */
export function computeRunnerState(
  derived: DerivedState,
  recentEventKind: CheckpointEvent["kind"] | null,
): RunnerState {
  if (derived.country_finished) return "FINISHED_COUNTRY";
  if (recentEventKind === "source_retrying") return "RETRYING";
  if (recentEventKind === "source_exhausted") return "EXHAUSTED_SOURCE";
  if (recentEventKind === null) return "PROCESSING";
  const allSourcesTerminal = Array.from(derived.sources.values()).every(
    (s) => s.state === "exhausted" || s.state === "failed",
  );
  if (allSourcesTerminal && derived.sources.size > 0) {
    return "FINISHED_COUNTRY";
  }
  // Pending candidate without terminal outcome → likely awaiting
  // approval; count as BLOCKED_ON_RECORD if the most recent event is
  // candidate_decided with decision=defer. Otherwise PROCESSING.
  return "PROCESSING";
}

/** Produce counts for observability. Pure. */
export interface RunSummary {
  readonly country: string | null;
  readonly country_finished: boolean;
  readonly country_finish_reason: string | null;
  readonly source_count_total: number;
  readonly source_count_active: number;
  readonly source_count_exhausted: number;
  readonly source_count_failed: number;
  readonly candidate_count_total: number;
  readonly candidate_count_written: number;
  readonly candidate_count_quarantined: number;
  readonly candidate_count_pending: number;
  readonly candidate_count_by_outcome: Readonly<
    Partial<Record<CandidateOutcome, number>>
  >;
}

export function summarizeDerivedState(derived: DerivedState): RunSummary {
  let active = 0;
  let exhausted = 0;
  let failed = 0;
  for (const s of derived.sources.values()) {
    if (s.state === "active" || s.state === "retrying" || s.state === "waiting") active++;
    else if (s.state === "exhausted") exhausted++;
    else if (s.state === "failed") failed++;
  }
  let written = 0;
  let quarantined = 0;
  let pending = 0;
  const byOutcome: Partial<Record<CandidateOutcome, number>> = {};
  for (const c of derived.candidates.values()) {
    if (c.outcome === null) {
      pending++;
      continue;
    }
    byOutcome[c.outcome] = (byOutcome[c.outcome] ?? 0) + 1;
    if (c.outcome === "written" || c.outcome === "duplicate_skipped") {
      written++;
    } else {
      quarantined++;
    }
  }
  return {
    country: derived.country,
    country_finished: derived.country_finished,
    country_finish_reason: derived.country_finish_reason,
    source_count_total: derived.sources.size,
    source_count_active: active,
    source_count_exhausted: exhausted,
    source_count_failed: failed,
    candidate_count_total: derived.candidates.size,
    candidate_count_written: written,
    candidate_count_quarantined: quarantined,
    candidate_count_pending: pending,
    candidate_count_by_outcome: byOutcome,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §8 · Static invariants
// ═════════════════════════════════════════════════════════════════════
//
// This module:
//   · is PURE · no DB, no network, no filesystem, no clock, no
//     randomness
//   · does NOT import pg · pg-executor · pg-fingerprint ·
//     extract-candidates · identity-matching · entity-universe
//   · does NOT decide approval or resolve identity (that is the
//     already-sealed sealed-pipeline's responsibility)
//   · does NOT invent canonical rows or evidence rows
//   · defines the vocabulary of state transitions and lets the runner
//     orchestrate them against the sealed pipeline
