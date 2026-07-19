// SiteBook App Store — registry.
//
// Single source of truth for every installable SiteBook app. The
// runtime (`/sitebook`) and the App Store page (`/sitebook/apps`)
// both read from here — never hard-code app metadata anywhere else.
//
// Adding a new app:
//   1. Create src/apps/sitebook/<slug>/manifest.ts (default-exports SiteBookAppManifest)
//   2. Import + register it below
//   3. Nothing else — the App Store surfaces it automatically

import type { SiteBookAppManifest, SiteBookAppSlug } from "./_shared/manifest";
import projectCost from "./project-cost/manifest";
import homeCare   from "./home-care/manifest";

export const SITEBOOK_APPS: Record<SiteBookAppSlug, SiteBookAppManifest> = {
  "home-care":      homeCare,           // default-installed retention hook
  "project-cost":   projectCost,
  // Placeholder entries for apps we've built but not yet lifted into
  // manifest form. Uncomment as each migration completes:
  //
  // "photo-library":   photoLibrary,
  // "cost-ledger":     costLedger,
  // "documents":       documents,
  // "snag-list":       snagList,
  // "warranty-vault":  warrantyVault
} as unknown as Record<SiteBookAppSlug, SiteBookAppManifest>;

/** All apps that ship with a `defaultInstalled: true` flag. Used at
 *  first-visit to auto-populate a homeowner's app list. */
export function defaultInstalledSlugs(): SiteBookAppSlug[] {
  return Object.values(SITEBOOK_APPS)
    .filter((m) => m.defaultInstalled === true)
    .map((m) => m.slug);
}

/** All apps in registration order — used by the App Store grid. */
export function allApps(): SiteBookAppManifest[] {
  return Object.values(SITEBOOK_APPS);
}

export function appBySlug(slug: SiteBookAppSlug): SiteBookAppManifest | null {
  return SITEBOOK_APPS[slug] ?? null;
}
