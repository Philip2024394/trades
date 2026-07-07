// Studio Runtime — authoritative registry the storefront + editor
// both consume. Apps never talk to the DB or event bus directly;
// they go through this Runtime.
//
// Design invariants:
//   - Runtime is authoritative; SDK is a thin adapter (see memory
//     project_platform_runtime_vs_sdk)
//   - install/uninstall/nav-compose/slot rendering all live here
//   - No slug references anywhere in the Runtime — everything is
//     driven by manifest lookups

import { emitEvent } from "@/lib/events";
import { createClient } from "@supabase/supabase-js";
import type {
  StudioAppContext,
  StudioAppManifest
} from "./manifest";
import { findApp, STUDIO_APPS } from "./manifest";

function client() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Build the storage helper for an App — reads/writes go into the
 *  App's own JSONB row under app_<slug>_data keyed by merchant. */
function buildStorage(slug: string, merchantId: string): StudioAppContext["storage"] {
  return {
    async get(key: string) {
      const c = client();
      if (!c) return null;
      const { data } = await c
        .from("app_data")
        .select("value")
        .eq("app_slug", slug)
        .eq("merchant_id", merchantId)
        .eq("key", key)
        .maybeSingle();
      return data?.value ?? null;
    },
    async put(key: string, value: unknown) {
      const c = client();
      if (!c) return;
      await c.from("app_data").upsert(
        {
          app_slug: slug,
          merchant_id: merchantId,
          key,
          value
        },
        { onConflict: "app_slug,merchant_id,key" }
      );
    },
    async del(key: string) {
      const c = client();
      if (!c) return;
      await c
        .from("app_data")
        .delete()
        .eq("app_slug", slug)
        .eq("merchant_id", merchantId)
        .eq("key", key);
    }
  };
}

function buildContext(
  slug: string,
  merchantId: string
): StudioAppContext {
  return {
    merchantId,
    storage: buildStorage(slug, merchantId),
    async emit(eventType, payload) {
      await emitEvent({
        merchantId,
        eventType: eventType as never, // Apps validate their own event types
        payload
      });
    }
  };
}

/** Install an App for a merchant. Idempotent — a re-install is a
 *  no-op but re-runs the manifest's install hook, useful for feature
 *  upgrades that need extra rows. */
export async function installApp(
  slug: string,
  merchantId: string
): Promise<{ ok: boolean; reason?: string }> {
  const app = findApp(slug);
  if (!app) return { ok: false, reason: "unknown_app" };
  const c = client();
  if (c) {
    await c.from("app_installations").upsert(
      {
        merchant_id: merchantId,
        app_slug: slug,
        installed_version: app.version,
        installed_at: new Date().toISOString()
      },
      { onConflict: "merchant_id,app_slug" }
    );
  }
  if (app.install) {
    await app.install(buildContext(slug, merchantId));
  }
  return { ok: true };
}

/** Uninstall — flips the row to inactive + calls the hook. Actual
 *  data deletion is up to the App's uninstall hook. */
export async function uninstallApp(
  slug: string,
  merchantId: string
): Promise<{ ok: boolean; reason?: string }> {
  const app = findApp(slug);
  if (!app) return { ok: false, reason: "unknown_app" };
  const c = client();
  if (c) {
    await c
      .from("app_installations")
      .update({ uninstalled_at: new Date().toISOString(), active: false })
      .eq("merchant_id", merchantId)
      .eq("app_slug", slug);
  }
  if (app.uninstall) {
    await app.uninstall(buildContext(slug, merchantId));
  }
  return { ok: true };
}

/** Return the list of Apps a merchant currently has installed. */
export async function installedAppsFor(
  merchantId: string
): Promise<StudioAppManifest[]> {
  const c = client();
  if (!c) return [];
  const { data } = await c
    .from("app_installations")
    .select("app_slug, active")
    .eq("merchant_id", merchantId);
  const active = new Set(
    ((data ?? []) as Array<{ app_slug: string; active: boolean }>)
      .filter((r) => r.active !== false)
      .map((r) => r.app_slug)
  );
  return STUDIO_APPS.filter((a) => active.has(a.slug));
}

/** Every registered App — for the App Store surface. */
export function catalogue(): StudioAppManifest[] {
  return STUDIO_APPS;
}
