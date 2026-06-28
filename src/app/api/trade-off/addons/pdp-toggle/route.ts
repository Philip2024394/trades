// POST /api/trade-off/addons/pdp-toggle
// Magic-link authenticated. Body: { slug, edit_token, key, enabled }.
//
// Sister endpoint to /addons/toggle. Where that route gates each toggle
// against the XRATED_ADDONS registry (and the paid-tier gate), this
// route allows a small allow-list of PDP rendering preferences that
// live in `addons_enabled` but aren't real marketing-card add-ons:
//
//   compare_section   — show the compare-3 strip on the PDP (default ON)
//   qa                — show the Q&A WhatsApp CTA block (default OFF)
//   warranty_returns  — show the warranty/returns standalone block (default ON)
//   spec_tab          — show the Spec tab in ProductDetailsTabs (default ON)
//   delivery_tab      — show the Delivery Details tab in ProductDetailsTabs (default ON)
//
// All are free and available on every tier; the registry has no
// matching entry on purpose (they'd add noise to the marketing surface).

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const ALLOWED_KEYS = new Set([
  "compare_section",
  "qa",
  "warranty_returns",
  "spec_tab",
  "delivery_tab"
]);

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
  const key = s(body.key);
  const enabled = body.enabled === true || body.enabled === "true" || body.enabled === 1;

  if (!slug || !token || !key) {
    return NextResponse.json(
      { ok: false, error: "Missing slug, edit_token, or key." },
      { status: 400 }
    );
  }
  if (!ALLOWED_KEYS.has(key)) {
    return NextResponse.json(
      { ok: false, error: "Unknown PDP toggle." },
      { status: 400 }
    );
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token, addons_enabled")
    .eq("slug", slug)
    .maybeSingle();

  if (!listing.data) {
    return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
  }
  if (!constantTimeEq(listing.data.edit_token, token)) {
    return NextResponse.json({ ok: false, error: "Invalid edit token." }, { status: 403 });
  }

  const current =
    listing.data.addons_enabled && typeof listing.data.addons_enabled === "object"
      ? (listing.data.addons_enabled as Record<string, boolean>)
      : {};
  const next: Record<string, boolean> = { ...current, [key]: enabled };

  const upd = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update({ addons_enabled: next })
    .eq("id", listing.data.id)
    .select("addons_enabled")
    .maybeSingle();

  if (upd.error || !upd.data) {
    console.error("[trade-off/addons/pdp-toggle] update failed:", upd.error);
    return NextResponse.json(
      { ok: false, error: upd.error?.message ?? "Update failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, addons_enabled: upd.data.addons_enabled });
}
