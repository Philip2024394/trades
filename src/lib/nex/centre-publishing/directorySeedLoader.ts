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

// Interim generic staircase placeholder used when a seed has no
// cover_image yet. Same NEX-owned hero art already visible at the
// top of /nex-app/centre — proven to load and ADR-0022-compliant
// (NEX-owned generated asset, option (c) in §4). Replaced per-card
// as Philip curates NEX-D-XXX → specific-image mappings.
const INTERIM_STAIRCASE_PLACEHOLDER =
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2025,%202026,%2012_12_45%20AM.png";

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

    // 3. Interim placeholder
    byImportAsc[i].item.hero_image_url = applyCardCrop(
      INTERIM_STAIRCASE_PLACEHOLDER
    );
  }

  // Return in display order — newest first.
  const items = seedItems.map((si) => si.item);
  items.sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
  return items;
}
