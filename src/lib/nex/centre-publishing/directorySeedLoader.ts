// Directory seed loader — reads the file-based seed listings under
// data/directory-seeds/**/*.json and converts each into a
// CentreFeedItem so the NEX Centre feed can surface them alongside
// real merchant products.
//
// This is the runtime bridge between ADR-0023's file-based seed
// staging and the live /nex-app/centre page. When a listing is
// pasted, its JSON file lands under data/directory-seeds/<town>/,
// and this loader picks it up on the next feed request — no
// database migration required.
//
// Once the thenetworkers → NEX image library migration is complete,
// map each seed's hero image URL in the conversion below.

import { promises as fs } from "node:fs";
import path from "node:path";
import type { CentreFeedItem, MerchantVerificationLevel } from "./types";
import { matchImage, applyCardCrop } from "./imageMatcher";

// ─────────────────────────────────────────────────────────────────────
// Refacing-specific optional extensions (2026-08-13 · per Philip spec).
// All additive · existing seeds without these fields keep working.
// Applies primarily to Staircase Refacing seeds but the shape is generic
// enough to reuse for other trade categories that need capability tagging
// + evidence + qualification scoring + email verification + claim lifecycle.

/** Capability answer · one of yes/no/unknown. Absent = unknown by default. */
export type CapabilityAnswer = "yes" | "no" | "unknown";

/** Refacing-specific capability set. Extendable · unknown keys are ignored.
 *  Philip 2026-08-13 · added `staircase_manufacture` and `bespoke_joinery`
 *  so one company record can hold multiple services (a single business may
 *  manufacture NEW staircases AND refurbish EXISTING ones — never create
 *  duplicate records for different services offered by the same trade). */
export type RefacingCapabilityKey =
  | "staircase_manufacture"
  | "staircase_refurbishment"
  | "staircase_refacing"
  | "staircase_covering"
  | "staircase_cladding"
  | "overcladding"
  | "tread_replacement"
  | "riser_replacement"
  | "tread_and_riser_replacement"
  | "handrail"
  | "baserail"
  | "newel"
  | "baluster"
  | "spindle"
  | "glass_balustrade"
  | "stainless_steel_balustrade"
  | "metal_balustrade"
  | "sanding"
  | "staining"
  | "painting"
  | "varnishing"
  | "restoration"
  | "repair"
  | "installation"
  | "bespoke_joinery";

export type RefacingEvidenceItem = {
  url: string;
  type:
    | "company_website"
    | "contact_page"
    | "services_page"
    | "trade_directory"
    | "checkatrade"
    | "yell"
    | "trustpilot"
    | "rated_people"
    | "bark"
    | "houzz"
    | "mybuilder"
    | "google_business_profile"
    | "other";
  category:
    | "staircase_refacing"
    | "staircase_refurbishment"
    | "staircase_renovation"
    | "staircase_restoration"
    | "staircase_covering"
    | "staircase_cladding"
    | "tread_replacement"
    | "riser_replacement"
    | "balustrade_replacement"
    | "component_replacement"
    | "finishing"
    | "installation"
    | "other";
  summary: string;
  checked_at: string; // ISO date YYYY-MM-DD
};

export type RefacingQualification = "A+" | "A" | "B" | "C" | "excluded";

export type LifecycleStatus =
  | "unclaimed"
  | "contacted"
  | "interested"
  | "claim_requested"
  | "claim_pending"
  | "claimed"
  | "verified_partner";

/**
 * Tri-state email verification (Philip 2026-08-13).
 *   verified                   · 🟢 public business email confirmed
 *   needs_manual_verification  · 🟡 email appears to exist (visible on site or in
 *                                    directory profile) but couldn't be reliably
 *                                    extracted — e.g. fetch masked it, JS-rendered,
 *                                    or displayed as image / mailto-only
 *   not_found                  · 🔴 no public business email located after search
 *
 * `email_verified: boolean` (existing field) remains for backwards compat and is
 * derived from `email_status === "verified"`. Both are stored on the row so legacy
 * code paths reading `email_verified` continue to work.
 */
export type EmailStatus = "verified" | "needs_manual_verification" | "not_found";

/**
 * Derive email_status from legacy fields for seeds that predate the tri-state.
 * Pure function · never mutates the input. Used by the loader to guarantee every
 * seed exposes a status even before the field is explicitly set.
 */
export function deriveEmailStatus(seed: Pick<DirectorySeed, "email" | "email_verified" | "email_status">): EmailStatus {
  if (seed.email_status) return seed.email_status;
  if (!seed.email || !seed.email.trim()) return "not_found";
  return seed.email_verified ? "verified" : "needs_manual_verification";
}

/**
 * DirectoryState (Philip 2026-08-13) · fundamental progression a seed moves
 * through inside the NEX Refacing Trade Exchange model.
 *
 *   "listed"       — discovered/imported · basic info stored · NOT independently verified
 *   "verified"     — NEX has independently verified the directory info (contact accuracy ·
 *                    evidence of refacing work · currently operating) · still unclaimed
 *   "claimed"      — business owner has claimed the listing via the shared claim flow
 *   "paid_member"  — active paying NEX Trade Center member · eligible to receive routed
 *                    homeowner opportunities from the Refacing Trade Exchange
 *
 * DISTINCT FROM:
 *   · `verified: boolean` (existing seed field) — the verified BADGE on the merchant
 *     card. Only earned via the claim + verification workflow. Never true just because
 *     NEX did internal directory verification.
 *   · `lifecycle_status` — granular 7-step claim funnel (contacted · interested · etc).
 *     A seed can be `directory_state = "verified"` while `lifecycle_status = "contacted"`.
 *   · `refacing_qualification` (A+/A/B/C) — evidence-based scoring, independent axis.
 *
 * PROGRESSION RULE: forward-only. Never downgrade without an audit trail entry in
 * `refacing_evidence[]`. Only `paid_member` records are eligible for routed opportunities.
 */
export type DirectoryState =
  | "listed"
  | "verified"
  | "claimed"
  | "paid_member";

export type EmailSource =
  | "company_website"
  | "contact_page"
  | "services_page"
  | "trade_directory"
  | "checkatrade"
  | "yell"
  | "trustpilot"
  | "google_business_profile"
  | "other";

export type DirectorySeed = {
  id: string;
  slug: string;
  business_name: string;
  category: string | null;
  primary_trade: string;
  address_line_1: string | null;
  address_line_2: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
  country: string;
  /** Country-scoped region · UK county, Irish county, or US state code.
   *  Free-text (migration 053 dropped the CHECK constraint). */
  region: string | null;
  telephone: string | null;
  website: string | null;
  email: string | null;
  opening_hours: unknown;
  description: string | null;
  services: string[];
  google_rating: number | null;
  google_review_count: number | null;
  google_maps_url: string | null;
  latitude: number | null;
  longitude: number | null;
  tags: string[];
  status: string;
  claimed: boolean;
  verified: boolean;
  visibility: string;
  photos: string[];
  cover_image: string | null;
  source: string;
  imported_at: string;

  // ── Refacing-specific optional extensions (2026-08-13) ──────────────
  /** Capability tagging. Keys not listed default to "unknown". */
  capabilities?: Partial<Record<RefacingCapabilityKey, CapabilityAnswer>>;
  /** Evidence records for why this trade qualifies · at least 1 recommended for A+/A. */
  refacing_evidence?: RefacingEvidenceItem[];
  /** Qualification score · null if not yet assessed. */
  refacing_qualification?: RefacingQualification;
  /** Where the email was found · null when email is null. */
  email_source?: EmailSource | null;
  /** Whether the email has been human-verified as a working business address. */
  email_verified?: boolean;
  /** ISO date the email was last checked. */
  email_checked_at?: string | null;
  /** Claim lifecycle · defaults to "unclaimed" on new seeds. */
  lifecycle_status?: LifecycleStatus;
  /** When the seed data (services · rating · contact) was last re-verified. */
  last_verified_at?: string | null;
  /** Fundamental Refacing-Exchange progression · defaults to "listed" on new seeds.
   *  Only "paid_member" records are eligible for routed homeowner opportunities. */
  directory_state?: DirectoryState;
  /** Tri-state email verification (Philip 2026-08-13). See EmailStatus doc above.
   *  Optional for backwards compat · deriveEmailStatus() fills in for legacy seeds. */
  email_status?: EmailStatus;
};

/**
 * Routing eligibility helper (Philip 2026-08-13 · updated same-day).
 *
 * RULE: `directory_state === "paid_member"` alone = eligible for the normal NEX
 * trade lead system. Paying for membership gives access to the core service.
 *
 * `refacing_qualification` (A+/A/B/C/excluded) is preserved as a separate
 * quality/evidence field · it may later be used for RANKING, PRIORITY, or
 * VERIFICATION display · but it must NEVER gate a legitimate paid member's
 * access to leads (that would let someone pay £14.99 and get nothing).
 *
 * Never route to unclaimed listings (`directory_state ∈ {listed, verified,
 * claimed}`) — those trades have not paid for the service.
 *
 * Prior version (deprecated 2026-08-13): required `paid_member AND (A+ OR A)`.
 * That rule broke the business model · corrected here.
 */
export function isEligibleForRefacingRouting(seed: Pick<DirectorySeed, "directory_state" | "refacing_qualification">): boolean {
  return seed.directory_state === "paid_member";
}

const SEEDS_ROOT = path.join(process.cwd(), "data", "directory-seeds");

// Philip 2026-08-02 · AI Merchant Image Intelligence v1 · trade-aware pool.
//
// IMMUTABLE RULE (Philip 2026-08-02): Nex must NEVER assign an image at
// random. The assigned image must match the merchant's actual trade and
// specialisation. A glass-staircase specialist gets glass. An oak
// manufacturer gets oak. A commercial company gets commercial work.
// A traditional joiner gets traditional. Never assign a floating
// staircase to a closed-string oak specialist.
//
// Every URL here comes from the confirmed staircase library
// (Nex001-Nex029), filtered to portraits (aspect 0.45-0.80). Each
// entry carries a tag list describing what the image ACTUALLY depicts
// (materials · style · structure · features). At match time we score
// each candidate against the merchant's text (name + description +
// services + tags + category + primary_trade) and pick the best match.
// Highest score wins; ties break deterministically on seed.id.
//
// This is v1 of a larger vision · full spec in memory
// (project_nex_ai_merchant_image_intelligence_2026_08_02.md):
// eventually per-image analytics · scheduled rotation · A/B testing ·
// merchant dashboards · AI recommendations · membership progression.
const INTERIM_STAIRCASE_POOL: ReadonlyArray<{ url: string; tags: readonly string[] }> = [
  {
    // Nex005 · Industrial · walnut · stainless-steel cable · helical spiral bespoke
    url: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2004_16_11%20AM.png",
    tags: ["walnut", "hardwood", "steel", "cable", "stainless", "industrial", "contemporary", "helical", "spiral", "bespoke", "sculptural"],
  },
  {
    // Nex011 · Contemporary oak · matte black steel · quarter-turn dog-leg
    url: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2003_21_15%20AM.png",
    tags: ["oak", "timber", "steel", "black", "painted", "contemporary", "luxury", "quarter turn", "quarter-turn", "dog leg", "dog-leg", "half turn", "half-turn"],
  },
  {
    // Nex013 · Contemporary · cable balustrade · open-riser · timber side string
    url: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2001_27_08%20AM.png",
    tags: ["walnut", "oak", "timber", "hardwood", "cable", "stainless", "contemporary", "minimalist", "straight", "open riser", "open-riser"],
  },
  {
    // Nex014 · Contemporary · frameless glass · brushed steel illuminated risers
    url: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2001_19_59%20AM.png",
    tags: ["walnut", "oak", "timber", "glass", "frameless", "stainless", "steel", "led", "illuminated", "contemporary", "minimalist", "luxury", "straight", "closed string", "closed-string"],
  },
  {
    // Nex020 · Ultra-luxury sculptural double-curved · black steel · walnut · frameless curved glass
    url: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%201,%202026,%2012_05_37%20AM.png",
    tags: ["walnut", "oak", "timber", "steel", "glass", "frameless", "curved", "helical", "sculptural", "luxury", "biophilic", "bespoke", "hospitality", "commercial", "atrium"],
  },
  {
    // Nex024 · Modern floating · timber treads · frameless glass · LED base
    url: "https://ik.imagekit.io/5vv5pw26q/Untitledxcxcdvdfsdfdfdsasddsfsdfdfsdfasdssdsasdddsfsdfdssdsddasdasd.png",
    tags: ["timber", "oak", "walnut", "ash", "hardwood", "glass", "frameless", "floating", "cantilever", "modern", "contemporary", "minimalist", "led", "luxury"],
  },
  {
    // Nex025 · Contemporary straight · black mono-stringer · timber treads · frameless glass
    url: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%202,%202026,%2001_35_12%20AM.png?updatedAt=1785609336679",
    tags: ["timber", "oak", "walnut", "steel", "black", "glass", "frameless", "contemporary", "modern", "industrial", "luxury", "straight", "mono stringer", "mono-stringer", "open riser", "open-riser"],
  },
  {
    // Nex026 · Contemporary straight · black side-stringer · dark walnut · frameless glass
    url: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%202,%202026,%2001_17_34%20AM.png?updatedAt=1785608276930",
    tags: ["walnut", "timber", "oak", "steel", "black", "glass", "frameless", "contemporary", "modern", "luxury", "straight", "floating", "open riser", "open-riser"],
  },
  {
    // Nex027 · Classic quarter-turn oak · feature landing · closed-string · painted risers
    url: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%202,%202026,%2003_12_10%20AM.png?updatedAt=1785615152201",
    tags: ["oak", "timber", "hardwood", "painted", "white", "traditional", "classic", "transitional", "family", "quarter turn", "quarter-turn", "closed string", "closed-string", "joinery", "domestic", "residential", "renovation"],
  },
  {
    // Nex028 · Modern oak open-riser · steel stringer · vertical oak slat balustrade
    url: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%202,%202026,%2002_29_45%20AM.png?updatedAt=1785612608208",
    tags: ["oak", "timber", "hardwood", "steel", "black", "modern", "scandinavian", "minimalist", "contemporary", "straight", "open riser", "open-riser", "floating"],
  },
];

/**
 * Trade-aware pool pick · Philip 2026-08-02.
 *
 * Priority order per the AI Image Intelligence rule:
 *   1. (upstream) Merchant's own uploaded project images
 *   2. (upstream) Merchant's approved hero image
 *   3. THIS FUNCTION · Nex-assigned image matching the merchant's trade
 *   4. Never assign unrelated images just to fill a card
 *
 * Scores each pool image by counting how many of its tags appear in the
 * merchant's business text. Highest score wins. Ties break deterministically
 * on seed.id so a merchant always shows the same image (brand recognition).
 * When nothing scores > 0, falls back to a deterministic hash across the
 * whole pool — still stable per merchant, still all staircase imagery.
 */
function pickInterimStaircase(seedId: string, seed?: DirectorySeed): string {
  const hash = (() => {
    let h = 0;
    for (let i = 0; i < seedId.length; i++) {
      h = ((h << 5) - h) + seedId.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  })();

  if (seed) {
    const merchantText = [
      seed.business_name,
      seed.description ?? "",
      (seed.services ?? []).join(" "),
      (seed.tags ?? []).join(" "),
      seed.category ?? "",
      seed.primary_trade ?? "",
    ].join(" ").toLowerCase();

    const scored = INTERIM_STAIRCASE_POOL.map((img) => {
      let hits = 0;
      for (const tag of img.tags) {
        if (merchantText.includes(tag.toLowerCase())) hits++;
      }
      return { url: img.url, score: hits };
    });
    scored.sort((a, b) => b.score - a.score);

    const topScore = scored[0]?.score ?? 0;
    if (topScore > 0) {
      // Break ties deterministically among equally-scored images so a
      // merchant always shows the same image but the pool distributes evenly.
      const tied = scored.filter((s) => s.score === topScore);
      return tied[hash % tied.length].url;
    }
  }

  // No seed context OR nothing matched · pure hash pick across the pool.
  return INTERIM_STAIRCASE_POOL[hash % INTERIM_STAIRCASE_POOL.length].url;
}

// Curated NEX-D-XXX → hero image URL overrides. Filled in as Philip
// sends back curated matches from the manifest. Any listing NOT in
// this map falls back to INTERIM_STAIRCASE_PLACEHOLDER above.
const CURATED_HERO_OVERRIDES: Record<string, string> = {
  // "NEX-D-001": "https://ik.imagekit.io/5vv5pw26q/...",
};

// Hero-image cache (Philip 2026-08-17). Resolving a seed's hero image
// scans the whole nex-image-manifest via matchImage() — for 375 US
// seeds × ~500 manifest rows that was 187k scoring calls per feed
// request and dominated the API wall time. The output is a pure
// function of a few immutable seed fields plus the manifest itself,
// so we memoise per seed keyed on a content signature that changes
// whenever any field feeding the matcher changes.
type HeroCacheEntry = { sig: string; url: string };
const heroCache: Map<string, HeroCacheEntry> = new Map();

function seedHeroSig(seed: DirectorySeed): string {
  return [
    seed.business_name,
    seed.description ?? "",
    (seed.services ?? []).join(","),
    (seed.tags ?? []).join(","),
    seed.category ?? "",
    seed.town ?? "",
    seed.cover_image ?? "",
  ].join("|");
}

/** Recursively collect all .json seed files under SEEDS_ROOT.
 *  Excludes any file whose name starts with underscore (index / schema). */
async function collectSeedFiles(dir: string): Promise<string[]> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSeedFiles(full)));
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".json") &&
      !entry.name.startsWith("_")
    ) {
      files.push(full);
    }
  }
  return files;
}

/** Convert a seed JSON into the shape the centre feed renders.
 *  Directory listings have no price (price_pence stays 0 — the card
 *  hides the price row when it's 0). */
function seedToFeedItem(seed: DirectorySeed): CentreFeedItem {
  // Kept for legacy · call sites now use `formatCardLocation` on the item
  // fields directly so nothing ships the literal "UK" fallback.
  const location =
    seed.town ??
    (seed.postcode ? seed.postcode.split(" ")[0] : null) ??
    "";

  // Verification level for the public card (Philip 2026-08-13):
  //   paid_member → "partner"   (unlocks NEX Chat enquiry CTA, phone shown)
  //   claimed     → "claimed"   (owned by the trade, discovery only for public)
  //   verified    → "verified"  (internally verified, discovery only for public)
  //   listed      → "listed"    (imported, discovery only for public)
  // Ordering: paid_member wins over verified/claimed since it's the strongest signal.
  const verification: MerchantVerificationLevel =
    seed.directory_state === "paid_member"
      ? "partner"
      : seed.verified
      ? "verified"
      : seed.claimed || seed.directory_state === "claimed"
      ? "claimed"
      : "listed";

  return {
    kind: "product",
    offer_id: seed.id,
    canonical_id: seed.id,
    name: seed.business_name,
    brand_name: seed.business_name,
    slug: seed.slug,
    description: seed.description,
    price_pence: 0,
    vat_rate: 0,
    stock_status: "in_stock",
    hero_image_url: seed.cover_image, // null until image library migrates
    category_path: seed.category ? [seed.category] : [],

    merchant_id: seed.id,
    merchant_slug: seed.slug,
    merchant_display_name: seed.business_name,
    merchant_city: seed.town,
    merchant_postcode_prefix: seed.postcode
      ? seed.postcode.split(" ")[0]
      : null,
    merchant_country: seed.country,
    merchant_region: seed.region ?? seed.county,
    merchant_lat: seed.latitude,
    merchant_lng: seed.longitude,
    merchant_avatar_url: null,

    merchant_whatsapp: null,
    merchant_email: seed.email,
    merchant_phone: seed.telephone,
    merchant_website: seed.website,
    merchant_verification_level: verification,

    // Philip 2026-08-02 · Trade Center feed v2 · membership + profile fields.
    // Directory seeds are not on any paid plan · tier stays null (=free).
    // Rating comes from the Google-sourced field on the seed; null when
    // not available. No fabrication.
    merchant_tier:                null,
    merchant_google_rating:       seed.google_rating,
    merchant_google_review_count: seed.google_review_count,
    merchant_services:            seed.services ?? [],
    merchant_years_in_trade:      null,       // not present on seed schema · TODO from claim workflow
    merchant_photos:              seed.photos ?? [],
    merchant_instagram:           null,       // not present on seed schema
    merchant_facebook:            null,       // not present on seed schema

    distance_km: null,
    region_match_score: null,
    is_promoted: false,
    active_banner_headline: null,
    active_banner_visual_style: null,

    published_at: seed.imported_at,

    // Location fallback for the meta line
    ...(location ? {} : {}),
  };
}

/** Load every directory seed and convert to feed items. Ordered by
 *  imported_at descending for display; admin refs are assigned in
 *  imported_at ASCENDING order so NEX-D-001 = first-imported seed
 *  regardless of display sort. Stable across reloads.
 *
 *  DATA SOURCE (Philip 2026-08-13 · Option B migration):
 *  Reads from the Supabase `directory_seeds` table via listDirectorySeeds().
 *  The JSON files under data/directory-seeds/**​/*.json remain as archive
 *  but are NOT the runtime source of truth anymore.
 *
 *  Fallback: if the DB call returns 0 rows AND the JSON archive has content,
 *  fall back to file-based read so a mis-configured DB env never wipes the
 *  public directory. Emits a console warning so the operator notices.
 */
export async function loadDirectorySeedsAsFeedItems(
  opts?: { category?: string; country?: string; region?: string; capability?: string },
): Promise<CentreFeedItem[]> {
  // Dynamic import to keep this module safe to load in edge / non-server
  // contexts (the DB module has `import "server-only"`).
  const {
    listDirectorySeeds,
    listDirectorySeedsByCategory,
    listDirectorySeedsByCountry,
    listSeedRefMap,
  } = await import("./directorySeedsDb");

  // Perf fix (Philip 2026-08-13): when the caller supplies a category, pull
  // ONLY that category from the DB instead of every seed across every trade.
  //
  // Country-aware fix (Philip 2026-08-16): a country/region/capability filter
  // takes precedence — it selects a compound WHERE clause at the DB layer.
  // No filter at all = whole table.
  //
  // Identity-preservation fix (Philip 2026-08-13): admin_ref (NEX-D-XXX) is
  // a GLOBAL identifier — the same seed always gets the same NEX-D-XXX
  // regardless of filter. We fetch a cheap `id + imported_at` map across
  // ALL seeds in parallel with the filtered feed query · then assign each
  // filtered seed its stable global admin_ref from that map.
  const hasCountryScopedFilter = !!(opts?.country || opts?.region || opts?.capability);
  const hasAnyFilter = hasCountryScopedFilter || !!opts?.category;
  const [dbSeeds, globalRefMap] = await Promise.all([
    hasCountryScopedFilter
      ? listDirectorySeedsByCountry({
          country: opts?.country,
          region: opts?.region,
          category: opts?.category,
          capability: opts?.capability,
        })
      : opts?.category
        ? listDirectorySeedsByCategory(opts.category)
        : listDirectorySeeds(),
    // Only fetch the global ref-map when filtering · unfiltered path can
    // number in-place from its own ordering.
    hasAnyFilter ? listSeedRefMap() : Promise.resolve(new Map<string, string>()),
  ]);

  const seedItems: Array<{ seed: DirectorySeed; item: CentreFeedItem }> = [];
  for (const seed of dbSeeds) {
    seedItems.push({ seed, item: seedToFeedItem(seed) });
  }
  if (seedItems.length === 0) {
    // Fallback path — DB empty or unreachable. Read the JSON archive.
    console.warn("[directorySeedLoader] Supabase returned 0 seeds · falling back to JSON archive read.");
    const files = await collectSeedFiles(SEEDS_ROOT);
    for (const file of files) {
      try {
        const raw = await fs.readFile(file, "utf8");
        const seed = JSON.parse(raw) as DirectorySeed;
        // Honour the category filter for the JSON fallback path too, so a
        // Refacing request doesn't accidentally render Kitchen archive seeds.
        if (opts?.category && seed.category !== opts.category) continue;
        if (opts?.country && seed.country !== opts.country) continue;
        if (opts?.region && seed.region !== opts.region) continue;
        if (opts?.capability && seed.capabilities?.[opts.capability as keyof NonNullable<DirectorySeed["capabilities"]>] !== "yes") continue;
        seedItems.push({ seed, item: seedToFeedItem(seed) });
      } catch { continue; }
    }
  }

  // Assign admin refs in imported_at ASCENDING order (oldest = 001)
  // and apply hero-image resolution in priority order:
  //   1. Curated NEX-D-XXX override (Philip's map)  → use that
  //   2. Seed's own cover_image (post-claim uploads) → use that
  //   3. matchImage() against the manifest at 0.65 floor → use if hit
  //   4. Interim generic staircase placeholder      → fallback
  //
  // ImageKit smart crop is applied to every matched URL so cards
  // render as clean portraits regardless of source aspect.
  //
  // admin_ref sourcing:
  //   · filtered call → look up in the global ref map (identity preserved).
  //   · unfiltered call → assign in-place from the current ordering, which
  //     IS the global ordering because we pulled the whole table.
  const byImportAsc = [...seedItems].sort((a, b) =>
    (a.seed.imported_at ?? "").localeCompare(b.seed.imported_at ?? "")
  );

  // Perf fix (Philip 2026-08-13): resolve hero images in PARALLEL. Previously
  // this was a for/await loop that awaited matchImage() per seed serially —
  // at ~20-100ms per seed with a large directory that dominated the whole
  // request. Promise.all runs them concurrently and cuts wall time to
  // roughly the slowest single lookup instead of the sum.
  await Promise.all(
    byImportAsc.map(async ({ seed, item }, i) => {
      // Filtered path: seed's stable global NEX-D-XXX from the ref map.
      // Unfiltered path: derive in-place from local ordering (== global).
      // Fallback: if the ref map missed this seed (edge case · e.g. JSON
      // archive read + DB never seen it), assign the local ordinal so the
      // card still renders — it just won't collide with a curated override
      // aimed at a different seed.
      const ref = hasAnyFilter
        ? (globalRefMap.get(seed.id) ?? `NEX-D-${String(i + 1).padStart(3, "0")}`)
        : `NEX-D-${String(i + 1).padStart(3, "0")}`;
      item.admin_ref = ref;

      if (item.hero_image_url) return; // seed had a real cover

      // 1. Curated Philip override
      if (CURATED_HERO_OVERRIDES[ref]) {
        item.hero_image_url = applyCardCrop(CURATED_HERO_OVERRIDES[ref]);
        return;
      }

      const sig = seedHeroSig(seed);
      const cached = heroCache.get(seed.id);
      if (cached && cached.sig === sig) {
        item.hero_image_url = cached.url;
        return;
      }

      let resolved: string | null = null;

      // 2. Matcher against the manifest (ADR-0025 · directory-card floor 0.65)
      const targetText = [
        seed.business_name,
        seed.description ?? "",
        (seed.services ?? []).join(" · "),
        (seed.tags ?? []).join(" · "),
        seed.category ?? "",
        seed.town ?? "",
      ]
        .filter(Boolean)
        .join(" · ");
      try {
        const result = await matchImage(
          {
            text: targetText,
            tags: seed.tags ?? [],
            subject_domain: "staircase",
          },
          { surface: "directory-card", requireAPlus: true }
        );
        if (result.url) {
          resolved = applyCardCrop(result.url);
        }
      } catch {
        // matcher failure never crashes the feed — fall through to placeholder
      }

      // 3. Trade-aware pool pick · Philip 2026-08-02 · AI Image Intelligence v1.
      // Passes the seed context so the pool image is chosen by matching the
      // merchant's business text against per-image trade tags (glass · oak ·
      // steel · traditional · commercial · etc.). Falls back to a
      // deterministic hash pick when nothing scores.
      if (!resolved) {
        resolved = applyCardCrop(pickInterimStaircase(seed.id, seed));
      }

      item.hero_image_url = resolved;
      heroCache.set(seed.id, { sig, url: resolved });
    }),
  );

  // Return in display order — newest first.
  const items = seedItems.map((si) => si.item);
  items.sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
  return items;
}
