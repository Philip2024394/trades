// NEX Brain · storage abstraction
//
// The boundary between "which backend" and "what the app calls".
//
// Backend selection (Philip 2026-08-06 production migration):
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
// Both backends implement the same BrainStore interface. Every worker,
// route, and UI reads/writes through this module — nobody else touches
// the DB or the filesystem directly. Swap once, works everywhere.
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

import { promises as fs } from "node:fs";
import * as path from "node:path";
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

function resolveSupabaseUrl(): string | undefined {
  return (
    process.env.NEX_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_NEX_SUPABASE_URL ||
    process.env.SUPABASE_URL
  );
}

function resolveSupabaseServiceRoleKey(): string | undefined {
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

export function activeBackend(): "filesystem" | "supabase" {
  return isSupabaseConfigured() ? "supabase" : "filesystem";
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

  // Snapshot for the dashboard
  status(): Promise<BrainStatus>;
}

// =====================================================================
// Filesystem backend (dev / default)
// =====================================================================

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

class FilesystemStore implements BrainStore {
  // ── Records ────────────────────────────────────────────────────────
  async insertRecord(input: Omit<KnowledgeRecord, "id" | "created_at">): Promise<KnowledgeRecord> {
    const rows = await readTable<KnowledgeRecord>("records");
    const row: KnowledgeRecord = { ...input, id: newId(), created_at: nowIso() };
    rows.push(row);
    await writeTable("records", rows);
    return row;
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
}

// =====================================================================
// Supabase backend
// =====================================================================
//
// Uses @supabase/supabase-js with the service-role key so worker writes
// bypass Row-Level Security. Same 11 tables as the filesystem backend;
// same contract. Every method is a thin wrapper around one or two
// Supabase client calls.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

class SupabaseStore implements BrainStore {
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
}

// ── Singleton accessor ───────────────────────────────────────────────

let _store: BrainStore | null = null;

export function brainStore(): BrainStore {
  if (_store) return _store;
  _store = isSupabaseConfigured() ? new SupabaseStore() : new FilesystemStore();
  return _store;
}
