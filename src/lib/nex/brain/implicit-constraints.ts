// src/lib/nex/brain/implicit-constraints.ts
//
// Wave 2 · Implied Constraints / Implicit Meaning
// Philip 2026-09-06 · AUTHORIZE · WAVE 2
//
// GOVERNING PRINCIPLE (§9 §10)
//   Recognise constraints expressed indirectly ("somewhere quieter",
//   "nothing too expensive", "central"). Represent as symbolic
//   preferences. NEVER invent numeric thresholds. NEVER present
//   qualitative preferences as facts.

// ─── Types ──────────────────────────────────────────────────────

export type PreferenceAttribute =
  | "PRICE" | "DISTANCE" | "SIZE" | "QUALITY" | "RATING" | "AMBIENCE"
  | "CENTRALITY" | "TOURISM" | "CROWDING" | "GENERIC";

export type PreferenceDirection =
  | "LOW"      // cheaper / smaller / quieter / less-touristy
  | "HIGH"     // more expensive / bigger / better
  | "AVOID"    // "not too X", "no X"
  | "SEEK";    // "somewhere X" (positive preference)

export type ImplicitConstraint = {
  attribute: PreferenceAttribute;
  direction: PreferenceDirection;
  /** True when the message hedges ("too", "very", "quite"). */
  hedged: boolean;
  /** Extracted natural-language phrase for observability / composer context. */
  phrase: string;
  markers: string[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
};

export type ImplicitConstraintDetection = {
  constraints: ImplicitConstraint[];
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

// ─── Attribute vocabulary (EN + ID) ─────────────────────────────

type AttrSpec = { attr: PreferenceAttribute; dir: PreferenceDirection };

// Comparative forms → LOW/HIGH direction
const IMPLICIT_COMPARATIVE_MAP: Record<string, AttrSpec> = {
  cheaper: { attr: "PRICE", dir: "LOW" },
  quieter: { attr: "CROWDING", dir: "LOW" },
  smaller: { attr: "SIZE", dir: "LOW" },
  closer: { attr: "DISTANCE", dir: "LOW" },
  nearer: { attr: "DISTANCE", dir: "LOW" },
  bigger: { attr: "SIZE", dir: "HIGH" },
  larger: { attr: "SIZE", dir: "HIGH" },
  better: { attr: "QUALITY", dir: "HIGH" },
  nicer: { attr: "QUALITY", dir: "HIGH" },
  fancier: { attr: "QUALITY", dir: "HIGH" },
  cleaner: { attr: "QUALITY", dir: "HIGH" },
  safer: { attr: "QUALITY", dir: "HIGH" },
  more: { attr: "GENERIC", dir: "HIGH" },
};

// Positive adjectival preferences → SEEK direction
const IMPLICIT_POSITIVE_MAP: Record<string, AttrSpec> = {
  central: { attr: "CENTRALITY", dir: "SEEK" },
  quiet: { attr: "CROWDING", dir: "LOW" },
  peaceful: { attr: "CROWDING", dir: "LOW" },
  cheap: { attr: "PRICE", dir: "LOW" },
  affordable: { attr: "PRICE", dir: "LOW" },
  nice: { attr: "QUALITY", dir: "SEEK" },
  decent: { attr: "QUALITY", dir: "SEEK" },
  good: { attr: "QUALITY", dir: "SEEK" },
  luxury: { attr: "PRICE", dir: "HIGH" },
  fancy: { attr: "PRICE", dir: "HIGH" },
  budget: { attr: "PRICE", dir: "LOW" },
  clean: { attr: "QUALITY", dir: "SEEK" },
  safe: { attr: "QUALITY", dir: "SEEK" },
  convenient: { attr: "AMBIENCE", dir: "SEEK" },
  authentic: { attr: "AMBIENCE", dir: "SEEK" },
  local: { attr: "AMBIENCE", dir: "SEEK" },
  touristy: { attr: "TOURISM", dir: "AVOID" },  // usually mentioned to avoid
  crowded: { attr: "CROWDING", dir: "AVOID" },
  busy: { attr: "CROWDING", dir: "AVOID" },
  boring: { attr: "QUALITY", dir: "AVOID" },
  ugly: { attr: "QUALITY", dir: "AVOID" },
  dirty: { attr: "QUALITY", dir: "AVOID" },
  expensive: { attr: "PRICE", dir: "HIGH" },   // usually mentioned to avoid via "not too"
  far: { attr: "DISTANCE", dir: "AVOID" },      // usually mentioned to avoid via "not too"
  big: { attr: "SIZE", dir: "HIGH" },
  small: { attr: "SIZE", dir: "LOW" },
};

// Indonesian equivalents · shared representation
const IMPLICIT_ID_MAP: Record<string, AttrSpec> = {
  murah: { attr: "PRICE", dir: "LOW" },
  mahal: { attr: "PRICE", dir: "HIGH" },
  tenang: { attr: "CROWDING", dir: "LOW" },
  ramai: { attr: "CROWDING", dir: "AVOID" },
  sepi: { attr: "CROWDING", dir: "LOW" },
  besar: { attr: "SIZE", dir: "HIGH" },
  kecil: { attr: "SIZE", dir: "LOW" },
  baik: { attr: "QUALITY", dir: "SEEK" },
  bagus: { attr: "QUALITY", dir: "SEEK" },
  bersih: { attr: "QUALITY", dir: "SEEK" },
  jauh: { attr: "DISTANCE", dir: "AVOID" },
  dekat: { attr: "DISTANCE", dir: "LOW" },
  mewah: { attr: "PRICE", dir: "HIGH" },
  autentik: { attr: "AMBIENCE", dir: "SEEK" },
  lokal: { attr: "AMBIENCE", dir: "SEEK" },
  turis: { attr: "TOURISM", dir: "AVOID" },
};

// Hedge markers ("too", "very", "quite", "terlalu")
const HEDGE_MARKERS = new Set([
  "too", "very", "quite", "really", "somewhat", "kind", "sort",
  "terlalu", "cukup", "agak",
]);

// Avoidance markers ("not too", "no", "nothing", "jangan terlalu")
const AVOID_MARKERS_EN = new Set(["not", "no", "nothing", "avoid", "without"]);
const AVOID_MARKERS_ID = new Set(["tidak", "bukan", "tanpa", "jangan", "hindari"]);

// Preference openers ("somewhere", "something")
const OPENER_MARKERS = new Set(["somewhere", "something", "tempat", "sesuatu", "yang"]);

// ─── Detector ───────────────────────────────────────────────────

export function detectImplicitConstraints(message: string): ImplicitConstraintDetection {
  const t = tokens(message);
  const constraints: ImplicitConstraint[] = [];
  if (t.length === 0) return { constraints, reason: "empty" };

  // Scan tokens · for each attribute-vocabulary hit, determine
  // direction from nearby hedge/avoid markers.
  for (let i = 0; i < t.length; i++) {
    const tok = t[i];
    const compSpec = IMPLICIT_COMPARATIVE_MAP[tok];
    const posSpec = IMPLICIT_POSITIVE_MAP[tok];
    const idSpec = IMPLICIT_ID_MAP[tok];
    const spec = compSpec ?? posSpec ?? idSpec;
    if (!spec) continue;

    // Determine hedging and avoidance from up-to-3 tokens before
    let hedged = false;
    let avoided = false;
    for (let j = Math.max(0, i - 3); j < i; j++) {
      if (HEDGE_MARKERS.has(t[j])) hedged = true;
      if (AVOID_MARKERS_EN.has(t[j]) || AVOID_MARKERS_ID.has(t[j])) avoided = true;
    }

    // Direction adjustment:
    //   · If avoided + LOW/HIGH → flip to AVOID
    //   · If avoided + AVOID → keep AVOID (double-negative not modeled)
    //   · If avoided + SEEK → convert to AVOID
    //   · Comparative + hedged (rare) → keep as-is
    let direction = spec.dir;
    if (avoided) direction = "AVOID";

    const markers = ["attr", tok];
    if (hedged) markers.push("hedged");
    if (avoided) markers.push("avoided");

    constraints.push({
      attribute: spec.attr,
      direction,
      hedged,
      phrase: t.slice(Math.max(0, i - 2), Math.min(t.length, i + 2)).join(" "),
      markers,
      confidence: compSpec ? "HIGH" : posSpec ? "MEDIUM" : "MEDIUM",
    });
  }

  // Deduplicate identical (attribute, direction) pairs
  const seen = new Set<string>();
  const uniq: ImplicitConstraint[] = [];
  for (const c of constraints) {
    const key = `${c.attribute}:${c.direction}`;
    if (!seen.has(key)) { seen.add(key); uniq.push(c); }
  }

  return {
    constraints: uniq,
    reason: uniq.length > 0 ? `detected_${uniq.length}_constraints` : "no_implicit_marker",
  };
}
