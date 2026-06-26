// POST /api/trade-off/addons/toggle
// Magic-link authenticated. Body: { slug, edit_token, addon_slug, enabled }.
// Validates addon_slug against the XRATED_ADDONS registry, rejects paid
// add-ons for non-paid listings, then merges the flag into addons_enabled.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { XRATED_ADDONS } from "@/lib/xratedAddons";
import { effectiveTier } from "@/lib/xratedTrades";

export const runtime = "nodejs";

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const slug = s(body.slug);
  const token = s(body.edit_token);
  const addonSlug = s(body.addon_slug);
  const enabled = body.enabled === true || body.enabled === "true" || body.enabled === 1;

  if (!slug || !token || !addonSlug) {
    return NextResponse.json(
      { ok: false, error: "Missing slug, edit_token, or addon_slug." },
      { status: 400 }
    );
  }

  const addon = XRATED_ADDONS.find((a) => a.slug === addonSlug);
  if (!addon) {
    return NextResponse.json({ ok: false, error: "Unknown add-on." }, { status: 400 });
  }
  if (addon.availability === "coming_soon") {
    return NextResponse.json(
      { ok: false, error: "This add-on is coming soon." },
      { status: 400 }
    );
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token, tier, trial_expires_at, addons_enabled")
    .eq("slug", slug)
    .maybeSingle();

  if (!listing.data) {
    return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
  }
  if (!constantTimeEq(listing.data.edit_token, token)) {
    return NextResponse.json({ ok: false, error: "Invalid edit token." }, { status: 403 });
  }

  const tier = effectiveTier({
    tier: listing.data.tier ?? "standard",
    trial_expires_at: listing.data.trial_expires_at ?? null
  });
  const isPaid = tier === "app_trial" || tier === "app_paid";

  if (addon.pricing.kind === "paid" && enabled && !isPaid) {
    return NextResponse.json(
      { ok: false, error: "Upgrade required to enable this add-on." },
      { status: 403 }
    );
  }

  const current =
    listing.data.addons_enabled && typeof listing.data.addons_enabled === "object"
      ? (listing.data.addons_enabled as Record<string, boolean>)
      : {};
  const next: Record<string, boolean> = { ...current, [addonSlug]: enabled };

  const upd = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update({ addons_enabled: next })
    .eq("id", listing.data.id)
    .select("addons_enabled")
    .maybeSingle();

  if (upd.error || !upd.data) {
    console.error("[trade-off/addons/toggle] update failed:", upd.error);
    return NextResponse.json(
      { ok: false, error: upd.error?.message ?? "Update failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, addons_enabled: upd.data.addons_enabled });
}
