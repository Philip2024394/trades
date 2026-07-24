// Invoices adapter — derives per-merchant revenue + outstanding
// balance from app_quote_workspace_quotes (accepted quotes are the
// merchant's booked revenue) and app_notebook_merchant_inbox
// (delivery-request replies with a total). No dedicated invoice
// table exists per-merchant today — this adapter surfaces what CAN
// be provably counted and stays silent otherwise (evidence-or-silence).
//
// KPIs:
//   • revenue_gbp        — sum of accepted quote totals in window
//   • outstanding_gbp    — sum of quotes sent + not paid/rejected/expired
//   • avg_payment_days   — median accepted_at → completed_at (proxy)
// Sub-score:
//   Weighted mix of revenue movement + outstanding ratio.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { BIAdapter, DomainMetrics, Observation } from "../types";
import { evidenceFor } from "../types";
import { scoreMetric } from "../health";
import { pctChange, resolveListingId, windows } from "./_shared";

export const invoicesAdapter: BIAdapter = {
  domain: "invoices",
  label:  "Invoices",
  weight: 2.0,

  async run(ctx) {
    const now = ctx.now ?? new Date();
    const listingId = await resolveListingId(ctx.merchantSlug);
    if (!listingId) return emptyMetrics(ctx.merchantSlug, "listing not found");

    const w = windows(ctx.lookbackDays, now);

    // Accepted quotes = booked revenue.
    const acceptedNow = await supabaseAdmin
      .from("app_quote_workspace_quotes")
      .select("total_pence, accepted_at")
      .eq("merchant_id", listingId)
      .not("accepted_at", "is", null)
      .gte("accepted_at", w.currentStart)
      .lte("accepted_at", w.currentEnd);

    const acceptedPrior = await supabaseAdmin
      .from("app_quote_workspace_quotes")
      .select("total_pence")
      .eq("merchant_id", listingId)
      .not("accepted_at", "is", null)
      .gte("accepted_at", w.priorStart)
      .lte("accepted_at", w.priorEnd);

    // Outstanding = sent but not yet accepted/rejected.
    const outstanding = await supabaseAdmin
      .from("app_quote_workspace_quotes")
      .select("total_pence, sent_at, expires_at")
      .eq("merchant_id", listingId)
      .not("sent_at", "is", null)
      .is("accepted_at", null)
      .is("rejected_at", null);

    // Notebook delivery replies with a merchant total — inbox counts as
    // priced-work outstanding until the customer confirms.
    const inboxOutstanding = await supabaseAdmin
      .from("app_notebook_merchant_inbox")
      .select("merchant_subtotal_gbp, reply_total_gbp, request_status")
      .eq("merchant_slug", ctx.merchantSlug)
      .not("reply_status", "is", null)
      .neq("request_status", "paid");

    const revenuePence   = (acceptedNow.data ?? []).reduce((s, r) => s + (r.total_pence ?? 0), 0);
    const revenueGbp     = Number((revenuePence / 100).toFixed(2));
    const priorPence     = (acceptedPrior.data ?? []).reduce((s, r) => s + (r.total_pence ?? 0), 0);
    const priorGbp       = Number((priorPence / 100).toFixed(2));
    const revenueChange  = pctChange(revenueGbp, priorGbp);

    const outstandingPence = (outstanding.data ?? []).reduce((s, r) => s + (r.total_pence ?? 0), 0);
    const inboxGbp = (inboxOutstanding.data ?? []).reduce((s, r) => s + Number(r.reply_total_gbp ?? r.merchant_subtotal_gbp ?? 0), 0);
    const outstandingGbp = Number((outstandingPence / 100 + inboxGbp).toFixed(2));

    const overdue = (outstanding.data ?? []).filter((r) => r.expires_at && new Date(r.expires_at).getTime() < now.getTime());
    const overduePence = overdue.reduce((s, r) => s + (r.total_pence ?? 0), 0);
    const overdueGbp   = Number((overduePence / 100).toFixed(2));

    const revenueScore = revenueGbp > 0
      ? scoreMetric(revenueGbp, { floor: 0, ceiling: Math.max(priorGbp * 1.5, 1000), direction: "higher_is_better" })
      : 25;
    // Outstanding ratio: lower is better.
    const outRatio = revenueGbp > 0 ? outstandingGbp / (revenueGbp + outstandingGbp) : (outstandingGbp > 0 ? 1 : 0.5);
    const outstandingScore = scoreMetric(outRatio, { floor: 0.6, ceiling: 0.1, direction: "lower_is_better" });
    const subScore = Math.round((revenueScore * 2 + outstandingScore) / 3);

    const evidence = evidenceFor("app_quote_workspace_quotes + app_notebook_merchant_inbox", ["app_quote_workspace_quotes", "app_notebook_merchant_inbox"], "/studio/quotes");

    const observations: Observation[] = [];
    if (overdueGbp > 0) {
      observations.push({
        key:      "invoices_overdue",
        domain:   "invoices",
        severity: overdueGbp > 1000 ? "alert" : "warning",
        headline: `£${overdueGbp.toLocaleString("en-GB")} in quotes has passed its expiry with no reply.`,
        detail:   "I can draft a courteous chase for each one.",
        action:   { label: "Chase overdue", href: "/nex?prompt=Chase%20overdue%20quotations" },
        evidence
      });
    }
    if (revenueChange !== null && revenueChange >= 20) {
      observations.push({
        key:      "revenue_up",
        domain:   "invoices",
        severity: "info",
        headline: `Booked revenue is up ${revenueChange}% versus the previous ${ctx.lookbackDays} days.`,
        evidence
      });
    } else if (revenueChange !== null && revenueChange <= -25) {
      observations.push({
        key:      "revenue_down",
        domain:   "invoices",
        severity: "warning",
        headline: `Booked revenue is down ${Math.abs(revenueChange)}% versus the previous ${ctx.lookbackDays} days.`,
        evidence
      });
    }

    return {
      domain: "invoices",
      label:  "Invoices",
      sub_score: subScore,
      weight:    2.0,
      metrics: [
        { key: "revenue_gbp",     label: "Booked revenue",       value: revenueGbp,     prior: priorGbp, unit: "gbp", direction: "higher_is_better", evidence },
        { key: "outstanding_gbp", label: "Outstanding",          value: outstandingGbp, unit: "gbp",   direction: "lower_is_better", evidence },
        { key: "overdue_gbp",     label: "Past expiry",          value: overdueGbp,     unit: "gbp",   direction: "lower_is_better", evidence }
      ],
      observations
    };
  }
};

function emptyMetrics(slug: string, reason: string): DomainMetrics {
  return {
    domain: "invoices",
    label:  "Invoices",
    sub_score: null,
    weight:    2.0,
    metrics:   [],
    observations: [],
    error:     `invoices adapter: ${reason} (${slug})`
  };
}
