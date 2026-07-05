// Slug suggestion + availability check for the Publish-Live dialog.
//
//   GET /api/studio/slug-suggest?base=<slug>&city=<optional>
//     → { ok, requested: { slug, available }, alternates: [{slug, available}] }
//
// The dialog fires this 300ms after the user stops typing. We check
// the requested slug + build up to 6 candidate alternates and check
// which of them are free. Alternates are ordered by desirability:
//   1. base-city         (e.g. smith-carpentry-norwich)
//   2. base-<trade>      (e.g. smith-carpentry-carpenter)
//   3. base-uk
//   4. base-1..3         (trailing digit)

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadStudioSession } from "@/lib/studio/session";
import { slugifyXrated, validateXratedSlug } from "@/lib/xratedSlug";
import { isReservedSlug } from "@/lib/tradeOff";

export const runtime = "nodejs";

type SlugCheck = { slug: string; available: boolean; reason?: string };

async function checkSlug(slug: string, ownedByCurrent: string): Promise<SlugCheck> {
  if (slug === ownedByCurrent) return { slug, available: true };
  const err = validateXratedSlug(slug);
  if (err) return { slug, available: false, reason: err };
  if (isReservedSlug(slug))
    return { slug, available: false, reason: "reserved" };
  const res = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (res.error && res.error.code !== "PGRST116") {
    return { slug, available: false, reason: "error" };
  }
  return { slug, available: !res.data };
}

export async function GET(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }
  const url = new URL(req.url);
  const rawBase = (url.searchParams.get("base") ?? "").trim();
  const city = (url.searchParams.get("city") ?? session.merchant.city ?? "").trim();
  const trade = (session.merchant.primary_trade ?? "").trim();

  if (!rawBase) {
    return NextResponse.json(
      { ok: false, error: "base-required" },
      { status: 400 }
    );
  }
  const base = slugifyXrated(rawBase);
  const currentSlug = session.merchant.slug;

  // Requested slug
  const requested = await checkSlug(base, currentSlug);

  // Build candidate alternates only if requested is unavailable
  let alternates: SlugCheck[] = [];
  if (!requested.available) {
    const seeds: string[] = [];
    if (city) seeds.push(`${base}-${slugifyXrated(city)}`);
    if (trade) seeds.push(`${base}-${slugifyXrated(trade)}`);
    seeds.push(`${base}-uk`);
    seeds.push(`${base}-1`);
    seeds.push(`${base}-2`);
    seeds.push(`${base}-3`);
    const uniqueSeeds = Array.from(new Set(seeds)).slice(0, 6);
    const checked = await Promise.all(
      uniqueSeeds.map((s) => checkSlug(s, currentSlug))
    );
    alternates = checked.filter((c) => c.available).slice(0, 3);
    // Backfill with unavailable candidates if we don't have 3 free ones
    if (alternates.length < 3) {
      const unavailable = checked.filter((c) => !c.available);
      alternates = [...alternates, ...unavailable].slice(0, 3);
    }
  }

  return NextResponse.json({
    ok: true,
    requested,
    alternates,
    current: currentSlug
  });
}
