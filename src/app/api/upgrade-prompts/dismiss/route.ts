// POST /api/upgrade-prompts/dismiss  { slug, key }
//
// Client-fired when the merchant taps the X on an upgrade prompt.
// Records dismissal so the same prompt isn't shown next dashboard
// render. Also records that it WAS shown (via markShown → insert)
// so we count the impression even if the merchant dismisses fast.
//
// Best-effort — never blocks the UI response.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { markShown, markDismissed, type PromptKey } from "@/lib/upgradePrompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_KEYS = new Set<PromptKey>([
  "views5", "products10", "beacon-nowashers", "contacts10", "firstProduct", "referSuccess"
]);

export async function POST(req: Request) {
  let body: { slug?: unknown; key?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 }); }

  const slug = typeof body.slug === "string" ? body.slug : "";
  const key  = typeof body.key  === "string" ? body.key  : "";
  if (!slug || !VALID_KEYS.has(key as PromptKey)) {
    return NextResponse.json({ ok: false, error: "invalid-fields" }, { status: 400 });
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!listing.data) {
    return NextResponse.json({ ok: false, error: "listing-not-found" }, { status: 404 });
  }

  const listingId = listing.data.id as string;
  await markShown(listingId, key as PromptKey);
  await markDismissed(listingId, key as PromptKey);
  return NextResponse.json({ ok: true });
}
