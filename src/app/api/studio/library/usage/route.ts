// Studio library usage — reads `pick` events from studio_layout_events
// and returns per-variant counts. Powers the Live Component
// Intelligence panel in the Templates library ("Used by N merchants ·
// Trending · Recommended").
//
// Cookie-authenticated so we don't leak merchant-level activity data
// to public traffic. Counts are aggregated across ALL merchants —
// individual merchant events aren't returned.
//
// GET /api/studio/library/usage
//   → { ok, usage: { [layoutVariant]: { count, uniqueMerchants } } }

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }

  // We aggregate `pick` events (section adopted into a layout). Editor
  // fires this whenever a merchant swaps or adds a variant via the
  // Library. Count = total picks; uniqueMerchants = distinct
  // merchant_ids that picked at least once.
  const res = await supabaseAdmin
    .from("studio_layout_events")
    .select("layout_variant, merchant_id")
    .eq("event", "pick")
    .not("layout_variant", "is", null)
    .limit(10_000); // hard cap for early days; move to a rollup view later

  if (res.error) {
    return NextResponse.json(
      { ok: false, error: res.error.message },
      { status: 500 }
    );
  }

  const usage: Record<
    string,
    { count: number; uniqueMerchants: number }
  > = {};
  const merchantSets: Record<string, Set<string>> = {};

  for (const row of res.data ?? []) {
    const variant = row.layout_variant as string | null;
    if (!variant) continue;
    if (!usage[variant]) {
      usage[variant] = { count: 0, uniqueMerchants: 0 };
      merchantSets[variant] = new Set<string>();
    }
    usage[variant].count += 1;
    if (row.merchant_id) merchantSets[variant].add(row.merchant_id as string);
  }

  for (const [variant, set] of Object.entries(merchantSets)) {
    usage[variant].uniqueMerchants = set.size;
  }

  return NextResponse.json({ ok: true, usage });
}
