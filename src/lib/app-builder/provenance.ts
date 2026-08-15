// NEX App Builder · Provenance classifier (Philip 2026-08-14).
//
// ADR-0028 constitutional rule: NEX must never invent that an asset,
// integration, component or capability exists when it does not.
//
// Every leaf field in an AppBlueprint is classified into one of four
// provenance levels. Workers gate their behaviour on these levels —
// e.g. an INSERT worker refuses to submit if any required field is UNKNOWN,
// a copy-generation worker treats INFERRED style differently from KNOWN.
//
// KNOWN     — Customer stated it explicitly (or it came from a verified source).
//             Workers may treat as authoritative.
// INFERRED  — NEX derived it from context (e.g. picked a hero from the library
//             based on trade taxonomy). Workers may use but must record that
//             it's inferred so the customer sees "we picked X — swap here".
// REQUIRED  — Blueprint declares the field is needed but no value exists yet.
//             Workers must NOT invent. Studio surfaces this as a to-fill.
// UNKNOWN   — Field was never touched. Distinct from REQUIRED — this means
//             the Blueprint doesn't yet care about the field.

import type {
  AppBlueprint,
  ProvenanceLevel,
  ProvenanceMap,
  ProvenanceRecord
} from "./blueprint-schema";

// ============================================================================
// Classifier — inspects a Blueprint and returns a Map with the current status
// of every leaf field. Workers/Studio can use this to decide what to render,
// what to ask, and what to refuse.
// ============================================================================

export type FieldClassification = {
  /** Dotted path — e.g. "identity.contact.primaryEmail" */
  path: string;
  /** Current level from the Blueprint's provenance map, or UNKNOWN if absent. */
  level: ProvenanceLevel;
  /** Value at this path (may be undefined). */
  value: unknown;
  /** Whether this field is required for the app to be considered complete. */
  isRequiredField: boolean;
  /** Original provenance record, if present. */
  record?: ProvenanceRecord;
};

/** Return classification for every leaf path we care about. */
export function classifyBlueprint(bp: AppBlueprint): FieldClassification[] {
  const out: FieldClassification[] = [];
  const seen = new Set<string>();

  for (const spec of REQUIRED_FIELDS) {
    const value = readPath(bp, spec.path);
    const record = bp.provenance[spec.path];
    out.push({
      path: spec.path,
      level: record?.level ?? "UNKNOWN",
      value,
      isRequiredField: spec.required,
      record
    });
    seen.add(spec.path);
  }

  // Also include any provenance-recorded field we didn't list above.
  for (const [path, record] of Object.entries(bp.provenance)) {
    if (seen.has(path)) continue;
    out.push({
      path,
      level: record.level,
      value: readPath(bp, path),
      isRequiredField: false,
      record
    });
  }

  return out;
}

/** Summary counts of each level — used by Studio's readiness indicator. */
export function summariseProvenance(bp: AppBlueprint): Record<ProvenanceLevel, number> & {
  requiredMissing: string[];
} {
  const classes = classifyBlueprint(bp);
  const summary: Record<ProvenanceLevel, number> = {
    KNOWN: 0,
    INFERRED: 0,
    REQUIRED: 0,
    UNKNOWN: 0
  };
  const requiredMissing: string[] = [];
  for (const c of classes) {
    summary[c.level] += 1;
    if (c.isRequiredField && (c.level === "REQUIRED" || c.level === "UNKNOWN")) {
      requiredMissing.push(c.path);
    }
  }
  return { ...summary, requiredMissing };
}

/** Whether the Blueprint is complete enough for workers to run end-to-end. */
export function isBlueprintReadyToBuild(bp: AppBlueprint): {
  ready: boolean;
  blockers: string[];
} {
  const s = summariseProvenance(bp);
  return {
    ready: s.requiredMissing.length === 0,
    blockers: s.requiredMissing
  };
}

// ============================================================================
// Helpers to mutate provenance safely (workers/Studio use these)
// ============================================================================

export function setKnown(
  provenance: ProvenanceMap,
  path: string,
  source: string,
  reason?: string
): ProvenanceMap {
  return { ...provenance, [path]: { level: "KNOWN", source, reason } };
}

export function setInferred(
  provenance: ProvenanceMap,
  path: string,
  source: string,
  confidence: number,
  reason?: string
): ProvenanceMap {
  return {
    ...provenance,
    [path]: { level: "INFERRED", source, confidence, reason }
  };
}

export function setRequired(
  provenance: ProvenanceMap,
  path: string,
  reason?: string
): ProvenanceMap {
  return {
    ...provenance,
    [path]: { level: "REQUIRED", source: "blueprint:required", reason }
  };
}

// ============================================================================
// Required-field registry — the fields workers refuse to proceed without
// ============================================================================

type FieldSpec = { path: string; required: boolean };

const REQUIRED_FIELDS: FieldSpec[] = [
  // Identity
  { path: "identity.displayName", required: true },
  { path: "identity.contact.primaryEmail", required: false },
  { path: "identity.contact.primaryPhone", required: false },
  // Domain
  { path: "domain.primary", required: false },
  // Vertical
  { path: "vertical.taxonomySlug", required: true },
  { path: "vertical.archetype", required: false },
  // Brand
  { path: "brand.palette.primary", required: true },
  { path: "brand.palette.background", required: true },
  { path: "brand.palette.foreground", required: true },
  { path: "brand.typography.headingFamily", required: true },
  { path: "brand.typography.bodyFamily", required: true },
  { path: "brand.toneOfVoice", required: false },
  { path: "brand.logoAssetId", required: false },
  // Pages — at minimum a home page must exist
  { path: "pages.home", required: true },
  // Navigation
  { path: "navigation.primary", required: true },
  // Footer
  { path: "footer.columns", required: true },
  // SEO
  { path: "seo.siteTitleTemplate", required: false },
  { path: "seo.defaultDescription", required: false },
  // Responsive
  { path: "responsive.strategy", required: true }
];

// ============================================================================
// Internal helpers
// ============================================================================

function readPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (Array.isArray(cur)) {
      // "pages.home" — find array item with matching id
      const found = (cur as Array<Record<string, unknown>>).find(
        (item) => item && (item.id === p || item.instanceId === p)
      );
      if (found === undefined) return undefined;
      cur = found;
    } else if (typeof cur === "object") {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return cur;
}
