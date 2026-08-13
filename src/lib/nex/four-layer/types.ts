// Four-Layer Distinction · types + reference table (Philip 2026-08-04).
//
// Every stored fact in Nex belongs to exactly one of these four layers.
// Consumers can walk backwards through the chain (Decision → Knowledge →
// Observation → Evidence) without ambiguity.
//
// Doctrine: docs/brains/nex-four-layer-distinction-philip-2026-08-04.md

export type Layer = "evidence" | "observations" | "knowledge" | "decisions";

export const LAYER_ORDER: readonly Layer[] = ["evidence", "observations", "knowledge", "decisions"];

export const LAYER_DESCRIPTION: Record<Layer, string> = {
  evidence: "Original photos · scans · sketches · documents. What we RECEIVED.",
  observations: "Facts extracted from evidence · each with provenance and confidence. What we DERIVED.",
  knowledge: "Normalised objects and relationships (e.g. 'closed string staircase', 'oak tread'). What we KNOW.",
  decisions: "User-approved changes · recommendations · final design choices. What was CHOSEN.",
};

export const LAYER_QUESTION: Record<Layer, string> = {
  evidence: "What did we receive?",
  observations: "What did we observe?",
  knowledge: "What do we know?",
  decisions: "What did the user choose?",
};

export type LayerAttribution = {
  module_id: string;                     // e.g. "asset-platform/asset-library"
  layer: Layer;
  role: string;                          // human-readable role within the layer
};

/** Canonical mapping of every existing platform module to its Layer.
 *  Every new module added to Nex MUST register here before merge. */
export const LAYER_MAP: readonly LayerAttribution[] = [
  // ─── Evidence ────────────────────────────────────────────────────────
  { module_id: "asset-platform/asset-library", layer: "evidence", role: "UniversalAsset · raw URLs · file_hash · storage keys" },

  // ─── Observations ────────────────────────────────────────────────────
  { module_id: "vision-intelligence", layer: "observations", role: "extract objects · shapes · relationships · mood · Style DNA from one image" },
  { module_id: "sketch-intelligence", layer: "observations", role: "9-stage interpretation of a single sketch with per-component confidence" },
  { module_id: "reality-reconstruction", layer: "observations", role: "N photos → Room + Walls + Openings + Measurements with Confidence bands" },
  { module_id: "spatial/measurement", layer: "observations", role: "numeric facts + Confidence · calibration · derived estimation" },
  { module_id: "visual-knowledge-extraction", layer: "observations", role: "orchestrates evidence → observations · writes to Design Memory" },

  // ─── Knowledge ───────────────────────────────────────────────────────
  { module_id: "object-library", layer: "knowledge", role: "ObjectDNA · normalised · reusable · versioned" },
  { module_id: "material-platform/catalog", layer: "knowledge", role: "MaterialIntelligence catalog · authored per Rule c" },
  { module_id: "material-platform/physics", layer: "knowledge", role: "MaterialPhysics · structured material behaviour" },
  { module_id: "construction-platform/rules", layer: "knowledge", role: "authored construction rules with regulation citations" },
  { module_id: "knowledge-layer", layer: "knowledge", role: "authored + inherited domain FAQs · articles · Bronze/Silver/Gold" },
  { module_id: "design-platform/design-object", layer: "knowledge", role: "formal DesignObject taxonomy" },
  { module_id: "geometry-platform", layer: "knowledge", role: "GeometryObject + CameraObject + LightingObject + RenderTarget catalogs" },
  { module_id: "pattern-learning", layer: "knowledge", role: "mined co-occurrence patterns become reusable Knowledge" },
  { module_id: "design-dna", layer: "knowledge", role: "project-level fingerprints · aggregated Knowledge" },
  { module_id: "visual-learning", layer: "knowledge", role: "bridge · consumes Observations · updates Knowledge" },
  { module_id: "renderer/tokens", layer: "knowledge", role: "theme packs · fonts · spacing tokens" },
  { module_id: "renderer/design-sizes", layer: "knowledge", role: "66-format Design Sizes registry" },
  { module_id: "renderer/font-catalog", layer: "knowledge", role: "11-role × 6-personality font catalog" },
  { module_id: "scene-platform", layer: "knowledge", role: "Room composition types + helpers" },

  // ─── Decisions ───────────────────────────────────────────────────────
  { module_id: "design-history", layer: "decisions", role: "every recorded Operation is a Decision · versioned · branchable" },
  { module_id: "design-memory/final_approved_version", layer: "decisions", role: "user's canonical choice per project version" },
  { module_id: "editing-platform", layer: "decisions", role: "parsed EditCommand → Operation is a user Decision" },
  { module_id: "reality-advisor (when accepted)", layer: "decisions", role: "advisory concerns accepted by user or Planner become Decisions" },
  { module_id: "pipeline/recommend (when accepted)", layer: "decisions", role: "recommendations accepted from a set become Decisions" },
];

/** Read-only across all four layers · never mutates state · never adds a fact.
 *  Voice Intelligence and Image Critic are the reference read-only consumers. */
export const READ_ONLY_ACROSS_LAYERS = new Set(["voice-platform", "image-critic"]);
