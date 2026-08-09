// NEX Brain · storage abstraction
//
// The boundary between "which backend" and "what the app calls".
//
// Backend selection (Philip 2026-08-06 production migration):
//   · NEX_BRAIN_BACKEND=postgres AND NEX_POSTGRES_URL present
//                                                    → Postgres
//   · NEX_BRAIN_BACKEND=supabase AND the Supabase env vars present
//                                                    → Supabase
//   · otherwise                                      → filesystem (dev)
//
// Env vars checked (either set works):
//   Primary  — NEX_SUPABASE_URL + NEX_SUPABASE_SERVICE_ROLE_KEY
//   Fallback — NEXT_PUBLIC_NEX_SUPABASE_URL (existing Nex project URL)
//              + NEX_SUPABASE_SERVICE_ROLE_KEY
//   Generic  — SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (for a fresh
//              standalone brain project if Philip prefers to isolate)
//
// All three backends implement the same BrainStore interface. Every
// worker, route, and UI reads/writes through this module — nobody else
// touches the DB or the filesystem directly. Swap once, works everywhere.
//
// ── Wave 11 · Step 10 · F12 architectural invariant (Philip 2026-08-11)
//
//   1 · storage.ts is the SOLE Brain selector · `brainStore()` is the
//       ONE authoritative singleton entry point for Brain persistence.
//   2 · `adapters/*.ts` export PURE CLASSES ONLY · no selector logic ·
//       no cached singletons · no env-var branching inside adapters.
//   3 · Brain adapters MUST NOT import from `src/lib/nex/storage/*`.
//       That module is the SEPARATE NEX Storage runtime service ·
//       Brain × NEX Storage must never become two competing persistence
//       paths for the same Brain data.
//   4 · The ONLY provider-SDK import per adapter file is inside that
//       adapter file itself. `storage.ts` imports NO provider SDK.
//   5 · The ONE write-decorator (`MirrorToSupabaseBrainStore` in
//       `pg-to-supabase-shadow.ts`) is a Wave 7 rollback safety net ·
//       reads pass through to the inner primary · mirror writes are
//       fire-and-forget · activation requires explicit opt-in via
//       `NEX_BRAIN_SHADOW_SUPABASE=1`. No other decorator may exist.
//
// These five clauses are enforced at test time by
// `src/lib/nex/brain/tests/adapter-isolation.test.mjs` (the F12
// drift-catcher). Any future PR that violates them will fail CI.
//
// Filesystem layout (dev backend):
//   data/nex-brain/
//     records.json        knowledge_records
//     record_versions.json
//     graph_edges.json
//     worker_jobs.json
//     worker_results.json
//     sources.json
//     confidence_scores.json
//     contradictions.json
//     deprecations.json
//     knowledge_feedback.json    ← the moat
//     audit_log.json
//
// Supabase tables are the same 11 from db/migrations/001_nex_brain_schema.sql.
// They coexist with existing Nex tables (nex_projects, nex_images, etc.)
// because names don't collide.

import { randomBytes } from "node:crypto";
import type {
  AuditEntry,
  BrainStatus,
  ConfidenceScore,
  Contradiction,
  Deprecation,
  GraphEdge,
  JobStatus,
  KnowledgeFeedback,
  KnowledgeRecord,
  LlmRetryEntry,
  LlmRetryStatus,
  RecordVersion,
  Source,
  WorkerHeartbeat,
  WorkerJob,
  WorkerPoolHealth,
  WorkerResult,
  WorkerType,
} from "./types";

// ── Backend selection ────────────────────────────────────────────────
//
// Explicit opt-in: NEX_BRAIN_BACKEND=supabase must be set (in addition
// to the Supabase env vars) to activate the Supabase backend.
// This prevents accidental activation when the repo already has
// SUPABASE_URL configured for other features. Default is always the
// filesystem backend — safe for dev.

// Exported (Wave 11 · Step 10 · F12) so the extracted
// adapters/supabase.ts constructor can resolve credentials via the
// same helpers that `isSupabaseConfigured()` uses. Keeping these here
// (rather than duplicating inside the adapter) preserves ONE resolution
// path — a Brain × Env-var invariant that the F12 drift-catcher enforces.
export function resolveSupabaseUrl(): string | undefined {
  return (
    process.env.NEX_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_NEX_SUPABASE_URL ||
    process.env.SUPABASE_URL
  );
}

export function resolveSupabaseServiceRoleKey(): string | undefined {
  return (
    process.env.NEX_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function isSupabaseConfigured(): boolean {
  return (
    process.env.NEX_BRAIN_BACKEND === "supabase" &&
    Boolean(resolveSupabaseUrl() && resolveSupabaseServiceRoleKey())
  );
}

// Phase 11.1b · added the "postgres" backend option. Selected when
// NEX_BRAIN_BACKEND=postgres AND NEX_POSTGRES_URL is present. Zero
// production traffic today · adapter exists so 11.1c parity can run.
function isPostgresConfigured(): boolean {
  return (
    process.env.NEX_BRAIN_BACKEND === "postgres" &&
    Boolean(process.env.NEX_POSTGRES_URL)
  );
}

export function activeBackend(): "filesystem" | "supabase" | "postgres" {
  if (isPostgresConfigured()) return "postgres";
  if (isSupabaseConfigured()) return "supabase";
  return "filesystem";
}

// ── ID + timestamp utilities ─────────────────────────────────────────

export function newId(): string {
  // UUID v4 shape without pulling a library — good enough for the fs
  // backend; Supabase generates its own via gen_random_uuid().
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

// ── The BrainStore contract ──────────────────────────────────────────

export interface BrainStore {
  // Records
  insertRecord(input: Omit<KnowledgeRecord, "id" | "created_at">): Promise<KnowledgeRecord>;
  /** Phase 10.2 · idempotent variant: if a row with the same record_id
   *  already exists, return it with `created:false` instead of throwing.
   *  Prefer this over insertRecord() in any worker path where the input
   *  record_id may already have been produced by an earlier run (retries,
   *  re-imports, LLM re-emitting the same slug). Uses DB-level ON CONFLICT
   *  DO NOTHING semantics on the Supabase backend so it is race-safe. */
  insertRecordIdempotent(
    input: Omit<KnowledgeRecord, "id" | "created_at">,
  ): Promise<{ record: KnowledgeRecord; created: boolean }>;
  getRecord(record_id: string): Promise<KnowledgeRecord | null>;
  listRecords(filter?: { status?: KnowledgeRecord["status"]; limit?: number }): Promise<KnowledgeRecord[]>;
  updateRecordStatus(record_id: string, status: KnowledgeRecord["status"], reviewer?: string): Promise<KnowledgeRecord | null>;

  // Versions
  insertVersion(input: Omit<RecordVersion, "id" | "changed_at">): Promise<RecordVersion>;

  // Edges
  insertEdge(input: Omit<GraphEdge, "id" | "created_at">): Promise<GraphEdge>;
  listEdges(from_record_id?: string): Promise<GraphEdge[]>;

  // Jobs — the queue
  enqueueJob(input: Omit<WorkerJob, "id" | "status" | "attempts" | "created_at" | "updated_at">): Promise<WorkerJob>;
  claimNextJob(worker_type: WorkerType, worker_id: string, lease_seconds?: number): Promise<WorkerJob | null>;
  completeJob(job_id: string, result_id: string): Promise<void>;
  failJob(job_id: string, error: string): Promise<void>;
  countJobs(worker_type: WorkerType, status: JobStatus): Promise<number>;
  /** Phase 11.0 · TRANSITIONAL · returns the DISTINCT set of input_refs
   *  currently in the pipeline for the given worker types (any status).
   *  Used by `dispatchNewInboxItems` to dedupe inbox items against work
   *  already enqueued. This method exists ONLY because the pre-11.0
   *  dispatch read from a filesystem snapshot that became stale when
   *  Brain moved to Supabase (see diagnostic 2026-08-08 · 12-16× duplicate
   *  re-dispatches per inbox item). Walking the ACTIVE store eliminates
   *  the drift. Remove once Phase 11.2 puts inbox + jobs in the same
   *  Postgres · dispatch can then do a native `NOT EXISTS` join. */
  listRecentPipelineInputRefs(worker_types: WorkerType[]): Promise<string[]>;

  // Results
  insertResult(input: Omit<WorkerResult, "id" | "created_at">): Promise<WorkerResult>;

  // Sources
  insertSource(input: Omit<Source, "id" | "created_at">): Promise<Source>;

  // Confidence scores
  insertConfidence(input: Omit<ConfidenceScore, "id" | "created_at">): Promise<ConfidenceScore>;
  listConfidence(record_id: string): Promise<ConfidenceScore[]>;

  // Contradictions
  insertContradiction(input: Omit<Contradiction, "id" | "detected_at">): Promise<Contradiction>;
  listOpenContradictions(): Promise<Contradiction[]>;

  // Deprecations
  insertDeprecation(input: Omit<Deprecation, "id" | "deprecated_at">): Promise<Deprecation>;

  // Feedback (the moat)
  insertFeedback(input: Omit<KnowledgeFeedback, "id" | "created_at" | "applied_to_prompts">): Promise<KnowledgeFeedback>;
  listFeedback(filter?: { record_id?: string; unapplied_only?: boolean; limit?: number }): Promise<KnowledgeFeedback[]>;
  markFeedbackApplied(id: string): Promise<void>;

  // Audit log
  insertAudit(input: Omit<AuditEntry, "id" | "created_at">): Promise<AuditEntry>;
  listAudit(filter?: { limit?: number; since?: string; entity_id?: string }): Promise<AuditEntry[]>;

  // LLM retry queue (Stage 3)
  enqueueLlmRetry(input: Omit<LlmRetryEntry, "id" | "status" | "attempts" | "next_attempt_at" | "last_provider_tried" | "last_error" | "succeeded_provider" | "succeeded_at" | "result_summary" | "created_at" | "updated_at"> & { next_attempt_at?: string }): Promise<LlmRetryEntry>;
  claimNextLlmRetry(worker_id: string, lease_seconds?: number): Promise<LlmRetryEntry | null>;
  markLlmRetrySucceeded(id: string, provider: string, result_summary: Record<string, unknown>): Promise<void>;
  markLlmRetryPending(id: string, next_attempt_at: string, last_error: string, last_provider: string): Promise<void>;
  markLlmRetryExhausted(id: string, last_error: string): Promise<void>;
  listLlmRetries(filter?: { status?: LlmRetryStatus; limit?: number }): Promise<LlmRetryEntry[]>;

  // Cloud worker heartbeats (Phase 5)
  upsertHeartbeat(row: WorkerHeartbeat): Promise<void>;
  listHeartbeats(filter?: { since?: string; limit?: number }): Promise<WorkerHeartbeat[]>;

  // Snapshot for the dashboard
  status(): Promise<BrainStatus>;
}

// The keep-alive of BrainStatus + WorkerPoolHealth as interface-only
// re-exports so tsc doesn't flag `WorkerPoolHealth` as unused inside
// this selector-only shell. Both are surfaced through BrainStore.status().
export type { BrainStatus, WorkerPoolHealth };

// =====================================================================
// Backends
// =====================================================================
//
// Wave 11 · Step 10 · F12 remediation · behavior-preserving extraction.
// Each concrete backend now lives in its own adapter file. storage.ts
// keeps only:
//   · the BrainStore interface (above)
//   · env selectors (isSupabaseConfigured · isPostgresConfigured)
//   · `brainStore()` singleton accessor (below)
//   · `_resetBrainStoreForTests()` (below · contract-tests only)
//
// storage.ts imports NO provider SDK · pg client · fs helper directly.
// If a future edit introduces one, the F12 drift-catcher will fail.

import { FilesystemStore } from "./adapters/filesystem";
import { SupabaseStore } from "./adapters/supabase";
import { PostgresBrainStore } from "./adapters/postgres";

// ── Singleton accessor ───────────────────────────────────────────────

let _store: BrainStore | null = null;

export function brainStore(): BrainStore {
  if (_store) return _store;
  if (isPostgresConfigured()) {
    const primary: BrainStore = new PostgresBrainStore();
    // Wave 7 · reverse-shadow rollback safety net. When
    // NEX_BRAIN_SHADOW_SUPABASE=1 is set alongside
    // NEX_BRAIN_BACKEND=postgres, every write to nex.* is also
    // mirrored to legacy Supabase so a rollback is loss-less.
    // Gate is INTENTIONALLY strict · only fires when the operator
    // has explicitly opted in AND the primary is actually Postgres.
    //
    // F12 invariant · this is the ONLY dual-write path in Brain.
    // Reads never diverge (mirror only receives writes). The mirror
    // failing does not affect the caller. Documented Wave 7 role
    // (F37 · keep). Any additional dual-write path is a doctrine
    // violation and must be caught by the drift-catcher.
    if (
      process.env.NEX_BRAIN_SHADOW_SUPABASE === "1" &&
      isSupabaseConfigured()
    ) {
      // Lazy-require to avoid circular imports at module init.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { MirrorToSupabaseBrainStore } = require("./pg-to-supabase-shadow") as typeof import("./pg-to-supabase-shadow");
      _store = new MirrorToSupabaseBrainStore(primary, new SupabaseStore());
    } else {
      _store = primary;
    }
  } else if (isSupabaseConfigured()) {
    _store = new SupabaseStore();
  } else {
    _store = new FilesystemStore();
  }
  return _store;
}

// Test-only · discards the cached instance so the next brainStore()
// call re-selects based on current env. Used by contract tests.
export function _resetBrainStoreForTests(): void {
  _store = null;
}
