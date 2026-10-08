// scripts/nex-canonical/candidate-reviewer.ts
//
// NEX Business Canonical · Candidate review-summary generator.
// Pure · no DB · no network · no filesystem.
//
// Takes a Candidate[] (either in-memory or parsed from the β JSONL
// via `candidate-validator`) and produces a deterministic ReviewReport
// containing:
//   · total counts and distributions keyed on fields that live in the
//     sealed Candidate shape
//   · identity-coverage stats (presence vs null for each identity field)
//   · a `selection_score` distribution (min/p25/median/p75/max/mean)
//   · an anomalies list using rules that can be decided from Candidate
//     alone (deterministic, no inference)
//   · a `deferred` list naming information deliberately NOT in scope
//     because it would require resolver execution, DB inspection,
//     ground-truth labels, or β output that does not yet exist
//
// Guardrails
//   · Does NOT invent semantic rules. Every anomaly is decided purely
//     from Candidate fields. If a rule would need resolver / DB /
//     ground-truth context, it is NOT implemented and the limitation
//     is named in `deferred`.
//   · Does NOT modify any sealed α.2 module.
//   · Does NOT import pg, pg-executor, pg-fingerprint, or
//     extract-candidates. The only script-local imports are
//     `./generate-candidates` (sealed type exports) and
//     `./candidate-validator` (sealed enum snapshot).

import {
  type Candidate,
  type EntityType,
  type RiskCategory,
} from "./generate-candidates";
import { SEALED_RISK_CATEGORIES } from "./candidate-validator";

// ═════════════════════════════════════════════════════════════════════
// §1 · Public result types
// ═════════════════════════════════════════════════════════════════════

/** Distribution summary for a numeric series. Fields are in [0,1] when
 *  used for `selection_score` but the shape is reusable (e.g. rationale
 *  entry counts). All values are deterministic for a given input. */
export interface Distribution {
  count: number;
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
  mean: number;
}

/** How many candidates have each identity sub-field populated. The
 *  denominator is the total candidate count. */
export interface IdentityCoverage {
  phone_e164_present: number;
  website_apex_present: number;
  osm_id_present: number;
  wikidata_qid_present: number;
  city_present: number;
  district_present: number;
  coordinates_present: number;
  aliases_non_empty: number;
}

/** One anomaly finding. `rule` is a stable short identifier; the
 *  `candidate_ids` array lists every candidate that triggers the rule
 *  (sorted alphabetically for determinism). */
export interface Anomaly {
  rule: AnomalyRule;
  severity: "flag" | "bug_suspected";
  description: string;
  candidate_ids: readonly string[];
}

/** Enumeration of the anomaly rules we can decide from Candidate alone. */
export type AnomalyRule =
  | "duplicate_candidate_id"
  | "duplicate_legacy_source"
  | "zero_risk_categories"
  | "risk_rationale_mismatch"
  | "score_boundary"
  | "thin_identity"
  | "mixed_generation_run_id"
  | "mixed_generated_at";

/** Metadata pinned across the whole input · sentinels fire when the
 *  input mixes runs or generators (which the validator would already
 *  reject for generator, but mixed_run_id / mixed_generated_at can
 *  occur if a reviewer concatenated two β JSONL files). */
export interface PinnedRunMetadata {
  generator: string | "MIXED";
  generation_run_id: string | "MIXED";
  generated_at: string | "MIXED";
  distinct_run_ids: readonly string[];
  distinct_generated_at: readonly string[];
}

export interface ReviewReport {
  total_candidates: number;

  by_entity_type: Readonly<Record<string, number>>;
  by_country: Readonly<Record<string, number>>;
  by_source_table: Readonly<Record<string, number>>;
  by_risk_category: Readonly<Record<RiskCategory, number>>;
  candidates_with_multiple_risk_categories: number;
  candidates_with_zero_risk_categories: number;

  selection_score_distribution: Distribution;
  rationale_entries_per_candidate_distribution: Distribution;
  identity_coverage: IdentityCoverage;

  anomalies: readonly Anomaly[];
  pinned_run_metadata: PinnedRunMetadata;

  /** Everything we deliberately CANNOT determine from the Candidate
   *  shape alone. Each entry is a short description + why. */
  deferred: readonly string[];
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Deferred list · what the reviewer deliberately will not infer
// ═════════════════════════════════════════════════════════════════════

export const DEFERRED_UNTIL_LATER: readonly string[] = Object.freeze([
  "Actual legacy population counts (nex_business, mp_seller, food, accommodation, service, transport_acquisition_record) · requires β output which requires live DB access",
  "True duplicate detection beyond (candidate_id, legacy_source) pairs · requires resolver execution against the full candidate set",
  "Resolver confidence or match quality · resolver has not been invoked",
  "Ground-truth seed-approval labels · require founder/admin approval and are not present in the Candidate shape",
  "Entity-type correctness verification · would require DB inspection of the original legacy row and its business_category",
  "Rule 5l business_category quarantine-leakage detection at the source level · the business_category column is NOT in Candidate (only the derived entity_type is); indirect guard is enforced by the sealed EntityType enum in the validator",
  "Row-level timestamps or claim/ownership status from the legacy DB · not projected into the Candidate shape",
  "Cross-candidate semantic similarity (name variants, phone normalisation, website apex matching) · requires resolver",
  "Freshness/decay signals · require source_registry + evidence tables which are not in Candidate",
]);

// ═════════════════════════════════════════════════════════════════════
// §3 · Pure helpers · exported for direct testability
// ═════════════════════════════════════════════════════════════════════

/** Compute a Distribution for a numeric series. Empty input yields
 *  all-zero result with count=0. Deterministic sort-and-select for
 *  percentiles (no interpolation; chooses the lower index on ties).
 *  NaN / non-finite inputs are rejected. */
export function computeDistribution(values: readonly number[]): Distribution {
  if (values.length === 0) {
    return { count: 0, min: 0, p25: 0, median: 0, p75: 0, max: 0, mean: 0 };
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error("computeDistribution: non-finite value in input");
    }
  }
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const pick = (q: number): number => {
    // Lower-index selection; stable across Node versions.
    const idx = Math.min(n - 1, Math.max(0, Math.floor(q * (n - 1))));
    return sorted[idx];
  };
  const mean = sorted.reduce((s, x) => s + x, 0) / n;
  return {
    count: n,
    min: sorted[0],
    p25: pick(0.25),
    median: pick(0.5),
    p75: pick(0.75),
    max: sorted[n - 1],
    mean,
  };
}

/** Tally occurrences of each distinct key. Preserves insertion-order
 *  of first-seen keys for deterministic iteration (JS Map/Record both
 *  guarantee this for string keys since ES2015). */
export function tallyBy<K extends string>(
  keys: Iterable<K>,
): Readonly<Record<K, number>> {
  const out: Record<string, number> = {};
  for (const k of keys) {
    out[k] = (out[k] ?? 0) + 1;
  }
  return out as Readonly<Record<K, number>>;
}

/** Return the set of values that appear more than once in `items`,
 *  sorted alphabetically for determinism. */
export function findDuplicates<T>(
  items: Iterable<T>,
  key: (t: T) => string,
): readonly string[] {
  const seen = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  const dups: string[] = [];
  for (const [k, n] of seen.entries()) {
    if (n > 1) dups.push(k);
  }
  dups.sort();
  return dups;
}

// ═════════════════════════════════════════════════════════════════════
// §4 · Anomaly rules · each decided from Candidate alone
// ═════════════════════════════════════════════════════════════════════

function hasAnyIdentitySignal(c: Candidate): boolean {
  const i = c.identity;
  return (
    (i.phone_e164 !== null && i.phone_e164.length > 0) ||
    (i.website_apex !== null && i.website_apex.length > 0) ||
    (i.osm_id !== null && i.osm_id.length > 0) ||
    (i.wikidata_qid !== null && i.wikidata_qid.length > 0) ||
    (i.district !== null && i.district.length > 0) ||
    i.coordinates !== null ||
    i.aliases.length > 0
  );
}

function detectAnomalies(
  candidates: readonly Candidate[],
): readonly Anomaly[] {
  const anomalies: Anomaly[] = [];

  // Rule 1 · duplicate_candidate_id · bug_suspected
  const dupIds = findDuplicates(candidates, (c) => c.candidate_id);
  if (dupIds.length > 0) {
    anomalies.push({
      rule: "duplicate_candidate_id",
      severity: "bug_suspected",
      description:
        "Two or more candidates share the same candidate_id · generator must emit unique ids",
      candidate_ids: dupIds,
    });
  }

  // Rule 2 · duplicate_legacy_source · bug_suspected
  const dupLegacy = findDuplicates(
    candidates,
    (c) => `${c.legacy_source.table}|${c.legacy_source.ref}`,
  );
  if (dupLegacy.length > 0) {
    // Project back to candidate_ids that share each (table,ref) pair.
    const bucket = new Map<string, string[]>();
    for (const c of candidates) {
      const k = `${c.legacy_source.table}|${c.legacy_source.ref}`;
      if (!dupLegacy.includes(k)) continue;
      const arr = bucket.get(k) ?? [];
      arr.push(c.candidate_id);
      bucket.set(k, arr);
    }
    const ids = Array.from(bucket.values()).flat().sort();
    anomalies.push({
      rule: "duplicate_legacy_source",
      severity: "bug_suspected",
      description:
        "Two or more candidates share the same (legacy_source.table, legacy_source.ref) pair · generator must dedupe legacy rows",
      candidate_ids: ids,
    });
  }

  // Rule 3 · zero_risk_categories · bug_suspected
  const zeroRisk = candidates
    .filter((c) => c.risk_categories.length === 0)
    .map((c) => c.candidate_id)
    .sort();
  if (zeroRisk.length > 0) {
    anomalies.push({
      rule: "zero_risk_categories",
      severity: "bug_suspected",
      description:
        "Candidate has empty risk_categories · generator must attach at least one R1..R10 category",
      candidate_ids: zeroRisk,
    });
  }

  // Rule 4 · risk_rationale_mismatch · bug_suspected
  const mismatch: string[] = [];
  for (const c of candidates) {
    const inCats = new Set(c.risk_categories);
    const inRationale = new Set(
      c.selection_rationale.map((r) => r.risk_category),
    );
    // Any rationale entry whose category is not in risk_categories
    // OR any risk_category with no corresponding rationale entry.
    let bad = false;
    for (const r of inRationale) {
      if (!inCats.has(r)) {
        bad = true;
        break;
      }
    }
    if (!bad) {
      for (const r of inCats) {
        if (!inRationale.has(r)) {
          bad = true;
          break;
        }
      }
    }
    if (bad) mismatch.push(c.candidate_id);
  }
  mismatch.sort();
  if (mismatch.length > 0) {
    anomalies.push({
      rule: "risk_rationale_mismatch",
      severity: "bug_suspected",
      description:
        "risk_categories and selection_rationale[*].risk_category disagree on the set of categories for this candidate",
      candidate_ids: mismatch,
    });
  }

  // Rule 5 · score_boundary · flag (not a bug, but worth attention)
  const boundary = candidates
    .filter(
      (c) => c.selection_score === 0 || c.selection_score === 1,
    )
    .map((c) => c.candidate_id)
    .sort();
  if (boundary.length > 0) {
    anomalies.push({
      rule: "score_boundary",
      severity: "flag",
      description:
        "selection_score sits exactly at 0 or 1 · may indicate underflow / saturation / clamp artefact worth founder inspection",
      candidate_ids: boundary,
    });
  }

  // Rule 6 · thin_identity · flag (expected for R6-category candidates)
  const thin = candidates
    .filter((c) => !hasAnyIdentitySignal(c))
    .map((c) => c.candidate_id)
    .sort();
  if (thin.length > 0) {
    anomalies.push({
      rule: "thin_identity",
      severity: "flag",
      description:
        "Candidate has no phone / website / osm_id / wikidata_qid / district / coordinates / aliases · name-only identity (expected for R6-class rows; flag so the founder sees how many)",
      candidate_ids: thin,
    });
  }

  // Rule 7 · mixed_generation_run_id · flag
  const runIds = new Set(
    candidates.map((c) => c.generation_source.generation_run_id),
  );
  if (runIds.size > 1) {
    anomalies.push({
      rule: "mixed_generation_run_id",
      severity: "flag",
      description:
        `Candidate set spans ${runIds.size} distinct generation_run_id values · reviewer may be inspecting a concatenation of multiple β runs`,
      candidate_ids: [],
    });
  }

  // Rule 8 · mixed_generated_at · flag (independent · generation_run_id
  // and generated_at are both set per run, but if either drifts without
  // the other it's unusual)
  const generatedAts = new Set(
    candidates.map((c) => c.generation_source.generated_at),
  );
  if (generatedAts.size > 1) {
    anomalies.push({
      rule: "mixed_generated_at",
      severity: "flag",
      description:
        `Candidate set spans ${generatedAts.size} distinct generated_at values · reviewer may be inspecting a concatenation of multiple β runs`,
      candidate_ids: [],
    });
  }

  return anomalies;
}

// ═════════════════════════════════════════════════════════════════════
// §5 · Public entry point · pure
// ═════════════════════════════════════════════════════════════════════

/** Produce a deterministic ReviewReport for a Candidate[]. Pure · no
 *  side effects · no inference beyond what the sealed Candidate shape
 *  exposes. For items that cannot be decided from Candidate alone,
 *  see `DEFERRED_UNTIL_LATER` and `report.deferred`. */
export function reviewCandidates(
  candidates: readonly Candidate[],
): ReviewReport {
  const total = candidates.length;

  // Distributions
  const byEntityType = tallyBy(
    candidates.map((c) => c.entity_type),
  ) as Readonly<Record<EntityType, number>>;
  const byCountry = tallyBy(candidates.map((c) => c.country));
  const bySourceTable = tallyBy(
    candidates.map((c) => c.legacy_source.table),
  );

  // Risk categories (0..1 per category per candidate; totals >= total)
  const riskCounts: Record<string, number> = {};
  for (const rc of SEALED_RISK_CATEGORIES) riskCounts[rc] = 0;
  for (const c of candidates) {
    for (const rc of c.risk_categories) riskCounts[rc] = (riskCounts[rc] ?? 0) + 1;
  }
  const byRiskCategory = riskCounts as Readonly<Record<RiskCategory, number>>;

  const multiRisk = candidates.filter((c) => c.risk_categories.length > 1)
    .length;
  const zeroRisk = candidates.filter((c) => c.risk_categories.length === 0)
    .length;

  const scoreDistribution = computeDistribution(
    candidates.map((c) => c.selection_score),
  );
  const rationaleDistribution = computeDistribution(
    candidates.map((c) => c.selection_rationale.length),
  );

  // Identity coverage
  const coverage: IdentityCoverage = {
    phone_e164_present: candidates.filter((c) => c.identity.phone_e164 !== null)
      .length,
    website_apex_present: candidates.filter(
      (c) => c.identity.website_apex !== null,
    ).length,
    osm_id_present: candidates.filter((c) => c.identity.osm_id !== null)
      .length,
    wikidata_qid_present: candidates.filter(
      (c) => c.identity.wikidata_qid !== null,
    ).length,
    city_present: candidates.filter((c) => c.identity.city !== null).length,
    district_present: candidates.filter((c) => c.identity.district !== null)
      .length,
    coordinates_present: candidates.filter(
      (c) => c.identity.coordinates !== null,
    ).length,
    aliases_non_empty: candidates.filter((c) => c.identity.aliases.length > 0)
      .length,
  };

  // Pinned run metadata
  const generators = new Set(
    candidates.map((c) => c.generation_source.generator),
  );
  const runIds = Array.from(
    new Set(candidates.map((c) => c.generation_source.generation_run_id)),
  ).sort();
  const generatedAts = Array.from(
    new Set(candidates.map((c) => c.generation_source.generated_at)),
  ).sort();
  const pinned: PinnedRunMetadata = {
    generator: generators.size === 1 ? [...generators][0] : "MIXED",
    generation_run_id: runIds.length === 1 ? runIds[0] : "MIXED",
    generated_at: generatedAts.length === 1 ? generatedAts[0] : "MIXED",
    distinct_run_ids: runIds,
    distinct_generated_at: generatedAts,
  };

  const anomalies = detectAnomalies(candidates);

  return {
    total_candidates: total,
    by_entity_type: byEntityType,
    by_country: byCountry,
    by_source_table: bySourceTable,
    by_risk_category: byRiskCategory,
    candidates_with_multiple_risk_categories: multiRisk,
    candidates_with_zero_risk_categories: zeroRisk,
    selection_score_distribution: scoreDistribution,
    rationale_entries_per_candidate_distribution: rationaleDistribution,
    identity_coverage: coverage,
    anomalies,
    pinned_run_metadata: pinned,
    deferred: DEFERRED_UNTIL_LATER,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §6 · Static invariants · module-level
// ═════════════════════════════════════════════════════════════════════
//
// Deliberately re-asserted at the bottom of this file for grep-ability:
//
// This module is PURE. It:
//   · does NOT open a network connection
//   · does NOT read or write the filesystem
//   · does NOT instantiate a pg Client
//   · does NOT import pg, pg-executor, pg-fingerprint, or
//     extract-candidates
//   · does NOT reference credentials, Supabase, or the resolver
//   · does NOT modify any sealed α.2 module (type-only imports)
//
// Every anomaly rule is decided from Candidate fields alone. If a
// semantically useful rule would need resolver / DB / ground-truth
// context, it is NOT implemented and the limitation is named in the
// `deferred` list.
//
// This file cannot be executed with `node candidate-reviewer.ts`; it
// exports functions but does not implement a module entry runner.
