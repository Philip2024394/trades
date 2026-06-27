// Trade Off — shared constants used by the directory pages, signup wizard,
// API routes, and the auto-Hammerex-Standard badge logic.

export const TRADE_OFF_TRADES: Array<{
  slug: string;
  label: string;
  category_slug: string | null;
}> = [
  { slug: "drywaller", label: "Drywaller", category_slug: "drywall" },
  { slug: "plasterer", label: "Plasterer", category_slug: "plastering" },
  { slug: "electrician", label: "Electrician", category_slug: "electrical" },
  { slug: "scaffolder", label: "Scaffolder", category_slug: "scaffolding" },
  { slug: "tiler", label: "Tiler", category_slug: "tiling" },
  { slug: "plumber", label: "Plumber", category_slug: "plumbing" },
  { slug: "carpenter", label: "Carpenter", category_slug: "carpentry" },
  { slug: "joiner", label: "Joiner", category_slug: "carpentry" },
  { slug: "painter", label: "Painter & Decorator", category_slug: "painting" },
  { slug: "roofer", label: "Roofer", category_slug: "roofing" },
  { slug: "bricklayer", label: "Bricklayer", category_slug: "bricklaying" },
  { slug: "stonemason", label: "Stonemason", category_slug: null },
  { slug: "groundworker", label: "Groundworker", category_slug: null },
  { slug: "general-builder", label: "General Builder", category_slug: null },
  { slug: "concrete-specialist", label: "Concrete Specialist", category_slug: "concrete" },
  { slug: "renderer", label: "Renderer", category_slug: "plastering" },
  { slug: "taper-and-finisher", label: "Taper & Finisher", category_slug: "drywall" },
  // Building merchant — supply side of construction, not a trade in the
  // boots-on-site sense, but registers as a slug so Wholesale Mode +
  // Materials Network audiences can sign up with their own profile.
  { slug: "building-merchant", label: "Building Merchant", category_slug: null },
  // Metal engineer — welders, fabricators, structural-steel work.
  { slug: "metal-engineer", label: "Metal Engineer", category_slug: null },
  // Heavy site machinery — plant hire, excavator / crane / digger
  // operators, site equipment rental.
  { slug: "heavy-machinery", label: "Heavy Site Machinery", category_slug: null },
  // Tool hire — hand tools, power tools, access kit rental.
  { slug: "tool-hire", label: "Tool Hire", category_slug: null },
  // Landscaper — garden design, turfing, patios, planting.
  { slug: "landscaper", label: "Landscaper", category_slug: null },
  // Gas engineer — Gas Safe regulated work, boilers, gas installation.
  { slug: "gas-engineer", label: "Gas Engineer", category_slug: null },
  // Concrete finisher — troweling, polishing, sealing (distinct from
  // the existing concrete-specialist which does formwork + placing).
  { slug: "concrete-finisher", label: "Concrete Finisher", category_slug: "concrete" }
];

export function tradeLabel(slug: string): string {
  return TRADE_OFF_TRADES.find((t) => t.slug === slug)?.label ?? slug;
}

// Hammerex Standard product blurbs.
// Keyed by product slug. When a tradesperson's listing email/phone matches a
// past quote-request that included one of these products, the badge appears
// on their profile with the matching blurb.
export const HAMMEREX_STANDARD_BLURBS: Record<string, string> = {
  "k9-plastering-tool-station":
    "Owns the Hammerex K9 Plastering Tool Station — trowels, hawk, and finishing kit stored properly, not piled in a bucket. A sign of pride in the tools and a working standard most trades drop after their second site.",
  "k11-drywall-tool-station":
    "Owns the Hammerex K11 Drywall Tool Station — five knife rows, mud-pan well, reinforced solid-core frame. Drywall pros who carry the K11 protect every blade and take pride in their craft.",
  "scaffolders-setup-kit":
    "Owns the Hammerex Scaffolders Setup Kit — full belt + bag + lanyard system. Scaffolders who carry the Hammerex setup are kitted out properly for the trade.",
  "electrician-pro-pouch":
    "Owns the Hammerex Electrician Pro Pouch — a professional-grade pouch for the on-site spark. Sparks who carry it take their kit seriously.",
  "plastering-pro-bag":
    "Owns the Hammerex Plastering Pro Bag — a full plastering site bag, not a flimsy carry-box. The choice of plasterers who protect their trowels.",
  "drywall-pro-kit":
    "Owns the Hammerex Drywall Pro Kit — a purpose-built drywall site bag. Pride in tools, pride in finish."
};

export const STANDARD_TIER_LABELS = {
  base: "Hammerex Standard Verified",
  master: "Hammerex Standard — Master",
  masterPlus: "Hammerex Standard — Master Plus"
} as const;

export function standardTierFor(productCount: number): keyof typeof STANDARD_TIER_LABELS | null {
  if (productCount >= 3) return "masterPlus";
  if (productCount >= 2) return "master";
  if (productCount >= 1) return "base";
  return null;
}

// Slugify input for listing slug or city slug. Lower-case, hyphenated, ASCII.
export function tradeOffSlugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);
}

// Build a slug for a listing from name + city, falling back to a short uuid
// stub if both are empty (shouldn't happen — required fields).
export function buildListingSlug(displayName: string, city: string, suffix?: string): string {
  const base = [displayName, city].filter(Boolean).join("-");
  const slug = tradeOffSlugify(base);
  if (!slug) return `tradie-${suffix ?? Math.random().toString(36).slice(2, 8)}`;
  return suffix ? `${slug}-${suffix}` : slug;
}

// Format a WhatsApp number digits-only for wa.me URLs.
export function whatsappDigits(input: string): string {
  return input.replace(/[^0-9]/g, "");
}

export function whatsappQuoteUrl(whatsapp: string, displayName: string, tradeLabelText: string): string {
  const digits = whatsappDigits(whatsapp);
  const message = `Hi ${displayName}, I found your profile on Hammerex Trade Off. I'd like a quote for some ${tradeLabelText.toLowerCase()} work.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export const TRADE_OFF_REQUIRED_FIELDS = [
  "display_name",
  "primary_trade",
  "city",
  "whatsapp",
  "email",
  "bio"
] as const;

export type TradeOffStatus = "draft" | "live" | "hidden";

// Reserved slugs that tradies cannot claim as their vanity URL.
// Anything matching these — or shorter than 5 / longer than 60 chars — is
// rejected by /api/trade-off/slug-available and by the create/update APIs.
// The 5-char floor matches xratedSlug.SLUG_MIN_LENGTH; bumped from 3
// because 3-char vanity URLs tend to be route-collision-prone and rank
// poorly on Google.
export const TRADE_OFF_RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "signup",
  "edit",
  "admin",
  "done",
  "api",
  "t",
  "trade",
  "trade-off",
  "tradeoff",
  // Reserved because /trade/<these> are existing B2B portal sub-paths
  "auth",
  "cart",
  "catalogue",
  "checkout",
  "order",
  "settings",
  "login",
  "logout",
  "register",
  "new",
  "search",
  "explore",
  "about",
  "help",
  "support",
  "terms",
  "privacy",
  "report",
  "hammerex",
  "standard",
  "verified"
]);

export function isReservedSlug(slug: string): boolean {
  const s = slug.toLowerCase().trim();
  if (s.length < 5 || s.length > 60) return true;
  if (TRADE_OFF_RESERVED_SLUGS.has(s)) return true;
  if (!/^[a-z0-9-]+$/.test(s)) return true;
  if (s.startsWith("-") || s.endsWith("-")) return true;
  if (s.includes("--")) return true;
  return false;
}
