// Confirmed Image Library (Philip 2026-08-01)
//
// Directive: "The next stage of Nex is not to process every image we own.
// The priority is to build the Visual Staircase Brain using only Philip's
// confirmed staircase images. Nex should never display or use unconfirmed
// images in customer conversations."
//
// Two libraries · totally separate:
//   1. CONFIRMED · Philip-verified · Nex retrieves + displays
//   2. UNCONFIRMED · everything in the manifest not yet confirmed ·
//      not shown to customers
//
// Storage: JSON file at data/nex-confirmed-images.json (git-tracked ·
// source of truth). CRUD via admin endpoints. Retrieval matches customer
// attributes against confirmed images only.

import "server-only";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const LIBRARY_PATH = "data/nex-confirmed-images.json";

// Visual Brain v2 view types (Philip 2026-08-01)
// Why each image exists within a design record.
export type ViewType =
  | "hero" | "front" | "side" | "rear" | "landing" | "stair-run"
  | "handrail-detail" | "balustrade-detail" | "tread-detail" | "newel-detail"
  | "lighting" | "lighting-off" | "lighting-on"
  | "underside" | "under-stair-detail" | "room-context"
  | "construction" | "installation" | "detail" | "alt" | "entry-sequence";

export type DesignFamily =
  | "Modern" | "Traditional" | "Floating" | "Industrial"
  | "Contemporary" | "Commercial" | "Biophilic"
  | "Components"                                    // Philip 2026-08-01 · carved stair parts · brackets · scrolls · appliqués · workshop craftsmanship
  | "Fixings"                                       // Philip 2026-08-01 · functional hardware · screws · fasteners · connectors · adhesives · installation fittings
  | "Materials";                                    // Philip 2026-08-01 · sheet materials · T&G boarding · plywood · MDF · MRMDF · mouldings · panelling · trim

// Which families answer "show me a staircase" queries (the customer default).
// Others (like Components) are specialty families that only surface when a
// caller explicitly requests them via findConfirmedImages({..., families: [...]}).
export const CUSTOMER_DEFAULT_FAMILIES: readonly DesignFamily[] = [
  "Modern", "Traditional", "Floating", "Industrial",
  "Contemporary", "Commercial", "Biophilic",
];

// Philip 2026-08-01 · Design priority tiers · editorial ranking control.
// When two designs tie on raw match score, priority breaks the tie so
// Philip's featured/hero designs surface first instead of library order.
export type DesignPriority =
  | "flagship"      // Philip-featured hero designs · top of every eligible result set
  | "recommended"   // consistently strong performers · above standard
  | "standard"      // default · new confirmations land here
  | "specialist";   // scoped-use designs · won't surface unless specifically queried

// Underlying numeric weight per priority tier. Records may override with
// `ranking_weight` (0-100) for fine-grained editorial control.
export const PRIORITY_WEIGHT: Record<DesignPriority, number> = {
  flagship:    20,
  recommended: 10,
  standard:     0,
  specialist: -10,
};

// Philip 2026-08-02 · Visual Brain Connection v1 — image transparency states.
//
// PURPOSE: Nex must never accidentally imply "we photographed this" or
// "this exact newel exists." Every image carries an image_state that
// generates a prescribed transparency caption for the UI + a hint for the
// composer so it never over-claims image provenance.
//
// Default when unspecified is "concept" — the SAFEST option per Philip's
// transparency principle. Concept never over-claims. A record must be
// explicitly promoted to "manufacturer" or "customer_project" with real
// provenance before those higher-trust states apply.
export type ImageState =
  | "concept"           // Nex-generated design concept · possible appearance only
  | "reference"         // Style direction · exact manufacture may vary
  | "manufacturer"      // Real supplied product image from a manufacturer
  | "customer_project"; // Real customer installation

// Prescribed customer-facing transparency caption per Philip 2026-08-02.
// Rendered under every Visual Brain tile so customers always know what
// they are looking at.
export const IMAGE_STATE_CAPTION: Record<ImageState, string> = {
  concept:          "Nex generated design concept — showing possible appearance.",
  reference:        "Style direction reference — exact manufacture may vary.",
  manufacturer:     "Supplied product image from a manufacturer.",
  customer_project: "Real customer installation.",
};

// Short chip label rendered as a badge on the image tile.
export const IMAGE_STATE_BADGE: Record<ImageState, string> = {
  concept:          "Concept",
  reference:        "Reference",
  manufacturer:     "Manufacturer",
  customer_project: "Customer project",
};

// Composer hint appended when at least one attached image is a given state.
// Passed to the LLM system prompt so it never over-claims image provenance.
// The customer sees the tile badges; the composer language must match.
export function imageStatesComposerHint(states: ImageState[]): string {
  if (states.length === 0) return "";
  const unique = Array.from(new Set(states));
  const parts: string[] = [];
  if (unique.includes("concept")) {
    parts.push(
      "One or more attached images are Nex-generated CONCEPT visuals. Refer to them as design concepts / possible appearances — NEVER as 'a real staircase we photographed' or 'this exact newel exists'.",
    );
  }
  if (unique.includes("reference")) {
    parts.push(
      "One or more attached images are STYLE REFERENCES. Refer to them as style directions — say 'a similar approach' or 'this style direction'. Exact manufacture may vary.",
    );
  }
  if (unique.includes("manufacturer")) {
    parts.push(
      "One or more attached images are MANUFACTURER product photos — these are real supplied products. You may reference them as real products but do NOT quote prices, availability, or make purchase promises.",
    );
  }
  if (unique.includes("customer_project")) {
    parts.push(
      "One or more attached images are REAL CUSTOMER INSTALLATIONS. You may reference them as real installations. Do NOT identify the customer, address, or personal details.",
    );
  }
  return "\n\n## Image transparency (Philip 2026-08-02 · Visual Brain Connection v1)\n\n" + parts.join(" ");
}

export type ConfirmedImage = {
  // Visual Brain v2 (Philip 2026-08-01) · permanent identifiers
  design_id?:           string;                // NEX-DESIGN-000012 · single canonical id across Knowledge · DNA · Estimator · CRM · Projects
  title?:               string;                // short display name · e.g. "Modern Black Steel and Oak Staircase"
  design_family?:       DesignFamily;          // Modern | Traditional | Floating | Industrial | Contemporary | Commercial | Biophilic
  primary_brain?:       string;                // ADR-0033 · always "staircase" for records in this library
  image_id?:            string;                // legacy alias · retained for backwards compat

  // Views (one design = many images)
  url:                  string;                // primary/hero URL · used as the key
  additional_views?:    string[];              // other angles/renders of the SAME staircase · merged as one record per Image Set rule
  view_labels?:         string[];              // optional labels corresponding to url + additional_views
  view_types?:          ViewType[];            // Visual Brain v2 · why each image exists · parallel to [url, ...additional_views]

  // Design metadata
  staircase_type:       string;
  layout:               string;
  materials:            string[];
  balustrade_style:     string;
  handrail_style:       string;
  newel_style:          string;
  design_style:         string;
  project_suitability:  string[];

  // Philip 2026-08-01 · Editorial ranking control
  priority?:            DesignPriority;        // flagship | recommended | standard | specialist · default "standard"
  ranking_weight?:      number;                // 0-100 · optional numeric override that supersedes priority tier

  // Philip 2026-08-02 · Visual Brain Connection v1 — transparency state.
  // Defaults to "concept" (safest) when unset. See IMAGE_STATE_CAPTION for
  // the customer-facing transparency line that always accompanies the tile.
  image_state?:         ImageState;            // concept (default) | reference | manufacturer | customer_project
  provenance_note?:     string;                // optional free-text · e.g. "supplied by Richard Burbidge · 2024-11" · admin-only

  // Knowledge Brain links (v2 · explicit connection)
  related_articles:     string[];              // article slugs · knowledge_links

  // Descriptions
  customer_description: string;                // used as caption in Visual Brain output
  designer_notes:       string;                // internal · never shown to customer

  // Provenance
  confirmed_at:         string;
  confirmed_by:         string;
};

type Library = {
  version:        number;
  updated_at:     string;
  confirmed:      ConfirmedImage[];
};

function libraryPath(): string {
  return join(process.cwd(), LIBRARY_PATH);
}

function loadLibrary(): Library {
  const path = libraryPath();
  if (!existsSync(path)) {
    return { version: 1, updated_at: new Date().toISOString(), confirmed: [] };
  }
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Library;
  } catch {
    return { version: 1, updated_at: new Date().toISOString(), confirmed: [] };
  }
}

function saveLibrary(lib: Library): void {
  lib.updated_at = new Date().toISOString();
  writeFileSync(libraryPath(), JSON.stringify(lib, null, 2), "utf8");
}

// ─── CRUD ─────────────────────────────────────────────────────────

export function listConfirmedImages(): ConfirmedImage[] {
  return loadLibrary().confirmed;
}

export function getConfirmedImage(url: string): ConfirmedImage | null {
  const lib = loadLibrary();
  return lib.confirmed.find((img) => img.url === url) ?? null;
}

export function confirmImage(input: Omit<ConfirmedImage, "confirmed_at" | "confirmed_by"> & { confirmed_by?: string }): ConfirmedImage {
  const lib = loadLibrary();
  const now = new Date().toISOString();
  const confirmedBy = input.confirmed_by ?? "Philip O'Farrell";
  const record: ConfirmedImage = {
    ...input,
    confirmed_at: now,
    confirmed_by: confirmedBy,
  };
  // Upsert · one entry per URL
  const idx = lib.confirmed.findIndex((img) => img.url === input.url);
  if (idx >= 0) lib.confirmed[idx] = record;
  else lib.confirmed.push(record);
  saveLibrary(lib);
  return record;
}

export function unconfirmImage(url: string): boolean {
  const lib = loadLibrary();
  const before = lib.confirmed.length;
  lib.confirmed = lib.confirmed.filter((img) => img.url !== url);
  if (lib.confirmed.length === before) return false;
  saveLibrary(lib);
  return true;
}

// ─── Retrieval ────────────────────────────────────────────────────

export type ImageMatch = {
  image:              ConfirmedImage;
  score:              number;      // raw attribute-overlap score (unchanged · match quality only)
  confidence:         number;      // Philip 2026-08-01 · normalised 0-1 · reflects MATCH quality only, not editorial preference
  ranking_score:      number;      // Philip 2026-08-01 · composite = score + priority_weight + freshness_bonus · used ONLY for sort order
  matched_attributes: string[];
};

// Max score = staircase_type(5) + layout(4) + materials(3×3) + balustrade(3) + style(3) + project(2×2) = 28
const MAX_MATCH_SCORE = 28;

// Philip 2026-08-01 · Image-honesty floor.
// If NO retrieved image reaches this confidence, return an empty list rather
// than surfacing weak/irrelevant designs. This prevents "asked for under-stair
// storage → got a chisel" style failures where the retrieval scored on a single
// weak token overlap.
const MIN_IMAGE_CONFIDENCE = 0.15;

// Philip 2026-08-01 · Design-freshness bonus applied to composite ranking.
// Newer confirmed designs float slightly higher on ties so recent authoring
// gets visibility. Bonus decays over ~90 days.
function freshnessBonus(confirmed_at: string): number {
  const t = new Date(confirmed_at).getTime();
  if (!Number.isFinite(t)) return 0;
  const days = (Date.now() - t) / 86400000;
  if (days < 30) return 5;
  if (days < 90) return 2;
  return 0;
}

// Resolve a record's effective priority weight for ranking:
//  1. ranking_weight (0-100) if explicitly set · direct numeric control
//  2. PRIORITY_WEIGHT[priority] if priority tier is set
//  3. 0 (standard default) if neither is set
function effectivePriorityWeight(image: ConfirmedImage): number {
  if (typeof image.ranking_weight === "number") return image.ranking_weight;
  return PRIORITY_WEIGHT[image.priority ?? "standard"];
}

/**
 * Match confirmed images against a customer query's attribute hints.
 * Only returns confirmed images · never unconfirmed.
 * Scored by attribute overlap · top-N returned.
 */
export function findConfirmedImages(query: {
  staircase_type?:  string;
  layout?:          string;
  materials?:       string[];
  balustrade_style?: string;
  design_style?:    string;
  project_suitability?: string[];
  families?:        DesignFamily[];      // Philip 2026-08-01 · opt-in family filter · defaults to CUSTOMER_DEFAULT_FAMILIES (excludes Components etc.)
}, limit = 5): ImageMatch[] {
  const confirmed = listConfirmedImages();
  if (confirmed.length === 0) return [];

  // Family gate: caller-provided list OR customer default (excludes specialty families like Components)
  const allowedFamilies = new Set<string>(query.families ?? CUSTOMER_DEFAULT_FAMILIES);

  const matches: ImageMatch[] = [];
  for (const image of confirmed) {
    // Records with a design_family MUST be in the allowed set.
    // Records without a design_family (legacy) pass through (they were all staircase designs pre-v2).
    if (image.design_family && !allowedFamilies.has(image.design_family)) continue;

    let score = 0;
    const matched: string[] = [];
    if (query.staircase_type && image.staircase_type.toLowerCase().includes(query.staircase_type.toLowerCase())) {
      score += 5; matched.push(`staircase_type:${image.staircase_type}`);
    }
    if (query.layout && image.layout.toLowerCase().includes(query.layout.toLowerCase())) {
      score += 4; matched.push(`layout:${image.layout}`);
    }
    if (query.materials) {
      for (const m of query.materials) {
        if (image.materials.some((im) => im.toLowerCase().includes(m.toLowerCase()))) {
          score += 3; matched.push(`material:${m}`);
        }
      }
    }
    if (query.balustrade_style && image.balustrade_style.toLowerCase().includes(query.balustrade_style.toLowerCase())) {
      score += 3; matched.push(`balustrade:${image.balustrade_style}`);
    }
    if (query.design_style && image.design_style.toLowerCase().includes(query.design_style.toLowerCase())) {
      score += 3; matched.push(`style:${image.design_style}`);
    }
    if (query.project_suitability) {
      for (const p of query.project_suitability) {
        if (image.project_suitability.some((ip) => ip.toLowerCase().includes(p.toLowerCase()))) {
          score += 2; matched.push(`project:${p}`);
        }
      }
    }
    if (score > 0) {
      const confidence = Math.min(1, score / MAX_MATCH_SCORE);
      // Philip 2026-08-01 · Composite ranking score = raw match + editorial + freshness
      // Sort uses ranking_score · confidence uses match-only so customers see honest fit
      const ranking_score = score + effectivePriorityWeight(image) + freshnessBonus(image.confirmed_at);
      matches.push({ image, score, confidence, ranking_score, matched_attributes: matched });
    }
  }
  // Sort by composite ranking_score DESC · tie-breakers: raw score, then priority weight, then confirmed_at DESC
  matches.sort((a, b) => {
    if (b.ranking_score !== a.ranking_score) return b.ranking_score - a.ranking_score;
    if (b.score !== a.score)                 return b.score - a.score;
    const aw = effectivePriorityWeight(a.image);
    const bw = effectivePriorityWeight(b.image);
    if (bw !== aw)                           return bw - aw;
    return new Date(b.image.confirmed_at).getTime() - new Date(a.image.confirmed_at).getTime();
  });
  // Philip 2026-08-01 · image-honesty floor · discard matches below MIN_IMAGE_CONFIDENCE.
  // Keeps unrelated designs (weak single-token overlap) out of the customer response.
  const above = matches.filter((m) => m.confidence >= MIN_IMAGE_CONFIDENCE);
  return above.slice(0, limit);
}

// ─── Stats ────────────────────────────────────────────────────────

export type LibraryStats = {
  confirmed_count:    number;
  unconfirmed_count:  number;
  updated_at:         string;
};

export function getLibraryStats(unconfirmedTotal: number): LibraryStats {
  const lib = loadLibrary();
  return {
    confirmed_count:   lib.confirmed.length,
    unconfirmed_count: Math.max(0, unconfirmedTotal - lib.confirmed.length),
    updated_at:        lib.updated_at,
  };
}
