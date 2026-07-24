// GET /api/cron/nex-overnight-prep
// Auth: header 'x-cron-secret' must match CRON_SECRET env.
//
// Runs the overnight prep for every active merchant. Nothing sends.
// Every action lands in each merchant's approval queue as
// status='awaiting_approval' — the merchant reviews in the morning.
//
// Returns aggregate stats + per-merchant errors so we can spot which
// merchants had a module fail without silently swallowing anything.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildOvernightRun } from "@/lib/nex/ab";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MERCHANTS_PER_RUN = 500;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }

  const started = Date.now();

  const listings = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("slug")
    .not("slug", "is", null)
    .limit(MAX_MERCHANTS_PER_RUN);

  const now = new Date();
  let ran = 0;
  let totalActions = 0;
  let totalAutoApproved = 0;
  const perMerchant: Array<{ slug: string; prepared: number; auto_approved: number; errors: number }> = [];
  const globalErrors: Array<{ slug: string; module: string; error: string }> = [];

  for (const row of listings.data ?? []) {
    const slug = row.slug as string;
    try {
      const run = await buildOvernightRun({ merchantSlug: slug, now });
      ran++;
      totalActions      += run.prepared_count;
      totalAutoApproved += run.auto_approved;
      perMerchant.push({
        slug,
        prepared:      run.prepared_count,
        auto_approved: run.auto_approved,
        errors:        run.errors.length
      });
      for (const err of run.queue.errors) globalErrors.push({ slug, module: err.module, error: err.error });
    } catch (err) {
      console.error(`[nex-overnight-prep] merchant ${slug} failed:`, err);
      globalErrors.push({ slug, module: "_run", error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({
    ok:                true,
    generated_at:      now.toISOString(),
    duration_ms:       Date.now() - started,
    merchants_seen:    listings.data?.length ?? 0,
    ran,
    total_actions_prepared: totalActions,
    total_auto_approved:    totalAutoApproved,
    per_merchant:      perMerchant.slice(0, 25),   // top slice for the response body
    error_count:       globalErrors.length,
    errors:            globalErrors.slice(0, 25)
  });
}
