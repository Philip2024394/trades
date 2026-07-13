// Trade Counter (R-TradeCounter) — trade-to-trade classifieds.
//
// Distinct from the merchant marketplace:
//   - Marketplace = merchants publish unlimited catalogue for sale
//   - Trade Counter = individual trades post ONE-OFF items: surplus
//     materials, used tools, spare pallets, freebies, swaps.
//
// Analogue: Facebook Marketplace, but trade-only + verified-identity-only.
//
// Constitution: Trade Center is the pipe. We host the listing, take zero
// commission on the sale, don't hold any funds. Trades transact
// peer-to-peer via Messages + optional Trade Center Guaranteed for
// higher-value items.

export type TradeCounterListingKind = "for-sale" | "offer" | "free";

export type TradeCounterCondition = "new-unused" | "as-new" | "used-good" | "used-fair";

export type TradeCounterListing = {
  id: string;
  slug: string;
  authorSlug: string;               // trade slug — verified identity
  kind: TradeCounterListingKind;
  title: string;
  description: string;
  askingGbp?: number;               // undefined when "free"
  swapForLabel?: string;            // e.g. "Swap for a 110V transformer" (offer kind)
  condition: TradeCounterCondition;
  quantityAvailable: number;
  photoUrls: string[];
  locationCity: string;
  categoryTag: string;              // "plastering" · "electrical" · "materials"
  postedAtIso: string;
  collectionOnly: boolean;
  deliveryPossible: boolean;
};

const iso = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
};

export const TRADE_COUNTER_FIXTURES: TradeCounterListing[] = [
  {
    id: "tcl-1",
    slug: "surplus-plasterboard-m20",
    authorSlug: "bob-plastering",
    kind: "for-sale",
    title: "18 sheets British Gypsum plasterboard 12.5mm — surplus from job",
    description:
      "Ordered too many for the Watson job. All sealed, still on original pallet. Selling below trade price. Collection from Withington (M20), can help load your van.",
    askingGbp: 220,
    condition: "new-unused",
    quantityAvailable: 18,
    photoUrls: [],
    locationCity: "Manchester",
    categoryTag: "materials",
    postedAtIso: iso(1),
    collectionOnly: true,
    deliveryPossible: false
  },
  {
    id: "tcl-2",
    slug: "old-marshalltown-trowel",
    authorSlug: "riverside-electrics",
    kind: "for-sale",
    title: "Marshalltown 14\" finishing trowel — used but sharp",
    description:
      "Belonged to a plasterer mate, he upgraded. Blade's still true. £20 if you can pick up from Leeds.",
    askingGbp: 20,
    condition: "used-good",
    quantityAvailable: 1,
    photoUrls: [],
    locationCity: "Leeds",
    categoryTag: "plastering",
    postedAtIso: iso(4),
    collectionOnly: true,
    deliveryPossible: false
  },
  {
    id: "tcl-3",
    slug: "free-clearance-corner-beads",
    authorSlug: "bob-plastering",
    kind: "free",
    title: "Free — 40 × PVC corner beads (short lengths)",
    description:
      "Cutting up my leftovers. 40 beads between 500mm and 900mm long. Not enough for a full job but might save someone a bag. Collect from Withington (M20).",
    condition: "as-new",
    quantityAvailable: 40,
    photoUrls: [],
    locationCity: "Manchester",
    categoryTag: "materials",
    postedAtIso: iso(0),
    collectionOnly: true,
    deliveryPossible: false
  },
  {
    id: "tcl-4",
    slug: "swap-110v-transformer",
    authorSlug: "riverside-electrics",
    kind: "offer",
    title: "Swap: 110V transformer for a 240V cable reel",
    description:
      "Got a 3.3kVA transformer I never use. Would swap for a 25m 240V heavy-duty reel. Meet in Leeds or Manchester.",
    swapForLabel: "25m 240V heavy-duty cable reel",
    condition: "used-good",
    quantityAvailable: 1,
    photoUrls: [],
    locationCity: "Leeds",
    categoryTag: "electrical",
    postedAtIso: iso(2),
    collectionOnly: false,
    deliveryPossible: true
  }
];

export function findTradeCounterListing(slug: string): TradeCounterListing | undefined {
  return TRADE_COUNTER_FIXTURES.find((l) => l.slug === slug);
}

export function tradeCounterListingsByKind(k: TradeCounterListingKind | "all"): TradeCounterListing[] {
  if (k === "all") return TRADE_COUNTER_FIXTURES;
  return TRADE_COUNTER_FIXTURES.filter((l) => l.kind === k);
}
