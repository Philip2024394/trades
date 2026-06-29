// Affiliate fraud-detection helpers.
//
// Four rules, all pure SQL/TS — no paid APIs required:
//   1. duplicate_ip            >50% of clicks come from one IP
//   2. zero_signups_high_clicks >100 clicks AND 0 signups in 30 days
//   3. zero_paid_high_signups   >100 clicks AND 0 paid in 30 days
//   4. self_referral_attempt    listing.whatsapp == affiliate.whatsapp
//
// Rule 4 fires synchronously from the Stripe webhook
// (detectSelfReferral). Rules 1–3 run from the daily
// /api/cron/affiliate-fraud-check job.
import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";

export type FraudFlag = {
  flag:
    | "duplicate_ip"
    | "zero_signups_high_clicks"
    | "zero_paid_high_signups"
    | "self_referral_attempt";
  detected_at: string;
  reason: string;
};

function normaliseDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/**
 * Returns true when the listing belongs to the affiliate themselves
 * (matching normalised WhatsApp digits). Stripe webhook uses this to
 * pre-cancel a commission so a self-referral never becomes paid.
 */
export async function detectSelfReferral(
  affiliateId: number,
  listingId: string
): Promise<boolean> {
  try {
    const [{ data: aff }, { data: listing }] = await Promise.all([
      supabaseAdmin
        .from("hammerex_affiliates")
        .select("whatsapp")
        .eq("affiliate_id", affiliateId)
        .maybeSingle(),
      supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("whatsapp, phone")
        .eq("id", listingId)
        .maybeSingle()
    ]);
    if (!aff || !listing) return false;
    const affDigits = normaliseDigits(aff.whatsapp);
    const listingDigits = normaliseDigits(
      (listing as { whatsapp?: string | null; phone?: string | null }).whatsapp ??
        (listing as { phone?: string | null }).phone ??
        null
    );
    if (!affDigits || !listingDigits) return false;
    // 9 trailing digits because international/national-prefix variation
    // shouldn't defeat the check.
    return affDigits.slice(-9) === listingDigits.slice(-9);
  } catch (err) {
    console.error("[affiliateFraud] detectSelfReferral threw:", err);
    return false;
  }
}

export type AffiliateFraudEvaluation = {
  affiliate_id: number;
  flags: FraudFlag[];
};

/**
 * Run the three click-pattern rules against a single affiliate. Used
 * by the daily cron. Returns any NEW flags that should be appended to
 * the existing fraud_flags array.
 */
export async function evaluateAffiliateFraud(
  affiliateId: number,
  windowDays = 30
): Promise<AffiliateFraudEvaluation> {
  const windowStart = new Date(
    Date.now() - windowDays * 24 * 60 * 60 * 1000
  ).toISOString();
  const detectedAt = new Date().toISOString();
  const flags: FraudFlag[] = [];

  const { data: clickRows } = await supabaseAdmin
    .from("hammerex_affiliate_clicks")
    .select("ip")
    .eq("affiliate_id", affiliateId)
    .gte("created_at", windowStart);
  const clicks = clickRows ?? [];
  const ipTally = new Map<string, number>();
  for (const row of clicks) {
    if (!row.ip) continue;
    ipTally.set(row.ip, (ipTally.get(row.ip) ?? 0) + 1);
  }
  if (clicks.length > 0) {
    const [topIp, topCount] = Array.from(ipTally.entries()).sort(
      (a, b) => b[1] - a[1]
    )[0] ?? ["", 0];
    if (topCount / clicks.length > 0.5 && clicks.length >= 4) {
      flags.push({
        flag: "duplicate_ip",
        detected_at: detectedAt,
        reason: `${topCount}/${clicks.length} clicks (${Math.round(
          (topCount / clicks.length) * 100
        )}%) from IP ${topIp} in the last ${windowDays} days.`
      });
    }
  }

  if (clicks.length > 100) {
    const { count: signups } = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id", { count: "exact", head: true })
      .eq("affiliate_referrer_id", affiliateId)
      .gte("created_at", windowStart);
    if ((signups ?? 0) === 0) {
      flags.push({
        flag: "zero_signups_high_clicks",
        detected_at: detectedAt,
        reason: `${clicks.length} clicks and 0 signups in the last ${windowDays} days.`
      });
    } else {
      const { count: paid } = await supabaseAdmin
        .from("hammerex_affiliate_commissions")
        .select("id", { count: "exact", head: true })
        .eq("affiliate_id", affiliateId)
        .eq("status", "paid")
        .gte("created_at", windowStart);
      if ((paid ?? 0) === 0) {
        flags.push({
          flag: "zero_paid_high_signups",
          detected_at: detectedAt,
          reason: `${clicks.length} clicks and ${signups ?? 0} signups, but no paid commissions in the last ${windowDays} days.`
        });
      }
    }
  }

  return { affiliate_id: affiliateId, flags };
}

/**
 * Merge a new set of flags into the affiliate's existing fraud_flags
 * array, dedup by `flag` (so re-runs don't append duplicates), and set
 * requires_review=true when any flag is present.
 */
export async function appendFraudFlags(
  affiliateId: number,
  newFlags: FraudFlag[]
): Promise<void> {
  if (newFlags.length === 0) return;
  const { data: existing } = await supabaseAdmin
    .from("hammerex_affiliates")
    .select("fraud_flags")
    .eq("affiliate_id", affiliateId)
    .maybeSingle();
  const current: FraudFlag[] = Array.isArray(existing?.fraud_flags)
    ? (existing!.fraud_flags as FraudFlag[])
    : [];
  const seen = new Set(current.map((f) => f.flag));
  const merged = [...current];
  for (const f of newFlags) {
    if (!seen.has(f.flag)) {
      merged.push(f);
      seen.add(f.flag);
    }
  }
  await supabaseAdmin
    .from("hammerex_affiliates")
    .update({ fraud_flags: merged, requires_review: true })
    .eq("affiliate_id", affiliateId);
}
