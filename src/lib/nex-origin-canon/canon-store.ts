// src/lib/nex-origin-canon/canon-store.ts
//
// NEX1 · ORIGIN CANON · READ-ONLY LOADER.
//
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// Discipline:
//   · READ-ONLY. No write function exists. Canon changes require founder
//     ADRs + canon_version bumps.
//   · Deterministic. No LLM. No fabrication.
//   · Never fabricates on missing files · loader throws instead.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  CanonDocument,
  CanonClaim,
  KnowledgeStatesDoc,
  HistoricalLayersDoc,
} from "./types";

let CANON_CACHE: CanonDocument | null = null;
let STATES_CACHE: KnowledgeStatesDoc | null = null;
let LAYERS_CACHE: HistoricalLayersDoc | null = null;

export function loadCanon(): CanonDocument {
  if (CANON_CACHE) return CANON_CACHE;
  const p = resolve(process.cwd(), "data/nex1-origin-canon/canon-v0.1.0.json");
  CANON_CACHE = JSON.parse(readFileSync(p, "utf8")) as CanonDocument;
  return CANON_CACHE;
}
export function loadKnowledgeStates(): KnowledgeStatesDoc {
  if (STATES_CACHE) return STATES_CACHE;
  const p = resolve(process.cwd(), "data/nex1-origin-canon/knowledge-states.json");
  STATES_CACHE = JSON.parse(readFileSync(p, "utf8")) as KnowledgeStatesDoc;
  return STATES_CACHE;
}
export function loadHistoricalLayers(): HistoricalLayersDoc {
  if (LAYERS_CACHE) return LAYERS_CACHE;
  const p = resolve(process.cwd(), "data/nex1-origin-canon/historical-layers.json");
  LAYERS_CACHE = JSON.parse(readFileSync(p, "utf8")) as HistoricalLayersDoc;
  return LAYERS_CACHE;
}

export function _resetCanonCache(): void {
  CANON_CACHE = null;
  STATES_CACHE = null;
  LAYERS_CACHE = null;
}

// ─── Convenience lookups ──────────────────────────────────────────

export function claimById(id: string): CanonClaim | undefined {
  return loadCanon().claims.find((c) => c.claim_id === id);
}

export function claimsByStatus(status: CanonClaim["status"]): readonly CanonClaim[] {
  return loadCanon().claims.filter((c) => c.status === status);
}

export function claimsByKnowledgeState(state: CanonClaim["knowledge_state"]): readonly CanonClaim[] {
  return loadCanon().claims.filter((c) => c.knowledge_state === state);
}

export function claimsByLayer(layer: number): readonly CanonClaim[] {
  return loadCanon().claims.filter((c) => c.layer === layer);
}

/**
 * @summary A public-safe projection of the canon · strips forbidden_semantic_scope
 * detail from claims whose status is RESTRICTED_CANON so that publishing the
 * projection cannot itself leak protected material. Founder rule 2026-09-12:
 * reveal cadence is HOLD until canon is mature · this projection remains
 * Lab-internal until authorised.
 */
export interface PublicSafeClaim {
  readonly claim_id: string;
  readonly topic: string;
  readonly layer: number;
  readonly status: CanonClaim["status"];
  readonly knowledge_state: CanonClaim["knowledge_state"];
  readonly canonical_meaning: string;
  readonly reality_disclaimer_required: boolean;
}
export function publicSafeProjection(): readonly PublicSafeClaim[] {
  return loadCanon().claims.map((c) => ({
    claim_id: c.claim_id,
    topic: c.topic,
    layer: c.layer,
    status: c.status,
    knowledge_state: c.knowledge_state,
    // Restrict semantic-meaning surface for RESTRICTED_CANON entries so we don't
    // leak protected content in the public projection even if the surface is
    // eventually exposed. LOCKED / SUPPORTED / UNRESOLVED / NON_CANON pass through.
    canonical_meaning: c.status === "RESTRICTED_CANON"
      ? "restricted · disclosure blocked by Origin Protection Rule"
      : c.canonical_meaning,
    reality_disclaimer_required: c.reality_disclaimer_required,
  }));
}
