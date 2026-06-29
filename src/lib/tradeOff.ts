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
  { slug: "concrete-finisher", label: "Concrete Finisher", category_slug: "concrete" },
  // Stair installation — fitting service for staircases (labour
  // only; manufacture + sales are separate slugs). Slug kept as
  // stair-fitter so existing URLs / listings keep working.
  { slug: "stair-fitter", label: "Stair Installation", category_slug: "carpentry" },
  // Kitchen installation — fitting service. Slug kept as kitchen-fitter
  // for URL stability; label clarifies the work-type.
  { slug: "kitchen-fitter", label: "Kitchen Installation", category_slug: "carpentry" },
  // Window installation — fitting service. Slug kept as window-fitter.
  { slug: "window-fitter", label: "Window Installation", category_slug: null },
  // Crane operator — site crane hire + qualified operator (CPCS / NPORS).
  { slug: "crane-operator", label: "Crane Operator", category_slug: null },
  // Security installer — CCTV, alarms, access control, intercoms.
  { slug: "security-installer", label: "Security Installer", category_slug: null },
  // Builders supplies — small specialist supply shop (distinct from the
  // larger building-merchant slug which targets multi-yard merchants).
  { slug: "builders-supplies", label: "Builders Supplies", category_slug: null },
  // Formworker — builds the timber / steel molds that hold concrete
  // pours. Distinct from concrete-specialist (placing) and
  // concrete-finisher (troweling + sealing).
  { slug: "formworker", label: "Formworker", category_slug: "concrete" },
  // Insulation installer — spray foam, cellulose, mineral wool, batt
  // insulation install for residential + commercial.
  { slug: "insulation-installer", label: "Insulation Installer", category_slug: null },
  // Trim carpenter — finish carpentry specialist: crown molding,
  // baseboards, doors, casing, built-ins. Distinct from general
  // carpenter (structural / framing).
  { slug: "trim-carpenter", label: "Trim Carpenter", category_slug: "carpentry" },
  // Block layer — concrete block / breeze block masonry, distinct from
  // bricklayer (clay/brick masonry). Common on commercial walls,
  // foundations, retaining walls.
  { slug: "block-layer", label: "Block Layer", category_slug: "bricklaying" },
  // Site safety — CDM / SMSTS / safety supervisor — temporary works,
  // toolbox talks, edge protection, scaffolding inspections.
  { slug: "site-safety", label: "Site Safety", category_slug: null },
  // Water drilling — borehole, well, ground-source water extraction +
  // diamond core drilling for service penetrations.
  { slug: "water-drilling", label: "Water Drilling", category_slug: null },
  // Fascia & soffit — uPVC + timber roofline replacement, fascias,
  // soffits, guttering. Usually paired with roofers.
  { slug: "fascia-and-soffit", label: "Fascia & Soffit", category_slug: "roofing" },
  // Demolition — controlled strip-outs, soft-strip, structural
  // demolition with plant. Includes asbestos-aware contractors.
  { slug: "demolition", label: "Demolition", category_slug: null },
  // Site canteen — mobile catering vans + on-site kitchen services
  // for construction crews. Breakfast rolls, bacon butties, hot meals.
  { slug: "site-canteen", label: "Site Canteen", category_slug: null },

  // ─── Phase 2 expansion — Trade Service additions ────────────────
  { slug: "damp-proofer", label: "Damp Proofer", category_slug: null },
  { slug: "drainage-engineer", label: "Drainage Engineer", category_slug: null },
  { slug: "chimney-sweep", label: "Chimney Sweep", category_slug: null },
  { slug: "tree-surgeon", label: "Tree Surgeon", category_slug: null },
  { slug: "pest-control", label: "Pest Control", category_slug: null },
  { slug: "asbestos-removal", label: "Asbestos Removal", category_slug: null },
  { slug: "lead-worker", label: "Lead Worker", category_slug: "roofing" },
  { slug: "sash-window-restorer", label: "Sash Window Restorer", category_slug: null },
  { slug: "post-construction-cleaner", label: "Post-Construction Cleaner", category_slug: null },
  { slug: "garden-designer", label: "Garden Designer", category_slug: null },
  // Mobile mechanic — on-site fleet + plant servicing. Mobile vans
  // visiting construction sites to fix excavators, telehandlers,
  // tippers, etc. Distinct from a workshop-based car mechanic.
  { slug: "mobile-mechanic", label: "Mobile Mechanic", category_slug: null },
  // Water pump service — borehole, basement sump, sewage and
  // booster pump installation + servicing. Common in groundworks
  // and after-flood remediation.
  { slug: "pump-service", label: "Water Pump Service", category_slug: "plumbing" },

  // ─── Trade Installation additions ─────────────────────────────────
  { slug: "door-fitter", label: "Door Fitter", category_slug: "carpentry" },
  { slug: "flooring-installer", label: "Flooring Installer", category_slug: null },
  { slug: "bathroom-fitter", label: "Bathroom Fitter", category_slug: "plumbing" },
  { slug: "conservatory-installer", label: "Conservatory Installer", category_slug: null },
  { slug: "solar-installer", label: "Solar Installer", category_slug: "electrical" },
  { slug: "ev-charger-installer", label: "EV Charger Installer", category_slug: "electrical" },
  { slug: "heat-pump-installer", label: "Heat Pump Installer", category_slug: "plumbing" },
  { slug: "smart-home-installer", label: "Smart Home Installer", category_slug: "electrical" },
  { slug: "garage-door-installer", label: "Garage Door Installer", category_slug: null },
  { slug: "gutter-installer", label: "Gutter Installer", category_slug: "roofing" },
  { slug: "driveway-installer", label: "Driveway & Patio Installer", category_slug: null },
  { slug: "fencing-installer", label: "Fencing Installer", category_slug: null },
  { slug: "shutter-installer", label: "Shutter Installer", category_slug: null },
  { slug: "aerial-satellite-installer", label: "Aerial & Satellite Installer", category_slug: "electrical" },
  { slug: "garden-room-installer", label: "Garden Room Installer", category_slug: null },
  { slug: "awning-installer", label: "Awning & Canopy Installer", category_slug: null },

  // ─── Manufacture additions ────────────────────────────────────────
  // Manufacture-side cards — labels follow the Sales / Manufacture /
  // Installation triplet so a topic (Kitchen, Stairs, Doors…) reads
  // as a coherent 3-card row in the gallery.
  { slug: "kitchen-manufacturer", label: "Kitchen Manufacture", category_slug: "carpentry" },
  { slug: "staircase-manufacturer", label: "Staircase Manufacture", category_slug: "carpentry" },
  { slug: "door-manufacturer", label: "Door Manufacture", category_slug: "carpentry" },
  { slug: "window-manufacturer", label: "Window Manufacture", category_slug: null },
  { slug: "flooring-manufacturer", label: "Flooring Manufacture", category_slug: null },
  { slug: "conservatory-manufacturer", label: "Conservatory Manufacture", category_slug: null },
  { slug: "wardrobe-maker", label: "Wardrobe & Fitted Furniture Maker", category_slug: "carpentry" },
  { slug: "furniture-maker", label: "Bespoke Furniture Maker", category_slug: "carpentry" },
  { slug: "joinery-workshop", label: "Joinery Workshop", category_slug: "carpentry" },
  { slug: "worktop-manufacturer", label: "Worktop Manufacturer", category_slug: null },
  { slug: "glass-manufacturer", label: "Glass & Glazing Manufacturer", category_slug: null },
  { slug: "shed-manufacturer", label: "Shed & Summerhouse Manufacturer", category_slug: null },
  { slug: "garden-room-manufacturer", label: "Garden Room Manufacturer", category_slug: null },
  { slug: "steel-fabricator", label: "Steel Fabricator", category_slug: null },

  // ─── Trade Product Sales additions ───────────────────────────────
  { slug: "timber-merchant", label: "Timber Merchant", category_slug: null },
  { slug: "plumbing-merchant", label: "Plumbing Merchant", category_slug: "plumbing" },
  { slug: "electrical-wholesaler", label: "Electrical Wholesaler", category_slug: "electrical" },
  // Sales-side cards — labels normalised to the same Sales pattern so
  // each topic shows up as a coherent 3-card row in the gallery.
  // Slugs kept as *-showroom / *-shop for URL stability.
  { slug: "tile-shop", label: "Tile Sales", category_slug: "tiling" },
  { slug: "flooring-shop", label: "Flooring Sales", category_slug: null },
  { slug: "door-showroom", label: "Door Sales", category_slug: null },
  { slug: "kitchen-showroom", label: "Kitchen Sales", category_slug: null },
  { slug: "window-showroom", label: "Window Sales", category_slug: null },
  { slug: "bathroom-showroom", label: "Bathroom Sales", category_slug: null },
  { slug: "paint-merchant", label: "Paint & Decorators Merchant", category_slug: "painting" },
  { slug: "ironmongery", label: "Ironmongery", category_slug: null },
  { slug: "ppe-supplier", label: "PPE & Safety Equipment Supplier", category_slug: null },
  { slug: "tool-shop", label: "Tool Shop / Hardware Store", category_slug: null },
  { slug: "landscape-supplies", label: "Landscape Supplies", category_slug: null },
  { slug: "aggregate-supplier", label: "Aggregate Supplier", category_slug: null },
  { slug: "roofing-supplies", label: "Roofing Supplies", category_slug: "roofing" },
  { slug: "insulation-supplies", label: "Insulation Supplies", category_slug: null },

  // ─── Hire / Rental additions ─────────────────────────────────────
  { slug: "plant-hire", label: "Plant Hire", category_slug: null },
  { slug: "skip-hire", label: "Skip Hire", category_slug: null },
  { slug: "portaloo-hire", label: "Portaloo & Welfare Hire", category_slug: null },
  { slug: "scaffolding-hire", label: "Scaffolding Hire", category_slug: "scaffolding" },
  { slug: "generator-hire", label: "Generator Hire", category_slug: null },
  { slug: "van-hire", label: "Van & Truck Hire", category_slug: null },
  { slug: "crane-hire", label: "Crane Hire", category_slug: null },
  { slug: "waste-removal", label: "Waste Removal & Grab Hire", category_slug: null },
  { slug: "minidigger-hire", label: "Mini-digger Hire", category_slug: null },
  { slug: "storage-container-hire", label: "Storage & Container Hire", category_slug: null }
];

export function tradeLabel(slug: string): string {
  return TRADE_OFF_TRADES.find((t) => t.slug === slug)?.label ?? slug;
}

// Trades whose customers BUY from a catalogue rather than book labour by
// the hour — merchants, hire firms, and product-configurable installers.
// These auto-get Shop Mode on the £14.99/mo paid tier so the profile is
// "complete" rather than nickel-and-diming a category whose whole job is
// to sell tangible items. Verified £20/mo unlocks unlimited products;
// paid £14.99/mo caps at 200 products.
//
// Rule of thumb: "trades whose customers buy products, not book hours."
// Adding to this list dilutes the merchant framing — be selective.
export const MERCHANT_GRADE_TRADES: ReadonlySet<string> = new Set([
  "building-merchant",
  "builders-supplies",
  "kitchen-fitter",
  "stair-fitter",
  "window-fitter",
  "security-installer",
  "tool-hire",
  "heavy-machinery"
]);

export function isMerchantGradeTrade(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return MERCHANT_GRADE_TRADES.has(slug);
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
  const message = `Hi ${displayName}, I found your profile on xratedtrade.com. I'd like a quote for some ${tradeLabelText.toLowerCase()} work.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

// Trade Center Picks — dedicated pick-detail WhatsApp deeplink. Pre-fills
// a short, friendly enquiry that references the EXACT promo banner the
// customer landed on (status + product), so the merchant doesn't have to
// guess which pick is being discussed. Used by the "Enquire on WhatsApp"
// CTA on /<slug>/picks/<pickId>.
export function whatsappPickEnquiryUrl(
  whatsapp: string,
  displayName: string,
  productName: string,
  statusLabel: string
): string {
  const digits = whatsappDigits(whatsapp);
  const firstName = displayName.split(/\s+/)[0] ?? displayName;
  const message = `Hi ${firstName}, I'm interested in your "${statusLabel}" offer on ${productName}. Can you confirm availability + delivery to my postcode? — [Xrated]`;
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
  // Seed profiles use a `demo-` prefix (e.g. demo-stuart-kingsley-...).
  // Block real signups from squatting that namespace so the seed set
  // stays the canonical preview-only surface.
  if (s.startsWith("demo-")) return true;
  return false;
}
