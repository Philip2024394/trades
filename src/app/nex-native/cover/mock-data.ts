// src/app/nex-native/_cover/mock-data.ts
//
// Mock content used by every layout preview so the 10 covers can be
// judged on their COMPOSITION under one theme rather than on content
// variation. Same peer, same products, same social — different layout.

import type { CoverProduct, CoverSection, CoverSocialLinks } from "./primitives";
import type { NexInfoPagesJson } from "@/lib/nex-native/info-pages";
import type { WeeklyHours } from "./_composer/CoverInfoTray";

export interface MockCoverContent {
  businessName: string;
  tagline: string;
  handle: string;
  location: string;
  portraitUrl: string;
  ownerAccountId: string;
  presenceOnline: boolean;
  social: CoverSocialLinks;
  sections: CoverSection[];
  /** Founder direction 2026-09-30 · ISO 3166-1 alpha-2 · renders a
   *  small round flag badge on the portrait circle instead of the
   *  theme charm. Optional · omit for no flag. */
  countryCode?: string | null;
  /** Founder direction 2026-09-30 · seller-configurable eyebrow +
   *  title for the primary catalog section. Both optional · fall back
   *  to sensible defaults ("Services" / resolved shipping scope) when
   *  omitted. A future settings surface will persist per-business
   *  overrides on nex_business.
   *
   *  When shippingScope is set and sectionTitle is NOT, the layout
   *  resolves NEX_SHIPPING_SCOPE_META[shippingScope].label (e.g.
   *  "Local Delivery" / "Local Delivery / Export") as the visible
   *  heading. sectionTitle wins if both are present. */
  sectionEyebrow?: string | null;
  sectionTitle?: string | null;
  /** Migration 108 · nex_business.shipping_scope value. Optional. */
  shippingScope?:
    | "local_delivery"
    | "local_and_export"
    | "international_only"
    | "pickup_only"
    | "dine_in"
    | "digital"
    | null;
  /** Migration 109 · sealed 2026-09-30 · seller-authored info blob
   *  backing the + button info tray on the cover composer. Optional ·
   *  when null the + button falls back to disabled. */
  infoPages?: NexInfoPagesJson | null;
  /** Cover-facing About Us body (from nex_business.description). Kept
   *  as a top-level field on the mock so preview layouts don't have to
   *  reach into a business object. */
  aboutUs?: string | null;
  /** Accepted payment method labels · pre-rendered from
   *  NEX_PAYMENT_METHOD_META so we don't drag business-service into
   *  the client bundle. */
  paymentMethodLabels?: string[];
  /** Pre-rendered return-policy body · optional. */
  returnPolicyBody?: string | null;
  /** Pre-rendered events / catering body · optional. */
  eventsBody?: string | null;
  /** Venue gallery photo URLs · optional. */
  galleryUrls?: string[];
  /** True when the shop's business_category is a venue. */
  isVenue?: boolean;
  /** Migration 110 · seller-uploaded QR image URL. */
  qrCodeImageUrl?: string | null;
  /** True when the seller has 📱 QRIS on Delivery in accepted methods. */
  acceptsQrisDelivery?: boolean;
  /** Founder direction 2026-09-30 · About Us panel enrichments.
   *  yearEstablished from nex_business.year_established (smallint) ·
   *  ownerName / ownerPosition / ownerAvatarUrl derived from
   *  nex_account joined via nex_business.owner_account_id. All
   *  optional · panel gracefully skips missing fields. */
  yearEstablished?: number | null;
  ownerName?: string | null;
  ownerPosition?: string | null;
  ownerAvatarUrl?: string | null;
  /** Founder direction 2026-09-30 · structured Mon–Sun schedule for
   *  the Info Tray Hours panel. When set, the panel renders a
   *  two-column table with "Closed" for any missing / closed day. */
  hoursByDay?: WeeklyHours | null;
  products: CoverProduct[];
  services: {
    id: string;
    name: string;
    fromPrice: string;
    description: string;
  }[];
  reviews: { author: string; body: string; stars: number }[];
  hours: string;
  address: string;
  atmosphereLine: string;
  /** Founder direction 2026-09-30 · optional coordinates for the
   *  "Visit Us" Google Maps directions link. Falls back to a text
   *  search of `address` when either is null. Sellers set these via
   *  SellerLocationEditor on /manage/shop. */
  locationLat?: number | null;
  locationLng?: number | null;
}

export const MARIA_MOCK: MockCoverContent = {
  // Founder direction 2026-09-30 · templates are now BLANK STAGES.
  // Every identity field renders as a placeholder so sellers can
  // imagine their own business landing on the layout · no more
  // Maria's Café / Corner Store personalities anchoring the design
  // to a specific vertical. Sellers select a template skin, brain-
  // storm their own business, then rewrite these fields on
  // /manage/shop + /manage/info.
  businessName: "Your Business Name",
  tagline: "Your slogan · what you do in a few words",
  handle: "@your-handle",
  location: "Your street address · city · region · postcode",
  portraitUrl: "",
  ownerAccountId: "preview-account",
  presenceOnline: true,
  social: {
    instagram: "yourbusiness",
    tiktok: "@yourbusiness",
    facebook: "yourbusiness",
    whatsapp: "+00000000000",
    website: "https://yourbusiness.com",
  },
  atmosphereLine: "The feeling your customers walk into · one warm line",
  hours: "Opening hours · every day of the week",
  address: "Your street address · city · region · postcode",
  locationLat: null,
  locationLng: null,
  countryCode: "ID",
  shippingScope: "local_and_export",
  aboutUs:
    "This is where your brand story lives · the place visitors get to know who you are before they buy. Talk about your mission · your ambitions · your goals · the moment you started · the people beside you · the standards you refuse to compromise on.\n\nKeep it specific · keep it warm · keep it yours. If you have been at this for years, say so. If you are new and hungry, own that too. Explain the craft, the promise, the reason you exist.\n\nEvery reader who lands here should leave knowing what makes your work different from everyone else's. Sellers rewrite this at any time from /manage/info.",
  paymentMethodLabels: [
    "💵 Cash on Delivery",
    "📱 QRIS on Delivery",
    "🤝 Meetup Cash",
  ],
  qrCodeImageUrl: null,
  acceptsQrisDelivery: true,
  yearEstablished: null,
  ownerName: "Your Name",
  ownerPosition: "Founder",
  hoursByDay: {
    mon: { open: "09:00", close: "18:00" },
    tue: { open: "09:00", close: "18:00" },
    wed: { open: "09:00", close: "18:00" },
    thu: { open: "09:00", close: "18:00" },
    fri: { open: "09:00", close: "18:00" },
    sat: { open: "10:00", close: "16:00" },
    sun: { closed: true },
  },
  ownerAvatarUrl: null,
  returnPolicyBody:
    "Your return policy goes here. Explain the return window, the condition requirements, and how buyers start a return in a few short sentences.",
  eventsBody:
    "If you host events or take catering bookings, describe the size range, the notice required, and what buyers can expect. Keep it under 400 characters so it scans on a phone screen.",
  galleryUrls: [],
  isVenue: true,
  infoPages: {
    enabled: {
      about_us: true,
      delivery: true,
      hours: true,
      payment: true,
      returns: true,
      catering: true,
      gallery: false,
      custom_orders: false,
      services: false,
    },
    delivery_details:
      "Describe your delivery area · your cut-off times · any fees. Keep it short so buyers know what to expect at a glance.",
    custom_buttons: [
      {
        id: "cb_promise",
        enabled: true,
        icon: "✨",
        label: "Our Promise",
        body: "One or two lines about the standard you hold yourself to. Keep it short · keep it warm · keep it specific.",
        image_url: null,
        external_url: null,
      },
    ],
    faq_items: [
      {
        id: "faq_1",
        enabled: true,
        question: "First question buyers ask?",
        answer:
          "The answer goes here · keep it a few short sentences so it reads fast on a phone screen.",
      },
      {
        id: "faq_2",
        enabled: true,
        question: "Second question buyers ask?",
        answer:
          "The answer goes here · keep it a few short sentences so it reads fast on a phone screen.",
      },
      {
        id: "faq_3",
        enabled: true,
        question: "Third question buyers ask?",
        answer:
          "The answer goes here · keep it a few short sentences so it reads fast on a phone screen.",
      },
    ],
  },
  sections: [
    { id: "sec-cat1", name: "Category 1", sort_order: 0 },
    { id: "sec-cat2", name: "Category 2", sort_order: 1 },
    { id: "sec-cat3", name: "Category 3", sort_order: 2 },
  ],
  products: [
    { id: "prod-01", slug: "product-01", name: "Product Name 01", price_pence: 5000000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat1", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-02", slug: "product-02", name: "Product Name 02", price_pence: 4500000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat1", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-03", slug: "product-03", name: "Product Name 03", price_pence: 6000000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat1", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-04", slug: "product-04", name: "Product Name 04", price_pence: 3500000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat2", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-05", slug: "product-05", name: "Product Name 05", price_pence: 7500000, currency: "IDR", image_url: null, stock_status: "low_stock", section_id: "sec-cat2", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-06", slug: "product-06", name: "Product Name 06", price_pence: 4200000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat2", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-07", slug: "product-07", name: "Product Name 07", price_pence: 2800000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat3", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-08", slug: "product-08", name: "Product Name 08", price_pence: 5500000, currency: "IDR", image_url: null, stock_status: "low_stock", section_id: "sec-cat3", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-09", slug: "product-09", name: "Product Name 09", price_pence: 3200000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat3", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-10", slug: "product-10", name: "Product Name 10", price_pence: 4800000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat1", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-11", slug: "product-11", name: "Product Name 11", price_pence: 6200000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat2", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-12", slug: "product-12", name: "Product Name 12", price_pence: 3800000, currency: "IDR", image_url: null, stock_status: "sold_out", section_id: "sec-cat3", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-13", slug: "product-13", name: "Product Name 13", price_pence: 5100000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat1", description: "Short two-line description of what this product is · sellers author their own copy." },
  ],
  services: [
    { id: "svc-1", name: "Service One", fromPrice: "from Rp 000k", description: "One-line description of what this service delivers to your customers." },
    { id: "svc-2", name: "Service Two", fromPrice: "from Rp 000k", description: "One-line description of what this service delivers to your customers." },
    { id: "svc-3", name: "Service Three", fromPrice: "from Rp 000k", description: "One-line description of what this service delivers to your customers." },
  ],
  reviews: [
    { author: "Customer Name", body: "What a satisfied customer wrote about your work goes here.", stars: 5 },
    { author: "Customer Name", body: "What a satisfied customer wrote about your work goes here.", stars: 5 },
    { author: "Customer Name", body: "What a satisfied customer wrote about your work goes here.", stars: 5 },
  ],
};

/**
 * Template 03 (Product Seller) preview mock. Spreads MARIA_MOCK so
 * every non-catalog field stays consistent (identity, theme, hours,
 * info pages, QR, etc.) · overrides sections + products with content
 * that fits a product-seller vertical.
 *
 * Founder direction 2026-09-30 · sealed categories for the product
 * template preview:  Electronics · Mens Wear · Watches
 */
export const PRODUCT_SELLER_MOCK: MockCoverContent = {
  ...MARIA_MOCK,
  isVenue: false,
  // Founder direction 2026-09-30 · templates are BLANK STAGES · this
  // mock mirrors MARIA_MOCK's generic voice · only sections + products
  // are re-shaped so the Product Seller layouts show a warehouse /
  // shipping flavour (three product categories, wider price range)
  // rather than a hospitality flavour (three menu sections). Copy is
  // still fully generic so sellers imagine their own catalogue.
  infoPages: {
    ...(MARIA_MOCK.infoPages ?? {}),
    delivery_details:
      "Describe your dispatch cut-off, courier partners, and any collection option. Keep it under 200 characters so it scans on a phone screen.",
  },
  sections: [
    { id: "sec-cat1", name: "Category 1", sort_order: 0 },
    { id: "sec-cat2", name: "Category 2", sort_order: 1 },
    { id: "sec-cat3", name: "Category 3", sort_order: 2 },
  ],
  products: [
    { id: "prod-p01", slug: "product-01", name: "Product Name 01", price_pence: 500000000,  currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat1", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-p02", slug: "product-02", name: "Product Name 02", price_pence: 250000000,  currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat1", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-p03", slug: "product-03", name: "Product Name 03", price_pence: 1800000000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat1", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-p04", slug: "product-04", name: "Product Name 04", price_pence: 3200000000, currency: "IDR", image_url: null, stock_status: "low_stock", section_id: "sec-cat1", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-p05", slug: "product-05", name: "Product Name 05", price_pence: 850000000,  currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat1", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-p06", slug: "product-06", name: "Product Name 06", price_pence: 78000000,   currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat2", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-p07", slug: "product-07", name: "Product Name 07", price_pence: 195000000,  currency: "IDR", image_url: null, stock_status: "low_stock", section_id: "sec-cat2", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-p08", slug: "product-08", name: "Product Name 08", price_pence: 95000000,   currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat2", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-p09", slug: "product-09", name: "Product Name 09", price_pence: 285000000,  currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat2", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-p10", slug: "product-10", name: "Product Name 10", price_pence: 3450000000, currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat3", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-p11", slug: "product-11", name: "Product Name 11", price_pence: 425000000,  currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat3", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-p12", slug: "product-12", name: "Product Name 12", price_pence: 1650000000, currency: "IDR", image_url: null, stock_status: "sold_out", section_id: "sec-cat3", description: "Short two-line description of what this product is · sellers author their own copy." },
    { id: "prod-p13", slug: "product-13", name: "Product Name 13", price_pence: 725000000,  currency: "IDR", image_url: null, stock_status: "in_stock",  section_id: "sec-cat3", description: "Short two-line description of what this product is · sellers author their own copy." },
  ],
};
