// Fires when a merchant is exactly one criterion away from the next
// Trust Ladder tier. That's the moment nudging pays off — they see
// the finish line and one action closes it.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { SignalDetector } from "../types";

const TIER_ORDER = ["bronze", "silver", "gold", "platinum"];

export const trustLadderNextDetector: SignalDetector = {
  kind:     "trust_ladder_next",
  surfaces: ["merchant"],
  async detect(ctx) {
    const [listingRes, criteriaRes] = await Promise.all([
      supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("trust_tier")
        .eq("slug", ctx.userKey)
        .maybeSingle(),
      supabaseAdmin
        .from("hammerex_merchant_trust_criteria")
        .select("criterion_slug, tier, met")
        .eq("merchant_slug", ctx.userKey)
    ]);

    const currentTier = listingRes.data?.trust_tier ?? "bronze";
    const criteria    = criteriaRes.data ?? [];
    if (criteria.length === 0) return null;

    // Which tier is next?
    const idx = TIER_ORDER.indexOf(currentTier);
    if (idx === -1 || idx >= TIER_ORDER.length - 1) return null;
    const nextTier = TIER_ORDER[idx + 1];

    // Unmet criteria for the next tier
    const nextTierCriteria = criteria.filter((c) => c.tier === nextTier);
    if (nextTierCriteria.length === 0) return null;
    const unmet = nextTierCriteria.filter((c) => !c.met);
    if (unmet.length !== 1) return null;   // only fire when EXACTLY one step away

    const step = unmet[0].criterion_slug;
    const label = step.replace(/[_-]/g, " ");

    return {
      kind:         "trust_ladder_next",
      priority:     2,
      title:        `One step from ${nextTier}`,
      body:         `You're one criterion off ${nextTier}. Sort ${label} and the badge upgrades tonight. Homeowners filter by tier — it lifts your click-through immediately.`,
      action_url:   `/trade-off/edit/${ctx.userKey}/trust-ladder`,
      action_label: "Fix it",
      metadata:     { current_tier: currentTier, next_tier: nextTier, missing: step }
    };
  }
};
