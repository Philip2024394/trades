// Relationship health aggregator.
//
// Scores five signals, weights + averages the ones that have data.
// Missing signals return null and are excluded (a customer with no
// reviews yet isn't punished for it — the score just leans on what
// IS on record).

import type { ContactSummary } from "@/lib/crm/loadContactTimeline";
import type { PaymentOwed, RelationshipHealth } from "./types";

const BANDS: Array<{ min: number; band: RelationshipHealth["band"] }> = [
  { min: 90, band: "excellent" },
  { min: 75, band: "healthy" },
  { min: 60, band: "steady" },
  { min: 40, band: "attention" },
  { min:  0, band: "critical" }
];

const WORDS: Record<RelationshipHealth["band"], string> = {
  excellent: "Excellent",
  healthy:   "Healthy",
  steady:    "Steady",
  attention: "Needs attention",
  critical:  "Critical"
};

const DAY_MS = 86_400_000;

export type HealthInput = {
  summary:       ContactSummary;
  payments_owed: PaymentOwed[];
  reviewStars?:  number | null;   // 1..5, if a review exists
  now?:          Date;
};

export function computeRelationshipHealth(input: HealthInput): RelationshipHealth {
  const now = input.now ?? new Date();
  const s = input.summary;

  // Payments — fewer outstanding, more paid history = higher score.
  const outstanding = input.payments_owed.reduce((sum, p) => sum + p.outstanding_pence, 0);
  const overdue     = input.payments_owed.filter((p) => p.is_overdue).length;
  const payments = input.payments_owed.length === 0 && s.totals.jobsSignedOff === 0
    ? { score: null,  note: "No payment history yet." }
    : outstanding === 0
      ? { score: 95,   note: "Nothing outstanding." }
      : overdue > 0
        ? { score: 30, note: `£${(outstanding / 100).toLocaleString("en-GB")} outstanding, ${overdue} overdue.` }
        : { score: 65, note: `£${(outstanding / 100).toLocaleString("en-GB")} outstanding, all within due date.` };

  // Communication — how quiet? Uses quiet_since or last_touch_at.
  const anchor = s.contact.quietSince ?? s.contact.lastTouchAt ?? s.contact.lastActivityAt;
  const daysQuiet = anchor ? Math.floor((now.getTime() - new Date(anchor).getTime()) / DAY_MS) : null;
  const communication = daysQuiet === null
    ? { score: null, note: "No communication history yet." }
    : daysQuiet <= 14  ? { score: 95, note: `In touch within the last ${daysQuiet} day${daysQuiet === 1 ? "" : "s"}.` }
    : daysQuiet <= 45  ? { score: 70, note: `Last touch ${daysQuiet} days ago.` }
    : daysQuiet <= 120 ? { score: 45, note: `Quiet for ${daysQuiet} days.` }
                       : { score: 25, note: `Quiet for ${daysQuiet} days — worth a check-in.` };

  // Reviews.
  const reviews = s.totals.reviewsPosted === 0
    ? { score: null, note: "No reviews on file." }
    : input.reviewStars === null || input.reviewStars === undefined
      ? { score: 70, note: `${s.totals.reviewsPosted} review${s.totals.reviewsPosted === 1 ? "" : "s"} on file.` }
      : { score: Math.round(Math.max(0, Math.min(1, (input.reviewStars - 1) / 4)) * 100),
          note: `Average review ${input.reviewStars.toFixed(1)}★.` };

  // Repeat business — jobs signed off > 1 counts as repeat.
  const repeat = s.totals.jobsSignedOff <= 0
    ? { score: null, note: "No completed jobs yet." }
    : s.totals.jobsSignedOff === 1
      ? { score: 55,  note: "One job completed — first-timer." }
      : { score: Math.min(100, 70 + (s.totals.jobsSignedOff - 1) * 8), note: `${s.totals.jobsSignedOff} jobs completed together.` };

  // Responsiveness — quotes-viewed / quotes-sent (if any quotes exist).
  const viewed = s.timeline.filter((t) => t.kind === "quote_viewed").length;
  const sent   = s.timeline.filter((t) => t.kind === "quote_sent").length;
  const responsiveness = sent === 0
    ? { score: null, note: "No quotes sent yet." }
    : viewed >= sent
      ? { score: 95,  note: "Opens every quote." }
      : { score: Math.round((viewed / sent) * 100), note: `Viewed ${viewed} of ${sent} quotes.` };

  const weights = { payments: 2.5, communication: 1.5, reviews: 1.0, repeat: 1.5, responsiveness: 1.0 };
  const parts = [payments, communication, reviews, repeat, responsiveness];
  const keys: Array<keyof typeof weights> = ["payments", "communication", "reviews", "repeat", "responsiveness"];
  let weightSum = 0, valueSum = 0;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.score === null) continue;
    const w = weights[keys[i]];
    weightSum += w;
    valueSum  += p.score * w;
  }
  const score = weightSum === 0 ? 0 : Math.max(0, Math.min(100, Math.round(valueSum / weightSum)));
  const band  = bandFor(score);

  return {
    score,
    band,
    headline: weightSum === 0
      ? "Relationship Health: no data yet."
      : `Relationship Health: ${score}%. ${WORDS[band]}.`,
    signals: { payments, communication, reviews, repeat, responsiveness }
  };
}

export function bandFor(score: number): RelationshipHealth["band"] {
  for (const b of BANDS) if (score >= b.min) return b.band;
  return "critical";
}
