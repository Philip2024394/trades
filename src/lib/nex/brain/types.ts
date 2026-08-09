// NEX Brain · shared types
//
// Mirror the SQL schema in db/migrations/001_nex_brain_schema.sql.
// Any change here must round-trip against the schema; the storage
// layer is the boundary that hides which backend (filesystem now,
// Supabase later) is doing the persistence.

// ── Records ──────────────────────────────────────────────────────────

export type RecordStatus =
  | "DRAFT"
  | "UNDER_REVIEW"
  | "AUTHORITATIVE"
  | "DEPRECATED"
  | "SUPERSEDED";

export type Audience = "homeowner" | "manufacturer" | "engineer";

export type ClaimClassification =
  | "established_practice"
  | "industry_consensus"
  | "design_opinion"
  | "experimental_concept"
  | "NEX_concept";

export type ConfidenceBand = "high" | "medium" | "low";

export type KnowledgeSource =
  | "chatgpt-approved"
  | "claude-generated"
  | "raw-research"
  | "internet-article"
  | "needs-verification"
  | "gov-standards"
  | "customer-qa"
  | "personal-ideas";

export type KnowledgeRecord = {
  id: string;
  record_id: string;
  record_version: string;
  status: RecordStatus;
  supersedes?: string | null;
  canonical_owner: string;
  authored_by: string;
  authorised_by?: string | null;
  reviewed_by?: string | null;
  title: string;
  category: string;
  subcategory?: string | null;
  summary: string;
  body_markdown: string;
  industry_concepts?: string[];
  nex_concepts?: string[];
  primary_audience: Audience;
  alt_audiences?: Audience[];
  sustainability_alert?: {
    active: boolean;
    severity?: string;
    notes?: string;
  } | null;
  embedding?: number[] | null;
  created_at: string;
  last_reviewed_at?: string | null;
  review_due_at?: string | null;
  deprecated_at?: string | null;
};

// ── Versioning ───────────────────────────────────────────────────────

export type RecordVersion = {
  id: string;
  record_id: string;
  version: string;
  body_markdown: string;
  change_summary?: string | null;
  changed_by: string;
  changed_at: string;
};

// ── Graph ────────────────────────────────────────────────────────────

export type GraphEdge = {
  id: string;
  from_record_id: string;
  to_record_id: string;
  edge_type: string;
  confidence?: number | null;
  provenance?: string | null;
  is_gap_marker: boolean;
  created_at: string;
};

// ── Worker jobs + results ────────────────────────────────────────────

export type WorkerType =
  | "knowledge-context"    // Retrieves related existing records before authoring
  | "voice-context"        // Assembles brand terms + voice guide for the topic
  | "learning-context"     // Retrieves past feedback (approvals, edits, rejections)
  | "knowledge-extractor"  // Authors new drafts from text (with all three bundles)
  | "image-analyst"        // Authors new drafts from images (vision-capable LLM)
  | "quality-checker"      // Gates drafts against the Constitution
  | "memory-guardian";     // Batch auditor

export type JobStatus =
  | "waiting"
  | "assigned"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type WorkerJob = {
  id: string;
  worker_type: WorkerType;
  priority: number;
  status: JobStatus;
  input_kind: string;
  input_ref: string;
  input_payload?: Record<string, unknown> | null;
  assigned_worker_id?: string | null;
  assigned_at?: string | null;
  lease_expires_at?: string | null;
  result_id?: string | null;
  attempts: number;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
};

export type WorkerResult = {
  id: string;
  job_id: string;
  worker_type: WorkerType;
  worker_id: string;
  output_kind: string;
  output_payload: Record<string, unknown>;
  overall_confidence?: number | null;
  llm_provider?: string | null;
  llm_model?: string | null;
  llm_tokens_in?: number | null;
  llm_tokens_out?: number | null;
  llm_ms?: number | null;
  flags?: string[];
  created_at: string;
};

// ── Sources · confidence · contradictions · deprecations ─────────────

export type Source = {
  id: string;
  record_id?: string | null;
  inbox_item_id?: string | null;
  source_tier: KnowledgeSource;
  source_url?: string | null;
  source_hash?: string | null;
  excerpt?: string | null;
  created_at: string;
};

export type ConfidenceScore = {
  id: string;
  record_id: string;
  claim_key: string;
  claim_text: string;
  classification: ClaimClassification;
  confidence_band: ConfidenceBand;
  confidence_score?: number | null;
  source_type?: string | null;
  source_ref?: string | null;
  verification_date?: string | null;
  rationale?: string | null;
  created_at: string;
};

export type Contradiction = {
  id: string;
  record_a_id: string;
  record_b_id: string;
  claim_key_a: string;
  claim_key_b: string;
  contradiction_summary: string;
  status: "open" | "resolved" | "irrelevant";
  resolved_by?: string | null;
  resolution_notes?: string | null;
  resolved_at?: string | null;
  detected_by: string;
  detected_at: string;
};

export type Deprecation = {
  id: string;
  record_id: string;
  superseded_by?: string | null;
  reason: string;
  deprecated_by: string;
  deprecated_at: string;
};

// ── Knowledge feedback (the moat) ────────────────────────────────────
//
// Every human correction, approval, edit, rejection, gap flag, and
// voice-drift observation goes here. This table is NEX's compound
// advantage over time — the specific signal no competitor has.

export type FeedbackKind =
  | "correction"     // NEX was wrong; here's the right answer
  | "approval"       // NEX was right; reinforce the pattern
  | "edit"           // User tweaked NEX's answer
  | "rejection"      // Full reject, no correction offered
  | "gap"            // NEX didn't know; here's what should be known
  | "contradiction"  // NEX contradicted itself across answers
  | "voice_drift";   // NEX said it in the wrong voice

export type FeedbackSeverity = "minor" | "moderate" | "critical";

export type FeedbackSource =
  | "philip"
  | "customer"
  | "worker-audit"
  | "automated-check";

export type KnowledgeFeedback = {
  id: string;
  question?: string | null;
  nex_answer?: string | null;
  correction?: string | null;
  lesson?: string | null;
  record_id?: string | null;
  domain?: string | null;
  topic_tags?: string[];
  feedback_kind: FeedbackKind;
  severity: FeedbackSeverity;
  feedback_source: FeedbackSource;
  submitted_by?: string | null;
  context?: Record<string, unknown> | null;
  applied_to_prompts: boolean;
  applied_at?: string | null;
  triggered_worker_proposal?: string | null;
  resulted_in_record?: string | null;
  created_at: string;
};

// ── Audit log ────────────────────────────────────────────────────────

export type AuditEntry = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor: string;
  before_state?: Record<string, unknown> | null;
  after_state?: Record<string, unknown> | null;
  notes?: string | null;
  created_at: string;
};

// Wave 11 · Phase 5 · W-C-COMPANION Storage contract extension.
// Narrow shape for KnowledgeJob terminal-transition audit writes ·
// entity_type is always "knowledge_jobs" · entity_id is the kjid ·
// action carries the destination status. See
// docs/headquarters-production-readiness/WORLD-CLASS-OPS-W-C-STORAGE-CONTRACT-EXTENSION-DESIGN.md.
//
// KnowledgeJob statuses declared here to keep the BrainStore contract
// self-contained · Brain × NEX Storage F12 AI4 forbids fs-store import.
// Kept aligned with src/lib/nex/jobs/fs-store.ts::JobStatus via KJT-parity
// assertion in adapter-isolation drift-catcher.
export type KnowledgeJobStatus =
  | "received"
  | "queued"
  | "claimed"
  | "processing"
  | "completed"
  | "failed";

export interface KnowledgeJobTransitionAudit {
  knowledge_job_id: string;
  from_status: KnowledgeJobStatus;
  to_status: KnowledgeJobStatus;
  actor: string;
  reason?: string;
  correlation_id?: string;
  worker_job_id?: string;
  metadata?: Record<string, unknown>;
}

// ── LLM retry queue (Stage 3 · production readiness) ────────────────
//
// When every provider in the chain fails, the call metadata lands here.
// A background retry worker drains the queue on the same cadence as
// the other workers.

export type LlmRetryStatus =
  | "pending"
  | "in_flight"
  | "succeeded"
  | "exhausted"
  | "cancelled";

export type LlmRetryEntry = {
  id: string;
  parent_job_id: string | null;
  parent_worker_type: string | null;
  parent_input_ref: string | null;
  call_purpose: string;
  call_options: Record<string, unknown> | null;
  call_messages: Array<{ role: string; content: string }>;
  requires_capability: string | null;
  prefer_provider: string | null;
  attempts: number;
  max_attempts: number;
  next_attempt_at: string;
  last_provider_tried: string | null;
  last_error: string | null;
  status: LlmRetryStatus;
  succeeded_provider: string | null;
  succeeded_at: string | null;
  result_summary: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

// ── Manager status snapshot ──────────────────────────────────────────

export type BrainStatus = {
  backend: "filesystem" | "supabase";
  jobs_waiting: number;
  jobs_in_flight: number;
  jobs_completed_24h: number;
  jobs_failed_24h: number;
  records_authoritative: number;
  records_under_review: number;
  records_draft: number;
  contradictions_open: number;
  gap_markers_open: number;
  llm_tokens_24h: number;
  llm_calls_24h: number;
  feedback_total_lifetime: number;
  feedback_last_7d: number;
  feedback_unapplied: number;
  worker_pool: WorkerPoolHealth[];
};

export type WorkerPoolHealth = {
  worker_type: WorkerType;
  jobs_waiting: number;
  jobs_in_flight: number;
  jobs_completed_24h: number;
  jobs_failed_24h: number;
  last_activity_at?: string | null;
  // Currently-running job (assigned status). Populated when a worker
  // holds a live lease. Null when idle.
  current_job_ref?: string | null;
  current_job_since?: string | null;
  // Timing telemetry over the last 24 hours.
  avg_ms_last_24h?: number | null;
  last_result_summary?: string | null;
};

// ── Cloud worker heartbeat (Phase 5 · always-on cloud runtime) ──────
//
// Written by every running worker process (local script OR Fly.io
// deployment) on a fixed interval. Powers the dashboard's "Cloud
// worker: online" tile — a heartbeat older than 60s means the runtime
// has stopped, crashed, or lost its connection to Supabase.
//
// The primary key is host_id so each running process upserts its own
// row. FLY_MACHINE_ID for Fly deployments; HOSTNAME otherwise.

export type WorkerHeartbeat = {
  host_id: string;
  last_seen_at: string;
  uptime_ms: number;
  cycles_total: number;
  cycles_failed: number;
  last_error: string | null;
  last_cycle_summary: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
};
