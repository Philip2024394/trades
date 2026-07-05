// Platform Runtime — navigation composition.
//
// Merges every installed App's manifest.navigation with the assembly-
// driven nav entries a merchant has accepted at install time. Studio's
// side drawer, the storefront's public nav, and the App Store's "your
// apps" panel all read from here.
//
// Composition rules:
//   • Entries are collected across every active install.
//   • Assembly-driven entries (studio_assembly_nav_entries) are folded
//     in per-brand — mapped onto ComposedNavEntry with contributedBy
//     set to the source module id so the drawer can label provenance.
//   • Entries with a `parent` are nested under the entry with that id.
//   • Root entries sort by `order` ascending, then insertion order.
//   • Nothing is filtered by visibility here — the consumer (drawer,
//     public nav) applies its own visibility filter downstream.

import { appRegistry } from "../registry";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { listActiveInstalls } from "./installedApps";
import type { ComposedNavEntry, ComposedNavigation } from "./types";

/** Compose the navigation tree for a merchant. Cheap operation — reads
 *  the installed_apps ledger + assembly nav entries once and walks
 *  in-memory manifests. brandId is optional; when omitted, assembly-
 *  driven entries are skipped (used by contexts that only want the
 *  manifest-declared tree). */
export async function composeNavigation(
  merchantId: string,
  brandId?: string
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

  if (brandId) {
    const assembly = await supabaseAdmin
      .from("studio_assembly_nav_entries")
      .select("target_slot, label, href, icon, order_index, source_module_id, source_proposal_id")
      .eq("brand_id", brandId)
      .is("hidden_at", null);
    for (const row of assembly.data ?? []) {
      flat.push({
        id: row.source_proposal_id as string,
        label: row.label as string,
        href: row.href as string,
        icon: (row.icon as string | null) ?? undefined,
        parent: row.target_slot as string,
        order: row.order_index as number,
        contributedBy: row.source_module_id as string
      });
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
