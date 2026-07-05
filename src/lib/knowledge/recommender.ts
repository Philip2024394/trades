// Recommendation Engine v2 — walks the Knowledge Graph.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// Contract: given a trade slug (+ optional merchant context), return
// ranked Module recommendations with *explained reasons*. The engine
// never hardcodes trade → module mappings. Every recommendation is
// derived from:
//   1. The Knowledge Package that applies to the trade.
//   2. The Package's resolved capabilities (Domain contract + Package
//      extensions).
//   3. The Module registry's `implementsCapability` + `poweredByDomain`
//      declarations.
//   4. The Module's `expectedByTrades` list.
//   5. The Package's explicit `recommendedModules` override list.
//
// Reasons are surfaced up to the UI so the merchant can see *why* a
// module is being suggested. No black-box scoring.

import { BUSINESS_MODULES, modulesForCapability } from "@/lib/studio/modules";
import type { BusinessModule } from "@/lib/studio/modules";
import { knowledgePackageRegistry } from "./packageRegistry";
import type { FrozenKnowledgePackage } from "./packageTypes";

// ─── Types ───────────────────────────────────────────────────────

export type RecommendationReasonKind =
  | "capability-fit"
  | "trade-expected"
  | "package-explicit"
  | "already-installed"
  | "state-preferred";

export type RecommendationReason = {
  kind: RecommendationReasonKind;
  weight: number;
  detail: string;
};

export type ModuleRecommendation = {
  module: BusinessModule;
  score: number; // 0..1
  reasons: RecommendationReason[];
  /** Which capabilities the module implements from the Package's
   *  resolved set. Empty when the module was picked for trade-expected
   *  or package-explicit reasons only. */
  matchedCapabilities: string[];
};

export type PackageCoverage = {
  totalCapabilities: number;
  coveredCapabilities: number;
  gaps: string[]; // capability refs with no module implementation yet
};

export type RecommendationResult = {
  package: FrozenKnowledgePackage | null;
  recommendations: ModuleRecommendation[];
  coverage: PackageCoverage;
};

// ─── Scoring weights ─────────────────────────────────────────────
// Kept as constants at the top so the ranking is inspectable +
// tunable without hunting through logic.

const WEIGHT_CAPABILITY_FIT = 0.4; // per-capability match, capped
const WEIGHT_CAPABILITY_FIT_CAP = 0.6;
const WEIGHT_TRADE_EXPECTED = 0.2;
const WEIGHT_PACKAGE_EXPLICIT = 0.25;
const WEIGHT_STATE_SHIPPED = 0.1;
const WEIGHT_STATE_AVAILABLE = 0.05;
const PENALTY_ALREADY_INSTALLED = -0.5;

// ─── Engine ──────────────────────────────────────────────────────

export type RecommendationInput = {
  /** Merchant's primary trade slug from src/lib/tradeOff.ts. */
  tradeSlug: string;
  /** Modules the merchant already has active — de-prioritised. */
  heldModuleIds?: string[];
  /** Cap on results. Default = every relevant module. */
  maxResults?: number;
};

export function recommendModules(
  input: RecommendationInput
): RecommendationResult {
  const held = new Set(input.heldModuleIds ?? []);

  // 1. Find the Knowledge Package for this trade.
  const packages = knowledgePackageRegistry.listByTrade(input.tradeSlug);
  const pkg = packages[0] ?? null;

  if (!pkg) {
    // No Package yet — fall back to `expectedByTrades` only. This
    // makes the engine safe to call on trades without a Package,
    // matching the honest-inventory principle.
    return recommendWithoutPackage(input.tradeSlug, held, input.maxResults);
  }

  // 2. Resolve the Package to get the flat capability set.
  const resolved = knowledgePackageRegistry.resolve(pkg.id);
  const allCapabilityRefs: string[] = [];
  for (const [domainId, caps] of Object.entries(resolved.capabilitiesByDomain)) {
    for (const c of caps) {
      allCapabilityRefs.push(`${domainId}.${c.capabilityId}`);
    }
  }
  const uniqueCapabilities = Array.from(new Set(allCapabilityRefs));

  // 3. Walk capabilities → modules that implement them.
  const capabilityToModules = new Map<string, BusinessModule[]>();
  const gaps: string[] = [];
  for (const capRef of uniqueCapabilities) {
    const mods = modulesForCapability(capRef);
    if (mods.length === 0) {
      gaps.push(capRef);
    } else {
      capabilityToModules.set(capRef, mods);
    }
  }

  // 4. Score every candidate module.
  const scoreMap = new Map<string, ModuleRecommendation>();

  // 4a — capability-fit + package inclusion
  for (const [capRef, mods] of capabilityToModules) {
    for (const module of mods) {
      const existing = scoreMap.get(module.id) ?? {
        module,
        score: 0,
        reasons: [],
        matchedCapabilities: []
      };
      existing.matchedCapabilities.push(capRef);
      scoreMap.set(module.id, existing);
    }
  }

  // 4b — for every candidate, compute the full score + reasons
  const explicitRec = new Set(pkg.recommendedModules);
  for (const rec of scoreMap.values()) {
    const m = rec.module;

    // capability-fit — sqrt-scaled so a module implementing 5 caps
    // doesn't dominate one implementing 2.
    const fitScore = Math.min(
      WEIGHT_CAPABILITY_FIT_CAP,
      WEIGHT_CAPABILITY_FIT * Math.sqrt(rec.matchedCapabilities.length)
    );
    rec.score += fitScore;
    rec.reasons.push({
      kind: "capability-fit",
      weight: fitScore,
      detail: `implements ${rec.matchedCapabilities.length} of your trade's capabilities`
    });

    // trade-expected boost
    if (m.expectedByTrades.includes(input.tradeSlug)) {
      rec.score += WEIGHT_TRADE_EXPECTED;
      rec.reasons.push({
        kind: "trade-expected",
        weight: WEIGHT_TRADE_EXPECTED,
        detail: `expected by ${input.tradeSlug} businesses`
      });
    }

    // package-explicit boost
    if (explicitRec.has(m.id)) {
      rec.score += WEIGHT_PACKAGE_EXPLICIT;
      rec.reasons.push({
        kind: "package-explicit",
        weight: WEIGHT_PACKAGE_EXPLICIT,
        detail: `explicitly recommended in the ${pkg.name} package`
      });
    }

    // state preference
    if (m.state === "shipped") {
      rec.score += WEIGHT_STATE_SHIPPED;
      rec.reasons.push({
        kind: "state-preferred",
        weight: WEIGHT_STATE_SHIPPED,
        detail: "shipped and working today"
      });
    } else if (m.state === "available-addon") {
      rec.score += WEIGHT_STATE_AVAILABLE;
      rec.reasons.push({
        kind: "state-preferred",
        weight: WEIGHT_STATE_AVAILABLE,
        detail: "available via one-tap add-on"
      });
    }

    // already-installed de-prioritisation
    if (held.has(m.id)) {
      rec.score += PENALTY_ALREADY_INSTALLED;
      rec.reasons.push({
        kind: "already-installed",
        weight: PENALTY_ALREADY_INSTALLED,
        detail: "you already have this — not recommending again"
      });
    }

    // clamp
    rec.score = Math.max(0, Math.min(1, rec.score));
  }

  // 4c — add package-explicit modules that don't implement any
  // capability yet (e.g. Growth Coach for a trade that just wants it).
  for (const explicitId of explicitRec) {
    if (scoreMap.has(explicitId)) continue;
    const m = BUSINESS_MODULES.find((x) => x.id === explicitId);
    if (!m) continue;
    const rec: ModuleRecommendation = {
      module: m,
      score: WEIGHT_PACKAGE_EXPLICIT,
      reasons: [
        {
          kind: "package-explicit",
          weight: WEIGHT_PACKAGE_EXPLICIT,
          detail: `explicitly recommended in the ${pkg.name} package`
        }
      ],
      matchedCapabilities: []
    };
    if (m.expectedByTrades.includes(input.tradeSlug)) {
      rec.score += WEIGHT_TRADE_EXPECTED;
      rec.reasons.push({
        kind: "trade-expected",
        weight: WEIGHT_TRADE_EXPECTED,
        detail: `expected by ${input.tradeSlug} businesses`
      });
    }
    if (m.state === "shipped") {
      rec.score += WEIGHT_STATE_SHIPPED;
      rec.reasons.push({
        kind: "state-preferred",
        weight: WEIGHT_STATE_SHIPPED,
        detail: "shipped and working today"
      });
    } else if (m.state === "available-addon") {
      rec.score += WEIGHT_STATE_AVAILABLE;
      rec.reasons.push({
        kind: "state-preferred",
        weight: WEIGHT_STATE_AVAILABLE,
        detail: "available via one-tap add-on"
      });
    }
    if (held.has(m.id)) {
      rec.score += PENALTY_ALREADY_INSTALLED;
      rec.reasons.push({
        kind: "already-installed",
        weight: PENALTY_ALREADY_INSTALLED,
        detail: "you already have this — not recommending again"
      });
    }
    rec.score = Math.max(0, Math.min(1, rec.score));
    scoreMap.set(explicitId, rec);
  }

  // 5. Sort by score, then cap
  const sorted = Array.from(scoreMap.values()).sort(
    (a, b) => b.score - a.score
  );
  const limited = input.maxResults ? sorted.slice(0, input.maxResults) : sorted;

  return {
    package: pkg,
    recommendations: limited,
    coverage: {
      totalCapabilities: uniqueCapabilities.length,
      coveredCapabilities: uniqueCapabilities.length - gaps.length,
      gaps
    }
  };
}

// ─── Fallback for trades without a Knowledge Package ─────────────

function recommendWithoutPackage(
  tradeSlug: string,
  held: Set<string>,
  maxResults: number | undefined
): RecommendationResult {
  const candidates = BUSINESS_MODULES.filter(
    (m) =>
      m.expectedByTrades.length === 0 || m.expectedByTrades.includes(tradeSlug)
  );
  const recs: ModuleRecommendation[] = candidates.map((m) => {
    const reasons: RecommendationReason[] = [];
    let score = 0;
    if (m.expectedByTrades.includes(tradeSlug)) {
      score += WEIGHT_TRADE_EXPECTED;
      reasons.push({
        kind: "trade-expected",
        weight: WEIGHT_TRADE_EXPECTED,
        detail: `expected by ${tradeSlug} businesses`
      });
    }
    if (m.state === "shipped") {
      score += WEIGHT_STATE_SHIPPED;
      reasons.push({
        kind: "state-preferred",
        weight: WEIGHT_STATE_SHIPPED,
        detail: "shipped and working today"
      });
    } else if (m.state === "available-addon") {
      score += WEIGHT_STATE_AVAILABLE;
      reasons.push({
        kind: "state-preferred",
        weight: WEIGHT_STATE_AVAILABLE,
        detail: "available via one-tap add-on"
      });
    }
    if (held.has(m.id)) {
      score += PENALTY_ALREADY_INSTALLED;
      reasons.push({
        kind: "already-installed",
        weight: PENALTY_ALREADY_INSTALLED,
        detail: "you already have this — not recommending again"
      });
    }
    return {
      module: m,
      score: Math.max(0, Math.min(1, score)),
      reasons,
      matchedCapabilities: []
    };
  });
  const sorted = recs.sort((a, b) => b.score - a.score);
  const limited = maxResults ? sorted.slice(0, maxResults) : sorted;
  return {
    package: null,
    recommendations: limited,
    coverage: { totalCapabilities: 0, coveredCapabilities: 0, gaps: [] }
  };
}
