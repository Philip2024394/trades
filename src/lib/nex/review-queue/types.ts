// src/lib/nex/review-queue/types.ts
//
// Stage 6 · founder review queue types.

import type { LifecycleState } from "../section-build";

/**
 * Row shape for the review queue as consumed by /nex-head-quarters/review.
 * Reads from nex.section_revision + capability metadata + build_artifact.
 */
export interface ReviewQueueRow {
  readonly revisionId: string;
  readonly capabilityId: string;
  readonly capabilityTitle: string;      // from docs/nex-work-map.json
  readonly version: string;
  readonly parentVersion: string | null;
  readonly lifecycleState: LifecycleState;
  readonly submittedAt: string;
  readonly agentId: string;
  readonly artifactId: string;
  readonly filesCount: number;
  readonly totalBytes: number;
  readonly testsPassed: number;
  readonly testsTotal: number;
  readonly guardianVerdict: "ACCEPT" | "REJECT" | "PENDING" | null;
  readonly uiDnaVerdict: "PASS" | "FAIL" | "PENDING" | null;
  readonly changeRequestId: string | null;
  readonly previewUrl: string | null;    // null when not preview-eligible
}

/**
 * Input shape for founder-typed change request on a CAP card.
 * Attached manifest IDs reference nex-image-manifest entries.
 */
export interface ChangeRequestInput {
  readonly targetCapabilityId: string;
  readonly targetRevisionId: string;
  readonly founderMessage: string;
  readonly attachedManifestIds: readonly string[];
  readonly founderSignature: string;
}

/**
 * Validation result for a change-request submission.
 */
export type ChangeRequestValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string; readonly code: string };
