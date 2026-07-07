// Business Coach v1 — deterministic recommendations.
//
// Rule-based. Each rule looks at the Hub snapshot and either fires
// with a recommendation or stays quiet. The Hub renders the top 3
// (by evidence strength) so the merchant is never overwhelmed.
//
// Later a v2 will bring in evidence-engine machine-learned patterns
// (already scoped in memory: xratedtrades_evidence_engine). For now
// v1 catches the single biggest lever — response velocity — plus the
// obvious hygiene items merchants forget.
import type { BusinessHubSnapshot } from "./aggregator";

export type CoachRecommendation = {
  id: string;
  severity: "urgent" | "high" | "moderate" | "growth";
  title: string;
  evidence: string;
  actionLabel: string;
  actionHref: string;
};

export function generateCoachRecommendations(
  snapshot: BusinessHubSnapshot
): CoachRecommendation[] {
  const recs: CoachRecommendation[] = [];

  // 1) Response-velocity — the single biggest lever in trades sales
  if (snapshot.overallResponseHours != null) {
    if (snapshot.overallResponseHours > 4) {
      recs.push({
        id: "response-velocity",
        severity: "urgent",
        title: "Your quote response time is your biggest revenue lever",
        evidence: `You're averaging ${snapshot.overallResponseHours}h to send a quote. Merchants replying under 1h win about 3× more work than those replying over 4h.`,
        actionLabel: "Draft outstanding quotes now",
        actionHref: "/site-office/apps/quote-workspace"
      });
    } else if (snapshot.overallResponseHours > 2) {
      recs.push({
        id: "response-velocity-warm",
        severity: "high",
        title: "One step from best-in-class response time",
        evidence: `You're at ${snapshot.overallResponseHours}h. Under 1h response wins ~3× more — you're close.`,
        actionLabel: "Clear the drafts",
        actionHref: "/site-office/apps/quote-workspace"
      });
    }
  }

  // 2) Ready-to-quote leads — every one is a real customer waiting
  if (snapshot.counters.unquotedLeads > 0) {
    recs.push({
      id: "unquoted-leads",
      severity: snapshot.counters.unquotedLeads > 3 ? "urgent" : "high",
      title: `${snapshot.counters.unquotedLeads} render${snapshot.counters.unquotedLeads === 1 ? "" : "s"} waiting to be quoted`,
      evidence:
        "Each of these people already picked a design in your storefront. Auto-draft their quote in one tap — you don't have to start from scratch.",
      actionLabel: "Open pipeline",
      actionHref: "/site-office/apps/quote-workspace"
    });
  }

  // 3) Quotes about to expire — save the deals before they die
  if (snapshot.counters.quotesExpiringSoon > 0) {
    recs.push({
      id: "quotes-expiring",
      severity: "urgent",
      title: `${snapshot.counters.quotesExpiringSoon} quote${snapshot.counters.quotesExpiringSoon === 1 ? "" : "s"} expiring in the next 3 days`,
      evidence: "A quick nudge here typically doubles the acceptance rate versus letting them expire silently.",
      actionLabel: "See expiring quotes",
      actionHref: "/site-office/apps/quote-workspace"
    });
  }

  // 4) Silent contacts — money on the floor
  if (snapshot.counters.silentContacts >= 3) {
    recs.push({
      id: "silent-contacts",
      severity: "high",
      title: `${snapshot.counters.silentContacts} customers gone quiet 30+ days ago`,
      evidence:
        "Follow-ups from the CRM auto-draft your message based on where you left off. One tap sends via WhatsApp.",
      actionLabel: "Re-engage contacts",
      actionHref: "/site-office/apps/crm?stage=silent"
    });
  }

  // 5) Overdue follow-ups
  if (snapshot.counters.followUpsOverdue > 0) {
    recs.push({
      id: "followups-overdue",
      severity: "high",
      title: `${snapshot.counters.followUpsOverdue} follow-up${snapshot.counters.followUpsOverdue === 1 ? "" : "s"} overdue`,
      evidence:
        "Every day a task slips typically halves the response rate on that contact.",
      actionLabel: "Clear follow-ups",
      actionHref: "/site-office/apps/crm"
    });
  }

  // Products (App #006) — stock + catalog health
  if (snapshot.counters.offersOutOfStock >= 1) {
    recs.push({
      id: "products-out-of-stock",
      severity: "high",
      title: `${snapshot.counters.offersOutOfStock} product${snapshot.counters.offersOutOfStock === 1 ? "" : "s"} out of stock`,
      evidence:
        "Out-of-stock offers still appear in AI Visualiser designs and quotes. Homeowners see a real product with a 'currently unavailable' badge — friction you can remove with a supplier order.",
      actionLabel: "Restock or hide",
      actionHref: "/site-office/apps/products"
    });
  }
  if (snapshot.counters.offersMissingImages >= 3) {
    recs.push({
      id: "products-missing-images",
      severity: "moderate",
      title: `${snapshot.counters.offersMissingImages} product${snapshot.counters.offersMissingImages === 1 ? "" : "s"} without your own images`,
      evidence:
        "Offers rely on manufacturer stock imagery only — merchants who add one real photo per SKU convert around 40% more browsers into enquiries.",
      actionLabel: "Add images",
      actionHref: "/site-office/apps/products"
    });
  }

  // 6) Reviews needing response — public reputation
  if (snapshot.counters.reviewsNoResponse >= 2) {
    recs.push({
      id: "review-response",
      severity: "moderate",
      title: `${snapshot.counters.reviewsNoResponse} reviews without a response`,
      evidence:
        "Homeowners browsing your profile pay close attention to how you respond. A 30-second thank-you compounds.",
      actionLabel: "Respond to reviews",
      actionHref: "/site-office/apps/reviews"
    });
  }

  // 7) Wins this month — growth signal (never an urgent alert)
  if (snapshot.money.bookedThisMonthPence > 0) {
    const gbp = `£${(snapshot.money.bookedThisMonthPence / 100).toFixed(0)}`;
    const delta =
      snapshot.money.bookedLastMonthPence > 0
        ? Math.round(
            ((snapshot.money.bookedThisMonthPence -
              snapshot.money.bookedLastMonthPence) /
              snapshot.money.bookedLastMonthPence) *
              100
          )
        : null;
    recs.push({
      id: "month-progress",
      severity: "growth",
      title: `${gbp} booked this month`,
      evidence:
        delta !== null
          ? `${delta > 0 ? "+" : ""}${delta}% vs the same time last month.`
          : "First recorded acceptances of the month.",
      actionLabel: "See revenue detail",
      actionHref: "/site-office/apps/quote-workspace"
    });
  }

  // Prioritise: urgent → high → moderate → growth, cap at 3
  const rank: Record<CoachRecommendation["severity"], number> = {
    urgent: 0,
    high: 1,
    moderate: 2,
    growth: 3
  };
  recs.sort((a, b) => rank[a.severity] - rank[b.severity]);
  return recs.slice(0, 3);
}
