// src/lib/nex/brain/spatial-intelligence.ts
//
// Wave 2 · Spatial Intelligence
// Philip 2026-09-06 · AUTHORIZE · WAVE 2 · CONTEXTUAL MEANING & CONVERSATIONAL SCOPE
//
// GOVERNING PRINCIPLE (§4 §5 §6 §7)
//   Represent spatial meaning as semantic structure. Never fabricate a
//   location. Deictic spatial words ("here", "there") only resolve
//   against valid antecedents; on fresh conversation → clarify.
//   Preserve G04 (reference resolution) and G12 (polarity).
//
// SCOPE (§4)
//   PROXIMITY · DIRECTION · RELATIVE_LOCATION · CHANGE · COMPARATIVE
//   Wave 1 owns COMPARATIVE (cheaper/closer/etc.); this module supplies
//   the SPATIAL DIMENSION so those comparatives resolve correctly.

import type { Lang } from "./language-state";

// ─── Types ──────────────────────────────────────────────────────

export type SpatialConcept =
  | "PROXIMITY"          // near · nearby · close · far
  | "DIRECTION"          // north · south · left · right · toward · away
  | "RELATIVE_LOCATION"  // near <place> · around <place> · downtown
  | "DEICTIC"            // here · there · over there
  | "CHANGE"             // "near X instead" — modifies a prior constraint
  | "NONE";

export type SpatialConstraint = {
  concept: SpatialConcept;
  polarity: "AFFIRM" | "NEGATED";
  /** Named anchor (place-name) when message includes one · e.g., "airport", "malioboro". */
  anchor: string | null;
  /** Direction/relative modifier · "north" · "away from" · "toward" · "around". */
  modifier: string | null;
  /** True when the message shape is a spatial CHANGE ("instead" / "actually") replacing prior. */
  is_change: boolean;
  /** True when deictic ("here"/"there") — requires antecedent check. */
  is_deictic: boolean;
  markers: string[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reason: string;
};

// ─── Tokenizer ──────────────────────────────────────────────────

function tokens(message: string): string[] {
  return (message || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[?.!,;:"“”()]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// ─── Vocabulary primitives (EN + ID) ────────────────────────────

const PROXIMITY_MARKERS_EN = new Set([
  "near", "nearby", "close", "far", "farther", "further", "distant",
  "next", "beside", "adjacent", "around", "within",
]);
const PROXIMITY_MARKERS_ID = new Set([
  "dekat", "jauh", "sekitar", "sebelah", "samping",
]);

const DIRECTION_MARKERS_EN = new Set([
  "north", "south", "east", "west",
  "left", "right", "up", "down", "above", "below",
  "toward", "towards", "away",
]);
const DIRECTION_MARKERS_ID = new Set([
  "utara", "selatan", "timur", "barat",
  "kiri", "kanan", "atas", "bawah",
]);

const RELATIVE_LOCATION_MARKERS_EN = new Set([
  "downtown", "uptown", "central", "outside", "inside", "outskirts",
  "here", "there", "elsewhere", "somewhere",
]);
const RELATIVE_LOCATION_MARKERS_ID = new Set([
  "pusat", "tengah", "luar", "dalam", "sini", "situ", "sana", "lain",
]);

const DEICTIC_MARKERS = new Set([
  "here", "there", "elsewhere", "somewhere",
  "sini", "situ", "sana",
]);

const CHANGE_MARKERS = new Set([
  "instead", "actually", "rather",
  "sebagai", "gantinya",
]);

// Known place-name anchors (small · shared with scope-validation intent)
const KNOWN_PLACES_LOCAL = new Set([
  "malioboro", "yogyakarta", "jogja", "jakarta", "bandung", "semarang",
  "surabaya", "medan", "makassar", "malang", "solo", "bogor",
  "prawirotaman", "airport", "airports", "station", "kraton", "kota",
  "denpasar", "kuta", "seminyak", "ubud", "canggu", "sanur",
  "bandara", "stasiun",
]);

// Negation markers for spatial polarity
const NEG_MARKERS = new Set([
  "not", "no", "never", "dont", "cant",
  "tidak", "bukan", "jangan",
]);

// ─── Detector ───────────────────────────────────────────────────

// Interrogative openers · when a message opens with one AND contains
// no explicit spatial marker (near/close/dekat/etc.), the anchor is
// the subject of a question, not a spatial constraint.
const INTERROGATIVE_OPENERS_SPATIAL = new Set([
  "what", "when", "why", "how", "who", "which",
  "apa", "kapan", "kenapa", "bagaimana", "siapa",
]);

export function detectSpatialConstraint(message: string): SpatialConstraint {
  const t = tokens(message);
  const markers: string[] = [];
  const empty = (reason: string): SpatialConstraint => ({
    concept: "NONE", polarity: "AFFIRM", anchor: null, modifier: null,
    is_change: false, is_deictic: false, markers, confidence: "HIGH", reason,
  });
  if (t.length === 0) return empty("empty");

  // Interrogative-opened messages ("What is Yogyakarta?") are not
  // spatial constraints even if they mention a known place. Bail out
  // early UNLESS a genuine spatial marker (near/close/direction/deictic)
  // is present — that would signal "where is X" spatial question.
  if (t[0] && INTERROGATIVE_OPENERS_SPATIAL.has(t[0])) {
    const hasGenuineSpatialMarker =
      t.some((x) => PROXIMITY_MARKERS_EN.has(x) || PROXIMITY_MARKERS_ID.has(x)
                 || DIRECTION_MARKERS_EN.has(x) || DIRECTION_MARKERS_ID.has(x)
                 || DEICTIC_MARKERS.has(x)
                 || (RELATIVE_LOCATION_MARKERS_EN.has(x) && !["somewhere", "elsewhere"].includes(x))
                 || RELATIVE_LOCATION_MARKERS_ID.has(x));
    if (!hasGenuineSpatialMarker) {
      return empty("interrogative_opener_no_spatial_marker");
    }
  }

  // Polarity check (G12-adjacent · shallow · G12 owns full polarity)
  const negIdx = t.findIndex((x) => NEG_MARKERS.has(x));
  const polarity: "AFFIRM" | "NEGATED" = negIdx >= 0 ? "NEGATED" : "AFFIRM";
  if (polarity === "NEGATED") markers.push("neg");

  // Change marker anywhere (§7 · contrastive replacement)
  const is_change = t.some((x) => CHANGE_MARKERS.has(x));
  if (is_change) markers.push("change");

  // Named anchor extraction (place-name after the spatial marker)
  let anchor: string | null = null;
  for (const tok of t) {
    if (KNOWN_PLACES_LOCAL.has(tok)) { anchor = tok; break; }
  }
  if (anchor) markers.push(`anchor:${anchor}`);

  // Deictic check (here/there without a concrete anchor)
  const deictic = t.find((x) => DEICTIC_MARKERS.has(x));
  if (deictic) markers.push(`deictic:${deictic}`);
  const is_deictic = !!deictic && !anchor;

  // 1 · DEICTIC (highest specificity — G04 antecedent required)
  if (is_deictic) {
    return {
      concept: "DEICTIC", polarity, anchor: null, modifier: deictic ?? null,
      is_change, is_deictic: true, markers, confidence: "HIGH",
      reason: `deictic:${deictic}`,
    };
  }

  // 2 · DIRECTION marker present
  const direction = t.find((x) => DIRECTION_MARKERS_EN.has(x) || DIRECTION_MARKERS_ID.has(x));
  if (direction) {
    markers.push(`direction:${direction}`);
    return {
      concept: "DIRECTION", polarity, anchor, modifier: direction,
      is_change, is_deictic: false, markers, confidence: "HIGH",
      reason: `direction:${direction}`,
    };
  }

  // 3 · RELATIVE_LOCATION (downtown / central / outside / …) with or
  // without a named anchor
  const rel = t.find((x) => (
    (RELATIVE_LOCATION_MARKERS_EN.has(x) && !DEICTIC_MARKERS.has(x))
    || (RELATIVE_LOCATION_MARKERS_ID.has(x) && !DEICTIC_MARKERS.has(x))
  ));
  if (rel) {
    markers.push(`relative:${rel}`);
    return {
      concept: "RELATIVE_LOCATION", polarity, anchor, modifier: rel,
      is_change, is_deictic: false, markers, confidence: "MEDIUM",
      reason: `relative_location:${rel}`,
    };
  }

  // 4 · PROXIMITY (near / far / dekat / jauh) — with or without anchor
  const proximity = t.find((x) => PROXIMITY_MARKERS_EN.has(x) || PROXIMITY_MARKERS_ID.has(x));
  if (proximity) {
    markers.push(`proximity:${proximity}`);
    return {
      concept: "PROXIMITY", polarity, anchor, modifier: proximity,
      is_change, is_deictic: false, markers, confidence: anchor ? "HIGH" : "MEDIUM",
      reason: `proximity:${proximity}${anchor ? `+anchor:${anchor}` : ""}`,
    };
  }

  // Named-anchor-only mention (e.g., "airport") — CHANGE if 'instead',
  // else RELATIVE_LOCATION with the anchor.
  if (anchor) {
    return {
      concept: "RELATIVE_LOCATION", polarity, anchor, modifier: null,
      is_change, is_deictic: false, markers, confidence: "MEDIUM",
      reason: `bare_anchor:${anchor}`,
    };
  }

  return empty("no_spatial_marker");
}

// ─── Gate: fresh-conv DEICTIC without antecedent → clarify (§5) ─

export type SpatialGateDecision =
  | { shouldGate: false; reason: string; constraint: SpatialConstraint }
  | {
      shouldGate: true;
      reason: string;
      constraint: SpatialConstraint;
      reply: string;
      language: Lang;
    };

/** hasSpatialAntecedent should be true when the session's recent NEX
 *  turn contains a spatial anchor OR the entities window includes a
 *  presented place. The route.ts wiring supplies this. */
export function decideSpatialGate(input: {
  userMessage: string;
  hasSpatialAntecedent: boolean;
  activeLanguage: Lang;
}): SpatialGateDecision {
  const constraint = detectSpatialConstraint(input.userMessage);
  // DEICTIC "there" / "here" without a valid antecedent → clarify.
  if (constraint.is_deictic && !input.hasSpatialAntecedent) {
    const reply = input.activeLanguage === "ID"
      ? "Di mana yang Anda maksud? Belum ada lokasi yang saya catat di percakapan ini."
      : "Where do you mean? I don't have a specific location in mind from this conversation yet.";
    return {
      shouldGate: true,
      reason: "deictic_without_antecedent",
      constraint,
      reply,
      language: input.activeLanguage,
    };
  }
  return { shouldGate: false, reason: `pass_through:${constraint.concept}`, constraint };
}
