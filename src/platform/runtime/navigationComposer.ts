// Platform Runtime — navigation composition.
//
// Merges every installed App's manifest.navigation into one navigation
// tree for the merchant. Studio's side drawer, the storefront's public
// nav, and the App Store's "your apps" panel all read from here.
//
// Composition rules:
//   • Entries are collected across every active install.
//   • Entries with a `parent` are nested under the entry with that id.
//   • Root entries sort by `order` ascending, then insertion order.
//   • Nothing is filtered by visibility here — the consumer (drawer,
//     public nav) applies its own visibility filter downstream.

import { appRegistry } from "../registry";
import { listActiveInstalls } from "./installedApps";
import type { ComposedNavEntry, ComposedNavigation } from "./types";

/** Compose the navigation tree for a merchant. Cheap operation — reads
 *  the installed_apps ledger once and walks in-memory manifests. */
export async function composeNavigation(
  merchantId: string
): Promise<ComposedNavigation> {
  const installs = await listActiveInstalls(merchantId);
  const flat: ComposedNavEntry[] = [];

  for (const row of installs) {
    const manifest = appRegistry.get(row.app_slug);
    if (!manifest?.navigation?.length) continue;
    for (const entry of manifest.navigation) {
      flat.push({ ...entry, contributedBy: row.app_slug });
    }
  }

  return { entries: nestByParent(flat) };
}

/** Turn a flat list of nav entries into a two-level tree using the
 *  `parent` field. Orphan children (parent id not present) are lifted
 *  to root so nothing silently disappears. */
function nestByParent(flat: ComposedNavEntry[]): ComposedNavEntry[] {
  const byId = new Map<string, ComposedNavEntry>();
  for (const e of flat) {
    byId.set(e.id, { ...e, children: [] });
  }

  const roots: ComposedNavEntry[] = [];
  for (const e of byId.values()) {
    if (e.parent && byId.has(e.parent)) {
      byId.get(e.parent)!.children!.push(e);
    } else {
      roots.push(e);
    }
  }

  const sortByOrder = (a: ComposedNavEntry, b: ComposedNavEntry): number =>
    (a.order ?? 0) - (b.order ?? 0);
  roots.sort(sortByOrder);
  for (const r of roots) {
    if (r.children) r.children.sort(sortByOrder);
  }

  return roots;
}
