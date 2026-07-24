// Opportunities enricher — spots future work from historical signals.
//
// Rules ship with clear "because" strings so Nex never invents a
// reason. Missing signals produce zero opportunities (silence over
// spam is the SiteBook blueprint rule).

import type { ContactSummary } from "@/lib/crm/loadContactTimeline";
import { evidenceFor, type Opportunity } from "../types";

const DAY_MS = 86_400_000;

/** Trade keyword → maintenance cadence in days + suggestion. */
const CADENCE: Array<{ match: RegExp; days: number; suggest: string; window_days: number }> = [
  { match: /\b(kitchen|bathroom)\b/i,        days: 540, suggest: "annual maintenance / silicone re-seal check",     window_days: 90 },
  { match: /\broof/i,                         days: 365, suggest: "gutter inspection + moss check",                   window_days: 60 },
  { match: /\b(loft|extension|garage)\b/i,   days: 730, suggest: "second-fix snag review",                            window_days: 90 },
  { match: /\b(window|glaz)/i,               days: 365, suggest: "annual seal + hinge inspection",                    window_days: 60 },
  { match: /\bboiler|heat/i,                 days: 335, suggest: "annual boiler service (gas-safety cert)",           window_days: 45 },
  { match: /\b(driveway|paving|patio)\b/i,   days: 730, suggest: "re-sand joints + drainage check",                   window_days: 90 },
  { match: /\bpaint|decorat/i,               days: 1460, suggest: "refresh coat (4-year cycle)",                       window_days: 120 },
  { match: /\bsolar|pv\b/i,                   days: 365, suggest: "annual solar-panel clean + inverter check",         window_days: 45 }
];

export function detectOpportunities(summary: ContactSummary, now = new Date()): Opportunity[] {
  const out: Opportunity[] = [];
  const ev = evidenceFor("opportunity rules over signed-off jobs", ["app_job_diary_jobs"]);

  // 1. Job-signed-off cadence opportunities.
  const signedOffs = summary.timeline.filter((t) => t.kind === "job_signed_off");
  for (const j of signedOffs) {
    const rule = CADENCE.find((r) => r.match.test(j.headline));
    if (!rule) continue;
    const ageDays = Math.floor((now.getTime() - new Date(j.occurredAt).getTime()) / DAY_MS);
    if (ageDays >= rule.days - rule.window_days && ageDays <= rule.days + rule.window_days) {
      const monthsAgo = Math.floor(ageDays / 30);
      out.push({
        key:      `cadence_${j.sourceId ?? j.occurredAt}`,
        headline: `${headlineTrade(j.headline)} completed ${monthsAgo} month${monthsAgo === 1 ? "" : "s"} ago — recommend ${rule.suggest}.`,
        reason:   `Signed off on ${j.occurredAt.slice(0, 10)}. Cadence rule: ~${rule.days} days for this type of work.`,
        evidence: ev
      });
    }
  }

  // 2. Referral / thank-you opportunity — customer who reviewed +
  //    hasn't heard from us in a while.
  const reviews = summary.timeline.filter((t) => t.kind === "review_posted");
  if (reviews.length > 0 && summary.contact.lastTouchAt) {
    const daysSinceTouch = Math.floor((now.getTime() - new Date(summary.contact.lastTouchAt).getTime()) / DAY_MS);
    if (daysSinceTouch >= 60) {
      out.push({
        key:      "referral_thankyou",
        headline: `Left a review ${reviews.length === 1 ? "" : `(${reviews.length} in total)`} and hasn't heard from you in ${daysSinceTouch} days — good referral moment.`,
        reason:   `Reviewers who get a follow-up refer at higher rates. Last touch ${summary.contact.lastTouchAt.slice(0, 10)}.`,
        evidence: evidenceFor("app_crm_contacts.last_touch_at + reviews", ["app_crm_contacts", "app_reviews_reviews"])
      });
    }
  }

  // 3. Quiet-and-quoted — quote sent, never accepted, been a while.
  const sent   = summary.timeline.filter((t) => t.kind === "quote_sent");
  const accepted = new Set(summary.timeline.filter((t) => t.kind === "quote_accepted").map((t) => t.sourceId));
  const rejected = new Set(summary.timeline.filter((t) => t.kind === "quote_rejected").map((t) => t.sourceId));
  for (const q of sent) {
    if (accepted.has(q.sourceId) || rejected.has(q.sourceId)) continue;
    const days = Math.floor((now.getTime() - new Date(q.occurredAt).getTime()) / DAY_MS);
    if (days >= 7 && days <= 90) {
      out.push({
        key:      `quote_reheat_${q.sourceId ?? q.occurredAt}`,
        headline: `Quote sent ${days} days ago and hasn't landed — worth a courteous chase.`,
        reason:   `Sent ${q.occurredAt.slice(0, 10)}. No accept/reject event on record.`,
        action:   q.sourceId ? { label: "Open quote", href: `/site-office/apps/quotes/${q.sourceId}` } : undefined,
        evidence: evidenceFor("app_quote_workspace_quotes", ["app_quote_workspace_quotes"])
      });
      break;   // only surface the freshest one
    }
  }

  return out;
}

function headlineTrade(h: string): string {
  // "Kitchen refit — signed off" → "Kitchen"
  return h.split(/[—:·-]/)[0].trim();
}
