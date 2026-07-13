// Job Board (R23) — customer-posted job requests + trade quotes.
//
// Customer posts a job (skim a kitchen, rewire a house, fit a bathroom).
// Verified trades in the discipline + region see it, submit a quote
// (amount + duration + short note). Customer picks a trade → messaging
// thread opens → standard Trade Center Guaranteed flow from there.
//
// Constitution:
//  - Trade Center never inserts our own trades or reshuffles the quote list
//  - Customer sees quotes in the order they were submitted, no sponsored slots
//  - Verified layers of each quoting trade are shown in the quote card

export type JobDiscipline =
  | "plastering"
  | "electrical"
  | "plumbing"
  | "carpentry"
  | "roofing"
  | "tiling"
  | "flooring"
  | "kitchen-fit"
  | "bathroom-fit"
  | "general";

export const DISCIPLINE_LABELS: Record<JobDiscipline, string> = {
  plastering:     "Plastering",
  electrical:     "Electrical",
  plumbing:       "Plumbing",
  carpentry:      "Carpentry",
  roofing:        "Roofing",
  tiling:         "Tiling",
  flooring:       "Flooring",
  "kitchen-fit":  "Kitchen fit",
  "bathroom-fit": "Bathroom fit",
  general:        "General building"
};

export type JobUrgency = "flexible" | "within-month" | "within-week" | "urgent";

export type JobPostingStatus = "open" | "quoting" | "assigned" | "completed" | "cancelled";

export type JobQuote = {
  id: string;
  tradeSlug: string;
  submittedAtIso: string;
  amountGbp: number;
  estimatedDurationDays: number;
  note: string;
};

export type JobPosting = {
  id: string;
  slug: string;
  customerName: string;
  customerLocation: string;   // "Withington, M20"
  discipline: JobDiscipline;
  title: string;
  description: string;
  budgetRangeGbp?: [number, number];   // optional — customer can say "any"
  urgency: JobUrgency;
  desiredStartIso?: string;
  photoUrls: string[];
  status: JobPostingStatus;
  postedAtIso: string;
  quotes: JobQuote[];
};

const iso = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
};
const isoAhead = (daysAhead: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString();
};

export const JOB_POSTING_FIXTURES: JobPosting[] = [
  {
    id: "jp-oakwood-skim",
    slug: "oakwood-lounge-skim-m20",
    customerName: "Emma Hayes",
    customerLocation: "Didsbury, M20",
    discipline: "plastering",
    title: "Lounge + hallway re-skim, 3-bed semi",
    description:
      "Blown plaster on the party wall in the lounge — probably from a leak upstairs (now fixed). Would like the whole lounge + hallway re-skimmed. Ceilings are fine, no ceiling work needed.",
    budgetRangeGbp: [1400, 2200],
    urgency: "within-month",
    desiredStartIso: isoAhead(21),
    photoUrls: [],
    status: "quoting",
    postedAtIso: iso(2),
    quotes: [
      {
        id: "q1",
        tradeSlug: "bob-plastering",
        submittedAtIso: iso(1),
        amountGbp: 1750,
        estimatedDurationDays: 3,
        note: "Priced on 55 m² wall + 12 m linear reveals. Includes prep, PVA, 2-coat skim, dust sheets, snag-day. Materials extra at cost."
      }
    ]
  },
  {
    id: "jp-parkside-rewire",
    slug: "parkside-3bed-rewire-ls11",
    customerName: "James O'Reilly",
    customerLocation: "Beeston, LS11",
    discipline: "electrical",
    title: "3-bed semi partial rewire + EV charger",
    description:
      "Downstairs ring is old rubber-sheathed cable, needs replacing. Also want a 7kW EV charger fitted at the front. Consumer unit was upgraded last year so no CU work needed.",
    budgetRangeGbp: [2500, 3500],
    urgency: "within-month",
    desiredStartIso: isoAhead(14),
    photoUrls: [],
    status: "quoting",
    postedAtIso: iso(4),
    quotes: [
      {
        id: "q2",
        tradeSlug: "riverside-electrics",
        submittedAtIso: iso(3),
        amountGbp: 2950,
        estimatedDurationDays: 5,
        note: "Rewire priced on typical downstairs circuit runs. 7kW charger install includes DNO notification + type-A RCD. Certificate on completion."
      }
    ]
  },
  {
    id: "jp-shieldpay-ext-render",
    slug: "external-render-victorian-terrace-m21",
    customerName: "Rachel Nightingale",
    customerLocation: "Chorlton, M21",
    discipline: "plastering",
    title: "External render — rear elevation Victorian terrace",
    description:
      "Rear wall on a 2-up 2-down. Existing render is blown in patches. Want it hacked off + re-rendered with a smooth silicone finish. Scaffold access from the back yard.",
    budgetRangeGbp: [3200, 4800],
    urgency: "flexible",
    photoUrls: [],
    status: "open",
    postedAtIso: iso(1),
    quotes: []
  },
  {
    id: "jp-newman-bathroom",
    slug: "small-bathroom-refit-m33",
    customerName: "David Newman",
    customerLocation: "Sale, M33",
    discipline: "bathroom-fit",
    title: "Small bathroom refit — new suite + tiling",
    description:
      "1.7 × 2.1m bathroom. Want to replace the whole suite (bath, toilet, basin, shower over bath) and re-tile floor + splash area. Tiles chosen. No structural work.",
    budgetRangeGbp: [3000, 5000],
    urgency: "within-month",
    desiredStartIso: isoAhead(28),
    photoUrls: [],
    status: "open",
    postedAtIso: iso(0),
    quotes: []
  }
];

export function findJobPosting(slug: string): JobPosting | undefined {
  return JOB_POSTING_FIXTURES.find((p) => p.slug === slug);
}

export function jobPostingsByDiscipline(d: JobDiscipline | "all"): JobPosting[] {
  if (d === "all") return JOB_POSTING_FIXTURES;
  return JOB_POSTING_FIXTURES.filter((p) => p.discipline === d);
}

export function openJobPostings(): JobPosting[] {
  return JOB_POSTING_FIXTURES.filter((p) => p.status === "open" || p.status === "quoting");
}
