// Reviews adapter — reads hammerex_network_reviews.
//
// KPIs:
//   • reviews_live       — live reviews in window
//   • avg_rating         — mean of overall_score across live reviews (5-pt)
//   • response_rate      — % of live reviews with owner_response_body
// Sub-score:
//   Weighted mix of rating (0–5 → 0–100) and response rate.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { BIAdapter, DomainMetrics, Observation } from "../types";
import { evidenceFor } from "../types";
import { scoreMetric } from "../health";
import { pctChange, windows } from "./_shared";

export const reviewsAdapter: BIAdapter = {
  domain: "reviews",
  label:  "Reviews",
  weight: 1.5,

  async run(ctx) {
    const now = ctx.now ?? new Date();
    const w = windows(ctx.lookbackDays, now);

    const now_ = await supabaseAdmin
      .from("hammerex_network_reviews")
      .select("overall_score, owner_response_body, created_at", { count: "exact" })
      .eq("merchant_slug", ctx.merchantSlug)
      .eq("status", "live")
      .gte("created_at", w.currentStart)
      .lte("created_at", w.currentEnd);

    const prior = await supabaseAdmin
      .from("hammerex_network_reviews")
      .select("overall_score", { count: "exact" })
      .eq("merchant_slug", ctx.merchantSlug)
      .eq("status", "live")
      .gte("created_at", w.priorStart)
      .lte("created_at", w.priorEnd);

    const pending = await supabaseAdmin
      .from("hammerex_network_reviews")
      .select("id", { count: "exact", head: true })
      .eq("merchant_slug", ctx.merchantSlug)
      .eq("status", "live")
      .is("owner_response_body", null);

    const rows = now_.data ?? [];
    const count = rows.length;
    const priorCount = prior.count ?? 0;
    const priorRows = prior.data ?? [];

    const avgRating = count === 0 ? null : Number((rows.reduce((s, r) => s + Number(r.overall_score ?? 0), 0) / count).toFixed(2));
    const priorAvg  = priorCount === 0 ? null : Number((priorRows.reduce((s, r) => s + Number(r.overall_score ?? 0), 0) / priorCount).toFixed(2));

    const withReply = rows.filter((r) => (r.owner_response_body ?? "").trim().length > 0).length;
    const responseRate = count === 0 ? null : Number(((withReply / count) * 100).toFixed(1));

    const pendingReplies = pending.count ?? 0;

    const ratingScore = avgRating === null ? 60 : scoreMetric(avgRating * 20, { floor: 60, ceiling: 96, direction: "higher_is_better" });
    const replyScore  = responseRate === null ? 60 : scoreMetric(responseRate, { floor: 30, ceiling: 90, direction: "higher_is_better" });
    const subScore = Math.round((ratingScore * 2 + replyScore) / 3);

    const evidence = evidenceFor("hammerex_network_reviews (status=live)", ["hammerex_network_reviews"], "/nex?prompt=Show%20my%20recent%20reviews");

    const observations: Observation[] = [];
    if (pendingReplies > 0) {
      observations.push({
        key:      "reviews_awaiting_reply",
        domain:   "reviews",
        severity: pendingReplies >= 3 ? "warning" : "notice",
        headline: `${pendingReplies} ${pendingReplies === 1 ? "review is" : "reviews are"} waiting for your reply.`,
        detail:   "Replying shows future customers you engage. I can draft each response for your approval.",
        action:   { label: "Draft replies", href: "/nex?prompt=Draft%20replies%20to%20my%20unanswered%20reviews" },
        evidence
      });
    }
    const ratingChange = avgRating !== null && priorAvg !== null ? Number((avgRating - priorAvg).toFixed(2)) : null;
    if (ratingChange !== null && ratingChange <= -0.3) {
      observations.push({
        key:      "reviews_rating_slipping",
        domain:   "reviews",
        severity: "warning",
        headline: `Average review rating slipped from ${priorAvg} to ${avgRating} this period.`,
        evidence
      });
    }
    const countChange = pctChange(count, priorCount);
    if (countChange !== null && countChange >= 40) {
      observations.push({
        key:      "reviews_volume_up",
        domain:   "reviews",
        severity: "info",
        headline: `Review volume is up ${countChange}% versus the previous period.`,
        evidence
      });
    }

    return {
      domain: "reviews",
      label:  "Reviews",
      sub_score: subScore,
      weight:    1.5,
      metrics: [
        { key: "reviews_live",  label: "Reviews (live)",     value: count,        prior: priorCount, unit: "count", direction: "higher_is_better", evidence },
        { key: "avg_rating",    label: "Average rating (5)", value: avgRating,    prior: priorAvg,   unit: "score", direction: "higher_is_better", evidence },
        { key: "response_rate", label: "Reply rate",         value: responseRate, unit: "pct",       direction: "higher_is_better", evidence },
        { key: "pending_replies", label: "Awaiting reply",   value: pendingReplies, unit: "count",   direction: "lower_is_better", evidence }
      ],
      observations
    };
  }
};
