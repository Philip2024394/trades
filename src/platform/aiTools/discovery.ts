// Platform AI Tool Discovery — the AI Dispatcher's tool source.
//
// ─── 3-question rule (memory: project_extend_dont_duplicate_permanent_rule) ─
//
// 1. Why platform?  The AI Dispatcher lives at the platform layer
//    (`/api/ai/dispatch`) and must expose EVERY App's tools to the
//    model via a single tool-use surface. If discovery lived in
//    Marketplace, Fleet's tools would never surface. Discovery must
//    be platform-scoped.
//
// 2. Which future Apps benefit?  Every App that declares `aiTools`
//    on its manifest. Marketplace (`search_products`,
//    `find_alternatives`), Projects (`estimate_materials`,
//    `generate_quote`), Fleet (`dispatch_driver`), Insurance
//    (`compare_policies`), Recruitment (`match_candidate`) — all
//    become copilot-callable the moment they register.
//
// 3. Which doc authorises?  ADR-034 + TRADE_CENTER_PLATFORM_DELTA
//    §4.3 row "AI Dispatcher with tool discovery per App".
//
// ─── Design ───────────────────────────────────────────────────────
//
// Zero state. Discovery reads from `appRegistry.list()` on demand.
// No parallel registry — Apps register themselves once; discovery is
// a projection. This is the extend-don't-duplicate principle in
// its purest form.
//
// The AI Dispatcher (Week 4) will import `discoverAITools()` and
// present the collected declarations to Claude via the tool-use API.
// For Week 1 the discovery function is exercised by a unit-test-style
// verification script (see scripts/verify-week1-demos.mjs).

import { appRegistry } from "@/platform/registry";
import type { AIToolDeclaration } from "@/platform/manifest/types";

/** An AI tool discovered on the platform, tagged with its source App. */
export type DiscoveredAITool = AIToolDeclaration & {
  /** App slug the tool was declared by. */
  appSlug: string;
  /** App display name — for logging + admin UI. */
  appName: string;
};

/** Return every AI tool declared by every registered App. Order is
 *  App registration order, then declaration order within each App.
 *  Silent no-op for Apps that don't declare `aiTools`.
 */
export function discoverAITools(): DiscoveredAITool[] {
  const out: DiscoveredAITool[] = [];
  for (const app of appRegistry.list()) {
    if (!app.aiTools?.length) continue;
    for (const tool of app.aiTools) {
      out.push({
        ...tool,
        appSlug: app.slug,
        appName: app.name
      });
    }
  }
  return out;
}

/** Look up a specific discovered tool by its fully-qualified name.
 *  Returns `undefined` if no App declares it.
 */
export function findAITool(name: string): DiscoveredAITool | undefined {
  return discoverAITools().find((t) => t.name === name);
}

/** Count discovered tools per App. Useful for admin dashboards and
 *  the AI Dispatcher's boot log.
 */
export function countAIToolsByApp(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const app of appRegistry.list()) {
    if (!app.aiTools?.length) continue;
    counts[app.slug] = app.aiTools.length;
  }
  return counts;
}
