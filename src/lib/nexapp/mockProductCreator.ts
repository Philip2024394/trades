// src/lib/nexapp/mockProductCreator.ts · Philip 2026-09-05
//
// Mock data + local draft persistence for the NEX Product Creator P0 slice.
//
// EXPLICIT BOUNDARY (per §47 of the authorizing spec):
//   · No backend · no DB · no .env · no workforce · no C12
//   · No taxonomy backend (mock category tree only · marked future)
//   · No commercial pricing backend (Incoterms/MOQ deferred behind Advanced)
//   · No market visibility backend (deferred behind Advanced)
//   · No promotion backend (deferred behind Advanced)
//   · No real image upload (photo slots are visual mock only)
//   · Draft persists to localStorage under a namespaced key · client-only
//
// When taxonomy T1-T3 land, replace `MOCK_CATEGORY_TREE` with the real
// canonical taxonomy consumed via the future taxonomy service. The shape
// used here is a stub — the actual taxonomy design lives in:
//   doctrine_nex_universal_business_product_taxonomy_2026_09_05.md
//
// When Commercial Pricing extension is implemented, replace `DEFAULT_UNITS`
// and the future-integration Advanced Commercial Pricing panel with the
// real commercial_price schema per:
//   doctrine_nex_product_international_commercial_pricing_extension_2026_09_05.md

// ── Types ──────────────────────────────────────────────────────────────

export type ProductCondition = "new" | "used" | "refurbished" | "other";

export type ShippingOption =
  | "buyer_pays"
  | "seller_pays"
  | "pickup"
  | "delivery"
  | "contact_seller";

export type ProcessingTime =
  | "ready_immediately"
  | "1_to_2_days"
  | "3_to_5_days"
  | "made_to_order"
  | "custom";

export interface MockCategoryNode {
  slug: string;                       // stable slug per Taxonomy doctrine §13
  label: string;                      // owner-facing display name (EN for mock)
  children?: MockCategoryNode[];
}

/**
 * Mock category tree · REPLACE with real Universal Taxonomy at T3.
 * Depth kept modest for P0 · demonstrates hierarchical selection UX.
 */
export const MOCK_CATEGORY_TREE: readonly MockCategoryNode[] = [
  {
    slug: "apparel",
    label: "Apparel & Fashion",
    children: [
      {
        slug: "apparel.footwear",
        label: "Footwear",
        children: [
          {
            slug: "apparel.footwear.sports",
            label: "Sports Footwear",
            children: [
              { slug: "apparel.footwear.sports.running_shoes", label: "Running Shoes" },
              { slug: "apparel.footwear.sports.training",      label: "Training Shoes" },
              { slug: "apparel.footwear.sports.football",      label: "Football Boots" },
            ],
          },
          { slug: "apparel.footwear.casual", label: "Casual Footwear" },
          { slug: "apparel.footwear.formal", label: "Formal Footwear" },
        ],
      },
      { slug: "apparel.garments", label: "Garments" },
      { slug: "apparel.accessories", label: "Accessories" },
    ],
  },
  {
    slug: "food",
    label: "Food & Beverage",
    children: [
      {
        slug: "food.seafood",
        label: "Seafood",
        children: [
          {
            slug: "food.seafood.fish",
            label: "Fish",
            children: [
              { slug: "food.seafood.fish.tuna.frozen", label: "Frozen Tuna" },
              { slug: "food.seafood.fish.tuna.fresh",  label: "Fresh Tuna" },
              { slug: "food.seafood.fish.salmon",      label: "Salmon" },
            ],
          },
          { slug: "food.seafood.shellfish", label: "Shellfish" },
        ],
      },
      { slug: "food.restaurant", label: "Restaurant" },
      { slug: "food.beverage",   label: "Beverage" },
    ],
  },
  {
    slug: "hospitality",
    label: "Hospitality",
    children: [
      { slug: "hospitality.accommodation.hotel",    label: "Hotel" },
      { slug: "hospitality.accommodation.villa",    label: "Villa" },
      { slug: "hospitality.accommodation.ryokan",   label: "Ryokan" },
    ],
  },
  {
    slug: "furniture",
    label: "Furniture & Home",
    children: [
      { slug: "furniture.seating.chair",   label: "Chairs" },
      { slug: "furniture.tables",          label: "Tables" },
      { slug: "furniture.beds",            label: "Beds" },
    ],
  },
  {
    slug: "industrial",
    label: "Industrial & Engineering",
    children: [
      { slug: "industrial.bearings",       label: "Bearings" },
      { slug: "industrial.tools",          label: "Tools" },
      { slug: "industrial.machinery",      label: "Machinery" },
    ],
  },
  {
    slug: "electronics",
    label: "Electronics",
    children: [
      { slug: "electronics.audio",         label: "Audio" },
      { slug: "electronics.wearables",     label: "Wearables" },
      { slug: "electronics.mobile",        label: "Mobile" },
    ],
  },
];

/**
 * Flatten the tree into path/label pairs for the search UX.
 * Owner types "running shoes" · this returns the matching leaf(s) with full path.
 */
export interface CategorySearchHit {
  slug: string;
  label: string;
  breadcrumb: string;      // "Apparel & Fashion → Footwear → Sports Footwear → Running Shoes"
}

export function flattenCategoryTree(
  nodes: readonly MockCategoryNode[] = MOCK_CATEGORY_TREE,
  path: string[] = [],
  out: CategorySearchHit[] = [],
): CategorySearchHit[] {
  for (const n of nodes) {
    const nextPath = [...path, n.label];
    out.push({ slug: n.slug, label: n.label, breadcrumb: nextPath.join(" → ") });
    if (n.children?.length) flattenCategoryTree(n.children, nextPath, out);
  }
  return out;
}

export function searchCategories(query: string, limit = 6): CategorySearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const all = flattenCategoryTree();
  return all
    .filter((h) => h.label.toLowerCase().includes(q) || h.slug.toLowerCase().includes(q))
    .slice(0, limit);
}

// ── Option lists ───────────────────────────────────────────────────────

export const CONDITION_OPTIONS: ReadonlyArray<{ value: ProductCondition; label: string; hint?: string }> = [
  { value: "new",          label: "New" },
  { value: "used",         label: "Used" },
  { value: "refurbished",  label: "Refurbished" },
  { value: "other",        label: "Other" },
];

/**
 * Owner brand list · mock only · replaced by owner-brand registry later.
 */
export const DEFAULT_BRANDS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "nex",           label: "NEX" },
  { value: "own_brand",     label: "Own brand" },
  { value: "no_brand",      label: "No brand" },
  { value: "private_label", label: "Private label" },
];

/**
 * Units · minimal set for P0 · extensible via governance later.
 */
export const DEFAULT_UNITS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "piece",      label: "Piece" },
  { value: "pair",       label: "Pair" },
  { value: "kg",         label: "kg" },
  { value: "g",          label: "g" },
  { value: "tonne",      label: "Metric ton" },
  { value: "box",        label: "Box" },
  { value: "carton",     label: "Carton" },
  { value: "container",  label: "Container" },
  { value: "portion",    label: "Portion (per person)" },
  { value: "night",      label: "Night" },
  { value: "hour",       label: "Hour" },
  { value: "session",    label: "Session" },
];

/**
 * Currencies · matches launch currencies from Currency doctrine.
 * Owner-currency remains authoritative per doctrine.
 */
export const DEFAULT_CURRENCIES: ReadonlyArray<{ value: string; label: string; symbol: string }> = [
  { value: "IDR", label: "IDR · Indonesian Rupiah", symbol: "Rp" },
  { value: "JPY", label: "JPY · Japanese Yen",       symbol: "¥"  },
  { value: "USD", label: "USD · US Dollar",          symbol: "$"  },
  { value: "EUR", label: "EUR · Euro",               symbol: "€"  },
  { value: "GBP", label: "GBP · British Pound",      symbol: "£"  },
  { value: "SGD", label: "SGD · Singapore Dollar",   symbol: "S$" },
  { value: "AUD", label: "AUD · Australian Dollar",  symbol: "A$" },
];

export const SHIPPING_OPTIONS: ReadonlyArray<{ value: ShippingOption; label: string }> = [
  { value: "buyer_pays",     label: "Buyer pays" },
  { value: "seller_pays",    label: "Seller pays" },
  { value: "pickup",         label: "Pickup" },
  { value: "delivery",       label: "Delivery" },
  { value: "contact_seller", label: "Contact seller" },
];

export const PROCESSING_OPTIONS: ReadonlyArray<{ value: ProcessingTime; label: string }> = [
  { value: "ready_immediately", label: "Ready immediately" },
  { value: "1_to_2_days",       label: "1–2 days" },
  { value: "3_to_5_days",       label: "3–5 days" },
  { value: "made_to_order",     label: "Made to order" },
  { value: "custom",            label: "Custom" },
];

// ── Draft shape ────────────────────────────────────────────────────────

export interface ProductDraft {
  // Identity
  id: string;                                 // idempotency key (per PWA doctrine)
  createdAt: string;                          // ISO
  updatedAt: string;                          // ISO
  // Type dispatch · P0 supports Product only · Service reserved.
  itemType: "product" | "service";
  // Media · P0 stores mock photo slots only.
  photos: Array<{ id: string; url: string | null; isCover: boolean; localOnly: boolean }>;
  // Details
  name: string;
  categorySlug: string | null;
  categoryLabel: string | null;               // derived · shown to owner
  categoryBreadcrumb: string | null;          // "Apparel → Footwear → Sports → Running Shoes"
  condition: ProductCondition;
  brand: string;
  shortDescription: string;
  fullDescription: string;
  // Simple commercial (Local mode default per Marketing modes doctrine)
  price: string;                              // string to preserve owner input formatting
  currency: string;                           // ISO 4217
  stock: string;                              // string for owner input
  unit: string;
  sku: string;
  barcode: string;
  // Delivery & Location
  location: string;                           // free text for P0 · Location Intelligence lands later
  shipping: ShippingOption;
  processingTime: ProcessingTime;
  cashOnDelivery: boolean;
  // Sync state · P0 keeps everything local
  syncState: "local" | "sync_pending" | "synced" | "sync_failed" | "published";
}

export function createEmptyDraft(): ProductDraft {
  const now = new Date().toISOString();
  return {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
    itemType: "product",
    photos: [
      { id: "slot-1", url: null, isCover: true,  localOnly: true },
      { id: "slot-2", url: null, isCover: false, localOnly: true },
      { id: "slot-3", url: null, isCover: false, localOnly: true },
      { id: "slot-4", url: null, isCover: false, localOnly: true },
    ],
    name: "",
    categorySlug: null,
    categoryLabel: null,
    categoryBreadcrumb: null,
    condition: "new",
    brand: "",
    shortDescription: "",
    fullDescription: "",
    price: "",
    currency: "IDR",
    stock: "",
    unit: "piece",
    sku: "",
    barcode: "",
    location: "",
    shipping: "buyer_pays",
    processingTime: "1_to_2_days",
    cashOnDelivery: false,
    syncState: "local",
  };
}

/**
 * Prefilled sample draft matching the reference image · used only as an
 * initial demo state when localStorage is empty. Replace with genuine
 * empty state once flow is validated by review.
 */
export function createSampleDraft(): ProductDraft {
  const base = createEmptyDraft();
  return {
    ...base,
    photos: [
      { id: "slot-1", url: "cover",  isCover: true,  localOnly: true },
      { id: "slot-2", url: "photo",  isCover: false, localOnly: true },
      { id: "slot-3", url: "photo",  isCover: false, localOnly: true },
      { id: "slot-4", url: null,     isCover: false, localOnly: true },
    ],
    name: "Street Runner Pro",
    categorySlug: "apparel.footwear.sports.running_shoes",
    categoryLabel: "Running Shoes",
    categoryBreadcrumb: "Apparel & Fashion → Footwear → Sports Footwear → Running Shoes",
    condition: "new",
    brand: "nex",
    shortDescription: "Comfortable, stylish and built for everyday performance.",
    fullDescription:
      "Street Runner Pro is designed for daily comfort and long-lasting performance. Lightweight material, breathable mesh, and a soft sole for any activity.",
    price: "850000",
    currency: "IDR",
    stock: "25",
    unit: "pair",
    sku: "SRP-BLK-42",
    barcode: "",
    location: "Yogyakarta, Indonesia",
    shipping: "buyer_pays",
    processingTime: "1_to_2_days",
    cashOnDelivery: true,
  };
}

// ── Local draft persistence · localStorage · SSR-safe ─────────────────

const STORAGE_KEY = "nex.product-creator.draft.v1";

export function loadDraft(): ProductDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProductDraft;
    if (!parsed || typeof parsed !== "object" || !parsed.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDraft(draft: ProductDraft): void {
  if (typeof window === "undefined") return;
  try {
    const payload = { ...draft, updatedAt: new Date().toISOString() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage full or blocked · silent for P0 · future PWA slice adds handling
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
}

// ── Price display helper (per Currency doctrine · owner-original always shown) ──

export function formatOwnerPrice(amount: string, currency: string): string {
  const cur = DEFAULT_CURRENCIES.find((c) => c.value === currency);
  const symbol = cur?.symbol ?? currency;
  if (!amount) return "";
  // Simple grouping for IDR/JPY/etc · never invent a rate · never convert.
  const clean = amount.replace(/[^\d.]/g, "");
  const asNumber = Number(clean);
  if (!Number.isFinite(asNumber)) return `${symbol}${amount}`;
  const grouped = new Intl.NumberFormat("en-US").format(asNumber);
  return `${symbol}${grouped}`;
}

// ── Character-count helpers (used by inputs) ──────────────────────────

export const LIMITS = {
  name: 80,
  shortDescription: 150,
  fullDescription: 1000,
  sku: 40,
  barcode: 40,
} as const;
