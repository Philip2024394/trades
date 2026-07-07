// Products — shared types (used by helpers, routes, and cross-app
// consumers). Kept minimal + serialisable so any app can hold a
// reference without pulling in Products internals.
import "server-only";

export type ProductLifecycleStatus =
  | "draft"
  | "active"
  | "legacy"
  | "withdrawn";

export type StockStatus =
  | "in_stock"
  | "low"
  | "out"
  | "preorder"
  | "discontinued";

export type CanonicalProduct = {
  id: string;
  publisherBusinessId: string;
  gtin: string | null;
  mpn: string | null;
  brandName: string;
  name: string;
  slug: string;
  description: string | null;
  categoryPath: string[];
  taxonomyLeafSlug: string | null;
  attributes: Record<string, unknown>;
  heroImageUrl: string | null;
  imageUrls: string[];
  documents: Array<{ kind: string; title: string; url: string }>;
  warrantyYears: number | null;
  warrantyTermsUrl: string | null;
  msrpPence: number | null;
  lifecycleStatus: ProductLifecycleStatus;
  publishedAt: string | null;
  withdrawnAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProductVariant = {
  id: string;
  canonicalProductId: string;
  variantAxes: Record<string, string>;
  gtin: string | null;
  mpn: string | null;
  nameSuffix: string | null;
  heroImageUrl: string | null;
  imageUrls: string[];
  attributesDelta: Record<string, unknown>;
  lifecycleStatus: ProductLifecycleStatus;
};

export type MerchantOffer = {
  id: string;
  merchantId: string;
  canonicalProductId: string;
  variantId: string | null;
  merchantSku: string | null;
  pricePence: number;
  rrpPence: number | null;
  vatRate: number;
  stockStatus: StockStatus;
  stockQuantity: number | null;
  lowStockThreshold: number | null;
  leadTimeDays: number | null;
  deliveryOptions: Array<{
    zone: string;
    price_pence: number;
    eta_days: number;
  }>;
  localImageUrls: string[];
  localNotes: string | null;
  isActive: boolean;
  isFeatured: boolean;
  promotion: {
    kind?: string;
    percentage?: number;
    ends_at?: string;
    label?: string;
  } | null;
  supplierBusinessId: string | null;
  supplierRangeId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProductWithOffers = {
  canonical: CanonicalProduct;
  variants: ProductVariant[];
  offers: MerchantOffer[];
};

export type OfferListFilters = {
  merchantId?: string;
  taxonomyLeafSlug?: string;
  categoryPathPrefix?: string[];
  stockStatus?: StockStatus | StockStatus[];
  minPricePence?: number;
  maxPricePence?: number;
  q?: string;                     // partial name / brand
  limit?: number;
  offset?: number;
};
