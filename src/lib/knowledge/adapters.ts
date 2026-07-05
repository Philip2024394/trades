// Knowledge Graph — migration adapters.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// Bridge functions between the pre-Knowledge-Graph systems
// (blueprintRegistry, BusinessModule.expectedByTrades, blueprint
// industryIntelligence + expectedModules) and the new Knowledge Graph.
//
// Purpose: existing consumers keep working. New consumers get the
// unified read. No existing knowledge is lost — everything a
// blueprint declared is still reachable, but the Knowledge Package
// takes precedence when present.

import { blueprintRegistry } from "@/lib/studio/blueprints";
import type { FrozenBlueprintManifest } from "@/lib/studio/blueprints";
import { BUSINESS_MODULES } from "@/lib/studio/modules";
import { knowledgePackageRegistry } from "./packageRegistry";
import type { FrozenKnowledgePackage } from "./packageTypes";

// ─── Two-way blueprint ↔ package lookup ─────────────────────────

/** Given a Package id, return the Blueprint that is canonical for it. */
export function blueprintForPackage(
  packageId: string
): FrozenBlueprintManifest | undefined {
  const pkg = knowledgePackageRegistry.get(packageId);
  if (!pkg?.canonicalBlueprint) return undefined;
  return blueprintRegistry.get(pkg.canonicalBlueprint);
}

/** Given a Blueprint slug, return the Package (if any) that names it
 *  as its canonical blueprint. */
export function packageForBlueprint(
  blueprintSlug: string
): FrozenKnowledgePackage | undefined {
  return knowledgePackageRegistry
    .list()
    .find((p) => p.canonicalBlueprint === blueprintSlug);
}

/** Given a trade slug, return the Package (if any) that applies. */
export function packageForTrade(
  tradeSlug: string
): FrozenKnowledgePackage | undefined {
  const list = knowledgePackageRegistry.listByTrade(tradeSlug);
  return list[0];
}

// ─── Unified reads (Package-first with Blueprint fallback) ──────

/** Merged intelligence bullets for a trade. Package wins when set;
 *  falls back to the trade's canonical Blueprint. Deduped preserving
 *  first-seen order (Package facts appear before Blueprint ones). */
export function intelligenceForTrade(tradeSlug: string): string[] {
  const pkg = packageForTrade(tradeSlug);
  const bullets: string[] = [];
  const seen = new Set<string>();
  if (pkg?.industryIntelligence) {
    for (const b of pkg.industryIntelligence) {
      if (!seen.has(b)) {
        seen.add(b);
        bullets.push(b);
      }
    }
  }
  // Walk every blueprint that lists this trade + fold its
  // industryIntelligence in as a fallback source.
  const blueprints = blueprintRegistry
    .list()
    .filter((bp) => bp.trades.includes(tradeSlug));
  for (const bp of blueprints) {
    for (const b of bp.industryIntelligence ?? []) {
      if (!seen.has(b)) {
        seen.add(b);
        bullets.push(b);
      }
    }
  }
  return bullets;
}

/** Merged expected/recommended modules for a trade. Combines three
 *  sources in order of authority:
 *   1. Package.recommendedModules      (highest — explicit)
 *   2. Blueprint.expectedModules       (medium — set on the blueprint)
 *   3. BusinessModule.expectedByTrades (lowest — trade slug hits)
 *  Deduped, order-preserving. */
export function expectedModulesForTrade(tradeSlug: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (id: string) => {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  };

  const pkg = packageForTrade(tradeSlug);
  if (pkg) {
    for (const id of pkg.recommendedModules) push(id);
  }

  const blueprints = blueprintRegistry
    .list()
    .filter((bp) => bp.trades.includes(tradeSlug));
  for (const bp of blueprints) {
    for (const id of bp.expectedModules ?? []) push(id);
  }

  for (const m of BUSINESS_MODULES) {
    if (m.expectedByTrades.includes(tradeSlug)) push(m.id);
  }

  return out;
}

/** Which Package covers a given credential scheme? Used by Growth
 *  Coach to migrate off the hardcoded MANDATORY_BY_TRADE map. */
export function packagesRequiringScheme(scheme: string): FrozenKnowledgePackage[] {
  return knowledgePackageRegistry.list().filter((pkg) => {
    for (const ext of pkg.extensions) {
      for (const c of ext.compliance ?? []) {
        if (c.id === scheme) return true;
      }
    }
    return false;
  });
}

/** Which credential schemes does a trade's Package flag as compliance
 *  elements with a 1:1 credential-scheme mapping? Growth Coach uses
 *  this to derive "you should add your <scheme> number" nudges without
 *  hardcoded per-trade logic — every future Package that lands is
 *  picked up automatically.
 *
 *  Returns [{ scheme, label, source }] — label = human name from the
 *  Package.compliance element; source = the regulator URL for the
 *  Growth Coach reason string. */
export function mandatorySchemesForTrade(
  tradeSlug: string
): Array<{ scheme: string; label: string; source: string }> {
  const pkg = packageForTrade(tradeSlug);
  if (!pkg) return [];
  const out: Array<{ scheme: string; label: string; source: string }> = [];
  const seen = new Set<string>();
  for (const ext of pkg.extensions) {
    for (const c of ext.compliance ?? []) {
      if (c.credentialScheme && !seen.has(c.credentialScheme)) {
        seen.add(c.credentialScheme);
        out.push({
          scheme: c.credentialScheme,
          label: c.name,
          source: c.source
        });
      }
    }
  }
  return out;
}

/** Diagnostic: coverage report for a trade. Powers admin dashboards +
 *  the roadmap. */
export function knowledgeCoverageForTrade(tradeSlug: string): {
  hasPackage: boolean;
  packageId?: string;
  blueprintCount: number;
  intelligenceBulletCount: number;
  recommendedModuleCount: number;
} {
  const pkg = packageForTrade(tradeSlug);
  const blueprints = blueprintRegistry
    .list()
    .filter((bp) => bp.trades.includes(tradeSlug));
  return {
    hasPackage: !!pkg,
    packageId: pkg?.id,
    blueprintCount: blueprints.length,
    intelligenceBulletCount: intelligenceForTrade(tradeSlug).length,
    recommendedModuleCount: expectedModulesForTrade(tradeSlug).length
  };
}
