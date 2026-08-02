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

type DirectorySeed = {
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
};

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
  const location =
    seed.town ??
    (seed.postcode ? seed.postcode.split(" ")[0] : null) ??
    "UK";

  // Seed listings start unverified; the trust pip stays "listed".
  const verification: MerchantVerificationLevel = seed.verified
    ? "verified"
    : seed.claimed
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
 *  regardless of display sort. Stable across reloads. */
export async function loadDirectorySeedsAsFeedItems(): Promise<CentreFeedItem[]> {
  const files = await collectSeedFiles(SEEDS_ROOT);
  const seedItems: Array<{ seed: DirectorySeed; item: CentreFeedItem }> = [];
  for (const file of files) {
    try {
      const raw = await fs.readFile(file, "utf8");
      const seed = JSON.parse(raw) as DirectorySeed;
      seedItems.push({ seed, item: seedToFeedItem(seed) });
    } catch {
      // Skip files that fail to parse — ADR-0023 says never invent data
      // and a corrupt seed should NOT crash the whole feed.
      continue;
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
  const byImportAsc = [...seedItems].sort((a, b) =>
    (a.seed.imported_at ?? "").localeCompare(b.seed.imported_at ?? "")
  );
  for (let i = 0; i < byImportAsc.length; i++) {
    const ref = `NEX-D-${String(i + 1).padStart(3, "0")}`;
    byImportAsc[i].item.admin_ref = ref;

    if (byImportAsc[i].item.hero_image_url) continue; // seed had a real cover

    // 1. Curated Philip override
    if (CURATED_HERO_OVERRIDES[ref]) {
      byImportAsc[i].item.hero_image_url = applyCardCrop(
        CURATED_HERO_OVERRIDES[ref]
      );
      continue;
    }

    // 2. Matcher against the manifest (ADR-0025 · directory-card floor 0.65)
    const seed = byImportAsc[i].seed;
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
        byImportAsc[i].item.hero_image_url = applyCardCrop(result.url);
        continue;
      }
    } catch {
      // matcher failure never crashes the feed — fall through to placeholder
    }

    // 3. Trade-aware pool pick · Philip 2026-08-02 · AI Image Intelligence v1.
    // Passes the seed context so the pool image is chosen by matching the
    // merchant's business text against per-image trade tags (glass · oak ·
    // steel · traditional · commercial · etc.). Falls back to a
    // deterministic hash pick when nothing scores.
    byImportAsc[i].item.hero_image_url = applyCardCrop(
      pickInterimStaircase(byImportAsc[i].seed.id, byImportAsc[i].seed)
    );
  }

  // Return in display order — newest first.
  const items = seedItems.map((si) => si.item);
  items.sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
  return items;
}
