// Platform Runtime — uninstall pipeline.
//
// The single authoritative entry point for uninstalling an App from a
// merchant. Soft-uninstall is the default (data preserved, ledger row
// stays with uninstalled_at set, App-created pages hidden). Purge is a
// separate destructive path requested explicitly by the caller.
//
// Pipeline steps:
//   1. Resolve manifest + ledger row
//   2. Check no other installed App depends on this one
//   3. Run onUninstall lifecycle hook (skeleton in v1)
//   4. Hide (or delete) App-created pages
//   5. Mark uninstalled (or purge) the ledger row

import { appRegistry } from "../registry";
import {
  getInstalledApp,
  listActiveInstalls,
  markUninstalled,
  purgeInstall
} from "./installedApps";
import {
  deleteAppPages,
  hideAppPages,
  resolveDefaultBrandId
} from "./pageManagement";
import { invokeLifecycleHook } from "./hooks";
import type { UninstallOptions, UninstallResult } from "./types";

export async function uninstallApp(
  slug: string,
  opts: UninstallOptions
): Promise<UninstallResult> {
  const manifest = appRegistry.get(slug);
  const row = await getInstalledApp(opts.merchantId, slug);
  if (!row || row.uninstalled_at) {
    return { ok: false, error: { code: "not-installed", slug } };
  }

  // ─── Reverse-dependency check ───────────────────────────────
  const active = await listActiveInstalls(opts.merchantId);
  const requiredBy: string[] = [];
  for (const other of active) {
    if (other.app_slug === slug) continue;
    const otherManifest = appRegistry.get(other.app_slug);
    if (otherManifest?.requirements.dependencies.includes(slug)) {
      requiredBy.push(other.app_slug);
    }
  }
  if (requiredBy.length > 0) {
    return {
      ok: false,
      error: { code: "required-by-other", slug, requiredBy }
    };
  }

  // ─── Resolve brand ──────────────────────────────────────────
  const brandId = await resolveDefaultBrandId(opts.merchantId);

  // ─── Lifecycle: onUninstall ─────────────────────────────────
  if (manifest) {
    const hookResult = await invokeLifecycleHook(manifest, "onUninstall", {
      merchantId: opts.merchantId,
      brandId,
      config: row.config_json
    });
    if (!hookResult.ok) {
      return {
        ok: false,
        error: {
          code: "lifecycle-hook-failed",
          slug,
          hook: "onUninstall",
          reason: hookResult.reason
        }
      };
    }
  }

  // ─── Pages ──────────────────────────────────────────────────
  try {
    if (brandId) {
      if (opts.purgeData) {
        await deleteAppPages({ brandId, appSlug: slug });
      } else {
        await hideAppPages({ brandId, appSlug: slug });
      }
    }
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "db-error",
        slug,
        reason: (err as Error)?.message ?? "page management failed"
      }
    };
  }

  // ─── Ledger ─────────────────────────────────────────────────
  try {
    if (opts.purgeData) {
      await purgeInstall(opts.merchantId, slug);
    } else {
      await markUninstalled(opts.merchantId, slug);
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

  return {
    ok: true,
    slug,
    preservedPages: row.created_pages,
    purged: !!opts.purgeData
  };
}
