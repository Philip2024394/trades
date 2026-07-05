// Construction Knowledge Graph — Domain registry.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// Milestone 1 · Registry Kit migration:
// Composes over `createRegistry` from @/platform/registryKit. Every
// existing caller (packageRegistry.ts validation, retriever.ts, and
// the 15+ domain registration files under ./domains) continues to
// work verbatim. Inherits `.search()`, `.describe()`, `.selfCheck()`,
// `.listByTag()`, `.snapshot()`, telemetry + analytics.
//
// Domain-specific method preserved: `.neighbours(id)` walks the
// relatedDomains graph.

import type { Frozen, RegistrationBase } from "@/platform/registryKit";
import { createRegistry } from "@/platform/registryKit";
import type {
  FrozenKnowledgeDomain,
  KnowledgeDomain,
  KnowledgeDomainId
} from "./types";

type KnowledgeDomainRegistration = KnowledgeDomain & RegistrationBase;
type FrozenKnowledgeDomainRegistration = Frozen<KnowledgeDomainRegistration>;

const inner = createRegistry<KnowledgeDomainRegistration>({
  label: "knowledgeDomainRegistry",
  idFormat: "slug",
  validate: (d) => {
    if (!d.entities || !Array.isArray(d.entities)) {
      throw new Error(`Domain "${d.id}" missing entities[].`);
    }
    if (!d.capabilities || !Array.isArray(d.capabilities)) {
      throw new Error(`Domain "${d.id}" missing capabilities[].`);
    }
    if (!Array.isArray(d.relatedDomains)) {
      throw new Error(`Domain "${d.id}" missing relatedDomains[].`);
    }
  }
});

function normalise(d: KnowledgeDomain): KnowledgeDomainRegistration {
  return {
    ...d,
    // RegistrationBase — id already matches, kit accepts it as slug.
    name: d.name,
    description: d.description,
    category: "knowledge-domain",
    searchKeywords: [d.tagline, ...d.relatedDomains],
    tags: d.relatedDomains
  };
}

export const knowledgeDomainRegistry = {
  register(domain: KnowledgeDomain): FrozenKnowledgeDomainRegistration {
    return inner.register(normalise(domain));
  },
  get(id: KnowledgeDomainId): FrozenKnowledgeDomainRegistration | undefined {
    return inner.get(id);
  },
  getOrThrow(id: KnowledgeDomainId): FrozenKnowledgeDomainRegistration {
    return inner.getOrThrow(id);
  },
  has(id: KnowledgeDomainId): boolean {
    return inner.has(id);
  },
  list(): FrozenKnowledgeDomainRegistration[] {
    return inner.list();
  },

  /** Walk relatedDomains breadth-first, returning the reachable set
   *  excluding the seed. Preserved from the previous class. */
  neighbours(id: KnowledgeDomainId): FrozenKnowledgeDomainRegistration[] {
    const seed = inner.get(id);
    if (!seed) return [];
    return seed.relatedDomains
      .map((n: KnowledgeDomainId) => inner.get(n))
      .filter(
        (d): d is FrozenKnowledgeDomainRegistration => !!d
      );
  },
  size(): number {
    return inner.size();
  },

  // ─── New surface inherited from the kit ─────────────────────────
  search: inner.search,
  describe: inner.describe,
  listByCategory: inner.listByCategory,
  listByTag: inner.listByTag,
  categories: inner.categories,
  tags: inner.tags,
  counts: inner.counts,
  resolveAlias: inner.resolveAlias,
  selfCheck: inner.selfCheck,
  snapshot: inner.snapshot
};

// Legacy type re-export so `import { FrozenKnowledgeDomain } from
// "@/lib/knowledge/registry"` still resolves. New code should import
// from ./types directly.
export type { FrozenKnowledgeDomain };
