// src/lib/nex/harvest/types.ts
//
// NEX 24/7 World Harvest Engine · Wave H1 · Types
// Founder-authorised programme · 2026-09-22.

export type JobStatus =
  | "queued"          // ready for claim (next_attempt_at ≤ now)
  | "claimed"         // held by a worker · lease valid
  | "processing"      // worker actively running the job
  | "completed"       // terminal · succeeded
  | "failed"          // transient failure · retry pending or exhausted
  | "dead_letter";    // terminal · non-retryable failure

/** Vocabulary of harvest work. Each type maps to a distinct executor in
 *  later waves. Adding a new type is intentional · not silent. */
export type JobType =
  | "source_probe"        // ask a source registry entry for candidates in a (country, term)
  | "candidate_walk"      // walk a discovered business candidate's website
  | "website_walk"        // walk a specific URL (a page inside a website)
  | "entity_resolve"      // resolve a candidate to a canonical entity
  | "email_extract"       // extract emails from a fetched page
  | "evidence_persist";   // persist business_evidence row

export interface HarvestJob {
  readonly job_id: string;
  readonly job_type: JobType | string;   // string allows future job types w/o code change
  readonly programme_id: string | null;
  readonly country_iso: string | null;
  readonly source_id: string | null;
  readonly payload: unknown;
  readonly idempotency_key: string;
  readonly status: JobStatus;
  readonly priority: number;
  readonly attempts: number;
  readonly max_attempts: number;
  readonly next_attempt_at: string;
  readonly lease_owner: string | null;
  readonly lease_acquired_at: string | null;
  readonly lease_expires_at: string | null;
  readonly heartbeat_at: string | null;
  readonly last_error: string | null;
  readonly last_error_at: string | null;
  readonly dead_letter_reason: string | null;
  readonly dead_letter_at: string | null;
  readonly completed_at: string | null;
  readonly parent_job_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface EnqueueJobInput {
  readonly job_type: JobType | string;
  readonly programme_id?: string | null;
  readonly country_iso?: string | null;
  readonly source_id?: string | null;
  readonly payload: unknown;
  readonly idempotency_key: string;
  readonly priority?: number;
  readonly max_attempts?: number;
  readonly next_attempt_at?: string;
  readonly parent_job_id?: string | null;
}

export type EnqueueOutcome =
  | { kind: "enqueued"; job: HarvestJob }
  | { kind: "duplicate"; existing: HarvestJob };

export interface ClaimInput {
  readonly worker_id: string;
  readonly job_types: readonly string[];
  readonly lease_seconds: number;               // e.g. 60
  readonly programme_id?: string;               // optional narrowing
  readonly country_iso?: string;                // optional narrowing
  readonly now?: () => Date;                    // for deterministic tests
}

export interface HeartbeatOutcome {
  readonly kind: "extended" | "lost";
  readonly job_id: string;
  readonly new_lease_expires_at?: string;
  readonly reason?: string;
}

export type CompleteOutcome =
  | { kind: "completed"; job: HarvestJob }
  | { kind: "lease_lost"; reason: string };

export type FailOutcome =
  | { kind: "requeued"; job: HarvestJob; next_attempt_at: string }
  | { kind: "dead_letter"; job: HarvestJob; reason: string }
  | { kind: "lease_lost"; reason: string };

export interface WorkerHeartbeat {
  readonly worker_id: string;
  readonly host_identifier: string | null;
  readonly job_type_scope: readonly string[];
  readonly status: "alive" | "expired" | "drained";
  readonly started_at: string;
  readonly last_heartbeat_at: string;
  readonly heartbeat_interval_seconds: number;
  readonly expected_expiry_at: string;
  readonly jobs_claimed: number;
  readonly jobs_completed: number;
  readonly jobs_failed: number;
}

export interface HarvestYield {
  readonly yield_id: string;
  readonly job_id: string;
  readonly worker_id: string | null;
  readonly yield_kind: string;
  readonly yield_count: number;
  readonly yield_meta: Readonly<Record<string, unknown>>;
  readonly yielded_at: string;
}

export interface RecordYieldInput {
  readonly job_id: string;
  readonly worker_id?: string;
  readonly yield_kind: string;
  readonly yield_count?: number;
  readonly yield_meta?: Record<string, unknown>;
}

export interface ReaperOutcome {
  readonly expired_leases_released: number;
  readonly moved_to_dead_letter: number;
  readonly workers_marked_expired: number;
  readonly ran_at: string;
}

// ─── Structural boundary markers ───────────────────────────────────
export const _HARVEST_POSTGRES_IS_AUTHORITY =
  "no_in_memory_queue_all_state_lives_in_nex_harvest_job_table";
export const _HARVEST_NEVER_DELETES_JOBS =
  "terminal_states_are_completed_or_dead_letter_neither_removes_the_row";
export const _HARVEST_LEASE_OWNERSHIP_REQUIRED =
  "heartbeat_complete_fail_all_reject_wrong_lease_owner_by_row_lock";
export const _HARVEST_IDEMPOTENCY_ENFORCED_AT_DB =
  "unique_index_on_job_type_idempotency_key_prevents_duplicate_persistence";
