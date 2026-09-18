// src/lib/nex-agent/code-engine/native-investigation-mode.ts
//
// NEX1 · Native Investigation Mode · deterministic · zero LLM · READ-ONLY.
//
// Fix 1 (from Level-1 diagnostic 2026-09-16 · CONNECTION classification).
// Founder Work Order 2026-09-16: give NEX1 deterministic eyes and evidence
// access so it can investigate a natural-language coding problem WITHOUT
// requiring an LLM and WITHOUT modifying anything.
//
// Composition (all existing primitives · zero new capability):
//   1) classifyFounderIntent   (Capability A · deterministic)
//   2) FileMemoryStore.listFiles({ tag })   (Capability M-1 · already built)
//   3) FileMemoryStore.recallFile(path)     (Capability M-1)
//   4) IndependentObserver.walk(workspace_root)   (G11 · read-only)
//   5) buildDependencyGraph({ workspace_root, file_paths })   (Native Code S2)
//
// SAFETY:
//   · No file writes anywhere · no broker calls · no spawn
//   · Respects REQUIRED_FORBIDDEN_PATH_PREFIXES via read-only inspection
//   · Bounded investigation budget · no autonomous unbounded loops
//   · Honest INSUFFICIENT_EVIDENCE when the corpus + concepts don't converge
//   · Zero LLM · zero fabricated files · zero invented candidates
//
// ACCEPTANCE per founder §17:
//   A. Natural language problem → investigation intent (via classifier)
//   B. Candidate files obtained WITHOUT founder providing file paths
//   C. Bounded deterministic search (via listFiles + recallFile)
//   D. Source evidence inspected (via IndependentObserver.walk)
//   E. Evidence distinguishable from hypothesis
//   F. Confidence based on evidence
//   G. Reports INSUFFICIENT_EVIDENCE when inadequate

import path from "node:path";
import { randomBytes } from "node:crypto";
import { classifyFounderIntent } from "./capability-a-founder-intent";
import {
  computeAbsenceCandidates,
  type AbsenceCandidate,
  type ComputeAbsenceOutput,
} from "./native-investigation-absence";
import type {
  Nex1IntentResult,
  Nex1IntentClassified,
  Nex1CodingConceptToken,
} from "./capability-a-founder-intent";
import { createFileMemoryStore } from "./capability-m-file-memory";
import type {
  FileMemoryStore,
  Nex1FileMemoryEntry,
} from "./capability-m-file-memory";
import { IndependentObserver } from "@/lib/nex-independent-observer/observer";
import { buildDependencyGraph } from "@/lib/nex-agent-runtime/programming-mission/dependency-graph";
import type { DependencyGraph } from "@/lib/nex-agent-runtime/programming-mission/dependency-graph";
import { actionE_inspectSourceContent } from "./native-investigation-actions";
import type { SourceInspection } from "./capability-source-inspection";
import { buildObservedChains } from "./capability-observed-chains";
import type { ObservedChain } from "./capability-observed-chains";
import { emitChainNarratives } from "./capability-chain-narrative-emitter";
import type { ChainNarrative } from "./capability-chain-narrative-emitter";
import { detectChainRelationships } from "./capability-chain-relationship-detector";
import type { InferredRelationship } from "./capability-chain-relationship-detector";
import { composeRelationships } from "./capability-chain-relationship-composer";
import type { ComposedArgument } from "./capability-chain-relationship-composer";
import { generateRootCauseCandidates } from "./capability-root-cause-hypothesis-generator";
import type { RootCauseCandidate } from "./capability-root-cause-hypothesis-generator";
import { evaluateHypothesisEvidence } from "./capability-hypothesis-evidence-evaluator";
import type {
  HypothesisEvaluation,
  HypothesisEvidenceEvaluation,
} from "./capability-hypothesis-evidence-evaluator";
import { compareCandidatePairs } from "./capability-candidate-comparator";
import type { CandidateComparison } from "./capability-candidate-comparator";
import { discoverRepositoryCandidates } from "./capability-repository-discovery";
import { rankCandidates } from "./capability-candidate-ranker";
import type { RankingScope } from "./capability-candidate-ranker";
import { selectCandidates } from "./capability-candidate-selector";
import type { CandidateSelection } from "./capability-candidate-selector";

// ── Public shape · deterministic · immutable ──────────────────────────

export type InvestigationVerdict =
  | "SUFFICIENT_EVIDENCE"
  | "INSUFFICIENT_EVIDENCE"
  | "REFUSED_CLASSIFIER"
  | "REFUSED_NON_INVESTIGATE_INTENT"
  | "CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM";

export type InvestigationConfidence =
  | "VERY_HIGH_99"
  | "HIGH_95"
  | "GOOD_85"
  | "FLAG_FOR_REVIEW";

export interface InvestigationCandidateFile {
  readonly path: string;
  readonly matched_concept_tags: readonly string[];
  readonly score: number;
  readonly sha256_hex: string | null;
  readonly size_bytes: number | null;
  readonly language: string | null;
  readonly summary: string | null;
  /** How this candidate was surfaced. */
  readonly source: "file_memory_listFiles" | "file_memory_recallFile" | "classifier_file_reference";
  /** Which classifier-extracted concept(s) or file-refs pointed to this file. */
  readonly evidence_signals: readonly string[];
}

export interface InvestigationEvidencePacket {
  readonly investigation_id: string;
  readonly trace_id: string;
  readonly mission_id: string | null;
  readonly original_problem: string;
  readonly search_terms: readonly string[];
  readonly concepts: readonly {
    readonly token: string;
    readonly category: string;
    readonly occurrences: number;
  }[];
  readonly candidate_files: readonly InvestigationCandidateFile[];
  readonly relevant_matches_by_tag: Record<string, readonly string[]>;
  readonly dependency_graph_edges: number | null;
  readonly dependency_graph_sample: readonly {
    readonly from: string;
    readonly to: string;
    readonly symbols: readonly string[];
  }[];
  readonly observation_files_seen: number | null;
  readonly hypotheses: readonly string[];
  readonly evidence_for: readonly string[];
  readonly evidence_against: readonly string[];
  readonly confidence: InvestigationConfidence;
  readonly confidence_numeric: number;
  readonly unknown_facts: readonly string[];
  readonly recommended_next_step: string;
  readonly verdict: InvestigationVerdict;
  readonly capability_gaps: readonly string[];
  /** Fix 4 · 2026-09-16 · how investigation was triggered.
   *  - PRIMARY_INVESTIGATE: classifier winner was INVESTIGATE (unambiguous)
   *  - ACCEPTED_UNDER_MULTI_VERB_AMBIGUITY: classifier winner was another
   *    family BUT INVESTIGATE was in verb_hits AND classifier flagged
   *    multiple_verb_families_close. Truth-doctrine: never silently promote
   *    an ambiguous classification to unambiguous INVESTIGATE. */
  readonly investigation_trigger_kind:
    | "PRIMARY_INVESTIGATE"
    | "ACCEPTED_UNDER_MULTI_VERB_AMBIGUITY"
    | "NOT_ACCEPTED";
  readonly primary_verb_family: string | null;
  readonly investigate_in_verb_hits: boolean;
  readonly multi_verb_ambiguity_flagged: boolean;
  /** Fix 2026-09-16 · reverse-pattern reasoning · absence-of-token candidates.
   *  These files share neighborhood context with reference files but lack
   *  expected concept tokens · LOCAL_SCOPE only · not global absence claim. */
  readonly absence_candidates: readonly AbsenceCandidate[];
  readonly absence_analysis_ok: boolean;
  readonly absence_analysis_note: string;
  /** Fix 7 · 2026-09-16 · Source-level observations. Every fact carries
   *  source_file + start_line + end_line + verbatim text. Only OBSERVED
   *  content from actual inspected repository source lives here. The
   *  problem statement / classifier output / file memory / edges CANNOT
   *  contribute · contamination is impossible by construction. */
  readonly source_inspections: readonly SourceInspection[];
  readonly source_inspections_ok: boolean;
  readonly source_inspections_note: string;
  /** Fix 8 · 2026-09-16 · Deterministic evidence chains from source facts.
   *  Every chain is OBSERVED (never INFERRED/HYPOTHESIS/PROVEN). Chains
   *  group facts by (a) same_function_body or (b) shared_identifier.
   *  Chains carry NO interpretation · NO causal claim · NO narrative.
   *  Founder discipline: "NEX1 should prove what it knows before it
   *  speaks as though it knows it." */
  readonly observed_chains: readonly ObservedChain[];
  readonly observed_chains_note: string;
  /** Fix 9 · 2026-09-16 · Deterministic structural statements from chains.
   *  Every statement is a hard-templated re-statement of chain facts with
   *  chain + file + line provenance. evidence_kind is locked OBSERVED.
   *  Zero causal claim · zero interpretation · zero LLM. Founder rule §14:
   *  "Fix 9 may describe what the source says. It may not explain why the
   *  source behaves that way." */
  readonly chain_narratives: readonly ChainNarrative[];
  readonly chain_narratives_note: string;
  /** Fix 10 · 2026-09-16 · Deterministic structural relationships between
   *  observed chains. Every relationship carries evidence_kind = INFERRED
   *  (never PROVEN) and BOTH endpoints with source line ranges + symbol +
   *  fact_kind. Three patterns only: producer_consumer, condition_gates_return,
   *  selector_literal_mapping. Zero causal claim · zero LLM · zero interpretation.
   *  Founder rule §14: "The output is structured evidence." */
  readonly inferred_relationships: readonly InferredRelationship[];
  readonly inferred_relationships_note: string;
  /** Fix 11 · 2026-09-16 · Deterministic multi-relationship compositions.
   *  Every argument is a walk through the inferred_relationships graph
   *  via exact endpoint match (source_file + start_line + end_line + fact_kind).
   *  evidence_kind = INFERRED (locked). Depth ≥ 2 required. No causal claim.
   *  Founder rule §14: Fix 11 produces `A → B → C` structural chains,
   *  not `A causes C because...` narratives. */
  readonly composed_arguments: readonly ComposedArgument[];
  readonly composed_arguments_note: string;
  /** Fix 12 · 2026-09-16 · Deterministic root-cause hypothesis candidates.
   *  Every candidate is a HYPOTHESIS (type-locked) generated from a verified
   *  Stage-11 composition. candidate_endpoint = composition.endpoint_chain[0]
   *  is a DETERMINISTIC CANDIDATE-GENERATION HEURISTIC, not a semantic
   *  root-cause claim. Alternatives populated from other candidates in the
   *  same enclosing_function. Confidence capped at 0.7 · never HIGH · never
   *  PROVEN. Zero causal vocabulary. Founder rule §7:
   *  "candidate ≠ root cause proven". */
  readonly root_cause_candidates: readonly RootCauseCandidate[];
  readonly root_cause_candidates_note: string;
  /** Fix 13 · 2026-09-17 · Deterministic structural evidence evaluation
   *  over Fix 12 candidates. Every evaluation is INFERRED (type-locked).
   *  Four evidence states: STRUCTURALLY_SUPPORTING · STRUCTURALLY_CONTRADICTING
   *  · INSUFFICIENT · UNRESOLVED. No ranking · no comparison · no root-cause
   *  selection (Q6/Q7/Q8 explicitly out of scope). No causal vocabulary.
   *  Founder rule §7: supporting_relationship_ids ≠ evidence classified
   *  as supporting. Fix 13 provides the explicit classification. */
  readonly hypothesis_evaluations: readonly HypothesisEvaluation[];
  readonly hypothesis_evidence_records: readonly HypothesisEvidenceEvaluation[];
  readonly hypothesis_evaluations_note: string;
  /** Fix 14 · 2026-09-17 · Deterministic candidate comparisons. Every
   *  comparison is INFERRED (type-locked). Bounded pair scope · same
   *  source_file. Structural differences only · NO ranking · NO winner ·
   *  NO root-cause selection. Founder rule §6: DIFFERENCE ≠ PREFERENCE ≠
   *  RANK ≠ ROOT-CAUSE SELECTION. */
  readonly candidate_comparisons: readonly CandidateComparison[];
  readonly candidate_comparisons_note: string;
  /** Fix 15 · 2026-09-17 · Deterministic candidate rankings per V1 policy.
   *  Every scope is one source_file. Rankings implement NEX1_RANKING_POLICY
   *  V1 (FOUNDER_APPROVED · docs/doctrine/nex1-ranking-policy-v1-founder-
   *  approved-2026-09-17.md). Lexicographic R-1..R-5 chain · zero numerical
   *  weights · zero confidence input · zero provenance input · zero hidden
   *  tie-breaker. rank_position = 1 is highest Q7 position · NOT proven
   *  root cause and NOT Q8 selection. */
  readonly candidate_rankings: readonly RankingScope[];
  readonly candidate_rankings_note: string;
  /** Fix 16 · 2026-09-17 · Deterministic Q8 candidate selection per V1 policy.
   *  Six-state vocabulary (SELECTED / NO_SELECTION / TIE / INSUFFICIENT_EVIDENCE
   *  / UNRESOLVED / REQUIRE_MORE_INVESTIGATION). Consumes Fix 13 evaluations +
   *  Fix 15 rankings. Zero LLM · zero randomness · zero confidence as input ·
   *  zero hidden tie-breaker · zero code modification / execution authority.
   *  SELECTED ≠ MODIFIED · SELECTED ≠ EXECUTED · SELECTED ≠ VERIFIED.
   *  Founder Decisions 1-5 · APPROVED 2026-09-17. See
   *  docs/doctrine/nex1-q8-selection-policy-v1-founder-approved-2026-09-17.md. */
  readonly candidate_selection: readonly CandidateSelection[];
  readonly candidate_selection_note: string;
  readonly started_at: string;
  readonly finished_at: string;
  readonly duration_ms: number;
  readonly investigation_source: "NEX1_NATIVE";
  readonly zero_llm: true;
  readonly reasoning_trace: readonly string[];
}

export interface RunInvestigationInput {
  readonly problem_statement: string;
  readonly repo_root?: string;
  readonly mission_id?: string | null;
  /** Max investigation actions · founder §8 default 3. */
  readonly max_actions?: number;
  /** Skip Observer walk (useful for tests · large repos). */
  readonly skip_observer_walk?: boolean;
  /** Max files to consider per concept tag. */
  readonly max_candidates_per_tag?: number;
  /** Optional pre-existing FileMemoryStore · defaults to createFileMemoryStore. */
  readonly store?: FileMemoryStore;
}

const HARD_MAX_ACTIONS = 8;

function makeInvestigationId(): string {
  return `nex1-inv-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
}

function makeTraceId(): string {
  return `trace-inv-${Date.now().toString(36)}-${randomBytes(6).toString("hex")}`;
}

function bandFromNumeric(v: number): InvestigationConfidence {
  if (v >= 0.99) return "VERY_HIGH_99";
  if (v >= 0.95) return "HIGH_95";
  if (v >= 0.85) return "GOOD_85";
  return "FLAG_FOR_REVIEW";
}

/** Score a candidate: 1.0 per matching concept · minus 0.15 per absent concept · min 0. */
function scoreCandidate(matched: number, total: number): number {
  if (total === 0) return 0;
  return Math.max(0, matched / total);
}

/** Merge candidate lists · dedupe by path · combine matched_concept_tags. */
function mergeCandidates(
  a: readonly InvestigationCandidateFile[],
  b: readonly InvestigationCandidateFile[],
): InvestigationCandidateFile[] {
  const byPath = new Map<string, InvestigationCandidateFile>();
  for (const c of [...a, ...b]) {
    const prior = byPath.get(c.path);
    if (!prior) {
      byPath.set(c.path, c);
    } else {
      const tags = Array.from(new Set([...prior.matched_concept_tags, ...c.matched_concept_tags])).sort();
      const signals = Array.from(new Set([...prior.evidence_signals, ...c.evidence_signals])).sort();
      byPath.set(c.path, {
        ...prior,
        matched_concept_tags: tags,
        evidence_signals: signals,
        // Keep max score
        score: Math.max(prior.score, c.score),
      });
    }
  }
  return Array.from(byPath.values());
}

// ── Main entry point ──────────────────────────────────────────────────

/**
 * Run a deterministic native investigation of a natural-language coding
 * problem. Returns an evidence packet · never fabricates candidates ·
 * never invokes an LLM · never writes any file.
 */
export async function runNativeInvestigation(
  input: RunInvestigationInput,
): Promise<InvestigationEvidencePacket> {
  const startedAt = new Date();
  const investigationId = makeInvestigationId();
  const traceId = makeTraceId();
  const repoRoot = input.repo_root ?? process.cwd();
  const maxActions = Math.min(input.max_actions ?? 3, HARD_MAX_ACTIONS);
  const maxCandidatesPerTag = input.max_candidates_per_tag ?? 50;
  const reasoningTrace: string[] = [];
  const capabilityGaps: string[] = [];

  reasoningTrace.push(`repo_root=${repoRoot}`);
  reasoningTrace.push(`max_actions=${maxActions}`);

  // ── ACTION 1 · CLASSIFY ─────────────────────────────────────────────
  reasoningTrace.push("action_1_classify · calling classifyFounderIntent");
  const classResult: Nex1IntentResult = classifyFounderIntent(input.problem_statement);

  if (classResult.kind === "refused") {
    reasoningTrace.push(`classifier refused: ${classResult.refusal}`);
    return finalise({
      investigationId, traceId, mission_id: input.mission_id ?? null,
      original_problem: input.problem_statement,
      concepts: [], candidate_files: [], matchesByTag: {},
      dependency_graph_edges: null, dependency_graph_sample: [],
      observation_files_seen: null,
      hypotheses: [], evidence_for: [], evidence_against: [],
      confidenceNumeric: 0, unknown_facts: ["classifier refused input"],
      recommended: `refine problem statement · classifier reason: ${classResult.reason}`,
      verdict: "REFUSED_CLASSIFIER",
      capabilityGaps: ["classifier: " + classResult.refusal],
      startedAt, reasoningTrace,
      absenceCandidates: [], absenceOk: false, absenceNote: "not computed (classifier refused)",
      investigationTriggerKind: "NOT_ACCEPTED",
      primaryVerbFamily: null,
      investigateInHits: false,
      multiVerbAmbiguityFlagged: false,
      sourceInspections: [], inspectionsOk: false,
      inspectionsNote: "not computed (classifier refused)",
      observedChains: [], observedChainsNote: "not computed (classifier refused)",
      chainNarratives: [], chainNarrativesNote: "not computed (classifier refused)",
      inferredRelationships: [], inferredRelationshipsNote: "not computed (classifier refused)",
      composedArguments: [], composedArgumentsNote: "not computed (classifier refused)",
      rootCauseCandidates: [], rootCauseCandidatesNote: "not computed (classifier refused)",
      hypothesisEvaluations: [], hypothesisEvidenceRecords: [],
      hypothesisEvaluationsNote: "not computed (classifier refused)",
      candidateComparisons: [], candidateComparisonsNote: "not computed (classifier refused)",
      candidateRankings: [], candidateRankingsNote: "not computed (classifier refused)",
      candidateSelection: [], candidateSelectionNote: "not computed (classifier refused)",
    });
  }

  const classified = classResult as Nex1IntentClassified;
  reasoningTrace.push(`verb_family=${classified.verb_family} conf=${classified.verb_family_confidence}`);
  reasoningTrace.push(`concepts=${classified.coding_concepts.length}`);
  reasoningTrace.push(`file_references=${classified.file_references.length}`);

  const searchTerms = classified.coding_concepts.map((c) => c.token);
  reasoningTrace.push(`search_terms=[${searchTerms.join(", ")}]`);

  // Fix 4 · 2026-09-16 · Consume existing multi-verb ambiguity signal.
  // Undercount Protection: classifier ALREADY emits verb_hits[] and the
  // multiple_verb_families_close ambiguity flag. Prior code discarded both
  // and refused all non-primary-INVESTIGATE goals. Truth doctrine mandates
  // that when INVESTIGATE is a genuine competing interpretation, we DO
  // enter investigation · but record explicitly that we did so under
  // ambiguity · never pretend the classifier chose INVESTIGATE.
  const hasInvestigateInHits = classified.verb_hits.some((h) => h.family === "INVESTIGATE");
  const multiVerbAmbiguityFlagged = classified.ambiguities.some(
    (a) => a.kind === "multiple_verb_families_close",
  );
  const primaryInvestigate = classified.verb_family === "INVESTIGATE";
  const acceptedUnderAmbiguity =
    !primaryInvestigate && hasInvestigateInHits && multiVerbAmbiguityFlagged;
  const investigationTriggerKind: "PRIMARY_INVESTIGATE" | "ACCEPTED_UNDER_MULTI_VERB_AMBIGUITY" | "NOT_ACCEPTED" =
    primaryInvestigate
      ? "PRIMARY_INVESTIGATE"
      : acceptedUnderAmbiguity
        ? "ACCEPTED_UNDER_MULTI_VERB_AMBIGUITY"
        : "NOT_ACCEPTED";
  reasoningTrace.push(
    `trigger_kind=${investigationTriggerKind} · ` +
      `primary=${classified.verb_family} · ` +
      `investigate_in_hits=${hasInvestigateInHits} · ` +
      `multi_verb_ambiguity=${multiVerbAmbiguityFlagged}`,
  );

  if (investigationTriggerKind === "NOT_ACCEPTED") {
    reasoningTrace.push(`not an INVESTIGATE goal · verb_family=${classified.verb_family}`);
    return finalise({
      investigationId, traceId, mission_id: input.mission_id ?? null,
      original_problem: input.problem_statement,
      concepts: classified.coding_concepts.map((c) => ({
        token: c.token, category: c.category, occurrences: c.occurrences,
      })),
      candidate_files: [], matchesByTag: {},
      dependency_graph_edges: null, dependency_graph_sample: [],
      observation_files_seen: null,
      hypotheses: [], evidence_for: [], evidence_against: [],
      confidenceNumeric: 0,
      unknown_facts: [`non-INVESTIGATE verb: ${classified.verb_family}`],
      recommended: "rerun with an INVESTIGATE-verb problem statement",
      verdict: "REFUSED_NON_INVESTIGATE_INTENT",
      capabilityGaps: [`not investigation intent`],
      startedAt, reasoningTrace,
      absenceCandidates: [], absenceOk: false, absenceNote: "not computed (non-investigate verb)",
      investigationTriggerKind: "NOT_ACCEPTED",
      primaryVerbFamily: classified.verb_family,
      investigateInHits: hasInvestigateInHits,
      multiVerbAmbiguityFlagged,
      sourceInspections: [], inspectionsOk: false,
      inspectionsNote: "not computed (non-investigate verb)",
      observedChains: [], observedChainsNote: "not computed (non-investigate verb)",
      chainNarratives: [], chainNarrativesNote: "not computed (non-investigate verb)",
      inferredRelationships: [], inferredRelationshipsNote: "not computed (non-investigate verb)",
      composedArguments: [], composedArgumentsNote: "not computed (non-investigate verb)",
      rootCauseCandidates: [], rootCauseCandidatesNote: "not computed (non-investigate verb)",
      hypothesisEvaluations: [], hypothesisEvidenceRecords: [],
      hypothesisEvaluationsNote: "not computed (non-investigate verb)",
      candidateComparisons: [], candidateComparisonsNote: "not computed (non-investigate verb)",
      candidateRankings: [], candidateRankingsNote: "not computed (non-investigate verb)",
      candidateSelection: [], candidateSelectionNote: "not computed (non-investigate verb)",
    });
  }

  if (acceptedUnderAmbiguity) {
    reasoningTrace.push(
      `ACCEPTED_UNDER_MULTI_VERB_AMBIGUITY · primary=${classified.verb_family} · ` +
        `verb_hits=[${classified.verb_hits.map((h) => h.family + ":" + h.variant).join(", ")}] · ` +
        `classifier flagged multiple_verb_families_close · Fix 4 consumption path`,
    );
  }

  // ── Fix 19 · MERGE coding_concepts + domain_tokens ──────────────────
  // GAP 4 (surfaced by Test 2 · 2026-09-17): Capability A extracts BOTH
  // coding_concepts (from CODING_LEXEME_INDEX) AND domain_tokens (business/
  // problem nouns · classifier.ts:605-652). The investigation previously
  // consumed only coding_concepts · silently ignoring domain_tokens.
  // Fix 19 CONNECT-BEFORE-BUILD: merge both channels into a single
  // investigationConcepts list · preserving ontology via category marker.
  // No vocabulary change · no new classifier · no LLM · zero policy change.
  const investigationConcepts: readonly {
    readonly token: string;
    readonly category: string;
    readonly occurrences: number;
    readonly source_channel: "coding_concepts" | "domain_tokens";
  }[] = [
    ...classified.coding_concepts.map((c) => ({
      token: c.token,
      category: c.category,
      occurrences: c.occurrences,
      source_channel: "coding_concepts" as const,
    })),
    ...classified.domain_tokens.map((d) => ({
      token: d.token,
      category: "domain",
      occurrences: d.occurrences,
      source_channel: "domain_tokens" as const,
    })),
  ];
  reasoningTrace.push(
    `fix19_concept_merge · coding=${classified.coding_concepts.length} · ` +
    `domain=${classified.domain_tokens.length} · ` +
    `merged=${investigationConcepts.length}`,
  );

  // ── ACTION 2 · FILE-MEMORY TAG LOOKUP ───────────────────────────────
  reasoningTrace.push("action_2_file_memory · listFiles per concept tag");
  const store = input.store ?? createFileMemoryStore({ repo_root: repoRoot });
  const matchesByTag: Record<string, string[]> = {};
  const candidatesByPath = new Map<string, {
    tags: Set<string>;
    signals: Set<string>;
    entry: Nex1FileMemoryEntry;
  }>();

  // Fix 19 · iterate over MERGED concepts (coding + domain) · not coding-only.
  // Each token is looked up in the FileMemory tag index. Same behaviour ·
  // just a broader set of tags. Zero LLM · deterministic.
  for (const concept of investigationConcepts) {
    const tag = concept.token;
    let list;
    try {
      list = store.listFiles({ tag, limit: maxCandidatesPerTag });
    } catch (e) {
      reasoningTrace.push(`listFiles(${tag}) threw: ${(e as Error).message}`);
      matchesByTag[tag] = [];
      continue;
    }
    const paths = list.entries.map((e: Nex1FileMemoryEntry) => e.path);
    matchesByTag[tag] = paths;
    reasoningTrace.push(`listFiles(tag=${tag}) → ${paths.length} entries`);
    for (const e of list.entries) {
      let bucket = candidatesByPath.get(e.path);
      if (!bucket) {
        bucket = { tags: new Set(), signals: new Set(), entry: e };
        candidatesByPath.set(e.path, bucket);
      }
      bucket.tags.add(tag);
      bucket.signals.add(`concept:${tag}`);
    }
  }

  // Also try file_references from the classifier (if any) → recallFile
  for (const fref of classified.file_references) {
    const rec = store.recallFile(fref.path);
    if (rec.kind === "found") {
      let bucket = candidatesByPath.get(rec.entry.path);
      if (!bucket) {
        bucket = { tags: new Set(), signals: new Set(), entry: rec.entry };
        candidatesByPath.set(rec.entry.path, bucket);
      }
      bucket.signals.add(`classifier_file_ref:${fref.path}`);
    }
  }

  // Fix 19 · scoring divisor uses merged concept count · not coding-only ·
  // so scores reflect ALL search terms actually used.
  const totalConcepts = investigationConcepts.length;
  let candidates: InvestigationCandidateFile[] = Array.from(candidatesByPath.entries())
    .map(([p, b]) => {
      const matched = b.tags.size;
      const s = scoreCandidate(matched, Math.max(totalConcepts, 1));
      return {
        path: p,
        matched_concept_tags: Array.from(b.tags).sort(),
        score: s,
        sha256_hex: b.entry.sha256,
        size_bytes: b.entry.size_bytes,
        language: b.entry.language,
        summary: b.entry.summary,
        source: "file_memory_listFiles" as const,
        evidence_signals: Array.from(b.signals).sort(),
      };
    })
    .sort((a, b) => (b.score - a.score) || a.path.localeCompare(b.path));

  reasoningTrace.push(`candidates_after_file_memory=${candidates.length}`);

  // ── ACTION 2.5 · REPOSITORY DISCOVERY FALLBACK (Fix 18 · 2026-09-17) ─
  // When FileMemory tag lookup returns zero candidates for the concept
  // set (e.g. FileMemoryStore is unseeded for this domain · which is the
  // exact gap Test 1 exposed) · fall back to a deterministic bounded
  // filesystem content-scan. This is READ-ONLY · zero LLM · zero writes.
  // Provenance is preserved: every returned candidate is a real file
  // verified to exist. Never fabricates a filename.
  if (candidates.length === 0 && investigationConcepts.length > 0) {
    reasoningTrace.push(
      "action_2_5_repository_discovery_fallback · " +
      "FileMemory empty · invoking deterministic content-scan with merged concepts",
    );
    try {
      // Fix 19 · use merged concepts (coding + domain) as discovery terms ·
      // dramatically improves target-locating precision for prose problems.
      const discovery = discoverRepositoryCandidates({
        concepts: investigationConcepts.map((c) => c.token),
        repo_root: repoRoot,
        max_files_scanned: 500,
        max_candidates: 20,
      });
      reasoningTrace.push(
        `repository_discovery · files_scanned=${discovery.stats.files_scanned} · ` +
        `files_matched=${discovery.stats.files_matched} · ` +
        `candidates=${discovery.candidates.length}`,
      );
      // Merge discovery candidates into candidates list · deterministic order.
      const fallbackCandidates: InvestigationCandidateFile[] = discovery.candidates.map((c) => ({
        path: c.repo_relative_path,
        matched_concept_tags: c.matched_concept_tokens,
        score: c.match_score / Math.max(totalConcepts, 1),
        sha256_hex: null,
        size_bytes: null,
        language: null,
        summary: null,
        source: "file_memory_recallFile" as const,
        evidence_signals: [
          `repo_discovery · filename_matches=${c.filename_matches}`,
          `repo_discovery · content_matches=${c.content_matches}`,
          ...c.evidence_lines.slice(0, 3).map(
            (e) => `repo_discovery · line ${e.line_number}: token=${e.matched_token}`,
          ),
        ],
      }));
      candidates = mergeCandidates(candidates, fallbackCandidates);
      reasoningTrace.push(`candidates_after_discovery_fallback=${candidates.length}`);
    } catch (e) {
      reasoningTrace.push(`repository_discovery · exception: ${(e as Error).message}`);
      capabilityGaps.push("repository_discovery: exception");
    }
  }

  // ── ACTION 3 · OBSERVER WALK (bounded · read-only) ──────────────────
  let observationFilesSeen: number | null = null;
  if (!input.skip_observer_walk) {
    reasoningTrace.push("action_3_observer_walk · IndependentObserver.walk");
    try {
      const observer = new IndependentObserver();
      const walked = await observer.walk(repoRoot);
      observationFilesSeen = walked.size;
      reasoningTrace.push(`observer walked ${walked.size} files`);
      // If a top candidate wasn't seen by observer · demote confidence
      for (const c of candidates) {
        if (!walked.has(c.path)) {
          reasoningTrace.push(`observer did NOT see candidate ${c.path} · demoting`);
          // Halve the score to reflect uncertainty
          (c as { score: number }).score = c.score * 0.5;
        }
      }
    } catch (e) {
      reasoningTrace.push(`observer walk failed: ${(e as Error).message}`);
      capabilityGaps.push("observer: walk failed");
    }
  }

  // ── DEPENDENCY GRAPH · Fix Test G · dual-pass over broader corpus ──
  // Prior version: dep-graph limited to tag-matched candidates only. That
  // meant edges between candidates were captured but the SEEDED FILES that
  // depend-on OR are-depended-on-by candidates were invisible.
  //
  // Fix (Connect-Before-Build): compute dep-graph over BROADER corpus so
  // structural relationships between candidates AND their imports/dependents
  // are surfaced. Then use edges to EXPAND the candidate set with files
  // connected to the top tag-matched candidates.
  let depGraphEdges: number | null = null;
  const depSample: { from: string; to: string; symbols: string[] }[] = [];
  const edgeExpandedCandidates: InvestigationCandidateFile[] = [];
  if (candidates.length > 0 && candidates.length <= 100) {
    // Broader corpus: top-100 files in File Memory · captures architectural
    // neighborhood of candidates without unbounded expansion.
    let corpusPaths: string[] = candidates.map((c) => c.path);
    try {
      const broaderList = store.listFiles({ limit: 300 });
      const broaderPaths = broaderList.entries
        .map((e: Nex1FileMemoryEntry) => e.path)
        .filter((p: string) => /\.(ts|tsx|mts|mjs|js)$/.test(p));
      const seen = new Set(corpusPaths);
      for (const p of broaderPaths) {
        if (!seen.has(p) && corpusPaths.length < 300) {
          corpusPaths.push(p);
          seen.add(p);
        }
      }
    } catch (e) {
      reasoningTrace.push(`broader corpus fetch failed: ${(e as Error).message} · falling back to candidates only`);
    }
    reasoningTrace.push(`action_4_dep_graph · buildDependencyGraph on ${corpusPaths.length} files (${candidates.length} candidates + ${corpusPaths.length - candidates.length} broader corpus)`);
    try {
      const depGraph: DependencyGraph = await buildDependencyGraph({
        workspace_root: repoRoot,
        file_paths: corpusPaths,
      });
      depGraphEdges = depGraph.cross_file_edge_count;
      for (const edge of depGraph.edges.slice(0, 30)) {
        depSample.push({
          from: edge.from_file,
          to: edge.to_file,
          symbols: [...edge.imported_symbols],
        });
      }
      reasoningTrace.push(`dep_graph edges=${depGraphEdges}`);

      // ── EDGE EXPANSION · surface files structurally connected to top candidates
      // A candidate's dependency or dependent is a strong signal that the
      // connected file may be part of the same architectural context.
      const candidatePaths = new Set(candidates.map((c) => c.path));
      const topN = candidates.slice(0, 10).map((c) => c.path);
      const topNSet = new Set(topN);
      const connectionMap = new Map<string, {
        connected_to: Set<string>;
        direction: Set<"imports_top" | "imported_by_top">;
        symbols: Set<string>;
      }>();
      for (const edge of depGraph.edges) {
        if (topNSet.has(edge.from_file) && !candidatePaths.has(edge.to_file)) {
          // Top candidate imports this connected file
          let b = connectionMap.get(edge.to_file);
          if (!b) {
            b = { connected_to: new Set(), direction: new Set(), symbols: new Set() };
            connectionMap.set(edge.to_file, b);
          }
          b.connected_to.add(edge.from_file);
          b.direction.add("imported_by_top");
          for (const s of edge.imported_symbols) b.symbols.add(s);
        }
        if (topNSet.has(edge.to_file) && !candidatePaths.has(edge.from_file)) {
          // Connected file imports top candidate
          let b = connectionMap.get(edge.from_file);
          if (!b) {
            b = { connected_to: new Set(), direction: new Set(), symbols: new Set() };
            connectionMap.set(edge.from_file, b);
          }
          b.connected_to.add(edge.to_file);
          b.direction.add("imports_top");
          for (const s of edge.imported_symbols) b.symbols.add(s);
        }
      }
      reasoningTrace.push(`edge_expansion · ${connectionMap.size} files structurally connected to top-10 candidates`);
      // Convert to candidate entries · rank by connection strength
      for (const [connectedPath, info] of connectionMap.entries()) {
        // Try to hydrate metadata via File Memory
        let entry: Nex1FileMemoryEntry | null = null;
        try {
          const rec = store.recallFile(connectedPath);
          if (rec.kind === "found") entry = rec.entry;
        } catch { /* ignore */ }
        edgeExpandedCandidates.push({
          path: connectedPath,
          matched_concept_tags: [],
          // Score reflects: 0.5 base (edge-derived · not tag-matched) + 0.1 per connection · capped
          score: Math.min(0.5 + 0.1 * info.connected_to.size, 0.95),
          sha256_hex: entry?.sha256 ?? null,
          size_bytes: entry?.size_bytes ?? null,
          language: entry?.language ?? null,
          summary: entry?.summary ?? null,
          source: "file_memory_listFiles" as const, // no dedicated source type · reuse
          evidence_signals: Array.from(info.direction).map(
            (d) => `edge:${d}:${Array.from(info.connected_to).slice(0, 2).join(",")}`,
          ),
        });
      }
    } catch (e) {
      reasoningTrace.push(`dep_graph failed: ${(e as Error).message}`);
      capabilityGaps.push("dep_graph: failed");
    }
  } else if (candidates.length > 100) {
    reasoningTrace.push(`skipped dep_graph · candidates too many (${candidates.length})`);
  }

  // Merge edge-expanded candidates into main list (rank-preserving)
  const mainPaths = new Set(candidates.map((c) => c.path));
  for (const eec of edgeExpandedCandidates) {
    if (!mainPaths.has(eec.path)) {
      candidates.push(eec);
      mainPaths.add(eec.path);
    }
  }
  reasoningTrace.push(`candidates_after_edge_expansion=${candidates.length} (${edgeExpandedCandidates.length} added via structural edges)`);

  // Re-sort after observer demotion
  candidates = [...candidates].sort((a, b) => (b.score - a.score) || a.path.localeCompare(b.path));

  // ── ACTION 6 · SOURCE INSPECTION (Fix 7 · 2026-09-16) ────────────────
  // The connection Test J's boundary was missing. Inspect the top-K candidate
  // source files via `actionE_inspectSourceContent` · bounded · read-only ·
  // deterministic · uses ts.createSourceFile (same primitive as capability-k).
  // Every extracted fact carries source_file + line-range provenance.
  //
  // Contamination protection (per founder authorization §7):
  //   · Only the file at `candidate.path` is opened
  //   · Only verbatim source content is emitted
  //   · Problem statement / classifier / File Memory / edges CANNOT flow in
  //   · Consumers verify by reading the actual file at the given lines
  const sourceInspections: SourceInspection[] = [];
  let inspectionsOk = false;
  let inspectionsNote = "";
  // Selection rule (Fix 7 · 2026-09-16):
  //   (a) Always inspect every candidate surfaced by `classifier_file_ref` —
  //       an explicit file reference in the problem statement is a strong
  //       founder-supplied signal that must never be outranked by structural
  //       neighbours (which currently score 0.6 vs a file_ref's score 0).
  //   (b) Then inspect additional top-scored candidates up to a hard cap.
  //   Hard cap of 5 total files per investigation (bounded budget).
  const HARD_INSPECT_CAP = 5;
  const classifierRefCandidates = candidates.filter((c) =>
    c.evidence_signals.some((s) => s.startsWith("classifier_file_ref:")),
  );
  const otherTopCandidates = candidates.filter((c) => !classifierRefCandidates.includes(c));
  const selectedForInspection: InvestigationCandidateFile[] = [];
  for (const c of classifierRefCandidates) {
    if (selectedForInspection.length < HARD_INSPECT_CAP) selectedForInspection.push(c);
  }
  for (const c of otherTopCandidates.slice(0, HARD_INSPECT_CAP - selectedForInspection.length)) {
    selectedForInspection.push(c);
  }
  const inspectK = selectedForInspection.length;
  reasoningTrace.push(
    `action_6_source_inspection · ${classifierRefCandidates.length} classifier_file_ref · ${inspectK - classifierRefCandidates.length} top-scored · total=${inspectK}`,
  );
  const inspectionFactsPerFile: string[] = [];
  for (const cand of selectedForInspection) {
    try {
      const rec = actionE_inspectSourceContent({
        file_path: cand.path,
        repo_root: repoRoot,
      });
      if (rec.result?.inspection) {
        sourceInspections.push(rec.result.inspection);
        const insp = rec.result.inspection;
        if (insp.kind === "ok") {
          inspectionsOk = true;
          inspectionFactsPerFile.push(
            `${cand.path}: fns=${insp.functions.length} ifs=${insp.if_branches.length} returns=${insp.returns.length} strings=${insp.string_literals.length}`,
          );
        } else {
          inspectionFactsPerFile.push(`${cand.path}: refused ${insp.refusal}`);
        }
      }
    } catch (e) {
      reasoningTrace.push(`source_inspection · ${cand.path} · exception: ${(e as Error).message}`);
      capabilityGaps.push("source_inspection: exception");
    }
  }
  inspectionsNote = inspectionFactsPerFile.length > 0
    ? `Inspected top-${inspectK}: ${inspectionFactsPerFile.join(" · ")}`
    : `No candidates available for inspection`;
  reasoningTrace.push(`source_inspection · ${inspectionFactsPerFile.length} files processed`);

  // ── ACTION 7 · OBSERVED-CHAIN AGGREGATION (Fix 8 · 2026-09-16) ───────
  // Purpose: turn the raw source_inspections[] into deterministic
  // ObservedChain[] groupings. Every chain is OBSERVED. No interpretation.
  // Founder discipline: "Notice what it doesn't say: 'Therefore the system
  // escalates because…' That would be synthesis. Fix 8 should stop
  // immediately before that."
  //
  // Contamination protection: buildObservedChains reads ONLY the
  // source_inspections[] array. It cannot access original_problem,
  // classifier output, hypotheses, or any narrative text.
  reasoningTrace.push("action_7_observed_chains · buildObservedChains");
  let observedChains: readonly ObservedChain[] = [];
  let observedChainsNote = "";
  try {
    const chainResult = buildObservedChains({ inspections: sourceInspections });
    observedChains = chainResult.chains;
    observedChainsNote =
      `Inspections ok: ${chainResult.stats.inspections_ok}/${chainResult.stats.inspections_seen} · ` +
      `facts considered: ${chainResult.stats.total_facts_considered} · ` +
      `chains: ${chainResult.stats.chains_returned} ` +
      `(same_function_body=${chainResult.stats.same_function_body_chains} · shared_identifier=${chainResult.stats.shared_identifier_chains}) · ` +
      `${chainResult.stats.capped_by}`;
    reasoningTrace.push(`observed_chains · ${chainResult.stats.chains_returned} chains from ${chainResult.stats.total_facts_considered} facts`);
  } catch (e) {
    observedChainsNote = `chain aggregation failed: ${(e as Error).message}`;
    reasoningTrace.push(`observed_chains · exception: ${(e as Error).message}`);
    capabilityGaps.push("observed_chains: exception");
  }

  // ── ACTION 8 · CHAIN-NARRATIVE EMISSION (Fix 9 · 2026-09-16) ─────────
  // Emit deterministic provenance-tagged structural statements from
  // observed_chains[]. Templates are hard-coded and contain no causal
  // vocabulary. Runtime assertion rejects any statement that somehow
  // contains a forbidden causal token (defence in depth).
  //
  // Contamination protection: emitter reads ONLY observed_chains[]. It has
  // no access to original_problem, classifier output, hypotheses, or any
  // narrative text.
  //
  // Founder discipline: this action DOES NOT populate hypotheses[] or
  // evidence_for[]. Those remain the pre-Fix-7 template heuristic. Test M
  // must remain honestly assessable after Fix 9 — Fix 9 only builds the
  // bridge; it does not cross it.
  reasoningTrace.push("action_8_chain_narratives · emitChainNarratives");
  let chainNarratives: readonly ChainNarrative[] = [];
  let chainNarrativesNote = "";
  try {
    const narrativeResult = emitChainNarratives({ chains: observedChains });
    chainNarratives = narrativeResult.narratives;
    chainNarrativesNote =
      `Chains processed: ${narrativeResult.stats.chains_processed}/${narrativeResult.stats.chains_seen} · ` +
      `narratives: ${narrativeResult.stats.narratives_emitted} · ` +
      `rejected (forbidden causal): ${narrativeResult.stats.narratives_rejected_forbidden_word} · ` +
      `rejected (missing provenance): ${narrativeResult.stats.narratives_rejected_missing_provenance} · ` +
      `${narrativeResult.stats.capped_by}`;
    reasoningTrace.push(`chain_narratives · ${narrativeResult.stats.narratives_emitted} statements emitted`);
    if (narrativeResult.stats.narratives_rejected_forbidden_word > 0) {
      capabilityGaps.push(`chain_narratives: ${narrativeResult.stats.narratives_rejected_forbidden_word} statements rejected for causal vocabulary`);
    }
  } catch (e) {
    chainNarrativesNote = `narrative emission failed: ${(e as Error).message}`;
    reasoningTrace.push(`chain_narratives · exception: ${(e as Error).message}`);
    capabilityGaps.push("chain_narratives: exception");
  }

  // ── ACTION 9 · CHAIN RELATIONSHIP DETECTION (Fix 10 · 2026-09-16) ────
  // Deterministic detection of three structural relationship patterns
  // between observed chain facts: producer_consumer, condition_gates_return,
  // selector_literal_mapping. Every emitted relationship is INFERRED
  // (never PROVEN), forward-direction only, both endpoints provenanced.
  // Zero causal vocabulary · runtime defence-in-depth check.
  //
  // Founder discipline §14/§19: Fix 10 does NOT claim to explain WHY code
  // behaves this way. It identifies verified structural relationships only.
  reasoningTrace.push("action_9_chain_relationships · detectChainRelationships");
  let inferredRelationships: readonly InferredRelationship[] = [];
  let inferredRelationshipsNote = "";
  try {
    const relResult = detectChainRelationships({ chains: observedChains });
    inferredRelationships = relResult.relationships;
    inferredRelationshipsNote =
      `Chains seen: ${relResult.stats.chains_seen} · ` +
      `relationships: ${relResult.stats.relationships_emitted} ` +
      `(producer_consumer=${relResult.stats.producer_consumer_count} · ` +
      `condition_gates_return=${relResult.stats.condition_gates_return_count} · ` +
      `selector_literal_mapping=${relResult.stats.selector_literal_mapping_count}) · ` +
      `rejected(forbidden=${relResult.stats.rejected_forbidden_word}, ` +
      `direction=${relResult.stats.rejected_direction_violation}, ` +
      `identical=${relResult.stats.rejected_identical_endpoints}) · ` +
      `${relResult.stats.capped_by}`;
    reasoningTrace.push(`inferred_relationships · ${relResult.stats.relationships_emitted} emitted`);
    if (relResult.stats.rejected_forbidden_word > 0) {
      capabilityGaps.push(`inferred_relationships: ${relResult.stats.rejected_forbidden_word} rejected for causal vocabulary`);
    }
  } catch (e) {
    inferredRelationshipsNote = `relationship detection failed: ${(e as Error).message}`;
    reasoningTrace.push(`inferred_relationships · exception: ${(e as Error).message}`);
    capabilityGaps.push("inferred_relationships: exception");
  }

  // ── ACTION 10 · RELATIONSHIP COMPOSITION (Fix 11 · 2026-09-16) ──────
  // Deterministic multi-relationship composer. Walks inferred_relationships[]
  // graph via exact endpoint match (source_file + start_line + end_line +
  // fact_kind). Cycle-protected. Direction-enforced. Depth ≥ 2 required.
  // Every argument evidence_kind = INFERRED. No causal claim. No LLM.
  //
  // Founder discipline §14/§25: Fix 11 emits structural chains only ·
  // A → B → C · never A causes C. Stage 12 (root-cause reasoning) is
  // deliberately NOT touched here.
  reasoningTrace.push("action_10_relationship_composition · composeRelationships");
  let composedArguments: readonly ComposedArgument[] = [];
  let composedArgumentsNote = "";
  try {
    const compResult = composeRelationships({ relationships: inferredRelationships });
    composedArguments = compResult.compositions;
    const depthSummary = Object.entries(compResult.stats.compositions_by_depth)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([d, n]) => `depth${d}=${n}`)
      .join(" · ");
    composedArgumentsNote =
      `Relationships seen: ${compResult.stats.relationships_seen} · ` +
      `compositions: ${compResult.stats.compositions_emitted} ` +
      `(${depthSummary || "none"}) · ` +
      `rejected(cycle=${compResult.stats.compositions_rejected_cycle}, ` +
      `direction=${compResult.stats.compositions_rejected_direction}) · ` +
      `${compResult.stats.capped_by}`;
    reasoningTrace.push(`composed_arguments · ${compResult.stats.compositions_emitted} emitted`);
  } catch (e) {
    composedArgumentsNote = `composition failed: ${(e as Error).message}`;
    reasoningTrace.push(`composed_arguments · exception: ${(e as Error).message}`);
    capabilityGaps.push("composed_arguments: exception");
  }

  // ── ACTION 11 · ROOT-CAUSE HYPOTHESIS GENERATION (Fix 12 · 2026-09-16) ─
  // Deterministic hypothesis generator over Fix 11 compositions. Every
  // candidate is type-locked evidence_kind = HYPOTHESIS · never PROVEN.
  // First endpoint = candidate root cause is a CANDIDATE-GENERATION
  // HEURISTIC, not a semantic root-cause claim (founder §7).
  //
  // Alternatives are automatically populated from OTHER candidates in the
  // same enclosing_function · exposing the hypothesis SET.
  //
  // Confidence capped at 0.7 · never HIGH · never above 0.85.
  // Zero causal vocabulary · runtime defence-in-depth check.
  reasoningTrace.push("action_11_root_cause_hypothesis · generateRootCauseCandidates");
  let rootCauseCandidates: readonly RootCauseCandidate[] = [];
  let rootCauseCandidatesNote = "";
  try {
    const hypResult = generateRootCauseCandidates({ compositions: composedArguments });
    rootCauseCandidates = hypResult.candidates;
    rootCauseCandidatesNote =
      `Compositions seen: ${hypResult.stats.compositions_seen} · ` +
      `candidates: ${hypResult.stats.candidates_emitted} (all HYPOTHESIS · never PROVEN) · ` +
      `rejected(forbidden=${hypResult.stats.rejected_forbidden_word}, ` +
      `empty_provenance=${hypResult.stats.rejected_empty_provenance}, ` +
      `invalid_evidence_kind=${hypResult.stats.rejected_invalid_evidence_kind}) · ` +
      `${hypResult.stats.capped_by}`;
    reasoningTrace.push(`root_cause_candidates · ${hypResult.stats.candidates_emitted} emitted (HYPOTHESIS only)`);
    if (hypResult.stats.rejected_forbidden_word > 0) {
      capabilityGaps.push(`root_cause_candidates: ${hypResult.stats.rejected_forbidden_word} rejected for causal vocabulary`);
    }
    if (hypResult.stats.rejected_invalid_evidence_kind > 0) {
      capabilityGaps.push(`root_cause_candidates: ${hypResult.stats.rejected_invalid_evidence_kind} rejected for invalid evidence_kind`);
    }
  } catch (e) {
    rootCauseCandidatesNote = `hypothesis generation failed: ${(e as Error).message}`;
    reasoningTrace.push(`root_cause_candidates · exception: ${(e as Error).message}`);
    capabilityGaps.push("root_cause_candidates: exception");
  }

  // ── ACTION 12 · HYPOTHESIS EVIDENCE EVALUATION (Fix 13 · 2026-09-17) ─
  // Deterministic evaluator over Fix 12 candidates. For each candidate,
  // classify every supporting_relationship_id as one of:
  //   · STRUCTURALLY_SUPPORTING
  //   · STRUCTURALLY_CONTRADICTING
  //   · INSUFFICIENT
  //   · UNRESOLVED
  // Every evaluation record evidence_kind = INFERRED (type-locked).
  // No ranking · no comparison · no root-cause selection (Q6/Q7/Q8 out of scope).
  // Founder discipline §7: supporting_relationship_ids ≠ evidence support.
  reasoningTrace.push("action_12_hypothesis_evidence_evaluation · evaluateHypothesisEvidence");
  let hypothesisEvaluations: readonly HypothesisEvaluation[] = [];
  let hypothesisEvidenceRecords: readonly HypothesisEvidenceEvaluation[] = [];
  let hypothesisEvaluationsNote = "";
  try {
    const evalResult = evaluateHypothesisEvidence({
      candidates: rootCauseCandidates,
      relationships: inferredRelationships,
      compositions: composedArguments,
    });
    hypothesisEvaluations = evalResult.evaluations;
    hypothesisEvidenceRecords = evalResult.evidence_records;
    const byStatus = evalResult.stats.by_status;
    const byOverall = evalResult.stats.by_overall_status;
    hypothesisEvaluationsNote =
      `Candidates seen: ${evalResult.stats.candidates_seen} · ` +
      `evaluations: ${evalResult.stats.evaluations_emitted} · ` +
      `evidence records: ${evalResult.stats.evidence_records_emitted} · ` +
      `by_status(sup=${byStatus.STRUCTURALLY_SUPPORTING}, contra=${byStatus.STRUCTURALLY_CONTRADICTING}, insuff=${byStatus.INSUFFICIENT}, unres=${byStatus.UNRESOLVED}) · ` +
      `overall(supported=${byOverall.STRUCTURALLY_SUPPORTED}, contradicted=${byOverall.STRUCTURALLY_CONTRADICTED}, insufficient=${byOverall.INSUFFICIENT}, unresolved=${byOverall.UNRESOLVED}) · ` +
      `rejected(forbidden=${evalResult.stats.rejected_forbidden_word}) · ` +
      `${evalResult.stats.capped_by}`;
    reasoningTrace.push(`hypothesis_evaluations · ${evalResult.stats.evaluations_emitted} candidates evaluated`);
    if (evalResult.stats.rejected_forbidden_word > 0) {
      capabilityGaps.push(`hypothesis_evaluations: ${evalResult.stats.rejected_forbidden_word} rejected for causal vocabulary`);
    }
  } catch (e) {
    hypothesisEvaluationsNote = `evidence evaluation failed: ${(e as Error).message}`;
    reasoningTrace.push(`hypothesis_evaluations · exception: ${(e as Error).message}`);
    capabilityGaps.push("hypothesis_evaluations: exception");
  }

  // ── ACTION 13 · CANDIDATE COMPARISON (Fix 14 · 2026-09-17) ──────────
  // Deterministic pairwise comparator over Fix 13 evaluations. For each
  // pair within same source_file scope, compute shared / A-only / B-only
  // evidence sets · per-candidate status counts · structural differences.
  // Every comparison record evidence_kind = INFERRED (type-locked).
  // Q6 ONLY · Q7/Q8 explicitly out of scope. Zero ranking · zero winner ·
  // zero root-cause selection. Zero causal vocabulary · runtime defence-in-depth.
  reasoningTrace.push("action_13_candidate_comparison · compareCandidatePairs");
  let candidateComparisons: readonly CandidateComparison[] = [];
  let candidateComparisonsNote = "";
  try {
    const cmpResult = compareCandidatePairs({
      evaluations: hypothesisEvaluations,
      evidence_records: hypothesisEvidenceRecords,
    });
    candidateComparisons = cmpResult.comparisons;
    candidateComparisonsNote =
      `Evaluations seen: ${cmpResult.stats.evaluations_seen} · ` +
      `pairs evaluated: ${cmpResult.stats.pairs_evaluated} · ` +
      `comparisons: ${cmpResult.stats.comparisons_emitted} · ` +
      `rejected(prohibited_field=${cmpResult.stats.rejected_prohibited_field}, ` +
      `causal=${cmpResult.stats.rejected_causal_vocab}) · ` +
      `${cmpResult.stats.capped_by}`;
    reasoningTrace.push(`candidate_comparisons · ${cmpResult.stats.comparisons_emitted} emitted`);
    if (cmpResult.stats.rejected_prohibited_field > 0) {
      capabilityGaps.push(`candidate_comparisons: ${cmpResult.stats.rejected_prohibited_field} rejected for ranking field names`);
    }
    if (cmpResult.stats.rejected_causal_vocab > 0) {
      capabilityGaps.push(`candidate_comparisons: ${cmpResult.stats.rejected_causal_vocab} rejected for causal vocabulary`);
    }
  } catch (e) {
    candidateComparisonsNote = `candidate comparison failed: ${(e as Error).message}`;
    reasoningTrace.push(`candidate_comparisons · exception: ${(e as Error).message}`);
    capabilityGaps.push("candidate_comparisons: exception");
  }

  // ── ACTION 14 · CANDIDATE RANKING (Fix 15 · 2026-09-17) ──────────────
  // Deterministic Q7 ranking per NEX1_RANKING_POLICY V1 (FOUNDER_APPROVED).
  // Lexicographic R-1..R-5 chain applied to Fix 13 evaluations. Zero
  // numerical weights · zero confidence input · zero provenance input ·
  // zero hidden tie-breaker. rank_position = 1 means highest Q7 position ·
  // NOT proven root cause · NOT Q8 selection. Q8 remains NOT_IMPLEMENTED.
  // See docs/doctrine/nex1-ranking-policy-v1-founder-approved-2026-09-17.md.
  reasoningTrace.push("action_14_candidate_ranking · rankCandidates · V1 policy");
  let candidateRankings: readonly RankingScope[] = [];
  let candidateRankingsNote = "";
  try {
    const rankResult = rankCandidates({
      evaluations: hypothesisEvaluations,
      evidence_records: hypothesisEvidenceRecords,
    });
    candidateRankings = rankResult.scopes;
    const s = rankResult.stats;
    candidateRankingsNote =
      `Policy: ${rankResult.policy_id} ${rankResult.policy_version} · ` +
      `scopes: ${s.scopes_seen} (RANKED=${s.scope_state_counts.RANKED}, ` +
      `ALL_TIED=${s.scope_state_counts.ALL_TIED}, ` +
      `UNRESOLVED_ORDER=${s.scope_state_counts.UNRESOLVED_ORDER}, ` +
      `SINGLETON=${s.scope_state_counts.SINGLETON}) · ` +
      `rankings emitted: ${s.rankings_emitted} · ` +
      `rule fires (R1=${s.rule_fire_counts["R-1"]}, R2=${s.rule_fire_counts["R-2"]}, ` +
      `R3=${s.rule_fire_counts["R-3"]}, R4=${s.rule_fire_counts["R-4"]}, ` +
      `R5=${s.rule_fire_counts["R-5"]}) · ${s.capped_by}`;
    reasoningTrace.push(`candidate_rankings · ${s.rankings_emitted} emitted across ${s.scopes_seen} scopes`);
    if (s.rejected_non_inferred > 0) {
      capabilityGaps.push(`candidate_rankings: ${s.rejected_non_inferred} rejected (type-lock or causal vocab)`);
    }
  } catch (e) {
    candidateRankingsNote = `candidate ranking failed: ${(e as Error).message}`;
    reasoningTrace.push(`candidate_rankings · exception: ${(e as Error).message}`);
    capabilityGaps.push("candidate_rankings: exception");
  }

  // ── ACTION 15 · CANDIDATE SELECTION (Fix 16 · 2026-09-17) ────────────
  // Deterministic Q8 selection per NEX1_Q8_SELECTION_POLICY V1 (FOUNDER_APPROVED
  // 2026-09-17 · founder Decisions 1-5 APPROVED). Consumes Fix 13 evaluations +
  // Fix 15 rankings · applies 8-step selection-state precedence · emits
  // SELECTED / NO_SELECTION / TIE / INSUFFICIENT_EVIDENCE / UNRESOLVED /
  // REQUIRE_MORE_INVESTIGATION per source_file scope.
  // Zero LLM · zero randomness · zero confidence input · zero hidden tie-breaker ·
  // zero code modification / execution authority.
  // SELECTED ≠ MODIFIED · SELECTED ≠ EXECUTED · SELECTED ≠ VERIFIED.
  // See docs/doctrine/nex1-q8-selection-policy-v1-founder-approved-2026-09-17.md.
  reasoningTrace.push("action_15_candidate_selection · selectCandidates · V1 Q8 policy");
  let candidateSelection: readonly CandidateSelection[] = [];
  let candidateSelectionNote = "";
  try {
    const selResult = selectCandidates({
      evaluations: hypothesisEvaluations,
      evidence_records: hypothesisEvidenceRecords,
      rankings: candidateRankings,
      investigation_id: investigationId,
      trace_id: traceId,
    });
    candidateSelection = selResult.selections;
    const ss = selResult.stats;
    candidateSelectionNote =
      `Policy: ${selResult.policy_id} ${selResult.policy_version} · ` +
      `scopes: ${ss.scopes_seen} · selections: ${ss.selections_emitted} · ` +
      `states (SELECTED=${ss.state_counts.SELECTED}, ` +
      `NO_SELECTION=${ss.state_counts.NO_SELECTION}, ` +
      `TIE=${ss.state_counts.TIE}, ` +
      `INSUFFICIENT_EVIDENCE=${ss.state_counts.INSUFFICIENT_EVIDENCE}, ` +
      `UNRESOLVED=${ss.state_counts.UNRESOLVED}, ` +
      `REQUIRE_MORE_INVESTIGATION=${ss.state_counts.REQUIRE_MORE_INVESTIGATION}) · ` +
      `rejected(type_lock=${ss.rejected_non_inferred}, ` +
      `causal_vocab=${ss.rejected_forbidden_word}, ` +
      `missing_provenance=${ss.rejected_missing_provenance}) · ${ss.capped_by}`;
    reasoningTrace.push(`candidate_selection · ${ss.selections_emitted} emitted across ${ss.scopes_seen} scopes`);
    if (ss.rejected_non_inferred > 0) {
      capabilityGaps.push(`candidate_selection: ${ss.rejected_non_inferred} rejected (type-lock)`);
    }
    if (ss.rejected_forbidden_word > 0) {
      capabilityGaps.push(`candidate_selection: ${ss.rejected_forbidden_word} rejected (causal vocab)`);
    }
    if (ss.rejected_missing_provenance > 0) {
      capabilityGaps.push(`candidate_selection: ${ss.rejected_missing_provenance} SELECTED downgraded (missing provenance)`);
    }
  } catch (e) {
    candidateSelectionNote = `candidate selection failed: ${(e as Error).message}`;
    reasoningTrace.push(`candidate_selection · exception: ${(e as Error).message}`);
    capabilityGaps.push("candidate_selection: exception");
  }

  // ── ACTION 5 · ABSENCE-OF-TOKEN ANALYSIS (fix 2026-09-16 · §4/§7) ────
  // Deterministic reverse-pattern reasoning: which files share neighborhood
  // with reference files that carry ALL expected concepts, but lack those
  // concepts themselves? LOCAL_SCOPE only · never a global absence claim.
  reasoningTrace.push("action_5_absence_analysis · computeAbsenceCandidates");
  let absenceCandidates: readonly AbsenceCandidate[] = [];
  let absenceOk = false;
  let absenceNote = "";
  try {
    const absResult: ComputeAbsenceOutput = computeAbsenceCandidates({
      store,
      expected_concepts: classified.coding_concepts.map((c: Nex1CodingConceptToken) => c.token),
      max_reference_files: 20,
      max_candidates: 20,
      min_neighborhood_weight: 1,
    });
    if (absResult.ok) {
      absenceCandidates = absResult.candidates;
      absenceOk = true;
      absenceNote =
        `Reference files: ${absResult.reference_files.length} · Neighborhood tags: ${absResult.neighborhood_tags.length} · Candidates: ${absResult.candidates.length}. ` +
        absResult.bounded_by;
      reasoningTrace.push(`absence_analysis · ${absResult.candidates.length} candidates identified`);
    } else {
      absenceOk = false;
      absenceNote = `Absence analysis skipped: ${absResult.reason}`;
      reasoningTrace.push(`absence_analysis · insufficient: ${absResult.reason}`);
    }
  } catch (e) {
    absenceOk = false;
    absenceNote = `Absence analysis exception: ${(e as Error).message}`;
    reasoningTrace.push(`absence_analysis · exception: ${(e as Error).message}`);
    capabilityGaps.push("absence_analysis: exception");
  }

  // ── ASSESS ──────────────────────────────────────────────────────────
  // Trim to top-20 for evidence packet clarity.
  const topCandidates = candidates.slice(0, 20);
  const relevantMatchesByTag: Record<string, readonly string[]> = {};
  for (const [tag, paths] of Object.entries(matchesByTag)) {
    relevantMatchesByTag[tag] = paths.slice(0, 20);
  }

  // Confidence: based on top-candidate score AND classifier's own confidence
  const topScore = topCandidates[0]?.score ?? 0;
  const combined = classified.overall_confidence * 0.4 + topScore * 0.6;
  reasoningTrace.push(`combined_confidence = 0.4·${classified.overall_confidence.toFixed(2)} + 0.6·${topScore.toFixed(2)} = ${combined.toFixed(3)}`);

  const hypotheses: string[] = [];
  const evidenceFor: string[] = [];
  const evidenceAgainst: string[] = [];
  const unknownFacts: string[] = [];

  if (topCandidates.length === 0) {
    hypotheses.push("No candidate files match the extracted concepts · corpus may be un-seeded or concepts do not appear in indexed content");
    unknownFacts.push("no files were surfaced by File Memory tag search");
    unknownFacts.push("no dependency-graph traversal possible without candidates");
  } else {
    hypotheses.push(`Top candidate ${topCandidates[0].path} matches ${topCandidates[0].matched_concept_tags.length}/${totalConcepts} concept(s)`);
    if (topCandidates[0].matched_concept_tags.length === totalConcepts) {
      evidenceFor.push(`file matches ALL extracted concepts: ${topCandidates[0].matched_concept_tags.join(", ")}`);
    } else {
      evidenceFor.push(`file matches partial concepts: ${topCandidates[0].matched_concept_tags.join(", ")}`);
      const missing = classified.coding_concepts
        .map((c) => c.token)
        .filter((t) => !topCandidates[0].matched_concept_tags.includes(t));
      unknownFacts.push(`concepts NOT matched by top candidate: ${missing.join(", ")}`);
    }
  }

  // Verdict
  let verdict: InvestigationVerdict;
  let recommended: string;
  if (topCandidates.length === 0) {
    verdict = "INSUFFICIENT_EVIDENCE";
    recommended = "seed File Memory via seedFileMemoryFromContent · then re-run investigation";
    capabilityGaps.push("no seeded corpus found for concept tags");
  } else if (combined >= 0.85) {
    verdict = "SUFFICIENT_EVIDENCE";
    recommended = `inspect top candidate ${topCandidates[0].path} for root cause · verify with dep-graph traversal`;
  } else if (combined >= 0.55) {
    verdict = "SUFFICIENT_EVIDENCE";
    recommended = `top ${Math.min(3, topCandidates.length)} candidates warrant closer inspection · confidence is GOOD but not HIGH`;
  } else {
    verdict = "INSUFFICIENT_EVIDENCE";
    recommended = "broaden File Memory seed corpus · or refine problem statement";
  }

  return finalise({
    investigationId, traceId, mission_id: input.mission_id ?? null,
    original_problem: input.problem_statement,
    // Fix 19 · expose BOTH coding_concepts AND domain_tokens in packet ·
    // domain tokens carry category="domain" so consumers can distinguish
    // (Q7/Q8/bridge/persistence all treat category as opaque string).
    concepts: [
      ...classified.coding_concepts.map((c: Nex1CodingConceptToken) => ({
        token: c.token, category: c.category, occurrences: c.occurrences,
      })),
      ...classified.domain_tokens.map((d) => ({
        token: d.token, category: "domain", occurrences: d.occurrences,
      })),
    ],
    candidate_files: topCandidates,
    matchesByTag: relevantMatchesByTag as Record<string, string[]>,
    dependency_graph_edges: depGraphEdges,
    dependency_graph_sample: depSample,
    observation_files_seen: observationFilesSeen,
    hypotheses, evidence_for: evidenceFor, evidence_against: evidenceAgainst,
    confidenceNumeric: combined,
    unknown_facts: unknownFacts,
    recommended,
    verdict,
    capabilityGaps,
    startedAt, reasoningTrace,
    absenceCandidates, absenceOk, absenceNote,
    investigationTriggerKind,
    primaryVerbFamily: classified.verb_family,
    investigateInHits: hasInvestigateInHits,
    multiVerbAmbiguityFlagged,
    sourceInspections, inspectionsOk, inspectionsNote,
    observedChains, observedChainsNote,
    chainNarratives, chainNarrativesNote,
    inferredRelationships, inferredRelationshipsNote,
    composedArguments, composedArgumentsNote,
    rootCauseCandidates, rootCauseCandidatesNote,
    hypothesisEvaluations, hypothesisEvidenceRecords, hypothesisEvaluationsNote,
    candidateComparisons, candidateComparisonsNote,
    candidateRankings, candidateRankingsNote,
    candidateSelection, candidateSelectionNote,
  });
}

// ── Finalise helper ────────────────────────────────────────────────────

interface FinaliseInput {
  investigationId: string;
  traceId: string;
  mission_id: string | null;
  original_problem: string;
  concepts: readonly { token: string; category: string; occurrences: number }[];
  candidate_files: readonly InvestigationCandidateFile[];
  matchesByTag: Record<string, string[]>;
  dependency_graph_edges: number | null;
  dependency_graph_sample: readonly { from: string; to: string; symbols: string[] }[];
  observation_files_seen: number | null;
  hypotheses: readonly string[];
  evidence_for: readonly string[];
  evidence_against: readonly string[];
  confidenceNumeric: number;
  unknown_facts: readonly string[];
  recommended: string;
  verdict: InvestigationVerdict;
  capabilityGaps: readonly string[];
  startedAt: Date;
  reasoningTrace: readonly string[];
  absenceCandidates: readonly AbsenceCandidate[];
  absenceOk: boolean;
  absenceNote: string;
  investigationTriggerKind:
    | "PRIMARY_INVESTIGATE"
    | "ACCEPTED_UNDER_MULTI_VERB_AMBIGUITY"
    | "NOT_ACCEPTED";
  primaryVerbFamily: string | null;
  investigateInHits: boolean;
  multiVerbAmbiguityFlagged: boolean;
  sourceInspections: readonly SourceInspection[];
  inspectionsOk: boolean;
  inspectionsNote: string;
  observedChains: readonly ObservedChain[];
  observedChainsNote: string;
  chainNarratives: readonly ChainNarrative[];
  chainNarrativesNote: string;
  inferredRelationships: readonly InferredRelationship[];
  inferredRelationshipsNote: string;
  composedArguments: readonly ComposedArgument[];
  composedArgumentsNote: string;
  rootCauseCandidates: readonly RootCauseCandidate[];
  rootCauseCandidatesNote: string;
  hypothesisEvaluations: readonly HypothesisEvaluation[];
  hypothesisEvidenceRecords: readonly HypothesisEvidenceEvaluation[];
  hypothesisEvaluationsNote: string;
  candidateComparisons: readonly CandidateComparison[];
  candidateComparisonsNote: string;
  candidateRankings: readonly RankingScope[];
  candidateRankingsNote: string;
  candidateSelection: readonly CandidateSelection[];
  candidateSelectionNote: string;
}

function finalise(input: FinaliseInput): InvestigationEvidencePacket {
  const finishedAt = new Date();
  return {
    investigation_id: input.investigationId,
    trace_id: input.traceId,
    mission_id: input.mission_id,
    original_problem: input.original_problem,
    search_terms: input.concepts.map((c) => c.token),
    concepts: input.concepts,
    candidate_files: input.candidate_files,
    relevant_matches_by_tag: input.matchesByTag,
    dependency_graph_edges: input.dependency_graph_edges,
    dependency_graph_sample: input.dependency_graph_sample,
    observation_files_seen: input.observation_files_seen,
    hypotheses: input.hypotheses,
    evidence_for: input.evidence_for,
    evidence_against: input.evidence_against,
    confidence: bandFromNumeric(input.confidenceNumeric),
    confidence_numeric: input.confidenceNumeric,
    unknown_facts: input.unknown_facts,
    recommended_next_step: input.recommended,
    verdict: input.verdict,
    capability_gaps: input.capabilityGaps,
    started_at: input.startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    duration_ms: finishedAt.getTime() - input.startedAt.getTime(),
    investigation_source: "NEX1_NATIVE",
    zero_llm: true,
    reasoning_trace: input.reasoningTrace,
    absence_candidates: input.absenceCandidates,
    absence_analysis_ok: input.absenceOk,
    absence_analysis_note: input.absenceNote,
    investigation_trigger_kind: input.investigationTriggerKind,
    primary_verb_family: input.primaryVerbFamily,
    investigate_in_verb_hits: input.investigateInHits,
    multi_verb_ambiguity_flagged: input.multiVerbAmbiguityFlagged,
    source_inspections: input.sourceInspections,
    source_inspections_ok: input.inspectionsOk,
    source_inspections_note: input.inspectionsNote,
    observed_chains: input.observedChains,
    observed_chains_note: input.observedChainsNote,
    chain_narratives: input.chainNarratives,
    chain_narratives_note: input.chainNarrativesNote,
    inferred_relationships: input.inferredRelationships,
    inferred_relationships_note: input.inferredRelationshipsNote,
    composed_arguments: input.composedArguments,
    composed_arguments_note: input.composedArgumentsNote,
    root_cause_candidates: input.rootCauseCandidates,
    root_cause_candidates_note: input.rootCauseCandidatesNote,
    hypothesis_evaluations: input.hypothesisEvaluations,
    hypothesis_evidence_records: input.hypothesisEvidenceRecords,
    hypothesis_evaluations_note: input.hypothesisEvaluationsNote,
    candidate_comparisons: input.candidateComparisons,
    candidate_comparisons_note: input.candidateComparisonsNote,
    candidate_rankings: input.candidateRankings,
    candidate_rankings_note: input.candidateRankingsNote,
    candidate_selection: input.candidateSelection,
    candidate_selection_note: input.candidateSelectionNote,
  };
}
