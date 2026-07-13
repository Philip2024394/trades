// Platform Command Palette Discovery.
//
// ─── 3-question rule ────────────────────────────────────────────────
//
// 1. Why platform?  The palette is a shell surface — ⌘K opens it on
//    every route. If each App shipped its own palette, muscle memory
//    would fragment. The platform owns the palette; Apps contribute
//    commands.
//
// 2. Which future Apps benefit?  Every App with actions the user
//    might want to invoke without navigating. Marketplace
//    (`marketplace.reorder`, `marketplace.compare`), Orders
//    (`orders.track`, `orders.cancel`), Projects
//    (`projects.new_quote`), Messages (`messages.new_thread`),
//    Fleet (`fleet.dispatch_driver`) — every command comes from a
//    manifest declaration, not shell code.
//
// 3. Which doc authorises?  ADR-047 + TRADE_CENTER_PLATFORM_DELTA
//    §4.3 row "Command Palette (⌘K)".
//
// ─── Design ─────────────────────────────────────────────────────────
//
// Discovery layer. Reads declarations from `appRegistry`. The palette
// UI (Week 1 later ship) imports `discoverCommands()`, buckets by
// `group`, renders via existing UI Kit, and dispatches on select via
// each command's `handler` module path.

import { appRegistry } from "@/platform/registry";
import type { CommandDeclaration } from "@/platform/manifest/types";

export type DiscoveredCommand = CommandDeclaration & {
  appSlug: string;
  appName: string;
};

/** Return every command declared by every registered App. */
export function discoverCommands(): DiscoveredCommand[] {
  const out: DiscoveredCommand[] = [];
  for (const app of appRegistry.list()) {
    if (!app.commands?.length) continue;
    for (const cmd of app.commands) {
      out.push({
        ...cmd,
        appSlug: app.slug,
        appName: app.name
      });
    }
  }
  return out;
}

/** Return every command grouped by its `group` field. Palette UI
 *  renders each group as a section.
 */
export function discoverCommandsGrouped(): Record<
  CommandDeclaration["group"],
  DiscoveredCommand[]
> {
  const groups: Record<CommandDeclaration["group"], DiscoveredCommand[]> = {
    actions: [],
    products: [],
    merchants: [],
    categories: [],
    recent: []
  };
  for (const cmd of discoverCommands()) {
    groups[cmd.group].push(cmd);
  }
  return groups;
}

export function findCommand(id: string): DiscoveredCommand | undefined {
  return discoverCommands().find((c) => c.id === id);
}

export function countCommandsByApp(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const app of appRegistry.list()) {
    if (!app.commands?.length) continue;
    counts[app.slug] = app.commands.length;
  }
  return counts;
}
