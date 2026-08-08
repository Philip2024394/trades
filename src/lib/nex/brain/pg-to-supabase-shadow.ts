// NEX Brain · pg → Supabase reverse shadow · Wave 7
//
// PURPOSE
// Rollback safety net. When NEX_BRAIN_BACKEND=postgres becomes
// authoritative in production (Wave 5 flip), every write to nex.*
// on our Postgres is also mirrored to the legacy Supabase brain
// tables so a rollback is loss-less.
//
// This module is INACTIVE by default. Activation requires ALL of:
//   · NEX_BRAIN_BACKEND=postgres (production has flipped to pg)
//   · NEX_BRAIN_SHADOW_SUPABASE=1 (operator has opted in)
//   · Supabase URL + service_role key present
//
// Otherwise the wrap is transparent · every call goes straight to the
// inner PostgresBrainStore.
//
// DESIGN
// Decorator over the BrainStore interface. Constructor takes the
// authoritative PostgresBrainStore (inner) + a SupabaseStore (mirror).
// Every mutation method:
//   1. Awaits inner.method(input) · returns immediately if it throws
//   2. Fire-and-forget calls mirror.method(input) · errors caught +
//      logged behind NEX_BRAIN_SHADOW_SUPABASE_DEBUG=1
//   3. Returns inner's result (mirror timing never affects caller)
//
// Reads pass straight through to the inner (primary) store · we never
// re-mirror reads.
//
// LIMITATIONS
// · insertRecordIdempotent: mirror insert may create a row that
//   already exists on Supabase (if the row was on Supabase pre-flip)
//   OR the mirror insert may fail because the row is on Supabase but
//   NOT on pg (rare). Both cases are logged · never fatal.
// · Timing skew: mirror writes are fire-and-forget · a rollback
//   window within milliseconds of a write might lose that write.
//   For a safe rollback, allow N minutes of settle time before
//   flipping back so any in-flight mirror writes complete.
// · If the mirror write throws for any reason (Supabase down · schema
//   drift · RLS · rate limit), it is silently logged. Reconciliation
//   between pg and Supabase after activation is done by
//   scripts/brain-parity-report.mjs which flags drift.

import type {
  AuditEntry, BrainStatus, ConfidenceScore, Contradiction, Deprecation,
  GraphEdge, JobStatus, KnowledgeFeedback, KnowledgeRecord, LlmRetryEntry,
  LlmRetryStatus, RecordVersion, Source, WorkerHeartbeat, WorkerJob,
  WorkerResult, WorkerType,
} from "./types";
import type { BrainStore } from "./storage";

export function isReverseShadowEnabled(): boolean {
  return process.env.NEX_BRAIN_SHADOW_SUPABASE === "1"
      && process.env.NEX_BRAIN_BACKEND === "postgres";
}

function debug(msg: string, err?: unknown): void {
  if (process.env.NEX_BRAIN_SHADOW_SUPABASE_DEBUG === "1") {
    console.warn(`[pg→supa-shadow] ${msg}`, err instanceof Error ? err.message : err ?? "");
  }
}

// Fire-and-forget mirror helper. Never throws to the outer scope ·
// never affects the primary write's return value.
function mirror<T>(label: string, promise: Promise<T>): void {
  promise.catch((err) => debug(`${label} failed`, err));
}

/**
 * Decorator that wraps a primary BrainStore (PostgresBrainStore in
 * the target architecture) and mirrors every mutation to a secondary
 * BrainStore (SupabaseStore during the transition window).
 *
 * Reads go to the primary only.
 * Mutations go to the primary first (awaited), then fire-and-forget
 * to the secondary.
 *
 * The decorator is idempotent: instantiating it around a store that
 * already has a mirror will just add another mirror layer (not
 * recommended · caller should compose at most once).
 */
export class MirrorToSupabaseBrainStore implements BrainStore {
  constructor(
    private readonly primary: BrainStore,
    private readonly secondary: BrainStore,
  ) {}

  // ── Records ────────────────────────────────────────────────────────
  async insertRecord(input: Omit<KnowledgeRecord, "id" | "created_at">): Promise<KnowledgeRecord> {
    const r = await this.primary.insertRecord(input);
    mirror("insertRecord", this.secondary.insertRecord(input));
    return r;
  }
  async insertRecordIdempotent(input: Omit<KnowledgeRecord, "id" | "created_at">): Promise<{ record: KnowledgeRecord; created: boolean }> {
    const r = await this.primary.insertRecordIdempotent(input);
    // Mirror only when primary actually created the row · avoids
    // spurious duplicates on the secondary. Secondary uses its own
    // ON CONFLICT DO NOTHING so this is best-effort anyway.
    if (r.created) mirror("insertRecordIdempotent", this.secondary.insertRecordIdempotent(input).then(() => undefined));
    return r;
  }
  async getRecord(record_id: string): Promise<KnowledgeRecord | null> {
    return this.primary.getRecord(record_id);
  }
  async listRecords(filter?: { status?: KnowledgeRecord["status"]; limit?: number }): Promise<KnowledgeRecord[]> {
    return this.primary.listRecords(filter);
  }
  async updateRecordStatus(record_id: string, status: KnowledgeRecord["status"], reviewer?: string): Promise<KnowledgeRecord | null> {
    const r = await this.primary.updateRecordStatus(record_id, status, reviewer);
    mirror("updateRecordStatus", this.secondary.updateRecordStatus(record_id, status, reviewer));
    return r;
  }

  // ── Versions ───────────────────────────────────────────────────────
  async insertVersion(input: Omit<RecordVersion, "id" | "changed_at">): Promise<RecordVersion> {
    const r = await this.primary.insertVersion(input);
    mirror("insertVersion", this.secondary.insertVersion(input));
    return r;
  }

  // ── Edges ──────────────────────────────────────────────────────────
  async insertEdge(input: Omit<GraphEdge, "id" | "created_at">): Promise<GraphEdge> {
    const r = await this.primary.insertEdge(input);
    mirror("insertEdge", this.secondary.insertEdge(input));
    return r;
  }
  async listEdges(from_record_id?: string): Promise<GraphEdge[]> {
    return this.primary.listEdges(from_record_id);
  }

  // ── Jobs ───────────────────────────────────────────────────────────
  async enqueueJob(input: Omit<WorkerJob, "id" | "status" | "attempts" | "created_at" | "updated_at">): Promise<WorkerJob> {
    const r = await this.primary.enqueueJob(input);
    mirror("enqueueJob", this.secondary.enqueueJob(input));
    return r;
  }
  async claimNextJob(worker_type: WorkerType, worker_id: string, lease_seconds?: number): Promise<WorkerJob | null> {
    // Claim goes to primary only · claiming on both would double-lease
    return this.primary.claimNextJob(worker_type, worker_id, lease_seconds);
  }
  async completeJob(job_id: string, result_id: string): Promise<void> {
    await this.primary.completeJob(job_id, result_id);
    mirror("completeJob", this.secondary.completeJob(job_id, result_id));
  }
  async failJob(job_id: string, error: string): Promise<void> {
    await this.primary.failJob(job_id, error);
    mirror("failJob", this.secondary.failJob(job_id, error));
  }
  async countJobs(worker_type: WorkerType, status: JobStatus): Promise<number> {
    return this.primary.countJobs(worker_type, status);
  }
  async listRecentPipelineInputRefs(worker_types: WorkerType[]): Promise<string[]> {
    return this.primary.listRecentPipelineInputRefs(worker_types);
  }

  // ── Results ────────────────────────────────────────────────────────
  async insertResult(input: Omit<WorkerResult, "id" | "created_at">): Promise<WorkerResult> {
    const r = await this.primary.insertResult(input);
    mirror("insertResult", this.secondary.insertResult(input));
    return r;
  }

  // ── Sources ────────────────────────────────────────────────────────
  async insertSource(input: Omit<Source, "id" | "created_at">): Promise<Source> {
    const r = await this.primary.insertSource(input);
    mirror("insertSource", this.secondary.insertSource(input));
    return r;
  }

  // ── Confidence scores ──────────────────────────────────────────────
  async insertConfidence(input: Omit<ConfidenceScore, "id" | "created_at">): Promise<ConfidenceScore> {
    const r = await this.primary.insertConfidence(input);
    mirror("insertConfidence", this.secondary.insertConfidence(input));
    return r;
  }
  async listConfidence(record_id: string): Promise<ConfidenceScore[]> {
    return this.primary.listConfidence(record_id);
  }

  // ── Contradictions ─────────────────────────────────────────────────
  async insertContradiction(input: Omit<Contradiction, "id" | "detected_at">): Promise<Contradiction> {
    const r = await this.primary.insertContradiction(input);
    mirror("insertContradiction", this.secondary.insertContradiction(input));
    return r;
  }
  async listOpenContradictions(): Promise<Contradiction[]> {
    return this.primary.listOpenContradictions();
  }

  // ── Deprecations ───────────────────────────────────────────────────
  async insertDeprecation(input: Omit<Deprecation, "id" | "deprecated_at">): Promise<Deprecation> {
    const r = await this.primary.insertDeprecation(input);
    mirror("insertDeprecation", this.secondary.insertDeprecation(input));
    return r;
  }

  // ── Feedback ───────────────────────────────────────────────────────
  async insertFeedback(input: Omit<KnowledgeFeedback, "id" | "created_at" | "applied_to_prompts">): Promise<KnowledgeFeedback> {
    const r = await this.primary.insertFeedback(input);
    mirror("insertFeedback", this.secondary.insertFeedback(input));
    return r;
  }
  async listFeedback(filter?: { record_id?: string; unapplied_only?: boolean; limit?: number }): Promise<KnowledgeFeedback[]> {
    return this.primary.listFeedback(filter);
  }
  async markFeedbackApplied(id: string): Promise<void> {
    await this.primary.markFeedbackApplied(id);
    mirror("markFeedbackApplied", this.secondary.markFeedbackApplied(id));
  }

  // ── Audit log ──────────────────────────────────────────────────────
  async insertAudit(input: Omit<AuditEntry, "id" | "created_at">): Promise<AuditEntry> {
    const r = await this.primary.insertAudit(input);
    mirror("insertAudit", this.secondary.insertAudit(input));
    return r;
  }
  async listAudit(filter?: { limit?: number; since?: string; entity_id?: string }): Promise<AuditEntry[]> {
    return this.primary.listAudit(filter);
  }

  // ── LLM retry queue ────────────────────────────────────────────────
  async enqueueLlmRetry(input: Omit<LlmRetryEntry, "id" | "status" | "attempts" | "next_attempt_at" | "last_provider_tried" | "last_error" | "succeeded_provider" | "succeeded_at" | "result_summary" | "created_at" | "updated_at"> & { next_attempt_at?: string }): Promise<LlmRetryEntry> {
    const r = await this.primary.enqueueLlmRetry(input);
    mirror("enqueueLlmRetry", this.secondary.enqueueLlmRetry(input));
    return r;
  }
  async claimNextLlmRetry(worker_id: string, lease_seconds?: number): Promise<LlmRetryEntry | null> {
    return this.primary.claimNextLlmRetry(worker_id, lease_seconds);
  }
  async markLlmRetrySucceeded(id: string, provider: string, result_summary: Record<string, unknown>): Promise<void> {
    await this.primary.markLlmRetrySucceeded(id, provider, result_summary);
    mirror("markLlmRetrySucceeded", this.secondary.markLlmRetrySucceeded(id, provider, result_summary));
  }
  async markLlmRetryPending(id: string, next_attempt_at: string, last_error: string, last_provider: string): Promise<void> {
    await this.primary.markLlmRetryPending(id, next_attempt_at, last_error, last_provider);
    mirror("markLlmRetryPending", this.secondary.markLlmRetryPending(id, next_attempt_at, last_error, last_provider));
  }
  async markLlmRetryExhausted(id: string, last_error: string): Promise<void> {
    await this.primary.markLlmRetryExhausted(id, last_error);
    mirror("markLlmRetryExhausted", this.secondary.markLlmRetryExhausted(id, last_error));
  }
  async listLlmRetries(filter?: { status?: LlmRetryStatus; limit?: number }): Promise<LlmRetryEntry[]> {
    return this.primary.listLlmRetries(filter);
  }

  // ── Heartbeats ─────────────────────────────────────────────────────
  async upsertHeartbeat(row: WorkerHeartbeat): Promise<void> {
    await this.primary.upsertHeartbeat(row);
    mirror("upsertHeartbeat", this.secondary.upsertHeartbeat(row));
  }
  async listHeartbeats(filter?: { since?: string; limit?: number }): Promise<WorkerHeartbeat[]> {
    return this.primary.listHeartbeats(filter);
  }

  // ── Status ─────────────────────────────────────────────────────────
  async status(): Promise<BrainStatus> {
    return this.primary.status();
  }
}
