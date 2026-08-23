// NEX image matcher — per ADR-0025.
//
// Scores every A+ manifest image against a target (listing metadata
// or free-text query) and returns the top match plus its confidence
// band. Callers decide surface-specific behaviour based on the band.
//
// Never hardcodes URLs — always reads data/nex-image-manifest.json.
// Never picks below the surface's floor — returns null instead so
// the caller can fall back or ask a clarifying question.
//
// Score formula (from ADR-0025):
//   0.4 × tag intersection
//   0.4 × description keyword overlap
//   0.2 × structured field agreement

import { promises as fs } from "node:fs";
import path from "node:path";

// ── Types ────────────────────────────────────────────────────────

export type ManifestImage = {
  url: string;
  source?: string;
  description?: string;
  tags?: string[];
  a_plus?: boolean;
  excluded?: boolean;
  subject_domain?: string;
  setting?: string;
  mood?: string;
  view_type?: string;
  colour_palette?: string;
  original_prompt?: string | null;
  notes?: string;
  /** ADR-0027 Rule 11 · what this image is (hero-scene, product_component,
   *  trade_activity, etc). Used to gate directory-card picks so cards
   *  never surface a close-up detail image as the merchant hero. */
  image_type?: string;
};

export type MatchTarget = {
  /** Free text describing what we want an image for (listing bio +
   *  services text, or user query). */
  text: string;
  /** Any tags the target already carries. */
  tags?: string[];
  /** Optional structured fields to score against. */
  subject_domain?: string;
  setting?: string;
  mood?: string;
  view_type?: string;
  colour_palette?: string;
};

export type MatchBand = "confident" | "soft-caveat" | "clarify";

export type MatchResult = {
  url: string | null;
  score: number;
  band: MatchBand;
  reasoning: {
    tag_overlap: number;
    description_overlap: number;
    structured_match: number;
    top_3: Array<{ url: string; score: number }>;
  };
  clarify_question: string | null;
};

/** Per-surface confident floors from ADR-0025. */
export const SURFACE_FLOORS: Record<string, number> = {
  "directory-card": 0.65,
  "brain-chat": 0.8,
  "marketing-hero": 0.9,
  "banner-recommendation": 0.75,
  "workshop-diagram": 0.85,
  "search-grid": 0.6,
};

// ── Manifest loader (cached in-process) ──────────────────────────

let cachedManifest: ManifestImage[] | null = null;
let cachedAt = 0;
const MANIFEST_CACHE_MS = 5_000; // 5s in dev is fine; feed re-reads freshly

export async function loadManifest(force = false): Promise<ManifestImage[]> {
  if (!force && cachedManifest && Date.now() - cachedAt < MANIFEST_CACHE_MS) {
    return cachedManifest;
  }
  const p = path.join(process.cwd(), "data", "nex-image-manifest.json");
  try {
    const raw = await fs.readFile(p, "utf8");
    const parsed = JSON.parse(raw) as {
      images?: Record<string, Omit<ManifestImage, "url">>;
    };
    const images: ManifestImage[] = [];
    for (const [url, row] of Object.entries(parsed.images ?? {})) {
      images.push({ url, ...(row as Omit<ManifestImage, "url">) });
    }
    cachedManifest = images;
    cachedAt = Date.now();
    return images;
  } catch {
    cachedManifest = [];
    cachedAt = Date.now();
    return [];
  }
}

// ── Scoring ──────────────────────────────────────────────────────

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "the",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "or",
  "at",
  "by",
  "from",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "as",
  "it",
  "that",
  "this",
  "our",
  "we",
  "our",
  "you",
  "your",
  "us",
]);

function tokenise(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return new Set(words);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union > 0 ? inter / union : 0;
}

function structuredMatch(target: MatchTarget, img: ManifestImage): number {
  let score = 0;
  let considered = 0;
  const pairs: Array<[keyof MatchTarget, keyof ManifestImage, number]> = [
    ["subject_domain", "subject_domain", 1.0],
    ["setting", "setting", 0.5],
    ["mood", "mood", 0.5],
    ["view_type", "view_type", 0.5],
    ["colour_palette", "colour_palette", 0.5],
  ];
  for (const [tKey, iKey, weight] of pairs) {
    const t = target[tKey] as string | undefined;
    const i = img[iKey] as string | undefined;
    if (!t) continue;
    considered += weight;
    if (t && i && t.toLowerCase() === i.toLowerCase()) score += weight;
  }
  return considered > 0 ? score / considered : 0;
}

export function scoreImage(target: MatchTarget, img: ManifestImage): number {
  const tagsTarget = new Set((target.tags ?? []).map((t) => t.toLowerCase()));
  const tagsImg = new Set((img.tags ?? []).map((t) => t.toLowerCase()));
  const tagScore = jaccard(tagsTarget, tagsImg);

  const descOverlap = jaccard(
    tokenise(target.text ?? ""),
    tokenise(img.description ?? "")
  );

  const structScore = structuredMatch(target, img);

  return 0.4 * tagScore + 0.4 * descOverlap + 0.2 * structScore;
}

// ── Selection ────────────────────────────────────────────────────

function bandFromScore(score: number): MatchBand {
  if (score >= 0.85) return "confident";
  if (score >= 0.7) return "soft-caveat";
  return "clarify";
}

/** Derive a small clarifying question from where the top candidates
 *  disagree most. Best effort — replaced by a smarter generator later. */
function deriveClarifyQuestion(
  top: Array<{ img: ManifestImage; score: number }>
): string | null {
  if (top.length < 2) return null;
  const dims: Array<[keyof ManifestImage, string]> = [
    ["mood", "traditional or contemporary"],
    ["setting", "residential or commercial"],
    ["view_type", "a full staircase shot or a close-up detail"],
    ["colour_palette", "warm or cool tones"],
  ];
  for (const [dim, question] of dims) {
    const values = new Set(
      top.map((t) => (t.img[dim] as string | undefined) ?? "")
    );
    values.delete("");
    if (values.size >= 2) {
      return `Would you prefer ${question}?`;
    }
  }
  return null;
}

/** Pick the best A+ image for a target on a given surface.
 *  Returns url=null when the score is below the surface's floor
 *  AND below the soft-caveat threshold. */
export async function matchImage(
  target: MatchTarget,
  opts: {
    surface: keyof typeof SURFACE_FLOORS;
    requireAPlus?: boolean;
    excludeStaircaseParts?: boolean;
  } = {
    surface: "directory-card",
    requireAPlus: true,
  }
): Promise<MatchResult> {
  const manifest = await loadManifest();
  const excludeParts = opts.excludeStaircaseParts ?? false;
  const eligible = manifest.filter((img) => {
    if (img.excluded) return false;
    if ((opts.requireAPlus ?? true) && !img.a_plus) return false;
    if (!img.description || img.description.trim().length === 0) return false;
    if (excludeParts && isStaircasePartOrDetail(img)) return false;
    return true;
  });

  if (eligible.length === 0) {
    return {
      url: null,
      score: 0,
      band: "clarify",
      reasoning: {
        tag_overlap: 0,
        description_overlap: 0,
        structured_match: 0,
        top_3: [],
      },
      clarify_question: null,
    };
  }

  const scored = eligible
    .map((img) => ({ img, score: scoreImage(target, img) }))
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  const band = bandFromScore(top.score);
  const floor = SURFACE_FLOORS[opts.surface] ?? 0.7;

  // Compute band-scored breakdown for the winner
  const tagsTarget = new Set((target.tags ?? []).map((t) => t.toLowerCase()));
  const tagsImg = new Set((top.img.tags ?? []).map((t) => t.toLowerCase()));
  const tagOverlap = jaccard(tagsTarget, tagsImg);
  const descOverlap = jaccard(
    tokenise(target.text ?? ""),
    tokenise(top.img.description ?? "")
  );
  const structScore = structuredMatch(target, top.img);

  // Apply floor: if top score is BELOW the surface floor AND below
  // the soft-caveat threshold (0.7), return null so caller falls back.
  const shouldSurface = top.score >= Math.min(floor, 0.7);
  const clarifyQuestion =
    band === "clarify"
      ? deriveClarifyQuestion(scored.slice(0, 3))
      : null;

  return {
    url: shouldSurface ? top.img.url : null,
    score: top.score,
    band,
    reasoning: {
      tag_overlap: tagOverlap,
      description_overlap: descOverlap,
      structured_match: structScore,
      top_3: scored.slice(0, 3).map((s) => ({ url: s.img.url, score: s.score })),
    },
    clarify_question: clarifyQuestion,
  };
}

// ── Full-scene guard ─────────────────────────────────────────────
//
// A directory card is a "who built this staircase" advert, so the image
// must show a WHOLE staircase — not a close-up of a tread, spindle,
// handrail, landing rail, or trade-in-action shot. The A+ library carries
// both (99 parts/details vs 425 full-scenes across 524 staircase A+ rows),
// so the picker needs to exclude parts explicitly. Applied via
// `excludeStaircaseParts: true` on matchImage / pickDiverseAPlusImage.

const STAIRCASE_PART_TYPES = new Set([
  "product_component",
  "trade_activity",
  "trade_tool",
  "qc_reference",
  "trade_capability",
  "survey_reference",
  "refacing_card_before_after", // marketing before/after composites, not a scene
]);

const STAIRCASE_PART_TAG_PREFIXES = [
  "subject:landing_railing",
  "subject:starting_step",
  "subject:handrail",
  "subject:baluster",
  "subject:tread",
  "subject:riser",
  "subject:newel",
  "subject:spindle",
  "section:trade_craftsmanship",
  "section:starting_step_scene",
  "section:refacing_before_after_card",
  "purpose:trade_card_process",
  "purpose:trade_card_hero",
  "card:before_after_split_panel",
];

// Exact tag matches that mark an image as a component/module/library-reference
// asset rather than a full-scene installed-in-context staircase photo. Every
// entry came from a real leak reported on customer cards — do not remove
// without a replacement signal.
const STAIRCASE_PART_TAGS_EXACT = new Set([
  // Components / modules / fittings
  "stair_component",
  "stair_module",
  "stair_fitting",
  "handrail_fitting",
  "handrail_blank",
  "handrail_volute", // full staircases carry `volute` under other tags
  "component_reference",
  "reusable_component",
  "reusable_module",
  "hero_component",
  // Library / training reference assets (renders / specimens, not photos)
  "object_library_reference",
  "training_specimen",
  // Wall-panel specimens (staircase-adjacent · not staircases)
  "panel-specimen",
  "panel-design-catalog",
  "product-reference",
  "product_specimen",
  // Transparent-background / hero-asset technical exports
  "transparent_background",
  "transparent-background",
  "marketing_hero_asset",
  "reusable_hero",
  // No-white-background rule (Philip 2026-08-17): a directory card must show
  // a staircase installed in a real space (walls · floor · lighting), never
  // a specimen on white/plain/studio background. White-bg = learning /
  // parts / lighting-product photography, not customer-facing hero content.
  "isolated",
  "isolate",
  "white_background",
  "white-background",
  "plain_background",
  "plain-background",
  "no_background",
  "no-background",
  "studio_shot",
  "studio-shot",
  "cutout",
]);

// Strong signals in the source URL that the asset is a background-removed
// cutout / product shot rather than a real installed-in-context staircase.
const STAIRCASE_PART_URL_SUBSTRINGS = [
  "removebg-preview",
  "-removebg",
];

// Description prefixes that identify library / catalog / product-spec assets.
// These headers are structured metadata, not customer-facing scene captions.
const STAIRCASE_PART_DESC_PREFIXES = [
  "STAIRCASE COMPONENT REFERENCE",
  "STAIRCASE OBJECT REFERENCE",
  "IMAGE IDENTITY",
];

function isStaircasePartOrDetail(img: ManifestImage): boolean {
  const type = img.image_type ?? "";
  if (type && STAIRCASE_PART_TYPES.has(type)) return true;

  const tags = (img.tags ?? []).map((t) => t.toLowerCase());
  for (const t of tags) {
    if (STAIRCASE_PART_TAGS_EXACT.has(t)) return true;
    for (const p of STAIRCASE_PART_TAG_PREFIXES) {
      if (t === p || t.startsWith(p + ":")) return true;
    }
  }

  const url = (img.url ?? "").toLowerCase();
  for (const sub of STAIRCASE_PART_URL_SUBSTRINGS) {
    if (url.includes(sub)) return true;
  }

  const desc = img.description ?? "";
  for (const p of STAIRCASE_PART_DESC_PREFIXES) {
    if (desc.startsWith(p)) return true;
  }

  return false;
}

// ── Staircase material / style profile ──────────────────────────
//
// Directory cards use a HARD ELIGIBILITY GATE before scoring: an image is
// only considered if its material profile is compatible with the company's.
// A timber-only joiner must never receive a metal or glass staircase card.
//
// Profile derivation is pure text/tag parsing — no ML — so it's cheap and
// reproducible across seed loads. Applies to both seeds (business text) and
// manifest images (tags + description).

export type StaircaseMaterialFamily =
  | "timber"
  | "metal"
  | "glass"
  | "cable"
  | "concrete";

// Broad word/tag patterns per family. Kept liberal on the seed side so
// "joinery"/"fabricator" imply timber/metal even when the seed doesn't spell
// out materials. Image tags in the manifest are much more specific
// (`material:light_oak` etc.), so the same patterns catch both after
// tokenisation on `-` / `_` / `:`.
const MATERIAL_FAMILY_PATTERNS: Record<StaircaseMaterialFamily, RegExp> = {
  timber:
    /\b(timber|wood(en)?|oak|walnut|ash|pine|hardwood|softwood|joinery|joiner|carpent(er|ry))\b/i,
  metal:
    /\b(steel|stainless|metal|iron|aluminum|aluminium|fabricator|fabrication|welded|wrought|brushed_?stainless|mono[_ -]?string|black_?steel)\b/i,
  glass:
    /\b(glass|frameless_?glass|glass_?balustrade)\b/i,
  cable:
    /\bcable(_stainless)?\b/i,
  concrete:
    /\bconcrete\b/i,
};

/** Normalise text so tag separators (`-` `_` `:`) look like word boundaries.
 *  `material:light_oak` → `material light oak` — makes the regex above match. */
function normaliseProfileText(text: string): string {
  return (text ?? "").toLowerCase().replace(/[-_:]/g, " ");
}

export function deriveMaterialsFromText(text: string): Set<StaircaseMaterialFamily> {
  const t = normaliseProfileText(text);
  const out = new Set<StaircaseMaterialFamily>();
  for (const [fam, re] of Object.entries(MATERIAL_FAMILY_PATTERNS) as Array<
    [StaircaseMaterialFamily, RegExp]
  >) {
    if (re.test(t)) out.add(fam);
  }
  return out;
}

// Company-only broadening exemption. When present in the text we do NOT
// auto-add timber even though metal/glass is detected — e.g. an all-steel
// commercial fire-escape fabricator that genuinely doesn't do timber.
// Kept intentionally narrow so most real UK trade profiles broaden.
const COMPANY_METAL_ONLY_SIGNALS = /\b(all[_ -]?metal|all[_ -]?steel|steel[_ -]?only|metal[_ -]?only|no[_ -]?(timber|wood)|structural[_ -]?steel[_ -]?only|fire[_ -]?escape[_ -]?only)\b/i;

/**
 * Trade-realistic COMPANY profile derivation (Philip 2026-08-17).
 *
 * A staircase company's material profile isn't just what keywords they used —
 * it's what images would represent them commercially. In the UK trade:
 *   · Almost every "metal staircase" or "steel fabricator" also uses timber
 *     treads, so their profile is {metal, timber}.
 *   · "Glass staircase" specialists almost always install glass balustrades
 *     on wood or steel substrates, not full-glass structural staircases.
 *     Their profile is {glass, timber} at minimum.
 *   · Traditional joiners / timber staircase manufacturers are genuinely
 *     wood-only — no auto-broadening in that direction. A wood-only company
 *     must NEVER receive metal or glass imagery.
 *
 * The broadening is asymmetric on purpose:
 *   metal   → auto-add timber (unless explicit "metal-only" signal)
 *   glass   → auto-add timber (glass on wood is the default UK case)
 *   timber  → NO auto-add
 *
 * This must NOT be used for image material derivation — an image is a
 * factual snapshot of what's shown; if there's no visible timber it does
 * not have `timber` in its profile. That's what `deriveImageMaterials`
 * (raw only) is for.
 */
export function deriveCompanyMaterialsFromText(text: string): Set<StaircaseMaterialFamily> {
  const raw = deriveMaterialsFromText(text);
  const t = normaliseProfileText(text);
  const metalOnlyOverride = COMPANY_METAL_ONLY_SIGNALS.test(t);

  if (!metalOnlyOverride && !raw.has("timber")) {
    if (raw.has("metal") || raw.has("glass") || raw.has("cable")) {
      raw.add("timber");
    }
  }
  return raw;
}

// Memoise per-image derivation — the manifest is loaded once (5s cache) and
// re-derivation on every request would burn cycles for no reason.
const imageMaterialCache = new WeakMap<ManifestImage, Set<StaircaseMaterialFamily>>();

export function deriveImageMaterials(img: ManifestImage): Set<StaircaseMaterialFamily> {
  const cached = imageMaterialCache.get(img);
  if (cached) return cached;
  const text = [(img.tags ?? []).join(" "), img.description ?? ""].join(" ");
  const out = deriveMaterialsFromText(text);
  imageMaterialCache.set(img, out);
  return out;
}

/** Hard eligibility gate. An image is compatible with a company profile iff
 *  the image doesn't feature a material the company doesn't work with.
 *
 *  Rules:
 *   - Company profile is empty (no material signal) → accept any image
 *     (defensive default; no false rejects).
 *   - Image profile is empty (no material tags) → accept as a generic
 *     staircase (many older manifest rows carry style but no materials).
 *   - Otherwise: every material in the image must be present in the
 *     company's material set. So a `{timber, glass}` company accepts
 *     timber, glass, and timber+glass images — but not metal.
 */
export function isImageCompatibleWithCompany(
  companyMaterials: ReadonlySet<StaircaseMaterialFamily>,
  imageMaterials: ReadonlySet<StaircaseMaterialFamily>,
): boolean {
  if (companyMaterials.size === 0) return true;
  if (imageMaterials.size === 0) return true;
  for (const m of imageMaterials) {
    if (!companyMaterials.has(m)) return false;
  }
  return true;
}

// ── Diverse A+ picker (directory-card fallback) ──────────────────
//
// Every merchant deserves an image that matches what they supply — but if
// we always pick the single top-scored A+ image, the highest-signal image
// (say the oak/glass hybrid) wins for every merchant whose text mentions
// either wood. Ships-out looks like a monoculture. Instead: score every
// eligible A+ image, take the top `poolSize` (default 12), and use a
// stable hash of the merchant's identity to pick one from that shortlist.
// Same merchant always gets the same image (brand recognition), but the
// A+ library gets distributed across merchants that share a profile.
//
// Never returns null when the manifest has ≥1 A+ image in the requested
// subject_domain — this is the last-resort pool. If the pool is empty
// (e.g. brand-new domain with no library yet), caller falls through to
// its own hardcoded interim images.

function stableHash(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) - h) + key.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export async function pickDiverseAPlusImage(
  target: MatchTarget,
  seedIdForDistribution: string,
  opts: {
    poolSize?: number;
    requireAPlus?: boolean;
    excludeStaircaseParts?: boolean;
    /** HARD ELIGIBILITY GATE. Filter the manifest to images whose material
     *  profile is compatible with this company. Empty set = no gate (any
     *  eligible A+ full-scene image). Applied BEFORE scoring / uniqueness /
     *  hash pick — a timber company will never see metal or glass images
     *  regardless of what would score highest. */
    companyMaterials?: ReadonlySet<StaircaseMaterialFamily>;
    /** Per-URL assignment counts for the current batch. Picker prefers the
     *  URL with the lowest count from the eligible pool. Ties broken by
     *  hash(seedId + rotationSalt) so:
     *   - assignment is deterministic within a batch (no picker jitter)
     *   - reuse spreads evenly (never lets one image hit 3× while another
     *     sits at 0)
     *   - different refresh windows (different salt) give different picks
     *
     *  Passed as-is; caller mutates the map with the returned URL's count. */
    usedCounts?: ReadonlyMap<string, number>;
    /** Rotation salt for the hash tie-break. When it changes (e.g. once per
     *  day) the assignment reshuffles — companies see fresh imagery over
     *  time. Empty string keeps assignments stable. */
    rotationSalt?: string;
    /** Test-only manifest injection. When provided, skips loadManifest()
     *  and scores against the passed array directly. Production code paths
     *  never pass this. */
    manifest?: ManifestImage[];
  } = {}
): Promise<string | null> {
  const poolSize = opts.poolSize ?? 12;
  const requireAPlus = opts.requireAPlus ?? true;
  const excludeParts = opts.excludeStaircaseParts ?? false;
  const companyMaterials = opts.companyMaterials ?? new Set<StaircaseMaterialFamily>();
  const usedCounts = opts.usedCounts;
  const salt = opts.rotationSalt ?? "";
  const manifest = opts.manifest ?? (await loadManifest());

  // Step 1 · eligibility gate: A+ + subject + parts filter + material compat.
  let eligible = manifest.filter((img) => {
    if (img.excluded) return false;
    if (requireAPlus && !img.a_plus) return false;
    if (target.subject_domain && img.subject_domain && img.subject_domain !== target.subject_domain) return false;
    if (excludeParts && isStaircasePartOrDetail(img)) return false;
    return true;
  });

  if (companyMaterials.size > 0) {
    // A company with a known material profile should be served by images
    // that DECLARE the same material family. Images with no material info
    // (empty profile) technically pass the strict subset check, but they'd
    // then flood every profile's pool and concentrate on 3-4 popular URLs.
    // Prefer strictly-typed matches; only accept no-material images when
    // no typed match exists at all.
    const strictlyTyped = eligible.filter((img) => {
      const im = deriveImageMaterials(img);
      return im.size > 0 && isImageCompatibleWithCompany(companyMaterials, im);
    });
    if (strictlyTyped.length > 0) {
      eligible = strictlyTyped;
    } else {
      const anyCompatible = eligible.filter((img) =>
        isImageCompatibleWithCompany(companyMaterials, deriveImageMaterials(img)),
      );
      if (anyCompatible.length > 0) {
        eligible = anyCompatible;
      } else {
        // Nothing in the pool declares a compatible material AND no fallback
        // images either — return null so the loader can drop to the interim
        // pool. Warn so operators can see which company profiles need more
        // library coverage.
        // eslint-disable-next-line no-console
        console.warn(
          `[picker] no material-compatible images for company profile {${[...companyMaterials].join(",")}} · falling back to interim pool`,
        );
        return null;
      }
    }
  }
  if (eligible.length === 0) return null;

  // Step 2 · score against the seed's business text and take the top pool.
  const scored = eligible
    .map((img) => ({ img, score: scoreImage(target, img) }))
    .sort((a, b) => b.score - a.score);
  const shortlist = scored.slice(0, Math.min(poolSize, scored.length));

  // Step 3 · uniqueness / even-distribution ranking. Within the shortlist,
  // find every candidate at the current minimum use-count. Hash-pick among
  // them. If the shortlist is entirely "heavier" than something outside it,
  // widen to the whole eligible pool at the minimum count — that's what
  // spreads unavoidable reuse across the library instead of concentrating
  // on the top-scored winners.
  const countOf = (u: string) => (usedCounts?.get(u) ?? 0);

  let candidates = shortlist;
  if (usedCounts && usedCounts.size > 0) {
    const shortMin = Math.min(...shortlist.map((s) => countOf(s.img.url)));
    const eligibleMin = Math.min(...scored.map((s) => countOf(s.img.url)));
    // If the shortlist is entirely more-used than something in the wider
    // eligible pool, widen to give the less-used images their turn.
    if (eligibleMin < shortMin) {
      candidates = scored.filter((s) => countOf(s.img.url) === eligibleMin);
    } else {
      candidates = shortlist.filter((s) => countOf(s.img.url) === shortMin);
    }
  }

  const idx = stableHash(`${seedIdForDistribution}|${salt}`) % candidates.length;
  return candidates[idx].img.url;
}

// ── ImageKit crop helper ─────────────────────────────────────────

/** Apply ImageKit smart-crop transforms so the source image is
 *  auto-focused, portrait-cropped, and served at reasonable size.
 *  No-op for non-ImageKit URLs. Idempotent — skips if already
 *  transformed. */
export function applyCardCrop(
  url: string | null,
  opts: { aspect?: string; width?: number; quality?: number } = {}
): string | null {
  if (!url) return null;
  if (!url.includes("ik.imagekit.io")) return url;
  if (url.includes("tr=")) return url; // already transformed

  const aspect = opts.aspect ?? "3-4"; // portrait default for cards
  const width = opts.width ?? 800;
  const quality = opts.quality ?? 90;
  const params = `w-${width},ar-${aspect},fo-auto,q-${quality}`;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}tr=${params}`;
}
