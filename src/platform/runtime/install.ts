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
  InstalledAppRow,
  PreflightBypass
} from "./types";

/** Whitelisted preflight-bypass sources (Philip 2026-08-14 security fix).
 *
 *  Adding a new source is a security decision — do NOT add without an
 *  audit review. Every bypass is logged (see logPreflightBypass) so the
 *  security team can trace who bypassed and why.
 *
 *  Explicitly NOT included: any string a merchant/customer/NL prompt
 *  could ever provide. */
const PREFLIGHT_BYPASS_WHITELIST = new Set<PreflightBypass["source"]>([
  "industry-pack-installer",
  "migration-script",
  "admin-override"
]);

function logPreflightBypass(slug: string, bypass: PreflightBypass) {
  // Grep-able structured log — every bypass audit-traceable.
  // TODO(app-builder-security): replace with a durable audit table
  // (installed_apps_preflight_bypasses) once the audit surface exists.
  const payload = {
    event: "installApp.preflight.bypass",
    at: new Date().toISOString(),
    slug,
    source: bypass.source,
    ...(bypass.source === "industry-pack-installer" ? { packSlug: bypass.packSlug } : {}),
    ...(bypass.source === "migration-script" ? { scriptId: bypass.scriptId } : {}),
    ...(bypass.source === "admin-override"
      ? { adminId: bypass.adminId, reason: bypass.reason }
      : {})
  };
  // eslint-disable-next-line no-console
  console.warn("[SECURITY]", JSON.stringify(payload));
}

export async function installApp(
  slug: string,
  opts: InstallOptions
): Promise<InstallResult> {
  const manifest = appRegistry.get(slug);
  if (!manifest) {
    return { ok: false, error: { code: "unknown-app", slug } };
  }

  const merchantId = opts.merchantId;

  // ─── Preflight bypass validation ────────────────────────────
  // Structured bypass grants are the ONLY way to skip preflight.
  // Any bypass with a non-whitelisted source is rejected. This closes
  // the pre-2026-08-14 hole where `skipPreflight: true` (a plain bool)
  // could be flipped by any code path — including NL-routed installs.
  let bypassPreflight = false;
  if (opts.preflightBypass) {
    if (!PREFLIGHT_BYPASS_WHITELIST.has(opts.preflightBypass.source)) {
      return {
        ok: false,
        error: {
          code: "preflight-bypass-rejected",
          slug,
          reason: `bypass source "${opts.preflightBypass.source}" is not whitelisted`
        }
      };
    }
    // admin-override MUST include a non-empty reason (audit trail requirement)
    if (
      opts.preflightBypass.source === "admin-override" &&
      (!opts.preflightBypass.reason || opts.preflightBypass.reason.trim().length === 0)
    ) {
      return {
        ok: false,
        error: {
          code: "preflight-bypass-rejected",
          slug,
          reason: "admin-override bypass requires a non-empty reason"
        }
      };
    }
    bypassPreflight = true;
    logPreflightBypass(slug, opts.preflightBypass);
  }

  // ─── Preflight ──────────────────────────────────────────────
  const existing = await getInstalledApp(merchantId, slug);
  const isReinstall = !!existing && !!existing.uninstalled_at;

  if (!bypassPreflight) {
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
    // installer, migration scripts) must present a structured
    // preflightBypass grant with a whitelisted source (see top of file).
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
