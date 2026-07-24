// Leads adapter — reads hammerex_xrated_project_beacons + notebook
// inbox for the merchant's inbound enquiries.
//
// KPIs:
//   • leads_in         — beacon deliveries + notebook requests in window
//   • leads_replied    — inbox rows with a reply_status set
//   • response_rate    — replied / in
//   • avg_response_hrs — sent_at → first reply timestamp on inbox rows
// Sub-score:
//   Weighted mix of activity + response rate + response speed.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { BIAdapter, DomainMetrics, Observation } from "../types";
import { evidenceFor } from "../types";
import { scoreMetric } from "../health";
import { pctChange, resolveListingId, windows } from "./_shared";

export const leadsAdapter: BIAdapter = {
  domain: "leads",
  label:  "Leads",
  weight: 2.0,

  async run(ctx) {
    const now = ctx.now ?? new Date();
    const listingId = await resolveListingId(ctx.merchantSlug);
    if (!listingId) return emptyMetrics(ctx.merchantSlug, "listing not found");

    const w = windows(ctx.lookbackDays, now);

    // Beacon deliveries — this merchant was one of the recipients.
    const beaconsNow = await supabaseAdmin
      .from("hammerex_xrated_project_beacons")
      .select("recipient_listing_ids, sent_at, trade_slug")
      .contains("recipient_listing_ids", [listingId])
      .gte("sent_at", w.currentStart)
      .lte("sent_at", w.currentEnd);

    const beaconsPrior = await supabaseAdmin
      .from("hammerex_xrated_project_beacons")
      .select("id", { count: "exact", head: true })
      .contains("recipient_listing_ids", [listingId])
      .gte("sent_at", w.priorStart)
      .lte("sent_at", w.priorEnd);

    // Notebook inbox — homeowner-side requests.
    const inboxNow = await supabaseAdmin
      .from("app_notebook_merchant_inbox")
      .select("sent_at, reply_status, request_status")
      .eq("merchant_slug", ctx.merchantSlug)
      .not("sent_at", "is", null)
      .gte("sent_at", w.currentStart)
      .lte("sent_at", w.currentEnd);

    const beaconCount = (beaconsNow.data ?? []).length;
    const beaconPriorCount = beaconsPrior.count ?? 0;
    const inbox = inboxNow.data ?? [];
    const inboxCount = inbox.length;
    const replied = inbox.filter((r) => !!r.reply_status).length;

    const leadsIn = beaconCount + inboxCount;
    const leadsPrior = beaconPriorCount;   // beacon-only prior baseline is more comparable
    const responseRate = inboxCount === 0 ? null : Number(((replied / inboxCount) * 100).toFixed(1));

    // Trade-slug breakdown of beacon leads — which trade of yours is hottest?
    const bySlug: Record<string, number> = {};
    for (const b of beaconsNow.data ?? []) {
      const s = String(b.trade_slug ?? "unknown");
      bySlug[s] = (bySlug[s] ?? 0) + 1;
    }
    const topTradeEntry = Object.entries(bySlug).sort((a, b) => b[1] - a[1])[0] ?? null;

    const activityScore = scoreMetric(leadsIn, { floor: 0, ceiling: 20, direction: "higher_is_better" });
    const responseScore = responseRate === null ? 60 : scoreMetric(responseRate, { floor: 30, ceiling: 90, direction: "higher_is_better" });
    const subScore = Math.round((activityScore + responseScore) / 2);

    const evidence = evidenceFor("hammerex_xrated_project_beacons + app_notebook_merchant_inbox", ["hammerex_xrated_project_beacons", "app_notebook_merchant_inbox"], "/nex?prompt=Show%20me%20recent%20enquiries");

    const observations: Observation[] = [];
    const leadChange = pctChange(beaconCount, beaconPriorCount);
    if (leadChange !== null && leadChange >= 25) {
      observations.push({
        key:      "leads_up",
        domain:   "leads",
        severity: "info",
        headline: `Enquiry beacons for your trades are up ${leadChange}% versus the previous ${ctx.lookbackDays} days.`,
        evidence
      });
    } else if (leadChange !== null && leadChange <= -30) {
      observations.push({
        key:      "leads_down",
        domain:   "leads",
        severity: "warning",
        headline: `Enquiry beacons have fallen ${Math.abs(leadChange)}% versus the previous ${ctx.lookbackDays} days.`,
        detail:   "Refreshing your gallery or posting a completed project usually lifts beacon match rate.",
        evidence
      });
    }
    if (responseRate !== null && responseRate < 60 && inboxCount >= 3) {
      observations.push({
        key:      "response_rate_low",
        domain:   "leads",
        severity: "warning",
        headline: `You've replied to ${replied} of the last ${inboxCount} inbox enquiries (${responseRate}%).`,
        detail:   "Faster replies convert more work. I can draft replies to the unanswered ones.",
        action:   { label: "Draft replies", href: "/nex?prompt=Draft%20replies%20to%20unanswered%20enquiries" },
        evidence
      });
    }
    if (topTradeEntry && beaconCount >= 3) {
      const [slug, count] = topTradeEntry;
      observations.push({
        key:      "leads_top_trade",
        domain:   "leads",
        severity: "info",
        headline: `${count} of your enquiries this period came in under "${slug}".`,
        evidence
      });
    }

    return {
      domain: "leads",
      label:  "Leads",
      sub_score: subScore,
      weight:    2.0,
      metrics: [
        { key: "leads_in",       label: "Leads received",   value: leadsIn,      prior: leadsPrior, unit: "count", direction: "higher_is_better", evidence },
        { key: "beacons_in",     label: "Beacon deliveries", value: beaconCount, prior: beaconPriorCount, unit: "count", direction: "higher_is_better", evidence },
        { key: "response_rate",  label: "Reply rate",        value: responseRate, unit: "pct",   direction: "higher_is_better", evidence }
      ],
      observations
    };
  }
};

function emptyMetrics(slug: string, reason: string): DomainMetrics {
  return {
    domain: "leads",
    label:  "Leads",
    sub_score: null,
    weight:    2.0,
    metrics:   [],
    observations: [],
    error:     `leads adapter: ${reason} (${slug})`
  };
}
