// WO-INTELLIGENCE-02 · deterministic revisit loop.
//
// OLD KNOWLEDGE → REVISIT → NEW EVIDENCE → COMPARE → CONFIRM/UPDATE/SUPERSEDE/REJECT
//
// Immutability discipline: the old KnowledgeObject bytes on disk are NEVER
// modified. A revisit produces a RevisitRecord and, when it changes state,
// a NEW KnowledgeObject (with `supersedes: [old_id]`) plus a SupersedeEdge
// record linking them. The old object may gain a follow-up marker via
// the edge record but its stored bytes stay intact.
//
// The verdict function is a pure function of the evidence delta —
// same delta → same verdict, always.

import { randomUUID } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import { provenanceChainHash, sha256Hex } from "./provenance";
import type {
  ExperimentRecord,
  KnowledgeObject,
  RevisitRecord,
  RevisitVerdict,
  SupersedeEdge,
} from "./types";

// ── Founder-locked thresholds (spec §6) ────────────────────────────────

export const REVISIT_THRESHOLDS = Object.freeze({
  min_new_evidence: 2,
  THRESHOLD_STABLE: 0.05,       // |delta| ≤ 0.05 → CONFIRM
  THRESHOLD_UPDATE: 0.20,       // 0.05 < |delta| ≤ 0.20 → UPDATE
  THRESHOLD_SUPERSEDE: 0.20,    // delta ≤ -0.20 (drop of 20%+) → SUPERSEDE
  THRESHOLD_REJECT_CONTRADICTIONS: 3,
});

// ── Verdict function (pure) ────────────────────────────────────────────

export interface RevisitVerdictInput {
  readonly new_evidence_count: number;
  readonly previous_confidence: number;
  readonly recomputed_confidence: number;
  readonly new_contradiction_count: number;
}

export function decideRevisitVerdict(input: RevisitVerdictInput): { verdict: RevisitVerdict; rationale: string } {
  const t = REVISIT_THRESHOLDS;
  if (input.new_evidence_count < t.min_new_evidence) {
    return {
      verdict: "INSUFFICIENT_NEW_EVIDENCE",
      rationale: `${input.new_evidence_count} new evidence < min ${t.min_new_evidence}`,
    };
  }
  const delta = input.recomputed_confidence - input.previous_confidence;
  const absDelta = Math.abs(delta);

  // REJECT dominates when there are enough contradictions
  if (input.new_contradiction_count >= t.THRESHOLD_REJECT_CONTRADICTIONS) {
    return {
      verdict: "REJECT",
      rationale: `${input.new_contradiction_count} unresolved contradictions ≥ threshold ${t.THRESHOLD_REJECT_CONTRADICTIONS}`,
    };
  }

  // SUPERSEDE when confidence dropped 20%+ (regardless of direction of contradiction count)
  if (delta <= -t.THRESHOLD_SUPERSEDE) {
    return {
      verdict: "SUPERSEDE",
      rationale: `confidence dropped ${(delta * -1).toFixed(3)} ≥ threshold ${t.THRESHOLD_SUPERSEDE}`,
    };
  }

  // CONFIRM when the change is small
  if (absDelta <= t.THRESHOLD_STABLE) {
    return {
      verdict: "CONFIRM",
      rationale: `confidence stable within ±${t.THRESHOLD_STABLE} (delta ${delta.toFixed(3)})`,
    };
  }

  // UPDATE for meaningful but non-drop deltas
  if (absDelta <= t.THRESHOLD_UPDATE) {
    return {
      verdict: "UPDATE",
      rationale: `confidence changed ${delta.toFixed(3)} within update band (±${t.THRESHOLD_UPDATE})`,
    };
  }

  // Positive delta ≥ 0.20 (huge gain) also treated as UPDATE — the old
  // object is not superseded because it was correct, just improvable.
  return {
    verdict: "UPDATE",
    rationale: `confidence gained ${delta.toFixed(3)} — new stronger version warranted`,
  };
}

// ── Building revisit records + supersede edges (pure) ──────────────────

export interface BuildRevisitInput {
  readonly target: KnowledgeObject;
  readonly new_evidence_source_ids: readonly string[];
  readonly new_evidence_experiment_ids: readonly string[];
  readonly recomputed_confidence: number;
  readonly new_contradiction_count: number;
  readonly resulting_knowledge_id: string | null;   // null for CONFIRM/REJECT/INSUFFICIENT; set for UPDATE/SUPERSEDE
}

export function buildRevisitRecord(input: BuildRevisitInput): RevisitRecord {
  const revisit_id = `intel-revisit-${sha256Hex(input.target.knowledge_id + Date.now().toString()).slice(0, 16)}`;
  const decision = decideRevisitVerdict({
    new_evidence_count: input.new_evidence_source_ids.length + input.new_evidence_experiment_ids.length,
    previous_confidence: input.target.confidence,
    recomputed_confidence: input.recomputed_confidence,
    new_contradiction_count: input.new_contradiction_count,
  });
  const base = {
    record_type: "NEX_INTELLIGENCE_REVISIT" as const,
    revisit_id,
    target_knowledge_id: input.target.knowledge_id,
    target_version: input.target.version,
    triggered_at: new Date().toISOString(),
    new_evidence_source_ids: Object.freeze([...input.new_evidence_source_ids]) as readonly string[],
    new_evidence_experiment_ids: Object.freeze([...input.new_evidence_experiment_ids]) as readonly string[],
    previous_confidence: input.target.confidence,
    recomputed_confidence: input.recomputed_confidence,
    confidence_delta: input.recomputed_confidence - input.target.confidence,
    new_contradiction_count: input.new_contradiction_count,
    verdict: decision.verdict,
    verdict_rationale: decision.rationale,
    resulting_knowledge_id: input.resulting_knowledge_id,
  };
  return { ...base, provenance_chain_hash: provenanceChainHash(base, [input.target.provenance_chain_hash]) };
}

export function buildSupersedeEdge(input: {
  readonly from_knowledge_id: string;
  readonly to_knowledge_id: string;
  readonly revisit_id: string;
  readonly kind: "UPDATE" | "SUPERSEDE";
  readonly antecedent_provenance_hashes: readonly string[];
}): SupersedeEdge {
  const edge_id = `intel-supersede-${sha256Hex(input.from_knowledge_id + input.to_knowledge_id).slice(0, 16)}`;
  const base = {
    record_type: "NEX_INTELLIGENCE_SUPERSEDE_EDGE" as const,
    edge_id,
    from_knowledge_id: input.from_knowledge_id,
    to_knowledge_id: input.to_knowledge_id,
    created_at: new Date().toISOString(),
    revisit_id: input.revisit_id,
    kind: input.kind,
  };
  return { ...base, provenance_chain_hash: provenanceChainHash(base, input.antecedent_provenance_hashes) };
}

// ── Persistence helpers ────────────────────────────────────────────────

export async function persistRevisit(r: RevisitRecord): Promise<void> {
  await getStorage().save(COLLECTIONS.nex_intelligence_revisits, r);
}

export async function persistSupersedeEdge(e: SupersedeEdge): Promise<void> {
  await getStorage().save(COLLECTIONS.nex_intelligence_supersede_edges, e);
}
