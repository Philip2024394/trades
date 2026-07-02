// Platform Runtime — installed_packs DB layer.
//
// CRUD over public.installed_packs. Mirrors installedApps.ts patterns.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

const COLS =
  "id, merchant_id, pack_slug, version, installed_at, uninstalled_at, installed_apps, failed_apps";

export type InstalledPackRow = {
  id: string;
  merchant_id: string;
  pack_slug: string;
  version: string;
  installed_at: string;
  uninstalled_at: string | null;
  installed_apps: string[];
  failed_apps: string[];
};

function coerce(row: unknown): InstalledPackRow {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    merchant_id: r.merchant_id as string,
    pack_slug: r.pack_slug as string,
    version: r.version as string,
    installed_at: r.installed_at as string,
    uninstalled_at: (r.uninstalled_at as string | null) ?? null,
    installed_apps: Array.isArray(r.installed_apps)
      ? (r.installed_apps as string[])
      : [],
    failed_apps: Array.isArray(r.failed_apps)
      ? (r.failed_apps as string[])
      : []
  };
}

export async function getInstalledPack(
  merchantId: string,
  slug: string
): Promise<InstalledPackRow | null> {
  const res = await supabaseAdmin
    .from("installed_packs")
    .select(COLS)
    .eq("merchant_id", merchantId)
    .eq("pack_slug", slug)
    .maybeSingle();
  if (res.error || !res.data) return null;
  return coerce(res.data);
}

export async function listActivePackInstalls(
  merchantId: string
): Promise<InstalledPackRow[]> {
  const res = await supabaseAdmin
    .from("installed_packs")
    .select(COLS)
    .eq("merchant_id", merchantId)
    .is("uninstalled_at", null)
    .order("installed_at", { ascending: false });
  if (res.error || !res.data) return [];
  return res.data.map(coerce);
}

export async function insertPackInstall(args: {
  merchantId: string;
  packSlug: string;
  version: string;
  installedApps: string[];
  failedApps: string[];
}): Promise<InstalledPackRow> {
  const res = await supabaseAdmin
    .from("installed_packs")
    .insert({
      merchant_id: args.merchantId,
      pack_slug: args.packSlug,
      version: args.version,
      installed_apps: args.installedApps,
      failed_apps: args.failedApps
    })
    .select(COLS)
    .maybeSingle();
  if (res.error || !res.data) {
    throw new Error(res.error?.message ?? "installed_packs insert failed");
  }
  return coerce(res.data);
}

export async function reactivatePackInstall(args: {
  merchantId: string;
  packSlug: string;
  version: string;
  installedApps: string[];
  failedApps: string[];
}): Promise<InstalledPackRow> {
  const res = await supabaseAdmin
    .from("installed_packs")
    .update({
      version: args.version,
      installed_apps: args.installedApps,
      failed_apps: args.failedApps,
      uninstalled_at: null,
      installed_at: new Date().toISOString()
    })
    .eq("merchant_id", args.merchantId)
    .eq("pack_slug", args.packSlug)
    .select(COLS)
    .maybeSingle();
  if (res.error || !res.data) {
    throw new Error(res.error?.message ?? "installed_packs reactivate failed");
  }
  return coerce(res.data);
}

export async function markPackUninstalled(
  merchantId: string,
  packSlug: string
): Promise<void> {
  const res = await supabaseAdmin
    .from("installed_packs")
    .update({ uninstalled_at: new Date().toISOString() })
    .eq("merchant_id", merchantId)
    .eq("pack_slug", packSlug);
  if (res.error) throw new Error(res.error.message);
}
