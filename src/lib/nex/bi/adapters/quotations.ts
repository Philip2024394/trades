// Quotations adapter — reads app_quote_workspace_quotes.
//
// KPIs:
//   • quotes_sent       — sent_at within lookback window
//   • quotes_accepted   — accepted_at within lookback window
//   • conversion_pct    — accepted / sent  (over the same window)
//   • avg_quote_gbp     — mean of total_pence over quotes sent
// Sub-score:
//   Weighted mix of "activity" (some quotes sent) and conversion.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { BIAdapter, DomainMetrics, Observation } from "../types";
import { evidenceFor } from "../types";
import { scoreMetric } from "../health";
import { pctChange, resolveListingId, windows } from "./_shared";

export const quotationsAdapter: BIAdapter = {
  domain: "quotations",
  label:  "Quotations",
  weight: 1.8,

  async run(ctx) {
    const now = ctx.now ?? new Date();
    const listingId = await resolveListingId(ctx.merchantSlug);
    if (!listingId) return emptyMetrics(ctx.merchantSlug, "listing not found");

    const w = windows(ctx.lookbackDays, now);

    const sentNow = await supabaseAdmin
      .from("app_quote_workspace_quotes")
      .select("total_pence, accepted_at, sent_at, rejected_at", { count: "exact" })
      .eq("merchant_id", listingId)
      .not("sent_at", "is", null)
      .gte("sent_at", w.currentStart)
      .lte("sent_at", w.currentEnd);

    const sentPrior = await supabaseAdmin
      .from("app_quote_workspace_quotes")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", listingId)
      .not("sent_at", "is", null)
      .gte("sent_at", w.priorStart)
      .lte("sent_at", w.priorEnd);

    const acceptedPrior = await supabaseAdmin
      .from("app_quote_workspace_quotes")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", listingId)
      .not("accepted_at", "is", null)
      .gte("accepted_at", w.priorStart)
      .lte("accepted_at", w.priorEnd);

    const outstanding = await supabaseAdmin
      .from("app_quote_workspace_quotes")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", listingId)
      .not("sent_at", "is", null)
      .is("accepted_at", null)
      .is("rejected_at", null);

    const sentCount     = sentNow.count ?? 0;
    const sentPriorCount = sentPrior.count ?? 0;
    const accepted      = (sentNow.data ?? []).filter((r) => !!r.accepted_at).length;
    const priorAccepted = acceptedPrior.count ?? 0;
    const outstandingCount = outstanding.count ?? 0;

    const conversion = sentCount === 0 ? null : Number(((accepted / sentCount) * 100).toFixed(1));
    const priorConversion = sentPriorCount === 0 ? null : Number(((priorAccepted / sentPriorCount) * 100).toFixed(1));

    const totalPence = (sentNow.data ?? []).reduce((sum, r) => sum + (r.total_pence ?? 0), 0);
    const avgGbp = sentCount === 0 ? null : Number(((totalPence / sentCount) / 100).toFixed(2));

    const activityScore   = sentCount > 0 ? 100 : 30;
    const conversionScore = conversion === null ? 50 : scoreMetric(conversion, { floor: 10, ceiling: 60, direction: "higher_is_better" });
    const subScore        = Math.round((activityScore + conversionScore) / 2);

    const evidence = evidenceFor("app_quote_workspace_quotes", ["app_quote_workspace_quotes"], "/studio/quotes");

    const observations: Observation[] = [];
    if (outstandingCount > 0) {
      observations.push({
        key:      "quotes_awaiting_reply",
        domain:   "quotations",
        severity: outstandingCount >= 5 ? "warning" : "notice",
        headline: `${outstandingCount} ${outstandingCount === 1 ? "quotation is" : "quotations are"} awaiting a reply.`,
        detail:   "A follow-up nudge inside 48 hours lifts conversion. Would you like me to draft one?",
        action:   { label: "Draft follow-ups", href: "/nex?prompt=Draft%20follow-ups%20for%20outstanding%20quotations" },
        evidence
      });
    }
    if (conversion !== null && priorConversion !== null) {
      const delta = Number((conversion - priorConversion).toFixed(1));
      if (delta <= -10) {
        observations.push({
          key:      "quote_conversion_dropped",
          domain:   "quotations",
          severity: "warning",
          headline: `Quote conversion has fallen from ${priorConversion}% to ${conversion}% this period.`,
          evidence
        });
      } else if (delta >= 10) {
        observations.push({
          key:      "quote_conversion_up",
          domain:   "quotations",
          severity: "info",
          headline: `Quote conversion has climbed from ${priorConversion}% to ${conversion}%.`,
          evidence
        });
      }
    }
    if (avgGbp !== null) {
      // Only fire if we can compare with prior avg — otherwise silence.
      const priorRows = await supabaseAdmin
        .from("app_quote_workspace_quotes")
        .select("total_pence")
        .eq("merchant_id", listingId)
        .not("sent_at", "is", null)
        .gte("sent_at", w.priorStart)
        .lte("sent_at", w.priorEnd);
      const priorTotal = (priorRows.data ?? []).reduce((s, r) => s + (r.total_pence ?? 0), 0);
      const priorAvg = sentPriorCount > 0 ? (priorTotal / sentPriorCount) / 100 : null;
      const change = pctChange(avgGbp, priorAvg);
      if (change !== null && change >= 15) {
        observations.push({
          key:      "quote_avg_up",
          domain:   "quotations",
          severity: "info",
          headline: `Your average quotation value has risen ${change}% versus the previous period.`,
          evidence
        });
      }
    }

    return {
      domain: "quotations",
      label:  "Quotations",
      sub_score: subScore,
      weight:    1.8,
      metrics: [
        { key: "quotes_sent",     label: "Quotes sent",     value: sentCount,     prior: sentPriorCount, unit: "count", direction: "higher_is_better", evidence },
        { key: "quotes_accepted", label: "Quotes accepted", value: accepted,      prior: priorAccepted,  unit: "count", direction: "higher_is_better", evidence },
        { key: "conversion_pct",  label: "Quote conversion", value: conversion,   prior: priorConversion, unit: "pct",  direction: "higher_is_better", evidence },
        { key: "avg_quote_gbp",   label: "Average quote value", value: avgGbp,    unit: "gbp",   direction: "higher_is_better", evidence },
        { key: "quotes_outstanding", label: "Awaiting reply",  value: outstandingCount, unit: "count", direction: "lower_is_better", evidence }
      ],
      observations
    };
  }
};

function emptyMetrics(slug: string, reason: string): DomainMetrics {
  return {
    domain: "quotations",
    label:  "Quotations",
    sub_score: null,
    weight:    1.8,
    metrics:   [],
    observations: [],
    error:     `quotations adapter: ${reason} (${slug})`
  };
}
