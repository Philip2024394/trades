// Product detail data — the "rich" data set the PDP consumes.
//
// Ported from the Hammerex PDP contract (see hammer/src/app/product/[slug]).
// Extended tables kept OFF the base MarketplaceProduct fixture so existing
// consumers (product card, category grid) stay unaffected.
//
// SKIPPED per Philip's directive 2026-07-11: "In the box" section.

export type MultiBuyTier = {
  qty: number;
  totalPriceGbp: number;
  label?: string;           // "2-pack", "Trade case (4)"
  description?: string;     // fresh copy for the deal
};

export type ProductVariant = {
  id: string;
  label: string;            // "14 inch", "16 inch"
  priceDeltaGbp?: number;   // +/- vs base price
  stockCount: number;
};

export type ProductGalleryMedia = {
  id: string;
  kind: "image" | "video";
  url: string;
  alt?: string;
  poster?: string;          // for video
};

export type ProductFeature = {
  label: string;
  detail?: string;
};

export type ProductSpec = {
  label: string;
  value: string;
};

export type ProductPairWith = {
  id: string;
  productSlug: string;
  reason: string;
};

export type ProductBundleItem = {
  productSlug: string;
  qty: number;
};

export type ProductBundle = {
  title: string;
  discountPct: number;
  items: ProductBundleItem[];  // anchor is NOT included here (it's the current product); this is what's ADDED
};

export type ProductReview = {
  id: string;
  starRating: number;
  authorName: string;
  authorRole?: string;
  createdAtIso: string;
  title: string;
  body: string;
};

export type ProductFaq = {
  q: string;
  a: string;
};

export type ProductDetails = {
  productSlug: string;
  gallery: ProductGalleryMedia[];
  variants?: ProductVariant[];
  multiBuyTiers?: MultiBuyTier[];         // Hammerex "multi purchase" 1/2/3/4 switcher
  keyFeatures: ProductFeature[];
  specs: ProductSpec[];
  pairsWith: ProductPairWith[];           // "buy with this product" 3-col grid
  bundle?: ProductBundle;                 // "Bundle & Save" accordion
  compareWithSlugs: string[];             // side-by-side compare rail
  reviews: ProductReview[];
  faq: ProductFaq[];
  overview: string;                       // long-form description used on the buy column
  warrantyYears?: number;
  dispatchLeadDays?: number;
  freeDeliveryOver?: number;
};

// ─── Fixtures ─────────────────────────────────────────────────────────
// Rich detail for the flagship Marshalltown Finishing Trowel product.
// Every other product falls back to a minimal set built from base data.

export const PRODUCT_DETAILS_FIXTURES: ProductDetails[] = [
  {
    productSlug: "marshalltown-finishing-trowel-14",
    gallery: [
      { id: "g1", kind: "image", url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2011,%202026,%2004_06_22%20AM.png", alt: "Marshalltown Finishing Trowel — angled hero shot" },
      { id: "g2", kind: "image", url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2011,%202026,%2004_11_36%20AM.png", alt: "In use on skim coat" },
      { id: "g3", kind: "image", url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2002_59_22%20AM.png", alt: "Handle detail" }
    ],
    variants: [
      { id: "v1", label: "13\" · standard",      priceDeltaGbp: -4, stockCount: 24 },
      { id: "v2", label: "14\" · finishing",     priceDeltaGbp:  0, stockCount: 42 },
      { id: "v3", label: "16\" · pro finishing", priceDeltaGbp:  6, stockCount: 18 }
    ],
    multiBuyTiers: [
      { qty: 2, totalPriceGbp: 56,  label: "Twin-pack", description: "Two trowels — one to leave clean, one to use." },
      { qty: 3, totalPriceGbp: 78,  label: "Site trio", description: "One trowel for you, two for the lads." },
      { qty: 4, totalPriceGbp: 96,  label: "Trade case (4)", description: "Bulk-crew case — save 20% off the unit price." }
    ],
    keyFeatures: [
      { label: "Stainless steel blade",   detail: "Won't rust in the bucket, holds an edge job after job." },
      { label: "DuraSoft resilon handle", detail: "Vibration-dampening, comfortable across long finishing sessions." },
      { label: "Straight-edge finish",    detail: "Precision-ground edges for a plane finish first pass." },
      { label: "Made in USA",             detail: "Original Marshalltown factory-forged blade." }
    ],
    specs: [
      { label: "Blade length",   value: "14 inches (356 mm)" },
      { label: "Blade width",    value: "4 3/4 inches (121 mm)" },
      { label: "Blade material", value: "Stainless steel" },
      { label: "Handle",         value: "DuraSoft resilon grip" },
      { label: "Weight",         value: "540 g" },
      { label: "Country of origin", value: "USA" }
    ],
    pairsWith: [
      { id: "pw1", productSlug: "ox-plastering-hawk-13",     reason: "The hawk your trowel deserves — 13\" aluminium with foam grip." },
      { id: "pw2", productSlug: "refina-skimming-blade-24",  reason: "For flat finishes on wide surfaces — pair a trowel with a blade." },
      { id: "pw3", productSlug: "clever-extra-strong-bucket-26", reason: "26L heavy-duty tub. Mix here, trowel there." }
    ],
    bundle: {
      title: "Complete Skim Kit — Trowel + Hawk + Bucket",
      discountPct: 12,
      items: [
        { productSlug: "ox-plastering-hawk-13",     qty: 1 },
        { productSlug: "clever-extra-strong-bucket-26", qty: 1 }
      ]
    },
    compareWithSlugs: ["trowel-set-2pc", "refina-skimming-blade-24"],
    reviews: [
      { id: "r1", starRating: 5, authorName: "Dave K.",  authorRole: "Plasterer · 12yrs", createdAtIso: "2026-05-11T00:00:00Z", title: "Better than my old one", body: "Bought this to replace an ageing Marshalltown — the new resilon handle is a step up. Blade stays sharp all day." },
      { id: "r2", starRating: 5, authorName: "Sarah W.", authorRole: "Site foreman",       createdAtIso: "2026-04-02T00:00:00Z", title: "Standard-issue for the lads", body: "Gave a batch of these to my crew — no complaints, no snapped handles, no rusted blades. Fair price for what you get." },
      { id: "r3", starRating: 4, authorName: "Mick B.",  authorRole: "Plasterer",           createdAtIso: "2026-02-18T00:00:00Z", title: "Solid trowel, took a couple jobs to break in", body: "Blade needed a couple jobs to bed in — after that it's a proper finishing trowel. Would buy again." }
    ],
    faq: [
      { q: "Is this the flexi version?", a: "This is the standard finishing trowel — for the flexi version look at the 16\" pro finishing variant which has a slightly more forgiving blade for skim coats." },
      { q: "Same-day dispatch?",         a: "Yes — orders placed before 2pm dispatch same working day from Manchester Tools Direct's Manchester warehouse." },
      { q: "Trade discount?",            a: "Members with a Verified Trade Identity see the trade price live on this page. Open an account with Manchester Tools Direct for account-level pricing on top." },
      { q: "Warranty?",                  a: "Marshalltown warranty is 12 months on the blade against manufacturing defects. The handle is not covered against normal wear." }
    ],
    overview:
      "Marshalltown's 14\" stainless finishing trowel is the trade-standard finish tool for UK plasterers. Precision-ground stainless blade holds its edge job after job; DuraSoft resilon handle takes the vibration out of long finishing sessions. This is the trowel most of your plastering crew will already own — and the one they'll buy again when it's time to replace.",
    warrantyYears: 1,
    dispatchLeadDays: 0,
    freeDeliveryOver: 75
  }
];

export function findProductDetails(slug: string): ProductDetails | undefined {
  return PRODUCT_DETAILS_FIXTURES.find((d) => d.productSlug === slug);
}
