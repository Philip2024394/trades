// GET /api/cron/shadow-profile-suppress
//
// Daily. Second-line defence — most bounce/complaint suppression
// happens in real-time via the Postmark webhook (below). This cron
// is a belt-and-braces cleanup that:
//   1. Marks merchants as 'suppressed' if their email now appears
//      on the suppression list (may have been added manually via admin)
//   2. Releases merchants whose sequence exhausted (last step sent
//      >5 days ago, no claim)
//   3. Marks stale 'queued' rows with no email as 'released'
//
// CRON_SECRET gated.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (secret && bearer !== secret) {
    return NextResponse.json({ ok: false, error: "not-authorised" }, { status: 401 });
  }

  const now = new Date();
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 3600 * 1000).toISOString();

  // 1. Suppress based on the suppression list
  // (raw SQL is easier here than the JS builder for the join)
  const suppressedRes = await supabaseAdmin.rpc("exec_sql", {
    sql: `
      UPDATE hammerex_shadow_merchants sm
      SET status = 'suppressed'
      WHERE sm.status IN ('queued','sending')
        AND LOWER(sm.email) IN (SELECT LOWER(email) FROM hammerex_shadow_suppression)
      RETURNING sm.id;
    `
  }).catch(() => ({ data: null, error: null }));

  const suppressedCount = (suppressedRes as { data?: unknown[] })?.data?.length ?? 0;

  // 2. Release exhausted sequences (last step sent >5 days ago)
  const releaseRes = await supabaseAdmin
    .from("hammerex_shadow_merchants")
    .update({ status: "released", released_at: now.toISOString() })
    .eq("status", "sending")
    .lt("last_step_sent_at", fiveDaysAgo)
    .is("claimed_at", null)
    .gte("next_step_index", 6)  // sequence has 6 steps (0..5)
    .select("id");

  const releasedCount = (releaseRes.data ?? []).length;

  // 3. Kill zombie rows with no email
  const zombieRes = await supabaseAdmin
    .from("hammerex_shadow_merchants")
    .update({ status: "released", released_at: now.toISOString() })
    .in("status", ["queued", "sending"])
    .is("email", null)
    .select("id");

  const zombieCount = (zombieRes.data ?? []).length;

  const summary = {
    ok:               true,
    suppressedCount,
    releasedCount,
    zombieCount,
    at:               now.toISOString()
  };
  console.log("[cron/shadow-profile-suppress]", summary);
  return NextResponse.json(summary);
}
