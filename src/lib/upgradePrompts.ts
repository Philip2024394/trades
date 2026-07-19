// upgradePrompts — behavioural upgrade nudges for Free/Starter merchants.
//
// The algorithm Philip asked for: instead of nagging every visitor with
// generic "upgrade now" banners, we watch for MOMENTS OF INTENT and
// fire one specific nudge per merchant per topic. Each prompt runs
// once, is dismissible, and is tracked in `hammerex_upgrade_prompts`
// so we can measure conversion (upgraded_at) per trigger.
//
// The 6 triggers Philip approved:
//   1. views5:      profile hit 5 views today          → Pro (Analytics)
//   2. products10:  merchant tries to add 11th product → Starter (unlimited)
//   3. beacon-nowashers: claims beacon but bag empty   → Starter (50 washers/mo)
//   4. contacts10:  merchant WhatsApp click #10 lifetime → Starter (reviews)
//   5. firstProduct: first product created             → Pro (AI Visualiser)
//   6. referSuccess: someone joined via mref            → Loop (leaderboard)
//
// SERVER-ONLY. UI reads the prompt via `getActivePromptsFor(listingId)`.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { TierKey } from "@/lib/tierCatalog";

export type PromptKey =
  | "views5"
  | "products10"
  | "beacon-nowashers"
  | "contacts10"
  | "firstProduct"
  | "referSuccess";

export type UpgradePrompt = {
  key:        PromptKey;
  targetTier: TierKey;
  title:      string;
  body:       string;
  ctaLabel:   string;
  ctaHref:    (slug: string) => string;
};

/** Canonical copy per prompt. Kept in one place so tweaking messaging
 *  doesn't require touching the trigger code. */
export const PROMPT_CATALOG: Record<PromptKey, UpgradePrompt> = {
  views5: {
    key:        "views5",
    targetTier: "professional",
    title:      "You're getting traffic",
    body:       "5 people viewed your profile today. Analytics unlocks with Professional — see who viewed and what they clicked.",
    ctaLabel:   "See Professional",
    ctaHref:    (slug) => `/trade-off/edit/${encodeURIComponent(slug)}/payments?upgrade=professional&src=views5`
  },
  products10: {
    key:        "products10",
    targetTier: "starter",
    title:      "You've hit the Free tier product cap",
    body:       "Free tier holds 10 products. Starter holds unlimited — carry on adding for £9.99/mo.",
    ctaLabel:   "Upgrade to Starter",
    ctaHref:    (slug) => `/trade-off/edit/${encodeURIComponent(slug)}/payments?upgrade=starter&src=products10`
  },
  "beacon-nowashers": {
    key:        "beacon-nowashers",
    targetTier: "starter",
    title:      "Out of washers",
    body:       "You just tried to claim a lead but your washer bag is empty. Starter includes 50 washers a month — never miss a lead.",
    ctaLabel:   "See Starter",
    ctaHref:    (slug) => `/trade-off/edit/${encodeURIComponent(slug)}/payments?upgrade=starter&src=beacon-nowashers`
  },
  contacts10: {
    key:        "contacts10",
    targetTier: "starter",
    title:      "You've been contacted 10 times",
    body:       "Trades with reviews get 3× more messages. Unlock the review flywheel with Starter for £9.99/mo.",
    ctaLabel:   "See Starter",
    ctaHref:    (slug) => `/trade-off/edit/${encodeURIComponent(slug)}/payments?upgrade=starter&src=contacts10`
  },
  firstProduct: {
    key:        "firstProduct",
    targetTier: "professional",
    title:      "Try AI Visualiser on this product",
    body:       "Let customers see the product installed in their own space with one photo upload. Included with Professional.",
    ctaLabel:   "See Professional",
    ctaHref:    (slug) => `/trade-off/edit/${encodeURIComponent(slug)}/payments?upgrade=professional&src=firstProduct`
  },
  referSuccess: {
    key:        "referSuccess",
    targetTier: "professional",
    title:      "Someone joined with your link",
    body:       "Refer 10 merchants and get 3 months of Professional free. See the leaderboard.",
    ctaLabel:   "See referral leaderboard",
    ctaHref:    () => `/trade-off/referrals`
  }
};

/** Check whether a specific prompt should be shown to this listing.
 *  Returns false if already shown (regardless of dismissal state). */
export async function shouldShowPrompt(listingId: string, key: PromptKey): Promise<boolean> {
  const res = await supabaseAdmin
    .from("hammerex_upgrade_prompts")
    .select("id")
    .eq("listing_id", listingId)
    .eq("prompt_key", key)
    .maybeSingle();
  if (res.error) return false;
  return !res.data;
}

/** Record that a prompt has been shown to a listing. Idempotent —
 *  safe on double-fire. Returns true when this was a new insert. */
export async function markShown(listingId: string, key: PromptKey): Promise<boolean> {
  const prompt = PROMPT_CATALOG[key];
  const res = await supabaseAdmin
    .from("hammerex_upgrade_prompts")
    .insert({
      listing_id:  listingId,
      prompt_key:  key,
      target_tier: prompt.targetTier
    })
    .select("id")
    .maybeSingle();
  return !!res.data;
}

/** Record dismissal — user tapped X on the prompt. */
export async function markDismissed(listingId: string, key: PromptKey): Promise<void> {
  await supabaseAdmin
    .from("hammerex_upgrade_prompts")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("listing_id", listingId)
    .eq("prompt_key", key);
}

/** Record conversion — attribution when a merchant upgrades after
 *  seeing a specific prompt. Called from the Stripe webhook post-
 *  checkout to attribute the upgrade to the trigger. */
export async function markUpgraded(listingId: string, key: PromptKey): Promise<void> {
  await supabaseAdmin
    .from("hammerex_upgrade_prompts")
    .update({ upgraded_at: new Date().toISOString() })
    .eq("listing_id", listingId)
    .eq("prompt_key", key);
}

/** Return every prompt that's currently ELIGIBLE for this listing —
 *  based on their tier + activity. Dashboard renders the top 1-2.
 *  Called from a server component on merchant dashboard render.
 *
 *  Trigger evaluation is BEST-EFFORT — reads current-state counters
 *  from the listing/bag/counts. Doesn't try to detect the exact moment
 *  the threshold was crossed; just fires the prompt the first time
 *  the listing loads while the condition is met. */
export async function getActivePromptsFor(input: {
  listingId:  string;
  slug:       string;
  tier:       TierKey;
}): Promise<UpgradePrompt[]> {
  if (input.tier === "works") return []; // top tier — nothing to upsell

  // Fetch everything we need in one round-trip.
  const [
    productCountRes,
    viewCountRes,
    waClickRes,
    washerBagRes,
    promptsShownRes
  ] = await Promise.all([
    supabaseAdmin.from("hammerex_standard_products")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", input.listingId),
    supabaseAdmin.from("hammerex_trade_off_listings")
      .select("view_count_today, whatsapp_click_count, merchant_referrer_slug")
      .eq("id", input.listingId).maybeSingle(),
    supabaseAdmin.from("hammerex_trade_off_listings")
      .select("whatsapp_click_count")
      .eq("id", input.listingId).maybeSingle(),
    supabaseAdmin.from("hammerex_washer_bags")
      .select("balance").eq("listing_id", input.listingId).maybeSingle(),
    supabaseAdmin.from("hammerex_upgrade_prompts")
      .select("prompt_key").eq("listing_id", input.listingId)
  ]);

  const productCount = productCountRes.count ?? 0;
  const viewsToday   = (viewCountRes.data?.view_count_today  as number | undefined) ?? 0;
  const waClicks     = (waClickRes.data?.whatsapp_click_count as number | undefined) ?? 0;
  const bagBalance   = (washerBagRes.data?.balance            as number | undefined) ?? 0;
  const alreadyShown = new Set(((promptsShownRes.data ?? []) as Array<{ prompt_key: string }>).map((r) => r.prompt_key as PromptKey));

  const active: UpgradePrompt[] = [];

  // 1. views5 — needs Free/Starter, ≥5 views today
  if (input.tier !== "professional" && input.tier !== "business" && viewsToday >= 5 && !alreadyShown.has("views5")) {
    active.push(PROMPT_CATALOG.views5);
  }
  // 2. products10 — Free only, product count ≥10
  if (input.tier === "free" && productCount >= 10 && !alreadyShown.has("products10")) {
    active.push(PROMPT_CATALOG.products10);
  }
  // 3. beacon-nowashers — Free/Starter, empty bag
  if ((input.tier === "free" || input.tier === "starter") && bagBalance === 0 && !alreadyShown.has("beacon-nowashers")) {
    active.push(PROMPT_CATALOG["beacon-nowashers"]);
  }
  // 4. contacts10 — Free only, WA clicks ≥10 lifetime
  if (input.tier === "free" && waClicks >= 10 && !alreadyShown.has("contacts10")) {
    active.push(PROMPT_CATALOG.contacts10);
  }
  // 5. firstProduct — Free/Starter, has ≥1 product, hasn't seen it
  if (input.tier !== "professional" && input.tier !== "business" && productCount >= 1 && !alreadyShown.has("firstProduct")) {
    active.push(PROMPT_CATALOG.firstProduct);
  }
  // 6. referSuccess — any tier, they've referred someone
  if (!alreadyShown.has("referSuccess")) {
    const referredCount = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("slug", { count: "exact", head: true })
      .eq("merchant_referrer_slug", input.slug);
    if ((referredCount.count ?? 0) >= 1) {
      active.push(PROMPT_CATALOG.referSuccess);
    }
  }

  return active.slice(0, 2); // never show more than 2 at once
}
