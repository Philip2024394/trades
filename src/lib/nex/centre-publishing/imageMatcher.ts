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
  opts: { surface: keyof typeof SURFACE_FLOORS; requireAPlus?: boolean } = {
    surface: "directory-card",
    requireAPlus: true,
  }
): Promise<MatchResult> {
  const manifest = await loadManifest();
  const eligible = manifest.filter((img) => {
    if (img.excluded) return false;
    if ((opts.requireAPlus ?? true) && !img.a_plus) return false;
    if (!img.description || img.description.trim().length === 0) return false;
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
