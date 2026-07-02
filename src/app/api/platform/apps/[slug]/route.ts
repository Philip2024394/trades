// GET /api/platform/apps/[slug]
//
// Single-manifest lookup — powers the App Store's detail route. The
// response is enriched with per-merchant install state + eligibility
// so the detail page renders in a single pass.

import { NextResponse } from "next/server";
import { appRegistry } from "@/platform/registry";
import { runtime as platformRuntime } from "@/platform/runtime";
import { canInstallApp } from "@/platform/appEligibility";
import { loadStudioSession } from "@/lib/studio/session";
import { supabase } from "@/lib/supabase";
import "@/platform/apps";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }

  const { slug } = await params;
  const manifest = appRegistry.get(slug);
  if (!manifest) {
    return NextResponse.json(
      { ok: false, error: "not-found" },
      { status: 404 }
    );
  }

  const install = await platformRuntime.getInstalledApp(session.merchant.id, slug);

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
  const eligibility = listing
    ? canInstallApp(manifest, listing)
    : ({ eligible: false, reason: "requires-paid", upgradeLabel: "Sign in" } as const);

  return NextResponse.json({
    ok: true,
    manifest,
    install,
    eligibility,
    // Dependency resolution so the detail page can show "requires: X, Y"
    dependencies: manifest.requirements.dependencies
      .map((depSlug) => appRegistry.get(depSlug))
      .filter((m): m is NonNullable<typeof m> => !!m)
  });
}
