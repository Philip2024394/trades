// Platform Feature Flag Discovery.
//
// ─── 3-question rule ────────────────────────────────────────────────
//
// 1. Why platform?  Flag evaluation must be uniform across every App
//    (percent rollout, allowlist, tier gate, country gate, kill switch).
//    If each App implemented its own flag runtime, we'd have 100
//    different rollout mechanisms.
//
// 2. Which future Apps benefit?  Every App that declares flags on its
//    manifest. Marketplace (`marketplace.compare_drawer`), Fleet
//    (`fleet.autonomous_dispatch`), Finance (`finance.instant_credit`),
//    Insurance (`insurance.ai_quote`) — all become gated by the same
//    enforcer.
//
// 3. Which doc authorises?  ADR-037 + TRADE_CENTER_PLATFORM_DELTA
//    §4.3 row "Plugin-scoped feature flag registry".
//
// ─── Design ─────────────────────────────────────────────────────────
//
// Discovery layer only — reads declarations from `appRegistry`. The
// evaluation runtime (percent rollout, kill switch, edge-cached
// overrides) lands separately and reads from `tc_flags.*` for
// runtime overrides.

import { appRegistry } from "@/platform/registry";
import type { FeatureFlagDeclaration } from "@/platform/manifest/types";

export type DiscoveredFeatureFlag = FeatureFlagDeclaration & {
  appSlug: string;
  appName: string;
};

/** Return every feature flag declared by every registered App. */
export function discoverFeatureFlags(): DiscoveredFeatureFlag[] {
  const out: DiscoveredFeatureFlag[] = [];
  for (const app of appRegistry.list()) {
    if (!app.featureFlags?.length) continue;
    for (const flag of app.featureFlags) {
      out.push({
        ...flag,
        appSlug: app.slug,
        appName: app.name
      });
    }
  }
  return out;
}

/** Look up a specific flag by its fully-qualified key. */
export function findFeatureFlag(key: string): DiscoveredFeatureFlag | undefined {
  return discoverFeatureFlags().find((f) => f.key === key);
}

/** Default-value evaluator. This is the "shell recognises the flag"
 *  layer required by Demo 4 — actual override + percent rollout comes
 *  with the runtime evaluator in Week 2 (ADR-041 wave).
 *
 *  Returns the declared default when the flag exists, `undefined`
 *  when no App declares it (caller decides how to handle unknowns).
 */
export function isEnabledByDefault(key: string): boolean | undefined {
  return findFeatureFlag(key)?.default;
}

export function countFeatureFlagsByApp(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const app of appRegistry.list()) {
    if (!app.featureFlags?.length) continue;
    counts[app.slug] = app.featureFlags.length;
  }
  return counts;
}
