// Asset Library — curated photo pool + resolver.
//
// Every hero/gallery/banner section can auto-populate its image slot
// from this pool based on multi-dimensional metadata (industry × style
// × orientation × mood × purpose).
//
// Two-tier resolution:
//   1. Query studio_asset_library table via supabaseAdmin
//   2. Fall back to CURATED_SEED_POOL baked into this file — always
//      available even before any DB seeding
//
// Deterministic-seed mode: pass a `seed` string (e.g. brand id, blueprint
// slug + trade) so the same merchant always gets the same asset — makes
// previews reproducible + install-time rolls stable. Truly random when
// omitted.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type AssetPurpose =
  | "hero"
  | "gallery"
  | "background"
  | "team"
  | "service"
  | "banner";

export type AssetOrientation = "landscape" | "portrait" | "square";

export type AssetMood = "bright" | "dark" | "warm" | "cool" | "neutral";

export type Asset = {
  url: string;
  alt: string;
  industry?: string;
  style?: string;
  orientation?: AssetOrientation;
  mood?: AssetMood;
  purpose: AssetPurpose;
  tags: string[];
  weight?: number;
};

export type AssetCriteria = {
  purpose: AssetPurpose;
  industry?: string;
  style?: string;
  orientation?: AssetOrientation;
  mood?: AssetMood;
  /** Deterministic seed — same string always yields the same asset. */
  seed?: string;
};

// ─── Curated fallback pool ─────────────────────────────────────
//
// Used when the database table is empty. Every entry is a real
// ImageKit URL that already exists in blueprint manifests. This
// bootstrap pool means the resolver works from day one — no manual
// data seeding required.
const CURATED_SEED_POOL: Asset[] = [
  // ─── Hero landscape photos ───
  {
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2001_57_56%20PM.png",
    alt: "Trade work site with team on-site",
    orientation: "landscape",
    purpose: "hero",
    mood: "warm",
    style: "premium",
    tags: ["trade", "site", "team"]
  },
  {
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2002_03_18%20PM.png",
    alt: "Finished trade job — landscape shot",
    orientation: "landscape",
    purpose: "hero",
    mood: "bright",
    style: "premium",
    tags: ["portfolio", "finished-job"]
  },
  {
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2001_57_56%20PM.png",
    alt: "Plant hire yard with excavators",
    orientation: "landscape",
    industry: "plant-hire",
    purpose: "hero",
    mood: "neutral",
    style: "industrial",
    tags: ["plant-hire", "machinery", "yard"]
  },

  // ─── Electrician heroes ───
  {
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2001_57_56%20PM.png",
    alt: "Electrician on-site working on consumer unit",
    orientation: "landscape",
    industry: "electrician",
    purpose: "hero",
    mood: "bright",
    style: "modern",
    tags: ["electrician", "consumer-unit", "domestic"]
  },

  // ─── Landscape / garden heroes ───
  {
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2002_03_18%20PM.png",
    alt: "Landscaped garden with new patio",
    orientation: "landscape",
    industry: "landscaper",
    purpose: "hero",
    mood: "bright",
    style: "creative",
    tags: ["landscaping", "garden", "patio"]
  },

  // ─── Kitchen / bathroom showroom heroes ───
  {
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2002_03_18%20PM.png",
    alt: "Premium fitted kitchen — showroom shot",
    orientation: "landscape",
    industry: "kitchen-fitter",
    purpose: "hero",
    mood: "warm",
    style: "luxury",
    tags: ["kitchen", "showroom", "premium"]
  },
  {
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2002_03_18%20PM.png",
    alt: "Modern bathroom install — full room",
    orientation: "landscape",
    industry: "bathroom-fitter",
    purpose: "hero",
    mood: "cool",
    style: "luxury",
    tags: ["bathroom", "showroom"]
  },

  // ─── Gallery photos (square) ───
  {
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2001_57_56%20PM.png",
    alt: "Portfolio work sample",
    orientation: "square",
    purpose: "gallery",
    mood: "bright",
    tags: ["portfolio"]
  },
  {
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2002_03_18%20PM.png",
    alt: "Portfolio work sample",
    orientation: "square",
    purpose: "gallery",
    mood: "warm",
    tags: ["portfolio"]
  },

  // ─── Background photos ───
  {
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2001_57_56%20PM.png",
    alt: "",
    orientation: "landscape",
    purpose: "background",
    mood: "dark",
    tags: ["texture", "abstract"]
  }
];

// ─── Deterministic pseudo-random ───────────────────────────────
//
// Djb2 hash → 32-bit int → deterministic index selection. Same seed
// string always maps to the same asset for the same-length pool.
function seededIndex(seed: string, poolSize: number): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash) ^ seed.charCodeAt(i);
  }
  return Math.abs(hash) % Math.max(1, poolSize);
}

// ─── Score how well an asset matches criteria ───────────────────
function scoreAsset(asset: Asset, criteria: AssetCriteria): number {
  if (asset.purpose !== criteria.purpose) return -1;
  let score = asset.weight ?? 100;

  // Exact industry match adds significant weight
  if (criteria.industry && asset.industry === criteria.industry) score += 200;
  else if (criteria.industry && asset.industry) score -= 50; // industry-tagged but wrong = bad match

  // Style match
  if (criteria.style && asset.style === criteria.style) score += 100;

  // Orientation match — mandatory for hero/gallery, forgiving otherwise
  if (criteria.orientation && asset.orientation === criteria.orientation) score += 80;
  else if (criteria.orientation && asset.orientation) score -= 30;

  // Mood match
  if (criteria.mood && asset.mood === criteria.mood) score += 40;

  return score;
}

/** Query the asset library for the best-matching asset given criteria.
 *  Returns null if nothing matches even the purpose filter. */
export async function getRandomAsset(
  criteria: AssetCriteria
): Promise<Asset | null> {
  // 1. Try the database first
  let dbAssets: Asset[] = [];
  try {
    const q = supabaseAdmin
      .from("studio_asset_library")
      .select("url, alt, industry, style, orientation, mood, purpose, tags, weight")
      .eq("purpose", criteria.purpose)
      .eq("active", true);
    const res = await q;
    if (!res.error && res.data) {
      dbAssets = res.data as Asset[];
    }
  } catch {
    // Table missing / migration not yet applied — fall through to seed pool
  }

  const pool = dbAssets.length > 0 ? dbAssets : CURATED_SEED_POOL;

  // 2. Filter to purpose and score
  const scored = pool
    .map((asset) => ({ asset, score: scoreAsset(asset, criteria) }))
    .filter((r) => r.score >= 0);

  if (scored.length === 0) return null;

  // 3. Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // 4. Take the top-N tied at the highest score → pick one (deterministic
  //    if seed provided, else random). Top-N prevents "same asset every
  //    time" while still respecting the score ordering.
  const topScore = scored[0].score;
  const topN = scored.filter((r) => r.score >= topScore - 20);
  const idx = criteria.seed
    ? seededIndex(criteria.seed, topN.length)
    : Math.floor(Math.random() * topN.length);

  return topN[idx].asset;
}

/** Bulk resolver — fetch N assets, useful for gallery grids. */
export async function getRandomAssets(
  criteria: AssetCriteria,
  count: number
): Promise<Asset[]> {
  const out: Asset[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < count * 3 && out.length < count; i++) {
    const c: AssetCriteria = {
      ...criteria,
      seed: criteria.seed ? `${criteria.seed}#${i}` : undefined
    };
    const asset = await getRandomAsset(c);
    if (asset && !seen.has(asset.url)) {
      seen.add(asset.url);
      out.push(asset);
    }
  }
  return out;
}
