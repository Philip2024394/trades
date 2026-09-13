// WO-ACADEMY-02 · RuleAdditionProposal emitter.
//
// A proposal is emitted ONLY when the verdict is IMPROVED. The proposal
// records the candidate rules and the evidence chain, but NEVER carries
// an authorised_by / authorising_wo_id. Adoption requires a founder-
// signed WO through the existing WO-03 pipeline.

import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import { provenanceChainHash, sha256Hex } from "@/lib/nex-intelligence/provenance";
import type {
  RuleAdditionProposal,
  TrainingRun,
  TrainingVerdict,
} from "./types";

export interface BuildProposalInput {
  readonly run: TrainingRun;
  readonly verdict: TrainingVerdict;   // MUST be IMPROVED — enforced by the caller
  readonly target_agent_id: string;
  readonly target_module_path: string;
}

/**
 * Build a RuleAdditionProposal. Refuses to build one unless the verdict
 * is IMPROVED. Never sets authorised_by / authorising_wo_id — those
 * are set (if ever) by a subsequent founder-signed WO.
 */
export function buildProposal(input: BuildProposalInput): RuleAdditionProposal | { readonly refused: true; readonly reason: string } {
  if (input.verdict.kind !== "IMPROVED") {
    return {
      refused: true,
      reason: `verdict was ${input.verdict.kind}; RuleAdditionProposal emitted ONLY on IMPROVED (§8 A-8)`,
    };
  }
  if (input.run.candidate_rules.length === 0) {
    return { refused: true, reason: "no candidate rules to propose" };
  }
  // Use the first candidate rule (slice-1 emits one proposal per run)
  const cr = input.run.candidate_rules[0];
  const proposal_id = `academy-proposal-${sha256Hex(input.run.run_id + cr.rule_id).slice(0, 16)}`;
  const base = {
    record_type: "NEX_ACADEMY_RULE_ADDITION_PROPOSAL" as const,
    proposal_id,
    training_run_id: input.run.run_id,
    target_agent_id: input.target_agent_id,
    target_module_path: input.target_module_path,
    proposed_rule: {
      rule_id: cr.rule_id,
      description: cr.description,
      pattern_or_predicate: cr.pattern_regex,
      finding_rule: cr.finding_rule,
      evidence_pointers: Object.freeze(
        input.run.post_baseline_outcomes.filter((o) => o.outcome === "SUCCESS").map((o) => o.evidence_pointer),
      ) as readonly string[],
    },
    recommended_wo_action: `Founder review: sign a WO to add candidate rule "${cr.rule_id}" to ${input.target_module_path}. Verify: (1) evidence chain traces from frozen baseline ${input.verdict.baseline_id} through training run ${input.run.run_id} to verdict IMPROVED; (2) targeted weakness delta ${input.verdict.deltas.targeted_weakness_score.toFixed(2)} exceeds threshold; (3) held-out generalisation ${input.verdict.held_out_success_ratio.toFixed(2)} + adversarial ${input.verdict.adversarial_success_ratio.toFixed(2)} both above thresholds; (4) zero regression failures.`,
    authorised_by: null as null,
    authorising_wo_id: null as null,
  };
  return { ...base, provenance_chain_hash: provenanceChainHash(base, [input.verdict.provenance_chain_hash]) };
}

export async function persistProposal(p: RuleAdditionProposal): Promise<void> {
  await getStorage().save(COLLECTIONS.nex_academy_rule_addition_proposals, p);
}
