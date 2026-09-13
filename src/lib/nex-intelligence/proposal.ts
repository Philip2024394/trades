// WO-INTELLIGENCE-01 · proposal generator.
//
// Emits a ProposalRecord to the founder inbox. NEVER signs. NEVER
// activates. Records the deterministic score at emit time so the founder
// can recompute the same score at review time (evidence is
// content-addressable; the score is a pure function of the evidence).

import { randomUUID } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import { provenanceChainHash, sha256Hex } from "./provenance";
import type { KnowledgeObject, ProposalRecord } from "./types";

export function buildProposal(obj: KnowledgeObject): ProposalRecord {
  const kind = obj.status === "SUPER_INTELLIGENCE_CANDIDATE"
    ? "PROMOTION_SUPER_INTELLIGENCE"
    : obj.status === "APPROVED"
      ? "PROMOTION_INTELLIGENCE"
      : obj.status === "DEPRECATED"
        ? "DEPRECATION"
        : "PROMOTION_INTELLIGENCE";

  const evidence_summary = [
    `KnowledgeObject: ${obj.name} (id: ${obj.knowledge_id})`,
    `Domain: ${obj.domain}`,
    `Current status: ${obj.status}`,
    `Independent source evidence count: ${obj.source_evidence.length}`,
    `Experiments run: ${obj.experiments.length}`,
    `  · SUCCESS: ${obj.experiments.filter((e) => e.outcome === "SUCCESS").length}`,
    `  · FAILURE: ${obj.experiments.filter((e) => e.outcome === "FAILURE").length}`,
    `  · LIMITATION: ${obj.experiments.filter((e) => e.outcome === "LIMITATION").length}`,
    `Confidence: ${obj.confidence.toFixed(3)}`,
    `Reproducibility score: ${obj.reproducibility_score.toFixed(3)}`,
    `Correlation count: ${obj.correlation_count}`,
    `Generalisation passed: ${obj.generalisation_passed}`,
    `Synthesised from: ${obj.synthesised_from.length} antecedent(s)`,
    `Recommended use: ${obj.recommended_use.join(", ") || "(none specified)"}`,
    `Known limitations: ${obj.limitations.length}`,
  ].join("\n");

  const recommended_wo_action = kind === "PROMOTION_SUPER_INTELLIGENCE"
    ? `Founder review: sign WO to promote KnowledgeObject ${obj.knowledge_id} to SUPER_INTELLIGENCE status. Verify: (1) independent-source evidence ≥ 7 and unforged; (2) experiments reproduced by NEX; (3) generalisation-set outcomes acceptable; (4) at least 3 correlations with existing Super Intelligence objects; (5) confidence ≥ 0.95.`
    : kind === "PROMOTION_INTELLIGENCE"
      ? `Founder review: sign WO to promote KnowledgeObject ${obj.knowledge_id} from APPROVED to PRODUCTION status. Verify: (1) source evidence unforged; (2) experiment reproducibility; (3) recommended-use scope aligns with existing capability manifest.`
      : `Founder review: sign WO to formally deprecate KnowledgeObject ${obj.knowledge_id}. Verify: (1) superseding evidence exists; (2) no PRODUCTION code path currently depends on this object.`;

  const proposal_id = `intel-proposal-${sha256Hex(obj.knowledge_id + obj.status).slice(0, 16)}`;
  const base = {
    record_type: "NEX_INTELLIGENCE_PROPOSAL" as const,
    proposal_id,
    emitted_at: new Date().toISOString(),
    kind,
    target_knowledge_id: obj.knowledge_id,
    evidence_summary,
    recommended_wo_action,
    deterministic_score: obj.confidence,
  };
  return { ...base, provenance_chain_hash: provenanceChainHash(base, [obj.provenance_chain_hash]) };
}

export async function emitProposal(proposal: ProposalRecord): Promise<void> {
  await getStorage().save(COLLECTIONS.nex_intelligence_proposals, proposal);
}
