// StrategyResolver — types.

import type { FrozenBusinessProfileManifest } from "../profile/types";
import type { FrozenGrowthStrategyManifest } from "../strategy/types";
import type { FrozenWebsiteRecipeManifest } from "../recipes/types";

/** Provenance record for one facet — which playbooks contributed. */
export type FacetProvenance = {
  kind: string;
  contributedBy: readonly string[];
  finalValue: Record<string, unknown>;
};

/** The immutable result of one resolution. Facets are exposed as a
 *  typed domain tree (`resolved.gallery.style`, `resolved.pricing.display`)
 *  rather than a flat string map — developers query structured objects. */
export type ResolvedStrategy = {
  /** The registrations that produced this result. */
  readonly inputs: {
    profile: FrozenBusinessProfileManifest;
    strategy: FrozenGrowthStrategyManifest;
    recipe: FrozenWebsiteRecipeManifest;
  };

  /** Facets grouped by domain — the primary developer-facing surface. */
  readonly domains: Readonly<Record<string, Readonly<Record<string, unknown>>>>;

  /** Provenance for every facet — auditable trace of which playbook
   *  contributed what. */
  readonly provenance: readonly FacetProvenance[];

  /** ISO 8601 timestamp of resolution. */
  readonly resolvedAt: string;

  /** Read a single facet as (domain, field). Returns undefined if not
   *  contributed. */
  get(domain: string, field: string): unknown | undefined;

  /** Read every facet whose kind owner-layer matches. */
  facetsByLayer(layer: number): FacetProvenance[];

  /** Human-readable summary — used for AI describe + dev-tools. */
  describe(): string;
};
