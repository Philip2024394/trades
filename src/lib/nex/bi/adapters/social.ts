// Social + marketing adapter — reads hammerex_nex_social_posts and
// hammerex_merchant_daily_metrics.
//
// KPIs:
//   • posts_published    — status=published in window
//   • posts_awaiting     — status=awaiting_approval (open queue)
//   • views              — profile_views summed from daily_metrics
//   • whatsapp_taps      — whatsapp_clicks summed
//   • wa_conversion_pct  — whatsapp_taps / views
// Sub-score:
//   Weighted mix of publishing activity + reach + conversion.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { BIAdapter, DomainMetrics, Observation } from "../types";
import { evidenceFor } from "../types";
import { scoreMetric } from "../health";
import { pctChange, windows } from "./_shared";

export const socialAdapter: BIAdapter = {
  domain: "social",
  label:  "Social & marketing",
  weight: 1.2,

  async run(ctx) {
    const now = ctx.now ?? new Date();
    const w = windows(ctx.lookbackDays, now);

    // Posts published in window (grouped by platform for observations).
    const postsNow = await supabaseAdmin
      .from("hammerex_nex_social_posts")
      .select("platform, published_at, status")
      .eq("merchant_slug", ctx.merchantSlug)
      .eq("status", "published")
      .gte("published_at", w.currentStart)
      .lte("published_at", w.currentEnd);

    const postsPrior = await supabaseAdmin
      .from("hammerex_nex_social_posts")
      .select("id", { count: "exact", head: true })
      .eq("merchant_slug", ctx.merchantSlug)
      .eq("status", "published")
      .gte("published_at", w.priorStart)
      .lte("published_at", w.priorEnd);

    const awaiting = await supabaseAdmin
      .from("hammerex_nex_social_posts")
      .select("id", { count: "exact", head: true })
      .eq("merchant_slug", ctx.merchantSlug)
      .eq("status", "awaiting_approval");

    // Analytics — sum daily rollups.
    const fromDate = new Date(now.getTime() - ctx.lookbackDays * 86_400_000).toISOString().slice(0, 10);
    const priorFrom = new Date(now.getTime() - 2 * ctx.lookbackDays * 86_400_000).toISOString().slice(0, 10);
    const priorTo   = fromDate;

    const analyticsNow = await supabaseAdmin
      .from("hammerex_merchant_daily_metrics")
      .select("profile_views, whatsapp_clicks, reactions")
      .eq("merchant_slug", ctx.merchantSlug)
      .gte("date", fromDate);

    const analyticsPrior = await supabaseAdmin
      .from("hammerex_merchant_daily_metrics")
      .select("profile_views, whatsapp_clicks")
      .eq("merchant_slug", ctx.merchantSlug)
      .gte("date", priorFrom)
      .lt("date", priorTo);

    const posts = postsNow.data ?? [];
    const publishedCount = posts.length;
    const priorPublished = postsPrior.count ?? 0;
    const awaitingCount  = awaiting.count ?? 0;

    const now_rows = analyticsNow.data ?? [];
    const prior_rows = analyticsPrior.data ?? [];
    const views      = now_rows.reduce((s, r) => s + (r.profile_views ?? 0), 0);
    const waTaps     = now_rows.reduce((s, r) => s + (r.whatsapp_clicks ?? 0), 0);
    const reactions  = now_rows.reduce((s, r) => s + (r.reactions ?? 0), 0);
    const priorViews = prior_rows.reduce((s, r) => s + (r.profile_views ?? 0), 0);
    const priorTaps  = prior_rows.reduce((s, r) => s + (r.whatsapp_clicks ?? 0), 0);

    const waConversion = views === 0 ? null : Number(((waTaps / views) * 100).toFixed(1));
    const priorConversion = priorViews === 0 ? null : Number(((priorTaps / priorViews) * 100).toFixed(1));

    // Best platform (by post count in the window) — for observation only.
    const byPlatform: Record<string, number> = {};
    for (const p of posts) byPlatform[String(p.platform ?? "?")] = (byPlatform[String(p.platform ?? "?")] ?? 0) + 1;
    const topPlatformEntry = Object.entries(byPlatform).sort((a, b) => b[1] - a[1])[0] ?? null;

    const publishScore = scoreMetric(publishedCount, { floor: 0, ceiling: 12, direction: "higher_is_better" });
    const reachScore   = scoreMetric(views,          { floor: 0, ceiling: 1000, direction: "higher_is_better" });
    const convScore    = waConversion === null ? 50 : scoreMetric(waConversion, { floor: 0.5, ceiling: 6, direction: "higher_is_better" });
    const subScore = Math.round((publishScore + reachScore + convScore) / 3);

    const evidence = evidenceFor("hammerex_nex_social_posts + hammerex_merchant_daily_metrics", ["hammerex_nex_social_posts", "hammerex_merchant_daily_metrics"], "/studio/social");

    const observations: Observation[] = [];
    if (awaitingCount > 0) {
      observations.push({
        key:      "posts_awaiting",
        domain:   "social",
        severity: "notice",
        headline: `${awaitingCount} social ${awaitingCount === 1 ? "post is" : "posts are"} awaiting your approval.`,
        action:   { label: "Open Social", href: "/studio/social" },
        evidence
      });
    }
    const publishedChange = pctChange(publishedCount, priorPublished);
    if (publishedChange !== null && publishedChange <= -50 && publishedCount === 0) {
      observations.push({
        key:      "posts_none",
        domain:   "social",
        severity: "warning",
        headline: `You haven't published a social post in the last ${ctx.lookbackDays} days.`,
        detail:   "Merchants who post at least once a week get 2× the beacon match rate. I can draft one from your recent projects.",
        action:   { label: "Draft a post", href: "/nex?prompt=Draft%20a%20social%20post%20from%20my%20recent%20projects" },
        evidence
      });
    }
    const viewsChange = pctChange(views, priorViews);
    if (viewsChange !== null && viewsChange >= 25) {
      observations.push({
        key:      "views_up",
        domain:   "social",
        severity: "info",
        headline: `Profile views are up ${viewsChange}% versus the previous ${ctx.lookbackDays} days.`,
        evidence
      });
    }
    if (topPlatformEntry && publishedCount >= 3) {
      const [platform, n] = topPlatformEntry;
      observations.push({
        key:      "platform_leader",
        domain:   "social",
        severity: "info",
        headline: `${n} of your ${publishedCount} recent posts went to ${platform}.`,
        evidence
      });
    }

    return {
      domain: "social",
      label:  "Social & marketing",
      sub_score: subScore,
      weight:    1.2,
      metrics: [
        { key: "posts_published",   label: "Posts published",   value: publishedCount, prior: priorPublished, unit: "count", direction: "higher_is_better", evidence },
        { key: "posts_awaiting",    label: "Awaiting approval", value: awaitingCount,  unit: "count",  direction: "lower_is_better",  evidence },
        { key: "profile_views",     label: "Profile views",     value: views,          prior: priorViews, unit: "count", direction: "higher_is_better", evidence },
        { key: "whatsapp_taps",     label: "WhatsApp taps",     value: waTaps,         prior: priorTaps,  unit: "count", direction: "higher_is_better", evidence },
        { key: "wa_conversion_pct", label: "WhatsApp conversion", value: waConversion, prior: priorConversion, unit: "pct", direction: "higher_is_better", evidence },
        { key: "reactions",         label: "Reactions",         value: reactions,      unit: "count",  direction: "higher_is_better", evidence }
      ],
      observations
    };
  }
};
