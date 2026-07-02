// Platform Runtime — install pipeline.
//
// The single authoritative entry point for installing an App on a
// merchant. Every install path (App Store button, Industry Pack
// installer, AI recommender, migration script) MUST call this
// function — never insert into installed_apps directly.
//
// Pipeline steps:
//   1. Resolve manifest from the App Registry
//   2. Preflight (dependencies, conflicts, plan, already-installed)
//   3. Resolve the merchant's default brand id
//   4. Run onInstall lifecycle hook (skeleton in v1)
//   5. Materialise every page declared in compatibility.createsPages
//   6. Insert or reactivate the installed_apps ledger row
//
// Everything returns a typed result envelope — the pipeline never
// throws to callers.

import { appRegistry } from "../registry";
import {
  getInstalledApp,
  insertInstall,
  listActiveInstalls,
  reactivateInstall
} from "./installedApps";
import { createAppPage, resolveDefaultBrandId } from "./pageManagement";
import { invokeLifecycleHook } from "./hooks";
import type {
  InstallOptions,
  InstallResult,
  InstalledAppRow
} from "./types";

export async function installApp(
  slug: string,
  opts: InstallOptions
): Promise<InstallResult> {
  const manifest = appRegistry.get(slug);
  if (!manifest) {
    return { ok: false, error: { code: "unknown-app", slug } };
  }

  const merchantId = opts.merchantId;

  // ─── Preflight ──────────────────────────────────────────────
  const existing = await getInstalledApp(merchantId, slug);
  const isReinstall = !!existing && !!existing.uninstalled_at;

  if (!opts.skipPreflight) {
    if (existing && !existing.uninstalled_at) {
      return { ok: false, error: { code: "already-installed", slug } };
    }

    // Dependencies — every dep must be actively installed.
    const active = await listActiveInstalls(merchantId);
    const activeSlugs = new Set(active.map((r) => r.app_slug));
    for (const depSlug of manifest.requirements.dependencies) {
      if (!activeSlugs.has(depSlug)) {
        return {
          ok: false,
          error: { code: "missing-dependency", slug, missing: depSlug }
        };
      }
    }

    // Conflicts — none of the active installs may be in our conflicts.
    for (const conflictSlug of manifest.requirements.conflicts) {
      if (activeSlugs.has(conflictSlug)) {
        return {
          ok: false,
          error: {
            code: "conflicting-app",
            slug,
            conflictsWith: conflictSlug
          }
        };
      }
    }

    // Plan gate — enforced upstream by the App Store's install button
    // when a merchant clicks Install. Runtime respects the manifest
    // declaration but does not itself resolve the merchant's tier
    // (that lookup lives with the existing tier helpers in
    // src/lib/tradeOff). Callers that bypass the Store (Industry Pack
    // installer, migration scripts) can pass skipPreflight to opt out.
  }

  // ─── Resolve brand ──────────────────────────────────────────
  const brandId = opts.brandId ?? (await resolveDefaultBrandId(merchantId));
  if (!brandId) {
    return { ok: false, error: { code: "no-default-brand", slug } };
  }

  // ─── Lifecycle: onInstall ───────────────────────────────────
  const hookResult = await invokeLifecycleHook(manifest, "onInstall", {
    merchantId,
    brandId,
    config: opts.config ?? {}
  });
  if (!hookResult.ok) {
    return {
      ok: false,
      error: {
        code: "lifecycle-hook-failed",
        slug,
        hook: "onInstall",
        reason: hookResult.reason
      }
    };
  }

  // ─── Materialise pages ──────────────────────────────────────
  const createdPages: string[] = [];
  try {
    for (const pageDecl of manifest.compatibility.createsPages) {
      const res = await createAppPage({
        brandId,
        appSlug: slug,
        page: pageDecl
      });
      createdPages.push(res.slug);
    }
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "db-error",
        slug,
        reason: (err as Error)?.message ?? "createAppPage failed"
      }
    };
  }

  // ─── Ledger write ───────────────────────────────────────────
  let row: InstalledAppRow;
  try {
    if (isReinstall) {
      row = await reactivateInstall({
        merchantId,
        slug,
        version: manifest.version,
        config: opts.config ?? existing.config_json,
        createdPages
      });
    } else {
      row = await insertInstall({
        merchantId,
        slug,
        version: manifest.version,
        config: opts.config ?? {},
        createdPages
      });
    }
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "db-error",
        slug,
        reason: (err as Error)?.message ?? "ledger write failed"
      }
    };
  }

  return { ok: true, installedApp: row, createdPages };
}
