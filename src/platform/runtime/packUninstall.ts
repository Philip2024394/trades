// Platform Runtime — pack uninstall pipeline.
//
// Soft-uninstalls every App the pack brought in, then marks the
// installed_packs row uninstalled. Brand tokens + home layout are
// NEVER reverted — merchant customisations survive uninstall.
//
// Purge (purgeData=true) is stricter: hard-uninstalls apps with data
// purge AND removes the installed_packs row. Still doesn't touch
// brand tokens/layouts — those belong to the merchant, not the pack.

import { uninstallApp } from "./uninstall";
import {
  getInstalledPack,
  markPackUninstalled
} from "./installedPacks";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type PackUninstallOptions = {
  merchantId: string;
  purgeData?: boolean;
};

export type PackUninstallResult =
  | {
      ok: true;
      slug: string;
      uninstalledApps: string[];
      failedApps: { slug: string; reason: string }[];
      purged: boolean;
    }
  | { ok: false; error: PackUninstallError };

export type PackUninstallError =
  | { code: "not-installed"; slug: string }
  | { code: "db-error"; slug: string; reason: string };

export async function uninstallPack(
  packSlug: string,
  opts: PackUninstallOptions
): Promise<PackUninstallResult> {
  const row = await getInstalledPack(opts.merchantId, packSlug);
  if (!row || row.uninstalled_at) {
    return { ok: false, error: { code: "not-installed", slug: packSlug } };
  }

  const uninstalledApps: string[] = [];
  const failedApps: { slug: string; reason: string }[] = [];

  for (const appSlug of row.installed_apps) {
    const res = await uninstallApp(appSlug, {
      merchantId: opts.merchantId,
      purgeData: !!opts.purgeData
    });
    if (res.ok) {
      uninstalledApps.push(appSlug);
    } else {
      failedApps.push({ slug: appSlug, reason: res.error.code });
    }
  }

  try {
    if (opts.purgeData) {
      const del = await supabaseAdmin
        .from("installed_packs")
        .delete()
        .eq("merchant_id", opts.merchantId)
        .eq("pack_slug", packSlug);
      if (del.error) throw new Error(del.error.message);
    } else {
      await markPackUninstalled(opts.merchantId, packSlug);
    }
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "db-error",
        slug: packSlug,
        reason: (err as Error).message ?? "ledger update failed"
      }
    };
  }

  return {
    ok: true,
    slug: packSlug,
    uninstalledApps,
    failedApps,
    purged: !!opts.purgeData
  };
}
