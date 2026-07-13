// Job Cost Mode (R01) — data model + fixtures.
//
// The tradesperson's per-job P&L. Track materials + labour + overhead
// against the quote and see live margin. Zero publishing, zero
// benchmarking, zero regulated activity — this is a private tool for
// the trade to answer one question every week: "did this job make me
// money?"
//
// Constitution Rule #6: nothing here is shared with anyone. The trade
// owns their data. Trade Center never publishes, never advises.

export type JobStatus = "quoted" | "in-progress" | "complete" | "archived";
export type CostCategory =
  | "materials"
  | "labour"
  | "subcontractor"
  | "transport"
  | "waste"
  | "hire"
  | "overhead"
  | "other";

export type JobCostLine = {
  id: string;
  jobId: string;
  category: CostCategory;
  description: string;
  supplier?: string;           // "Manchester Tools Direct"
  merchantSlug?: string;       // links to marketplace merchant if bought via TC
  quantity?: number;
  unit?: string;               // "bags", "hrs", "sheets"
  unitCostGbp?: number;
  totalGbp: number;
  incurredAtIso: string;
  notes?: string;
};

export type JobPaymentStage = {
  id: string;
  jobId: string;
  label: string;               // "Deposit", "First Fix", "Second Fix", "Completion"
  scheduledPct: number;
  scheduledGbp: number;
  status: "outstanding" | "invoiced" | "received" | "overdue";
  invoicedIso?: string;
  receivedIso?: string;
};

export type Job = {
  id: string;
  slug: string;
  ownerTradeSlug: string;
  title: string;               // "Watson full re-skim + ceiling"
  customerName: string;        // trade's own record; not published
  addressShort: string;        // "Withington, M20"
  quoteGbp: number;            // total quote to customer
  materialsBudgetGbp: number;  // trade's own materials budget guess
  labourBudgetHours: number;   // trade's own labour budget guess
  labourRateGbp: number;       // trade's own hourly rate for this job
  status: JobStatus;
  startedAtIso: string;
  targetCompletionIso?: string;
  actualCompletionIso?: string;
  tags: readonly string[];     // "skim", "ceiling", "domestic"
  overheadAllocationGbp?: number; // spread of monthly overhead onto this job
};

const iso = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
};

export const JOB_FIXTURES: Job[] = [
  {
    id: "j-watson-2026-11",
    slug: "watson-full-reskim",
    ownerTradeSlug: "bob-plastering",
    title: "Watson full re-skim + hallway ceiling",
    customerName: "David Watson",
    addressShort: "Withington, M20",
    quoteGbp: 3800,
    materialsBudgetGbp: 900,
    labourBudgetHours: 60,
    labourRateGbp: 42,
    status: "in-progress",
    startedAtIso: iso(6),
    targetCompletionIso: iso(-3),
    tags: ["skim", "ceiling", "domestic"],
    overheadAllocationGbp: 180
  },
  {
    id: "j-parkside-shop",
    slug: "parkside-shop-fit",
    ownerTradeSlug: "bob-plastering",
    title: "Parkside Cafe shop-fit skim",
    customerName: "Parkside Cafe Ltd",
    addressShort: "Chorlton, M21",
    quoteGbp: 5400,
    materialsBudgetGbp: 1400,
    labourBudgetHours: 80,
    labourRateGbp: 45,
    status: "complete",
    startedAtIso: iso(28),
    actualCompletionIso: iso(9),
    tags: ["skim", "commercial", "shop-fit"],
    overheadAllocationGbp: 220
  },
  {
    id: "j-oaklodge-nursery",
    slug: "oaklodge-nursery",
    ownerTradeSlug: "bob-plastering",
    title: "Oak Lodge Nursery — 3 rooms + hall",
    customerName: "Oak Lodge Nursery",
    addressShort: "Didsbury, M20",
    quoteGbp: 2650,
    materialsBudgetGbp: 620,
    labourBudgetHours: 42,
    labourRateGbp: 42,
    status: "quoted",
    startedAtIso: iso(-2), // starts in 2 days
    tags: ["skim", "commercial"],
    overheadAllocationGbp: 120
  },
  {
    id: "j-birchfield-ceiling",
    slug: "birchfield-ceiling",
    ownerTradeSlug: "bob-plastering",
    title: "Birchfield ceiling repair",
    customerName: "Sarah Birchfield",
    addressShort: "Sale, M33",
    quoteGbp: 480,
    materialsBudgetGbp: 90,
    labourBudgetHours: 8,
    labourRateGbp: 42,
    status: "complete",
    startedAtIso: iso(21),
    actualCompletionIso: iso(20),
    tags: ["ceiling", "repair", "domestic"],
    overheadAllocationGbp: 40
  }
];

export const COST_LINE_FIXTURES: JobCostLine[] = [
  // ─── Watson (in-progress) — currently 78% of materials budget spent
  { id: "c1", jobId: "j-watson-2026-11", category: "materials", description: "British Gypsum Multi-Finish 25kg", supplier: "Manchester Tools Direct", merchantSlug: "manchester-tools-direct", quantity: 40, unit: "bags", unitCostGbp: 12, totalGbp: 480, incurredAtIso: iso(6) },
  { id: "c2", jobId: "j-watson-2026-11", category: "materials", description: "Bonding Coat 25kg", supplier: "Manchester Tools Direct", merchantSlug: "manchester-tools-direct", quantity: 12, unit: "bags", unitCostGbp: 9, totalGbp: 108, incurredAtIso: iso(6) },
  { id: "c3", jobId: "j-watson-2026-11", category: "materials", description: "Scrim tape + PVA + beads", supplier: "Manchester Tools Direct", merchantSlug: "manchester-tools-direct", totalGbp: 118, incurredAtIso: iso(6) },
  { id: "c4", jobId: "j-watson-2026-11", category: "labour",    description: "Bob — days 1-4 skim + ceiling", quantity: 34, unit: "hrs", unitCostGbp: 42, totalGbp: 34 * 42, incurredAtIso: iso(2) },
  { id: "c5", jobId: "j-watson-2026-11", category: "waste",     description: "Skip hire + collection", totalGbp: 190, incurredAtIso: iso(5) },
  { id: "c6", jobId: "j-watson-2026-11", category: "transport", description: "Diesel + parking (6 days)", totalGbp: 62, incurredAtIso: iso(2) },

  // ─── Parkside (complete) — clean profitable job
  { id: "c7", jobId: "j-parkside-shop", category: "materials", description: "Multi-finish + bonding + scrim + PVA", supplier: "Manchester Tools Direct", merchantSlug: "manchester-tools-direct", totalGbp: 1280, incurredAtIso: iso(26) },
  { id: "c8", jobId: "j-parkside-shop", category: "labour",    description: "Bob — full job", quantity: 82, unit: "hrs", unitCostGbp: 45, totalGbp: 82 * 45, incurredAtIso: iso(9) },
  { id: "c9", jobId: "j-parkside-shop", category: "subcontractor", description: "Ceiling scaffold day rate", totalGbp: 240, incurredAtIso: iso(24) },
  { id: "c10", jobId: "j-parkside-shop", category: "waste",    description: "Waste removal", totalGbp: 130, incurredAtIso: iso(9) },
  { id: "c11", jobId: "j-parkside-shop", category: "transport", description: "Fuel + parking", totalGbp: 95, incurredAtIso: iso(10) },

  // ─── Birchfield (complete) — tiny job, healthy margin
  { id: "c12", jobId: "j-birchfield-ceiling", category: "materials", description: "Multi-finish + PVA", supplier: "Manchester Tools Direct", merchantSlug: "manchester-tools-direct", totalGbp: 78, incurredAtIso: iso(21) },
  { id: "c13", jobId: "j-birchfield-ceiling", category: "labour",    description: "Bob — one-day repair", quantity: 8, unit: "hrs", unitCostGbp: 42, totalGbp: 336, incurredAtIso: iso(20) }
];

export const PAYMENT_STAGE_FIXTURES: JobPaymentStage[] = [
  // ─── Watson: 25/25/25/25, deposit collected, first-fix invoiced
  { id: "p1", jobId: "j-watson-2026-11", label: "Deposit",     scheduledPct: 25, scheduledGbp: 950,  status: "received",    invoicedIso: iso(7),  receivedIso: iso(6) },
  { id: "p2", jobId: "j-watson-2026-11", label: "First Fix",   scheduledPct: 25, scheduledGbp: 950,  status: "invoiced",    invoicedIso: iso(2) },
  { id: "p3", jobId: "j-watson-2026-11", label: "Second Fix",  scheduledPct: 25, scheduledGbp: 950,  status: "outstanding" },
  { id: "p4", jobId: "j-watson-2026-11", label: "Completion",  scheduledPct: 25, scheduledGbp: 950,  status: "outstanding" },

  // ─── Parkside: all paid
  { id: "p5", jobId: "j-parkside-shop", label: "Deposit",     scheduledPct: 40, scheduledGbp: 2160, status: "received", invoicedIso: iso(29), receivedIso: iso(27) },
  { id: "p6", jobId: "j-parkside-shop", label: "Interim",     scheduledPct: 30, scheduledGbp: 1620, status: "received", invoicedIso: iso(18), receivedIso: iso(15) },
  { id: "p7", jobId: "j-parkside-shop", label: "Completion",  scheduledPct: 30, scheduledGbp: 1620, status: "received", invoicedIso: iso(9),  receivedIso: iso(4) },

  // ─── Birchfield: paid in full on completion
  { id: "p8", jobId: "j-birchfield-ceiling", label: "On completion", scheduledPct: 100, scheduledGbp: 480, status: "received", invoicedIso: iso(20), receivedIso: iso(18) }
];

export function findJob(slug: string): Job | undefined {
  return JOB_FIXTURES.find((j) => j.slug === slug);
}

export function costLinesForJob(jobId: string): JobCostLine[] {
  return COST_LINE_FIXTURES.filter((c) => c.jobId === jobId);
}

export function paymentStagesForJob(jobId: string): JobPaymentStage[] {
  return PAYMENT_STAGE_FIXTURES.filter((p) => p.jobId === jobId);
}
