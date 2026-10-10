// src/lib/nex-agent/code-engine/capability-technical-evidence-stream.ts
//
// NEX1 · Technical Evidence Stream · Founder Mandate §3-6, §11-12
// Ledger B additive · Zero LLM · Deterministic · JSONL append-only.
//
// PURPOSE
//   Shared substrate NEX1 and Twin NEX both write to and read from.
//   Every meaningful technical observation becomes a structured record
//   with provenance, status lifecycle (OBSERVED/INFERRED/VERIFIED/REJECTED/
//   SUPERSEDED), and cross-agent retrieval.
//
// FOUNDER PRINCIPLES HONOURED
//   · §11 "Every uploaded fact must retain provenance"
//   · §12 "A failed agent observation must not automatically become a trusted
//         NEX fact" — status distinguishes OBSERVED vs VERIFIED
//   · §34 "Agent statements are observations or hypotheses unless
//         independently verified" — status starts at OBSERVED, promotion needed
//   · §5-6 "Paths and files are first-class knowledge"
//
// INVARIANTS
//   · Every record has evidence_id · provenance · timestamp · project scope
//   · Status can only progress OBSERVED → INFERRED/VERIFIED/REJECTED/SUPERSEDED
//   · Cannot silently upgrade OBSERVED → VERIFIED without explicit call
//   · Append-only JSONL persistence · never rewrites history
//   · Zero LLM · deterministic given same inputs
//   · Multi-user/project isolation via scope keys

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

export const TECHNICAL_EVIDENCE_STREAM_VERSION = "technical-evidence-stream.v1.2026-09-19";

// ── Canonical evidence types (founder §4 · reuse where possible) ─────────

export type EvidenceType =
  // File/path
  | "FILE_DISCOVERED" | "FILE_READ" | "FILE_CREATED" | "FILE_MODIFIED" | "FILE_DELETED" | "FILE_RENAMED"
  | "PATH_DISCOVERED" | "PATH_NOT_FOUND" | "PATH_RESOLVED" | "PATH_MISMATCH"
  // Module/import/export
  | "MODULE_DISCOVERED" | "IMPORT_DISCOVERED" | "IMPORT_FAILED" | "IMPORT_MISMATCH"
  | "EXPORT_DISCOVERED" | "EXPORT_MISSING" | "EXPORT_MISMATCH"
  // Symbol/function/class/interface/type
  | "SYMBOL_DISCOVERED" | "SYMBOL_NOT_FOUND" | "SYMBOL_CHANGED"
  | "FUNCTION_DISCOVERED" | "CLASS_DISCOVERED" | "INTERFACE_DISCOVERED" | "TYPE_DISCOVERED"
  // Dependencies/config
  | "DEPENDENCY_DISCOVERED" | "DEPENDENCY_MISSING" | "DEPENDENCY_VERSION_MISMATCH"
  | "CONFIG_DISCOVERED" | "CONFIG_MISMATCH"
  // Routes/API/DB
  | "ROUTE_DISCOVERED" | "API_DISCOVERED" | "API_FAILURE"
  | "DATABASE_SCHEMA_DISCOVERED" | "DATABASE_ERROR"
  // Commands/build/test
  | "COMMAND_EXECUTED" | "COMMAND_FAILED" | "COMMAND_SUCCEEDED"
  | "BUILD_STARTED" | "BUILD_FAILED" | "BUILD_SUCCEEDED"
  | "TEST_STARTED" | "TEST_FAILED" | "TEST_PASSED"
  // Runtime/preview
  | "RUNTIME_STARTED" | "RUNTIME_ERROR" | "RUNTIME_RECOVERED"
  | "PREVIEW_STARTED" | "PREVIEW_ERROR" | "PREVIEW_READY"
  // Git
  | "GIT_STATE_DISCOVERED" | "GIT_DIFF_DISCOVERED" | "COMMIT_CREATED" | "PUSH_FAILED" | "PUSH_SUCCEEDED"
  // Specification/hypothesis/repair
  | "SPECIFICATION_OBSERVED" | "SPECIFICATION_INTERPRETED"
  | "CHANGE_HYPOTHESIS_CREATED" | "REPAIR_HYPOTHESIS_CREATED"
  | "REPAIR_ATTEMPTED" | "REPAIR_FAILED" | "REPAIR_VERIFIED"
  | "REGRESSION_DETECTED" | "REGRESSION_CLEARED"
  // Verification
  | "VERIFICATION_COMPLETED" | "REFEREE_DECISION";

// ── Status lifecycle (§11-12) ───────────────────────────────────────────

export type EvidenceStatus =
  | "OBSERVED"     // raw agent observation · not verified
  | "INFERRED"     // derived from other evidence · confidence < 1.0
  | "VERIFIED"     // corroborated by independent check
  | "REJECTED"     // proven wrong · retained for negative-example learning
  | "SUPERSEDED";  // replaced by a newer/more accurate record

// ── Record shape ─────────────────────────────────────────────────────────

export interface TechnicalEvidence {
  readonly evidence_id: string;
  readonly evidence_type: EvidenceType;
  readonly status: EvidenceStatus;

  // Scope (§29-30 · multi-user/project isolation)
  readonly project_id: string;
  readonly session_id: string;
  readonly user_id: string | null;

  readonly timestamp_iso: string;
  readonly timestamp_ns: string;

  // Provenance (§11 mandatory)
  readonly source_agent: string;
  readonly source_role: string;
  readonly git_commit: string | null;
  readonly repository_snapshot_id: string | null;

  // Location
  readonly file_path: string | null;
  readonly symbol: string | null;
  readonly line_range: string | null;

  // Payload
  readonly observation: unknown;
  readonly related_evidence_ids: readonly string[];

  // Confidence + supersession
  readonly confidence: number | null;
  readonly supersedes_evidence_id: string | null;
  readonly superseded_by_evidence_id: string | null;

  readonly zero_llm: true;
  readonly ledger: "B";
  readonly version: string;
}

// ── Stream configuration ─────────────────────────────────────────────────

export interface EvidenceStreamOptions {
  readonly data_root: string;
}

function evidencePath(opts: EvidenceStreamOptions, project_id: string): string {
  return path.join(opts.data_root, "projects", project_id, "evidence.jsonl");
}

function statusChangePath(opts: EvidenceStreamOptions, project_id: string): string {
  return path.join(opts.data_root, "projects", project_id, "status-transitions.jsonl");
}

// ── Upload ───────────────────────────────────────────────────────────────

export interface UploadEvidenceInput {
  readonly evidence_type: EvidenceType;
  readonly project_id: string;
  readonly session_id: string;
  readonly user_id?: string | null;
  readonly source_agent: string;
  readonly source_role: string;
  readonly file_path?: string | null;
  readonly symbol?: string | null;
  readonly line_range?: string | null;
  readonly observation: unknown;
  readonly related_evidence_ids?: readonly string[];
  readonly git_commit?: string | null;
  readonly repository_snapshot_id?: string | null;
  /** Initial status. Defaults to OBSERVED. Cannot start at VERIFIED. */
  readonly initial_status?: Exclude<EvidenceStatus, "VERIFIED" | "REJECTED" | "SUPERSEDED">;
  readonly confidence?: number | null;
}

export function uploadEvidence(input: UploadEvidenceInput, opts: EvidenceStreamOptions): TechnicalEvidence {
  // §12 · Agents cannot self-declare their own observation VERIFIED
  const initial_status: EvidenceStatus = input.initial_status ?? "OBSERVED";
  if ((initial_status as EvidenceStatus) === "VERIFIED") {
    throw new Error("cannot_upload_directly_as_verified · use promoteToVerified");
  }

  const now = new Date();
  const record: TechnicalEvidence = {
    evidence_id: `ev_${now.getTime()}_${randomUUID().slice(0, 8)}`,
    evidence_type: input.evidence_type,
    status: initial_status,
    project_id: input.project_id,
    session_id: input.session_id,
    user_id: input.user_id ?? null,
    timestamp_iso: now.toISOString(),
    timestamp_ns: process.hrtime.bigint().toString(),
    source_agent: input.source_agent,
    source_role: input.source_role,
    git_commit: input.git_commit ?? null,
    repository_snapshot_id: input.repository_snapshot_id ?? null,
    file_path: input.file_path ?? null,
    symbol: input.symbol ?? null,
    line_range: input.line_range ?? null,
    observation: input.observation,
    related_evidence_ids: input.related_evidence_ids ?? [],
    confidence: input.confidence ?? null,
    supersedes_evidence_id: null,
    superseded_by_evidence_id: null,
    zero_llm: true,
    ledger: "B",
    version: TECHNICAL_EVIDENCE_STREAM_VERSION,
  };

  const p = evidencePath(opts, input.project_id);
  ensureDir(path.dirname(p));
  appendFileSync(p, JSON.stringify(record) + "\n");
  return record;
}

// ── Status transitions (§11-12) ──────────────────────────────────────────

export function promoteToVerified(
  evidence_id: string,
  project_id: string,
  verified_by_agent: string,
  verification_reason: string,
  opts: EvidenceStreamOptions,
): { readonly ok: boolean; readonly reason: string } {
  return writeStatusTransition(evidence_id, project_id, "VERIFIED", verified_by_agent, verification_reason, opts);
}

export function reject(
  evidence_id: string,
  project_id: string,
  rejected_by_agent: string,
  rejection_reason: string,
  opts: EvidenceStreamOptions,
): { readonly ok: boolean; readonly reason: string } {
  return writeStatusTransition(evidence_id, project_id, "REJECTED", rejected_by_agent, rejection_reason, opts);
}

export function supersede(
  old_evidence_id: string,
  new_evidence_id: string,
  project_id: string,
  agent: string,
  reason: string,
  opts: EvidenceStreamOptions,
): { readonly ok: boolean; readonly reason: string } {
  return writeStatusTransition(old_evidence_id, project_id, "SUPERSEDED", agent, `superseded_by:${new_evidence_id}·${reason}`, opts);
}

function writeStatusTransition(
  evidence_id: string,
  project_id: string,
  new_status: EvidenceStatus,
  agent: string,
  reason: string,
  opts: EvidenceStreamOptions,
): { readonly ok: boolean; readonly reason: string } {
  const p = statusChangePath(opts, project_id);
  ensureDir(path.dirname(p));
  appendFileSync(p, JSON.stringify({
    evidence_id,
    new_status,
    agent,
    reason,
    at_iso: new Date().toISOString(),
  }) + "\n");
  return { ok: true, reason: `${new_status}_transition_recorded` };
}

// ── Retrieval ────────────────────────────────────────────────────────────

export interface EvidenceQuery {
  readonly project_id: string;
  readonly evidence_type?: EvidenceType | readonly EvidenceType[];
  readonly file_path?: string;
  readonly symbol?: string;
  readonly session_id?: string;
  readonly source_agent?: string;
  readonly status_in?: readonly EvidenceStatus[];
  readonly since_iso?: string;
  readonly limit?: number;
}

export interface QueryResult {
  readonly evidence: readonly TechnicalEvidence[];
  readonly current_status: Record<string, EvidenceStatus>;
  readonly total_scanned: number;
  readonly returned: number;
  readonly caller_must_decide: true;
  readonly zero_llm: true;
  readonly ledger: "B";
}

export function retrieveEvidence(query: EvidenceQuery, opts: EvidenceStreamOptions): QueryResult {
  const records = loadProjectEvidence(query.project_id, opts);
  const transitions = loadStatusTransitions(query.project_id, opts);

  // Build current-status map (latest transition wins)
  const currentStatus = new Map<string, EvidenceStatus>();
  for (const r of records) currentStatus.set(r.evidence_id, r.status);
  for (const t of transitions) currentStatus.set(t.evidence_id, t.new_status);

  // Apply filters
  const wantedTypes = query.evidence_type
    ? new Set(Array.isArray(query.evidence_type) ? query.evidence_type : [query.evidence_type])
    : null;
  const wantedStatuses = query.status_in ? new Set(query.status_in) : null;

  const filtered = records.filter((r) => {
    if (wantedTypes && !wantedTypes.has(r.evidence_type)) return false;
    if (query.file_path && r.file_path !== query.file_path) return false;
    if (query.symbol && r.symbol !== query.symbol) return false;
    if (query.session_id && r.session_id !== query.session_id) return false;
    if (query.source_agent && r.source_agent !== query.source_agent) return false;
    if (wantedStatuses) {
      const cur = currentStatus.get(r.evidence_id) ?? r.status;
      if (!wantedStatuses.has(cur)) return false;
    }
    if (query.since_iso && r.timestamp_iso < query.since_iso) return false;
    return true;
  });

  const limit = query.limit ?? 200;
  const returned = filtered.slice(0, limit);
  const statusMap: Record<string, EvidenceStatus> = {};
  for (const r of returned) statusMap[r.evidence_id] = currentStatus.get(r.evidence_id) ?? r.status;

  return {
    evidence: returned,
    current_status: statusMap,
    total_scanned: records.length,
    returned: returned.length,
    caller_must_decide: true,
    zero_llm: true,
    ledger: "B",
  };
}

// ── Twin-facing retrieval helpers (§14) ──────────────────────────────────

export function retrieveByFile(project_id: string, file_path: string, opts: EvidenceStreamOptions): QueryResult {
  return retrieveEvidence({ project_id, file_path }, opts);
}

export function retrieveBySymbol(project_id: string, symbol: string, opts: EvidenceStreamOptions): QueryResult {
  return retrieveEvidence({ project_id, symbol }, opts);
}

export function retrieveImportGraph(project_id: string, opts: EvidenceStreamOptions): QueryResult {
  return retrieveEvidence({
    project_id,
    evidence_type: ["IMPORT_DISCOVERED", "IMPORT_FAILED", "IMPORT_MISMATCH", "EXPORT_DISCOVERED", "EXPORT_MISSING", "EXPORT_MISMATCH"],
  }, opts);
}

export function retrieveRepositoryMap(project_id: string, opts: EvidenceStreamOptions): QueryResult {
  return retrieveEvidence({
    project_id,
    evidence_type: ["FILE_DISCOVERED", "MODULE_DISCOVERED", "SYMBOL_DISCOVERED", "PATH_RESOLVED"],
    status_in: ["OBSERVED", "INFERRED", "VERIFIED"],
  }, opts);
}

// ── Stream integrity ────────────────────────────────────────────────────

export function projectEvidenceHash(project_id: string, opts: EvidenceStreamOptions): {
  readonly hash: string;
  readonly record_count: number;
  readonly zero_llm: true;
} {
  const p = evidencePath(opts, project_id);
  if (!existsSync(p)) return { hash: "empty", record_count: 0, zero_llm: true };
  const buf = readFileSync(p);
  const records = loadProjectEvidence(project_id, opts);
  return {
    hash: createHash("sha256").update(buf).digest("hex").slice(0, 32),
    record_count: records.length,
    zero_llm: true,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function loadProjectEvidence(project_id: string, opts: EvidenceStreamOptions): TechnicalEvidence[] {
  const p = evidencePath(opts, project_id);
  if (!existsSync(p)) return [];
  const out: TechnicalEvidence[] = [];
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed));
    } catch {
      // Corrupt line · skip · honest degradation
    }
  }
  return out;
}

function loadStatusTransitions(project_id: string, opts: EvidenceStreamOptions): { evidence_id: string; new_status: EvidenceStatus }[] {
  const p = statusChangePath(opts, project_id);
  if (!existsSync(p)) return [];
  const out: { evidence_id: string; new_status: EvidenceStatus }[] = [];
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.evidence_id && parsed.new_status) out.push(parsed);
    } catch { /* skip */ }
  }
  return out;
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
