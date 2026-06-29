// GET /api/cron/affiliate-monthly-payment-alerts
//
// Vercel Cron — runs at 09:00 UTC on the 28th of each month (see
// vercel.json). For every active affiliate whose approved-commission
// total is >= £50 AND payment_details_completed_at IS NULL, send a
// "complete your payment details" email via Resend.
//
// Same logic as scripts/send-monthly-payment-alerts.mjs but server-side
// and auth-gated.
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPaymentDetailsNeededEmail } from "@/lib/affiliateEmails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_PENCE = 5000;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  if (!isVercelCron) {
    if (!secret || auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const affRes = await supabaseAdmin
    .from("hammerex_affiliates")
    .select(
      "affiliate_id, email, first_name, payment_details_completed_at"
    )
    .eq("status", "active")
    .is("payment_details_completed_at", null);
  if (affRes.error) {
    return NextResponse.json(
      { ok: false, error: affRes.error.message },
      { status: 500 }
    );
  }

  let sent = 0;
  let skipped = 0;
  for (const a of affRes.data ?? []) {
    if (!a.email) {
      skipped++;
      continue;
    }
    const sumRes = await supabaseAdmin
      .from("hammerex_affiliate_commissions")
      .select("amount_pence")
      .eq("affiliate_id", a.affiliate_id)
      .eq("status", "approved");
    const total = (sumRes.data ?? []).reduce(
      (s, r) => s + r.amount_pence,
      0
    );
    if (total < MIN_PENCE) {
      skipped++;
      continue;
    }
    try {
      await sendPaymentDetailsNeededEmail(
        {
          affiliate_id: a.affiliate_id,
          email: a.email,
          first_name: a.first_name
        },
        total
      );
      sent++;
      await supabaseAdmin
        .from("hammerex_affiliates")
        .update({ payment_alert_flag: true })
        .eq("affiliate_id", a.affiliate_id);
    } catch (e) {
      console.error(
        `[affiliate-monthly-payment-alerts] send failed for #${a.affiliate_id}:`,
        e
      );
    }
  }

  return NextResponse.json({ ok: true, sent, skipped });
}
