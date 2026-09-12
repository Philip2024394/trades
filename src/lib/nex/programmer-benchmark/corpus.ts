// src/lib/nex/programmer-benchmark/corpus.ts
//
// NEX Programmer Agent · Phase D · versioned corpus loader
// Philip 2026-09-05 · AUTHORIZE · PHASE D §22 §23
//
// Discipline:
//   · A corpus VERSION is immutable once frozen. Object.freeze on the
//     corpus and all cases so downstream code cannot mutate at runtime.
//   · No case may be added, removed, or modified during an evaluation
//     run (§23 · anti-adaptive-selection).
//   · Every case must have a stable unique case_id within its version.
//   · Duplicate case_id detection at freeze time.

import type {
  BenchmarkCase,
  BenchmarkCorpus,
  DefectClass,
} from "./types";

/** Freeze a case (and its nested request tree) so downstream code
 *  cannot mutate it after handoff to the evaluator. Recursive · covers
 *  arrays and nested objects. Idempotent. */
function deepFreeze<T>(x: T): Readonly<T> {
  if (x === null || typeof x !== "object") return x;
  if (Object.isFrozen(x)) return x as Readonly<T>;
  Object.freeze(x);
  for (const key of Object.keys(x)) {
    // @ts-expect-error safe indexing for freeze traversal
    const v = x[key];
    if (v && typeof v === "object" && !Object.isFrozen(v)) deepFreeze(v);
  }
  return x as Readonly<T>;
}

/** Freeze an entire corpus: cases array + each case + nested fields.
 *  Also verifies structural invariants:
 *   - version present
 *   - cases non-empty
 *   - all case_ids unique within this version
 *   - every case has matching corpus_version
 *   - defect_classes_covered reflects actual distinct classes */
export function freezeCorpus(input: {
  version: string;
  authored_by: string;
  cases: BenchmarkCase[];
}): BenchmarkCorpus {
  if (!input.version.trim()) throw new Error("freezeCorpus: version required");
  if (!input.cases || input.cases.length === 0) throw new Error("freezeCorpus: cases must be non-empty");

  // Case invariants
  const seenIds = new Set<string>();
  for (const c of input.cases) {
    if (!c.case_id.trim()) throw new Error("freezeCorpus: case missing case_id");
    if (seenIds.has(c.case_id)) throw new Error(`freezeCorpus: duplicate case_id "${c.case_id}"`);
    seenIds.add(c.case_id);
    if (c.corpus_version !== input.version) {
      throw new Error(`freezeCorpus: case ${c.case_id} corpus_version="${c.corpus_version}" does not match "${input.version}"`);
    }
    if (!c.ground_truth_evidence || c.ground_truth_evidence.length === 0) {
      throw new Error(`freezeCorpus: case ${c.case_id} missing ground_truth_evidence (§5 §6)`);
    }
  }

  const classes = Array.from(new Set(input.cases.map((c) => c.defect_class))) as DefectClass[];
  const corpus: BenchmarkCorpus = {
    version: input.version,
    frozen_at: new Date().toISOString(),
    authored_by: input.authored_by,
    cases: input.cases.map((c) => deepFreeze(c)),
    case_count: input.cases.length,
    defect_classes_covered: classes,
  };
  return deepFreeze(corpus);
}

/** Sanity check that a corpus is fully frozen (used by tests to
 *  confirm immutability contract). */
export function isCorpusFrozen(corpus: BenchmarkCorpus): boolean {
  if (!Object.isFrozen(corpus)) return false;
  if (!Object.isFrozen(corpus.cases)) return false;
  for (const c of corpus.cases) {
    if (!Object.isFrozen(c)) return false;
    if (!Object.isFrozen(c.request)) return false;
  }
  return true;
}

/** Take a snapshot of the corpus at run-start. Returns the corpus
 *  unchanged (already frozen) plus a snapshot header the evaluator
 *  can persist as run metadata. */
export type CorpusSnapshot = {
  version: string;
  frozen_at: string;
  case_count: number;
  case_ids: readonly string[];
  defect_classes_covered: readonly DefectClass[];
  snapshotted_at: string;
};

export function snapshotCorpus(corpus: BenchmarkCorpus): CorpusSnapshot {
  return {
    version: corpus.version,
    frozen_at: corpus.frozen_at,
    case_count: corpus.case_count,
    case_ids: corpus.cases.map((c) => c.case_id),
    defect_classes_covered: corpus.defect_classes_covered,
    snapshotted_at: new Date().toISOString(),
  };
}

/** Detect benchmark-specific hardcoding attempts (§21).
 *
 *  Cheat cues we care about:
 *   · case_id substring in freeform request text (semantic prose fields)
 *   · expected_verdict SENTINEL form (all-caps token) appearing in text
 *   · ground_truth SENTINEL form (all-caps token) appearing in text
 *
 *  DELIBERATELY NOT considered leaks:
 *   · case_id in implementation.files paths (routine benchmark file layout)
 *   · lowercase natural-English words like "correct" or "defective" in
 *     prose (these are semantic content · not sentinel-form cheat cues)
 *
 *  Rationale: the cheat concern is "reviewer can match on a sentinel
 *  or ID string". Natural prose containing the WORD "correct" is not
 *  a cheat vector — the reviewer would need to string-match "CORRECT"
 *  (verdict/ground-truth sentinel form) to exploit it. */
export function detectHardcodingLeaks(corpus: BenchmarkCorpus): string[] {
  const leaks: string[] = [];
  for (const c of corpus.cases) {
    const req = c.request;
    // Prose fields ONLY (skip files paths · which routinely include case_id).
    // Filter out file-path-shaped runtime_evidence entries — evidence
    // pointers with slashes and known log/artifact extensions are
    // paths not prose, and naming them after case_id is a routine
    // benchmark-organization convention rather than a cheat cue.
    const isPathLike = (s: string): boolean => /^[\w-]+\/[\w./_-]+$/.test(s) || /\.(log|json|txt|out|md|csv)$/.test(s);
    const runtimeProse = (req.runtime_evidence ?? []).filter((e) => !isPathLike(e));
    const proseFields = [
      req.requirement,
      req.implementation.summary,
      req.implementation.claim,
      req.tests.summary,
      ...runtimeProse,
      ...(req.requirement_details.edge_cases_required ?? []),
      ...(req.requirement_details.edge_cases_covered ?? []),
      ...(req.requirement_details.security_requirements ?? []),
      ...(req.requirement_details.security_violations_observed ?? []),
      ...(req.tests.known_gaps ?? []),
    ];
    const proseJoined = proseFields.join(" | ");
    const proseLower = proseJoined.toLowerCase();

    if (proseLower.includes(c.case_id.toLowerCase())) {
      leaks.push(`case ${c.case_id}: case_id leaks into request prose (potential cheat cue)`);
    }
    // Sentinel-form check · case-sensitive · uses word boundaries so
    // 'REJECT' as a sentinel is caught but 'reject' in natural prose is not.
    const verdictSentinel = new RegExp(`\\b${escapeRegex(c.expected_verdict)}\\b`);
    if (verdictSentinel.test(proseJoined)) {
      leaks.push(`case ${c.case_id}: expected_verdict sentinel "${c.expected_verdict}" appears in request prose`);
    }
    const groundTruthSentinel = new RegExp(`\\b${escapeRegex(c.ground_truth)}\\b`);
    if (groundTruthSentinel.test(proseJoined)) {
      leaks.push(`case ${c.case_id}: ground_truth sentinel "${c.ground_truth}" appears in request prose`);
    }
  }
  return leaks;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
