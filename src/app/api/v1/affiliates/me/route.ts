// GET /api/v1/affiliates/me
//
// Public REST endpoint for affiliates to pull their own stats. Auth:
//   Authorization: Bearer <40-char token>
//
// Returns a flat JSON object covering level, click/signup counts,
// per-status commission totals, and the current calendar month's
// paid-count. Updates last_used_at on each call so the affiliate
// can see "your widget last polled X" in their dashboard.
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized(): NextResponse {
  return NextResponse.json(
    { ok: false, error: "Invalid or missing token." },
    { status: 401 }
  );
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const header = req.headers.get("authorization") || "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return unauthorized();
  const token = m[1].trim();
  if (token.length < 10) return unauthorized();

  const { data: tokRow } = await supabaseAdmin
    .from("hammerex_affiliate_api_tokens")
    .select("id, affiliate_id, revoked_at")
    .eq("token", token)
    .maybeSingle();
  if (!tokRow || tokRow.revoked_at) return unauthorized();
  const affiliateId = tokRow.affiliate_id;

  // Stamp last_used_at — fire-and-forget, never block the response.
  void supabaseAdmin
    .from("hammerex_affiliate_api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", tokRow.id);

  // Stats. Each query is small + targeted.
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [aff, clicks, signups, commissions, monthlyPaid] = await Promise.all([
    supabaseAdmin
      .from("hammerex_affiliates")
      .select("level")
      .eq("affiliate_id", affiliateId)
      .maybeSingle(),
    supabaseAdmin
      .from("hammerex_affiliate_clicks")
      .select("id", { count: "exact", head: true })
      .eq("affiliate_id", affiliateId),
    supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id", { count: "exact", head: true })
      .eq("affiliate_referrer_id", affiliateId),
    supabaseAdmin
      .from("hammerex_affiliate_commissions")
      .select("status, amount_pence")
      .eq("affiliate_id", affiliateId),
    supabaseAdmin
      .from("hammerex_affiliate_commissions")
      .select("id", { count: "exact", head: true })
      .eq("affiliate_id", affiliateId)
      .eq("status", "paid")
      .gte("paid_at", monthStart.toISOString())
  ]);

  let pendingPence = 0;
  let approvedPence = 0;
  let paidPence = 0;
  let paidCount = 0;
  for (const row of commissions.data ?? []) {
    if (row.status === "pending") pendingPence += row.amount_pence;
    else if (row.status === "approved") approvedPence += row.amount_pence;
    else if (row.status === "paid") {
      paidPence += row.amount_pence;
      paidCount += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    affiliate_id: affiliateId,
    level: aff.data?.level ?? "bronze",
    clicks: clicks.count ?? 0,
    signups: signups.count ?? 0,
    paid_count: paidCount,
    pending_pence: pendingPence,
    approved_pence: approvedPence,
    paid_pence: paidPence,
    current_month_paid_count: monthlyPaid.count ?? 0
  });
}
