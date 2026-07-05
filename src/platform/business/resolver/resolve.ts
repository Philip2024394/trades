// StrategyResolver — the deterministic merge algorithm.
//
// Pure business logic. No I/O. Every consumer (Composer, Dashboard
// Builder, Marketing Builder, SEO Generator, Booking Flow Builder,
// CRM Workflow Generator) uses this same function.

import { facetKindRegistry } from "../facets";
import type { FacetContribution } from "../facets/types";
import { playbookRegistry } from "../playbooks";
import type { PlaybookFacets } from "../playbooks/types";
import type { FrozenBusinessProfileManifest } from "../profile/types";
import type { FrozenGrowthStrategyManifest } from "../strategy/types";
import type { FrozenWebsiteRecipeManifest } from "../recipes/types";
import type { FacetProvenance, ResolvedStrategy } from "./types";

/** Deep-freeze utility. */
function freeze<T>(v: T): T {
  if (v === null || typeof v !== "object") return v;
  for (const k of Object.keys(v as object)) {
    freeze((v as Record<string, unknown>)[k]);
  }
  return Object.freeze(v);
}

/** Merge a set of contributions for one facet kind. */
function mergeContributions(
  kind: string,
  contributions: readonly FacetContribution[]
): { data: Record<string, unknown>; contributedBy: string[] } {
  const kindDef = facetKindRegistry.getOrThrow(kind);
  const contributedBy = contributions.map((c) => c.playbookId);

  switch (kindDef.mergeStrategy) {
    case "override": {
      const last = contributions[contributions.length - 1];
      return { data: last.data, contributedBy };
    }
    case "highest-confidence": {
      const best = contributions
        .slice()
        .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
      return { data: best.data, contributedBy };
    }
    case "union": {
      // Merge array-valued fields (list, roles, kinds, slots) with
      // Set semantics. Scalar fields override with the last value.
      const merged: Record<string, unknown> = {};
      for (const c of contributions) {
        for (const [k, v] of Object.entries(c.data)) {
          if (Array.isArray(v)) {
            const existing = Array.isArray(merged[k])
              ? (merged[k] as unknown[])
              : [];
            merged[k] = Array.from(new Set([...existing, ...v]));
          } else {
            merged[k] = v;
          }
        }
      }
      return { data: merged, contributedBy };
    }
    case "intersection": {
      // Retain only array-valued fields whose values appear in every
      // contribution.
      const merged: Record<string, unknown> = {};
      const firstData = contributions[0].data;
      for (const [k, v] of Object.entries(firstData)) {
        if (Array.isArray(v)) {
          let acc = new Set(v as unknown[]);
          for (let i = 1; i < contributions.length; i++) {
            const next = contributions[i].data[k];
            if (!Array.isArray(next)) {
              acc = new Set();
              break;
            }
            acc = new Set([...acc].filter((x) => (next as unknown[]).includes(x)));
          }
          merged[k] = Array.from(acc);
        } else {
          merged[k] = v;
        }
      }
      return { data: merged, contributedBy };
    }
    case "custom": {
      if (!kindDef.mergeFn) {
        throw new Error(
          `facet kind "${kind}" declares custom merge but has no mergeFn.`
        );
      }
      const data = kindDef.mergeFn(contributions);
      return { data, contributedBy };
    }
  }
}

/** Fold a PlaybookFacets contribution into the accumulator map. */
function fold(
  acc: Map<string, FacetContribution[]>,
  playbookId: string,
  facets: PlaybookFacets,
  confidence?: number
): void {
  for (const [kind, data] of Object.entries(facets)) {
    const list = acc.get(kind) ?? [];
    list.push({ playbookId, data, confidence });
    acc.set(kind, list);
  }
}

export function resolve(input: {
  profile: FrozenBusinessProfileManifest;
  strategy: FrozenGrowthStrategyManifest;
  recipe: FrozenWebsiteRecipeManifest;
}): ResolvedStrategy {
  const { profile, strategy, recipe } = input;

  // 1. Collect contributions from every playbook in recipe order.
  const contributions = new Map<string, FacetContribution[]>();
  for (const playbookSlug of recipe.playbooks) {
    const pb = playbookRegistry.getOrThrow(playbookSlug);
    fold(contributions, pb.slug, pb.facets, pb.evidence.confidence);
  }

  // 2. Apply recipe-level overrides last so they always win.
  if (recipe.overrides) {
    fold(contributions, `recipe:${recipe.slug}`, recipe.overrides);
  }

  // 3. Merge each kind + build the typed domain tree.
  const domains: Record<string, Record<string, unknown>> = {};
  const provenance: FacetProvenance[] = [];

  for (const [kind, contribs] of contributions) {
    const kindDef = facetKindRegistry.getOrThrow(kind);
    const { data, contributedBy } = mergeContributions(kind, contribs);

    // Validate.
    if (kindDef.validate) kindDef.validate(data);

    // Attach to the domain tree.
    const bucket = domains[kindDef.domain] ?? {};
    bucket[kindDef.field] = data;
    domains[kindDef.domain] = bucket;

    provenance.push({ kind, contributedBy, finalValue: data });
  }

  const frozenDomains = freeze(domains);
  const resolvedAt = new Date().toISOString();

  const result: ResolvedStrategy = {
    inputs: freeze({ profile, strategy, recipe }),
    domains: frozenDomains,
    provenance: freeze(provenance),
    resolvedAt,

    get(domain: string, field: string) {
      return (frozenDomains as Record<string, Record<string, unknown>>)[
        domain
      ]?.[field];
    },

    facetsByLayer(layer: number): FacetProvenance[] {
      return provenance.filter((p) => {
        const kindDef = facetKindRegistry.get(p.kind);
        return kindDef?.ownerLayer === layer;
      });
    },

    describe(): string {
      const parts: string[] = [
        `ResolvedStrategy for ${profile.name} × ${strategy.name} × recipe "${recipe.name}"`,
        `Playbooks used: ${recipe.playbooks.join(", ")}`,
        `Domains: ${Object.keys(domains).join(", ")}`,
        `Resolved at ${resolvedAt}`
      ];
      return parts.join(" | ");
    }
  };

  return Object.freeze(result);
}
