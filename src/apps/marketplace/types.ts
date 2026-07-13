// Marketplace App — shared types.

/** Multi-layer trust score per TRADE_CENTER_2_SPEC §19.1. */
export type TrustLayer = {
  verifiedAt: number;
  [key: string]: unknown;
};

export type LayeredTrustScore = {
  /** Weighted composite 0–100. */
  score: number;
  layers: {
    identity: TrustLayer | null;
    business: (TrustLayer & { source: string }) | null;
    skills: (TrustLayer & { tradeBodies: readonly string[] }) | null;
    address: TrustLayer | null;
    insurance: (TrustLayer & { publicLiabilityGbp: number }) | null;
    qualifications: (TrustLayer & { certifications: readonly string[] }) | null;
    reviews: (TrustLayer & { meetsThreshold: boolean }) | null;
    yearsTrading: (TrustLayer & { years: number }) | null;
  };
};

export type ProductCategorySlug =
  | "hand-tools"
  | "power-tools"
  | "site-materials"
  | "safety-ppe";

export type MarketplaceProduct = {
  id: string;
  slug: string;
  name: string;
  spec: string;
  category: ProductCategorySlug;
  subCategory: string;
  merchantSlug: string;
  /** Retail (everyone sees). */
  priceGbp: number;
  /** Trade-only price (Professional+). */
  tradePriceGbp?: number;
  /** Business account pricing (Enterprise). */
  businessPriceGbp?: number;
  currency: "GBP";
  imageUrl?: string;
  /** In-stock / low / preorder / out. */
  stockState: "in" | "low" | "out" | "preorder";
  stockQty?: number;
  deliveryPromise: string;
  collectAvailable: boolean;
  /** Miles from the buyer's default 25mi (mock data uses fixed values). */
  distanceMi?: number;
  bulkPricing?: { qty: number; unitGbp: number }[];
  /** Pack / multi-piece signal — renders as a top-right chip on the
   *  card, separate visual treatment from the promotional badges.
   *  Free-form label the merchant sets, e.g. "Pack of 50", "3 piece",
   *  "Set of 2". Uppercased in the chip render. */
  packSize?: string;
  starRating: number;
  reviewCount: number;
  badges?: readonly ("best-seller" | "top-rated" | "value-pack" | "new")[];
};
