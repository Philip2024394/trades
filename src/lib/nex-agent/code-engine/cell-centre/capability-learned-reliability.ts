// src/lib/nex-agent/code-engine/cell-centre/capability-learned-reliability.ts
//
// NEX1 · Ledger A Experiment · Arm D · Learned Specialist Reliability
// Ledger B mechanism with data-derived parameters
// Founder-authorised 2026-09-19 · Option A · amendments 23.1-23.5 locked
//
// PURELY MECHANICAL INFRASTRUCTURE.
//
// This module implements a general-purpose experience-to-reliability learner.
// It does NOT:
//   - contain a training corpus
//   - contain any test corpus
//   - contain any specialist name or kind literal
//   - contain any hypothesis mapping (kind -> hypothesis)
//   - contain any reliability value as a literal
//   - reference MPS, R1, R2, any Sep-19 kind-lookup table, or any Claude-authored rule
//   - "know" what the correct answer is for any specific case
//
// It DOES:
//   - accept structured experience receipts (specialist output + verified outcome)
//   - tally observations per (specialist_id, kind, intent_type) triple
//   - detect argmax outcome from the tally (data-derived mapping)
//   - compute reliability via Laplace smoothing (Claude-designed estimator · disclosed)
//   - assign evidence tier per pre-registered thresholds (§23.2)
//   - persist and retrieve the resulting table
//   - apply the retrieved table at inference to weight evidence
//
// The 14-stage pipeline (per spec §5) is exposed as 13 individually-inspectable
// exported functions plus the intent classifier (used at stages 2 and 11).
//
// Discipline:
//   - Frozen infra (Fear/Concern/Afraid, MPS, hypothesis-set, PEC, PB) untouched
//   - Zero LLM · zero gradient · zero learned weights except Dirichlet-like counts
//   - Only types + initialize + decide reused from capability-hypothesis-set.ts
//   - `observe` from hypothesis-set (which uses a Claude-authored mapping) is NOT imported

import { registerAgent, recordHeartbeat } from "../capability-agent-registry";
import type {
  HypothesisId,
  HypothesisRecord,
  HypothesisSet,
  DecideResult,
} from "./capability-hypothesis-set";
import { initialize, decide } from "./capability-hypothesis-set";

registerAgent({
  id: "learned_specialist_reliability",
  name: "Learned Specialist Reliability · Ledger B mechanism with data-derived parameters",
  cognitive_layer: "infrastructure_registry",
  description:
    "General-purpose experience-to-reliability learner. Tallies (specialist_id, kind, intent_type) observations against verified outcomes. Derives per-triple winning hypothesis and reliability weight from data. Applies learned table at inference to weight evidence. No hardcoded mappings. No hardcoded reliabilities. No MPS or Sep-19-mapping-table import.",
});

// ═══════════════════════════════════════════════════════════════════════
// HYPERPARAMETERS · pre-registered · frozen · locked in preregistration.json
// ═══════════════════════════════════════════════════════════════════════

export interface Hyperparameters {
  readonly laplace_alpha: number;                    // smoothing prior · 1 (α=0 = estimator-neutral)
  readonly outcome_universe_size: number;            // 5 discrete outcomes
  readonly min_support_unresolved_boundary: number;  // 3 · below = UNRESOLVED
  readonly min_support_high_confidence: number;      // 5 · lower bar for HC tier
  readonly weight_threshold_sufficient: number;      // 0.5
  readonly weight_threshold_high_confidence: number; // 0.65
  readonly ratio_threshold_sufficient: number;       // 0.4 · > 2/|outcomes|
  readonly ratio_threshold_high_confidence: number;  // 0.6
  readonly margin_threshold_decide: number;          // 0.6 · inherited from Sep-19
  readonly baseline_seed_score: number;              // 1.0
  readonly default_novel_triple_weight: number;      // 0.2 · uniform prior
  readonly weak_tier_weight_multiplier: number;      // 0.5
}

export const HYPERPARAMETERS_LOCKED: Hyperparameters = {
  laplace_alpha: 1,
  outcome_universe_size: 5,
  min_support_unresolved_boundary: 3,
  min_support_high_confidence: 5,
  weight_threshold_sufficient: 0.5,
  weight_threshold_high_confidence: 0.65,
  ratio_threshold_sufficient: 0.4,
  ratio_threshold_high_confidence: 0.6,
  margin_threshold_decide: 0.6,
  baseline_seed_score: 1.0,
  default_novel_triple_weight: 0.2,
  weak_tier_weight_multiplier: 0.5,
};

export const HYPERPARAMETERS_ESTIMATOR_NEUTRAL: Hyperparameters = {
  ...HYPERPARAMETERS_LOCKED,
  laplace_alpha: 0, // raw frequencies · no smoothing · amendment 23.1 variant
};

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export type IntentType = "create" | "delete" | "review" | "ambiguous";
export type EvidenceTier = "UNRESOLVED" | "WEAK" | "SUFFICIENT" | "HIGH_CONFIDENCE";
export type ReportingMode = "M-FULL" | "M-HC";

/**
 * STAGE 1 · EXPERIENCE
 * A raw historical event tuple. Populated during training only.
 * verified_outcome is joined in AFTER independent ground-truth verification.
 */
export interface RawExperience {
  readonly case_id: string;
  readonly sequence: number;
  readonly intent_raw: string;
  readonly target_present: boolean;
  readonly existing_count: number;
  readonly activity: string;
  readonly specialist_id: string;
  readonly kind_emitted: string;
  readonly specialist_confidence: number;
  readonly verified_outcome: HypothesisId;
  readonly verified_at_iso: string;
}

/**
 * STAGE 2 · OBSERVATION
 * A structured receipt derived from a raw experience.
 * intent_type is computed via the frozen classifier (below).
 */
export interface StructuredReceipt {
  readonly case_id: string;
  readonly sequence: number;
  readonly intent_type: IntentType;
  readonly specialist_id: string;
  readonly kind_emitted: string;
  readonly specialist_confidence: number;
  readonly verified_outcome: HypothesisId;
}

/**
 * STAGE 3 · REPRESENTATION
 * Per-triple accumulator. Keyed by "specialist_id|kind|intent_type".
 */
export interface TripleAccumulator {
  readonly triple_key: string;
  outcome_tally: Record<HypothesisId, number>;
  total: number;
  first_seen_sequence: number;
  last_seen_sequence: number;
}

/**
 * STAGE 5-8 combined · a learned entry after regularity+reliability+validation+promotion.
 */
export interface LearnedEntry {
  readonly triple_key: string;
  readonly specialist_id: string;
  readonly kind_emitted: string;
  readonly intent_type: IntentType;
  readonly winning_hypothesis: HypothesisId | null; // null if UNRESOLVED
  readonly weight: number;         // Laplace-smoothed (α=1 by default)
  readonly ratio: number;          // raw count_H_star / total (α-independent)
  readonly count_H_star: number;   // raw count for winning
  readonly total_count: number;    // total observations
  readonly outcome_tally: Record<HypothesisId, number>;
  readonly tier: EvidenceTier;
  readonly promoted: boolean;
  readonly stability_snapshot_agreement: number; // fraction of temporal snapshots where argmax == final winning_hypothesis
}

export interface TemporalSnapshot {
  readonly after_sequence: number;
  readonly table_size: number;
  readonly per_triple_winning: Record<string, HypothesisId | null>; // deterministic snapshot
}

export interface LearnedTable {
  readonly version: string;
  readonly trained_at_iso: string;
  readonly hyperparameters_used: Hyperparameters;
  readonly training_tuple_count: number;
  readonly reliability_table: Record<string, LearnedEntry>;
  readonly temporal_snapshots: readonly TemporalSnapshot[];
}

export interface EvidenceTraceEntry {
  readonly specialist_id: string;
  readonly kind_emitted: string;
  readonly intent_type: IntentType;
  readonly triple_key: string;
  readonly entry_found: boolean;
  readonly tier: EvidenceTier | "novel";
  readonly promoted: boolean;
  readonly excluded_by_mode: boolean;
  readonly effective_weight: number;
  readonly target_hypothesis: HypothesisId | null;
  readonly reason: string;
}

export interface InferenceInput {
  readonly payload_intent_raw: string;
  readonly payload_activity: string;
  readonly baseline_decision: HypothesisId;
  readonly analyses: readonly {
    readonly specialist_id: string;
    readonly kind_emitted: string;
    readonly specialist_confidence: number;
  }[];
  readonly reporting_mode: ReportingMode;
  readonly hyperparameters: Hyperparameters;
}

export interface InferenceResult {
  readonly intent_type: IntentType;
  readonly hypothesis_set: HypothesisSet;
  readonly decision: DecideResult;
  readonly trace: readonly EvidenceTraceEntry[];
}

// ═══════════════════════════════════════════════════════════════════════
// INTENT-TYPE CLASSIFIER · Claude-designed · disclosed · frozen
// Same classifier is used at training-receipt structuring (Stage 2) and at
// inference (Stage 11). This ensures identical categorisation both times.
// The classifier is disclosed openly. Its rules do NOT encode any hypothesis
// mapping — they only bin intents into 4 categories.
// ═══════════════════════════════════════════════════════════════════════

const CREATE_VERBS = /\b(create|add|new|introduce|write|build)\b/;
const DESTROY_VERBS = /\b(delete|remove|drop|destroy|uninstall|purge)\b/;
const REVIEW_VERBS = /\b(review|inspect|observe|check|verify|test)\b/;

/**
 * STAGE 2 (partial) and STAGE 11 (partial) · intent categorisation.
 * Returns "ambiguous" when multiple opposing verb classes co-occur OR
 * when no recognised verb class is present.
 */
export function classifyIntent(intent: string, activity: string): IntentType {
  const s = String(intent ?? "").toLowerCase();
  const a = String(activity ?? "").toLowerCase();
  const has_create = CREATE_VERBS.test(s);
  const has_destroy = DESTROY_VERBS.test(s) || a === "delete";
  const has_review = REVIEW_VERBS.test(s) || a === "observe" || a === "test";

  const classes = [has_create, has_destroy, has_review].filter(Boolean).length;
  if (classes >= 2) return "ambiguous";
  if (has_destroy) return "delete";
  if (has_review) return "review";
  if (has_create) return "create";
  return "ambiguous";
}

// ═══════════════════════════════════════════════════════════════════════
// STAGE 2 · OBSERVATION · structure a raw experience into a receipt
// ═══════════════════════════════════════════════════════════════════════

export function structureReceipt(raw: RawExperience): StructuredReceipt {
  return {
    case_id: raw.case_id,
    sequence: raw.sequence,
    intent_type: classifyIntent(raw.intent_raw, raw.activity),
    specialist_id: raw.specialist_id,
    kind_emitted: raw.kind_emitted,
    specialist_confidence: raw.specialist_confidence,
    verified_outcome: raw.verified_outcome,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// STAGE 3 · REPRESENTATION · initialise an accumulator for a new triple
// ═══════════════════════════════════════════════════════════════════════

const OUTCOME_UNIVERSE: readonly HypothesisId[] = [
  "PROCEED_CREATE",
  "REFUSE_DUPLICATE",
  "REFUSE_UNRELATED",
  "REFUSE_HARDGATE",
  "UNKNOWN",
];

function emptyOutcomeTally(): Record<HypothesisId, number> {
  return {
    PROCEED_CREATE: 0,
    REFUSE_DUPLICATE: 0,
    REFUSE_UNRELATED: 0,
    REFUSE_HARDGATE: 0,
    UNKNOWN: 0,
    ABSTAIN: 0,
  };
}

export function tripleKey(specialist_id: string, kind_emitted: string, intent_type: IntentType): string {
  return specialist_id + "|" + kind_emitted + "|" + intent_type;
}

export function initAccumulator(triple_key: string, first_sequence: number): TripleAccumulator {
  return {
    triple_key,
    outcome_tally: emptyOutcomeTally(),
    total: 0,
    first_seen_sequence: first_sequence,
    last_seen_sequence: first_sequence,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// STAGE 4 · AGGREGATION · update running counts (single-receipt append)
// ═══════════════════════════════════════════════════════════════════════

export function aggregateReceiptIntoAccumulator(acc: TripleAccumulator, receipt: StructuredReceipt): TripleAccumulator {
  const nextTally = { ...acc.outcome_tally };
  nextTally[receipt.verified_outcome] = (nextTally[receipt.verified_outcome] ?? 0) + 1;
  return {
    triple_key: acc.triple_key,
    outcome_tally: nextTally,
    total: acc.total + 1,
    first_seen_sequence: acc.first_seen_sequence,
    last_seen_sequence: receipt.sequence,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// STAGE 5 · REGULARITY · compute argmax over the tally (deterministic tie-break)
// ═══════════════════════════════════════════════════════════════════════

export interface RegularityFinding {
  readonly winning_hypothesis: HypothesisId | null;
  readonly count_H_star: number;
  readonly total: number;
  readonly ratio: number;
}

export function detectRegularity(acc: TripleAccumulator): RegularityFinding {
  let winning: HypothesisId | null = null;
  let count_H_star = 0;
  // Deterministic tie-break by alphabetical outcome id
  const outcomes = [...OUTCOME_UNIVERSE].sort();
  for (const o of outcomes) {
    const c = acc.outcome_tally[o] ?? 0;
    if (c > count_H_star) {
      count_H_star = c;
      winning = o;
    }
  }
  const ratio = acc.total > 0 ? count_H_star / acc.total : 0;
  return { winning_hypothesis: winning, count_H_star, total: acc.total, ratio };
}

// ═══════════════════════════════════════════════════════════════════════
// STAGE 6 · RELIABILITY HYPOTHESIS · compute Laplace-smoothed weight
// This is the Claude-designed estimator disclosed in amendment 23.1.
// The estimator itself is Ledger B infrastructure. The values it produces
// on NEX experience are the Ledger A candidate.
// ═══════════════════════════════════════════════════════════════════════

export function computeReliabilityWeight(count_H_star: number, total: number, alpha: number, outcome_universe: number): number {
  const numerator = count_H_star + alpha;
  const denominator = total + alpha * outcome_universe;
  if (denominator === 0) return 0;
  return numerator / denominator;
}

// ═══════════════════════════════════════════════════════════════════════
// STAGE 7 · VALIDATION · stability across temporal snapshots
// Returns the fraction of snapshots at which the argmax outcome matched
// the final argmax. High fraction = stable pattern. Low = unstable / drift.
// ═══════════════════════════════════════════════════════════════════════

export function stabilityAgreement(
  triple_key: string,
  snapshots: readonly TemporalSnapshot[],
  final_winning: HypothesisId | null,
): number {
  if (snapshots.length === 0) return 0;
  if (final_winning === null) return 0;
  let agree = 0;
  for (const snap of snapshots) {
    if (snap.per_triple_winning[triple_key] === final_winning) agree++;
  }
  return agree / snapshots.length;
}

// ═══════════════════════════════════════════════════════════════════════
// STAGE 8 · PROMOTION · assign evidence tier and promotion flag
// per amendment 23.2 · thresholds locked in preregistration
// ═══════════════════════════════════════════════════════════════════════

export function assignTier(
  weight: number,
  ratio: number,
  total: number,
  hyper: Hyperparameters,
): { tier: EvidenceTier; promoted: boolean } {
  if (total < hyper.min_support_unresolved_boundary) {
    return { tier: "UNRESOLVED", promoted: false };
  }
  if (
    total >= hyper.min_support_high_confidence &&
    weight >= hyper.weight_threshold_high_confidence &&
    ratio > hyper.ratio_threshold_high_confidence
  ) {
    return { tier: "HIGH_CONFIDENCE", promoted: true };
  }
  if (weight >= hyper.weight_threshold_sufficient && ratio > hyper.ratio_threshold_sufficient) {
    return { tier: "SUFFICIENT", promoted: true };
  }
  return { tier: "WEAK", promoted: true };
}

// ═══════════════════════════════════════════════════════════════════════
// Composite fit function · orchestrates stages 1-8 across receipt stream
// ═══════════════════════════════════════════════════════════════════════

const SNAPSHOT_INTERVAL = 5;

export function fitReliabilityTable(
  rawExperiences: readonly RawExperience[],
  hyper: Hyperparameters = HYPERPARAMETERS_LOCKED,
): LearnedTable {
  // Sort by sequence to enforce temporal order
  const sorted = [...rawExperiences].sort((a, b) => a.sequence - b.sequence);

  // Sequential accumulator map
  const accumulators = new Map<string, TripleAccumulator>();
  const snapshots: TemporalSnapshot[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const receipt = structureReceipt(sorted[i]);
    const key = tripleKey(receipt.specialist_id, receipt.kind_emitted, receipt.intent_type);

    if (!accumulators.has(key)) {
      accumulators.set(key, initAccumulator(key, receipt.sequence));
    }
    const before = accumulators.get(key)!;
    const after = aggregateReceiptIntoAccumulator(before, receipt);
    accumulators.set(key, after);

    // Snapshot every SNAPSHOT_INTERVAL receipts
    if ((i + 1) % SNAPSHOT_INTERVAL === 0 || i === sorted.length - 1) {
      const per_triple_winning: Record<string, HypothesisId | null> = {};
      for (const [tk, acc] of accumulators) {
        per_triple_winning[tk] = detectRegularity(acc).winning_hypothesis;
      }
      snapshots.push({
        after_sequence: sorted[i].sequence,
        table_size: accumulators.size,
        per_triple_winning,
      });
    }
  }

  // Build final table with tier assignment and stability validation
  const reliability_table: Record<string, LearnedEntry> = {};
  for (const [key, acc] of accumulators) {
    const reg = detectRegularity(acc);
    const weight = computeReliabilityWeight(
      reg.count_H_star,
      reg.total,
      hyper.laplace_alpha,
      hyper.outcome_universe_size,
    );
    const { tier, promoted } = assignTier(weight, reg.ratio, reg.total, hyper);
    const stability = stabilityAgreement(key, snapshots, reg.winning_hypothesis);
    const parts = key.split("|");
    reliability_table[key] = {
      triple_key: key,
      specialist_id: parts[0],
      kind_emitted: parts[1],
      intent_type: parts[2] as IntentType,
      winning_hypothesis: reg.winning_hypothesis,
      weight,
      ratio: reg.ratio,
      count_H_star: reg.count_H_star,
      total_count: reg.total,
      outcome_tally: acc.outcome_tally,
      tier,
      promoted,
      stability_snapshot_agreement: stability,
    };
  }

  const table: LearnedTable = {
    version: "learned-reliability.v1.2026-09-19",
    trained_at_iso: new Date().toISOString(),
    hyperparameters_used: hyper,
    training_tuple_count: sorted.length,
    reliability_table,
    temporal_snapshots: snapshots,
  };

  recordHeartbeat({
    agent_id: "learned_specialist_reliability",
    event_type: "fit",
    event_data: {
      training_tuple_count: sorted.length,
      table_size: Object.keys(reliability_table).length,
      snapshots: snapshots.length,
    },
  });

  return table;
}

// ═══════════════════════════════════════════════════════════════════════
// STAGE 9 · PERSISTENCE · serialise to canonical JSON
// ═══════════════════════════════════════════════════════════════════════

export function serialiseLearnedTable(table: LearnedTable): string {
  // Canonical serialisation with sorted keys for byte-identical reproducibility.
  const sortedTable: Record<string, LearnedEntry> = {};
  for (const k of Object.keys(table.reliability_table).sort()) {
    sortedTable[k] = table.reliability_table[k];
  }
  const canonical = {
    version: table.version,
    trained_at_iso: table.trained_at_iso,
    hyperparameters_used: table.hyperparameters_used,
    training_tuple_count: table.training_tuple_count,
    reliability_table: sortedTable,
    temporal_snapshots: table.temporal_snapshots,
  };
  return JSON.stringify(canonical, null, 2) + "\n";
}

// ═══════════════════════════════════════════════════════════════════════
// STAGE 10 · RETRIEVAL · load a persisted table
// ═══════════════════════════════════════════════════════════════════════

export function deserialiseLearnedTable(json: string): LearnedTable {
  const parsed = JSON.parse(json) as LearnedTable;
  return parsed;
}

export function lookupEntry(
  table: LearnedTable,
  specialist_id: string,
  kind_emitted: string,
  intent_type: IntentType,
): LearnedEntry | null {
  const key = tripleKey(specialist_id, kind_emitted, intent_type);
  return table.reliability_table[key] ?? null;
}

// ═══════════════════════════════════════════════════════════════════════
// STAGE 11 · UNSEEN APPLICATION · apply learned weight at inference
// ═══════════════════════════════════════════════════════════════════════

/**
 * Apply a single specialist analysis to the hypothesis set using the learned
 * table. Returns updated set and a trace record. No ground-truth access.
 *
 * The trace field `target_hypothesis` records what data-derived hypothesis
 * received evidence · never accesses any post-hoc verification field.
 */
function applyLearnedEvidence(
  set: HypothesisSet,
  entry: LearnedEntry | null,
  analysis: { specialist_id: string; kind_emitted: string; specialist_confidence: number },
  intent_type: IntentType,
  turn: number,
  reporting_mode: ReportingMode,
  hyper: Hyperparameters,
): { set: HypothesisSet; trace: EvidenceTraceEntry } {
  const trace_base = {
    specialist_id: analysis.specialist_id,
    kind_emitted: analysis.kind_emitted,
    intent_type,
    triple_key: entry?.triple_key ?? tripleKey(analysis.specialist_id, analysis.kind_emitted, intent_type),
  } as const;

  // Case 1: no entry OR entry not promoted
  if (!entry || !entry.promoted || !entry.winning_hypothesis) {
    return {
      set,
      trace: {
        ...trace_base,
        entry_found: !!entry,
        tier: entry?.tier ?? "novel",
        promoted: entry?.promoted ?? false,
        excluded_by_mode: false,
        effective_weight: 0,
        target_hypothesis: null,
        reason: entry ? `${entry.tier}_not_promoted` : "novel_triple",
      },
    };
  }

  // Case 2: reporting mode exclusion
  if (reporting_mode === "M-HC" && entry.tier !== "HIGH_CONFIDENCE") {
    return {
      set,
      trace: {
        ...trace_base,
        entry_found: true,
        tier: entry.tier,
        promoted: entry.promoted,
        excluded_by_mode: true,
        effective_weight: 0,
        target_hypothesis: null,
        reason: `${entry.tier}_excluded_in_M-HC`,
      },
    };
  }

  // Case 3: promoted entry applied at learned weight (possibly WEAK-tier discounted)
  const tier_multiplier = entry.tier === "WEAK" ? hyper.weak_tier_weight_multiplier : 1.0;
  // Re-compute weight from raw counts using the passed-in α
  // (allows estimator-neutral variant at α=0 without retraining)
  const alpha_weight = computeReliabilityWeight(
    entry.count_H_star,
    entry.total_count,
    hyper.laplace_alpha,
    hyper.outcome_universe_size,
  );
  const effective_weight = alpha_weight * tier_multiplier * analysis.specialist_confidence;

  const targetHyp = entry.winning_hypothesis;
  const rec = set[targetHyp];
  const nextSet: Record<HypothesisId, HypothesisRecord> = { ...set } as Record<HypothesisId, HypothesisRecord>;
  nextSet[targetHyp] = {
    id: rec.id,
    evidence_score: rec.evidence_score + effective_weight,
    supporting_specialists: rec.supporting_specialists.includes(analysis.specialist_id)
      ? rec.supporting_specialists
      : [...rec.supporting_specialists, analysis.specialist_id],
    contradicting_specialists: rec.contradicting_specialists,
    first_seen_turn: rec.first_seen_turn < 0 ? turn : rec.first_seen_turn,
  };

  return {
    set: nextSet,
    trace: {
      ...trace_base,
      entry_found: true,
      tier: entry.tier,
      promoted: true,
      excluded_by_mode: false,
      effective_weight,
      target_hypothesis: targetHyp,
      reason: entry.tier,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════
// STAGE 12 · OUTCOME · decision from evidence-weighted hypothesis set
// ═══════════════════════════════════════════════════════════════════════

/**
 * Full inference pipeline · orchestrates stages 10-12 for a single payload.
 * Never accesses ground truth. Never accesses training corpus.
 * Reads only the persisted table + payload + specialist analyses.
 */
export function inferDecisionFromLearnedTable(
  table: LearnedTable,
  input: InferenceInput,
): InferenceResult {
  const intent_type = classifyIntent(input.payload_intent_raw, input.payload_activity);
  let hypothesis_set = initialize(input.baseline_decision, input.hyperparameters.baseline_seed_score);

  const trace: EvidenceTraceEntry[] = [];
  let turn = 1;
  for (const a of input.analyses) {
    const entry = lookupEntry(table, a.specialist_id, a.kind_emitted, intent_type);
    const step = applyLearnedEvidence(
      hypothesis_set,
      entry,
      { specialist_id: a.specialist_id, kind_emitted: a.kind_emitted, specialist_confidence: a.specialist_confidence },
      intent_type,
      turn++,
      input.reporting_mode,
      input.hyperparameters,
    );
    hypothesis_set = step.set;
    trace.push(step.trace);
  }

  const decision = decide(hypothesis_set, input.hyperparameters.margin_threshold_decide);

  recordHeartbeat({
    agent_id: "learned_specialist_reliability",
    event_type: "infer",
    event_data: {
      intent_type,
      reporting_mode: input.reporting_mode,
      decision: decision.verdict,
      trace_entries: trace.length,
      promoted_entries_used: trace.filter((t) => t.promoted && !t.excluded_by_mode).length,
    },
  });

  return { intent_type, hypothesis_set, decision, trace };
}

// ═══════════════════════════════════════════════════════════════════════
// STAGE 13 · REVERIFICATION · out of scope for this experiment
// Placeholder. Any post-turn learning update is deliberately not implemented.
// ═══════════════════════════════════════════════════════════════════════

export function reverificationOutOfScope(): never {
  throw new Error(
    "Stage 13 · reverification / post-turn learning is out of scope for the Ledger A experiment. " +
      "Learning is frozen after the training run. Any additional experience must be a separately pre-registered experiment.",
  );
}

// ═══════════════════════════════════════════════════════════════════════
// INSPECTION UTILITIES · founder amendment 23.4 causal-chain requirement
// Each stage of the pipeline can be called individually and its intermediate
// state inspected. These helpers surface state for the causal analysis report.
// ═══════════════════════════════════════════════════════════════════════

export function inspectTableSummary(table: LearnedTable): {
  total_triples: number;
  promoted_triples: number;
  by_tier: Record<EvidenceTier, number>;
  training_tuple_count: number;
  snapshots: number;
} {
  const by_tier: Record<EvidenceTier, number> = {
    UNRESOLVED: 0,
    WEAK: 0,
    SUFFICIENT: 0,
    HIGH_CONFIDENCE: 0,
  };
  let promoted = 0;
  for (const entry of Object.values(table.reliability_table)) {
    by_tier[entry.tier]++;
    if (entry.promoted) promoted++;
  }
  return {
    total_triples: Object.keys(table.reliability_table).length,
    promoted_triples: promoted,
    by_tier,
    training_tuple_count: table.training_tuple_count,
    snapshots: table.temporal_snapshots.length,
  };
}

export function inspectEntryProvenance(
  table: LearnedTable,
  triple_key: string,
): { entry: LearnedEntry | null; snapshot_trajectory: readonly (HypothesisId | null)[] } {
  const entry = table.reliability_table[triple_key] ?? null;
  const trajectory: (HypothesisId | null)[] = [];
  for (const snap of table.temporal_snapshots) {
    trajectory.push(snap.per_triple_winning[triple_key] ?? null);
  }
  return { entry, snapshot_trajectory: trajectory };
}

export const LEARNED_RELIABILITY_VERSION = "learned-reliability.v1.2026-09-19";
