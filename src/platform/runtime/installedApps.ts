// Platform Runtime — installed_apps DB layer.
//
// CRUD helpers over public.installed_apps. Every write goes through
// supabaseAdmin (server-only). The Runtime never exposes raw rows to
// consumers — everything above this layer works with typed `InstalledAppRow`.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { InstalledAppRow } from "./types";

const COLS =
  "id, merchant_id, app_slug, version, config_json, installed_at, " +
  "upgraded_at, uninstalled_at, created_pages";

function coerce(row: unknown): InstalledAppRow {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    merchant_id: r.merchant_id as string,
    app_slug: r.app_slug as string,
    version: r.version as string,
    config_json: (r.config_json as Record<string, unknown>) ?? {},
    installed_at: r.installed_at as string,
    upgraded_at: (r.upgraded_at as string | null) ?? null,
    uninstalled_at: (r.uninstalled_at as string | null) ?? null,
    created_pages: Array.isArray(r.created_pages)
      ? (r.created_pages as string[])
      : []
  };
}

/** Any row for this (merchant, app) — active OR uninstalled. Used to
 *  detect reinstall scenarios. */
export async function getInstalledApp(
  merchantId: string,
  slug: string
): Promise<InstalledAppRow | null> {
  const res = await supabaseAdmin
    .from("installed_apps")
    .select(COLS)
    .eq("merchant_id", merchantId)
    .eq("app_slug", slug)
    .maybeSingle();
  if (res.error || !res.data) return null;
  return coerce(res.data);
}

/** Active installs (uninstalled_at IS NULL) for a merchant. Sorted by
 *  install date so the App Store's "Your apps" tab shows most-recent
 *  first. */
export async function listActiveInstalls(
  merchantId: string
): Promise<InstalledAppRow[]> {
  const res = await supabaseAdmin
    .from("installed_apps")
    .select(COLS)
    .eq("merchant_id", merchantId)
    .is("uninstalled_at", null)
    .order("installed_at", { ascending: false });
  if (res.error || !res.data) return [];
  return res.data.map(coerce);
}

/** Insert a fresh install row. Throws on DB error so the caller can
 *  translate to the InstallErr envelope. */
export async function insertInstall(args: {
  merchantId: string;
  slug: string;
  version: string;
  config: Record<string, unknown>;
  createdPages: string[];
}): Promise<InstalledAppRow> {
  const res = await supabaseAdmin
    .from("installed_apps")
    .insert({
      merchant_id: args.merchantId,
      app_slug: args.slug,
      version: args.version,
      config_json: args.config,
      created_pages: args.createdPages
    })
    .select(COLS)
    .maybeSingle();
  if (res.error || !res.data) {
    throw new Error(res.error?.message ?? "installed_apps insert failed");
  }
  return coerce(res.data);
}

/** Reactivate a soft-uninstalled row. Clears uninstalled_at, updates
 *  version + config, and returns the refreshed row. */
export async function reactivateInstall(args: {
  merchantId: string;
  slug: string;
  version: string;
  config: Record<string, unknown>;
  createdPages: string[];
}): Promise<InstalledAppRow> {
  const res = await supabaseAdmin
    .from("installed_apps")
    .update({
      version: args.version,
      config_json: args.config,
      created_pages: args.createdPages,
      uninstalled_at: null,
      installed_at: new Date().toISOString()
    })
    .eq("merchant_id", args.merchantId)
    .eq("app_slug", args.slug)
    .select(COLS)
    .maybeSingle();
  if (res.error || !res.data) {
    throw new Error(res.error?.message ?? "installed_apps reactivate failed");
  }
  return coerce(res.data);
}

/** Soft-uninstall — set uninstalled_at. The row stays in the ledger
 *  and app-owned data is preserved for a future reinstall. */
export async function markUninstalled(
  merchantId: string,
  slug: string
): Promise<void> {
  const res = await supabaseAdmin
    .from("installed_apps")
    .update({ uninstalled_at: new Date().toISOString() })
    .eq("merchant_id", merchantId)
    .eq("app_slug", slug);
  if (res.error) {
    throw new Error(res.error.message);
  }
}

/** Hard-delete the install row. Called only when the merchant
 *  explicitly requests data purge; the runtime is responsible for
 *  dropping app-owned tables (deferred to a later Runtime phase). */
export async function purgeInstall(
  merchantId: string,
  slug: string
): Promise<void> {
  const res = await supabaseAdmin
    .from("installed_apps")
    .delete()
    .eq("merchant_id", merchantId)
    .eq("app_slug", slug);
  if (res.error) {
    throw new Error(res.error.message);
  }
}
