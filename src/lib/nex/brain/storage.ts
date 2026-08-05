// NEX Brain · storage abstraction
//
// The boundary between "which backend" and "what the app calls".
//
// Backend selection:
//   · SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY present → Supabase
//   · otherwise                                        → filesystem (dev)
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
// Once you paste db/migrations/001_nex_brain_schema.sql into a fresh
// Supabase project and set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY,
// this module transparently switches. No changes elsewhere.

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
// to the standard SUPABASE_* env vars) to activate the Supabase backend.
// This prevents accidental activation when the repo already has
// SUPABASE_URL configured for other features (Philip's existing setup).
// Default is always the filesystem backend — safe for dev.

function isSupabaseConfigured(): boolean {
  return (
    process.env.NEX_BRAIN_BACKEND === "supabase" &&
    Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
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
      "quality-checker",
      "memory-guardian",
    ];

    const worker_pool: WorkerPoolHealth[] = workerTypes.map((wt) => {
      const jw = jobs.filter((j) => j.worker_type === wt);
      const last = jw
        .filter((j) => j.completed_at)
        .sort((a, b) => (a.completed_at! < b.completed_at! ? 1 : -1))[0];
      return {
        worker_type: wt,
        jobs_waiting: jw.filter((j) => j.status === "waiting").length,
        jobs_in_flight: jw.filter((j) => j.status === "assigned" || j.status === "running").length,
        jobs_completed_24h: jw.filter(
          (j) => j.status === "completed" && j.completed_at && isRecent(j.completed_at, dayAgo)
        ).length,
        last_activity_at: last?.completed_at ?? null,
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
// Lazy-imported so the app boots without the @supabase/supabase-js
// dependency being installed. When Philip runs `npm i @supabase/supabase-js`
// AND sets SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, this backend
// activates automatically.

class SupabaseStore implements BrainStore {
  // Placeholder — implementation lands the moment @supabase/supabase-js
  // is installed. The interface above is the exact contract to satisfy.
  // Every method is a thin wrapper around the Supabase client:
  //   - inserts → `.from('table').insert(...).select().single()`
  //   - lists   → `.from('table').select(...).eq(...).limit(...)`
  //   - claimNextJob → RPC call to the claim_next_job() function from
  //     the migration; that function does the SKIP LOCKED atomic claim.
  //   - status  → single query against the `nex_brain_status` view.
  //
  // For now: throw a friendly error so we can't accidentally use it
  // before it's wired.

  private explain(method: string): never {
    throw new Error(
      `[nex-brain.storage] Supabase backend not yet wired (called ${method}). ` +
        `Run \`npm i @supabase/supabase-js\` then implement SupabaseStore.` +
        ` The filesystem backend is active in the meantime.`
    );
  }

  insertRecord(): Promise<KnowledgeRecord> { this.explain("insertRecord"); }
  getRecord(): Promise<KnowledgeRecord | null> { this.explain("getRecord"); }
  listRecords(): Promise<KnowledgeRecord[]> { this.explain("listRecords"); }
  updateRecordStatus(): Promise<KnowledgeRecord | null> { this.explain("updateRecordStatus"); }
  insertVersion(): Promise<RecordVersion> { this.explain("insertVersion"); }
  insertEdge(): Promise<GraphEdge> { this.explain("insertEdge"); }
  listEdges(): Promise<GraphEdge[]> { this.explain("listEdges"); }
  enqueueJob(): Promise<WorkerJob> { this.explain("enqueueJob"); }
  claimNextJob(): Promise<WorkerJob | null> { this.explain("claimNextJob"); }
  completeJob(): Promise<void> { this.explain("completeJob"); }
  failJob(): Promise<void> { this.explain("failJob"); }
  countJobs(): Promise<number> { this.explain("countJobs"); }
  insertResult(): Promise<WorkerResult> { this.explain("insertResult"); }
  insertSource(): Promise<Source> { this.explain("insertSource"); }
  insertConfidence(): Promise<ConfidenceScore> { this.explain("insertConfidence"); }
  listConfidence(): Promise<ConfidenceScore[]> { this.explain("listConfidence"); }
  insertContradiction(): Promise<Contradiction> { this.explain("insertContradiction"); }
  listOpenContradictions(): Promise<Contradiction[]> { this.explain("listOpenContradictions"); }
  insertDeprecation(): Promise<Deprecation> { this.explain("insertDeprecation"); }
  insertFeedback(): Promise<KnowledgeFeedback> { this.explain("insertFeedback"); }
  listFeedback(): Promise<KnowledgeFeedback[]> { this.explain("listFeedback"); }
  markFeedbackApplied(): Promise<void> { this.explain("markFeedbackApplied"); }
  insertAudit(): Promise<AuditEntry> { this.explain("insertAudit"); }
  status(): Promise<BrainStatus> { this.explain("status"); }
}

// ── Singleton accessor ───────────────────────────────────────────────

let _store: BrainStore | null = null;

export function brainStore(): BrainStore {
  if (_store) return _store;
  _store = isSupabaseConfigured() ? new SupabaseStore() : new FilesystemStore();
  return _store;
}
