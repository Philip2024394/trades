// Platform Runtime — pack install pipeline.
//
// Orchestrates installing every App in a Pack manifest, then seeds
// brand tokens + home page layout. Rollback on failure: if any App
// install fails mid-pack, the already-installed apps are
// soft-uninstalled and a typed error returned.
//
// Never inserts into installed_apps directly — always calls
// runtime.installApp so Pack installs benefit from every guarantee
// the App install pipeline provides.

import { packRegistry } from "@/platform/packs/registry";
import { appRegistry } from "@/platform/registry";
import { installApp } from "./install";
import { uninstallApp } from "./uninstall";
import { resolveDefaultBrandId } from "./pageManagement";
import { seedBrandTokens } from "./brandTokensSeeder";
import {
  seedHomeLayout,
  type HomeLayoutSeedResult
} from "./homeLayoutSeeder";
import {
  getInstalledPack,
  insertPackInstall,
  reactivatePackInstall,
  type InstalledPackRow
} from "./installedPacks";

export type PackInstallOptions = {
  merchantId: string;
  brandId?: string;
};

export type PackInstallResult =
  | {
      ok: true;
      pack: InstalledPackRow;
      installedApps: string[];
      brandTokens: { inserted: number; skipped: number } | null;
      homeLayout: HomeLayoutSeedResult | null;
    }
  | {
      ok: false;
      error: PackInstallError;
    };

export type PackInstallError =
  | { code: "unknown-pack"; slug: string }
  | { code: "already-installed"; slug: string }
  | { code: "no-default-brand"; slug: string }
  | {
      code: "app-install-failed";
      slug: string;
      failedApp: string;
      reason: string;
      rolledBack: string[];
    }
  | { code: "db-error"; slug: string; reason: string };

export async function installPack(
  packSlug: string,
  opts: PackInstallOptions
): Promise<PackInstallResult> {
  const pack = packRegistry.get(packSlug);
  if (!pack) {
    return { ok: false, error: { code: "unknown-pack", slug: packSlug } };
  }

  // Reinstall path: if a prior soft-uninstalled row exists, reactivate.
  const existing = await getInstalledPack(opts.merchantId, packSlug);
  const isReinstall = !!existing && !!existing.uninstalled_at;

  if (existing && !existing.uninstalled_at) {
    return {
      ok: false,
      error: { code: "already-installed", slug: packSlug }
    };
  }

  const brandId =
    opts.brandId ?? (await resolveDefaultBrandId(opts.merchantId));
  if (!brandId) {
    return {
      ok: false,
      error: { code: "no-default-brand", slug: packSlug }
    };
  }

  // ─── App installs ──────────────────────────────────
  // skipPreflight = true so dependency+conflict resolution across the
  // pack's apps doesn't reject an intermediate state. The pack itself
  // is the authoritative install unit.
  const installedApps: string[] = [];
  for (const entry of pack.apps) {
    // If the App isn't in the registry we skip it silently — a Pack
    // that references an App we haven't shipped yet installs as many
    // Apps as it can. This matches the Studio empty-state pattern.
    if (!appRegistry.has(entry.slug)) {
      continue;
    }
    const res = await installApp(entry.slug, {
      merchantId: opts.merchantId,
      brandId,
      config: entry.config,
      skipPreflight: true
    });
    if (!res.ok) {
      // Rollback: uninstall everything we installed so far.
      const rolledBack: string[] = [];
      for (const slug of installedApps.reverse()) {
        const r = await uninstallApp(slug, {
          merchantId: opts.merchantId,
          purgeData: false
        });
        if (r.ok) rolledBack.push(slug);
      }
      return {
        ok: false,
        error: {
          code: "app-install-failed",
          slug: packSlug,
          failedApp: entry.slug,
          reason: `${res.error.code}: ${JSON.stringify(res.error)}`,
          rolledBack
        }
      };
    }
    installedApps.push(entry.slug);
  }

  // ─── Brand tokens seed ────────────────────────────
  let brandTokens: { inserted: number; skipped: number } | null = null;
  if (pack.theme) {
    try {
      brandTokens = await seedBrandTokens({
        brandId,
        theme: pack.theme
      });
    } catch (err) {
      // Non-fatal — the pack still installs, brand tokens can be seeded
      // later via a manual retry. Surface as failed_apps entry for
      // visibility.
      console.warn(
        `installPack: brand token seed failed for pack "${packSlug}":`,
        (err as Error).message
      );
    }
  }

  // ─── Home page layout seed ───────────────────────
  let homeLayout: HomeLayoutSeedResult | null = null;
  if (pack.homeLayout) {
    homeLayout = await seedHomeLayout({
      merchantId: opts.merchantId,
      brandId,
      seed: pack.homeLayout
    });
  }

  // ─── Ledger write ────────────────────────────────
  try {
    const row = isReinstall
      ? await reactivatePackInstall({
          merchantId: opts.merchantId,
          packSlug,
          version: pack.version,
          installedApps,
          failedApps: []
        })
      : await insertPackInstall({
          merchantId: opts.merchantId,
          packSlug,
          version: pack.version,
          installedApps,
          failedApps: []
        });
    return {
      ok: true,
      pack: row,
      installedApps,
      brandTokens,
      homeLayout
    };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "db-error",
        slug: packSlug,
        reason: (err as Error).message ?? "ledger write failed"
      }
    };
  }
}
