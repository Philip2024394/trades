// Cron · daily at 03:00 UTC — rolls over expired billing periods on
// app_ai_visualiser_credits. Any row whose period_ends_at is in the
// past gets a fresh period + reset counters.
//
// Also: closes expired rate-limit windows on the homeowners table so
// the cached counts don't grow stale.

import { NextResponse } from "next/server";
import { isCronAuthorised } from "@/lib/cron/authorise";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const nextPeriodEnds = new Date(now);
  nextPeriodEnds.setMonth(nextPeriodEnds.getMonth() + 1);

  // Roll over expired credit periods
  const { data: expiredCredits, error: creditsErr } = await supabaseAdmin
    .from("app_ai_visualiser_credits")
    .select("merchant_id, tier, monthly_quota")
    .lt("period_ends_at", nowIso);
  if (creditsErr) {
    return NextResponse.json(
      { ok: false, error: creditsErr.message },
      { status: 500 }
    );
  }

  let creditsRolled = 0;
  for (const row of expiredCredits || []) {
    const { error: updErr } = await supabaseAdmin
      .from("app_ai_visualiser_credits")
      .update({
        renders_used_this_period: 0,
        overage_pence: 0,
        period_started_at: nowIso,
        period_ends_at: nextPeriodEnds.toISOString()
      })
      .eq("merchant_id", row.merchant_id);
    if (!updErr) creditsRolled += 1;
  }

  // Zero out day/week windows on homeowners whose windows expired.
  // Cheap upper-bound: only touch rows likely to matter (any renders
  // in the past week).
  const oneDayAgo = new Date(now.getTime() - 86_400_000).toISOString();
  const oneWeekAgo = new Date(now.getTime() - 604_800_000).toISOString();

  const { data: dayExpired } = await supabaseAdmin
    .from("app_ai_visualiser_homeowners")
    .select("id")
    .lt("day_window_started_at", oneDayAgo)
    .gt("renders_today", 0)
    .limit(1000);
  if (dayExpired && dayExpired.length > 0) {
    await supabaseAdmin
      .from("app_ai_visualiser_homeowners")
      .update({ renders_today: 0, day_window_started_at: nowIso })
      .in(
        "id",
        dayExpired.map((r) => r.id)
      );
  }
  const { data: weekExpired } = await supabaseAdmin
    .from("app_ai_visualiser_homeowners")
    .select("id")
    .lt("week_window_started_at", oneWeekAgo)
    .gt("renders_this_week", 0)
    .limit(1000);
  if (weekExpired && weekExpired.length > 0) {
    await supabaseAdmin
      .from("app_ai_visualiser_homeowners")
      .update({ renders_this_week: 0, week_window_started_at: nowIso })
      .in(
        "id",
        weekExpired.map((r) => r.id)
      );
  }

  return NextResponse.json({
    ok: true,
    creditsRolled,
    dayWindowsReset: dayExpired?.length ?? 0,
    weekWindowsReset: weekExpired?.length ?? 0
  });
}
