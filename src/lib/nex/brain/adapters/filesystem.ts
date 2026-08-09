// src/lib/nex/brain/adapters/filesystem.ts
//
// Wave 11 · Step 10 · F12 remediation · behavior-preserving extraction.
//
// This file was carved verbatim from src/lib/nex/brain/storage.ts
// (FS_ROOT + ensureFsRoot + readTable + writeTable + FilesystemStore).
// Every filesystem path, every read/write ordering, every method
// signature is byte-identical to the pre-extraction implementation.
// If a future edit changes I/O ordering or method shape, that IS a
// behavior change · not part of F12.
//
// The class is exported so storage.ts can construct it inside
// brainStore() as the default (dev / no-backend) selection. External
// callers continue to consume the BrainStore interface via `brainStore()`
// without knowing which concrete class backs it.

import { promises as fs } from "node:fs";
import * as path from "node:path";

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
} from "../types";
import type { BrainStore } from "../storage";
import { newId, nowIso } from "../storage";

const FS_ROOT = path.join(process.cwd(), "data", "nex-brain");

async function ensureFsRoot() {
  await fs.mkdir(FS_ROOT, { recursive: true });
}

async function readTable<T>(name: string): Promise<T[]> {
  await ensureFsRoot();
  try {
    const raw = await fs.readFile(path.join(FS_ROOT, `${name}.json`), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function writeTable<T>(name: string, rows: T[]): Promise<void> {
  await ensureFsRoot();
  const p = path.join(FS_ROOT, `${name}.json`);
  const tmp = `${p}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(rows, null, 2), "utf8");
  await fs.rename(tmp, p);
}

export class FilesystemStore implements BrainStore {
  // ── Records ────────────────────────────────────────────────────────
  async insertRecord(input: Omit<KnowledgeRecord, "id" | "created_at">): Promise<KnowledgeRecord> {
    const rows = await readTable<KnowledgeRecord>("records");
    const row: KnowledgeRecord = { ...input, id: newId(), created_at: nowIso() };
    rows.push(row);
    await writeTable("records", rows);
    return row;
  }
  async insertRecordIdempotent(
    input: Omit<KnowledgeRecord, "id" | "created_at">,
  ): Promise<{ record: KnowledgeRecord; created: boolean }> {
    const rows = await readTable<KnowledgeRecord>("records");
    const existing = rows.find((r) => r.record_id === input.record_id);
    if (existing) return { record: existing, created: false };
    const row: KnowledgeRecord = { ...input, id: newId(), created_at: nowIso() };
    rows.push(row);
    await writeTable("records", rows);
    return { record: row, created: true };
  }
  async getRecord(record_id: string): Promise<KnowledgeRecord | null> {
    const rows = await readTable<KnowledgeRecord>("records");
    return rows.find((r) => r.record_id === record_id) ?? null;
  }
  async listRecords(filter?: { status?: KnowledgeRecord["status"]; limit?: number }): Promise<KnowledgeRecord[]> {
    const rows = await readTable<KnowledgeRecord>("records");
    let out = rows;
    if (filter?.status) out = out.filter((r) => r.status === filter.status);
    out = out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    if (filter?.limit) out = out.slice(0, filter.limit);
    return out;
  }
  async updateRecordStatus(record_id: string, status: KnowledgeRecord["status"], reviewer?: string): Promise<KnowledgeRecord | null> {
    const rows = await readTable<KnowledgeRecord>("records");
    let updated: KnowledgeRecord | null = null;
    const next = rows.map((r) => {
      if (r.record_id !== record_id) return r;
      updated = {
        ...r,
        status,
        reviewed_by: reviewer ?? r.reviewed_by,
        last_reviewed_at: nowIso(),
        deprecated_at: status === "DEPRECATED" || status === "SUPERSEDED" ? nowIso() : r.deprecated_at,
      };
      return updated;
    });
    await writeTable("records", next);
    return updated;
  }

  // ── Versions ───────────────────────────────────────────────────────
  async insertVersion(input: Omit<RecordVersion, "id" | "changed_at">): Promise<RecordVersion> {
    const rows = await readTable<RecordVersion>("record_versions");
    const row: RecordVersion = { ...input, id: newId(), changed_at: nowIso() };
    rows.push(row);
    await writeTable("record_versions", rows);
    return row;
  }

  // ── Edges ──────────────────────────────────────────────────────────
  async insertEdge(input: Omit<GraphEdge, "id" | "created_at">): Promise<GraphEdge> {
    const rows = await readTable<GraphEdge>("graph_edges");
    const dupe = rows.find(
      (e) =>
        e.from_record_id === input.from_record_id &&
        e.to_record_id === input.to_record_id &&
        e.edge_type === input.edge_type
    );
    if (dupe) return dupe;
    const row: GraphEdge = { ...input, id: newId(), created_at: nowIso() };
    rows.push(row);
    await writeTable("graph_edges", rows);
    return row;
  }
  async listEdges(from_record_id?: string): Promise<GraphEdge[]> {
    const rows = await readTable<GraphEdge>("graph_edges");
    return from_record_id ? rows.filter((e) => e.from_record_id === from_record_id) : rows;
  }

  // ── Jobs ───────────────────────────────────────────────────────────
  async enqueueJob(input: Omit<WorkerJob, "id" | "status" | "attempts" | "created_at" | "updated_at">): Promise<WorkerJob> {
    const rows = await readTable<WorkerJob>("worker_jobs");
    const row: WorkerJob = {
      ...input,
      id: newId(),
      status: "waiting",
      attempts: 0,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    rows.push(row);
    await writeTable("worker_jobs", rows);
    return row;
  }
  async claimNextJob(worker_type: WorkerType, worker_id: string, lease_seconds = 60): Promise<WorkerJob | null> {
    const rows = await readTable<WorkerJob>("worker_jobs");
    // Priority ascending, then created_at ascending.
    const candidate = rows
      .filter((j) => j.worker_type === worker_type && j.status === "waiting")
      .sort((a, b) => a.priority - b.priority || (a.created_at < b.created_at ? -1 : 1))[0];
    if (!candidate) return null;
    const now = nowIso();
    const leaseIso = new Date(Date.now() + lease_seconds * 1000).toISOString();
    let claimed: WorkerJob | null = null;
    const next = rows.map((j) => {
      if (j.id !== candidate.id) return j;
      claimed = {
        ...j,
        status: "assigned",
        assigned_worker_id: worker_id,
        assigned_at: now,
        lease_expires_at: leaseIso,
        attempts: j.attempts + 1,
        updated_at: now,
      };
      return claimed;
    });
    await writeTable("worker_jobs", next);
    return claimed;
  }
  async completeJob(job_id: string, result_id: string): Promise<void> {
    const rows = await readTable<WorkerJob>("worker_jobs");
    const now = nowIso();
    const next = rows.map((j) =>
      j.id === job_id
        ? { ...j, status: "completed" as JobStatus, result_id, updated_at: now, completed_at: now }
        : j
    );
    await writeTable("worker_jobs", next);
  }
  async failJob(job_id: string, error: string): Promise<void> {
    const rows = await readTable<WorkerJob>("worker_jobs");
    const now = nowIso();
    const next = rows.map((j) =>
      j.id === job_id ? { ...j, status: "failed" as JobStatus, last_error: error, updated_at: now, completed_at: now } : j
    );
    await writeTable("worker_jobs", next);
  }
  async countJobs(worker_type: WorkerType, status: JobStatus): Promise<number> {
    const rows = await readTable<WorkerJob>("worker_jobs");
    return rows.filter((j) => j.worker_type === worker_type && j.status === status).length;
  }
  // Phase 11.0 · TRANSITIONAL · see BrainStore.listRecentPipelineInputRefs.
  async listRecentPipelineInputRefs(worker_types: WorkerType[]): Promise<string[]> {
    const rows = await readTable<WorkerJob>("worker_jobs");
    const set  = new Set<string>();
    for (const j of rows) {
      if (worker_types.includes(j.worker_type) && j.input_ref) set.add(j.input_ref);
    }
    return Array.from(set);
  }

  // ── Results ────────────────────────────────────────────────────────
  async insertResult(input: Omit<WorkerResult, "id" | "created_at">): Promise<WorkerResult> {
    const rows = await readTable<WorkerResult>("worker_results");
    const row: WorkerResult = { ...input, id: newId(), created_at: nowIso() };
    rows.push(row);
    await writeTable("worker_results", rows);
    return row;
  }

  // ── Sources ────────────────────────────────────────────────────────
  async insertSource(input: Omit<Source, "id" | "created_at">): Promise<Source> {
    const rows = await readTable<Source>("sources");
    const row: Source = { ...input, id: newId(), created_at: nowIso() };
    rows.push(row);
    await writeTable("sources", rows);
    return row;
  }

  // ── Confidence ─────────────────────────────────────────────────────
  async insertConfidence(input: Omit<ConfidenceScore, "id" | "created_at">): Promise<ConfidenceScore> {
    const rows = await readTable<ConfidenceScore>("confidence_scores");
    // Enforce UNIQUE(record_id, claim_key)
    const existingIdx = rows.findIndex(
      (c) => c.record_id === input.record_id && c.claim_key === input.claim_key
    );
    const row: ConfidenceScore = {
      ...input,
      id: existingIdx >= 0 ? rows[existingIdx].id : newId(),
      created_at: existingIdx >= 0 ? rows[existingIdx].created_at : nowIso(),
    };
    if (existingIdx >= 0) rows[existingIdx] = row;
    else rows.push(row);
    await writeTable("confidence_scores", rows);
    return row;
  }
  async listConfidence(record_id: string): Promise<ConfidenceScore[]> {
    const rows = await readTable<ConfidenceScore>("confidence_scores");
    return rows.filter((c) => c.record_id === record_id);
  }

  // ── Contradictions ─────────────────────────────────────────────────
  async insertContradiction(input: Omit<Contradiction, "id" | "detected_at">): Promise<Contradiction> {
    const rows = await readTable<Contradiction>("contradictions");
    const row: Contradiction = { ...input, id: newId(), detected_at: nowIso() };
    rows.push(row);
    await writeTable("contradictions", rows);
    return row;
  }
  async listOpenContradictions(): Promise<Contradiction[]> {
    const rows = await readTable<Contradiction>("contradictions");
    return rows.filter((c) => c.status === "open");
  }

  // ── Deprecations ───────────────────────────────────────────────────
  async insertDeprecation(input: Omit<Deprecation, "id" | "deprecated_at">): Promise<Deprecation> {
    const rows = await readTable<Deprecation>("deprecations");
    const row: Deprecation = { ...input, id: newId(), deprecated_at: nowIso() };
    rows.push(row);
    await writeTable("deprecations", rows);
    return row;
  }

  // ── Feedback (the moat) ────────────────────────────────────────────
  async insertFeedback(
    input: Omit<KnowledgeFeedback, "id" | "created_at" | "applied_to_prompts">
  ): Promise<KnowledgeFeedback> {
    const rows = await readTable<KnowledgeFeedback>("knowledge_feedback");
    const row: KnowledgeFeedback = {
      ...input,
      id: newId(),
      applied_to_prompts: false,
      created_at: nowIso(),
    };
    rows.push(row);
    await writeTable("knowledge_feedback", rows);
    return row;
  }
  async listFeedback(filter?: { record_id?: string; unapplied_only?: boolean; limit?: number }): Promise<KnowledgeFeedback[]> {
    let rows = await readTable<KnowledgeFeedback>("knowledge_feedback");
    if (filter?.record_id) rows = rows.filter((f) => f.record_id === filter.record_id);
    if (filter?.unapplied_only) rows = rows.filter((f) => !f.applied_to_prompts);
    rows = rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    if (filter?.limit) rows = rows.slice(0, filter.limit);
    return rows;
  }
  async markFeedbackApplied(id: string): Promise<void> {
    const rows = await readTable<KnowledgeFeedback>("knowledge_feedback");
    const now = nowIso();
    const next = rows.map((f) =>
      f.id === id ? { ...f, applied_to_prompts: true, applied_at: now } : f
    );
    await writeTable("knowledge_feedback", next);
  }

  // ── Audit log ──────────────────────────────────────────────────────
  async insertAudit(input: Omit<AuditEntry, "id" | "created_at">): Promise<AuditEntry> {
    const rows = await readTable<AuditEntry>("audit_log");
    const row: AuditEntry = { ...input, id: newId(), created_at: nowIso() };
    rows.push(row);
    await writeTable("audit_log", rows);
    return row;
  }
  async listAudit(filter?: { limit?: number; since?: string; entity_id?: string }): Promise<AuditEntry[]> {
    let rows = await readTable<AuditEntry>("audit_log");
    if (filter?.entity_id) rows = rows.filter((r) => r.entity_id === filter.entity_id);
    if (filter?.since) {
      const sinceMs = new Date(filter.since).getTime();
      if (!Number.isNaN(sinceMs)) {
        rows = rows.filter((r) => new Date(r.created_at).getTime() > sinceMs);
      }
    }
    rows = rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    if (filter?.limit) rows = rows.slice(0, filter.limit);
    return rows;
  }

  // ── LLM retry queue (Stage 3) ──────────────────────────────────────
  async enqueueLlmRetry(input: Omit<LlmRetryEntry, "id" | "status" | "attempts" | "next_attempt_at" | "last_provider_tried" | "last_error" | "succeeded_provider" | "succeeded_at" | "result_summary" | "created_at" | "updated_at"> & { next_attempt_at?: string }): Promise<LlmRetryEntry> {
    const rows = await readTable<LlmRetryEntry>("llm_retry_queue");
    const now = nowIso();
    const row: LlmRetryEntry = {
      ...input,
      id: newId(),
      status: "pending",
      attempts: 0,
      next_attempt_at: input.next_attempt_at ?? now,
      last_provider_tried: null,
      last_error: null,
      succeeded_provider: null,
      succeeded_at: null,
      result_summary: null,
      created_at: now,
      updated_at: now,
    };
    rows.push(row);
    await writeTable("llm_retry_queue", rows);
    return row;
  }
  async claimNextLlmRetry(worker_id: string, lease_seconds = 60): Promise<LlmRetryEntry | null> {
    const rows = await readTable<LlmRetryEntry>("llm_retry_queue");
    const nowMs = Date.now();
    const candidate = rows
      .filter((r) => r.status === "pending" && new Date(r.next_attempt_at).getTime() <= nowMs)
      .sort((a, b) =>
        new Date(a.next_attempt_at).getTime() - new Date(b.next_attempt_at).getTime() ||
        a.attempts - b.attempts
      )[0];
    if (!candidate) return null;
    const now = nowIso();
    const leaseIso = new Date(nowMs + lease_seconds * 1000).toISOString();
    let claimed: LlmRetryEntry | null = null;
    const next = rows.map((r) => {
      if (r.id !== candidate.id) return r;
      claimed = {
        ...r,
        status: "in_flight",
        attempts: r.attempts + 1,
        last_provider_tried: worker_id,
        next_attempt_at: leaseIso,
        updated_at: now,
      };
      return claimed;
    });
    await writeTable("llm_retry_queue", next);
    return claimed;
  }
  async markLlmRetrySucceeded(id: string, provider: string, result_summary: Record<string, unknown>): Promise<void> {
    const rows = await readTable<LlmRetryEntry>("llm_retry_queue");
    const now = nowIso();
    const next = rows.map((r) =>
      r.id === id
        ? { ...r, status: "succeeded" as LlmRetryStatus, succeeded_provider: provider, succeeded_at: now, result_summary, updated_at: now }
        : r
    );
    await writeTable("llm_retry_queue", next);
  }
  async markLlmRetryPending(id: string, next_attempt_at: string, last_error: string, last_provider: string): Promise<void> {
    const rows = await readTable<LlmRetryEntry>("llm_retry_queue");
    const now = nowIso();
    const next = rows.map((r) =>
      r.id === id
        ? { ...r, status: "pending" as LlmRetryStatus, next_attempt_at, last_error: last_error.slice(0, 500), last_provider_tried: last_provider, updated_at: now }
        : r
    );
    await writeTable("llm_retry_queue", next);
  }
  async markLlmRetryExhausted(id: string, last_error: string): Promise<void> {
    const rows = await readTable<LlmRetryEntry>("llm_retry_queue");
    const now = nowIso();
    const next = rows.map((r) =>
      r.id === id
        ? { ...r, status: "exhausted" as LlmRetryStatus, last_error: last_error.slice(0, 500), updated_at: now }
        : r
    );
    await writeTable("llm_retry_queue", next);
  }
  async listLlmRetries(filter?: { status?: LlmRetryStatus; limit?: number }): Promise<LlmRetryEntry[]> {
    let rows = await readTable<LlmRetryEntry>("llm_retry_queue");
    if (filter?.status) rows = rows.filter((r) => r.status === filter.status);
    rows = rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    if (filter?.limit) rows = rows.slice(0, filter.limit);
    return rows;
  }

  // ── Status snapshot ────────────────────────────────────────────────
  async status(): Promise<BrainStatus> {
    const [records, jobs, results, contradictions, edges, feedback] =
      await Promise.all([
        readTable<KnowledgeRecord>("records"),
        readTable<WorkerJob>("worker_jobs"),
        readTable<WorkerResult>("worker_results"),
        readTable<Contradiction>("contradictions"),
        readTable<GraphEdge>("graph_edges"),
        readTable<KnowledgeFeedback>("knowledge_feedback"),
      ]);
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

    const isRecent = (iso: string, cutoff: number) =>
      new Date(iso).getTime() >= cutoff;

    const workerTypes: WorkerType[] = [
      "knowledge-context",
      "voice-context",
      "learning-context",
      "knowledge-extractor",
      "image-analyst",
      "quality-checker",
      "memory-guardian",
    ];

    const worker_pool: WorkerPoolHealth[] = workerTypes.map((wt) => {
      const jw = jobs.filter((j) => j.worker_type === wt);
      const last = jw
        .filter((j) => j.completed_at)
        .sort((a, b) => (a.completed_at! < b.completed_at! ? 1 : -1))[0];

      // Currently-running job (if any). Job that has assigned/running
      // status and an in-force lease.
      const inFlight = jw
        .filter((j) => j.status === "assigned" || j.status === "running")
        .sort((a, b) => (a.assigned_at ?? "") < (b.assigned_at ?? "") ? 1 : -1)[0];

      // Average ms over the last 24h of results (LLM + processing).
      const rec24h = results.filter(
        (r) => r.worker_type === wt && isRecent(r.created_at, dayAgo)
      );
      const timings = rec24h.map((r) => r.llm_ms ?? 0).filter((n) => n > 0);
      const avgMs = timings.length > 0
        ? Math.round(timings.reduce((a, b) => a + b, 0) / timings.length)
        : null;

      // Last result summary — short human-readable line.
      let lastResultSummary: string | null = null;
      if (last) {
        const lastResult = results
          .filter((r) => r.job_id === last.id)
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
        if (lastResult) {
          if (lastResult.output_kind === "record_draft") {
            const ids = (lastResult.output_payload as { draft_record_ids?: string[] }).draft_record_ids ?? [];
            lastResultSummary = `${ids.length} draft${ids.length === 1 ? "" : "s"} authored`;
          } else if (lastResult.output_kind === "quality_report") {
            const decision = (lastResult.output_payload as { decision?: string }).decision ?? "-";
            const conf = lastResult.overall_confidence ?? 0;
            lastResultSummary = `${decision.toLowerCase()} · ${(conf * 100).toFixed(0)}%`;
          } else if (lastResult.output_kind === "context_bundle") {
            const bundle = lastResult.output_payload as { records?: unknown[]; gaps?: string[] };
            lastResultSummary = `${(bundle.records ?? []).length} related · ${(bundle.gaps ?? []).length} gaps`;
          } else if (lastResult.output_kind === "voice_guide") {
            const guide = lastResult.output_payload as {
              applicable_brand_terms?: unknown[];
              primary_audience?: string;
              content_class?: string;
            };
            const terms = (guide.applicable_brand_terms ?? []).length;
            lastResultSummary = `${terms} brand term${terms === 1 ? "" : "s"} · ${guide.primary_audience ?? "-"}`;
          } else if (lastResult.output_kind === "learning_bundle") {
            const bundle = lastResult.output_payload as { examples?: unknown[]; candidates_scanned?: number };
            lastResultSummary = `${(bundle.examples ?? []).length} lessons · ${bundle.candidates_scanned ?? 0} scanned`;
          } else {
            lastResultSummary = lastResult.output_kind;
          }
        }
      }

      return {
        worker_type: wt,
        jobs_waiting: jw.filter((j) => j.status === "waiting").length,
        jobs_in_flight: jw.filter((j) => j.status === "assigned" || j.status === "running").length,
        jobs_completed_24h: jw.filter(
          (j) => j.status === "completed" && j.completed_at && isRecent(j.completed_at, dayAgo)
        ).length,
        jobs_failed_24h: jw.filter(
          (j) => j.status === "failed" && isRecent(j.updated_at, dayAgo)
        ).length,
        last_activity_at: last?.completed_at ?? null,
        current_job_ref: inFlight?.input_ref ?? null,
        current_job_since: inFlight?.assigned_at ?? null,
        avg_ms_last_24h: avgMs,
        last_result_summary: lastResultSummary,
      };
    });

    return {
      backend: "filesystem",
      jobs_waiting: jobs.filter((j) => j.status === "waiting").length,
      jobs_in_flight: jobs.filter((j) => j.status === "assigned" || j.status === "running").length,
      jobs_completed_24h: jobs.filter(
        (j) => j.status === "completed" && j.completed_at && isRecent(j.completed_at, dayAgo)
      ).length,
      jobs_failed_24h: jobs.filter((j) => j.status === "failed" && isRecent(j.updated_at, dayAgo)).length,
      records_authoritative: records.filter((r) => r.status === "AUTHORITATIVE").length,
      records_under_review: records.filter((r) => r.status === "UNDER_REVIEW").length,
      records_draft: records.filter((r) => r.status === "DRAFT").length,
      contradictions_open: contradictions.filter((c) => c.status === "open").length,
      gap_markers_open: edges.filter((e) => e.is_gap_marker).length,
      llm_tokens_24h: results
        .filter((r) => isRecent(r.created_at, dayAgo))
        .reduce((sum, r) => sum + (r.llm_tokens_in ?? 0) + (r.llm_tokens_out ?? 0), 0),
      llm_calls_24h: results.filter((r) => isRecent(r.created_at, dayAgo)).length,
      feedback_total_lifetime: feedback.length,
      feedback_last_7d: feedback.filter((f) => isRecent(f.created_at, weekAgo)).length,
      feedback_unapplied: feedback.filter((f) => !f.applied_to_prompts).length,
      worker_pool,
    };
  }

  // ── Heartbeats ─────────────────────────────────────────────────────
  async upsertHeartbeat(row: WorkerHeartbeat): Promise<void> {
    const rows = await readTable<WorkerHeartbeat>("worker_heartbeats");
    const others = rows.filter((r) => r.host_id !== row.host_id);
    others.push(row);
    await writeTable("worker_heartbeats", others);
  }

  async listHeartbeats(filter: { since?: string; limit?: number } = {}): Promise<WorkerHeartbeat[]> {
    const rows = await readTable<WorkerHeartbeat>("worker_heartbeats");
    let out = rows;
    if (filter.since) out = out.filter((r) => r.last_seen_at > filter.since!);
    out = out.sort((a, b) => (a.last_seen_at < b.last_seen_at ? 1 : -1));
    if (filter.limit) out = out.slice(0, filter.limit);
    return out;
  }
}
