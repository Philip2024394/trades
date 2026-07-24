// GET /api/cron/bi-daily-aggregate
// Auth: header 'x-cron-secret' must match CRON_SECRET env.
//
// Iterates every active merchant listing and runs the BI engine for
// each. This does three things:
//   1. Surfaces any adapter that throws for real data before a user
//      sees it (returns per-domain error counts).
//   2. Reports the distribution of Business Health across the fleet
//      so we can spot the platform's overall temperature.
//   3. Warms the in-process cache — the first cron hit of a serverless
//      instance builds the snapshots that later requests will read.
//
// We don't persist daily rows yet — snapshots are recomputed hourly
// and reports are built on-demand. When a permanent historical trace
// is needed, add a migration for hammerex_merchant_bi_daily and
// upsert here.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildBusinessSnapshot } from "@/lib/nex/bi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MERCHANTS_PER_RUN = 500;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }

  const started = Date.now();

  // Active merchants only — a merchant is "active" if they've logged
  // in or had a metric event in the last 45 days. Falls back to
  // listing existence when last_seen tracking isn't populated.
  const { data: listings, error } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("slug")
    .not("slug", "is", null)
    .limit(MAX_MERCHANTS_PER_RUN);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const now = new Date();
  const errorsByDomain: Record<string, number> = {};
  const bandCounts:     Record<string, number> = { excellent: 0, healthy: 0, steady: 0, attention: 0, critical: 0 };
  let ran = 0;
  let scored = 0;

  for (const row of listings ?? []) {
    const slug = row.slug as string;
    try {
      const snap = await buildBusinessSnapshot({ merchantSlug: slug, now, refresh: true });
      ran++;
      if (snap.domains.some((d) => d.sub_score !== null)) {
        scored++;
        bandCounts[snap.band] = (bandCounts[snap.band] ?? 0) + 1;
      }
      for (const e of snap.errors) {
        errorsByDomain[e.domain] = (errorsByDomain[e.domain] ?? 0) + 1;
      }
    } catch (err) {
      errorsByDomain["_engine"] = (errorsByDomain["_engine"] ?? 0) + 1;
      console.error(`[bi-daily-aggregate] snapshot failed for ${slug}:`, err);
    }
  }

  return NextResponse.json({
    ok:             true,
    generated_at:   now.toISOString(),
    duration_ms:    Date.now() - started,
    merchants_seen: listings?.length ?? 0,
    ran,
    scored,
    band_distribution: bandCounts,
    adapter_errors:    errorsByDomain
  });
}
