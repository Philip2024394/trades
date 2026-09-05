// src/lib/nex/brain/entity-pipeline.ts
//
// Universal Entity Intelligence Pipeline — observable stages
// Philip 2026-09-06 · AUTHORIZE · Universal Entity Intelligence v2
//
// PURPOSE
//   Formalize the intended NEX entity lifecycle as a set of named
//   OBSERVABLE stages so the rest of the codebase (and downstream
//   observability) can reason about which stage each attribute value
//   passed through:
//
//     DISCOVER → COLLECT → NORMALIZE → ENRICH → VERIFY → STORE → RANK → PRESENT
//
//   Some stages are already implemented by existing modules (COLLECT
//   via nex.accommodation_business ingestion; STORE via Postgres;
//   PRESENT via presentation.ts). Others (ENRICH, VERIFY) are largely
//   noops today. This module STATES the contract so we can:
//     (a) observe what stage each attribute value came from,
//     (b) know which stages still need implementation, and
//     (c) prevent silent expansion of a stage into another (e.g. don't
//         let PRESENT invent data that should have been ENRICHED).
//
// NON-GOAL
//   This module does NOT run any of the stages. It documents them,
//   provides observability primitives, and lets other modules attach
//   stage annotations to their outputs.

// ─── Stage catalog ─────────────────────────────────────────────

export const PIPELINE_STAGES = [
  "DISCOVER",
  "COLLECT",
  "NORMALIZE",
  "ENRICH",
  "VERIFY",
  "STORE",
  "RANK",
  "PRESENT",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/** Purpose statement per stage · used for observability + documentation. */
export const PIPELINE_STAGE_PURPOSE: Record<PipelineStage, string> = {
  DISCOVER:  "Locate candidate entities via permitted sources (OSM Overpass, referral, admin seed).",
  COLLECT:   "Fetch the raw evidence for each candidate (source snapshot, tags, structured fields).",
  NORMALIZE: "Canonicalize identity, tokens, coordinates, category · fold aliases to a single shape.",
  ENRICH:    "Attach additional evidence where available (owner claim payload, images, hours, room detail).",
  VERIFY:    "Elevate evidence to authoritative status via owner attestation or trusted external check.",
  STORE:     "Persist canonical record + provenance metadata behind the visibility gate.",
  RANK:      "Score candidates against a query · pick the top-N for presentation.",
  PRESENT:   "Compose a PresentedCard / EntityResultCard from stored evidence · no data invention.",
};

/** Which existing NEX module currently implements each stage (or notes
 *  it as unimplemented). Documentation-grade truth · used in the report. */
export const PIPELINE_STAGE_IMPLEMENTATION: Record<PipelineStage, {
  status: "implemented" | "partial" | "unimplemented";
  where: string;
}> = {
  DISCOVER:  { status: "implemented",   where: "src/lib/nex/indonesia/live/osm-overpass.ts (OSM Overpass acquisition)" },
  COLLECT:   { status: "implemented",   where: "nex.accommodation_business_source_snapshot (raw OSM tag capture per Task #85 pattern)" },
  NORMALIZE: { status: "partial",       where: "accommodation-postgres.ts adapter (rowToRecord fold-to-canonical), directory-knowledge.ts (tokenization)" },
  ENRICH:    { status: "unimplemented", where: "nex.accommodation_enrichment_evidence table is pre-staged (Task #89 Phase C) · no ingestion pipeline yet" },
  VERIFY:    { status: "partial",       where: "owner_status column tracks {unknown, contacted, responded, verified} · no automated verifier" },
  STORE:     { status: "implemented",   where: "nex.accommodation_business + claim_status visibility gate" },
  RANK:      { status: "implemented",   where: "world adapter search() ORDER BY rating DESC, updated_at DESC, name ASC" },
  PRESENT:   { status: "implemented",   where: "presentation.ts + entity-result-cards.ts (this project)" },
};

/**
 * Attribute-stage annotation · lets other modules tag WHICH pipeline
 * stage produced their evidence. Attached to an AttributeMapEntry via
 * `annotate` when useful. Never mutates the underlying entry.
 */
export type PipelineAnnotation = {
  stage: PipelineStage;
  source: string;                  // e.g. "amenities[]", "OSM tag", "owner-claim payload"
  note?: string;                   // optional detail
};

export function isPipelineStage(x: unknown): x is PipelineStage {
  return typeof x === "string" && (PIPELINE_STAGES as readonly string[]).includes(x);
}

/**
 * Compute which stages are represented in a set of annotations.
 * Useful for the coverage report: "we have DISCOVER + COLLECT + STORE +
 * PRESENT evidence but no VERIFY evidence for this entity".
 */
export function stagesPresent(annotations: readonly PipelineAnnotation[]): PipelineStage[] {
  const seen = new Set<PipelineStage>();
  for (const a of annotations) if (isPipelineStage(a.stage)) seen.add(a.stage);
  return PIPELINE_STAGES.filter((s) => seen.has(s));
}

/**
 * The intended stage-ordering invariant. A downstream stage should not
 * receive evidence that skipped an upstream stage in a way that would
 * violate the contract. Currently informational only.
 */
export function stageIndex(stage: PipelineStage): number {
  return PIPELINE_STAGES.indexOf(stage);
}

/**
 * Given an attribute's evidence tier + provenance, infer the LATEST
 * pipeline stage the evidence passed through. Used by attribute-query
 * observability to explain why a particular reply was chosen.
 *
 * Heuristics:
 *   - Directory-listed evidence (unclaimed / invited) has passed
 *     DISCOVER + COLLECT + STORE. It has NOT been VERIFIED.
 *   - Owner-verified evidence has additionally passed VERIFY.
 *   - Amenity-token evidence (fully soft) has typically not been
 *     normalized to a structured attribute contract until now — call it
 *     NORMALIZE at best when we successfully resolved it.
 */
export function inferLatestStage(evidenceTier: "owner_verified" | "authoritative" | "directory" | "unknown" | undefined): PipelineStage | null {
  if (!evidenceTier || evidenceTier === "unknown") return null;
  if (evidenceTier === "owner_verified" || evidenceTier === "authoritative") return "VERIFY";
  // directory-tier evidence has been STORE'd but not VERIFY'd
  return "STORE";
}
