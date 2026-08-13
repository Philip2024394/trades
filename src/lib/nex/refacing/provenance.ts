// provenance.ts — CompositionProvenance types + PR-18 enforcement.
//
// PR-18 LOCKED · load-bearing (architecture memory · Philip 2026-08-12):
//   "NEX composes from the Reference Library. NEX does not invent."
//
// Every design element in a Refacing Case that leaves LOCK MUST trace to a
// specific `image_id` in `images_v3[]`. This is the "banana handrail" rule —
// generative components that don't exist in the reference library are BANNED.
//
// The Case Package includes `composition_provenance[]` recording, for every
// visual element in the composed design, which reference-library image the
// element was drawn from. Cases without complete provenance are schema-rejected.

import type { ComponentRole } from "./image-schema";

/**
 * A single provenance record — one design element traced to its source.
 */
export type CompositionProvenanceEntry = {
  component_role: ComponentRole;
  image_id: string;
  source: "reference_library";
};

/**
 * The provenance array attached to a Refacing Case at LOCK.
 * MUST cover every visual element in the composed design.
 */
export type CompositionProvenance = CompositionProvenanceEntry[];

/**
 * Error thrown when PR-18 provenance validation fails.
 * Message format is deliberately verbose so trades and admin can diagnose
 * the exact provenance gap in a rejected Case.
 */
export class PR18ProvenanceError extends Error {
  constructor(
    public readonly caseId: string | null,
    public readonly missingComponentRoles: ComponentRole[],
    public readonly untraceableEntries: Array<{ component_role: string; image_id: string }>
  ) {
    const parts: string[] = [];
    if (missingComponentRoles.length > 0) {
      parts.push(
        `missing provenance for component roles: ${missingComponentRoles.join(", ")}`
      );
    }
    if (untraceableEntries.length > 0) {
      parts.push(
        `untraceable entries: ${untraceableEntries
          .map((e) => `${e.component_role}→${e.image_id}`)
          .join(", ")}`
      );
    }
    super(
      `PR-18 violation${caseId ? ` on Case ${caseId}` : ""} · ${parts.join(" · ")}`
    );
    this.name = "PR18ProvenanceError";
  }
}

/**
 * Validate that a proposed Refacing Case composition includes provenance for
 * every claimed component role, and that every provenance entry points to a
 * known `image_id` in the reference library.
 *
 * @param caseId Refacing Case ID (for error messages · nullable during draft)
 * @param claimedComponentRoles Set of component roles the design claims to include
 * @param provenance CompositionProvenance array attached to the Case
 * @param knownImageIds Set of image_id values currently present in images_v3[]
 * @throws PR18ProvenanceError if any component role lacks provenance OR any
 *         provenance entry points to an unknown image_id
 */
export function validateCompositionProvenance(
  caseId: string | null,
  claimedComponentRoles: ComponentRole[],
  provenance: CompositionProvenance,
  knownImageIds: Set<string>
): void {
  // Every claimed component role must have at least one provenance record.
  const rolesInProvenance = new Set(provenance.map((p) => p.component_role));
  const missing = claimedComponentRoles.filter((r) => !rolesInProvenance.has(r));

  // Every provenance record must point to a known image_id.
  const untraceable = provenance.filter((p) => !knownImageIds.has(p.image_id));

  if (missing.length > 0 || untraceable.length > 0) {
    throw new PR18ProvenanceError(caseId, missing, untraceable);
  }
}

/**
 * Non-throwing variant · returns { ok: true } or { ok: false, error }.
 * Convenient for API-boundary code that shapes errors into responses.
 */
export function tryValidateCompositionProvenance(
  caseId: string | null,
  claimedComponentRoles: ComponentRole[],
  provenance: CompositionProvenance,
  knownImageIds: Set<string>
): { ok: true } | { ok: false; error: PR18ProvenanceError } {
  try {
    validateCompositionProvenance(
      caseId,
      claimedComponentRoles,
      provenance,
      knownImageIds
    );
    return { ok: true };
  } catch (err) {
    if (err instanceof PR18ProvenanceError) return { ok: false, error: err };
    throw err;
  }
}
