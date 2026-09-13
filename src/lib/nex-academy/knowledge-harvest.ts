// WO-ACADEMY-01 · Knowledge Harvest workflow.
//
// MUST precede any DECOMMISSIONED transition. Freezes the agent, collects
// its knowledge contributions, validates them against NEX Intelligence
// scoring thresholds, and transfers ONLY validated knowledge to a
// successor. Rejected assumptions are recorded but NEVER transferred.
//
// Founder verbatim: "A replacement agent should not inherit the old
// agent's failures as truth. Knowledge transfers → mistakes don't
// automatically transfer."

import { randomUUID } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import { provenanceChainHash, sha256Hex } from "@/lib/nex-intelligence/provenance";
import { INTELLIGENCE_THRESHOLDS } from "@/lib/nex-intelligence/scoring";
import type { KnowledgeObject } from "@/lib/nex-intelligence/types";
import type {
  HarvestedContribution,
  KnowledgeHarvest,
  RejectedAssumption,
} from "./types";

// ── Validation ─────────────────────────────────────────────────────────

/**
 * A knowledge object is transferable only if:
 *   - it has status TESTED or above
 *   - its confidence meets Intelligence-tier minimum
 *   - it has at least one non-failed experiment record referenced
 *
 * Anything failing is added to rejected_assumptions with a reason.
 */
export function classifyForHarvest(input: {
  readonly candidate_objects: readonly KnowledgeObject[];
}): {
  readonly validated: readonly KnowledgeObject[];
  readonly rejected: readonly RejectedAssumption[];
} {
  const validated: KnowledgeObject[] = [];
  const rejected: RejectedAssumption[] = [];
  const minConfidence = INTELLIGENCE_THRESHOLDS.min_confidence;
  const rankOK = new Set(["TESTED", "APPROVED", "PRODUCTION", "SUPER_INTELLIGENCE_CANDIDATE", "SUPER_INTELLIGENCE"]);

  for (const obj of input.candidate_objects) {
    if (!rankOK.has(obj.status)) {
      rejected.push({
        assertion: `KnowledgeObject ${obj.knowledge_id}: ${obj.name}`,
        reason: `status ${obj.status} — must be TESTED or higher to transfer`,
      });
      continue;
    }
    if (obj.confidence < minConfidence) {
      rejected.push({
        assertion: `KnowledgeObject ${obj.knowledge_id}: ${obj.name}`,
        reason: `confidence ${obj.confidence.toFixed(2)} below Intelligence-tier minimum ${minConfidence}`,
      });
      continue;
    }
    if (obj.experiments.length === 0) {
      rejected.push({
        assertion: `KnowledgeObject ${obj.knowledge_id}: ${obj.name}`,
        reason: "no experiment evidence — cannot transfer as validated knowledge",
      });
      continue;
    }
    const successes = obj.experiments.filter((e) => e.outcome === "SUCCESS").length;
    if (successes === 0) {
      rejected.push({
        assertion: `KnowledgeObject ${obj.knowledge_id}: ${obj.name}`,
        reason: "zero successful experiments — cannot transfer",
      });
      continue;
    }
    validated.push(obj);
  }
  return { validated, rejected };
}

// ── Build the Harvest record ───────────────────────────────────────────

export function buildKnowledgeHarvest(input: {
  readonly agent_id: string;
  readonly successor_agent_id: string | null;
  readonly candidate_objects: readonly KnowledgeObject[];
  readonly extra_contributions: readonly HarvestedContribution[];
  readonly antecedent_provenance_hashes: readonly string[];
}): KnowledgeHarvest {
  const { validated, rejected } = classifyForHarvest({ candidate_objects: input.candidate_objects });
  const harvest_id = `academy-harvest-${sha256Hex(input.agent_id + Date.now().toString()).slice(0, 16)}`;
  const collected_contributions: HarvestedContribution[] = [
    ...validated.map((obj) => ({
      source_collection: COLLECTIONS.nex_intelligence_knowledge_objects,
      record_id: obj.knowledge_id,
      kind: "useful" as const,
      reason: `status=${obj.status} confidence=${obj.confidence.toFixed(2)}`,
    })),
    ...rejected.map((r) => ({
      source_collection: COLLECTIONS.nex_intelligence_knowledge_objects,
      record_id: r.assertion,
      kind: "reject" as const,
      reason: r.reason,
    })),
    ...input.extra_contributions,
  ];
  const base = {
    record_type: "NEX_ACADEMY_KNOWLEDGE_HARVEST" as const,
    harvest_id,
    agent_id: input.agent_id,
    frozen_at: new Date().toISOString(),
    collected_contributions: Object.freeze(collected_contributions) as readonly HarvestedContribution[],
    validated_knowledge_object_ids: Object.freeze(validated.map((o) => o.knowledge_id)) as readonly string[],
    rejected_assumptions: Object.freeze([...rejected]) as readonly RejectedAssumption[],
    successor_agent_id: input.successor_agent_id,
  };
  return { ...base, provenance_chain_hash: provenanceChainHash(base, input.antecedent_provenance_hashes) };
}

// ── Persistence ────────────────────────────────────────────────────────

export async function persistHarvest(h: KnowledgeHarvest): Promise<void> {
  await getStorage().save(COLLECTIONS.nex_academy_harvests, h);
}

/**
 * Enforcement: DECOMMISSIONED cannot be entered without a matching harvest.
 * The AcademyRecord state transition to DECOMMISSIONED requires the caller
 * to have persisted a KnowledgeHarvest whose agent_id matches. This helper
 * queries storage to verify.
 */
export async function canDecommission(agent_id: string): Promise<boolean> {
  const rows = await getStorage().query<KnowledgeHarvest>(COLLECTIONS.nex_academy_harvests, {
    where: { agent_id },
    limit: 1,
  });
  return rows.length > 0;
}
