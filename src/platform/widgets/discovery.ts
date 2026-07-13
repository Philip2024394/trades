// Platform Widget Discovery — Home Today's Work strip + right panel.
//
// ─── 3-question rule ────────────────────────────────────────────────
//
// 1. Why platform?  The Home dashboard's "Today's Work" strip renders
//    contributions from every App. If widgets lived per-App with no
//    discoverable slot, we'd have to hard-code widget lists in the
//    shell. Discovery via manifest = zero shell code change per App.
//
// 2. Which future Apps benefit?  Every App with data worth surfacing
//    on Home. Marketplace ("3 back in stock"), Orders ("2 deliveries
//    arriving today"), Quotes ("1 waiting on customer"), Messages
//    ("4 unread"), Estimator ("estimate ready"), Community
//    ("new canteen posts").
//
// 3. Which doc authorises?  ADR-048 + TRADE_CENTER_PLATFORM_DELTA
//    §6 Week 2 "Home 'Today's Work' strip via widget declarations".
//
// ─── Design ─────────────────────────────────────────────────────────
//
// Zero state. Discovery reads from `appRegistry.list()` at each Home
// render. BFF endpoint collapses N widget fetches into 1 call —
// wave 2 ships the BFF; Week 2 exposes discovery for shell renderers.

import { appRegistry } from "@/platform/registry";
import type { WidgetDeclaration } from "@/platform/manifest/types";

export type DiscoveredWidget = WidgetDeclaration & {
  appSlug: string;
  appName: string;
};

export function discoverWidgets(): DiscoveredWidget[] {
  const out: DiscoveredWidget[] = [];
  for (const app of appRegistry.list()) {
    if (!app.widgets?.length) continue;
    for (const w of app.widgets) {
      out.push({ ...w, appSlug: app.slug, appName: app.name });
    }
  }
  return out;
}

export function discoverWidgetsForSlot(
  slot: WidgetDeclaration["slot"]
): DiscoveredWidget[] {
  return discoverWidgets()
    .filter((w) => w.slot === slot)
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}

export function countWidgetsBySlot(): Record<WidgetDeclaration["slot"], number> {
  const counts: Record<WidgetDeclaration["slot"], number> = {
    "home.today": 0,
    "home.secondary": 0,
    "right-panel": 0
  };
  for (const w of discoverWidgets()) {
    counts[w.slot] = (counts[w.slot] ?? 0) + 1;
  }
  return counts;
}
