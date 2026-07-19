// Reveal credits — quota system for SiteBook WhatsApp reveals.
//
// A "reveal" = one unique (post, trade) WhatsApp conversation. Every
// NEW thread created via sendOutgoingMessage costs 1 credit. Every
// subsequent message on the SAME thread is FREE (no per-message
// charge). Composition + record inside SiteBook is free for everyone.
//
// Consumption order:
//   1. Monthly free/Pro quota (soft, resets on calendar month rollover)
//   2. Purchased pack credits (permanent balance)
//   3. Empty → 'quota-exceeded'
//
// Free tier: 3 reveals/mo · Pro £4.99/mo: 30 reveals/mo · packs never
// expire. See migration 20260718160000_hammerex_homeowner_reveal_credits.sql.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type RevealTier = "free" | "premium";

export type RevealQuota = {
  tier:                RevealTier;
  monthlyAllowance:    number;    // free=3, premium=30
  monthlyUsed:         number;    // usage this calendar month
  monthlyRemaining:    number;    // allowance - used, floored at 0
  purchasedRemaining:  number;    // permanent pack balance
  totalRemaining:      number;    // monthly + purchased
  periodStart:         string;    // ISO of when this period started
};

const ALLOWANCE: Record<RevealTier, number> = {
  free:    3,
  premium: 30
};

// True when `stamp` and `now` fall in different calendar months (UTC).
// We use UTC to match the DB TIMESTAMPTZ semantics — no local drift.
function isDifferentUtcMonth(stamp: string | Date, now: Date = new Date()): boolean {
  const s = new Date(stamp);
  return s.getUTCFullYear() !== now.getUTCFullYear() || s.getUTCMonth() !== now.getUTCMonth();
}

/**
 * Read the homeowner's current quota. Also performs a lazy monthly
 * reset — if reveal_period_start is in an earlier calendar month, we
 * zero the used counter and stamp period_start to the 1st of the
 * current month. Cheap and self-healing (no cron required).
 */
export async function getQuota(homeownerId: string): Promise<{ ok: true; quota: RevealQuota } | { ok: false; error: string }> {
  const row = await supabaseAdmin
    .from("hammerex_homeowners")
    .select("premium_tier, reveal_period_start, reveal_credits_used_period, reveal_credits_purchased")
    .eq("id", homeownerId)
    .maybeSingle();
  if (!row.data) return { ok: false, error: "homeowner-not-found" };

  const r = row.data as {
    premium_tier:                RevealTier;
    reveal_period_start:         string;
    reveal_credits_used_period:  number;
    reveal_credits_purchased:    number;
  };

  const tier = r.premium_tier === "premium" ? "premium" : "free";
  const now  = new Date();

  // Lazy monthly reset
  let periodStart = r.reveal_period_start;
  let usedPeriod  = r.reveal_credits_used_period;
  if (isDifferentUtcMonth(periodStart, now)) {
    const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    await supabaseAdmin
      .from("hammerex_homeowners")
      .update({
        reveal_period_start:        firstOfMonth,
        reveal_credits_used_period: 0
      })
      .eq("id", homeownerId);
    periodStart = firstOfMonth;
    usedPeriod  = 0;
  }

  const monthlyAllowance   = ALLOWANCE[tier];
  const monthlyRemaining   = Math.max(0, monthlyAllowance - usedPeriod);
  const purchasedRemaining = Math.max(0, r.reveal_credits_purchased);

  return {
    ok: true,
    quota: {
      tier,
      monthlyAllowance,
      monthlyUsed:        usedPeriod,
      monthlyRemaining,
      purchasedRemaining,
      totalRemaining:     monthlyRemaining + purchasedRemaining,
      periodStart
    }
  };
}

/**
 * Attempt to debit 1 reveal credit. Returns:
 *   { ok: true, from: 'monthly' | 'purchased' } — debited from that bucket
 *   { ok: false, error: 'quota-exceeded' }     — no credits available
 *
 * Note: This is not a true atomic decrement — under sustained
 * concurrent load a homeowner could theoretically overdrive by 1-2
 * reveals. Cheap trade-off for the current scale. If we outgrow it
 * we'll move to a Postgres function with row-level locking.
 */
export async function debitReveal(homeownerId: string): Promise<
  | { ok: true; from: "monthly" | "purchased"; quota: RevealQuota }
  | { ok: false; error: "quota-exceeded" | "homeowner-not-found" }
> {
  const q = await getQuota(homeownerId);
  if (!q.ok) return { ok: false, error: "homeowner-not-found" };

  const quota = q.quota;
  if (quota.totalRemaining <= 0) return { ok: false, error: "quota-exceeded" };

  // Prefer monthly first (use-it-or-lose-it), then packs
  if (quota.monthlyRemaining > 0) {
    await supabaseAdmin
      .from("hammerex_homeowners")
      .update({ reveal_credits_used_period: quota.monthlyUsed + 1 })
      .eq("id", homeownerId);
    const fresh = await getQuota(homeownerId);
    return { ok: true, from: "monthly", quota: fresh.ok ? fresh.quota : quota };
  }

  // Fall back to purchased packs
  await supabaseAdmin
    .from("hammerex_homeowners")
    .update({ reveal_credits_purchased: quota.purchasedRemaining - 1 })
    .eq("id", homeownerId);
  const fresh = await getQuota(homeownerId);
  return { ok: true, from: "purchased", quota: fresh.ok ? fresh.quota : quota };
}

/**
 * Add pack credits to the homeowner (called by Stripe webhook on
 * successful pack purchase). Also writes a row to the purchases
 * ledger for audit.
 */
export async function grantPackCredits(input: {
  homeownerId:         string;
  packSize:            number;         // 5, 10, 20, 50, 100
  amountGbpPence:      number;
  stripeSessionId?:    string;
  stripePaymentIntent?: string;
  paddleTransactionId?: string;
  note?:               string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await supabaseAdmin
    .from("hammerex_homeowners")
    .select("reveal_credits_purchased")
    .eq("id", input.homeownerId)
    .maybeSingle();
  if (!row.data) return { ok: false, error: "homeowner-not-found" };

  const current = (row.data as { reveal_credits_purchased: number }).reveal_credits_purchased;

  await supabaseAdmin
    .from("hammerex_homeowners")
    .update({ reveal_credits_purchased: current + input.packSize })
    .eq("id", input.homeownerId);

  await supabaseAdmin.from("hammerex_homeowner_reveal_purchases").insert({
    homeowner_id:          input.homeownerId,
    pack_size:             input.packSize,
    credits_added:         input.packSize,
    amount_gbp_pence:      input.amountGbpPence,
    currency:              "GBP",
    stripe_session_id:     input.stripeSessionId    || null,
    stripe_payment_intent: input.stripePaymentIntent || null,
    paddle_transaction_id: input.paddleTransactionId || null,
    status:                "paid",
    note:                  input.note || null,
    paid_at:               new Date().toISOString()
  });

  return { ok: true };
}
