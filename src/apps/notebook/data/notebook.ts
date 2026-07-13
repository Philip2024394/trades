// Trade Notebook — a trade's personal shopping list of products they
// buy regularly. Each item is auto-resolved to the NEAREST merchant
// carrying it (never the cheapest — see TRADE_CENTER_FEATURE_MASTERPLAN.md
// Constitution Rule #5 "Difficult To Copy" combined with the merchant-
// side rule "no price competition on Trade Center").
//
// The mental model: your yard, your van, your notebook. Same trowel
// every job — Trade Center just finds the closest merchant with it in
// stock so you don't waste half a morning driving.
//
// Sections (per Amazon Business Lists / Screwfix My Orders / Toolstation
// Save patterns — see /tc/notebook page for the left sub-nav):
//   1. My Regulars — items you buy every job (this file's core fixture)
//   2. Past Orders — order history reorder queue (from Orders app)
//   3. Offers — targeted merchant deals on your notebook items
//   4. Quotes received — bulk quotes on your notebook items
//   5. Substitutes — alternatives when your usual is unavailable
//   6. Job templates — saved baskets per job type
//   7. Trending nearby — anonymised what-others-buy in your area

export type NotebookItemStatus = "on-hand" | "running-low" | "out";

export type NotebookItem = {
  id: string;
  productName: string;                    // free-text; matches against product fixtures by name
  spec: string;                           // "16" x 4" · Stainless"
  usualQty: number;                       // how many the trade usually orders
  unit: string;                           // "each", "bag", "sheet", "box"
  categorySlug: string;                   // rail-category slug for filtering
  status?: NotebookItemStatus;            // trade's self-report
  lastOrderedIso?: string;
  notes?: string;                         // trade's own note ("only Nela")
  // Populated on submit of a Quote Me request — powers the
  // "Last quoted £X · Merchant · N days ago" chip on the card.
  lastQuotedAt?: string;
  lastQuotedPriceGbp?: number;
  lastQuotedMerchantSlug?: string;
  lastQuotedMerchantName?: string;
};

export type TradeNotebook = {
  ownerTradeSlug: string;
  items: NotebookItem[];
};

/** Bob Watson's notebook — realistic plasterer supply list. */
export const DEMO_NOTEBOOK: TradeNotebook = {
  ownerTradeSlug: "bob-plastering",
  items: [
    {
      id: "n1",
      productName: "Nela Plastering Trowel",
      spec: "16\" x 4\" · Stainless · Flexi",
      usualQty: 1,
      unit: "each",
      categorySlug: "plastering",
      status: "on-hand",
      lastOrderedIso: "2025-11-14T00:00:00Z",
      notes: "Only Nela — nothing else feels right"
    },
    {
      id: "n2",
      productName: "British Gypsum Multi-Finish",
      spec: "25kg bag",
      usualQty: 40,
      unit: "bags",
      categorySlug: "plastering",
      status: "running-low",
      lastOrderedIso: "2026-06-20T00:00:00Z"
    },
    {
      id: "n3",
      productName: "Refina Skimming Blade",
      spec: "24\" flexi · aluminium",
      usualQty: 1,
      unit: "each",
      categorySlug: "plastering",
      status: "on-hand",
      lastOrderedIso: "2025-09-12T00:00:00Z"
    },
    {
      id: "n4",
      productName: "Fibaband Scrim Tape",
      spec: "48mm x 90m self-adhesive",
      usualQty: 12,
      unit: "rolls",
      categorySlug: "plastering",
      status: "out",
      notes: "Ran out on Watson job"
    },
    {
      id: "n5",
      productName: "OX Plastering Hawk",
      spec: "13\" aluminium · foam grip",
      usualQty: 1,
      unit: "each",
      categorySlug: "plastering",
      status: "on-hand"
    },
    {
      id: "n6",
      productName: "Clever Extra Strong Bucket",
      spec: "26L heavy-duty plasterer's tub",
      usualQty: 2,
      unit: "each",
      categorySlug: "plastering",
      status: "on-hand"
    },
    {
      id: "n7",
      productName: "Aluminium Feather Edge",
      spec: "6ft straight edge",
      usualQty: 1,
      unit: "each",
      categorySlug: "plastering",
      status: "on-hand"
    }
  ]
};

// ─── Left sub-nav section fixtures ─────────────────────────────────

export type NotebookOffer = {
  id: string;
  merchantSlug: string;
  itemName: string;
  headline: string;
  savingLabel: string;
  endsInHours: number;
};

export type NotebookBulkQuote = {
  id: string;
  merchantSlug: string;
  items: string[];
  totalGbp: number;
  savingPct: number;
  receivedIso: string;
};

export type JobTemplate = {
  id: string;
  label: string;
  itemCount: number;
  totalEstimatedGbp: number;
  lastUsedIso: string;
};

const isoDaysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
};

export const NOTEBOOK_OFFERS_FIXTURES: NotebookOffer[] = [
  {
    id: "no1",
    merchantSlug: "manchester-tools-direct",
    itemName: "Nela Plastering Trowel",
    headline: "Twin-pack Nela — save £8",
    savingLabel: "−13%",
    endsInHours: 74
  },
  {
    id: "no2",
    merchantSlug: "leeds-builders-supplies",
    itemName: "British Gypsum Multi-Finish",
    headline: "50-bag pallet delivered £520",
    savingLabel: "−13%",
    endsInHours: 168
  },
  {
    id: "no3",
    merchantSlug: "manchester-tools-direct",
    itemName: "OX Plastering Hawk",
    headline: "Free 50m scrim with any OX Hawk",
    savingLabel: "Free add-on",
    endsInHours: 96
  }
];

export const NOTEBOOK_BULK_QUOTES_FIXTURES: NotebookBulkQuote[] = [
  {
    id: "nq1",
    merchantSlug: "manchester-tools-direct",
    items: ["Nela Trowel × 1", "OX Hawk × 1", "Skimming Blade × 1", "Bucket × 1"],
    totalGbp: 132,
    savingPct: 12,
    receivedIso: isoDaysAgo(1)
  },
  {
    id: "nq2",
    merchantSlug: "leeds-builders-supplies",
    items: ["Multi-Finish × 50", "Bonding Coat × 20", "Scrim × 12"],
    totalGbp: 892,
    savingPct: 8,
    receivedIso: isoDaysAgo(3)
  }
];

export const JOB_TEMPLATE_FIXTURES: JobTemplate[] = [
  { id: "jt1", label: "Skim job (small room, 15-20m²)",     itemCount: 8,  totalEstimatedGbp: 220, lastUsedIso: isoDaysAgo(4) },
  { id: "jt2", label: "Ceiling repair (up to 12m²)",         itemCount: 6,  totalEstimatedGbp: 165, lastUsedIso: isoDaysAgo(11) },
  { id: "jt3", label: "Full house re-skim",                  itemCount: 14, totalEstimatedGbp: 780, lastUsedIso: isoDaysAgo(28) },
  { id: "jt4", label: "External render — small elevation",   itemCount: 12, totalEstimatedGbp: 640, lastUsedIso: isoDaysAgo(56) }
];
