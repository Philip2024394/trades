// SiteBook Apps — server-side install / uninstall / list for the
// per-homeowner App Store state.
//
// Data lives in hammerex_homeowner_apps (see migration
// 20260719200000_hammerex_homeowner_apps.sql). All mutations are
// homeowner-scoped — every helper takes homeownerId.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { SiteBookAppSlug } from "@/apps/sitebook/_shared/manifest";
import { SITEBOOK_APPS, defaultInstalledSlugs } from "@/apps/sitebook/registry";

export type InstalledApp = {
  homeowner_id:  string;
  app_slug:      SiteBookAppSlug;
  installed_at:  string;
  settings:      Record<string, unknown> | null;
};

/** Full row set for a homeowner. */
export async function loadInstalledApps(homeownerId: string): Promise<InstalledApp[]> {
  const res = await supabaseAdmin
    .from("hammerex_homeowner_apps")
    .select("*")
    .eq("homeowner_id", homeownerId);
  return (res.data as InstalledApp[]) ?? [];
}

/** Cheap Set for O(1) "is X installed" lookups from the render path.
 *  Auto-installs `defaultInstalled: true` apps for homeowners who
 *  have zero rows yet (first-visit heuristic — idempotent thereafter). */
export async function loadInstalledAppSlugs(homeownerId: string): Promise<Set<SiteBookAppSlug>> {
  const rows = await loadInstalledApps(homeownerId);
  if (rows.length === 0) {
    const defaults = defaultInstalledSlugs();
    if (defaults.length > 0) {
      await supabaseAdmin
        .from("hammerex_homeowner_apps")
        .upsert(defaults.map((slug) => ({
          homeowner_id: homeownerId,
          app_slug:     slug,
          installed_at: new Date().toISOString()
        })), { onConflict: "homeowner_id,app_slug" });
      return new Set(defaults);
    }
  }
  return new Set(rows.map((r) => r.app_slug));
}

export async function installApp(input: {
  homeownerId: string;
  slug:        SiteBookAppSlug;
  settings?:   Record<string, unknown>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!SITEBOOK_APPS[input.slug]) return { ok: false, error: "unknown-app" };
  const res = await supabaseAdmin
    .from("hammerex_homeowner_apps")
    .upsert({
      homeowner_id: input.homeownerId,
      app_slug:     input.slug,
      settings:     input.settings ?? null,
      installed_at: new Date().toISOString()
    }, { onConflict: "homeowner_id,app_slug" });
  if (res.error) return { ok: false, error: "install-failed" };
  return { ok: true };
}

export async function uninstallApp(input: {
  homeownerId: string;
  slug:        SiteBookAppSlug;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await supabaseAdmin
    .from("hammerex_homeowner_apps")
    .delete()
    .eq("homeowner_id", input.homeownerId)
    .eq("app_slug", input.slug);
  if (res.error) return { ok: false, error: "uninstall-failed" };
  return { ok: true };
}
