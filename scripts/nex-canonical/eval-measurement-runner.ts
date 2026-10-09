// scripts/nex-canonical/eval-measurement-runner.ts
//
// NEX Canonical · Rule 5m · Evaluation Measurement Runner.
//
// SEALED CLAIM:
//   Reads the sealed seed cohort + eval corpus files, runs the Layer-B
//   resolver against every labelled pair, computes the Rule-5j metrics
//   (false-merge rate, precision, recall, abstention), and emits a
//   measurement artefact JSON with corpus/resolver hashes for
//   reproducibility (Rule-5m Proof 7).
//
// SCOPE:
//   This is machinery. It does NOT create seeds or labels (both require
//   founder/admin approval per sealed doctrine). It consumes those
//   artefacts as input and produces a measurement artefact.
//
// INPUT CONTRACT (sealed by seed-cohort-and-eval-corpus-design doctrine):
//   tests/fixtures/canonical/seed-cohort-v1.jsonl       — ≥50 seeds
//   tests/fixtures/eval/positive-pairs-v1.jsonl         — ≥200 positives
//   tests/fixtures/eval/negative-pairs-v1.jsonl         — ≥200 negatives
//   tests/fixtures/eval/ambiguous-pairs-v1.jsonl        — ~50 ambiguous
//
// OUTPUT CONTRACT:
//   {
//     "schema_version": "measurement-v1",
//     "corpus_commit_hashes": {
//       "seed_cohort": sha256,
//       "positive": sha256,
//       "negative": sha256,
//       "ambiguous": sha256
//     },
//     "resolver_module_hash": sha256,
//     "measured_at": ISO-8601,
//     "pairs_measured": { positive: N, negative: N, ambiguous: N },
//     "confusion_matrix": { tp, fp, tn, fn, abstained_pos, abstained_neg, abstained_amb },
//     "metrics": {
//       "false_merge_rate": number,   // (fp + merged_amb) / (negative + ambiguous)
//       "precision": number,           // tp / (tp + fp)
//       "recall": number,              // tp / (tp + fn + abstained_pos)
//       "abstention_rate_on_ambiguous": number  // abstained_amb / ambiguous_total
//     },
//     "rule_5j_gates": {
//       "false_merge_le_1pct": boolean,     // HARD gate (≤ 1%)
//       "precision_ge_98pct":   boolean,    // HARD gate (≥ 98%)
//       "recall_ge_70pct":      boolean,    // SOFT gate (≥ 70%)
//       "abstention_ge_80pct":  boolean     // SOFT gate (≥ 80%)
//     },
//     "all_hard_gates_pass": boolean,
//     "all_gates_pass": boolean
//   }
//
// SAFETY POSTURE (sealed):
//   · Pure measurement. No DB writes. No network. No clock side effect
//     (the stamp is deterministic given input + input hashes).
//   · Refuses to proceed if any corpus file is missing (fail-closed).
//   · Refuses to measure against a resolver version it has not hashed
//     (reproducibility proof requires the hash to be present).
//
// SEE ALSO:
//   · docs/doctrine/nex-rule-5m-proof-manifest-2026-10-09.md · Proofs 4, 5, 7
//   · docs/doctrine/nex-business-canonical-seed-cohort-and-eval-corpus-design-2026-10-08.md

import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { resolveCanonical } from "./canonical-resolver";
import type { Candidate } from "./generate-candidates";
import type { CanonicalResolverInput } from "./canonical-row";
import { isAnswered } from "./intelligence-result";

// ═════════════════════════════════════════════════════════════════════
// §1 · Public types
// ═════════════════════════════════════════════════════════════════════

export const MEASUREMENT_SCHEMA_VERSION = "measurement-v1" as const;

/** A seed cohort record (schema matches sealed doctrine §3.4). */
export interface SeedRecord {
  readonly seed_id: string;
  readonly entity_type: string;
  readonly country: string;
  readonly identity: Record<string, unknown>;
  readonly provenance: {
    readonly approved_by: string;
    readonly approved_at: string;
    readonly created_by: string;
    readonly created_at: string;
    readonly legacy_source_table: string;
    readonly legacy_source_ref: string;
    readonly risk_categories: readonly string[];
    readonly high_confidence_rationale: string;
    readonly notes?: string;
  };
}

/** An eval corpus pair · the resolver should MATCH / NO_MATCH / AMBIGUOUS. */
export interface EvalPair {
  readonly pair_id: string;
  readonly seed_id: string;                 // which seed in the cohort
  readonly candidate_payload: Candidate;    // the candidate the resolver sees
  readonly expected_target_canonical_business_id: string | null;
  readonly label_decision: {
    readonly expected_verdict: "MATCH" | "NO_MATCH" | "AMBIGUOUS";
    readonly labelled_by: string;           // 'founder' | 'admin:<handle>'
    readonly labelled_at: string;
    readonly label_version: number;
    readonly superseded_by_pair_id?: string;
  };
  readonly candidate_source: {
    readonly generator: string;
    readonly generation_run_id: string;
  };
}

export interface MeasurementArtefact {
  readonly schema_version: typeof MEASUREMENT_SCHEMA_VERSION;
  readonly corpus_commit_hashes: {
    readonly seed_cohort: string;
    readonly positive: string;
    readonly negative: string;
    readonly ambiguous: string;
  };
  readonly resolver_module_hash: string;
  readonly measured_at: string;
  readonly pairs_measured: {
    readonly positive: number;
    readonly negative: number;
    readonly ambiguous: number;
  };
  readonly confusion_matrix: {
    readonly tp: number;
    readonly fp: number;
    readonly tn: number;
    readonly fn: number;
    readonly abstained_pos: number;
    readonly abstained_neg: number;
    readonly abstained_amb: number;
    readonly matched_amb: number;
    readonly no_match_amb: number;
  };
  readonly metrics: {
    readonly false_merge_rate: number;
    readonly precision: number;
    readonly recall: number;
    readonly abstention_rate_on_ambiguous: number;
  };
  readonly rule_5j_gates: {
    readonly false_merge_le_1pct: boolean;
    readonly precision_ge_98pct: boolean;
    readonly recall_ge_70pct: boolean;
    readonly abstention_ge_80pct: boolean;
  };
  readonly all_hard_gates_pass: boolean;
  readonly all_gates_pass: boolean;
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Pure helpers
// ═════════════════════════════════════════════════════════════════════

function sha256File(abs: string): string {
  return createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
}

function readJsonl<T>(abs: string): T[] {
  const text = fs.readFileSync(abs, "utf8");
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("//"))
    .map((l) => JSON.parse(l) as T);
}

/** Build the canonical pool for a specific pair · uses the seed cohort
 *  entries as pool members. The resolver sees the pool as the universe
 *  of known canonicals. */
function buildPool(seeds: readonly SeedRecord[]): CanonicalResolverInput[] {
  return seeds.map((s) => ({
    canonical_business_id: s.seed_id,
    entity_type: s.entity_type as CanonicalResolverInput["entity_type"],
    country: s.country,
    name_canonical: String(s.identity.name_canonical ?? ""),
    name_norm: String(s.identity.name_norm ?? s.identity.name_canonical ?? ""),
    aliases:
      (Array.isArray(s.identity.aliases) ? s.identity.aliases : []) as string[],
    phone_e164:
      (s.identity.phone_e164 as string | null | undefined) ?? null,
    website_apex:
      (s.identity.website_apex as string | null | undefined) ?? null,
    osm_id: (s.identity.osm_id as string | null | undefined) ?? null,
    wikidata_qid: (s.identity.wikidata_qid as string | null | undefined) ?? null,
    city: (s.identity.city as string | null | undefined) ?? null,
    coordinates:
      (s.identity.coordinates as
        | { readonly lat: number; readonly lng: number }
        | null
        | undefined) ?? null,
  }));
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Measurement
// ═════════════════════════════════════════════════════════════════════

export interface MeasurementInputs {
  readonly seedCohortPath: string;
  readonly positivePairsPath: string;
  readonly negativePairsPath: string;
  readonly ambiguousPairsPath: string;
  readonly resolverModulePath: string;    // for hashing · the actual resolver function is imported
  readonly nowIso: string;                // injected for determinism
}

export function measure(inputs: MeasurementInputs): MeasurementArtefact {
  // Fail-closed prerequisite check.
  for (const p of [
    inputs.seedCohortPath,
    inputs.positivePairsPath,
    inputs.negativePairsPath,
    inputs.ambiguousPairsPath,
    inputs.resolverModulePath,
  ]) {
    if (!fs.existsSync(p)) {
      throw new Error(`measurement prerequisite missing: ${p}`);
    }
  }

  const seeds = readJsonl<SeedRecord>(inputs.seedCohortPath);
  const positives = readJsonl<EvalPair>(inputs.positivePairsPath);
  const negatives = readJsonl<EvalPair>(inputs.negativePairsPath);
  const ambiguous = readJsonl<EvalPair>(inputs.ambiguousPairsPath);

  const pool = buildPool(seeds);

  let tp = 0;         // positive · resolver answered MATCH to correct target
  let fp = 0;         // negative · resolver answered MATCH (false positive)
  let tn = 0;         // negative · resolver answered NO_MATCH
  let fn = 0;         // positive · resolver answered NO_MATCH (false negative)
  let abstainedPos = 0;
  let abstainedNeg = 0;
  let abstainedAmb = 0;
  let matchedAmb = 0;  // ambiguous · resolver returned MATCH (wrong · belt-and-braces check with Proof 6)
  let noMatchAmb = 0;

  for (const pair of positives) {
    const result = resolveCanonical({ candidate: pair.candidate_payload, pool });
    if (!isAnswered(result)) { abstainedPos++; continue; }
    const v = result.value;
    if (v.kind === "MATCH") {
      if (v.target_canonical_business_id === pair.expected_target_canonical_business_id) {
        tp++;
      } else {
        // Matched the WRONG target · counts as false merge.
        fp++;
      }
    } else if (v.kind === "NO_MATCH") {
      fn++;
    } else {
      // AMBIGUOUS on a positive pair · counts as abstention (not an error).
      abstainedPos++;
    }
  }

  for (const pair of negatives) {
    const result = resolveCanonical({ candidate: pair.candidate_payload, pool });
    if (!isAnswered(result)) { abstainedNeg++; continue; }
    const v = result.value;
    if (v.kind === "MATCH") {
      fp++;
    } else if (v.kind === "NO_MATCH") {
      tn++;
    } else {
      abstainedNeg++;
    }
  }

  for (const pair of ambiguous) {
    const result = resolveCanonical({ candidate: pair.candidate_payload, pool });
    if (!isAnswered(result)) { abstainedAmb++; continue; }
    const v = result.value;
    if (v.kind === "MATCH") {
      matchedAmb++;
      // Also counts as false merge in the gate · ambiguous pairs are
      // "resolver should abstain, not match".
    } else if (v.kind === "NO_MATCH") {
      noMatchAmb++;
    } else {
      abstainedAmb++;
    }
  }

  // Rule-5j metrics
  const negTotal = negatives.length;
  const ambTotal = ambiguous.length;
  const posTotal = positives.length;

  const false_merge_rate =
    (fp + matchedAmb) / Math.max(1, negTotal + ambTotal);
  const precision = (tp + fp) === 0 ? 1 : tp / (tp + fp);
  const recall = posTotal === 0 ? 1 : tp / posTotal;
  const abstention_rate_on_ambiguous =
    ambTotal === 0 ? 1 : abstainedAmb / ambTotal;

  const rule_5j_gates = {
    false_merge_le_1pct: false_merge_rate <= 0.01,
    precision_ge_98pct: precision >= 0.98,
    recall_ge_70pct: recall >= 0.70,
    abstention_ge_80pct: abstention_rate_on_ambiguous >= 0.80,
  };

  const all_hard_gates_pass =
    rule_5j_gates.false_merge_le_1pct && rule_5j_gates.precision_ge_98pct;
  const all_gates_pass =
    all_hard_gates_pass && rule_5j_gates.recall_ge_70pct && rule_5j_gates.abstention_ge_80pct;

  return {
    schema_version: MEASUREMENT_SCHEMA_VERSION,
    corpus_commit_hashes: {
      seed_cohort: sha256File(inputs.seedCohortPath),
      positive: sha256File(inputs.positivePairsPath),
      negative: sha256File(inputs.negativePairsPath),
      ambiguous: sha256File(inputs.ambiguousPairsPath),
    },
    resolver_module_hash: sha256File(inputs.resolverModulePath),
    measured_at: inputs.nowIso,
    pairs_measured: {
      positive: positives.length,
      negative: negatives.length,
      ambiguous: ambiguous.length,
    },
    confusion_matrix: {
      tp, fp, tn, fn,
      abstained_pos: abstainedPos,
      abstained_neg: abstainedNeg,
      abstained_amb: abstainedAmb,
      matched_amb: matchedAmb,
      no_match_amb: noMatchAmb,
    },
    metrics: {
      false_merge_rate,
      precision,
      recall,
      abstention_rate_on_ambiguous,
    },
    rule_5j_gates,
    all_hard_gates_pass,
    all_gates_pass,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §4 · CLI
// ═════════════════════════════════════════════════════════════════════

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_INPUTS: MeasurementInputs = {
  seedCohortPath: path.join(REPO_ROOT, "tests", "fixtures", "canonical", "seed-cohort-v1.jsonl"),
  positivePairsPath: path.join(REPO_ROOT, "tests", "fixtures", "eval", "positive-pairs-v1.jsonl"),
  negativePairsPath: path.join(REPO_ROOT, "tests", "fixtures", "eval", "negative-pairs-v1.jsonl"),
  ambiguousPairsPath: path.join(REPO_ROOT, "tests", "fixtures", "eval", "ambiguous-pairs-v1.jsonl"),
  resolverModulePath: path.join(REPO_ROOT, "scripts", "nex-canonical", "canonical-resolver.ts"),
  nowIso: new Date().toISOString(),
};

const isMain = (() => {
  try { return require.main === module; } catch { return false; }
})();

if (isMain) {
  try {
    const artefact = measure(DEFAULT_INPUTS);
    const outPath = path.join(REPO_ROOT, "measurement-run-latest.json");
    fs.writeFileSync(outPath, JSON.stringify(artefact, null, 2) + "\n");
    console.log(`Measurement complete. all_hard_gates_pass=${artefact.all_hard_gates_pass}  all_gates_pass=${artefact.all_gates_pass}`);
    console.log(`Metrics: fm=${artefact.metrics.false_merge_rate.toFixed(4)}  p=${artefact.metrics.precision.toFixed(4)}  r=${artefact.metrics.recall.toFixed(4)}  abst=${artefact.metrics.abstention_rate_on_ambiguous.toFixed(4)}`);
    console.log(`Artefact → ${outPath}`);
    if (!artefact.all_hard_gates_pass) process.exit(1);
  } catch (e) {
    console.error("measurement failed:", (e instanceof Error) ? e.message : String(e));
    process.exit(1);
  }
}
