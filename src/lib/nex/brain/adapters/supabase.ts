// src/lib/nex/brain/adapters/supabase.ts
//
// Wave 11 · Step 10 · F12 remediation · behavior-preserving extraction.
//
// This file was carved verbatim from src/lib/nex/brain/storage.ts
// (SupabaseStore class body · pre-extraction lines 233-950). Every
// Supabase client call, every table name, every method signature is
// byte-identical to the pre-Step-10 implementation. If a future edit
// changes an RPC / column / return shape, that IS a behavior change ·
// not part of F12.
//
// The class is exported so storage.ts can construct it inside
// brainStore() when NEX_BRAIN_BACKEND=supabase is active. External
// callers continue to consume the BrainStore interface via `brainStore()`
// without needing to know which concrete class backs it.
//
// F12 doctrine enforced by this extraction: `@supabase/supabase-js`
// is imported ONLY by this file among brain-adapters. The remaining
// two brain-module supabase-js importers (audit-log.ts · warehouse.ts)
// are surfaced as F12.b · out of Step 10 scope · tracked separately.
//
// F34.b · SupabaseStore does not need withBrainRole (Supabase client
// runs against the legacy service role · no per-transaction role
// switch). The F34 shared helper is a Postgres-adapter concern.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  AuditEntry,
  BrainStatus,
  ConfidenceScore,
  Contradiction,
  Deprecation,
  GraphEdge,
  JobStatus,
  KnowledgeFeedback,
  KnowledgeJobTransitionAudit,
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
} from "../types";
import type { BrainStore } from "../storage";
import {
  nowIso,
  resolveSupabaseUrl,
  resolveSupabaseServiceRoleKey,
} from "../storage";

export class SupabaseStore implements BrainStore {
  private readonly client: SupabaseClient;

  constructor() {
    const url = resolveSupabaseUrl();
    const key = resolveSupabaseServiceRoleKey();
    if (!url || !key) {
      throw new Error(
        "[nex-brain.storage] SupabaseStore instantiated without credentials. " +
          "Set NEX_SUPABASE_URL (or NEXT_PUBLIC_NEX_SUPABASE_URL / SUPABASE_URL) " +
          "and NEX_SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY)."
      );
    }
    this.client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: "public" },
    });
  }

  // ── Records ────────────────────────────────────────────────────────

  async insertRecord(input: Omit<KnowledgeRecord, "id" | "created_at">): Promise<KnowledgeRecord> {
    const { data, error } = await this.client
      .from("knowledge_records")
      .insert(input as never)
      .select()
      .single();
    if (error) throw new Error(`insertRecord failed: ${error.message}`);
    return data as KnowledgeRecord;
  }

  async insertRecordIdempotent(
    input: Omit<KnowledgeRecord, "id" | "created_at">,
  ): Promise<{ record: KnowledgeRecord; created: boolean }> {
    // Race-safe · uses INSERT ... ON CONFLICT DO NOTHING via Supabase's
    // upsert with ignoreDuplicates=true. When the row already exists the
    // upsert returns zero rows without an error; we then fetch the
    // existing row so callers still receive a KnowledgeRecord.
    const { data: inserted, error: upsertErr } = await this.client
      .from("knowledge_records")
      .upsert(input as never, { onConflict: "record_id", ignoreDuplicates: true })
      .select();
    if (upsertErr) throw new Error(`insertRecordIdempotent failed: ${upsertErr.message}`);
    if (inserted && inserted.length > 0) {
      return { record: inserted[0] as KnowledgeRecord, created: true };
    }
    // Duplicate · fetch the existing row and return it with created=false.
    const { data: existing, error: lookupErr } = await this.client
      .from("knowledge_records")
      .select("*")
      .eq("record_id", input.record_id)
      .maybeSingle();
    if (lookupErr) throw new Error(`insertRecordIdempotent lookup failed: ${lookupErr.message}`);
    if (!existing) {
      throw new Error(
        `insertRecordIdempotent · upsert ignored but no existing row found for record_id=${input.record_id}`,
      );
    }
    return { record: existing as KnowledgeRecord, created: false };
  }

  async getRecord(record_id: string): Promise<KnowledgeRecord | null> {
    const { data, error } = await this.client
      .from("knowledge_records")
      .select("*")
      .eq("record_id", record_id)
      .maybeSingle();
    if (error) throw new Error(`getRecord failed: ${error.message}`);
    return (data as KnowledgeRecord | null) ?? null;
  }

  async listRecords(filter?: { status?: KnowledgeRecord["status"]; limit?: number }): Promise<KnowledgeRecord[]> {
    let query = this.client
      .from("knowledge_records")
      .select("*")
      .order("created_at", { ascending: false });
    if (filter?.status) query = query.eq("status", filter.status);
    query = query.limit(filter?.limit ?? 100);
    const { data, error } = await query;
    if (error) throw new Error(`listRecords failed: ${error.message}`);
    return (data as KnowledgeRecord[]) ?? [];
  }

  async updateRecordStatus(record_id: string, status: KnowledgeRecord["status"], reviewer?: string): Promise<KnowledgeRecord | null> {
    const patch: Record<string, unknown> = {
      status,
      last_reviewed_at: nowIso(),
    };
    if (reviewer) patch.reviewed_by = reviewer;
    if (status === "DEPRECATED" || status === "SUPERSEDED") patch.deprecated_at = nowIso();
    const { data, error } = await this.client
      .from("knowledge_records")
      .update(patch)
      .eq("record_id", record_id)
      .select()
      .maybeSingle();
    if (error) throw new Error(`updateRecordStatus failed: ${error.message}`);
    return (data as KnowledgeRecord | null) ?? null;
  }

  // ── Versions ───────────────────────────────────────────────────────

  async insertVersion(input: Omit<RecordVersion, "id" | "changed_at">): Promise<RecordVersion> {
    const { data, error } = await this.client
      .from("record_versions")
      .insert(input as never)
      .select()
      .single();
    if (error) throw new Error(`insertVersion failed: ${error.message}`);
    return data as RecordVersion;
  }

  // ── Edges ──────────────────────────────────────────────────────────

  async insertEdge(input: Omit<GraphEdge, "id" | "created_at">): Promise<GraphEdge> {
    // UNIQUE(from_record_id, to_record_id, edge_type) — upsert on conflict.
    const { data, error } = await this.client
      .from("graph_edges")
      .upsert(input as never, {
        onConflict: "from_record_id,to_record_id,edge_type",
        ignoreDuplicates: false,
      })
      .select()
      .single();
    if (error) throw new Error(`insertEdge failed: ${error.message}`);
    return data as GraphEdge;
  }

  async listEdges(from_record_id?: string): Promise<GraphEdge[]> {
    let query = this.client.from("graph_edges").select("*");
    if (from_record_id) query = query.eq("from_record_id", from_record_id);
    const { data, error } = await query;
    if (error) throw new Error(`listEdges failed: ${error.message}`);
    return (data as GraphEdge[]) ?? [];
  }

  // ── Jobs (the queue) ───────────────────────────────────────────────

  async enqueueJob(input: Omit<WorkerJob, "id" | "status" | "attempts" | "created_at" | "updated_at">): Promise<WorkerJob> {
    const row = {
      ...input,
      status: "waiting",
      attempts: 0,
    };
    const { data, error } = await this.client
      .from("worker_jobs")
      .insert(row as never)
      .select()
      .single();
    if (error) throw new Error(`enqueueJob failed: ${error.message}`);
    return data as WorkerJob;
  }

  async claimNextJob(worker_type: WorkerType, worker_id: string, lease_seconds = 60): Promise<WorkerJob | null> {
    // Prefer the SKIP LOCKED RPC from the migration for true safe
    // concurrency. Fall back to a best-effort update if the RPC
    // is missing (e.g. schema not fully migrated yet).
    // Note on empty-queue behaviour: PostgREST returns an all-null
    // tuple ({ id: null, worker_type: null, ... }) when a
    // RETURNS <table> function matches no rows, NOT a JSON null.
    // Treat empty id as "no job available".
    const { data, error } = await this.client.rpc("claim_next_job", {
      p_worker_type: worker_type,
      p_worker_id: worker_id,
      p_lease_seconds: lease_seconds,
    });
    if (error) {
      // If the function doesn't exist, do a fallback single-row claim.
      // Not truly SKIP LOCKED but adequate for low-concurrency dev.
      if (/function .*claim_next_job/i.test(error.message)) {
        const { data: candidate } = await this.client
          .from("worker_jobs")
          .select("*")
          .eq("worker_type", worker_type)
          .eq("status", "waiting")
          .order("priority", { ascending: true })
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (!candidate) return null;
        const now = nowIso();
        const leaseIso = new Date(Date.now() + lease_seconds * 1000).toISOString();
        const { data: updated, error: updErr } = await this.client
          .from("worker_jobs")
          .update({
            status: "assigned",
            assigned_worker_id: worker_id,
            assigned_at: now,
            lease_expires_at: leaseIso,
            attempts: ((candidate as WorkerJob).attempts ?? 0) + 1,
            updated_at: now,
          })
          .eq("id", (candidate as WorkerJob).id)
          .eq("status", "waiting") // optimistic concurrency
          .select()
          .maybeSingle();
        if (updErr) throw new Error(`claimNextJob fallback update failed: ${updErr.message}`);
        return (updated as WorkerJob | null) ?? null;
      }
      throw new Error(`claimNextJob failed: ${error.message}`);
    }
    // PostgREST returns { id: null, ... } for empty match — treat as null.
    if (!data || (data as { id?: string | null }).id == null) return null;
    return data as WorkerJob;
  }

  async completeJob(job_id: string, result_id: string): Promise<void> {
    const now = nowIso();
    const { error } = await this.client
      .from("worker_jobs")
      .update({ status: "completed", result_id, updated_at: now, completed_at: now })
      .eq("id", job_id);
    if (error) throw new Error(`completeJob failed: ${error.message}`);
  }

  async failJob(job_id: string, error_msg: string): Promise<void> {
    const now = nowIso();
    const { error } = await this.client
      .from("worker_jobs")
      .update({ status: "failed", last_error: error_msg.slice(0, 500), updated_at: now, completed_at: now })
      .eq("id", job_id);
    if (error) throw new Error(`failJob failed: ${error.message}`);
  }

  async countJobs(worker_type: WorkerType, status: JobStatus): Promise<number> {
    const { count, error } = await this.client
      .from("worker_jobs")
      .select("id", { count: "exact", head: true })
      .eq("worker_type", worker_type)
      .eq("status", status);
    if (error) throw new Error(`countJobs failed: ${error.message}`);
    return count ?? 0;
  }

  // Phase 11.0 · TRANSITIONAL · see BrainStore.listRecentPipelineInputRefs.
  // Pages through PostgREST's 1000-row cap · dedup by JS Set so duplicate
  // input_refs across worker types collapse. Handles pipelines up to 25k
  // active jobs without truncating (well beyond current scale).
  async listRecentPipelineInputRefs(worker_types: WorkerType[]): Promise<string[]> {
    if (worker_types.length === 0) return [];
    const set = new Set<string>();
    const pageSize = 1000;
    const maxPages = 25;
    for (let page = 0; page < maxPages; page++) {
      const from = page * pageSize;
      const to   = from + pageSize - 1;
      const { data, error } = await this.client
        .from("worker_jobs")
        .select("input_ref")
        .in("worker_type", worker_types as unknown as string[])
        .range(from, to);
      if (error) throw new Error(`listRecentPipelineInputRefs failed: ${error.message}`);
      const rows = (data ?? []) as Array<{ input_ref: string | null }>;
      if (rows.length === 0) break;
      for (const r of rows) if (r.input_ref) set.add(r.input_ref);
      if (rows.length < pageSize) break;
    }
    return Array.from(set);
  }

  // Wave 11 · Phase 5 · W-C-COMPANION storage-contract extension.
  // Read paths for the KnowledgeJob supervisor · match filesystem +
  // postgres shapes 1:1. Batch methods respect PostgREST's 1000-row
  // page cap by paginating up to opts.limit (default 500).
  async getWorkerJob(job_id: string): Promise<WorkerJob | null> {
    if (!job_id) return null;
    const { data, error } = await this.client
      .from("worker_jobs")
      .select("*")
      .eq("id", job_id)
      .maybeSingle();
    if (error) {
      // PostgREST returns 22P02 for invalid uuid input · treat as null.
      if ((error as { code?: string }).code === "22P02") return null;
      throw new Error(`getWorkerJob failed: ${error.message}`);
    }
    return (data as WorkerJob | null) ?? null;
  }
  async listWorkerJobsByInputRef(
    input_refs: string[],
    opts?: { limit?: number },
  ): Promise<WorkerJob[]> {
    if (!input_refs || input_refs.length === 0) return [];
    const limit = opts?.limit ?? 500;
    const pageSize = Math.min(1000, limit);
    const out: WorkerJob[] = [];
    let offset = 0;
    while (out.length < limit) {
      const from = offset;
      const to   = offset + pageSize - 1;
      const { data, error } = await this.client
        .from("worker_jobs")
        .select("*")
        .in("input_ref", input_refs)
        .order("created_at", { ascending: true })
        .range(from, to);
      if (error) throw new Error(`listWorkerJobsByInputRef failed: ${error.message}`);
      const rows = (data ?? []) as WorkerJob[];
      out.push(...rows);
      if (rows.length < pageSize) break;
      offset += pageSize;
    }
    return out.slice(0, limit);
  }
  async findWorkerJobsByKnowledgeJobId(kjid: string): Promise<WorkerJob[]> {
    if (!kjid) return [];
    // JSONB @> query · needs a supporting expression index on
    // (input_payload->>'knowledge_job_id') to run quickly at scale
    // (see db/migrations/005_worker_jobs_kjid_expression_index.sql).
    const { data, error } = await this.client
      .from("worker_jobs")
      .select("*")
      .contains("input_payload", { knowledge_job_id: kjid })
      .order("created_at", { ascending: true });
    if (error) throw new Error(`findWorkerJobsByKnowledgeJobId failed: ${error.message}`);
    return (data as WorkerJob[]) ?? [];
  }
  async listWorkerResultsByIds(
    result_ids: string[],
    opts?: { limit?: number },
  ): Promise<WorkerResult[]> {
    if (!result_ids || result_ids.length === 0) return [];
    const limit = opts?.limit ?? 500;
    const pageSize = Math.min(1000, limit);
    const out: WorkerResult[] = [];
    let offset = 0;
    while (out.length < limit) {
      const from = offset;
      const to   = offset + pageSize - 1;
      const { data, error } = await this.client
        .from("worker_results")
        .select("*")
        .in("id", result_ids)
        .range(from, to);
      if (error) {
        if ((error as { code?: string }).code === "22P02") return [];
        throw new Error(`listWorkerResultsByIds failed: ${error.message}`);
      }
      const rows = (data ?? []) as WorkerResult[];
      out.push(...rows);
      if (rows.length < pageSize) break;
      offset += pageSize;
    }
    return out.slice(0, limit);
  }
  async writeKnowledgeJobTransitionAudit(
    input: KnowledgeJobTransitionAudit,
  ): Promise<void> {
    const { knowledge_job_id, from_status, to_status, actor, ...rest } = input;
    const row = {
      entity_type: "knowledge_jobs",
      entity_id: knowledge_job_id,
      action: to_status,
      actor,
      before_state: { status: from_status },
      after_state:  { status: to_status },
      notes: JSON.stringify(rest),
    };
    const { error } = await this.client
      .from("audit_log")
      .insert(row as never);
    if (error) throw new Error(`writeKnowledgeJobTransitionAudit failed: ${error.message}`);
  }

  // ── Results ────────────────────────────────────────────────────────

  async insertResult(input: Omit<WorkerResult, "id" | "created_at">): Promise<WorkerResult> {
    const { data, error } = await this.client
      .from("worker_results")
      .insert(input as never)
      .select()
      .single();
    if (error) throw new Error(`insertResult failed: ${error.message}`);
    return data as WorkerResult;
  }

  // ── Sources ────────────────────────────────────────────────────────

  async insertSource(input: Omit<Source, "id" | "created_at">): Promise<Source> {
    const { data, error } = await this.client
      .from("sources")
      .insert(input as never)
      .select()
      .single();
    if (error) throw new Error(`insertSource failed: ${error.message}`);
    return data as Source;
  }

  // ── Confidence ─────────────────────────────────────────────────────

  async insertConfidence(input: Omit<ConfidenceScore, "id" | "created_at">): Promise<ConfidenceScore> {
    // UNIQUE(record_id, claim_key) — upsert on conflict.
    const { data, error } = await this.client
      .from("confidence_scores")
      .upsert(input as never, {
        onConflict: "record_id,claim_key",
        ignoreDuplicates: false,
      })
      .select()
      .single();
    if (error) throw new Error(`insertConfidence failed: ${error.message}`);
    return data as ConfidenceScore;
  }

  async listConfidence(record_id: string): Promise<ConfidenceScore[]> {
    const { data, error } = await this.client
      .from("confidence_scores")
      .select("*")
      .eq("record_id", record_id);
    if (error) throw new Error(`listConfidence failed: ${error.message}`);
    return (data as ConfidenceScore[]) ?? [];
  }

  // ── Contradictions ─────────────────────────────────────────────────

  async insertContradiction(input: Omit<Contradiction, "id" | "detected_at">): Promise<Contradiction> {
    const { data, error } = await this.client
      .from("contradictions")
      .insert(input as never)
      .select()
      .single();
    if (error) throw new Error(`insertContradiction failed: ${error.message}`);
    return data as Contradiction;
  }

  async listOpenContradictions(): Promise<Contradiction[]> {
    const { data, error } = await this.client
      .from("contradictions")
      .select("*")
      .eq("status", "open")
      .order("detected_at", { ascending: false });
    if (error) throw new Error(`listOpenContradictions failed: ${error.message}`);
    return (data as Contradiction[]) ?? [];
  }

  // ── Deprecations ───────────────────────────────────────────────────

  async insertDeprecation(input: Omit<Deprecation, "id" | "deprecated_at">): Promise<Deprecation> {
    const { data, error } = await this.client
      .from("deprecations")
      .insert(input as never)
      .select()
      .single();
    if (error) throw new Error(`insertDeprecation failed: ${error.message}`);
    return data as Deprecation;
  }

  // ── Feedback (the moat) ────────────────────────────────────────────

  async insertFeedback(
    input: Omit<KnowledgeFeedback, "id" | "created_at" | "applied_to_prompts">
  ): Promise<KnowledgeFeedback> {
    const row = { ...input, applied_to_prompts: false };
    const { data, error } = await this.client
      .from("knowledge_feedback")
      .insert(row as never)
      .select()
      .single();
    if (error) throw new Error(`insertFeedback failed: ${error.message}`);
    return data as KnowledgeFeedback;
  }

  async listFeedback(filter?: { record_id?: string; unapplied_only?: boolean; limit?: number }): Promise<KnowledgeFeedback[]> {
    let query = this.client
      .from("knowledge_feedback")
      .select("*")
      .order("created_at", { ascending: false });
    if (filter?.record_id) query = query.eq("record_id", filter.record_id);
    if (filter?.unapplied_only) query = query.eq("applied_to_prompts", false);
    query = query.limit(filter?.limit ?? 100);
    const { data, error } = await query;
    if (error) throw new Error(`listFeedback failed: ${error.message}`);
    return (data as KnowledgeFeedback[]) ?? [];
  }

  async markFeedbackApplied(id: string): Promise<void> {
    const { error } = await this.client
      .from("knowledge_feedback")
      .update({ applied_to_prompts: true, applied_at: nowIso() })
      .eq("id", id);
    if (error) throw new Error(`markFeedbackApplied failed: ${error.message}`);
  }

  // ── Audit log ──────────────────────────────────────────────────────

  async insertAudit(input: Omit<AuditEntry, "id" | "created_at">): Promise<AuditEntry> {
    const { data, error } = await this.client
      .from("audit_log")
      .insert(input as never)
      .select()
      .single();
    if (error) throw new Error(`insertAudit failed: ${error.message}`);
    return data as AuditEntry;
  }

  async listAudit(filter?: { limit?: number; since?: string; entity_id?: string }): Promise<AuditEntry[]> {
    let query = this.client
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false });
    if (filter?.entity_id) query = query.eq("entity_id", filter.entity_id);
    if (filter?.since) query = query.gt("created_at", filter.since);
    query = query.limit(filter?.limit ?? 50);
    const { data, error } = await query;
    if (error) throw new Error(`listAudit failed: ${error.message}`);
    return (data as AuditEntry[]) ?? [];
  }

  // ── LLM retry queue (Stage 3) ──────────────────────────────────────

  async enqueueLlmRetry(input: Omit<LlmRetryEntry, "id" | "status" | "attempts" | "next_attempt_at" | "last_provider_tried" | "last_error" | "succeeded_provider" | "succeeded_at" | "result_summary" | "created_at" | "updated_at"> & { next_attempt_at?: string }): Promise<LlmRetryEntry> {
    const row = {
      ...input,
      status: "pending",
      attempts: 0,
      next_attempt_at: input.next_attempt_at ?? nowIso(),
    };
    const { data, error } = await this.client
      .from("llm_retry_queue")
      .insert(row as never)
      .select()
      .single();
    if (error) throw new Error(`enqueueLlmRetry failed: ${error.message}`);
    return data as LlmRetryEntry;
  }

  async claimNextLlmRetry(worker_id: string, lease_seconds = 60): Promise<LlmRetryEntry | null> {
    const { data, error } = await this.client.rpc("claim_next_llm_retry", {
      p_worker_id: worker_id,
      p_lease_seconds: lease_seconds,
    });
    if (error) {
      if (/function .*claim_next_llm_retry/i.test(error.message)) {
        // Fallback if migration 002 hasn't been applied yet
        return null;
      }
      throw new Error(`claimNextLlmRetry failed: ${error.message}`);
    }
    // Empty-match returns all-null tuple, not JSON null. Guard on id.
    if (!data || (data as { id?: string | null }).id == null) return null;
    return data as LlmRetryEntry;
  }

  async markLlmRetrySucceeded(id: string, provider: string, result_summary: Record<string, unknown>): Promise<void> {
    const now = nowIso();
    const { error } = await this.client
      .from("llm_retry_queue")
      .update({
        status: "succeeded",
        succeeded_provider: provider,
        succeeded_at: now,
        result_summary,
        updated_at: now,
      })
      .eq("id", id);
    if (error) throw new Error(`markLlmRetrySucceeded failed: ${error.message}`);
  }

  async markLlmRetryPending(id: string, next_attempt_at: string, last_error: string, last_provider: string): Promise<void> {
    const { error } = await this.client
      .from("llm_retry_queue")
      .update({
        status: "pending",
        next_attempt_at,
        last_error: last_error.slice(0, 500),
        last_provider_tried: last_provider,
        updated_at: nowIso(),
      })
      .eq("id", id);
    if (error) throw new Error(`markLlmRetryPending failed: ${error.message}`);
  }

  async markLlmRetryExhausted(id: string, last_error: string): Promise<void> {
    const { error } = await this.client
      .from("llm_retry_queue")
      .update({
        status: "exhausted",
        last_error: last_error.slice(0, 500),
        updated_at: nowIso(),
      })
      .eq("id", id);
    if (error) throw new Error(`markLlmRetryExhausted failed: ${error.message}`);
  }

  async listLlmRetries(filter?: { status?: LlmRetryStatus; limit?: number }): Promise<LlmRetryEntry[]> {
    let query = this.client
      .from("llm_retry_queue")
      .select("*")
      .order("created_at", { ascending: false });
    if (filter?.status) query = query.eq("status", filter.status);
    query = query.limit(filter?.limit ?? 100);
    const { data, error } = await query;
    if (error) throw new Error(`listLlmRetries failed: ${error.message}`);
    return (data as LlmRetryEntry[]) ?? [];
  }

  // ── Status snapshot ────────────────────────────────────────────────

  async status(): Promise<BrainStatus> {
    // Fetch counts + last-activity in parallel. Each call is a small
    // count/select rather than a full scan.
    const dayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const weekAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      jobsWaiting,
      jobsInFlightAssigned,
      jobsInFlightRunning,
      jobsCompleted24h,
      jobsFailed24h,
      recordsAuth,
      recordsUnderReview,
      recordsDraft,
      contradictionsOpen,
      gapMarkersOpen,
      llmResults24h,
      feedbackTotal,
      feedback7d,
      feedbackUnapplied,
      workerPool,
    ] = await Promise.all([
      this.countRows("worker_jobs", { status: "waiting" }),
      this.countRows("worker_jobs", { status: "assigned" }),
      this.countRows("worker_jobs", { status: "running" }),
      this.countRows("worker_jobs", { status: "completed" }, { completed_at_gte: dayAgoIso }),
      this.countRows("worker_jobs", { status: "failed" }, { updated_at_gte: dayAgoIso }),
      this.countRows("knowledge_records", { status: "AUTHORITATIVE" }),
      this.countRows("knowledge_records", { status: "UNDER_REVIEW" }),
      this.countRows("knowledge_records", { status: "DRAFT" }),
      this.countRows("contradictions", { status: "open" }),
      this.countRows("graph_edges", { is_gap_marker: true }),
      this.client.from("worker_results").select("llm_tokens_in,llm_tokens_out", { count: "exact" }).gte("created_at", dayAgoIso),
      this.countRows("knowledge_feedback"),
      this.countRows("knowledge_feedback", {}, { created_at_gte: weekAgoIso }),
      this.countRows("knowledge_feedback", { applied_to_prompts: false }),
      this.workerPoolHealth(dayAgoIso),
    ]);

    let llmTokens24h = 0;
    let llmCalls24h = 0;
    if (!llmResults24h.error && llmResults24h.data) {
      llmCalls24h = llmResults24h.count ?? llmResults24h.data.length;
      for (const r of llmResults24h.data as Array<{ llm_tokens_in?: number | null; llm_tokens_out?: number | null }>) {
        llmTokens24h += (r.llm_tokens_in ?? 0) + (r.llm_tokens_out ?? 0);
      }
    }

    return {
      backend: "supabase",
      jobs_waiting: jobsWaiting,
      jobs_in_flight: jobsInFlightAssigned + jobsInFlightRunning,
      jobs_completed_24h: jobsCompleted24h,
      jobs_failed_24h: jobsFailed24h,
      records_authoritative: recordsAuth,
      records_under_review: recordsUnderReview,
      records_draft: recordsDraft,
      contradictions_open: contradictionsOpen,
      gap_markers_open: gapMarkersOpen,
      llm_tokens_24h: llmTokens24h,
      llm_calls_24h: llmCalls24h,
      feedback_total_lifetime: feedbackTotal,
      feedback_last_7d: feedback7d,
      feedback_unapplied: feedbackUnapplied,
      worker_pool: workerPool,
    };
  }

  // Helper — count rows matching arbitrary eq filters plus optional
  // range filters like { completed_at_gte: iso }.
  private async countRows(
    table: string,
    eq: Record<string, unknown> = {},
    range: Record<string, string> = {}
  ): Promise<number> {
    let query = this.client.from(table).select("id", { count: "exact", head: true });
    for (const [k, v] of Object.entries(eq)) {
      query = query.eq(k, v as never);
    }
    for (const [k, v] of Object.entries(range)) {
      // suffixes: _gte, _lte, _gt, _lt
      const m = k.match(/(.+?)_(gte|lte|gt|lt)$/);
      if (!m) continue;
      const [, col, op] = m;
      if (op === "gte") query = query.gte(col, v as never);
      else if (op === "lte") query = query.lte(col, v as never);
      else if (op === "gt") query = query.gt(col, v as never);
      else if (op === "lt") query = query.lt(col, v as never);
    }
    const { count, error } = await query;
    if (error) {
      // Table missing → return 0 rather than crash the whole status snapshot.
      console.warn(`[nex-brain.storage.supabase] countRows(${table}) failed:`, error.message);
      return 0;
    }
    return count ?? 0;
  }

  // Build per-worker health from the jobs + results tables.
  private async workerPoolHealth(dayAgoIso: string): Promise<WorkerPoolHealth[]> {
    const workerTypes: WorkerType[] = [
      "knowledge-context",
      "voice-context",
      "learning-context",
      "knowledge-extractor",
      "image-analyst",
      "quality-checker",
      "memory-guardian",
    ];

    const results: WorkerPoolHealth[] = [];
    for (const wt of workerTypes) {
      const [waiting, inFlightAssigned, inFlightRunning, completed24h, failed24h, lastCompleted, inFlightRow, results24h] = await Promise.all([
        this.countRows("worker_jobs", { worker_type: wt, status: "waiting" }),
        this.countRows("worker_jobs", { worker_type: wt, status: "assigned" }),
        this.countRows("worker_jobs", { worker_type: wt, status: "running" }),
        this.countRows("worker_jobs", { worker_type: wt, status: "completed" }, { completed_at_gte: dayAgoIso }),
        this.countRows("worker_jobs", { worker_type: wt, status: "failed" }, { updated_at_gte: dayAgoIso }),
        this.client
          .from("worker_jobs")
          .select("id,input_ref,completed_at,assigned_at,status")
          .eq("worker_type", wt)
          .eq("status", "completed")
          .order("completed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        this.client
          .from("worker_jobs")
          .select("input_ref,assigned_at")
          .eq("worker_type", wt)
          .in("status", ["assigned", "running"])
          .order("assigned_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        this.client
          .from("worker_results")
          .select("llm_ms,output_kind,output_payload,overall_confidence")
          .eq("worker_type", wt)
          .gte("created_at", dayAgoIso)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      const last = lastCompleted.data as { completed_at?: string } | null;
      const inFlight = inFlightRow.data as { input_ref?: string; assigned_at?: string } | null;
      const latestResult = (results24h.data as Array<{ llm_ms?: number; output_kind?: string; output_payload?: Record<string, unknown>; overall_confidence?: number }> | null)?.[0] ?? null;

      let lastResultSummary: string | null = null;
      if (latestResult) {
        if (latestResult.output_kind === "record_draft") {
          const ids = (latestResult.output_payload as { draft_record_ids?: string[] } | undefined)?.draft_record_ids ?? [];
          lastResultSummary = `${ids.length} draft${ids.length === 1 ? "" : "s"} authored`;
        } else if (latestResult.output_kind === "quality_report") {
          const decision = (latestResult.output_payload as { decision?: string } | undefined)?.decision ?? "-";
          const conf = latestResult.overall_confidence ?? 0;
          lastResultSummary = `${decision.toLowerCase()} · ${(conf * 100).toFixed(0)}%`;
        } else if (latestResult.output_kind === "context_bundle") {
          const b = latestResult.output_payload as { records?: unknown[]; gaps?: string[] } | undefined;
          lastResultSummary = `${(b?.records ?? []).length} related · ${(b?.gaps ?? []).length} gaps`;
        } else if (latestResult.output_kind === "voice_guide") {
          const g = latestResult.output_payload as { applicable_brand_terms?: unknown[]; primary_audience?: string } | undefined;
          lastResultSummary = `${(g?.applicable_brand_terms ?? []).length} brand · ${g?.primary_audience ?? "-"}`;
        } else if (latestResult.output_kind === "learning_bundle") {
          const b = latestResult.output_payload as { examples?: unknown[]; candidates_scanned?: number } | undefined;
          lastResultSummary = `${(b?.examples ?? []).length} lessons · ${b?.candidates_scanned ?? 0} scanned`;
        } else if (latestResult.output_kind) {
          lastResultSummary = latestResult.output_kind;
        }
      }

      results.push({
        worker_type: wt,
        jobs_waiting: waiting,
        jobs_in_flight: inFlightAssigned + inFlightRunning,
        jobs_completed_24h: completed24h,
        jobs_failed_24h: failed24h,
        last_activity_at: last?.completed_at ?? null,
        current_job_ref: inFlight?.input_ref ?? null,
        current_job_since: inFlight?.assigned_at ?? null,
        avg_ms_last_24h: latestResult?.llm_ms ?? null,
        last_result_summary: lastResultSummary,
      });
    }
    return results;
  }

  // ── Heartbeats ─────────────────────────────────────────────────────
  //
  // upsert by host_id — each running process (Fly machine, local dev,
  // local worker script) owns its own row. Read-side of this feeds the
  // "Cloud worker: online" tile via /api/nex/brain/cloud-status.
  async upsertHeartbeat(row: WorkerHeartbeat): Promise<void> {
    const { error } = await this.client
      .from("worker_heartbeats")
      .upsert(
        {
          host_id: row.host_id,
          last_seen_at: row.last_seen_at,
          uptime_ms: row.uptime_ms,
          cycles_total: row.cycles_total,
          cycles_failed: row.cycles_failed,
          last_error: row.last_error,
          last_cycle_summary: row.last_cycle_summary,
          metadata: row.metadata,
        },
        { onConflict: "host_id" }
      );
    if (error) throw new Error(`upsertHeartbeat failed: ${error.message}`);
  }

  async listHeartbeats(filter: { since?: string; limit?: number } = {}): Promise<WorkerHeartbeat[]> {
    let query = this.client
      .from("worker_heartbeats")
      .select("*")
      .order("last_seen_at", { ascending: false });
    if (filter.since) query = query.gt("last_seen_at", filter.since);
    if (filter.limit) query = query.limit(filter.limit);
    const { data, error } = await query;
    if (error) throw new Error(`listHeartbeats failed: ${error.message}`);
    return (data ?? []) as WorkerHeartbeat[];
  }

}
