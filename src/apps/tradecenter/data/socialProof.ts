// Product-level social-proof signals + trust confirmations for the PDP.
//
// Trade Center's advantage over eBay/Amazon/Etsy: every social-proof
// signal here is derived from PROFESSIONAL trade activity, not
// anonymous consumer behaviour. A Notebook add is a Verified Trade
// committing this to their working supply list — not a wishlist tap.
//
// Constitution alignment: every counter is aggregated + anonymised,
// never linked back to individual trades or customers. Trade Center
// never publishes assertions about a specific person.

export type ProductSocialProof = {
  productSlug: string;
  /** Traders who currently have this product in their Notebook nationwide. */
  notebookCount: number;
  /** Verified Trades who ordered this in the last 30 days. */
  verifiedTradeOrders30d: number;
  /** Times this appears as a materials line in active Job Cost estimates
   *  this month (from R01 Job Cost Mode). */
  jobCostAppearancesMonth: number;
  /** Regional context — e.g. traders near the viewer with this in Notebook. */
  nearbyNotebookCount?: number;
  nearbyCity?: string;
  /** Category-level ranking momentum. */
  trending?: {
    category: string;
    positionsMoved: number;   // positive means moved UP the ranking
  };
  /** How many nearby verified merchants also stock this product. */
  nearbyStockingMerchants?: number;
};

export const PRODUCT_SOCIAL_PROOF_FIXTURES: ProductSocialProof[] = [
  {
    productSlug: "marshalltown-finishing-trowel-14",
    notebookCount: 89,
    verifiedTradeOrders30d: 47,
    jobCostAppearancesMonth: 340,
    nearbyNotebookCount: 12,
    nearbyCity: "Manchester",
    trending: { category: "Plastering", positionsMoved: 12 },
    nearbyStockingMerchants: 3
  },
  {
    productSlug: "ox-plastering-hawk-13",
    notebookCount: 62,
    verifiedTradeOrders30d: 31,
    jobCostAppearancesMonth: 210,
    nearbyNotebookCount: 8,
    nearbyCity: "Manchester",
    trending: { category: "Plastering", positionsMoved: 5 },
    nearbyStockingMerchants: 2
  },
  {
    productSlug: "refina-skimming-blade-24",
    notebookCount: 51,
    verifiedTradeOrders30d: 24,
    jobCostAppearancesMonth: 175,
    nearbyNotebookCount: 6,
    nearbyCity: "Manchester",
    nearbyStockingMerchants: 2
  }
];

export function findSocialProof(productSlug: string): ProductSocialProof | undefined {
  return PRODUCT_SOCIAL_PROOF_FIXTURES.find((p) => p.productSlug === productSlug);
}

// ─── Trust confirmations (per-merchant / per-transaction) ────────────

export type TrustConfirmations = {
  /** How many of the R07 8 layers this merchant has verified. */
  verifiedLayers: number;
  layersTotal: 8;
  /** Whether the merchant offers Trade Center Guaranteed on this product
   *  (Stripe Connect delayed payout — planned build). */
  tradeCenterGuaranteed: boolean;
  /** Human-readable dispatch promise ("Same day (order before 2pm)"). */
  dispatchPromise?: string;
  /** Human-readable return policy. */
  returnPolicy: string;
  /** Same-day cutoff time in local — used for the countdown. */
  sameDayCutoffLocalTime?: string;
};
