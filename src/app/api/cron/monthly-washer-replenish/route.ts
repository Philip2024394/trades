// GET /api/cron/monthly-washer-replenish
//
// Runs on the 1st of every month at 03:00. Reads every live merchant,
// resolves their tier via tierFromDbValue → tier.washerMonthlyCredit,
// and credits that amount to their hammerex_washer_bags.balance.
// Stamps washer_credit_last_replenished_at so re-runs in the same
// month are no-ops (idempotent).
//
// CRON_SECRET gated.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { tierFromDbValue } from "@/lib/tierCatalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (secret && bearer !== secret) {
    return NextResponse.json({ ok: false, error: "not-authorised" }, { status: 401 });
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Read every live listing that hasn't been credited this month yet.
  const listings = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, tier, washer_monthly_credit, washer_credit_last_replenished_at")
    .eq("status", "live")
    .or(`washer_credit_last_replenished_at.is.null,washer_credit_last_replenished_at.lt.${monthStart}`);

  if (listings.error) {
    console.error("[cron/monthly-washer-replenish] listings read failed:", listings.error);
    return NextResponse.json({ ok: false, error: "read-failed" }, { status: 500 });
  }

  let credited = 0;
  let skipped  = 0;
  let errors   = 0;

  for (const row of (listings.data ?? []) as Array<{ id: string; slug: string; tier: string | null; washer_monthly_credit: number | null }>) {
    const tier = tierFromDbValue(row.tier);
    const credit = tier.washerMonthlyCredit;
    if (credit <= 0) {
      // No monthly inclusion for this tier (Free) — just stamp the date so we don't re-process.
      await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .update({ washer_credit_last_replenished_at: now.toISOString(), washer_monthly_credit: 0 })
        .eq("id", row.id);
      skipped++;
      continue;
    }

    // Read or create the merchant's washer bag.
    const bagRes = await supabaseAdmin
      .from("hammerex_washer_bags")
      .select("id, balance")
      .eq("listing_id", row.id)
      .maybeSingle();

    if (bagRes.error) {
      console.error(`[cron/monthly-washer-replenish] bag read failed for ${row.slug}:`, bagRes.error);
      errors++;
      continue;
    }

    if (bagRes.data) {
      await supabaseAdmin
        .from("hammerex_washer_bags")
        .update({ balance: (bagRes.data.balance ?? 0) + credit })
        .eq("id", bagRes.data.id as string);
    } else {
      await supabaseAdmin
        .from("hammerex_washer_bags")
        .insert({ listing_id: row.id, balance: credit });
    }

    await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .update({
        washer_credit_last_replenished_at: now.toISOString(),
        washer_monthly_credit:             credit
      })
      .eq("id", row.id);

    credited++;
  }

  const summary = { ok: true, credited, skipped, errors, at: now.toISOString() };
  console.log("[cron/monthly-washer-replenish]", summary);
  return NextResponse.json(summary);
}
