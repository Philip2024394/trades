// Construction Knowledge Graph — Package registry + resolver.
//
// Milestone 1 · Registry Kit migration:
// Composes over `createRegistry` from @/platform/registryKit. Existing
// callers (packageForTrade, adapters, retriever, sections that bind
// to the KG) work unchanged.
//
// Preserved domain-specific method: `.resolve(id)` walks Domain +
// Package extensions into a flat ResolvedPackage.
//
// Cross-registry validation preserved: Package references to Domains,
// Entities, and Capabilities are still checked at register time.

import type { Frozen, RegistrationBase } from "@/platform/registryKit";
import { createRegistry } from "@/platform/registryKit";
import { knowledgeDomainRegistry } from "./registry";
import type {
  FrozenKnowledgePackage,
  KnowledgePackage,
  ResolvedPackage
} from "./packageTypes";

type KnowledgePackageRegistration = KnowledgePackage & RegistrationBase;
type FrozenKnowledgePackageRegistration =
  Frozen<KnowledgePackageRegistration>;

const inner = createRegistry<KnowledgePackageRegistration>({
  label: "knowledgePackageRegistry",
  idFormat: "slug",
  validate: (pkg) => {
    if (pkg.trades.length === 0) {
      throw new Error(
        `"${pkg.id}" must apply to at least one trade.`
      );
    }
    if (pkg.usesDomains.length === 0) {
      throw new Error(
        `"${pkg.id}" must use at least one Domain.`
      );
    }
    // Every referenced Domain must exist in the DomainRegistry.
    for (const domainId of pkg.usesDomains) {
      if (!knowledgeDomainRegistry.has(domainId)) {
        throw new Error(
          `"${pkg.id}" references unknown Domain "${domainId}".`
        );
      }
    }
    // Every extension must reference a Domain we declared.
    const usedSet = new Set(pkg.usesDomains);
    for (const ext of pkg.extensions) {
      if (!usedSet.has(ext.domainId)) {
        throw new Error(
          `"${pkg.id}" extends Domain "${ext.domainId}" without declaring it in usesDomains.`
        );
      }
      const domain = knowledgeDomainRegistry.getOrThrow(ext.domainId);
      const entityIds = new Set(domain.entities.map((e) => e.id));
      for (const entExt of ext.entityExtensions ?? []) {
        if (!entityIds.has(entExt.entityId)) {
          throw new Error(
            `"${pkg.id}" extends unknown Entity "${entExt.entityId}" on Domain "${ext.domainId}".`
          );
        }
      }
      const capIds = new Set(domain.capabilities.map((c) => c.id));
      for (const capImpl of ext.capabilities ?? []) {
        if (!capIds.has(capImpl.capabilityId)) {
          throw new Error(
            `"${pkg.id}" implements unknown Capability "${capImpl.capabilityId}" on Domain "${ext.domainId}".`
          );
        }
      }
    }
  },
  indexes: {
    byTrade: (p) => p.trades
  }
});

function normalise(p: KnowledgePackage): KnowledgePackageRegistration {
  return {
    ...p,
    category: "knowledge-package",
    tags: p.trades,
    searchKeywords: [p.tagline, ...p.usesDomains, ...p.trades]
  };
}

export const knowledgePackageRegistry = {
  register(pkg: KnowledgePackage): FrozenKnowledgePackageRegistration {
    return inner.register(normalise(pkg));
  },
  get(id: string): FrozenKnowledgePackageRegistration | undefined {
    return inner.get(id);
  },
  getOrThrow(id: string): FrozenKnowledgePackageRegistration {
    return inner.getOrThrow(id);
  },
  has(id: string): boolean {
    return inner.has(id);
  },
  list(): FrozenKnowledgePackageRegistration[] {
    return inner.list();
  },
  listByTrade(tradeSlug: string): FrozenKnowledgePackageRegistration[] {
    return inner.listByIndex("byTrade", tradeSlug);
  },
  size(): number {
    return inner.size();
  },

  // ─── New surface inherited from the kit ─────────────────────────
  search: inner.search,
  describe: inner.describe,
  listByTag: inner.listByTag,
  categories: inner.categories,
  tags: inner.tags,
  counts: inner.counts,
  resolveAlias: inner.resolveAlias,
  selfCheck: inner.selfCheck,
  snapshot: inner.snapshot,

  /** Flatten Domain + Package extensions into one ResolvedPackage.
   *  Consumers walk this instead of the manifest so they never have
   *  to know about inheritance. Domain-specific — preserved verbatim. */
  resolve(id: string): ResolvedPackage {
    const pkg = inner.getOrThrow(id);
    const capabilitiesByDomain: ResolvedPackage["capabilitiesByDomain"] = {};
    const entitiesByDomain: ResolvedPackage["entitiesByDomain"] = {};
    const retrievalHooks: ResolvedPackage["retrievalHooks"] = [];
    const complianceElements: ResolvedPackage["complianceElements"] = [];
    const seenCompliance = new Set<string>();

    for (const domainId of pkg.usesDomains) {
      const domain = knowledgeDomainRegistry.getOrThrow(domainId);
      capabilitiesByDomain[domainId] = domain.capabilities.map((c) => ({
        source: "domain" as const,
        capabilityId: c.id,
        slug: c.id,
        name: c.name,
        description: c.description
      }));
      entitiesByDomain[domainId] = domain.entities.map((e) => ({
        entityId: e.id,
        contract: { ...(e.contract ?? {}) } as Record<string, string>,
        extendedBy: []
      }));
      for (const hook of domain.aiRetrieval) {
        retrievalHooks.push({
          source: "domain",
          domainId,
          id: hook.id,
          description: hook.description,
          keywords: hook.keywords ?? []
        });
      }
      for (const c of domain.compliance) {
        const key = `${domainId}::${c.id}`;
        if (seenCompliance.has(key)) continue;
        seenCompliance.add(key);
        complianceElements.push({
          source: "domain",
          domainId,
          id: c.id,
          name: c.name,
          regulator: c.regulator,
          sourceUrl: c.source
        });
      }
    }

    for (const ext of pkg.extensions) {
      for (const entExt of ext.entityExtensions ?? []) {
        const entities = entitiesByDomain[ext.domainId];
        const target = entities.find((e) => e.entityId === entExt.entityId);
        if (target) {
          for (const [k, v] of Object.entries(entExt.additionalFields)) {
            target.contract[k] = v;
          }
          target.extendedBy.push(pkg.id);
        }
      }
      for (const capImpl of ext.capabilities ?? []) {
        capabilitiesByDomain[ext.domainId].push({
          source: "package",
          capabilityId: capImpl.capabilityId,
          slug: capImpl.slug,
          name: capImpl.name,
          description: capImpl.description
        });
      }
      for (const hook of ext.aiRetrieval ?? []) {
        retrievalHooks.push({
          source: "package",
          domainId: ext.domainId,
          id: hook.id,
          description: hook.description,
          keywords: hook.keywords ?? []
        });
      }
      for (const c of ext.compliance ?? []) {
        const key = `${ext.domainId}::${c.id}`;
        if (seenCompliance.has(key)) continue;
        seenCompliance.add(key);
        complianceElements.push({
          source: "package",
          domainId: ext.domainId,
          id: c.id,
          name: c.name,
          regulator: c.regulator,
          sourceUrl: c.source
        });
      }
    }

    return {
      package: pkg,
      capabilitiesByDomain,
      entitiesByDomain,
      retrievalHooks,
      complianceElements
    };
  }
};

// Legacy type re-export.
export type { FrozenKnowledgePackage };
