// GET /api/merchant/dashboard/summary
//
// One endpoint the merchant home launchpad calls to render itself.
// Returns everything a Facebook-easy dashboard needs in a single
// round-trip so the merchant sees their world before the network
// finishes chattering.
//
// Response shape:
//   {
//     ok: true,
//     merchant: { slug, display_name, avatar_url, tier, trading_name },
//     wallet:   { balance, monthly_credit, replenish_day, low },
//     inbox:    { unread_notifications, unread_reviews, pending_scheduled },
//     growth:   { views_7d, whatsapp_clicks_7d, posts_7d,
//                 reactions_7d, delta_pct_7d },
//     checklist:{ completed, total, next_step },
//     usage:    { crown_banners: {used, cap}, bg_removal: {used, cap},
//                 scheduled_posts: {used, cap} },
//     recent:   [ activity_log rows, last 5 ]
//   }
//
// All lookups are parallel + indexed. No client library depends on
// the exact shape — every consumer destructures defensively.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function monthKey(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Tier → feature caps. Kept in sync with the actual gates in
 *  /api/site/editor/bg-removal/save + the scheduled-posts route.
 *  Duplication is intentional: the dashboard must not query the
 *  gate endpoints for every panel — it renders the caps client-
 *  side against the counters. */
const TIER_CAPS: Record<string, { crown_banners: number; bg_removal: number; scheduled_posts: number }> = {
  standard:  { crown_banners: 3,   bg_removal: 5,   scheduled_posts: 3  },
  app_trial: { crown_banners: 10,  bg_removal: 10,  scheduled_posts: 5  },
  starter:   { crown_banners: 20,  bg_removal: 20,  scheduled_posts: 10 },
  app_paid:  { crown_banners: 100, bg_removal: 50,  scheduled_posts: 20 },
  verified:  { crown_banners: 300, bg_removal: 200, scheduled_posts: 20 },
  works:     { crown_banners: 10_000, bg_removal: 10_000, scheduled_posts: 20 }
};

const ONBOARDING_SEQUENCE = [
  "upload_avatar",
  "add_bio",
  "add_photos",
  "connect_whatsapp",
  "post_first_canteen",
  "share_first_link",
  "invite_first_customer"
];

export async function GET(): Promise<NextResponse> {
  const merchantSlug = await getMerchantSlug();
  if (!merchantSlug) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  const monthNow  = monthKey();
  const since7d   = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000).toISOString();
  const since14d  = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const day7Cut   = since7d.slice(0, 10);

  // Fire every read in parallel — this is what makes the dashboard feel instant.
  const [
    listingRes,
    walletRes,
    unreadNotifsRes,
    pendingScheduledRes,
    metricsRes,
    checklistRes,
    featureUsageRes,
    activityRes
  ] = await Promise.all([
    supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("slug, display_name, avatar_url, tier, trading_name, whatsapp, timezone")
      .eq("slug", merchantSlug)
      .maybeSingle(),
    supabaseAdmin
      .from("hammerex_washer_wallets")
      .select("balance, monthly_credit, next_replenish_at")
      .eq("merchant_slug", merchantSlug)
      .maybeSingle(),
    supabaseAdmin
      .from("hammerex_notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_slug", merchantSlug)
      .is("read_at", null),
    supabaseAdmin
      .from("hammerex_scheduled_posts")
      .select("id", { count: "exact", head: true })
      .eq("merchant_slug", merchantSlug)
      .eq("status", "pending"),
    supabaseAdmin
      .from("hammerex_merchant_daily_metrics")
      .select("day, profile_views, whatsapp_clicks, canteen_posts, yard_posts, reactions_received")
      .eq("merchant_slug", merchantSlug)
      .gte("day", since14d.slice(0, 10))
      .order("day", { ascending: false }),
    supabaseAdmin
      .from("hammerex_merchant_onboarding_steps")
      .select("step_slug")
      .eq("merchant_slug", merchantSlug),
    supabaseAdmin
      .from("hammerex_merchant_feature_usage")
      .select("feature_slug, used_count")
      .eq("merchant_slug", merchantSlug)
      .eq("month_yyyymm", monthNow),
    supabaseAdmin
      .from("hammerex_merchant_activity_log")
      .select("event_type, event_payload, created_at")
      .eq("merchant_slug", merchantSlug)
      .order("created_at", { ascending: false })
      .limit(5)
  ]);

  const listing = listingRes.data as { slug: string; display_name: string; avatar_url: string | null; tier: string | null; trading_name: string | null; whatsapp: string | null; timezone: string | null } | null;
  if (!listing) {
    return NextResponse.json({ ok: false, error: "listing_not_found" }, { status: 404 });
  }
  const tier = listing.tier ?? "standard";

  // Wallet — fall back to a zero balance if the row doesn't exist yet.
  const wallet = (walletRes.data as { balance?: number; monthly_credit?: number; next_replenish_at?: string } | null) ?? { balance: 0, monthly_credit: 0 };
  const walletBalance = wallet.balance ?? 0;

  // Growth — sum the last 7 days vs the 7 days before that for delta.
  const metrics = (metricsRes.data ?? []) as Array<{ day: string; profile_views: number; whatsapp_clicks: number; canteen_posts: number; yard_posts: number; reactions_received: number }>;
  const sumFor = (from: string, to: string, key: keyof typeof metrics[0]) =>
    metrics.filter((m) => m.day >= from && m.day <= to).reduce((s, m) => s + (m[key] as number), 0);
  const today   = new Date().toISOString().slice(0, 10);
  const day7    = day7Cut;
  const day14   = since14d.slice(0, 10);
  const views_7d       = sumFor(day7, today, "profile_views");
  const views_prev_7d  = sumFor(day14, day7, "profile_views");
  const deltaPct = views_prev_7d > 0
    ? Math.round(((views_7d - views_prev_7d) / views_prev_7d) * 100)
    : (views_7d > 0 ? 100 : 0);

  const growth = {
    views_7d,
    whatsapp_clicks_7d: sumFor(day7, today, "whatsapp_clicks"),
    posts_7d:           sumFor(day7, today, "canteen_posts") + sumFor(day7, today, "yard_posts"),
    reactions_7d:       sumFor(day7, today, "reactions_received"),
    delta_pct_7d:       deltaPct
  };

  // Checklist — completed vs total; find next step.
  const completedSteps = new Set(((checklistRes.data ?? []) as Array<{ step_slug: string }>).map((r) => r.step_slug));
  const nextStep = ONBOARDING_SEQUENCE.find((s) => !completedSteps.has(s)) ?? null;
  const checklist = {
    completed: completedSteps.size,
    total:     ONBOARDING_SEQUENCE.length,
    next_step: nextStep
  };

  // Feature usage — map DB rows to a friendly shape with caps.
  const caps = TIER_CAPS[tier] ?? TIER_CAPS.standard;
  const usageMap = new Map(((featureUsageRes.data ?? []) as Array<{ feature_slug: string; used_count: number }>).map((r) => [r.feature_slug, r.used_count]));
  const usage = {
    crown_banners:   { used: usageMap.get("crown_banner_download") ?? 0, cap: caps.crown_banners },
    bg_removal:      { used: usageMap.get("bg_removal")            ?? 0, cap: caps.bg_removal },
    scheduled_posts: { used: usageMap.get("scheduled_post")        ?? 0, cap: caps.scheduled_posts }
  };

  return NextResponse.json({
    ok: true,
    merchant: {
      slug:          listing.slug,
      display_name:  listing.display_name,
      avatar_url:    listing.avatar_url,
      tier,
      trading_name:  listing.trading_name,
      whatsapp:      listing.whatsapp,
      timezone:      listing.timezone ?? "Europe/London"
    },
    wallet: {
      balance:        walletBalance,
      monthly_credit: wallet.monthly_credit ?? 0,
      replenish_at:   wallet.next_replenish_at ?? null,
      low:            walletBalance < 5
    },
    inbox: {
      unread_notifications: unreadNotifsRes.count ?? 0,
      pending_scheduled:    pendingScheduledRes.count ?? 0
    },
    growth,
    checklist,
    usage,
    recent: (activityRes.data ?? []) as Array<{ event_type: string; event_payload: unknown; created_at: string }>
  });
}
