// GET /api/cron/mate-proactive
//
// Nightly proactive-signal run. Iterates every live merchant, runs
// every detector, upserts signals. CRON_SECRET gated. Registered in
// vercel.json — runs at 05:00 UTC (post-daily-metrics roll-up).

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runSignalsForUser } from "@/lib/mate/signals/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (secret && bearer !== secret) {
    return NextResponse.json({ ok: false, error: "not-authorised" }, { status: 401 });
  }

  const t0 = Date.now();
  const { data: merchants } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("slug")
    .eq("status", "live");

  const rows = merchants ?? [];
  const outcomes = [];
  let firedTotal = 0, errorsTotal = 0;

  for (const m of rows) {
    const out = await runSignalsForUser("merchant", m.slug);
    outcomes.push(out);
    firedTotal  += out.fired;
    errorsTotal += out.errors;
  }

  return NextResponse.json({
    ok:            true,
    merchants:     rows.length,
    signals_fired: firedTotal,
    errors:        errorsTotal,
    duration_ms:   Date.now() - t0
  });
}
