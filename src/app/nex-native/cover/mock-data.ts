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
  businessName: "Maria's Café",
  tagline: "Slow coffee · sourdough · Ubud",
  handle: "@mariascafe",
  location: "Jl. Raya Sanggingan No. 87, Ubud, Bali 80571",
  portraitUrl:
    "https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-theme-hero/maria-santos-hero-1790481483761.png",
  ownerAccountId: "preview-maria",
  presenceOnline: true,
  social: {
    instagram: "mariascafe",
    tiktok: "@mariascafe.bali",
    facebook: "mariascafeubud",
    whatsapp: "+6281234567890",
    website: "https://mariascafe.com",
  },
  atmosphereLine: "Slow coffee · sourdough · warm mornings",
  hours: "07:00 · 22:00 · every day",
  address: "Jl. Raya Sanggingan No. 87, Ubud, Bali 80571",
  // Founder direction 2026-09-30 · lat/lng for the Google Maps
  // directions link on the "Visit Us" panel. Optional · when NULL the
  // directions link falls back to a text-search of the address.
  locationLat: -8.518520,
  locationLng: 115.257660,
  countryCode: "ID",
  shippingScope: "local_and_export",
  aboutUs:
    "Maria's Café is a family-run slow-coffee bar and sourdough kitchen in Ubud, open since 2019. Everything is baked and pulled the same morning by Maria and her two sons Andi and Rian.\n\nWe roast our own single-origin arabica from three Kintamani farms we've worked with for six years. The espresso side of the menu is small on purpose · seven drinks that we can pull consistently at the highest bar. Our sourdough kitchen runs 4:00-5:30 every morning, twelve loaves at a time, and everything is sold by mid-morning.\n\nWe host private catering for events of 8-40, monthly supper clubs, and half-day sourdough workshops for anyone who wants to learn what we do. Every guest at Maria's is treated as family — the coffee comes with time, and the bread comes with stories.\n\nOur promise is simple: nothing frozen, nothing pre-mixed, nothing rushed. If you leave here without feeling looked after, tell us and we'll make it right.",
  paymentMethodLabels: [
    "💵 COD",
    "📱 QRIS on Delivery",
    "🤝 Meetup",
  ],
  // Migration 110 · sealed 2026-09-30 · seller-uploaded QR image URL
  // (renders in the Info Tray Payment panel when acceptsQrisDelivery
  // is true). Placeholder points at a generic QRIS demo image so the
  // preview shows the shape · real sellers upload their own on
  // /manage/shop.
  qrCodeImageUrl:
    "https://placehold.co/512x512/ffffff/000000/png?text=QRIS%0A%E2%97%BC%E2%96%A1%E2%96%A1%0A%E2%96%A1%E2%97%BC%E2%96%A1%0A%E2%96%A1%E2%96%A1%E2%97%BC",
  acceptsQrisDelivery: true,
  yearEstablished: 2019,
  ownerName: "Maria Santos",
  ownerPosition: "Founder",
  hoursByDay: {
    mon: { open: "07:00", close: "22:00" },
    tue: { open: "07:00", close: "22:00" },
    wed: { open: "07:00", close: "22:00" },
    thu: { open: "07:00", close: "22:00" },
    fri: { open: "07:00", close: "23:00" },
    sat: { open: "07:00", close: "23:00" },
    sun: { closed: true },
  },
  // Reuse the identity portrait so the About Us avatar matches the
  // face the buyer already saw at the top of the cover.
  ownerAvatarUrl:
    "https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-theme-hero/maria-santos-hero-1790481483761.png",
  returnPolicyBody:
    "Freshly baked and prepared items are non-returnable. If something arrived damaged, message us within 24 hours with a photo and we'll replace it or refund in full.",
  eventsBody:
    "We cater private parties, weddings, and small corporate events (8-40 people). Full menu · outside catering available · sound system on request. Book at least 5 days ahead.",
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
      "We deliver Ubud + surrounding villages 08:00-21:00. Last order 20:30. Free delivery within 3 km · Rp 15k for the rest.",
    // Founder direction 2026-09-30 · custom button reframed as the
    // NEX-standard "quality promise" pattern. The label adapts to the
    // vertical in real deployments (Ingredients We Use for restaurants
    // / cafes · Parts We Use for repair services · Materials We Use
    // for tradespeople etc.) · Maria is a café so it renders as
    // "Ingredients We Use". The body is a reusable quality-standards
    // paragraph sellers can trim or personalise.
    custom_buttons: [
      {
        id: "cb_ingredients",
        enabled: true,
        icon: "☕",
        label: "Ingredients We Use",
        body: "Every ingredient is hand-picked and selected to hold the quality standards our customers expect. We aim for the highest standards available in the daily preparation of everything we serve.",
        image_url: null,
        external_url: null,
      },
    ],
    faq_items: [
      {
        id: "faq_delivery_sunday",
        enabled: true,
        question: "Do you deliver on Sundays?",
        answer:
          "We're closed on Sundays but courier delivery via GoJek or Grab can still be arranged for regular customers · message us on Saturday to book a Sunday slot.",
      },
      {
        id: "faq_gluten_free",
        enabled: true,
        question: "Do you have gluten-free options?",
        answer:
          "Yes — our sourdough range includes a rice-flour loaf and we can prep gado-gado without wheat crackers on request. Message us the day before for anything more specific.",
      },
      {
        id: "faq_bulk_pricing",
        enabled: true,
        question: "Do you offer bulk / catering pricing?",
        answer:
          "Orders of 20+ items get 10% off, 40+ items 15% off. See the Catering panel for private-event pricing.",
      },
      {
        id: "faq_reservations",
        enabled: true,
        question: "Do you take table reservations?",
        answer:
          "For groups of 6 or more, yes · smaller groups are walk-in only. Message us your date, time, and headcount and we'll confirm within an hour during opening hours.",
      },
    ],
  },
  sections: [
    { id: "sec-meal", name: "Meal", sort_order: 0 },
    { id: "sec-snack", name: "Snack", sort_order: 1 },
    { id: "sec-drinks", name: "Drinks", sort_order: 2 },
  ],
  products: [
    {
      id: "prod-oat-latte",
      slug: "oat-latte",
      name: "Oat Latte",
      price_pence: 3500000,
      currency: "IDR",
      image_url: null,
      stock_status: "in_stock",
      section_id: "sec-drinks",
      description:
        "Double-shot Kintamani espresso with steamed oat milk and a warm honey drizzle on top.",
    },
    {
      id: "prod-nasi-goreng",
      slug: "nasi-goreng",
      name: "Nasi Goreng Spesial",
      price_pence: 4500000,
      currency: "IDR",
      image_url: null,
      stock_status: "in_stock",
      section_id: "sec-meal",
      description:
        "House-fried rice with prawns, chicken satay skewer, fried egg, and Ubud shallots.",
    },
    {
      id: "prod-mie-goreng",
      slug: "mie-goreng",
      name: "Mie Goreng Kampung",
      price_pence: 4200000,
      currency: "IDR",
      image_url: null,
      stock_status: "in_stock",
      section_id: "sec-meal",
      description:
        "Village-style stir-fried noodles with chicken, bok choy, and a fried egg on top.",
    },
    {
      id: "prod-gado-gado",
      slug: "gado-gado",
      name: "Gado-Gado Bumbu Kacang",
      price_pence: 3800000,
      currency: "IDR",
      image_url: null,
      stock_status: "in_stock",
      section_id: "sec-meal",
      description:
        "Warm vegetables and tofu with tempeh, boiled egg, and rich house peanut sauce.",
    },
    {
      id: "prod-soto-ayam",
      slug: "soto-ayam",
      name: "Soto Ayam Kuning",
      price_pence: 4000000,
      currency: "IDR",
      image_url: null,
      stock_status: "in_stock",
      section_id: "sec-meal",
      description:
        "Yellow turmeric broth with pulled chicken, rice noodles, potato, and fresh lime.",
    },
    {
      id: "prod-ayam-bakar",
      slug: "ayam-bakar",
      name: "Ayam Bakar Madu",
      price_pence: 5800000,
      currency: "IDR",
      image_url: null,
      stock_status: "low_stock",
      section_id: "sec-meal",
      description:
        "Grilled half chicken glazed with local honey and lemongrass · served with sambal.",
    },
    {
      id: "prod-sourdough",
      slug: "sourdough",
      name: "Country Sourdough",
      price_pence: 5500000,
      currency: "IDR",
      image_url: null,
      stock_status: "low_stock",
      section_id: "sec-snack",
      description:
        "Slow-fermented country loaf · crackly crust, open crumb · baked each morning.",
    },
    {
      id: "prod-cinnamon-bun",
      slug: "cinnamon-bun",
      name: "Cinnamon Bun",
      price_pence: 3000000,
      currency: "IDR",
      image_url: null,
      stock_status: "in_stock",
      section_id: "sec-snack",
      description:
        "Buttery brioche coil with brown-butter cinnamon filling and cream-cheese glaze.",
    },
    {
      id: "prod-brownie",
      slug: "double-chocolate-brownie",
      name: "Double Chocolate Brownie",
      price_pence: 2800000,
      currency: "IDR",
      image_url: null,
      stock_status: "in_stock",
      section_id: "sec-snack",
      description:
        "Fudgy dark-chocolate brownie · Bali cacao · walnuts · flake-salt finish.",
    },
    {
      id: "prod-cold-brew",
      slug: "cold-brew",
      name: "Cold Brew · 300ml",
      price_pence: 3800000,
      currency: "IDR",
      image_url: null,
      stock_status: "in_stock",
      section_id: "sec-drinks",
      description:
        "18-hour steeped Kintamani cold brew · served neat over big cubes, no dilution.",
    },
    {
      id: "prod-coconut",
      slug: "fresh-young-coconut",
      name: "Fresh Young Coconut",
      price_pence: 2500000,
      currency: "IDR",
      image_url: null,
      stock_status: "in_stock",
      section_id: "sec-drinks",
      description:
        "Chilled young coconut cracked to order · natural water inside · lime wedge on the side.",
    },
    {
      id: "prod-iced-choc",
      slug: "iced-chocolate",
      name: "Iced Chocolate",
      price_pence: 3500000,
      currency: "IDR",
      image_url: null,
      stock_status: "in_stock",
      section_id: "sec-drinks",
      description:
        "House-made cacao ganache stirred through cold milk · single-origin Bali cocoa.",
    },
    {
      id: "prod-tart",
      slug: "lemon-tart",
      name: "Lemon Tart",
      price_pence: 4200000,
      currency: "IDR",
      image_url: null,
      stock_status: "sold_out",
      section_id: "sec-snack",
      description:
        "Buttery shortcrust with tart lemon curd and torched Italian meringue.",
    },
  ],
  services: [
    {
      id: "svc-catering",
      name: "Private catering",
      fromPrice: "from Rp 1.2jt",
      description: "Full menu for events of 8-40 · we bring the kitchen.",
    },
    {
      id: "svc-workshop",
      name: "Sourdough workshop",
      fromPrice: "Rp 450k · pp",
      description: "Half-day hands-on class · take-home starter included.",
    },
    {
      id: "svc-supper-club",
      name: "Monthly supper club",
      fromPrice: "Rp 250k · pp",
      description: "Chef's tasting menu · one seating per month.",
    },
  ],
  reviews: [
    {
      author: "Ayu · Denpasar",
      body: "Best oat latte in Ubud. The barista actually cares.",
      stars: 5,
    },
    {
      author: "Kelly · London",
      body: "Everything from the sourdough to the tart. Felt like Maria's home.",
      stars: 5,
    },
    {
      author: "Rico · Jakarta",
      body: "Catering for our wedding · flawless. Worth every rupiah.",
      stars: 5,
    },
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
  businessName: "Corner Store",
  tagline: "Shop of products",
  isVenue: false,
  // Founder direction 2026-09-30 · longer real-world business address
  // matches the warehouse copy in the Dispatch Times block above ·
  // reads as a proper commerce shop rather than a village cafe pin.
  location: "Jl. Industri Raya No. 345, City West Park, Bali 80361",
  address: "Jl. Industri Raya No. 345, City West Park, Bali 80361",
  // Founder direction 2026-09-30 · warehouse-oriented delivery copy
  // for the Product Seller preview (Maria's cafe delivery copy is
  // hyper-local and doesn't fit a product shop that ships from a
  // warehouse). Feeds both the Dispatch Times cover block AND the
  // Info Tray Delivery panel · one source, two surfaces.
  infoPages: {
    ...(MARIA_MOCK.infoPages ?? {}),
    delivery_details:
      "Orders received before 3pm will dispatch same day from our warehouse located at Industrial Zone 345, City West Park. Collection can be arranged on request — please contact us in advance.",
  },
  aboutUs:
    "Corner Store is your neighbourhood shop for curated electronics, menswear, and watches. Every piece is inspected, cleaned, and photographed by us before it goes live · nothing arrives from a warehouse untouched.\n\nWe've been trading since 2019 out of a small workshop in Ubud. What started as a vintage-camera hobby is now a three-vertical shop with a growing catalogue of quality-checked stock.\n\nOur promise: honest condition notes, fair prices, and every item backed by a full refund window if it doesn't match how we described it.",
  sections: [
    { id: "sec-electronics", name: "Electronics", sort_order: 0 },
    { id: "sec-menswear", name: "Mens Wear", sort_order: 1 },
    { id: "sec-watches", name: "Watches", sort_order: 2 },
  ],
  products: [
    {
      id: "prod-camera",
      slug: "vintage-leica-m3",
      name: "Vintage Leica M3 · CLA'd",
      price_pence: 4200000000,
      currency: "IDR",
      image_url: null,
      stock_status: "in_stock",
      section_id: "sec-electronics",
      description:
        "1957 Leica M3 rangefinder · fully serviced, calibrated shutter, lens board polished.",
    },
    {
      id: "prod-headphones",
      slug: "sony-mdr-cd900st",
      name: "Sony MDR-CD900ST",
      price_pence: 285000000,
      currency: "IDR",
      image_url: null,
      stock_status: "in_stock",
      section_id: "sec-electronics",
      description:
        "Legendary Japanese studio-monitor headphones · flat response, replaceable pads.",
    },
    {
      id: "prod-turntable",
      slug: "technics-sl1200",
      name: "Technics SL-1200 MK2",
      price_pence: 1850000000,
      currency: "IDR",
      image_url: null,
      stock_status: "in_stock",
      section_id: "sec-electronics",
      description:
        "Direct-drive turntable · pitch control · fully serviced · original Ortofon cart.",
    },
    {
      id: "prod-tape-deck",
      slug: "nakamichi-cr7",
      name: "Nakamichi CR-7A Cassette Deck",
      price_pence: 3200000000,
      currency: "IDR",
      image_url: null,
      stock_status: "low_stock",
      section_id: "sec-electronics",
      description:
        "Reference-class 3-head cassette deck · auto azimuth · calibrated bias · rare in this condition.",
    },
    {
      id: "prod-polaroid",
      slug: "polaroid-sx70",
      name: "Polaroid SX-70 · Alpha Land",
      price_pence: 895000000,
      currency: "IDR",
      image_url: null,
      stock_status: "in_stock",
      section_id: "sec-electronics",
      description:
        "Original folding SLR Polaroid · leather-clad body · working shutter · takes new film packs.",
    },
    {
      id: "prod-linen-shirt",
      slug: "italian-linen-shirt",
      name: "Italian Linen Shirt",
      price_pence: 78000000,
      currency: "IDR",
      image_url: null,
      stock_status: "in_stock",
      section_id: "sec-menswear",
      description:
        "Unstructured linen shirt · natural stone-wash · S / M / L / XL · one-piece cuff.",
    },
    {
      id: "prod-selvedge-jean",
      slug: "japanese-selvedge-jean",
      name: "Japanese Selvedge Jean · 14oz",
      price_pence: 195000000,
      currency: "IDR",
      image_url: null,
      stock_status: "low_stock",
      section_id: "sec-menswear",
      description:
        "Kaihara 14oz raw selvedge · tapered fit · natural indigo · size chart in About.",
    },
    {
      id: "prod-oxford",
      slug: "oxford-cotton-shirt",
      name: "Oxford Cotton Shirt · White",
      price_pence: 95000000,
      currency: "IDR",
      image_url: null,
      stock_status: "in_stock",
      section_id: "sec-menswear",
      description:
        "Heavyweight brushed cotton oxford · button-down collar · S / M / L / XL.",
    },
    {
      id: "prod-loafers",
      slug: "penny-loafers",
      name: "Handmade Penny Loafers",
      price_pence: 285000000,
      currency: "IDR",
      image_url: null,
      stock_status: "in_stock",
      section_id: "sec-menswear",
      description:
        "Bali-made full-grain leather · Goodyear-welted · natural cork footbed · EU 40-45.",
    },
    {
      id: "prod-omega",
      slug: "omega-seamaster-1966",
      name: "Omega Seamaster · 1966",
      price_pence: 3450000000,
      currency: "IDR",
      image_url: null,
      stock_status: "in_stock",
      section_id: "sec-watches",
      description:
        "Cal. 565 automatic · original silver dial · service history since 2018 · box + papers.",
    },
    {
      id: "prod-seiko",
      slug: "seiko-skx007",
      name: "Seiko SKX007 · Diver",
      price_pence: 425000000,
      currency: "IDR",
      image_url: null,
      stock_status: "in_stock",
      section_id: "sec-watches",
      description:
        "200m automatic diver · original hardlex crystal · Jubilee bracelet · well-loved condition.",
    },
    {
      id: "prod-casio",
      slug: "casio-fx-oceanus",
      name: "Casio Oceanus · Titanium",
      price_pence: 1650000000,
      currency: "IDR",
      image_url: null,
      stock_status: "sold_out",
      section_id: "sec-watches",
      description:
        "Titanium bracelet · atomic sync · sapphire crystal · full accessories, sealed.",
    },
    {
      id: "prod-hamilton",
      slug: "hamilton-khaki-field",
      name: "Hamilton Khaki Field · 38mm",
      price_pence: 725000000,
      currency: "IDR",
      image_url: null,
      stock_status: "in_stock",
      section_id: "sec-watches",
      description:
        "Swiss automatic · hand-wound · sapphire crystal · classic military dial · box + papers.",
    },
  ],
};
