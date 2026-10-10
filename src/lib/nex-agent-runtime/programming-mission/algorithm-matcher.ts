// WO-M-R-B · bounded evidence-driven algorithm matcher.
//
// Founder-locked 2026-09-14. Selects an `algorithm_kind` from NEX1's
// known primitive library based on OBSERVED test evidence · never from
// an instruction telling it which one. This is bounded inference:
// the vocabulary is fixed (NEX1's current primitives), but the choice
// among that vocabulary is derived from evidence · no external hint.
//
// Founder rule (locked): the matcher must NOT receive "the answer is
// describe_text." It may inspect: test assertions · repository code ·
// imports/exports · available capabilities · observed inputs/outputs.
//
// The matcher's decision itself becomes signed evidence · candidate
// capabilities considered, scores, and reasons must all be recorded so
// NEX2 and independent verification can inspect the selection.
//
// §36-A · ROUTE-2 · 2026-09-14 · typed-data-contract infrastructure.
// The `typed_data_contract` kind is SPEC-DRIVEN (not evidence-scored)
// and is intentionally NOT added to CAPABILITY_REGISTRY. The registry
// contains only primitives whose behaviour can be scored against test
// evidence via a runtime ref_impl. `typed_data_contract` has no runtime
// behaviour to score · it renders declarations deterministically from
// its spec (validated against the locked grammar in typed-data-contract-
// authoring.ts). This file is therefore unchanged structurally · this
// comment is the only mutation. See docs/NEX1/SECTION_36_A_ROUTE_2_LAB_
// AUTHORING_AMENDMENT.md.

import type { ParsedAssertion } from "./test-assertion-parser";
import type { DependencyGraph } from "./dependency-graph";

// ── Reference implementations (P-S · match production primitives) ──────
//
// Each reference implementation matches the DETERMINISTIC output of its
// authored primitive. If a real primitive changes semantics, this must
// change too · that's caught by unit test drift, not by the matcher.

function ref_truncate_words(text: unknown, max: unknown): string {
  if (typeof text !== "string" || typeof max !== "number") return "__NOT_APPLICABLE__";
  if (text.length === 0) return "";
  if (max <= 0) return "";
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0);
  if (words.length <= max) return text;
  return words.slice(0, max).join(" ");
}

function ref_text_stats(text: unknown): { words: number; chars: number } | "__NOT_APPLICABLE__" {
  if (typeof text !== "string") return "__NOT_APPLICABLE__";
  if (text.length === 0) return { words: 0, chars: 0 };
  return {
    words: text.trim().split(/\s+/).filter((w) => w.length > 0).length,
    chars: text.length,
  };
}

function ref_describe_text(text: unknown): string {
  if (typeof text !== "string") return "__NOT_APPLICABLE__";
  const stats = ref_text_stats(text);
  if (stats === "__NOT_APPLICABLE__") return "__NOT_APPLICABLE__";
  return `Text has ${stats.words} words`;
}

function ref_short_report(subject: unknown, body: unknown): string {
  if (typeof subject !== "string" || typeof body !== "string") return "__NOT_APPLICABLE__";
  return `Report on ${subject}: ${ref_truncate_words(body, 5)}`;
}

// M-F-03 · recursive Fibonacci with memoisation. Bounded primitive:
// signature (n: number) → number · n must be a non-negative integer.
function ref_fibonacci_memoised(n: unknown): number | "__NOT_APPLICABLE__" {
  if (typeof n !== "number" || !Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    return "__NOT_APPLICABLE__";
  }
  const memo = new Map<number, number>();
  const f = (k: number): number => {
    if (k <= 1) return k;
    const cached = memo.get(k);
    if (cached !== undefined) return cached;
    const v = f(k - 1) + f(k - 2);
    memo.set(k, v);
    return v;
  };
  return f(n);
}

// ── Capability registry ────────────────────────────────────────────────

export interface CapabilityDescriptor {
  readonly algorithm_kind: "truncate_words" | "short_report" | "text_stats" | "describe_text" | "fibonacci_memoised";
  readonly signature_arity: number;
  /** Reference implementation used to score a candidate against observed
   *  input/output pairs. Returns "__NOT_APPLICABLE__" if the args are
   *  wrong shape · that lets us disqualify a candidate without asserting
   *  it "predicts nothing". */
  readonly ref_impl: (...args: unknown[]) => unknown;
  /** For chained inference · what this capability needs to import. */
  readonly imports_needed: readonly { readonly symbol: string; readonly from_specifier_hint: string }[];
  /** For chained inference · what this capability exports. */
  readonly exports_symbol: string;
}

export const CAPABILITY_REGISTRY: readonly CapabilityDescriptor[] = Object.freeze([
  {
    algorithm_kind: "truncate_words",
    signature_arity: 2,
    ref_impl: (a: unknown, b: unknown) => ref_truncate_words(a, b),
    imports_needed: [],
    exports_symbol: "truncate_words",
  },
  {
    algorithm_kind: "text_stats",
    signature_arity: 1,
    ref_impl: (a: unknown) => ref_text_stats(a),
    imports_needed: [],
    exports_symbol: "text_stats",
  },
  {
    algorithm_kind: "describe_text",
    signature_arity: 1,
    ref_impl: (a: unknown) => ref_describe_text(a),
    imports_needed: [{ symbol: "text_stats", from_specifier_hint: "./" }],
    exports_symbol: "describe_text",
  },
  {
    algorithm_kind: "short_report",
    signature_arity: 2,
    ref_impl: (a: unknown, b: unknown) => ref_short_report(a, b),
    imports_needed: [{ symbol: "truncate_words", from_specifier_hint: "./" }],
    exports_symbol: "short_report",
  },
  {
    algorithm_kind: "fibonacci_memoised",
    signature_arity: 1,
    ref_impl: (a: unknown) => ref_fibonacci_memoised(a),
    imports_needed: [],
    exports_symbol: "fib",
  },
]);

// ── Selection evidence types ──────────────────────────────────────────

export interface CandidateScore {
  readonly algorithm_kind: string;
  readonly matched_assertions: number;
  readonly total_assertions: number;
  readonly score: number;                            // matched / total, or 0 if 0 applicable
  readonly applicable_assertions: number;             // assertions with correct arity
  readonly sample_matches: readonly {
    readonly input: readonly (string | number | boolean)[];
    readonly expected: string | number | boolean;
    readonly actual: unknown;
    readonly matched: boolean;
  }[];
}

export interface AlgorithmSelectionEvidence {
  readonly target_function_name: string;
  readonly target_file: string;
  readonly matcher_inputs: {
    readonly parsed_assertions: number;
    readonly assertions_for_target_fn: number;
  };
  readonly candidates_considered: readonly CandidateScore[];
  readonly selected: string | null;
  readonly selection_reason: string;
  readonly matcher_version: "M-R-B.v1";
}

// ── Match one candidate against a set of assertions ───────────────────

function scoreCandidate(cap: CapabilityDescriptor, assertions: readonly ParsedAssertion[], target_fn: string): CandidateScore {
  const relevant = assertions.filter((a) => a.function_name === target_fn);
  let applicable = 0;
  let matched = 0;
  const samples: CandidateScore["sample_matches"][number][] = [];
  for (const a of relevant) {
    // Arity check
    if (a.args.length !== cap.signature_arity) continue;
    applicable++;
    let actual: unknown;
    try { actual = cap.ref_impl(...a.args); } catch { actual = "__EXCEPTION__"; }
    if (actual === "__NOT_APPLICABLE__" || actual === "__EXCEPTION__") continue;
    const ok = deepEq(actual, a.expected);
    if (ok) matched++;
    if (samples.length < 3) samples.push({ input: a.args, expected: a.expected, actual, matched: ok });
  }
  return {
    algorithm_kind: cap.algorithm_kind,
    matched_assertions: matched,
    total_assertions: relevant.length,
    applicable_assertions: applicable,
    score: relevant.length === 0 ? 0 : matched / relevant.length,
    sample_matches: Object.freeze(samples),
  };
}

function deepEq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a === "object" && a !== null && b !== null) {
    const ak = Object.keys(a as Record<string, unknown>).sort();
    const bk = Object.keys(b as Record<string, unknown>).sort();
    if (ak.length !== bk.length) return false;
    for (let i = 0; i < ak.length; i++) if (ak[i] !== bk[i]) return false;
    for (const k of ak) if (!deepEq((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
    return true;
  }
  return false;
}

// ── Public matcher entry point ────────────────────────────────────────

export function selectAlgorithmFromEvidence(input: {
  readonly target_function_name: string;
  readonly target_file: string;
  readonly assertions: readonly ParsedAssertion[];
}): AlgorithmSelectionEvidence {
  const scores = CAPABILITY_REGISTRY.map((cap) => scoreCandidate(cap, input.assertions, input.target_function_name));
  // Only consider capabilities with non-zero applicable assertions
  const eligible = scores.filter((s) => s.applicable_assertions > 0);
  const relevantCount = input.assertions.filter((a) => a.function_name === input.target_function_name).length;

  let selected: string | null = null;
  let reason = "";
  if (eligible.length === 0) {
    reason = `no capability had signature-compatible assertions for '${input.target_function_name}' · ${input.assertions.length} total parsed · ${relevantCount} for this function name`;
  } else {
    // Pick the highest score · ties broken by "matched over more assertions" · then lexicographic on algorithm_kind for determinism
    const best = [...eligible].sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      if (a.matched_assertions !== b.matched_assertions) return b.matched_assertions - a.matched_assertions;
      return a.algorithm_kind.localeCompare(b.algorithm_kind);
    })[0];
    if (best.score >= 0.999) {
      selected = best.algorithm_kind;
      reason = `${best.algorithm_kind} matched ${best.matched_assertions}/${best.total_assertions} assertions for '${input.target_function_name}' (score ${best.score.toFixed(3)}) · perfect match`;
    } else if (best.score >= 0.5) {
      selected = best.algorithm_kind;
      reason = `${best.algorithm_kind} best partial match ${best.matched_assertions}/${best.total_assertions} (score ${best.score.toFixed(3)}) · above 0.5 threshold`;
    } else {
      reason = `best candidate ${best.algorithm_kind} scored ${best.score.toFixed(3)} · below 0.5 confidence threshold · no selection made`;
    }
  }
  return {
    target_function_name: input.target_function_name,
    target_file: input.target_file,
    matcher_inputs: {
      parsed_assertions: input.assertions.length,
      assertions_for_target_fn: relevantCount,
    },
    candidates_considered: Object.freeze(scores),
    selected,
    selection_reason: reason,
    matcher_version: "M-R-B.v1",
  };
}

/** For files that no test directly asserts against (e.g. a primitive
 *  imported by a consumer that IS tested), infer via the chosen
 *  consumer's imports_needed. The producer's algorithm_kind must be the
 *  registry entry whose exports_symbol matches what the consumer imports.
 */
export function inferProducerAlgorithmFromConsumer(input: {
  readonly consumer_selected_algorithm_kind: string;
  readonly producer_file: string;
  readonly dependency_graph: DependencyGraph | null;
}): AlgorithmSelectionEvidence {
  const consumerCap = CAPABILITY_REGISTRY.find((c) => c.algorithm_kind === input.consumer_selected_algorithm_kind);
  if (!consumerCap) {
    return {
      target_function_name: "(producer function · unknown target)",
      target_file: input.producer_file,
      matcher_inputs: { parsed_assertions: 0, assertions_for_target_fn: 0 },
      candidates_considered: [],
      selected: null,
      selection_reason: `consumer's algorithm_kind ${input.consumer_selected_algorithm_kind} not in registry`,
      matcher_version: "M-R-B.v1",
    };
  }
  // The consumer needs specific symbols. Find the producer capability
  // whose exports_symbol matches ONE OF the consumer's imports_needed.
  const candidates = CAPABILITY_REGISTRY.filter((cap) =>
    consumerCap.imports_needed.some((need) => need.symbol === cap.exports_symbol),
  );
  const scores: CandidateScore[] = CAPABILITY_REGISTRY.map((cap) => ({
    algorithm_kind: cap.algorithm_kind,
    matched_assertions: candidates.includes(cap) ? 1 : 0,
    total_assertions: 1,
    applicable_assertions: candidates.includes(cap) ? 1 : 0,
    score: candidates.includes(cap) ? 1 : 0,
    sample_matches: [],
  }));
  if (candidates.length === 0) {
    return {
      target_function_name: "(chained via consumer)",
      target_file: input.producer_file,
      matcher_inputs: { parsed_assertions: 0, assertions_for_target_fn: 0 },
      candidates_considered: Object.freeze(scores),
      selected: null,
      selection_reason: `no capability in the registry provides the symbols ${consumerCap.imports_needed.map((n) => n.symbol).join(", ")} that consumer ${consumerCap.algorithm_kind} needs`,
      matcher_version: "M-R-B.v1",
    };
  }
  // Determinism: if multiple candidates, pick first by lexicographic algorithm_kind
  const picked = [...candidates].sort((a, b) => a.algorithm_kind.localeCompare(b.algorithm_kind))[0];
  return {
    target_function_name: picked.exports_symbol,
    target_file: input.producer_file,
    matcher_inputs: { parsed_assertions: 0, assertions_for_target_fn: 0 },
    candidates_considered: Object.freeze(scores),
    selected: picked.algorithm_kind,
    selection_reason: `chained inference · consumer ${consumerCap.algorithm_kind} needs ${consumerCap.imports_needed.map((n) => n.symbol).join(", ")} · producer capability ${picked.algorithm_kind} exports ${picked.exports_symbol}`,
    matcher_version: "M-R-B.v1",
  };
}
