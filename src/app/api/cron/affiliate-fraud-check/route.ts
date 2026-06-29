// GET /api/cron/affiliate-fraud-check
//
// Daily at 04:00 UTC. Walks every active affiliate, runs the three
// click-pattern fraud rules over the last 30 days, and appends any
// NEW flags to fraud_flags (dedup by `flag`). Sets requires_review
// when at least one flag is present so the affiliate surfaces in the
// admin /admin/affiliates/review-queue view.
//
// Auth: CRON_SECRET header — same shape as the other cron routes.
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evaluateAffiliateFraud, appendFraudFlags } from "@/lib/affiliateFraud";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // No secret configured = local/dev open run.
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 }
    );
  }
  const { data: affs } = await supabaseAdmin
    .from("hammerex_affiliates")
    .select("affiliate_id")
    .eq("status", "active");

  let evaluated = 0;
  let flagged = 0;
  for (const row of affs ?? []) {
    evaluated += 1;
    const ev = await evaluateAffiliateFraud(row.affiliate_id);
    if (ev.flags.length > 0) {
      await appendFraudFlags(row.affiliate_id, ev.flags);
      flagged += 1;
    }
  }

  await supabaseAdmin.from("hammerex_affiliate_audit_log").insert({
    actor_type: "system",
    actor_id: "cron.affiliate-fraud-check",
    action: "fraud.cron.run",
    target_id: null,
    details: { evaluated, flagged }
  });

  return NextResponse.json({ ok: true, evaluated, flagged });
}
