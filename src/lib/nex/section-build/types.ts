// src/lib/nex/section-build/types.ts
//
// Stage 3 of BUILD PLAN v1.1 · types for build artifacts · section revisions ·
// change requests. Mirrors the schemas in db/migrations/stage-3-build-revision-substrate.sql.
//
// All types are PIPELINE substrates · never canonical Knowledge (ADR-0314i §9).

/**
 * 11 lifecycle states per ADR-0316b §6 + DISABLED from three-level intervention.
 */
export type LifecycleState =
  | "BUILDING"
  | "TESTING"
  | "AWAITING_PREVIEW"
  | "IN_REVIEW"
  | "REQUEST_UPDATE"
  | "REJECTED"
  | "APPROVED"
  | "ACTIVATING"
  | "ACTIVE"
  | "REVERTED"
  | "DISABLED";

/**
 * A file included in a build artifact. Path is repo-relative.
 * content_hash is sha256 of the normalized bytes.
 */
export interface ArtifactFile {
  readonly path: string;
  readonly content_hash: string;
  readonly size: number;
}

/**
 * Immutable build snapshot. Never mutated once written.
 * Multiple revisions may share the same artifact (e.g. metadata-only revision).
 */
export interface BuildArtifact {
  readonly artifact_id: string;
  readonly content_hash: string;
  readonly created_at: string;
  readonly created_by_agent_id: string;
  readonly security_run_id: string | null;
  readonly files_included: readonly ArtifactFile[];
  readonly files_count: number;
  readonly total_bytes: number;
  readonly tests_passed: number;
  readonly tests_total: number;
  readonly guardian_verdict: "ACCEPT" | "REJECT" | "PENDING" | null;
  readonly truth_engine_ok: boolean | null;
  readonly ui_dna_verdict: "PASS" | "FAIL" | "PENDING" | null;
  readonly notes: string | null;
}

/**
 * A specific version of a capability. v1.0 → v1.N → ... never overwrites.
 * Parent pointer walks history.
 */
export interface SectionRevision {
  readonly revision_id: string;
  readonly capability_id: string;      // 'CAP-091'
  readonly version: string;             // 'v1.0.0'
  readonly parent_revision_id: string | null;
  readonly artifact_id: string;
  readonly change_request_id: string | null;
  readonly lifecycle_state: LifecycleState;
  readonly created_at: string;
  readonly created_by_agent_id: string;
  readonly founder_approval_at: string | null;
  readonly founder_signature: string | null;
  readonly live_at: string | null;
  readonly reverted_at: string | null;
}

/**
 * Founder-typed change request from a CAP card. Every request spawns
 * a new revision (per ADR-0316c §4.1).
 */
export interface ChangeRequest {
  readonly change_request_id: string;
  readonly target_capability_id: string;
  readonly target_revision_id: string;
  readonly founder_message: string;
  readonly attached_manifest_ids: readonly string[];
  readonly submitted_at: string;
  readonly founder_signature: string;
  readonly spawned_revision_id: string | null;
}

/**
 * Version parts for programmatic comparison and increment.
 */
export interface SemverParts {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}
