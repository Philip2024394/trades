// src/lib/nex/brain/adapters/postgres.ts
//
// Wave 11 · Step 10 · F12 remediation · behavior-preserving extraction.
//
// This file was carved verbatim from src/lib/nex/brain/storage.ts
// (lines 1487-1972 in the pre-extraction file). Every SQL string,
// every method signature, every parameter position is byte-identical
// to the pre-Step-10 implementation. If a future edit changes SQL
// or method shape, that IS a behavior change · not part of F12.
//
// The class remains INTERNAL (not exported directly to app code);
// storage.ts imports it and constructs it inside brainStore().
// Existing external callers continue to consume the BrainStore
// interface via  without needing to know which
// concrete class backs it.
//
// F34 · this file still uses a PRIVATE withTx helper rather than
// consuming the shared withBrainRoleStrict. That inconsistency is
// noted as F34.b (surfaced 2026-08-10) but NOT addressed here to
// keep F12 strictly behavior-preserving. Migration to shared helper
// is a separate authorised step.

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
  WorkerResult,
  WorkerType,
} from "../types";
import type { BrainStore } from "../storage";
import { withClient, type PgClientLike } from "@/lib/nex/db";
// Wave 3 · H3 · SET LOCAL statement_timeout + idle_in_transaction_session_timeout
// mirror the injection added to withBrainRole (this file's private withTx is
// the "primary Brain PG surface" per WORLD-CLASS-OPS-W-C-TIMEOUT-BUDGETS-DESIGN.md
// §1.1). F34.b migration to shared withBrainRole is a separate future step.
import { statementTimeoutMs, idleInTransactionTimeoutMs } from "@/lib/nex/config/timeouts";

export class PostgresBrainStore implements BrainStore {
  // Small transaction helper · every brain operation goes through this
  // so the RLS role is always set. Throws (not returns null) when the
  // pool is unavailable · the caller expects a real store.
  private async withTx<T>(fn: (c: PgClientLike) => Promise<T>): Promise<T> {
    // Wrap the callback's result so the outer `withClient` null-return
    // can only mean "pool unavailable" — never "callback returned null".
    // Prior form conflated both and threw a false "URL not configured"
    // error whenever `fn` legitimately resolved to null (e.g. row-not-
    // found lookups). Surfaced by wc-companion contract tests.
    const wrapped = await withClient(async (c) => {
      await c.query("BEGIN");
      try {
        await c.query("SET LOCAL ROLE nex_brain_app");
        // Wave 3 · H3 · T-1 statement_timeout + T-4 idle_in_transaction
        // (§4.2 of WAVE-3-H3-TIMEOUT-BUDGETS.md). Values come from the
        // shared config · env-var overrides · SET LOCAL only.
        await c.query(`SET LOCAL statement_timeout = ${statementTimeoutMs()}`);
        await c.query(`SET LOCAL idle_in_transaction_session_timeout = ${idleInTransactionTimeoutMs()}`);
        const r = await fn(c);
        await c.query("COMMIT");
        return { value: r };
      } catch (e) { await c.query("ROLLBACK"); throw e; }
    });
    if (wrapped === null) throw new Error("[postgres-brain-store] NEX_POSTGRES_URL not configured");
    return wrapped.value;
  }

  // ── Records ────────────────────────────────────────────────────────
  async insertRecord(input: Omit<KnowledgeRecord, "id" | "created_at">): Promise<KnowledgeRecord> {
    return this.withTx(async (c) => {
      const r = await c.query(
        `INSERT INTO nex.knowledge_records
           (record_id, record_version, status, supersedes, canonical_owner,
            authored_by, authorised_by, reviewed_by, title, category,
            subcategory, summary, body_markdown, industry_concepts,
            nex_concepts, primary_audience, alt_audiences, sustainability_alert,
            embedding, last_reviewed_at, review_due_at, deprecated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::text[],$15::text[],$16,$17::text[],$18::jsonb,$19,$20,$21,$22)
         RETURNING *`,
        [input.record_id, input.record_version, input.status, input.supersedes, input.canonical_owner,
         input.authored_by, input.authorised_by, input.reviewed_by, input.title, input.category,
         input.subcategory, input.summary, input.body_markdown, input.industry_concepts,
         input.nex_concepts, input.primary_audience, input.alt_audiences,
         input.sustainability_alert ? JSON.stringify(input.sustainability_alert) : null,
         null /* embedding · BYTEA placeholder · see 041 header §1 */,
         input.last_reviewed_at, input.review_due_at, input.deprecated_at],
      );
      return r.rows[0] as unknown as KnowledgeRecord;
    });
  }

  async insertRecordIdempotent(
    input: Omit<KnowledgeRecord, "id" | "created_at">,
  ): Promise<{ record: KnowledgeRecord; created: boolean }> {
    // Race-safe · INSERT ... ON CONFLICT DO NOTHING then SELECT on collision.
    return this.withTx(async (c) => {
      const r = await c.query(
        `INSERT INTO nex.knowledge_records
           (record_id, record_version, status, supersedes, canonical_owner,
            authored_by, authorised_by, reviewed_by, title, category,
            subcategory, summary, body_markdown, industry_concepts,
            nex_concepts, primary_audience, alt_audiences, sustainability_alert,
            embedding, last_reviewed_at, review_due_at, deprecated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::text[],$15::text[],$16,$17::text[],$18::jsonb,$19,$20,$21,$22)
         ON CONFLICT (record_id) DO NOTHING
         RETURNING *`,
        [input.record_id, input.record_version, input.status, input.supersedes, input.canonical_owner,
         input.authored_by, input.authorised_by, input.reviewed_by, input.title, input.category,
         input.subcategory, input.summary, input.body_markdown, input.industry_concepts,
         input.nex_concepts, input.primary_audience, input.alt_audiences,
         input.sustainability_alert ? JSON.stringify(input.sustainability_alert) : null,
         null, input.last_reviewed_at, input.review_due_at, input.deprecated_at],
      );
      if (r.rowCount && r.rowCount > 0) {
        return { record: r.rows[0] as unknown as KnowledgeRecord, created: true };
      }
      const existing = await c.query(
        `SELECT * FROM nex.knowledge_records WHERE record_id = $1`, [input.record_id],
      );
      if (existing.rowCount === 0) throw new Error(`insertRecordIdempotent · ON CONFLICT ignored but no existing row for ${input.record_id}`);
      return { record: existing.rows[0] as unknown as KnowledgeRecord, created: false };
    });
  }

  async getRecord(record_id: string): Promise<KnowledgeRecord | null> {
    return this.withTx(async (c) => {
      const r = await c.query(`SELECT * FROM nex.knowledge_records WHERE record_id = $1`, [record_id]);
      return (r.rows[0] as unknown as KnowledgeRecord) ?? null;
    });
  }

  async listRecords(filter?: { status?: KnowledgeRecord["status"]; limit?: number }): Promise<KnowledgeRecord[]> {
    return this.withTx(async (c) => {
      const params: unknown[] = [];
      let sql = `SELECT * FROM nex.knowledge_records`;
      if (filter?.status) { params.push(filter.status); sql += ` WHERE status = $${params.length}`; }
      sql += ` ORDER BY created_at DESC`;
      if (filter?.limit) { params.push(filter.limit); sql += ` LIMIT $${params.length}`; } else sql += ` LIMIT 100`;
      const r = await c.query(sql, params);
      return r.rows as unknown as KnowledgeRecord[];
    });
  }

  async updateRecordStatus(record_id: string, status: KnowledgeRecord["status"], reviewer?: string): Promise<KnowledgeRecord | null> {
    return this.withTx(async (c) => {
      const params: unknown[] = [record_id, status];
      let sql = `UPDATE nex.knowledge_records SET status = $2::text, last_reviewed_at = NOW()`;
      if (reviewer) { params.push(reviewer); sql += `, reviewed_by = $${params.length}`; }
      if (status === "DEPRECATED" || status === "SUPERSEDED") sql += `, deprecated_at = NOW()`;
      sql += ` WHERE record_id = $1 RETURNING *`;
      const r = await c.query(sql, params);
      return (r.rows[0] as unknown as KnowledgeRecord) ?? null;
    });
  }

  // ── Versions ───────────────────────────────────────────────────────
  async insertVersion(input: Omit<RecordVersion, "id" | "changed_at">): Promise<RecordVersion> {
    return this.withTx(async (c) => {
      const r = await c.query(
        `INSERT INTO nex.record_versions (record_id, version, body_markdown, change_summary, changed_by)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [input.record_id, input.version, input.body_markdown, input.change_summary, input.changed_by],
      );
      return r.rows[0] as unknown as RecordVersion;
    });
  }

  // ── Edges ──────────────────────────────────────────────────────────
  async insertEdge(input: Omit<GraphEdge, "id" | "created_at">): Promise<GraphEdge> {
    return this.withTx(async (c) => {
      const r = await c.query(
        `INSERT INTO nex.graph_edges
           (from_record_id, to_record_id, edge_type, confidence, provenance, is_gap_marker)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [input.from_record_id, input.to_record_id, input.edge_type, input.confidence, input.provenance, input.is_gap_marker],
      );
      return r.rows[0] as unknown as GraphEdge;
    });
  }
  async listEdges(from_record_id?: string): Promise<GraphEdge[]> {
    return this.withTx(async (c) => {
      const r = from_record_id
        ? await c.query(`SELECT * FROM nex.graph_edges WHERE from_record_id = $1 ORDER BY created_at DESC LIMIT 500`, [from_record_id])
        : await c.query(`SELECT * FROM nex.graph_edges ORDER BY created_at DESC LIMIT 500`);
      return r.rows as unknown as GraphEdge[];
    });
  }

  // ── Jobs ───────────────────────────────────────────────────────────
  async enqueueJob(input: Omit<WorkerJob, "id" | "status" | "attempts" | "created_at" | "updated_at">): Promise<WorkerJob> {
    return this.withTx(async (c) => {
      // D1 · migration 046 adds a partial unique index on
      // (input_ref, worker_type) WHERE status IN ('waiting','assigned','running').
      // If two dispatch cycles race, the second INSERT hits the index and
      // ON CONFLICT DO NOTHING returns zero rows. Fall back to selecting
      // the winner so the caller always gets a WorkerJob back and can
      // treat the outcome uniformly (silently deduplicated).
      // DEPLOY DEPENDENCY · migration 046 MUST be applied before this
      // code path executes. Postgres validates the ON CONFLICT inference
      // clause at plan time and errors with a clear "no unique or
      // exclusion constraint matching the ON CONFLICT specification"
      // message if the partial-unique index is absent.
      const insertRes = await c.query(
        `INSERT INTO nex.worker_jobs
           (worker_type, priority, input_kind, input_ref, input_payload)
         VALUES ($1,$2,$3,$4,$5::jsonb)
         ON CONFLICT (input_ref, worker_type)
           WHERE status IN ('waiting','assigned','running')
           DO NOTHING
         RETURNING *`,
        [input.worker_type, input.priority ?? 5, input.input_kind, input.input_ref,
         input.input_payload ? JSON.stringify(input.input_payload) : null],
      );
      if (insertRes.rows[0]) return insertRes.rows[0] as unknown as WorkerJob;
      // Deduped by the partial unique index — return the existing active row.
      const existing = await c.query(
        `SELECT * FROM nex.worker_jobs
         WHERE input_ref = $1 AND worker_type = $2
           AND status IN ('waiting','assigned','running')
         ORDER BY created_at DESC LIMIT 1`,
        [input.input_ref, input.worker_type],
      );
      if (existing.rows[0]) return existing.rows[0] as unknown as WorkerJob;
      // Extremely rare: the winner completed/failed between INSERT and SELECT.
      // Fall through to a plain INSERT so the caller still gets a row.
      const retry = await c.query(
        `INSERT INTO nex.worker_jobs
           (worker_type, priority, input_kind, input_ref, input_payload)
         VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING *`,
        [input.worker_type, input.priority ?? 5, input.input_kind, input.input_ref,
         input.input_payload ? JSON.stringify(input.input_payload) : null],
      );
      return retry.rows[0] as unknown as WorkerJob;
    });
  }
  async claimNextJob(worker_type: WorkerType, worker_id: string, lease_seconds = 60): Promise<WorkerJob | null> {
    return this.withTx(async (c) => {
      // Delegates to the nex.claim_next_job SKIP LOCKED helper from 041.
      const r = await c.query(`SELECT * FROM nex.claim_next_job($1, $2, $3)`, [worker_type, worker_id, lease_seconds]);
      const row = r.rows[0] as unknown as WorkerJob | undefined;
      // The function returns a row with NULL id when no job was claimed.
      return (row && row.id) ? row : null;
    });
  }
  async completeJob(job_id: string, result_id: string): Promise<void> {
    await this.withTx(async (c) => {
      await c.query(
        `UPDATE nex.worker_jobs
           SET status = 'completed', completed_at = NOW(), updated_at = NOW(), result_id = $2
         WHERE id = $1`,
        [job_id, result_id],
      );
    });
  }
  async failJob(job_id: string, error: string): Promise<void> {
    await this.withTx(async (c) => {
      await c.query(
        `UPDATE nex.worker_jobs
           SET status = 'failed', completed_at = NOW(), updated_at = NOW(), last_error = $2
         WHERE id = $1`,
        [job_id, error],
      );
    });
  }
  async countJobs(worker_type: WorkerType, status: JobStatus): Promise<number> {
    return this.withTx(async (c) => {
      const r = await c.query(
        `SELECT COUNT(*)::int AS n FROM nex.worker_jobs WHERE worker_type = $1 AND status = $2`,
        [worker_type, status],
      );
      return (r.rows[0]?.n as number) ?? 0;
    });
  }
  async listRecentPipelineInputRefs(worker_types: WorkerType[]): Promise<string[]> {
    if (worker_types.length === 0) return [];
    return this.withTx(async (c) => {
      const r = await c.query(
        `SELECT DISTINCT input_ref FROM nex.worker_jobs WHERE worker_type = ANY($1::text[])`,
        [worker_types],
      );
      return r.rows.map((row) => String(row.input_ref)).filter(Boolean);
    });
  }

  // Wave 11 · Phase 5 · W-C-COMPANION storage-contract extension.
  async getWorkerJob(job_id: string): Promise<WorkerJob | null> {
    if (!job_id) return null;
    return this.withTx(async (c) => {
      // Postgres will reject a malformed UUID with SQLSTATE 22P02.
      // Guard the caller: a bad id resolves to null, never throws.
      try {
        const r = await c.query(
          `SELECT * FROM nex.worker_jobs WHERE id = $1::uuid LIMIT 1`,
          [job_id],
        );
        return (r.rows[0] as unknown as WorkerJob) ?? null;
      } catch (e) {
        if ((e as { code?: string }).code === "22P02") return null;
        throw e;
      }
    });
  }
  async listWorkerJobsByInputRef(
    input_refs: string[],
    opts?: { limit?: number },
  ): Promise<WorkerJob[]> {
    if (!input_refs || input_refs.length === 0) return [];
    const limit = opts?.limit ?? 500;
    return this.withTx(async (c) => {
      const r = await c.query(
        `SELECT * FROM nex.worker_jobs
           WHERE input_ref = ANY($1::text[])
         ORDER BY created_at ASC
         LIMIT $2`,
        [input_refs, limit],
      );
      return r.rows as unknown as WorkerJob[];
    });
  }
  async findWorkerJobsByKnowledgeJobId(kjid: string): Promise<WorkerJob[]> {
    if (!kjid) return [];
    return this.withTx(async (c) => {
      const r = await c.query(
        `SELECT * FROM nex.worker_jobs
           WHERE input_payload ? 'knowledge_job_id'
             AND input_payload->>'knowledge_job_id' = $1
         ORDER BY created_at ASC`,
        [kjid],
      );
      return r.rows as unknown as WorkerJob[];
    });
  }
  async listWorkerResultsByIds(
    result_ids: string[],
    opts?: { limit?: number },
  ): Promise<WorkerResult[]> {
    if (!result_ids || result_ids.length === 0) return [];
    const limit = opts?.limit ?? 500;
    return this.withTx(async (c) => {
      try {
        const r = await c.query(
          `SELECT * FROM nex.worker_results
             WHERE id = ANY($1::uuid[])
           LIMIT $2`,
          [result_ids, limit],
        );
        return r.rows as unknown as WorkerResult[];
      } catch (e) {
        // Malformed uuid in the input list · caller passed bad ids.
        if ((e as { code?: string }).code === "22P02") return [];
        throw e;
      }
    });
  }
  async writeKnowledgeJobTransitionAudit(
    input: KnowledgeJobTransitionAudit,
  ): Promise<void> {
    const { knowledge_job_id, from_status, to_status, actor, ...rest } = input;
    const notes = JSON.stringify(rest);
    await this.withTx(async (c) => {
      await c.query(
        `INSERT INTO nex.audit_log
           (entity_type, entity_id, action, actor,
            before_state, after_state, notes)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)`,
        [
          "knowledge_jobs",
          knowledge_job_id,
          to_status,
          actor,
          JSON.stringify({ status: from_status }),
          JSON.stringify({ status: to_status }),
          notes,
        ],
      );
    });
  }

  // ── Results ────────────────────────────────────────────────────────
  async insertResult(input: Omit<WorkerResult, "id" | "created_at">): Promise<WorkerResult> {
    return this.withTx(async (c) => {
      const r = await c.query(
        `INSERT INTO nex.worker_results
           (job_id, worker_type, worker_id, output_kind, output_payload,
            overall_confidence, llm_provider, llm_model, llm_tokens_in,
            llm_tokens_out, llm_ms, flags)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12::text[])
         RETURNING *`,
        [input.job_id, input.worker_type, input.worker_id, input.output_kind,
         JSON.stringify(input.output_payload ?? {}),
         input.overall_confidence, input.llm_provider, input.llm_model,
         input.llm_tokens_in, input.llm_tokens_out, input.llm_ms, input.flags ?? []],
      );
      return r.rows[0] as unknown as WorkerResult;
    });
  }

  // ── Sources ────────────────────────────────────────────────────────
  async insertSource(input: Omit<Source, "id" | "created_at">): Promise<Source> {
    return this.withTx(async (c) => {
      const r = await c.query(
        `INSERT INTO nex.sources (record_id, inbox_item_id, source_tier, source_url, source_hash, excerpt)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [input.record_id, input.inbox_item_id, input.source_tier, input.source_url, input.source_hash, input.excerpt],
      );
      return r.rows[0] as unknown as Source;
    });
  }

  // ── Confidence scores ──────────────────────────────────────────────
  async insertConfidence(input: Omit<ConfidenceScore, "id" | "created_at">): Promise<ConfidenceScore> {
    return this.withTx(async (c) => {
      const r = await c.query(
        `INSERT INTO nex.confidence_scores
           (record_id, claim_key, claim_text, classification, confidence_band,
            confidence_score, source_type, source_ref, verification_date, rationale)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [input.record_id, input.claim_key, input.claim_text, input.classification, input.confidence_band,
         input.confidence_score, input.source_type, input.source_ref, input.verification_date, input.rationale],
      );
      return r.rows[0] as unknown as ConfidenceScore;
    });
  }
  async listConfidence(record_id: string): Promise<ConfidenceScore[]> {
    return this.withTx(async (c) => {
      const r = await c.query(`SELECT * FROM nex.confidence_scores WHERE record_id = $1 ORDER BY created_at ASC`, [record_id]);
      return r.rows as unknown as ConfidenceScore[];
    });
  }

  // ── Contradictions ─────────────────────────────────────────────────
  async insertContradiction(input: Omit<Contradiction, "id" | "detected_at">): Promise<Contradiction> {
    return this.withTx(async (c) => {
      const r = await c.query(
        `INSERT INTO nex.contradictions
           (record_a_id, record_b_id, claim_key_a, claim_key_b, contradiction_summary,
            status, resolved_by, resolution_notes, resolved_at, detected_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [input.record_a_id, input.record_b_id, input.claim_key_a, input.claim_key_b,
         input.contradiction_summary, input.status, input.resolved_by,
         input.resolution_notes, input.resolved_at, input.detected_by],
      );
      return r.rows[0] as unknown as Contradiction;
    });
  }
  async listOpenContradictions(): Promise<Contradiction[]> {
    return this.withTx(async (c) => {
      const r = await c.query(`SELECT * FROM nex.contradictions WHERE status = 'open' ORDER BY detected_at DESC`);
      return r.rows as unknown as Contradiction[];
    });
  }

  // ── Deprecations ───────────────────────────────────────────────────
  async insertDeprecation(input: Omit<Deprecation, "id" | "deprecated_at">): Promise<Deprecation> {
    return this.withTx(async (c) => {
      const r = await c.query(
        `INSERT INTO nex.deprecations (record_id, superseded_by, reason, deprecated_by)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [input.record_id, input.superseded_by, input.reason, input.deprecated_by],
      );
      return r.rows[0] as unknown as Deprecation;
    });
  }

  // ── Feedback ───────────────────────────────────────────────────────
  async insertFeedback(input: Omit<KnowledgeFeedback, "id" | "created_at" | "applied_to_prompts">): Promise<KnowledgeFeedback> {
    return this.withTx(async (c) => {
      const r = await c.query(
        `INSERT INTO nex.knowledge_feedback
           (question, nex_answer, correction, lesson, record_id, domain, topic_tags,
            feedback_kind, severity, feedback_source, submitted_by, context,
            applied_at, triggered_worker_proposal, resulted_in_record)
         VALUES ($1,$2,$3,$4,$5,$6,$7::text[],$8,$9,$10,$11,$12::jsonb,$13,$14,$15)
         RETURNING *`,
        [input.question, input.nex_answer, input.correction, input.lesson, input.record_id,
         input.domain, input.topic_tags ?? [], input.feedback_kind, input.severity,
         input.feedback_source, input.submitted_by,
         input.context ? JSON.stringify(input.context) : null,
         input.applied_at, input.triggered_worker_proposal, input.resulted_in_record],
      );
      return r.rows[0] as unknown as KnowledgeFeedback;
    });
  }
  async listFeedback(filter?: { record_id?: string; unapplied_only?: boolean; limit?: number }): Promise<KnowledgeFeedback[]> {
    return this.withTx(async (c) => {
      const params: unknown[] = [];
      let sql = `SELECT * FROM nex.knowledge_feedback WHERE 1=1`;
      if (filter?.record_id)      { params.push(filter.record_id); sql += ` AND record_id = $${params.length}`; }
      if (filter?.unapplied_only) sql += ` AND applied_to_prompts = FALSE`;
      sql += ` ORDER BY created_at DESC`;
      if (filter?.limit) { params.push(filter.limit); sql += ` LIMIT $${params.length}`; } else sql += ` LIMIT 100`;
      const r = await c.query(sql, params);
      return r.rows as unknown as KnowledgeFeedback[];
    });
  }
  async markFeedbackApplied(id: string): Promise<void> {
    await this.withTx(async (c) => {
      await c.query(
        `UPDATE nex.knowledge_feedback SET applied_to_prompts = TRUE, applied_at = NOW() WHERE id = $1::uuid`, [id],
      );
    });
  }

  // ── Audit ──────────────────────────────────────────────────────────
  async insertAudit(input: Omit<AuditEntry, "id" | "created_at">): Promise<AuditEntry> {
    return this.withTx(async (c) => {
      const r = await c.query(
        `INSERT INTO nex.audit_log
           (entity_type, entity_id, action, actor, before_state, after_state, notes)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7) RETURNING *`,
        [input.entity_type, input.entity_id, input.action, input.actor,
         input.before_state ? JSON.stringify(input.before_state) : null,
         input.after_state  ? JSON.stringify(input.after_state)  : null,
         input.notes],
      );
      return r.rows[0] as unknown as AuditEntry;
    });
  }
  async listAudit(filter?: { limit?: number; since?: string; entity_id?: string }): Promise<AuditEntry[]> {
    return this.withTx(async (c) => {
      const params: unknown[] = [];
      let sql = `SELECT * FROM nex.audit_log WHERE 1=1`;
      if (filter?.entity_id) { params.push(filter.entity_id); sql += ` AND entity_id = $${params.length}`; }
      if (filter?.since)     { params.push(filter.since);     sql += ` AND created_at >= $${params.length}::timestamptz`; }
      sql += ` ORDER BY created_at DESC`;
      if (filter?.limit) { params.push(filter.limit); sql += ` LIMIT $${params.length}`; } else sql += ` LIMIT 100`;
      const r = await c.query(sql, params);
      return r.rows as unknown as AuditEntry[];
    });
  }

  // ── LLM retry queue ────────────────────────────────────────────────
  async enqueueLlmRetry(input: Omit<LlmRetryEntry, "id" | "status" | "attempts" | "next_attempt_at" | "last_provider_tried" | "last_error" | "succeeded_provider" | "succeeded_at" | "result_summary" | "created_at" | "updated_at"> & { next_attempt_at?: string }): Promise<LlmRetryEntry> {
    return this.withTx(async (c) => {
      const r = await c.query(
        `INSERT INTO nex.llm_retry_queue
           (parent_job_id, parent_worker_type, parent_input_ref, call_purpose,
            call_options, call_messages, requires_capability, prefer_provider,
            max_attempts, next_attempt_at)
         VALUES ($1::uuid,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,COALESCE($10::timestamptz, NOW()))
         RETURNING *`,
        [input.parent_job_id, input.parent_worker_type, input.parent_input_ref, input.call_purpose,
         input.call_options ? JSON.stringify(input.call_options) : null,
         JSON.stringify(input.call_messages),
         input.requires_capability, input.prefer_provider,
         input.max_attempts ?? 5, input.next_attempt_at ?? null],
      );
      return r.rows[0] as unknown as LlmRetryEntry;
    });
  }
  async claimNextLlmRetry(worker_id: string, lease_seconds = 60): Promise<LlmRetryEntry | null> {
    return this.withTx(async (c) => {
      const r = await c.query(`SELECT * FROM nex.claim_next_llm_retry($1, $2)`, [worker_id, lease_seconds]);
      const row = r.rows[0] as unknown as LlmRetryEntry | undefined;
      return (row && row.id) ? row : null;
    });
  }
  async markLlmRetrySucceeded(id: string, provider: string, result_summary: Record<string, unknown>): Promise<void> {
    await this.withTx(async (c) => {
      await c.query(
        `UPDATE nex.llm_retry_queue
           SET status = 'succeeded', succeeded_provider = $2, succeeded_at = NOW(),
               result_summary = $3::jsonb, updated_at = NOW()
         WHERE id = $1::uuid`,
        [id, provider, JSON.stringify(result_summary)],
      );
    });
  }
  async markLlmRetryPending(id: string, next_attempt_at: string, last_error: string, last_provider: string): Promise<void> {
    await this.withTx(async (c) => {
      await c.query(
        `UPDATE nex.llm_retry_queue
           SET status = 'pending', next_attempt_at = $2::timestamptz,
               last_error = $3, last_provider_tried = $4, updated_at = NOW()
         WHERE id = $1::uuid`,
        [id, next_attempt_at, last_error, last_provider],
      );
    });
  }
  async markLlmRetryExhausted(id: string, last_error: string): Promise<void> {
    await this.withTx(async (c) => {
      await c.query(
        `UPDATE nex.llm_retry_queue
           SET status = 'exhausted', last_error = $2, updated_at = NOW()
         WHERE id = $1::uuid`,
        [id, last_error],
      );
    });
  }
  async listLlmRetries(filter?: { status?: LlmRetryStatus; limit?: number }): Promise<LlmRetryEntry[]> {
    return this.withTx(async (c) => {
      const params: unknown[] = [];
      let sql = `SELECT * FROM nex.llm_retry_queue WHERE 1=1`;
      if (filter?.status) { params.push(filter.status); sql += ` AND status = $${params.length}`; }
      sql += ` ORDER BY next_attempt_at ASC`;
      if (filter?.limit) { params.push(filter.limit); sql += ` LIMIT $${params.length}`; } else sql += ` LIMIT 100`;
      const r = await c.query(sql, params);
      return r.rows as unknown as LlmRetryEntry[];
    });
  }

  // ── Heartbeats ─────────────────────────────────────────────────────
  async upsertHeartbeat(row: WorkerHeartbeat): Promise<void> {
    await this.withTx(async (c) => {
      await c.query(
        `INSERT INTO nex.worker_heartbeats
           (host_id, last_seen_at, uptime_ms, cycles_total, cycles_failed,
            last_error, last_cycle_summary, metadata)
         VALUES ($1, COALESCE($2::timestamptz, NOW()), $3, $4, $5, $6, $7::jsonb, $8::jsonb)
         ON CONFLICT (host_id) DO UPDATE SET
           last_seen_at       = EXCLUDED.last_seen_at,
           uptime_ms          = EXCLUDED.uptime_ms,
           cycles_total       = EXCLUDED.cycles_total,
           cycles_failed      = EXCLUDED.cycles_failed,
           last_error         = EXCLUDED.last_error,
           last_cycle_summary = EXCLUDED.last_cycle_summary,
           metadata           = EXCLUDED.metadata`,
        [row.host_id, row.last_seen_at ?? null, row.uptime_ms ?? 0,
         row.cycles_total ?? 0, row.cycles_failed ?? 0, row.last_error ?? null,
         row.last_cycle_summary ? JSON.stringify(row.last_cycle_summary) : null,
         row.metadata ? JSON.stringify(row.metadata) : null],
      );
    });
  }
  async listHeartbeats(filter?: { since?: string; limit?: number }): Promise<WorkerHeartbeat[]> {
    return this.withTx(async (c) => {
      const params: unknown[] = [];
      let sql = `SELECT * FROM nex.worker_heartbeats WHERE 1=1`;
      if (filter?.since) { params.push(filter.since); sql += ` AND last_seen_at > $${params.length}::timestamptz`; }
      sql += ` ORDER BY last_seen_at DESC`;
      if (filter?.limit) { params.push(filter.limit); sql += ` LIMIT $${params.length}`; }
      const r = await c.query(sql, params);
      return r.rows as unknown as WorkerHeartbeat[];
    });
  }

  // ── Status snapshot ────────────────────────────────────────────────
  async status(): Promise<BrainStatus> {
    return this.withTx(async (c) => {
      const r = await c.query(`SELECT * FROM nex.nex_brain_status`);
      const row = r.rows[0] ?? {};
      return {
        backend: "postgres" as unknown as BrainStatus["backend"],
        jobs_waiting:            Number(row.jobs_waiting             ?? 0),
        jobs_in_flight:          Number(row.jobs_in_flight           ?? 0),
        jobs_completed_24h:      Number(row.jobs_completed_24h       ?? 0),
        jobs_failed_24h:         Number(row.jobs_failed_24h          ?? 0),
        records_authoritative:   Number(row.records_authoritative    ?? 0),
        records_under_review:    Number(row.records_under_review     ?? 0),
        records_draft:           Number(row.records_draft            ?? 0),
        contradictions_open:     Number(row.contradictions_open      ?? 0),
        gap_markers_open:        Number(row.gap_markers_open         ?? 0),
        llm_tokens_24h:          Number(row.llm_tokens_24h           ?? 0),
        llm_calls_24h:           Number(row.llm_calls_24h            ?? 0),
        feedback_total_lifetime: Number(row.feedback_total_lifetime  ?? 0),
        feedback_last_7d:        Number(row.feedback_last_7d         ?? 0),
        feedback_unapplied:      Number(row.feedback_unapplied       ?? 0),
        worker_pool: [] as BrainStatus["worker_pool"],  // detailed pool assembled by caller · view returns aggregates only
        manager: { ready: true, last_dispatch_at: null } as BrainStatus["manager"],
      } as BrainStatus;
    });
  }
}
