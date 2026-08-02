// Layered authored Q&A retrieval for the Staircase Library floating chat.
// Philip 2026-08-02 · 4-layer architecture.
//
// LAYER MATCH ORDER (most specific → most general):
//   1. IMAGE         · design.qa on the confirmed image record
//   2. COMPONENT     · data/nex-component-qa/{component_id}.json for each
//                      component the design has (tread · handrail · glass · etc.)
//   3. MATERIALS     · data/nex-materials-qa/{material_id}.json for each
//                      material the design uses (mdf · plywood · osb · oak · etc.)
//   4. FAMILY        · data/nex-family-qa/{family_id}.json for each family
//                      the design belongs to (spiral · helical · glass-balustrade · etc.)
//   5. UNIVERSAL     · data/nex-universal-qa.json applies to every staircase
//
// If any layer returns a match with score >= MATCH_THRESHOLD, Nex uses that
// authored answer VERBATIM (Rule A · no LLM synthesis · Philip's words only).
// Empty `a` slots are skipped at match time. If no layer matches, the caller
// falls through to the composer.
//
// Match algorithm — deliberately simple and cheap:
//   1. Tokenise both the user message and each Q · lower-case · strip
//      punctuation · drop stopwords.
//   2. Compute Jaccard overlap on distinctive tokens.
//   3. Also bonus if the user message contains the Q's shortest "main" noun.
//   4. Score >= MATCH_THRESHOLD → return the entry.

import "server-only";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { listConfirmedImages, type ConfirmedImage } from "./confirmed-library";

export type AuthoredQa = {
  q:      string;
  a:      string;
  facts?: string[];
};

export type QaLayer = "image" | "component" | "materials" | "family" | "universal";

export type QaMatch = {
  entry:      AuthoredQa;
  score:      number;
  design_id:  string;         // originating design context
  layer:      QaLayer;        // which layer answered · used in citations
  layer_ref?: string;         // component_id or family_id when applicable · null for image/universal
};

const STOPWORDS = new Set([
  "the","a","an","this","that","these","those","is","are","was","were",
  "be","being","been","have","has","had","do","does","did","of","for","in",
  "on","at","by","to","from","with","about","as","and","or","but","not",
  "no","yes","if","so","up","down","out","over","under","again","then",
  "than","too","very","can","could","would","should","will","just","also",
  "what","how","when","why","where","who","which","whose","tell","me","us",
  "you","your","my","our","i","we","staircase","staircases","stair","stairs",
]);

function tokenise(text: string): Set<string> {
  const raw = (text ?? "")
    .toLowerCase()
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out = new Set<string>();
  for (const t of raw) {
    if (STOPWORDS.has(t)) continue;
    // Coarse plural strip · matches how the advisor tokeniser works elsewhere
    const stem = t.length > 4 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t;
    if (stem.length > 1) out.add(stem);
  }
  return out;
}

// Config
const MATCH_THRESHOLD = 0.42;   // 0-1 · tuned so short queries like "what style" still match "What style is this?"

/**
 * Get authored Q&A for a design_id · returns [] if not authored.
 */
export function getDesignQa(designId: string): AuthoredQa[] {
  if (!designId) return [];
  const record = findRecordByDesignId(designId);
  if (!record?.qa) return [];
  return record.qa.filter((qa) => qa.a && qa.a.trim().length > 0);
}

/**
 * Find the best matching authored Q&A for a user message against a specific
 * design_id · returns null when nothing crosses the threshold or when the
 * design has no authored answers yet.
 */
export function matchDesignQa(designId: string, userMessage: string): QaMatch | null {
  const qas = getDesignQa(designId);
  if (qas.length === 0) return null;

  const userTokens = tokenise(userMessage);
  if (userTokens.size === 0) return null;

  let best: QaMatch | null = null;
  for (const qa of qas) {
    const qTokens = tokenise(qa.q);
    if (qTokens.size === 0) continue;

    // Jaccard overlap on distinctive tokens
    let intersect = 0;
    for (const t of userTokens) if (qTokens.has(t)) intersect++;
    const union = userTokens.size + qTokens.size - intersect;
    const jaccard = union === 0 ? 0 : intersect / union;

    // Bonus: if the SHORTEST DISTINCTIVE token from the Q appears in the
    // user message · captures cases like "style?" matching "What style is this?"
    // Anchor must be >= 5 chars so common short words like "new" don't
    // over-match (Philip 2026-08-02 · regional-lang test showed "I'm in
    // Ireland and need a new staircase" was matching universal Qs on the
    // shared word "new" alone).
    const qTokensArr = [...qTokens].filter((t) => t.length >= 5).sort((a, b) => a.length - b.length);
    const anchor = qTokensArr[0];
    const anchorBonus = anchor && userMessage.toLowerCase().includes(anchor) ? 0.15 : 0;

    const score = jaccard + anchorBonus;
    if (score >= MATCH_THRESHOLD && (!best || score > best.score)) {
      best = { entry: qa, score, design_id: designId, layer: "image" };
    }
  }

  return best;
}

/**
 * Return the free-form design_notes for a design_id · used as evidence for
 * the composer when no Q&A matches. Rule A safe · Philip authored, never
 * fabricated.
 */
export function getDesignNotes(designId: string): string | undefined {
  const record = findRecordByDesignId(designId);
  return record?.design_notes;
}

/**
 * Small internal helper · avoids re-scanning the library from multiple call sites.
 */
function findRecordByDesignId(designId: string): ConfirmedImage | undefined {
  const target = designId.trim();
  if (!target) return undefined;
  return listConfirmedImages().find((img) =>
    img.design_id === target || img.image_id === target,
  );
}

// ─── Philip 2026-08-02 · 4-layer retrieval ──────────────────────────

// Cached JSON reads · layer files are small and change rarely at runtime.
// Cache keyed by file mtime · re-reads immediately when the file changes on
// disk (Philip's authoring workflow · tests that inject temporary answers).
// If file doesn't exist, cache stores empty list keyed by mtime -1.
type CachedQa = { list: AuthoredQa[]; mtimeMs: number };
const layerCache = new Map<string, CachedQa>();

function readLayerQaFile(path: string): AuthoredQa[] {
  if (!existsSync(path)) {
    const cached = layerCache.get(path);
    if (cached && cached.mtimeMs === -1) return cached.list;
    layerCache.set(path, { list: [], mtimeMs: -1 });
    return [];
  }

  let mtimeMs: number;
  try { mtimeMs = statSync(path).mtimeMs; }
  catch { mtimeMs = Date.now(); }

  const cached = layerCache.get(path);
  if (cached && cached.mtimeMs === mtimeMs) return cached.list;

  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as { qa?: unknown };
    const arr = Array.isArray(parsed.qa) ? parsed.qa : [];
    const filtered: AuthoredQa[] = [];
    for (const item of arr) {
      if (item && typeof item === "object" && typeof (item as AuthoredQa).q === "string" && typeof (item as AuthoredQa).a === "string") {
        const qa = item as AuthoredQa;
        if (qa.a.trim().length > 0) filtered.push(qa);
      }
    }
    layerCache.set(path, { list: filtered, mtimeMs });
    return filtered;
  } catch {
    layerCache.set(path, { list: [], mtimeMs });
    return [];
  }
}

/**
 * Score a user message against a candidate Q · same algorithm as image-layer
 * matcher · returns { score } · null when below threshold.
 * Anchor requires >= 5-char distinctive token (Philip 2026-08-02 fix).
 */
function scoreMatch(userMessage: string, userTokens: Set<string>, candidateQ: string): number {
  const qTokens = tokenise(candidateQ);
  if (qTokens.size === 0) return 0;
  let intersect = 0;
  for (const t of userTokens) if (qTokens.has(t)) intersect++;
  const union = userTokens.size + qTokens.size - intersect;
  const jaccard = union === 0 ? 0 : intersect / union;
  const qTokensArr = [...qTokens].filter((t) => t.length >= 5).sort((a, b) => a.length - b.length);
  const anchor = qTokensArr[0];
  const anchorBonus = anchor && userMessage.toLowerCase().includes(anchor) ? 0.15 : 0;
  return jaccard + anchorBonus;
}

/**
 * The 4-layer matcher · Philip 2026-08-02.
 * Priority: IMAGE → COMPONENT → FAMILY → UNIVERSAL.
 * Returns the first layer that produces a match >= MATCH_THRESHOLD.
 * More specific layers ALWAYS win when both match.
 */
export function matchLayeredQa(designId: string, userMessage: string): QaMatch | null {
  const userTokens = tokenise(userMessage);
  if (userTokens.size === 0) return null;

  const record = findRecordByDesignId(designId);
  // Even without a record we can still consult universal · returns null if universal empty.

  // ── Layer 1 · IMAGE (most specific) ──
  if (record?.qa && record.qa.length > 0) {
    let best: { entry: AuthoredQa; score: number } | null = null;
    for (const qa of record.qa) {
      if (!qa.a || qa.a.trim().length === 0) continue;
      const score = scoreMatch(userMessage, userTokens, qa.q);
      if (score >= MATCH_THRESHOLD && (!best || score > best.score)) {
        best = { entry: qa, score };
      }
    }
    if (best) return { ...best, design_id: designId, layer: "image" };
  }

  // ── Layer 2 · COMPONENT · walk each component tagged on the design ──
  if (record?.components && record.components.length > 0) {
    let best: { entry: AuthoredQa; score: number; component_id: string } | null = null;
    for (const componentId of record.components) {
      const path = join(process.cwd(), "data/nex-component-qa", `${componentId}.json`);
      const list = readLayerQaFile(path);
      for (const qa of list) {
        const score = scoreMatch(userMessage, userTokens, qa.q);
        if (score >= MATCH_THRESHOLD && (!best || score > best.score)) {
          best = { entry: qa, score, component_id: componentId };
        }
      }
    }
    if (best) return { entry: best.entry, score: best.score, design_id: designId, layer: "component", layer_ref: best.component_id };
  }

  // ── Layer 3 · MATERIALS · walk each material tagged on the design ──
  if (record?.material_ids && record.material_ids.length > 0) {
    let best: { entry: AuthoredQa; score: number; material_id: string } | null = null;
    for (const materialId of record.material_ids) {
      const path = join(process.cwd(), "data/nex-materials-qa", `${materialId}.json`);
      const list = readLayerQaFile(path);
      for (const qa of list) {
        const score = scoreMatch(userMessage, userTokens, qa.q);
        if (score >= MATCH_THRESHOLD && (!best || score > best.score)) {
          best = { entry: qa, score, material_id: materialId };
        }
      }
    }
    if (best) return { entry: best.entry, score: best.score, design_id: designId, layer: "materials", layer_ref: best.material_id };
  }

  // ── Layer 4 · FAMILY · walk each family tagged on the design ──
  if (record?.families && record.families.length > 0) {
    let best: { entry: AuthoredQa; score: number; family_id: string } | null = null;
    for (const familyId of record.families) {
      const path = join(process.cwd(), "data/nex-family-qa", `${familyId}.json`);
      const list = readLayerQaFile(path);
      for (const qa of list) {
        const score = scoreMatch(userMessage, userTokens, qa.q);
        if (score >= MATCH_THRESHOLD && (!best || score > best.score)) {
          best = { entry: qa, score, family_id: familyId };
        }
      }
    }
    if (best) return { entry: best.entry, score: best.score, design_id: designId, layer: "family", layer_ref: best.family_id };
  }

  // ── Layer 5 · UNIVERSAL ──
  const universalPath = join(process.cwd(), "data/nex-universal-qa.json");
  const universalList = readLayerQaFile(universalPath);
  if (universalList.length > 0) {
    let best: { entry: AuthoredQa; score: number } | null = null;
    for (const qa of universalList) {
      const score = scoreMatch(userMessage, userTokens, qa.q);
      if (score >= MATCH_THRESHOLD && (!best || score > best.score)) {
        best = { entry: qa, score };
      }
    }
    if (best) return { ...best, design_id: designId, layer: "universal" };
  }

  return null;
}

/**
 * Simple stats helper · shows authoring progress per design.
 * Used by admin tools to track which designs still need Q&A written.
 */
export function designQaStats(): Array<{ design_id: string; total: number; authored: number; ratio: number }> {
  const out: Array<{ design_id: string; total: number; authored: number; ratio: number }> = [];
  for (const img of listConfirmedImages()) {
    const id = img.design_id ?? img.image_id ?? "unknown";
    const qa = img.qa ?? [];
    const authored = qa.filter((x) => x.a && x.a.trim().length > 0).length;
    out.push({
      design_id: id,
      total:     qa.length,
      authored,
      ratio:     qa.length === 0 ? 0 : authored / qa.length,
    });
  }
  return out;
}
