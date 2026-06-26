// Xrated Trades — server-side tier helpers.
// Lightweight cron-less approach: any render path can call
// `maybeExpireListingTier(listingId)` to flip `app_trial` rows whose
// `trial_expires_at` has elapsed down to `app_expired`. Idempotent and
// safe to call inline before render at <100-listing scale.
//
// Also exposes `startTrialFor(listingId)` used by both the create route
// (auto-start on signup) and the manual start-trial route.

import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { XRATED_PRICING } from "./xratedTrades";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * If the listing is on `app_trial` and the trial has expired, flip it to
 * `app_expired`. No-op otherwise. Returns the (possibly-updated) tier.
 */
export async function maybeExpireListingTier(listingId: string): Promise<
  "standard" | "app_trial" | "app_paid" | "app_expired" | null
> {
  const row = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("tier, trial_expires_at")
    .eq("id", listingId)
    .maybeSingle();
  if (!row.data) return null;
  if (row.data.tier !== "app_trial") return row.data.tier;
  if (!row.data.trial_expires_at) return row.data.tier;
  const expired = new Date(row.data.trial_expires_at).getTime() <= Date.now();
  if (!expired) return row.data.tier;
  const upd = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update({ tier: "app_expired" })
    .eq("id", listingId)
    .eq("tier", "app_trial");
  if (upd.error) {
    console.error("[xratedTier] expire failed:", upd.error);
    return row.data.tier;
  }
  return "app_expired";
}

/**
 * Flip a listing onto a fresh 30-day App trial. Used by the create route
 * (auto-start at signup) and the manual /api/trade-off/start-trial route.
 * Caller is responsible for any eligibility checks (cool-off etc.) — this
 * just writes the row.
 */
export async function startTrialFor(listingId: string): Promise<{
  trial_started_at: string;
  trial_expires_at: string;
} | null> {
  const now = new Date();
  const expires = new Date(now.getTime() + XRATED_PRICING.trialDays * DAY_MS);
  const trial_started_at = now.toISOString();
  const trial_expires_at = expires.toISOString();
  const upd = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update({
      tier: "app_trial",
      trial_started_at,
      trial_expires_at
    })
    .eq("id", listingId)
    .select("trial_started_at, trial_expires_at")
    .maybeSingle();
  if (upd.error || !upd.data) {
    console.error("[xratedTier] startTrialFor failed:", upd.error);
    return null;
  }
  return {
    trial_started_at: upd.data.trial_started_at ?? trial_started_at,
    trial_expires_at: upd.data.trial_expires_at ?? trial_expires_at
  };
}
