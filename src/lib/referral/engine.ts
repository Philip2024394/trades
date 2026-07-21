// Referral Engine · unified attribution + reward pipeline.
//
// Every product's referral programme (mref, affiliate, refer-a-friend,
// driver referral) writes to hammerex_referrals with a distinguishing
// program_slug. Attribution recorded at signup; rewards fulfilled
// on activation or via cron.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ProgramSlug = "mref" | "affiliate" | "refer_a_friend" | "driver_referral";

export type AttributionInput = {
  program:            ProgramSlug;
  referrerKind:       "merchant" | "homeowner" | "affiliate_partner" | "trade";
  referrerId:         string;
  referrerSlug?:      string;
  referredKind:       "merchant" | "homeowner" | "trade";
  referredId:         string;
  referredDisplay?:   string;
  attributionSource?: "url_param" | "cookie" | "code" | "admin_manual";
  attributionUrl?:    string;
  attributionChannel?: string;
  metadata?:          Record<string, unknown>;
};

export type RewardInput = {
  program:      ProgramSlug;
  referredId:   string;
  referredKind: "merchant" | "homeowner" | "trade";
  rewardKind:   "washers" | "cash_gbp_pence" | "discount_pct" | "feature_unlock";
  rewardAmount: number;
};

/** Record an attribution at signup. Idempotent via UNIQUE constraint —
 *  double-signup attempts silently no-op instead of erroring. */
export async function attributeReferral(input: AttributionInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  const ins = await supabaseAdmin
    .from("hammerex_referrals")
    .insert({
      program_slug:         input.program,
      referrer_kind:        input.referrerKind,
      referrer_id:          input.referrerId,
      referrer_slug:        input.referrerSlug     ?? null,
      referred_kind:        input.referredKind,
      referred_id:          input.referredId,
      referred_display:     input.referredDisplay  ?? null,
      attribution_source:   input.attributionSource ?? "url_param",
      attribution_url:      input.attributionUrl    ?? null,
      attribution_channel:  input.attributionChannel ?? null,
      metadata:             input.metadata ?? null
    })
    .select("id")
    .maybeSingle();
  if (ins.error) {
    // Duplicate = OK (idempotent). Everything else = log + fail.
    if (ins.error.code === "23505") return { ok: true }; // UNIQUE violation
    console.error("[referral] attribution failed:", ins.error);
    return { ok: false, error: ins.error.message };
  }
  return { ok: true, id: ins.data?.id };
}

/** Mark the referred user as activated. Called from the moment they
 *  hit activation criteria (first post, first hire, first paid tier, etc.). */
export async function markActivated(program: ProgramSlug, referredKind: string, referredId: string): Promise<void> {
  const now = new Date().toISOString();
  await supabaseAdmin
    .from("hammerex_referrals")
    .update({ activated_at: now, reward_status: "earned", reward_earned_at: now })
    .eq("program_slug", program)
    .eq("referred_kind", referredKind)
    .eq("referred_id",  referredId)
    .is("activated_at", null);
}

/** Load referrals waiting for reward fulfillment (called by cron). */
export async function loadPendingRewards(limit = 100) {
  const res = await supabaseAdmin
    .from("hammerex_referrals")
    .select("*")
    .eq("reward_status", "earned")
    .is("reward_paid_at", null)
    .order("reward_earned_at", { ascending: true })
    .limit(limit);
  return res.data ?? [];
}

/** Set the reward specifics for a referral (typically set at signup based on programme). */
export async function setReward(input: RewardInput): Promise<void> {
  await supabaseAdmin
    .from("hammerex_referrals")
    .update({
      reward_kind:   input.rewardKind,
      reward_amount: input.rewardAmount
    })
    .eq("program_slug", input.program)
    .eq("referred_kind", input.referredKind)
    .eq("referred_id",   input.referredId);
}

/** Mark a reward as paid (after cron delivered washers / cash / etc.). */
export async function markRewardPaid(referralId: string): Promise<void> {
  await supabaseAdmin
    .from("hammerex_referrals")
    .update({ reward_status: "paid", reward_paid_at: new Date().toISOString() })
    .eq("id", referralId);
}

// ─── Read helpers for Growth Engine Centre ─────────────────────────

export async function topReferrers(program: ProgramSlug, fromIso: string, limit = 10): Promise<Array<{
  referrerId:   string;
  referrerSlug: string | null;
  signups:      number;
  activated:    number;
  paidRewards:  number;
}>> {
  const res = await supabaseAdmin
    .from("hammerex_referrals")
    .select("referrer_id, referrer_slug, activated_at, reward_status")
    .eq("program_slug", program)
    .gte("created_at", fromIso);
  const rows = (res.data as { referrer_id: string; referrer_slug: string | null; activated_at: string | null; reward_status: string }[]) ?? [];
  const agg = new Map<string, { slug: string | null; signups: number; activated: number; paidRewards: number }>();
  for (const r of rows) {
    const cur = agg.get(r.referrer_id) ?? { slug: r.referrer_slug, signups: 0, activated: 0, paidRewards: 0 };
    cur.signups += 1;
    if (r.activated_at)          cur.activated += 1;
    if (r.reward_status === "paid") cur.paidRewards += 1;
    agg.set(r.referrer_id, cur);
  }
  return Array.from(agg.entries())
    .map(([referrerId, a]) => ({ referrerId, referrerSlug: a.slug, signups: a.signups, activated: a.activated, paidRewards: a.paidRewards }))
    .sort((a, b) => b.signups - a.signups)
    .slice(0, limit);
}

export async function referralFunnel(program: ProgramSlug, fromIso: string): Promise<{
  attributed: number;
  activated:  number;
  paid:       number;
}> {
  const [attrRes, actRes, paidRes] = await Promise.all([
    supabaseAdmin.from("hammerex_referrals").select("id", { count: "exact", head: true }).eq("program_slug", program).gte("created_at", fromIso),
    supabaseAdmin.from("hammerex_referrals").select("id", { count: "exact", head: true }).eq("program_slug", program).gte("created_at", fromIso).not("activated_at", "is", null),
    supabaseAdmin.from("hammerex_referrals").select("id", { count: "exact", head: true }).eq("program_slug", program).gte("created_at", fromIso).not("paid_subscription_at", "is", null)
  ]);
  return {
    attributed: attrRes.count ?? 0,
    activated:  actRes.count  ?? 0,
    paid:       paidRes.count ?? 0
  };
}
