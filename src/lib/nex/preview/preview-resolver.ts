// src/lib/nex/preview/preview-resolver.ts
//
// Stage 5 · resolve /preview/[capability]/[revision] URL parameters to a
// SectionRevision + preview eligibility. Pure function · no DB round trip
// (the caller provides the loader). This keeps the resolver testable
// without a DB.

import type { SectionRevision } from "../section-build";
import {
  PREVIEW_ELIGIBLE_STATES,
  type PreviewResolution,
  type PreviewRouteParams,
} from "./preview-config";

const CAPABILITY_RE = /^CAP-\d+$/;
const VERSION_RE = /^v\d+\.\d+\.\d+$/;

/**
 * Validate URL params are shaped correctly. Does NOT hit any DB.
 */
export function validatePreviewParams(
  params: PreviewRouteParams,
): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
  if (!CAPABILITY_RE.test(params.capability)) {
    return { ok: false, reason: `Invalid capability "${params.capability}" · must match CAP-XXX` };
  }
  if (!VERSION_RE.test(params.revision)) {
    return { ok: false, reason: `Invalid version "${params.revision}" · must match vX.Y.Z` };
  }
  return { ok: true };
}

/**
 * Given a resolved SectionRevision · determine whether it may be shown at /preview/*.
 * Returns `ok=true` only if the state is preview-eligible.
 */
export function resolvePreviewFromRevision(
  revision: SectionRevision | null,
  params: PreviewRouteParams,
): PreviewResolution {
  const validation = validatePreviewParams(params);
  if (!validation.ok) return { ok: false, reason: validation.reason };
  if (!revision) {
    return { ok: false, reason: `Revision ${params.capability} ${params.revision} not found` };
  }
  if (revision.capability_id !== params.capability) {
    return { ok: false, reason: `Capability mismatch · URL=${params.capability} DB=${revision.capability_id}` };
  }
  if (revision.version !== params.revision) {
    return { ok: false, reason: `Version mismatch · URL=${params.revision} DB=${revision.version}` };
  }
  if (!PREVIEW_ELIGIBLE_STATES.includes(revision.lifecycle_state)) {
    return {
      ok: false,
      reason: `State ${revision.lifecycle_state} is not preview-eligible · allowed: ${PREVIEW_ELIGIBLE_STATES.join(", ")}`,
    };
  }
  return {
    ok: true,
    revisionId: revision.revision_id,
    capabilityId: revision.capability_id,
    version: revision.version,
    state: revision.lifecycle_state,
  };
}

/**
 * Compose a preview URL for a revision. Falls back to null if inputs invalid.
 */
export function composePreviewUrl(capabilityId: string, version: string): string | null {
  if (!CAPABILITY_RE.test(capabilityId)) return null;
  if (!VERSION_RE.test(version)) return null;
  return `/preview/${capabilityId}/${version}`;
}
