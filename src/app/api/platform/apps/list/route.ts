// GET /api/platform/apps/list
//   ?category=…&industry=…&page=…
//
// Returns every registered manifest, optionally filtered, enriched
// with per-merchant eligibility + install state so the App Store card
// can render "Install" / "Upgrade" / "Manage" in a single pass.
//
// No App slugs are hardcoded — the response is composed entirely from
// appRegistry.list() + runtime.listActiveInstalls().

import { NextResponse } from "next/server";
import { appRegistry } from "@/platform/registry";
import { runtime as platformRuntime } from "@/platform/runtime";
import { canInstallApp } from "@/platform/appEligibility";
import { loadStudioSession } from "@/lib/studio/session";
import { supabase } from "@/lib/supabase";
// Populate the platform's App Registry. The barrel at src/platform/apps
// fans out to every `src/apps/*/manifest.ts` so appRegistry.list() is
// populated at module-load time — no runtime discovery.
import "@/platform/apps";

export const runtime = "nodejs";
export const revalidate = 0;

type InstallState =
  | { kind: "not-installed" }
  | { kind: "installed"; version: string; installedAt: string }
  | { kind: "previously-installed"; version: string; uninstalledAt: string };

export async function GET(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const industry = url.searchParams.get("industry");
  const pageId = url.searchParams.get("page");

  // Load the merchant listing once — needed for eligibility.
  const listingRes = await supabase
    .from("hammerex_trade_off_listings")
    .select("id, primary_trade, tier, trial_expires_at")
    .eq("id", session.merchant.id)
    .maybeSingle();
  const listing = listingRes.data as
    | {
        id: string;
        primary_trade: string;
        tier: import("@/lib/xratedTrades").XratedTier;
        trial_expires_at: string | null;
      }
    | null;

  // Filter manifests by the requested facets.
  let manifests = appRegistry.list();
  if (category) {
    manifests = manifests.filter((m) => m.category === category);
  }
  if (industry) {
    manifests = manifests.filter(
      (m) =>
        m.compatibility.industries.includes("*") ||
        m.compatibility.industries.includes(industry)
    );
  }
  if (pageId) {
    manifests = manifests.filter(
      (m) =>
        m.compatibility.pages.includes("*") ||
        m.compatibility.pages.includes(pageId)
    );
  }

  // Batch-load install state.
  const installs = await platformRuntime.listActiveInstalls(session.merchant.id);
  const installsBySlug = new Map(installs.map((r) => [r.app_slug, r]));

  const items = manifests.map((m) => {
    const install = installsBySlug.get(m.slug);
    let installState: InstallState;
    if (install && !install.uninstalled_at) {
      installState = {
        kind: "installed",
        version: install.version,
        installedAt: install.installed_at
      };
    } else if (install && install.uninstalled_at) {
      installState = {
        kind: "previously-installed",
        version: install.version,
        uninstalledAt: install.uninstalled_at
      };
    } else {
      installState = { kind: "not-installed" };
    }

    const eligibility = listing
      ? canInstallApp(m, listing)
      : ({ eligible: false, reason: "requires-paid", upgradeLabel: "Sign in" } as const);

    return {
      manifest: m,
      installState,
      eligibility
    };
  });

  const categories = Array.from(
    new Set(appRegistry.list().map((m) => m.category))
  ).sort();

  return NextResponse.json({
    ok: true,
    items,
    totalRegistered: appRegistry.size(),
    facets: { categories }
  });
}
