// src/lib/nex/preview/preview-config.ts
//
// Stage 5 · isolated preview environment configuration.
//
// Discipline (founder-locked · not a feature flag alone):
//   1. Isolated build artifact required · not a query-string flip
//   2. Preview URL includes both capability_id AND version → 404 on mismatch
//   3. Feature flag is a SECONDARY emergency-revert layer · never the sole gate
//   4. Only preview-eligible lifecycle states resolve at all
//   5. ACTIVE revisions never render at /preview/* · they render at their live path

import type { LifecycleState } from "../section-build";

/**
 * Lifecycle states that are eligible for preview rendering.
 * ACTIVE is deliberately excluded — active revisions render at their live path,
 * not the preview path. REVERTED / DISABLED / REJECTED never preview either.
 */
export const PREVIEW_ELIGIBLE_STATES: readonly LifecycleState[] = [
  "AWAITING_PREVIEW",
  "IN_REVIEW",
  "REQUEST_UPDATE",
  "APPROVED",
  "ACTIVATING",
];

/**
 * Standard preview URL segments. `/preview/CAP-091/v1.0.0`
 */
export const PREVIEW_PATH_PREFIX = "/preview";

export interface PreviewRouteParams {
  readonly capability: string;
  readonly revision: string;
}

/**
 * Result of a preview URL resolution attempt.
 * `null` on any invalid param / non-preview state / missing revision.
 */
export type PreviewResolution =
  | { readonly ok: true;  readonly revisionId: string; readonly capabilityId: string; readonly version: string; readonly state: LifecycleState }
  | { readonly ok: false; readonly reason: string };

/**
 * Emergency-revert flag scope.
 *   - `capability` — hide every preview of a capability
 *   - `revision` — hide only the specific revision (fine-grained)
 *   - `global` — hide every preview surface (nuclear · founder-only)
 */
export type EmergencyFlagScope =
  | { readonly kind: "capability"; readonly capabilityId: string }
  | { readonly kind: "revision"; readonly revisionId: string }
  | { readonly kind: "global" };

export interface EmergencyFlag {
  readonly scope: EmergencyFlagScope;
  readonly reason: string;
  readonly signedBy: string;         // founder session token
  readonly signedAt: string;         // ISO timestamp
}
