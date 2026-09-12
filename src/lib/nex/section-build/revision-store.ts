// src/lib/nex/section-build/revision-store.ts
//
// Stage 3 · read/write library for build artifacts + section revisions +
// change requests. Backed by nex.build_artifact / nex.section_revision /
// nex.change_request tables from stage-3-build-revision-substrate.sql.
//
// Discipline:
//   - Build artifacts are IMMUTABLE. UPDATE raises exception (trigger).
//   - Revisions cannot skip lifecycle states arbitrarily · state-machine
//     validation happens in the writer.
//   - No mutation of Work Map / file-capability-map / locked-doctrines.
//   - Every write requires a valid agent_id (audit provenance).
//
// This module uses `pg` directly. It is safe to import from server-side
// code only · never from the client bundle.

import type { Pool } from "pg";
import type {
  ArtifactFile,
  BuildArtifact,
  ChangeRequest,
  LifecycleState,
  SectionRevision,
} from "./types";
import { hashArtifact } from "./content-hash";

/**
 * Create a new build artifact. Returns the persisted row.
 *
 * Content hash is computed deterministically from the sorted file list.
 * If an artifact with the same content_hash already exists · it is
 * returned unchanged (idempotent · never duplicated).
 */
export async function createBuildArtifact(
  pool: Pool,
  input: {
    files: readonly ArtifactFile[];
    createdByAgentId: string;
    securityRunId?: string | null;
    testsPassed?: number;
    testsTotal?: number;
    guardianVerdict?: BuildArtifact["guardian_verdict"];
    truthEngineOk?: boolean | null;
    uiDnaVerdict?: BuildArtifact["ui_dna_verdict"];
    notes?: string | null;
  },
): Promise<BuildArtifact> {
  const contentHash = hashArtifact(input.files);
  const filesCount = input.files.length;
  const totalBytes = input.files.reduce((s, f) => s + f.size, 0);
  const testsPassed = input.testsPassed ?? 0;
  const testsTotal = input.testsTotal ?? 0;

  // Idempotency: check if already exists by content_hash
  const existing = await pool.query<BuildArtifact>(
    `SELECT artifact_id, content_hash, created_at, created_by_agent_id, security_run_id,
            files_included, files_count, total_bytes, tests_passed, tests_total,
            guardian_verdict, truth_engine_ok, ui_dna_verdict, notes
     FROM nex.build_artifact WHERE content_hash = $1`,
    [contentHash],
  );
  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const inserted = await pool.query<BuildArtifact>(
    `INSERT INTO nex.build_artifact
      (content_hash, created_by_agent_id, security_run_id, files_included,
       files_count, total_bytes, tests_passed, tests_total,
       guardian_verdict, truth_engine_ok, ui_dna_verdict, notes)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING artifact_id, content_hash, created_at, created_by_agent_id, security_run_id,
               files_included, files_count, total_bytes, tests_passed, tests_total,
               guardian_verdict, truth_engine_ok, ui_dna_verdict, notes`,
    [
      contentHash,
      input.createdByAgentId,
      input.securityRunId ?? null,
      JSON.stringify(input.files),
      filesCount,
      totalBytes,
      testsPassed,
      testsTotal,
      input.guardianVerdict ?? null,
      input.truthEngineOk ?? null,
      input.uiDnaVerdict ?? null,
      input.notes ?? null,
    ],
  );
  return inserted.rows[0];
}

/**
 * Legal state transitions (ADR-0316b §6 · state machine v2 per ADR-0316c §9).
 * Rejects illegal transitions before hitting the DB.
 */
const LEGAL_TRANSITIONS: Readonly<Record<LifecycleState, readonly LifecycleState[]>> = {
  BUILDING: ["TESTING", "REJECTED"],
  TESTING: ["AWAITING_PREVIEW", "BUILDING", "REJECTED"], // back to BUILDING on failed tests
  AWAITING_PREVIEW: ["IN_REVIEW", "REJECTED"],
  IN_REVIEW: ["REQUEST_UPDATE", "APPROVED", "REJECTED"],
  REQUEST_UPDATE: ["BUILDING"], // new revision spawns
  REJECTED: ["BUILDING"], // may return to build queue if founder decides
  APPROVED: ["ACTIVATING"],
  ACTIVATING: ["ACTIVE", "REJECTED"],
  ACTIVE: ["REVERTED", "DISABLED"],
  REVERTED: [],
  DISABLED: ["ACTIVE"],
};

export function isLegalTransition(from: LifecycleState, to: LifecycleState): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}

/**
 * Create a new section revision. Enforces:
 *   - capability_id + version uniqueness (via DB constraint)
 *   - version is a valid semver
 *   - parent_revision_id (if provided) exists and belongs to same capability
 */
export async function createSectionRevision(
  pool: Pool,
  input: {
    capabilityId: string;
    version: string;
    parentRevisionId?: string | null;
    artifactId: string;
    changeRequestId?: string | null;
    lifecycleState?: LifecycleState;
    createdByAgentId: string;
  },
): Promise<SectionRevision> {
  const state = input.lifecycleState ?? "BUILDING";
  if (input.parentRevisionId) {
    const parent = await pool.query<{ capability_id: string }>(
      `SELECT capability_id FROM nex.section_revision WHERE revision_id = $1`,
      [input.parentRevisionId],
    );
    if (parent.rows.length === 0) {
      throw new Error(`Parent revision ${input.parentRevisionId} not found`);
    }
    if (parent.rows[0].capability_id !== input.capabilityId) {
      throw new Error(
        `Parent revision belongs to capability ${parent.rows[0].capability_id} · not ${input.capabilityId}`,
      );
    }
  }

  const inserted = await pool.query<SectionRevision>(
    `INSERT INTO nex.section_revision
      (capability_id, version, parent_revision_id, artifact_id, change_request_id,
       lifecycle_state, created_by_agent_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING revision_id, capability_id, version, parent_revision_id, artifact_id,
               change_request_id, lifecycle_state, created_at, created_by_agent_id,
               founder_approval_at, founder_signature, live_at, reverted_at`,
    [
      input.capabilityId,
      input.version,
      input.parentRevisionId ?? null,
      input.artifactId,
      input.changeRequestId ?? null,
      state,
      input.createdByAgentId,
    ],
  );
  return inserted.rows[0];
}

/**
 * Transition a revision to a new lifecycle state. Validates the transition
 * is legal before writing. Founder-signature-required transitions
 * (APPROVED · ACTIVATING · ACTIVE · REVERTED · DISABLED) require a
 * `founderSignature` argument · null-signature transitions to these states
 * are rejected.
 */
export async function transitionRevision(
  pool: Pool,
  input: {
    revisionId: string;
    newState: LifecycleState;
    founderSignature?: string | null;
  },
): Promise<SectionRevision> {
  const current = await pool.query<{ lifecycle_state: LifecycleState }>(
    `SELECT lifecycle_state FROM nex.section_revision WHERE revision_id = $1`,
    [input.revisionId],
  );
  if (current.rows.length === 0) {
    throw new Error(`Revision ${input.revisionId} not found`);
  }
  const from = current.rows[0].lifecycle_state;
  if (!isLegalTransition(from, input.newState)) {
    throw new Error(`Illegal transition ${from} → ${input.newState}`);
  }
  const founderRequired: readonly LifecycleState[] = [
    "APPROVED",
    "ACTIVATING",
    "ACTIVE",
    "REVERTED",
    "DISABLED",
  ];
  if (founderRequired.includes(input.newState) && !input.founderSignature) {
    throw new Error(
      `Transition to ${input.newState} requires founder_signature (founder-only action)`,
    );
  }

  const setFields: string[] = ["lifecycle_state = $2"];
  const params: unknown[] = [input.revisionId, input.newState];
  if (input.founderSignature) {
    params.push(input.founderSignature);
    setFields.push(`founder_signature = $${params.length}`);
    if (input.newState === "APPROVED") {
      setFields.push(`founder_approval_at = now()`);
    }
    if (input.newState === "ACTIVE") {
      setFields.push(`live_at = now()`);
    }
    if (input.newState === "REVERTED") {
      setFields.push(`reverted_at = now()`);
    }
  }

  const updated = await pool.query<SectionRevision>(
    `UPDATE nex.section_revision
       SET ${setFields.join(", ")}
     WHERE revision_id = $1
     RETURNING revision_id, capability_id, version, parent_revision_id, artifact_id,
               change_request_id, lifecycle_state, created_at, created_by_agent_id,
               founder_approval_at, founder_signature, live_at, reverted_at`,
    params,
  );
  return updated.rows[0];
}

/**
 * Create a new change request. Every request spawns a new revision (per
 * ADR-0316c §4.1). This function creates the row only · the writer of
 * the resulting revision is responsible for wiring `spawned_revision_id`.
 */
export async function createChangeRequest(
  pool: Pool,
  input: {
    targetCapabilityId: string;
    targetRevisionId: string;
    founderMessage: string;
    founderSignature: string;
    attachedManifestIds?: readonly string[];
  },
): Promise<ChangeRequest> {
  const inserted = await pool.query<ChangeRequest>(
    `INSERT INTO nex.change_request
       (target_capability_id, target_revision_id, founder_message,
        founder_signature, attached_manifest_ids)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING change_request_id, target_capability_id, target_revision_id, founder_message,
               attached_manifest_ids, submitted_at, founder_signature, spawned_revision_id`,
    [
      input.targetCapabilityId,
      input.targetRevisionId,
      input.founderMessage,
      input.founderSignature,
      input.attachedManifestIds ?? [],
    ],
  );
  return inserted.rows[0];
}

/**
 * Walk the revision history back to v1.0. Returns oldest-first.
 */
export async function walkRevisionHistory(
  pool: Pool,
  revisionId: string,
): Promise<readonly SectionRevision[]> {
  const chain: SectionRevision[] = [];
  let currentId: string | null = revisionId;
  while (currentId) {
    const row = await pool.query<SectionRevision>(
      `SELECT revision_id, capability_id, version, parent_revision_id, artifact_id,
              change_request_id, lifecycle_state, created_at, created_by_agent_id,
              founder_approval_at, founder_signature, live_at, reverted_at
       FROM nex.section_revision WHERE revision_id = $1`,
      [currentId],
    );
    if (row.rows.length === 0) break;
    chain.unshift(row.rows[0]);
    currentId = row.rows[0].parent_revision_id;
  }
  return chain;
}

/**
 * Get the current ACTIVE revision of a capability (if any).
 */
export async function getActiveRevision(
  pool: Pool,
  capabilityId: string,
): Promise<SectionRevision | null> {
  const row = await pool.query<SectionRevision>(
    `SELECT revision_id, capability_id, version, parent_revision_id, artifact_id,
            change_request_id, lifecycle_state, created_at, created_by_agent_id,
            founder_approval_at, founder_signature, live_at, reverted_at
     FROM nex.section_revision
     WHERE capability_id = $1 AND lifecycle_state = 'ACTIVE'
     ORDER BY live_at DESC NULLS LAST LIMIT 1`,
    [capabilityId],
  );
  return row.rows[0] ?? null;
}
