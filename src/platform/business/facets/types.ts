// facetKindRegistry — types.
//
// Every facet KIND (e.g. "gallery.style", "pricing.display") registers
// its schema + merge rule here. When new subsystems land (CRM,
// Inventory, Analytics) they register their own facet kinds without
// touching the Playbook code.

export type FacetMergeStrategy =
  /** Later playbook's value wins. Default for scalars. */
  | "override"
  /** Union — collect all contributions (arrays / sets). */
  | "union"
  /** Intersection — keep only values shared across contributions. */
  | "intersection"
  /** Whichever playbook has the highest confidence wins on conflict. */
  | "highest-confidence"
  /** Domain-specific — the facet kind provides its own `merge` fn. */
  | "custom";

/** A single contribution from one playbook to one facet. */
export type FacetContribution = {
  /** Which playbook contributed. */
  playbookId: string;
  /** Raw data payload; shape defined per-kind. */
  data: Record<string, unknown>;
  /** Contribution's confidence (0-100). */
  confidence?: number;
};

/** A resolved facet after the resolver merged contributions. */
export type ResolvedFacet = {
  kind: string;
  /** Final data payload after merge. */
  data: Record<string, unknown>;
  /** Provenance — which playbooks contributed to this facet. */
  contributedBy: readonly string[];
};

export type FacetKindManifest = {
  manifestVersion: 1;
  slug: string;                              // "gallery.style", "pricing.display"
  name: string;
  description: string;
  version: string;

  /** Business OS layer that consumes this facet. */
  ownerLayer: number;

  /** How to merge multiple contributions. */
  mergeStrategy: FacetMergeStrategy;

  /** Only required when mergeStrategy === "custom". */
  mergeFn?: (
    contributions: readonly FacetContribution[]
  ) => Record<string, unknown>;

  /** Optional per-kind validator. Runs on the resolved data. */
  validate?: (resolved: Record<string, unknown>) => void;

  /** Which top-level object the resolved value hangs off of on the
   *  ResolvedStrategy tree. e.g. "gallery" for "gallery.style". */
  domain: string;

  /** Field name inside the domain object. e.g. "style" for "gallery.style". */
  field: string;
};

export type FrozenFacetKindManifest = Readonly<FacetKindManifest>;
