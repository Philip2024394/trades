// WO-INTELLIGENCE-01 · orchestrator.
//
// Wires the full Discovery Core loop end-to-end:
//
//   crawler → ingestion → discovery → hypothesis → experiment
//   → scoring → promotion → proposal
//
// Deliberately DOES NOT authorise anything. Emits a proposal at the end;
// activation still requires a founder-signed WO on that proposal.

import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import type {
  CrawlerManifest,
  DiscoveryRecord,
  ExperimentRecord,
  HypothesisRecord,
  KnowledgeFragment,
  KnowledgeObject,
  ProposalRecord,
  SourceRecord,
} from "./types";
import { crawlerFetch, type HttpRequestFn } from "./crawler";
import { ingestSource } from "./ingestion";
import {
  detectPatterns,
  detectConflicts,
  detectConnections,
  detectCombinations,
} from "./discovery-engine";
import { formHypothesis, persistHypothesis } from "./hypothesis-engine";
import { runParseStderrExperiment, persistExperiment, type ParseStderrTestCase } from "./experiment-engine";
import { buildKnowledgeObject, decidePromotion, scoreEvidence } from "./scoring";
import { buildProposal, emitProposal } from "./proposal";

export interface RunDiscoveryCoreInput {
  readonly manifest: CrawlerManifest;
  readonly trusted_attestation_keys?: readonly string[];
  readonly fetch_url: string;
  readonly query_predicates?: readonly string[];
  readonly match_categories?: readonly string[];
  readonly sandbox_root: string;
  readonly stderr_test_cases: readonly ParseStderrTestCase[];
  /** Test-only. */
  readonly _http_override?: HttpRequestFn;
}

export interface DiscoveryCoreResult {
  readonly source: SourceRecord;
  readonly fragments: readonly KnowledgeFragment[];
  readonly discoveries: readonly DiscoveryRecord[];
  readonly hypotheses: readonly HypothesisRecord[];
  readonly experiments: readonly ExperimentRecord[];
  readonly knowledge_objects: readonly KnowledgeObject[];
  readonly proposals: readonly ProposalRecord[];
}

export async function runDiscoveryCore(input: RunDiscoveryCoreInput): Promise<DiscoveryCoreResult> {
  // 1. Crawler fetch (Broker-gated)
  const fetchResult = await crawlerFetch({
    manifest: input.manifest,
    trusted_attestation_keys: input.trusted_attestation_keys,
    url: input.fetch_url,
    method: "GET",
    query_predicates: input.query_predicates,
    match_categories: input.match_categories,
    _http_override: input._http_override,
  });
  if (!fetchResult.ok) {
    throw new Error(`[nex-intelligence] crawler fetch refused: ${fetchResult.reason_code} · ${fetchResult.reason}`);
  }
  const source = fetchResult.source;

  // 2. Ingestion
  const fragments = ingestSource(source);
  if (fragments.length < 2) {
    // Not an error — an empty or near-empty feed produces no discoveries.
    // The orchestrator still emits an empty-run result for auditability.
    return { source, fragments, discoveries: [], hypotheses: [], experiments: [], knowledge_objects: [], proposals: [] };
  }

  // 3. Discovery Engine — all four modes
  const patterns = detectPatterns(fragments);
  const conflicts = detectConflicts(fragments);
  const connections = detectConnections(fragments);
  const combinations = detectCombinations(patterns);
  const discoveries: DiscoveryRecord[] = [...patterns, ...conflicts, ...connections, ...combinations];

  // 4. Hypothesis Engine — pick the highest-signal COMBINATION (falling
  //    back to highest-signal PATTERN) and form a hypothesis. Slice 1
  //    intentionally produces ONE hypothesis; slice 2+ can fan out.
  const rankedForHypothesis: DiscoveryRecord[] = [
    ...combinations.slice().sort((a, b) => b.signal_score - a.signal_score),
    ...patterns.slice().sort((a, b) => b.signal_score - a.signal_score),
  ];
  const hypotheses: HypothesisRecord[] = [];
  for (const d of rankedForHypothesis) {
    const h = formHypothesis(d, fragments);
    if (h) { hypotheses.push(h); break; }
  }
  if (hypotheses.length === 0) {
    return { source, fragments, discoveries, hypotheses, experiments: [], knowledge_objects: [], proposals: [] };
  }
  await persistHypothesis(hypotheses[0]);

  // 5. Experiment Engine — run the parse-stderr test set against the
  //    one hypothesis. This is the ONLY experiment kind slice 1 supports.
  const experiment = await runParseStderrExperiment({
    hypothesis: hypotheses[0],
    test_cases: input.stderr_test_cases,
    sandbox_root: input.sandbox_root,
  });
  await persistExperiment(experiment);
  const experiments: ExperimentRecord[] = [experiment];

  // 6. Score
  const score = scoreEvidence({
    source_count: 1 + fragments.length,   // 1 crawler source + N paper fragments
    experiment,
    correlation_count: connections.length,
    generalisation_passed: false,          // slice 1 has no held-out gen set yet
    contradiction_count: conflicts.length,
    reproduced_by_nex: false,              // slice 1 does not run a NEX-owned reproduction
    synthesised_from_count: combinations.length,
  });

  // 7. Promote
  const decision = decidePromotion("DISCOVERED", score);

  // 8. Build KnowledgeObject
  const knowledge = buildKnowledgeObject({
    name: `intel-discovery-cycle-${new Date().toISOString().slice(0, 10)}`,
    domain: "software-engineering",
    source_evidence: fragments.map((f) => ({
      source_id: source.source_id,
      fragment_id: f.fragment_id,
      excerpt_hash: f.content_hash_sha256,
      relevance_score: 1.0,
    })),
    experiments: [{
      experiment_id: experiment.experiment_id,
      outcome: experiment.success_count >= experiment.failure_count ? "SUCCESS" : "FAILURE",
      evidence_hash: experiment.provenance_chain_hash,
    }],
    limitations: [],
    recommended_use: ["diagnostic-signal-detection", "cross-referenced-with-wo7-parser"],
    agent_capability_affected: "wo7-run-specialist",
    score,
    targetStatus: decision.targetStatus,
    synthesised_from: hypotheses[0].formed_from_fragment_ids,
    antecedent_provenance_hashes: [source.provenance_chain_hash, ...discoveries.map((d) => d.provenance_chain_hash), hypotheses[0].provenance_chain_hash, experiment.provenance_chain_hash],
  });
  await getStorage().save(COLLECTIONS.nex_intelligence_knowledge_objects, knowledge);

  // 9. Proposal
  const proposal = buildProposal(knowledge);
  await emitProposal(proposal);

  return { source, fragments, discoveries, hypotheses, experiments, knowledge_objects: [knowledge], proposals: [proposal] };
}
