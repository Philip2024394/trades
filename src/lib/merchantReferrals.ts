// merchantReferrals — merchant-to-merchant referral loop.
//
// A merchant shares their invite link:
//   https://thenetworkers.app/?mref=bobs-plumbing
//
// The middleware captures the mref value into a 30-day cookie
// (`tn_mref`). When a new listing is created, the signup path calls
// `attributeSignup(newSlug, cookieMref)` which:
//   1. Verifies the referrer exists + is live
//   2. Writes merchant_referrer_slug + merchant_referral_captured_at
//      on the new listing
//   3. Queues a `signup` reward row (pending → fulfilled by whichever
//      job fulfils rewards — typically 50 free washers to both sides
//      immediately, and a 1-month-free credit when the referred merchant
//      upgrades to a paid tier for the first time).
//
// Coexists with the existing third-party affiliate system: that uses
// `?ref=<int>` + `xrated_affiliate_ref` cookie + `affiliate_referrer_id`
// column. Merchant referrals use `?mref=<slug>` + `tn_mref` cookie +
// `merchant_referrer_slug` column. Same visitor can carry both.

import "server-only";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const MREF_COOKIE = "tn_mref";
export const MREF_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

export type MerchantReferralReward = {
  id:             string;
  referrer_slug:  string;
  referred_slug:  string;
  reward_type:    "signup" | "first-paid-upgrade";
  reward_status:  "pending" | "fulfilled" | "declined";
  reward_meta:    Record<string, unknown>;
  created_at:     string;
  fulfilled_at:   string | null;
  notes:          string | null;
};

/** Read the mref cookie from the current request. Returns null when
 *  unset or malformed. */
export async function readMrefCookie(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(MREF_COOKIE)?.value ?? null;
  if (!raw) return null;
  if (!SLUG_RE.test(raw)) return null;
  return raw;
}

/** Verify a slug matches a live listing — used by both the middleware
 *  (cheap, cached) and the signup attribution path (authoritative). */
export async function isLiveMerchantSlug(slug: string): Promise<boolean> {
  if (!SLUG_RE.test(slug)) return false;
  const res = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("slug")
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();
  return !!res.data;
}

/** Attribute a new signup to its referrer. Idempotent: safe to call
 *  even if the mref column is already populated (does nothing). */
export async function attributeSignup(input: {
  newSlug:  string;
  mrefSlug: string | null;
}): Promise<{ attributed: boolean; reason: string }> {
  if (!input.mrefSlug) return { attributed: false, reason: "no-mref-cookie" };
  if (input.mrefSlug === input.newSlug) {
    return { attributed: false, reason: "self-referral" };
  }
  const referrerLive = await isLiveMerchantSlug(input.mrefSlug);
  if (!referrerLive) return { attributed: false, reason: "referrer-not-live" };

  // Only stamp if not already stamped (idempotent).
  const existing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("slug, merchant_referrer_slug")
    .eq("slug", input.newSlug)
    .maybeSingle();
  if (!existing.data) return { attributed: false, reason: "new-listing-not-found" };
  if (existing.data.merchant_referrer_slug) {
    return { attributed: false, reason: "already-attributed" };
  }

  await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update({
      merchant_referrer_slug:         input.mrefSlug,
      merchant_referral_captured_at:  new Date().toISOString()
    })
    .eq("slug", input.newSlug);

  // Queue the signup reward (50 free washers to both sides — cheap
  // for us, valuable to the merchant). The reward-fulfilment job (or
  // a manual admin action) flips status → fulfilled.
  await supabaseAdmin.from("hammerex_merchant_referral_rewards").insert([
    {
      referrer_slug: input.mrefSlug,
      referred_slug: input.newSlug,
      reward_type:   "signup",
      reward_status: "pending",
      reward_meta:   { washers: 50, both_sides: true }
    }
  ]);

  return { attributed: true, reason: "ok" };
}

/** Every referral for a given merchant, most recent first. Powers the
 *  dashboard share card + admin views. */
export async function listReferralsForMerchant(
  referrerSlug: string,
  limit = 50
): Promise<Array<{ referred_slug: string; captured_at: string | null }>> {
  const res = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("slug, merchant_referral_captured_at")
    .eq("merchant_referrer_slug", referrerSlug)
    .order("merchant_referral_captured_at", { ascending: false })
    .limit(limit);
  return (res.data ?? []).map((r) => ({
    referred_slug: r.slug as string,
    captured_at:   (r.merchant_referral_captured_at ?? null) as string | null
  }));
}

/** Public share link for a merchant. Kept in one place so future URL
 *  shape changes (e.g. adding a `/join?mref=` alias) update everywhere. */
export function merchantReferralLink(slug: string, origin?: string): string {
  const o = origin ?? process.env.NEXT_PUBLIC_CANONICAL_ORIGIN ?? "https://thenetworkers.app";
  return `${o}/?mref=${encodeURIComponent(slug)}`;
}

/** Reward totals — powers the dashboard "your referrals" widget. */
export async function referralStatsForMerchant(referrerSlug: string): Promise<{
  totalReferrals:      number;
  pendingRewards:      number;
  fulfilledRewards:    number;
}> {
  const [listingsRes, rewardsRes] = await Promise.all([
    supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("slug", { count: "exact", head: true })
      .eq("merchant_referrer_slug", referrerSlug),
    supabaseAdmin
      .from("hammerex_merchant_referral_rewards")
      .select("reward_status")
      .eq("referrer_slug", referrerSlug)
  ]);
  const rewards = (rewardsRes.data ?? []) as Array<{ reward_status: string }>;
  return {
    totalReferrals:   listingsRes.count ?? 0,
    pendingRewards:   rewards.filter((r) => r.reward_status === "pending").length,
    fulfilledRewards: rewards.filter((r) => r.reward_status === "fulfilled").length
  };
}
