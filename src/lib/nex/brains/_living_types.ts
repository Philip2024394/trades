// src/lib/nex/brains/_living_types.ts
//
// TypeScript types matching the Living Trade Brains Supabase schema
// (ADR-0037). Loader / writer / API routes / UI all reference these.
//
// The existing _types.ts stays untouched — it defines the runtime
// BrainPack + LoadedBrain shapes. This file defines the ADDITIONAL
// Supabase-canonical model layered on top.

// ---------- Brain (was Registry — renamed per Philip 2026-07-28) ----------

/** Workflow status per ADR-0017 authoring pipeline. */
export type BrainStatus =
  | "draft"          // Author writing · not queryable
  | "author_review"  // Author submitted · Nex review
  | "advisory_panel" // With merchant advisory panel
  | "published"      // Live · queryable
  | "retired";       // Superseded by newer version

/**
 * Product lifecycle stage per Philip 2026-07-28. ORTHOGONAL to `status`:
 * a brain can be `status: published` but still `lifecycle_stage: beta`.
 */
export type BrainLifecycleStage =
  | "draft"
  | "internal"
  | "beta"
  | "production"
  | "deprecated"
  | "archived";

export type BrainCategory =
  | "trade"
  | "business"
  | "regulatory"
  | "product"
  | "industry"
  | "specialist";

/**
 * Certification level per Philip 2026-07-28. Named expertise creates
 * trust — the runtime UI shows this on every brain card + answer.
 */
export type BrainCertificationLevel =
  | "uncertified"
  | "self_certified"
  | "peer_reviewed"
  | "board_certified"
  | "industry_body_certified";

/**
 * Capability flags per Philip 2026-07-28. Structured JSON — new flags
 * can be added without a schema change. UI + runtime gate feature
 * exposure per brain from these flags.
 */
export type BrainCapabilities = {
  supports_chat:        boolean;
  supports_vision:      boolean;
  supports_voice:       boolean;
  supports_estimates:   boolean;
  supports_projects:    boolean;
  supports_marketplace: boolean;
  supports_memory:      boolean;
  supports_simulation:  boolean;
  [extension: string]:  boolean;
};

export type ReadinessScore = {
  knowledge: number;      // 0..100
  coverage: number;
  testing: number;
  author_review: number;
  freshness: number;
  confidence: number;
  overall: number;        // weighted mean
};

/**
 * Brain Promise · Philip 2026-07-28. Structured commitments to users.
 * Shown by every answer surface via the "About this brain" affordance.
 */
export type BrainPromise = {
  will_do: string[];
  will_not_do: string[];
};

/** Table row for hammerex_nex_brains (renamed from hammerex_nex_brain_registry). */
export type BrainRow = {
  // Identity
  slug: string;
  namespace: string;
  display_name: string;
  description: string | null;
  category: BrainCategory;
  trade: string | null;

  // Ownership
  owner_id: string | null;
  origin_org: string | null;
  primary_author_id: string | null;
  primary_author_name: string | null;
  primary_author_creds: string | null;
  maintainers: string[];

  // Localisation
  primary_country: string | null;
  supported_countries: string[];
  supported_regions: string[] | null;
  primary_language: string;
  languages: string[];

  // Workflow + lifecycle (orthogonal)
  status: BrainStatus;
  lifecycle_stage: BrainLifecycleStage;
  certification_level: BrainCertificationLevel;

  // Current-version pointer
  current_version_id: string | null;

  // Capability flags
  capabilities: BrainCapabilities;

  // Health / quality
  quality_score: number | null;
  readiness_score_json: ReadinessScore | null;
  confidence: number | null;
  coverage: number | null;
  last_review_at: string | null;
  review_frequency_days: number;

  // Brain Package portability
  package_id: string | null;
  installed_from_source: string | null;
  exportable: boolean;

  // Constitutional identity (Philip 2026-07-28 · Mission + Principles + Promise HARD LAW)
  mission: string | null;
  principles: string[];
  promise: BrainPromise;

  // Free-form
  metadata: Record<string, unknown>;

  // Timestamps
  created_at: string;
  updated_at: string;
};

// ---------- Version ----------

export type BrainVersionRow = {
  id: string;
  brain_slug: string;
  version_semver: string;
  manifest_json: Record<string, unknown>;
  modules_json: Record<string, unknown>;
  authored_by: string;
  authored_at: string;
  published_at: string | null;
  published_by: string | null;
  superseded_by: string | null;
  retired_at: string | null;
  retire_reason: string | null;
  readiness_score_json: ReadinessScore | null;
  regression_result_json: Record<string, unknown> | null;

  // Compatibility matrix (Philip 2026-07-28 · future insurance)
  brain_api_version: string;            // e.g. "1.0" · "2.0"
  minimum_runtime_version: string;      // e.g. "1.0" · "4.0"
  current_runtime_version: string | null; // runtime that published this version

  // Brain Package portability (Philip 2026-07-28 — schema laid now, wired later)
  package_checksum: string | null;
  package_signature: string | null;
  package_public_key_ref: string | null;
  package_manifest_json: BrainPackageManifest | null;
  portable: boolean;
  imported_from_package_id: string | null;

  metadata: Record<string, unknown>;
  created_at: string;
};

/**
 * Brain Package portable manifest — accompanies signed exported
 * packages. Enables verification without hitting the origin server.
 * Schema-only in Phase 1; package export / verify / install ships
 * in a later phase.
 */
export type BrainPackageManifest = {
  package_id:        string;              // globally-unique UUID
  brain_namespace:   string;              // e.g. "australia-guild/staircase-au"
  brain_slug:        string;
  version_semver:    string;
  issuer:            string;              // publishing org
  issued_at:         string;              // ISO
  valid_until:       string | null;
  license:           string | null;       // SPDX identifier
  supported_countries: string[];
  supported_languages: string[];
  capabilities:      Partial<BrainCapabilities>;
  dependencies:      Array<{
    child_brain_namespace: string;
    min_semver: string;
    relationship: BrainDependencyRelationship;
  }>;
  content_checksum:  string;              // sha256 of canonicalised content
  signature_algo:    "ed25519" | "rsa-sha256";
};

// ---------- Draft ----------

export type BrainDraftStatus =
  | "editing"
  | "submitted_for_review"
  | "changes_requested"
  | "approved"
  | "rejected";

export type BrainDraftRow = {
  id: string;
  brain_slug: string;
  author_id: string;
  based_on_version_id: string | null;
  proposed_semver: string | null;
  manifest_json: Record<string, unknown>;
  modules_json: Record<string, unknown>;
  status: BrainDraftStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

// ---------- Certification ----------

export type BrainCertificationStatus = "active" | "expired" | "revoked";

export type BrainCertificationRow = {
  id: string;
  brain_slug: string;
  author_id: string;
  author_name: string;
  credentials_text: string;
  years_experience: number | null;
  certified_by: string | null;
  certified_at: string;
  expires_at: string | null;
  review_frequency_days: number;
  is_primary: boolean;
  status: BrainCertificationStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

// ---------- Dependency ----------

export type BrainDependencyRelationship =
  | "depends_on"
  | "extends"
  | "references"
  | "shares_regulations"
  | "shares_materials";

export type BrainDependencyRow = {
  id: string;
  parent_brain_slug: string;
  child_brain_slug: string;
  relationship: BrainDependencyRelationship;
  min_child_semver: string | null;
  added_at: string;
  added_by: string | null;
  removed_at: string | null;
  removed_by: string | null;
  metadata: Record<string, unknown>;
};

// ---------- Answer (Explainability contract) ----------

export type BrainEvidence = {
  kind: "brain_module" | "url" | "regulation" | "material_spec";
  ref: string;
  excerpt?: string;
};

/**
 * Answer classification (Philip 2026-07-28 · Runtime v1 cleaner model):
 *
 *   verified      · Directly supported by published expert content
 *   derived       · Combined from multiple verified published modules
 *   unknown       · No published answer exists in this brain
 *   out_of_scope  · Question belongs to a different brain (e.g. plumbing
 *                   question asked of staircase brain), or hits a
 *                   published no-answer policy (e.g. "no prices" HARD LAW)
 *
 * Runtime NEVER answers from LLM training data. If none of the four apply,
 * default to `unknown`. Ambiguous or beginner-worded questions that map
 * to a published term after intent resolution ARE `verified`.
 */
export type BrainAnswerKind =
  | "verified"
  | "derived"
  | "unknown"
  | "out_of_scope";

/**
 * The Explainability contract that every Brain surface MUST return
 * (ADR-0037). Also the shape written to hammerex_nex_brain_answers.
 */
export type BrainAnswerEnvelope = {
  answer: string;
  evidence: BrainEvidence[];
  trade_rule: string | null;
  reason: string;
  confidence: number;              // 0..1
  brain_slug: string;
  brain_version: string;
  brain_version_id: string;
  answered_at: string;             // ISO
  answer_kind: BrainAnswerKind;
};

export type BrainAnswerRow = BrainAnswerEnvelope & {
  id: string;
  query_text: string;
  query_hash: string;
  answered_by_channel: "api" | "chat" | "web" | "mobile" | "admin_preview";
  user_id_hash: string | null;
  session_hash: string | null;
  metadata: Record<string, unknown>;
};

// ---------- Field Outcome ----------

export type BrainFieldOutcomeKind =
  | "prediction_vs_actual"
  | "duration_variance"
  | "cost_variance"
  | "customer_satisfaction"
  | "defect_rate"
  | "rework_required";

export type BrainFieldOutcomeRow = {
  id: string;
  brain_answer_id: string | null;
  brain_slug: string;
  brain_version_id: string;
  outcome_kind: BrainFieldOutcomeKind;
  predicted_value_json: unknown;
  actual_value_json: unknown;
  variance_json: unknown;
  correct: boolean | null;
  confidence_before: number | null;
  confidence_after: number | null;
  merchant_slug: string | null;
  region_code: string | null;
  reported_by: string | null;
  reported_at: string;
  processed_at: string | null;
  metadata: Record<string, unknown>;
};

// ---------- Review Action ----------

export type BrainReviewActionKind =
  | "approve"
  | "reject"
  | "request_changes"
  | "comment"
  | "assign"
  | "reassign";

export type BrainReviewActionRow = {
  id: string;
  brain_slug: string;
  draft_id: string | null;
  action: BrainReviewActionKind;
  reviewer_id: string;
  reviewer_role: "admin" | "advisory_panel" | "peer_author" | "automated_regression";
  notes: string | null;
  ref_version_id: string | null;
  occurred_at: string;
  metadata: Record<string, unknown>;
};

// ---------- D1 · NEX Users + Sessions (Philip 2026-07-28) ----------

export type NexUserRole = "author" | "reviewer" | "admin" | "system" | "runtime";
export type NexUserStatus = "active" | "suspended" | "invited" | "revoked";

/**
 * Per-brain permission map (Philip 2026-07-28 D1 Turn 3 shape).
 * Keyed by brain_slug; each value is a flag object per action.
 *
 * Example:
 *   {
 *     "staircase": { "author": true, "review": true, "publish": true },
 *     "plumbing":  { "author": false, "review": false, "publish": false }
 *   }
 *
 * Explicit true/false wins over role default. Undefined flags fall back
 * to role-based default (admin can do all · reviewer can review + author
 * · author can author only).
 */
export type BrainPermissionFlags = Partial<{
  author: boolean;
  review: boolean;
  publish: boolean;
  rollback: boolean;
  edit_identity: boolean;
}>;

export type NexBrainPermissions = Record<string, BrainPermissionFlags>;

export type NexUserRow = {
  id: string;
  supabase_user_id: string;
  email: string;
  display_name: string;
  role: NexUserRole;
  status: NexUserStatus;
  qualifications: Record<string, unknown>;
  brain_permissions: NexBrainPermissions;
  organisation: string | null;
  approved_by: string | null;
  verified_at: string | null;
  verified_by: string | null;
  last_review_at: string | null;
  last_login_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type NexSessionRow = {
  id: string;
  user_id: string;
  supabase_session_id: string | null;
  login_at: string;
  last_seen: string;
  logout_at: string | null;
  ip: string | null;
  user_agent: string | null;
  device_name: string | null;
  mfa_used: boolean;
  revoked_at: string | null;
  revoke_reason: string | null;
  metadata: Record<string, unknown>;
};

// ---------- Generic Event Log ----------

export type NexEventRow = {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  actor_id: string | null;
  actor_role: string | null;
  before_json: unknown;
  after_json: unknown;
  metadata: Record<string, unknown>;
  occurred_at: string;
};

/**
 * Event-type constants for the Living Brain domain. Add new constants
 * here as more mutations are wired. This is a naming convention, not
 * a hard schema constraint — the DB accepts any string.
 */
export const BRAIN_EVENT_TYPES = {
  BRAIN_CREATED: "brain_created",
  BRAIN_LIFECYCLE_CHANGED: "brain_lifecycle_changed",
  BRAIN_CAPABILITY_TOGGLED: "brain_capability_toggled",
  DRAFT_SAVED: "brain_draft_saved",
  DRAFT_SUBMITTED_FOR_REVIEW: "brain_submitted_for_review",
  DRAFT_APPROVED: "brain_approved",
  DRAFT_REJECTED: "brain_rejected",
  DRAFT_CHANGES_REQUESTED: "brain_changes_requested",
  VERSION_PUBLISHED: "brain_version_published",
  ROLLED_BACK: "brain_rolled_back",
  RETIRED: "brain_version_retired",
  DEPENDENCY_ADDED: "brain_dependency_added",
  DEPENDENCY_REMOVED: "brain_dependency_removed",
  CERTIFICATION_ADDED: "brain_certification_added",
  CERTIFICATION_RENEWED: "brain_certification_renewed",
  CERTIFICATION_REVOKED: "brain_certification_revoked",
  READINESS_RECOMPUTED: "brain_readiness_recomputed",
  ANSWER_LOW_CONFIDENCE: "brain_answer_low_confidence",
  OUTCOME_RECORDED: "brain_outcome_recorded",
  // Brain Package events — reserved for future portability phase
  PACKAGE_EXPORTED: "brain_package_exported",
  PACKAGE_IMPORTED: "brain_package_imported",
  PACKAGE_VERIFIED: "brain_package_verified",
  PACKAGE_INSTALLED: "brain_package_installed",
  PACKAGE_UNINSTALLED: "brain_package_uninstalled",
} as const;

export type BrainEventType = typeof BRAIN_EVENT_TYPES[keyof typeof BRAIN_EVENT_TYPES];
