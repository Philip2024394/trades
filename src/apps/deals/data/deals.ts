// Trade Deals — merchant-posted time-boxed discounts + bundles.
//
// Constitution: Trade Center never boosts deals by merchant margin.
// Deals are surfaced by (ending-soonest, then percent-saved, then most-
// recently-posted). Every deal ties back to a real product or bundle
// the merchant owns — no phantom "50% off" hooks.

export type DealKind = "percent-off" | "bundle" | "bulk-tier" | "free-add-on" | "clearance";

export type Deal = {
  id: string;
  slug: string;
  merchantSlug: string;
  productSlug?: string;            // primary product this deal is tied to
  kind: DealKind;
  headline: string;
  detail: string;
  percentSaved?: number;
  wasPriceGbp?: number;
  nowPriceGbp?: number;
  minQty?: number;
  addOnLabel?: string;
  startsAtIso: string;
  endsAtIso: string;
  categoryTag: string;              // "plastering" / "materials" / "tools" / etc.
  imageUrl?: string;
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

export const DEAL_FIXTURES: Deal[] = [
  {
    id: "d1",
    slug: "marshalltown-twinpack-summer",
    merchantSlug: "manchester-tools-direct",
    productSlug: "marshalltown-finishing-trowel-14",
    kind: "bundle",
    headline: "Marshalltown Twin-Pack — save £8",
    detail: "Two 14\" finishing trowels for £52 instead of £60. Same-day dispatch before 2pm.",
    percentSaved: 13,
    wasPriceGbp: 60,
    nowPriceGbp: 52,
    startsAtIso: iso(3),
    endsAtIso: isoAhead(4),
    categoryTag: "plastering",
    imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2011,%202026,%2004_11_36%20AM.png"
  },
  {
    id: "d2",
    slug: "leeds-multifinish-bulk",
    merchantSlug: "leeds-builders-supplies",
    kind: "bulk-tier",
    headline: "50 bags British Gypsum Multi-Finish — £520 delivered",
    detail: "Bulk pallet within 40mi of LS10. Next-day delivery. Normally £12/bag — this pallet works out at £10.40.",
    percentSaved: 13,
    wasPriceGbp: 600,
    nowPriceGbp: 520,
    minQty: 50,
    startsAtIso: iso(1),
    endsAtIso: isoAhead(6),
    categoryTag: "materials"
  },
  {
    id: "d3",
    slug: "glasgow-scaffold-week",
    merchantSlug: "glasgow-scaffolding-co",
    kind: "percent-off",
    headline: "20% off week-rate scaffold hire — August only",
    detail: "Book any week-long scaffold hire between 1 Aug and 31 Aug. Auto-applied at checkout.",
    percentSaved: 20,
    startsAtIso: iso(0),
    endsAtIso: isoAhead(21),
    categoryTag: "scaffolding"
  },
  {
    id: "d4",
    slug: "mtd-hawk-free-tape",
    merchantSlug: "manchester-tools-direct",
    productSlug: "ox-plastering-hawk-13",
    kind: "free-add-on",
    headline: "Free 50m scrim tape with any OX Hawk",
    detail: "Every 13\" or 14\" OX hawk ships with a 50m scrim tape roll worth £7. This week only.",
    addOnLabel: "50m scrim tape",
    startsAtIso: iso(2),
    endsAtIso: isoAhead(3),
    categoryTag: "plastering"
  },
  {
    id: "d5",
    slug: "brighton-clearance",
    merchantSlug: "brighton-tile-warehouse",
    kind: "clearance",
    headline: "Clearance: PVC corner beads — £2 each",
    detail: "End-of-line stock. Was £3.50, now £2 each while they last. First come first served.",
    percentSaved: 43,
    wasPriceGbp: 3.5,
    nowPriceGbp: 2,
    startsAtIso: iso(5),
    endsAtIso: isoAhead(1),
    categoryTag: "materials"
  },
  {
    id: "d6",
    slug: "leeds-consumer-units",
    merchantSlug: "leeds-builders-supplies",
    kind: "bulk-tier",
    headline: "10-pack Wylex consumer units — £680",
    detail: "Bulk pack for electrical trades. Save £120 vs single-unit pricing. Any LS postcode direct pickup.",
    percentSaved: 15,
    wasPriceGbp: 800,
    nowPriceGbp: 680,
    minQty: 10,
    startsAtIso: iso(1),
    endsAtIso: isoAhead(10),
    categoryTag: "electrical"
  }
];

export function allDeals(): Deal[] {
  // Rank: ending soonest first, then by percent saved
  const now = Date.now();
  return DEAL_FIXTURES
    .filter((d) => new Date(d.endsAtIso).getTime() > now)
    .sort((a, b) => {
      const endA = new Date(a.endsAtIso).getTime();
      const endB = new Date(b.endsAtIso).getTime();
      if (endA !== endB) return endA - endB;
      return (b.percentSaved ?? 0) - (a.percentSaved ?? 0);
    });
}

export function findDeal(slug: string): Deal | undefined {
  return DEAL_FIXTURES.find((d) => d.slug === slug);
}
