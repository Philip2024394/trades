// Key Cutting service — shared types + defaults used by the public
// sub-page, the merchant editor, and the profile hero-adjacent card.

export type KeyCategorySlug =
  | "cylinder"
  | "mortice"
  | "padlock"
  | "dimple"
  | "restricted"
  | "car_mechanical"
  | "car_transponder"
  | "car_remote";

export const KEY_CATEGORIES: {
  slug: KeyCategorySlug;
  label: string;
  short_desc: string;
  default_price_pence: number;
  emoji: string;
  /** Default state for the cart-purchases toggle. On for standardised
   *  categories where quantity is meaningful and the customer knows what
   *  they need. Off for the three verification-heavy categories. */
  cart_default_on: boolean;
}[] = [
  {
    slug: "cylinder",
    label: "Standard cylinder",
    short_desc: "Yale, Union euro — front doors, back doors, uPVC.",
    default_price_pence: 600,
    emoji: "🔑",
    cart_default_on: true
  },
  {
    slug: "mortice",
    label: "Mortice (Chubb-style)",
    short_desc: "Older wooden doors, back gates, sheds.",
    default_price_pence: 800,
    emoji: "🗝️",
    cart_default_on: true
  },
  {
    slug: "padlock",
    label: "Padlock, garage & filing",
    short_desc: "Padlock keys, garage door, filing cabinet, plant equipment.",
    default_price_pence: 600,
    emoji: "🔐",
    cart_default_on: true
  },
  {
    slug: "dimple",
    label: "Dimple / laser",
    short_desc: "Modern high-security keys (Mul-T-Lock Classic, EVVA).",
    default_price_pence: 1800,
    emoji: "⚙️",
    cart_default_on: true
  },
  {
    slug: "restricted",
    label: "Restricted / high-security",
    short_desc: "Mul-T-Lock, EVVA, ASSA Abloy — authorised dealer only.",
    default_price_pence: 2500,
    emoji: "🛡️",
    cart_default_on: false
  },
  {
    slug: "car_mechanical",
    label: "Car key — mechanical",
    short_desc: "Older cars (pre-1998) without a chip.",
    default_price_pence: 2000,
    emoji: "🚗",
    cart_default_on: true
  },
  {
    slug: "car_transponder",
    label: "Car key — transponder / chip",
    short_desc: "Bring the vehicle + V5C logbook. 30-90 mins on-site.",
    default_price_pence: 9000,
    emoji: "🔋",
    cart_default_on: false
  },
  {
    slug: "car_remote",
    label: "Car key — remote / laser",
    short_desc: "Book in advance. BMW, Audi, VAG group specialists.",
    default_price_pence: 18000,
    emoji: "📡",
    cart_default_on: false
  }
];

/** Resolve whether the merchant has cart purchasing enabled on a
 *  given category. Falls back to the meta default when the merchant
 *  hasn't touched the toggle. */
export function isCategoryCartEnabled(
  cfg: Partial<KeyCategoryConfig> | undefined,
  meta: (typeof KEY_CATEGORIES)[number]
): boolean {
  if (cfg?.cart_enabled === true) return true;
  if (cfg?.cart_enabled === false) return false;
  return meta.cart_default_on;
}

export type KeyCategoryConfig = {
  enabled: boolean;
  price_from_pence: number | null;
  note: string;
  cart_enabled?: boolean;
  // Sub-key-types the merchant cuts under this category. E.g. under
  // "Standard cylinder" a merchant might list: ["Yale front door",
  // "Union euro cylinder", "UPVC door lock"]. Renders as chips on the
  // public tile — huge SEO win because customers search for specific
  // key names. Blank array hides the sub-list.
  sub_types?: string[];
  // Per-category tile image. URL paste or upload from the editor.
  // Blank falls back to the category's emoji glyph.
  image_url?: string;
};

export type BulkTier = {
  min_qty: number;
  label: string; // e.g. "5% off" or "10% discount" or "WhatsApp for quote"
};

export type KeyFaq = { q: string; a: string };

// One brand row in the "Brands we work with" section. `name` is the
// text label; `logo_url` is optional — when set, renders as a
// transparent logo image, otherwise falls back to the text pill.
export type KeyBrand = { name: string; logo_url?: string | null };

export type KeyCuttingConfig = {
  categories: Partial<Record<KeyCategorySlug, KeyCategoryConfig>>;
  modes: {
    walk_in: boolean;
    photo_scan: boolean;
    postal: boolean;
  };
  machine_brand: string;
  years_cutting: number | null;
  restricted_brands: string[];
  // Free-text "how fast we cut" pill for the trust bar. Examples:
  // "Same day", "Ready in 5 minutes", "24h turnaround". Blank hides.
  turnaround_text: string;
  postal_address: string;
  postal_turnaround_hours: number | null;
  banner_image_url: string;
  // Side illustration next to the title row. Merchant can paste any
  // URL or upload. Blank falls back to a sensible platform default so
  // the page never renders with a missing image.
  illustration_image_url: string;
  custom_note: string;
  // 8 short trust bullets that appear as a checkmark strip near the
  // top of the sub-page. Default preset comes from TRUST_BENEFITS_PRESET.
  trust_benefits: string[];
  // Working brands the merchant cuts keys for. Renders as a logo row
  // (logo image when set, text pill fallback otherwise).
  key_brands: KeyBrand[];
  // Bulk qty tiers with copy — e.g. { min_qty: 10, label: "5% off" }.
  // Rendered as a ladder on the Bulk section.
  bulk_tiers: BulkTier[];
  // "Who we serve" list — Builders, Electricians, Landlords, etc.
  trade_customers: string[];
  // FAQ questions + answers rendered as an accordion at the bottom.
  faq: KeyFaq[];
  // Promotional banner rendered ABOVE the intro row. Off by default;
  // merchant flips on for flash offers like "Cut 3 keys, get 4th half
  // price" or "Free key ring with every cut this weekend".
  promo_banner: {
    enabled: boolean;
    text: string;
    cta_label: string;
    cta_href: string;
  };
  // H1 override — blank uses "Unlock Quality With Each Turn".
  headline_text: string;
  // Section heading overrides. Blank falls back to platform default.
  section_headings: {
    trust_benefits: string;
    brands: string;
    what_we_cut: string;
    how_to_get: string;
    bulk: string;
    trade_customers: string;
    related_products: string;
    faq: string;
  };
  // Explanatory paragraphs under "What we cut". Empty array uses the
  // 3 platform-default paragraphs; any user-set array wins wholesale.
  explanatory_paragraphs: string[];
  // Custom body for each of the three fulfilment mode tiles. Blank
  // uses the platform default sentence.
  mode_bodies: {
    walk_in: string;
    photo_scan: string;
    postal: string;
  };
  // Which merchant_category slugs drive the "While you're here"
  // cross-sell. Empty array uses the platform defaults (padlocks,
  // nuts_bolts_screws, hand_tools).
  related_product_categories: string[];
};

// ─── PRESETS — used to seed a new merchant + suggest in the editor ──

export const TRUST_BENEFITS_PRESET: string[] = [
  "Fast Service",
  "Precision Cut",
  "Experienced Staff",
  "Affordable Prices",
  "Most Key Types Available",
  "Tested Before Leaving",
  "While You Wait",
  "Commercial & Domestic"
];

export const KEY_BRANDS_PRESET: KeyBrand[] = [
  { name: "Yale",          logo_url: "https://ik.imagekit.io/9mrgsv2rp/Untitledasdasd-removebg-preview%20(1).png" },
  { name: "ERA",           logo_url: "https://ik.imagekit.io/9mrgsv2rp/Untitledasdasdsddsd.png" },
  { name: "Union",         logo_url: null },
  { name: "Chubb",         logo_url: "https://ik.imagekit.io/9mrgsv2rp/Untitledsadassss.png" },
  { name: "Legge",         logo_url: "https://ik.imagekit.io/9mrgsv2rp/Untitledsadassssd.png" },
  { name: "Asec",          logo_url: "https://ik.imagekit.io/9mrgsv2rp/Untitledsadassssddsd.png" },
  { name: "Master Lock",   logo_url: null },
  { name: "Burg-Wächter",  logo_url: "https://ik.imagekit.io/9mrgsv2rp/Untitledsadassssddsddsd.png" },
  { name: "Silca",         logo_url: "https://ik.imagekit.io/9mrgsv2rp/Untitledsadassssddsddsdd.png" },
  { name: "JMA",           logo_url: "https://ik.imagekit.io/9mrgsv2rp/Untitledsadassssddsddsddd.png" },
  { name: "Lowe & Fletcher", logo_url: "https://ik.imagekit.io/9mrgsv2rp/Untitledsadassssddsddsdddd.png" },
  { name: "Abus",          logo_url: "https://ik.imagekit.io/9mrgsv2rp/Untitledsadassssddsddsddddf.png" }
];

export const TRADE_CUSTOMERS_PRESET: string[] = [
  "Landlords",
  "Letting Agents",
  "Schools",
  "Builders",
  "Electricians",
  "Plumbers",
  "Carpenters",
  "Joiners",
  "Roofers",
  "Scaffolders",
  "Decorators",
  "Kitchen Fitters",
  "Bathroom Installers",
  "Facilities Management",
  "Construction Companies",
  "Housing Associations",
  "Local Councils",
  "Property Developers"
];

export const BULK_TIERS_PRESET: BulkTier[] = [
  { min_qty: 10, label: "5% off" },
  { min_qty: 20, label: "10% off" },
  { min_qty: 50, label: "15% off" },
  { min_qty: 100, label: "20% off" },
  { min_qty: 500, label: "WhatsApp for quote" }
];

export const FAQ_PRESET: KeyFaq[] = [
  { q: "How long does key cutting take?", a: "Standard cylinder, mortice and padlock keys are cut in 2-5 minutes over the counter. Dimple and laser keys take a few minutes longer. Car keys with transponders need 30-90 minutes with the vehicle present." },
  { q: "How accurate is your cutting?", a: "Every key is cut by a computer-guided machine to the manufacturer's original code depth, then tested in a lock before leaving the counter. If it doesn't turn cleanly first time, we recut at no charge." },
  { q: "Can worn keys be copied?", a: "Yes, if the bitting is still visible. If a key is badly worn we'll take extra time to read the depths against a fresh blank, or offer to cut to code using the manufacturer's key number if you have it." },
  { q: "Can broken keys be copied?", a: "Yes — bring in the pieces. If both halves are present we can copy the full bitting. If only part is present we'll cut to code where possible, or refer you to a locksmith for lock removal." },
  { q: "Can I cut multiple copies?", a: "Yes. Bulk-order discounts kick in at 10, 20, 50, 100 and 500 keys — landlords, letting agents and site managers use this every week. See the Bulk section below for pricing." },
  { q: "Do I need ID?", a: "No ID needed for standard house, mortice, padlock or cabinet keys. Restricted / high-security keys (Mul-T-Lock, EVVA, ASSA) require your authorisation card or signed dealer letter." },
  { q: "What if the copied key doesn't work?", a: "Bring it back within 30 days with the original. We'll recut it or replace it free of charge. Almost every issue is a worn original — we test both keys in a lock before you leave to prevent this." },
  { q: "Can you copy security keys?", a: "Yes for standard dimple keys (Mul-T-Lock Classic, EVVA basic). Restricted / high-security systems can only be cut with the customer's authorisation card — patented profile, controlled by the manufacturer." },
  { q: "Can you copy vehicle keys?", a: "Yes. Mechanical car keys (older cars, pre-1998) are cut over the counter. Transponder/chip keys need the vehicle and V5C logbook for programming — book in advance. Remote/laser keys require a specialist appointment 24-48 hours ahead." },
  { q: "How much does it cost?", a: "See the pricing on each category above. Standard house keys from £5.99, mortice from £7.99, dimple from £18, car transponder from £90. Restricted and remote car keys are priced individually — WhatsApp us for a quote." }
];

/** Blank starting config used when a merchant has never saved anything. */
export function emptyKeyCuttingConfig(): KeyCuttingConfig {
  return {
    categories: {},
    modes: { walk_in: true, photo_scan: false, postal: false },
    machine_brand: "",
    years_cutting: null,
    restricted_brands: [],
    turnaround_text: "",
    postal_address: "",
    postal_turnaround_hours: 48,
    banner_image_url: "",
    illustration_image_url: "",
    custom_note: "",
    trust_benefits: [],
    key_brands: [],
    bulk_tiers: [],
    trade_customers: [],
    faq: [],
    promo_banner: { enabled: false, text: "", cta_label: "", cta_href: "" },
    headline_text: "",
    section_headings: {
      trust_benefits: "",
      brands: "",
      what_we_cut: "",
      how_to_get: "",
      bulk: "",
      trade_customers: "",
      related_products: "",
      faq: ""
    },
    explanatory_paragraphs: [],
    mode_bodies: { walk_in: "", photo_scan: "", postal: "" },
    related_product_categories: []
  };
}

/** Merge a raw DB blob with the empty default so any missing keys read
 *  cleanly on the client. Never throws. */
export function normaliseKeyCuttingConfig(raw: unknown): KeyCuttingConfig {
  const base = emptyKeyCuttingConfig();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<KeyCuttingConfig>;
  return {
    categories:
      r.categories && typeof r.categories === "object" ? r.categories : {},
    modes: {
      walk_in: r.modes?.walk_in !== false,
      photo_scan: r.modes?.photo_scan === true,
      postal: r.modes?.postal === true
    },
    machine_brand: typeof r.machine_brand === "string" ? r.machine_brand : "",
    years_cutting:
      typeof r.years_cutting === "number" && Number.isFinite(r.years_cutting)
        ? Math.max(0, Math.min(60, Math.round(r.years_cutting)))
        : null,
    restricted_brands: Array.isArray(r.restricted_brands)
      ? r.restricted_brands
          .filter((x): x is string => typeof x === "string")
          .slice(0, 8)
      : [],
    turnaround_text: typeof r.turnaround_text === "string" ? r.turnaround_text : "",
    postal_address: typeof r.postal_address === "string" ? r.postal_address : "",
    postal_turnaround_hours:
      typeof r.postal_turnaround_hours === "number"
        ? Math.max(0, Math.min(240, Math.round(r.postal_turnaround_hours)))
        : 48,
    banner_image_url: typeof r.banner_image_url === "string" ? r.banner_image_url : "",
    illustration_image_url:
      typeof r.illustration_image_url === "string" ? r.illustration_image_url : "",
    custom_note: typeof r.custom_note === "string" ? r.custom_note : "",
    trust_benefits: Array.isArray(r.trust_benefits)
      ? r.trust_benefits.filter((x): x is string => typeof x === "string").slice(0, 16)
      : [],
    key_brands: Array.isArray(r.key_brands)
      ? (r.key_brands as unknown[])
          .map((x): KeyBrand | null => {
            if (typeof x === "string") {
              // Backward compat: legacy DB rows stored plain strings.
              return { name: x, logo_url: null };
            }
            if (x && typeof x === "object") {
              const b = x as { name?: unknown; logo_url?: unknown };
              const name = typeof b.name === "string" ? b.name.slice(0, 40) : "";
              if (!name) return null;
              const logo = typeof b.logo_url === "string" ? b.logo_url.slice(0, 800) : null;
              return { name, logo_url: logo && logo.length > 0 ? logo : null };
            }
            return null;
          })
          .filter((b): b is KeyBrand => b !== null)
          .slice(0, 20)
      : [],
    bulk_tiers: Array.isArray(r.bulk_tiers)
      ? r.bulk_tiers
          .filter((x): x is BulkTier => !!x && typeof x === "object" && typeof (x as BulkTier).min_qty === "number" && typeof (x as BulkTier).label === "string")
          .map((t) => ({ min_qty: Math.max(1, Math.round(t.min_qty)), label: t.label.slice(0, 60) }))
          .slice(0, 10)
      : [],
    trade_customers: Array.isArray(r.trade_customers)
      ? r.trade_customers.filter((x): x is string => typeof x === "string").slice(0, 30)
      : [],
    faq: Array.isArray(r.faq)
      ? r.faq
          .filter((x): x is KeyFaq => !!x && typeof x === "object" && typeof (x as KeyFaq).q === "string" && typeof (x as KeyFaq).a === "string")
          .map((f) => ({ q: f.q.slice(0, 200), a: f.a.slice(0, 1200) }))
          .slice(0, 20)
      : [],
    promo_banner: r.promo_banner && typeof r.promo_banner === "object"
      ? {
          enabled: (r.promo_banner as { enabled?: unknown }).enabled === true,
          text: typeof (r.promo_banner as { text?: unknown }).text === "string" ? ((r.promo_banner as { text: string }).text).slice(0, 200) : "",
          cta_label: typeof (r.promo_banner as { cta_label?: unknown }).cta_label === "string" ? ((r.promo_banner as { cta_label: string }).cta_label).slice(0, 40) : "",
          cta_href: typeof (r.promo_banner as { cta_href?: unknown }).cta_href === "string" ? ((r.promo_banner as { cta_href: string }).cta_href).slice(0, 400) : ""
        }
      : { enabled: false, text: "", cta_label: "", cta_href: "" },
    headline_text: typeof r.headline_text === "string" ? r.headline_text.slice(0, 120) : "",
    section_headings: r.section_headings && typeof r.section_headings === "object"
      ? {
          trust_benefits: typeof (r.section_headings as Record<string, unknown>).trust_benefits === "string" ? ((r.section_headings as Record<string, string>).trust_benefits).slice(0, 80) : "",
          brands: typeof (r.section_headings as Record<string, unknown>).brands === "string" ? ((r.section_headings as Record<string, string>).brands).slice(0, 80) : "",
          what_we_cut: typeof (r.section_headings as Record<string, unknown>).what_we_cut === "string" ? ((r.section_headings as Record<string, string>).what_we_cut).slice(0, 80) : "",
          how_to_get: typeof (r.section_headings as Record<string, unknown>).how_to_get === "string" ? ((r.section_headings as Record<string, string>).how_to_get).slice(0, 80) : "",
          bulk: typeof (r.section_headings as Record<string, unknown>).bulk === "string" ? ((r.section_headings as Record<string, string>).bulk).slice(0, 80) : "",
          trade_customers: typeof (r.section_headings as Record<string, unknown>).trade_customers === "string" ? ((r.section_headings as Record<string, string>).trade_customers).slice(0, 80) : "",
          related_products: typeof (r.section_headings as Record<string, unknown>).related_products === "string" ? ((r.section_headings as Record<string, string>).related_products).slice(0, 80) : "",
          faq: typeof (r.section_headings as Record<string, unknown>).faq === "string" ? ((r.section_headings as Record<string, string>).faq).slice(0, 80) : ""
        }
      : { trust_benefits: "", brands: "", what_we_cut: "", how_to_get: "", bulk: "", trade_customers: "", related_products: "", faq: "" },
    explanatory_paragraphs: Array.isArray(r.explanatory_paragraphs)
      ? r.explanatory_paragraphs.filter((x): x is string => typeof x === "string").slice(0, 6)
      : [],
    mode_bodies: r.mode_bodies && typeof r.mode_bodies === "object"
      ? {
          walk_in: typeof (r.mode_bodies as Record<string, unknown>).walk_in === "string" ? ((r.mode_bodies as Record<string, string>).walk_in).slice(0, 400) : "",
          photo_scan: typeof (r.mode_bodies as Record<string, unknown>).photo_scan === "string" ? ((r.mode_bodies as Record<string, string>).photo_scan).slice(0, 400) : "",
          postal: typeof (r.mode_bodies as Record<string, unknown>).postal === "string" ? ((r.mode_bodies as Record<string, string>).postal).slice(0, 400) : ""
        }
      : { walk_in: "", photo_scan: "", postal: "" },
    related_product_categories: Array.isArray(r.related_product_categories)
      ? r.related_product_categories.filter((x): x is string => typeof x === "string").slice(0, 20)
      : []
  };
}

/** Enabled category slugs in the canonical order KEY_CATEGORIES lists them. */
export function enabledCategorySlugs(cfg: KeyCuttingConfig): KeyCategorySlug[] {
  const out: KeyCategorySlug[] = [];
  for (const meta of KEY_CATEGORIES) {
    const c = cfg.categories[meta.slug];
    if (c?.enabled) out.push(meta.slug);
  }
  return out;
}

/** Merchant considers the add-on "meaningfully configured" when they've
 *  enabled at least one category AND at least one fulfilment mode.
 *  Prevents the public sub-page + hero card rendering with an empty
 *  ghost state. */
export function isKeyCuttingConfigured(cfg: KeyCuttingConfig): boolean {
  const anyCat = enabledCategorySlugs(cfg).length > 0;
  const anyMode = cfg.modes.walk_in || cfg.modes.photo_scan || cfg.modes.postal;
  return anyCat && anyMode;
}

export function formatPriceFrom(pence: number | null | undefined): string {
  if (!pence || pence <= 0) return "POA";
  const pounds = pence / 100;
  return pounds % 1 === 0
    ? `from £${pounds}`
    : `from £${pounds.toFixed(2)}`;
}
