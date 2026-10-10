// F-C-02 · Bounded pairwise composition matcher.
//
// Founder-locked 2026-09-14. This module runs ONLY as a fallback when
// selectAlgorithmFromEvidence returns null · i.e. when no single
// registered capability satisfies the mission's assertions. It attempts
// to discover, purely from evidence, a pair of registered primitives
// (A, B) plus a template string that reproduces the expected output for
// every parsed assertion.
//
// Founder rules (locked · verbatim from F-C-02 build spec):
//   · Mission byte-for-byte identical to F-C-01 baseline.
//   · Do NOT hard-code the answer into the matcher.
//   · The matcher must not contain a per-mission conditional mapping a
//     specific target function name to a specific pair of primitives.
//   · The correct pair must be discovered from mission evidence.
//   · If a hint is required to succeed, G-level must be downgraded.
//   · The recorded evidence must preserve WHY the pair won, not merely
//     that it won.
//
// This file contains NO string literal referring to any specific mission
// target function name. Its output is a signed PairSelectionEvidence
// value that lists every pair considered and every score, so an
// independent reviewer (NEX2 · founder · Claude) can inspect the
// discovery process rather than trust the final answer.
//
// Failure IS a valid result. If no pair produces a consistent template
// across all assertions, selectPairFromEvidence returns { selected_pair:
// null } and the caller must refuse honestly.

import type { ParsedAssertion } from "./test-assertion-parser";
import type { PairComposition, PairPlaceholderBinding } from "./types";
import { CAPABILITY_REGISTRY, type CapabilityDescriptor } from "./algorithm-matcher";

// ── Evidence shape (recorded per-run · never mutated after signing) ────

export interface PairScore {
  readonly a_algorithm_kind: string;
  readonly b_algorithm_kind: string;
  readonly considered: boolean;
  readonly applicable: boolean;               // both primitives applicable to all assertions
  readonly template_found: boolean;
  readonly matched_assertions: number;
  readonly total_assertions: number;
  readonly score: number;                     // matched / total · 0 if no template
  readonly reason: string;                    // why this pair won/lost · human-readable audit
  readonly template: string | null;
  readonly a_extracted_args: readonly (string | number | boolean)[];
  readonly b_extracted_args: readonly (string | number | boolean)[];
}

export interface PairSelectionEvidence {
  readonly target_function_name: string;
  readonly target_file: string;
  readonly matcher_inputs: {
    readonly parsed_assertions: number;
    readonly assertions_for_target_fn: number;
  };
  readonly pairs_considered: readonly PairScore[];
  readonly selected_pair: PairComposition | null;
  readonly selection_reason: string;
  readonly matcher_version: "F-C-02.v1";
}

// ── Bounded numeric-arg search space (evidence-derivable) ──────────────
//
// Small, bounded, and lexically committed here so no mission-specific
// tuning happens at runtime. The upper bound comes from Master Training
// Guide §12 Stage C1: "bounded pairwise composition". Numbers beyond
// what appears in the mission are unnecessary.
const NUMERIC_ARG_SEARCH_SPACE: readonly number[] = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

// ── Reference execution utilities ──────────────────────────────────────

const NOT_APPLICABLE = "__NOT_APPLICABLE__";

/** Call a primitive with (missionInput, ...extras) safely. Returns
 *  NOT_APPLICABLE on argument-shape mismatch or exception. Never throws. */
function callPrimitive(cap: CapabilityDescriptor, missionInput: unknown, extras: readonly unknown[]): unknown {
  const argCount = cap.signature_arity;
  const args: unknown[] = [missionInput, ...extras].slice(0, argCount);
  if (args.length < argCount) return NOT_APPLICABLE;
  try {
    const result = cap.ref_impl(...args);
    return result;
  } catch {
    return NOT_APPLICABLE;
  }
}

/** Enumerate the argument space for a primitive's extra args (beyond
 *  the mission input, which occupies arg 0). Bounded and evidence-derived:
 *  numeric slots iterate NUMERIC_ARG_SEARCH_SPACE; string slots iterate
 *  { missionInput, "" } to allow (text, text) or (text, "") patterns.
 *  Boolean slots iterate {true, false}. */
function enumerateExtraArgSpaces(cap: CapabilityDescriptor, missionInput: unknown): readonly (readonly unknown[])[] {
  const extras = cap.signature_arity - 1;
  if (extras <= 0) return [Object.freeze([])];
  // For each extra slot, guess type by probing the ref_impl. We probe
  // with a numeric value first: if the primitive accepts it, that slot
  // is numeric. If not, it's string.
  const spaces: unknown[][] = [];
  for (let slot = 1; slot < cap.signature_arity; slot++) {
    // Probe: run ref_impl with [missionInput, 0 filler for prior slots, sentinel at this slot]
    // Sentinel choice: number vs string. Empirically, if a number is
    // accepted (result !== NOT_APPLICABLE), the slot is numeric.
    // Otherwise assume string.
    const probeArgs = new Array(cap.signature_arity).fill(missionInput);
    probeArgs[slot] = 5;
    let r: unknown;
    try { r = cap.ref_impl(...probeArgs); } catch { r = NOT_APPLICABLE; }
    if (r !== NOT_APPLICABLE) {
      spaces.push([...NUMERIC_ARG_SEARCH_SPACE]);
    } else {
      spaces.push([missionInput, ""]);
    }
  }
  return cartesian(spaces);
}

function cartesian<T>(arrays: readonly (readonly T[])[]): readonly (readonly T[])[] {
  if (arrays.length === 0) return [Object.freeze([])];
  const [first, ...rest] = arrays;
  const restCart = cartesian(rest);
  const out: T[][] = [];
  for (const a of first) for (const r of restCart) out.push([a, ...r]);
  return out.map((x) => Object.freeze(x));
}

// ── Template induction ─────────────────────────────────────────────────
//
// Given N (a_output, b_output, expected) triples, discover a template
// string with 0..2 placeholders such that substituting each placeholder
// with an a_output or b_output primitive reproduces `expected` for every
// triple. If no such template exists, return null.
//
// Structural approach · greedy but exhaustive over primitive bindings:
//   1. Compute longest common prefix (L) and suffix (S) of all expected.
//   2. Extract variable regions V_i = expected_i.slice(L.length, len - S.length).
//   3. Case A · all V_i equal → 0 placeholders → template = L + V_0 + S.
//   4. Case B · find a longest common substring MID present in all V_i
//               → split each V_i at MID into (P1_i, P2_i)
//               → find bindings for P1_i and P2_i (which primitive value
//                 from a_i or b_i reproduces each P1_i / P2_i)
//               → template = L + placeholder(P1) + MID + placeholder(P2) + S
//   5. Case C · single placeholder → find binding for all V_i.
//   6. If no consistent bindings exist → null.

interface TemplateInduction {
  readonly template: string;
  readonly placeholders: readonly PairPlaceholderBinding[];
}

function longestCommonPrefix(strs: readonly string[]): string {
  if (strs.length === 0) return "";
  let p = 0;
  const first = strs[0];
  while (p < first.length) {
    const ch = first[p];
    for (let i = 1; i < strs.length; i++) if (strs[i][p] !== ch) return first.slice(0, p);
    p++;
  }
  return first;
}

function longestCommonSuffix(strs: readonly string[]): string {
  if (strs.length === 0) return "";
  let p = 0;
  const first = strs[0];
  while (p < first.length) {
    const ch = first[first.length - 1 - p];
    for (let i = 1; i < strs.length; i++) {
      const s = strs[i];
      if (s.length - 1 - p < 0) return first.slice(first.length - p);
      if (s[s.length - 1 - p] !== ch) return first.slice(first.length - p);
    }
    p++;
  }
  return first;
}

function longestCommonSubstringAcross(strs: readonly string[]): string {
  if (strs.length === 0) return "";
  if (strs.length === 1) return strs[0];
  // Take all substrings of the shortest string, longest-first, and
  // return the first one that appears in every other string.
  const sorted = [...strs].sort((a, b) => a.length - b.length);
  const shortest = sorted[0];
  for (let len = shortest.length; len > 0; len--) {
    for (let start = 0; start + len <= shortest.length; start++) {
      const cand = shortest.slice(start, start + len);
      if (cand.length === 0) continue;
      let allContain = true;
      for (let i = 1; i < sorted.length; i++) {
        if (!sorted[i].includes(cand)) { allContain = false; break; }
      }
      if (allContain) return cand;
    }
  }
  return "";
}

/** Given N observed variable-region values and per-assertion outputs
 *  from A and B, find a primitive binding whose stringified value
 *  matches values[i] for every i. */
function findBindingFromOutputs(
  values: readonly string[],
  aOutputs: readonly unknown[],
  bOutputs: readonly unknown[],
): PairPlaceholderBinding | null {
  // Try b as whole scalar
  const bAsWholeMatches = values.every((v, i) => stringify(bOutputs[i]) === v);
  if (bAsWholeMatches) return { source: "B", path: null, rendered_placeholder: "{B}" };

  // Try a as whole scalar
  const aAsWholeMatches = values.every((v, i) => stringify(aOutputs[i]) === v);
  if (aAsWholeMatches) return { source: "A", path: null, rendered_placeholder: "{A}" };

  // Try each field path of a (assume object outputs share the same key set)
  const aFields = collectFieldNames(aOutputs);
  for (const field of aFields) {
    const matches = values.every((v, i) => {
      const out = aOutputs[i];
      if (out === null || typeof out !== "object") return false;
      const val = (out as Record<string, unknown>)[field];
      return stringify(val) === v;
    });
    if (matches) return { source: "A", path: field, rendered_placeholder: `{A.${field}}` };
  }

  // Try each field path of b
  const bFields = collectFieldNames(bOutputs);
  for (const field of bFields) {
    const matches = values.every((v, i) => {
      const out = bOutputs[i];
      if (out === null || typeof out !== "object") return false;
      const val = (out as Record<string, unknown>)[field];
      return stringify(val) === v;
    });
    if (matches) return { source: "B", path: field, rendered_placeholder: `{B.${field}}` };
  }

  return null;
}

function collectFieldNames(outs: readonly unknown[]): readonly string[] {
  const names = new Set<string>();
  for (const o of outs) {
    if (o !== null && typeof o === "object") {
      for (const k of Object.keys(o as Record<string, unknown>)) names.add(k);
    }
  }
  return [...names];
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return "";
}

function induceTemplate(
  expecteds: readonly string[],
  aOutputs: readonly unknown[],
  bOutputs: readonly unknown[],
): TemplateInduction | null {
  const L = longestCommonPrefix(expecteds);
  const S = longestCommonSuffix(expecteds);
  // Guard against overlap when the whole string is common
  const variableRegions = expecteds.map((e) => {
    const end = e.length - S.length;
    if (end < L.length) return "";
    return e.slice(L.length, end);
  });

  // Case A · all variable regions identical
  const allEqual = variableRegions.every((v) => v === variableRegions[0]);
  if (allEqual) {
    return {
      template: L + variableRegions[0] + S,
      placeholders: [],
    };
  }

  // Case B · try two placeholders via longest common substring across V_i
  const mid = longestCommonSubstringAcross(variableRegions);
  if (mid.length > 0 && variableRegions.every((v) => v.includes(mid))) {
    const splits = variableRegions.map((v) => {
      const idx = v.indexOf(mid);
      return { p1: v.slice(0, idx), p2: v.slice(idx + mid.length) };
    });
    const p1Vals = splits.map((s) => s.p1);
    const p2Vals = splits.map((s) => s.p2);
    const p1Binding = findBindingFromOutputs(p1Vals, aOutputs, bOutputs);
    const p2Binding = findBindingFromOutputs(p2Vals, aOutputs, bOutputs);
    if (p1Binding && p2Binding && !sameBinding(p1Binding, p2Binding)) {
      return {
        template: L + p1Binding.rendered_placeholder + mid + p2Binding.rendered_placeholder + S,
        placeholders: [p1Binding, p2Binding],
      };
    }
  }

  // Case C · single placeholder for the whole variable region
  const singleBinding = findBindingFromOutputs(variableRegions, aOutputs, bOutputs);
  if (singleBinding) {
    return {
      template: L + singleBinding.rendered_placeholder + S,
      placeholders: [singleBinding],
    };
  }

  return null;
}

function sameBinding(a: PairPlaceholderBinding, b: PairPlaceholderBinding): boolean {
  return a.source === b.source && a.path === b.path;
}

// ── Public matcher entry point ─────────────────────────────────────────

export function selectPairFromEvidence(input: {
  readonly target_function_name: string;
  readonly target_file: string;
  readonly assertions: readonly ParsedAssertion[];
}): PairSelectionEvidence {
  const relevant = input.assertions.filter((a) => a.function_name === input.target_function_name);
  const missionInputs = relevant.map((a) => a.args[0]);
  const expecteds = relevant.map((a) => a.expected);
  const expectedsAreStrings = expecteds.every((e) => typeof e === "string");

  const scores: PairScore[] = [];

  if (relevant.length === 0) {
    return {
      target_function_name: input.target_function_name,
      target_file: input.target_file,
      matcher_inputs: {
        parsed_assertions: input.assertions.length,
        assertions_for_target_fn: 0,
      },
      pairs_considered: Object.freeze([]),
      selected_pair: null,
      selection_reason: "no parsed assertions target this function",
      matcher_version: "F-C-02.v1",
    };
  }

  if (!expectedsAreStrings) {
    // Pairwise composition producing non-string output is out of scope
    // for F-C-02. Record and refuse cleanly.
    return {
      target_function_name: input.target_function_name,
      target_file: input.target_file,
      matcher_inputs: {
        parsed_assertions: input.assertions.length,
        assertions_for_target_fn: relevant.length,
      },
      pairs_considered: Object.freeze([]),
      selected_pair: null,
      selection_reason: "expected values are not all strings · F-C-02 supports string-returning compositions only",
      matcher_version: "F-C-02.v1",
    };
  }

  const expectedStrs = expecteds as readonly string[];

  // Ordered pairs · include A === B slot (same-cap with different args)
  for (const capA of CAPABILITY_REGISTRY) {
    for (const capB of CAPABILITY_REGISTRY) {
      // For same-cap same-args, both compute identical outputs · skip.
      // Same-cap DIFFERENT extras is allowed (e.g. truncate_words(text, 3)
      // + truncate_words(text, 5)) so we don't blanket-skip A===B.
      const aExtraSpaces = enumerateExtraArgSpaces(capA, missionInputs[0]);
      const bExtraSpaces = enumerateExtraArgSpaces(capB, missionInputs[0]);

      let bestScoreForPair: PairScore | null = null;

      for (const aExtras of aExtraSpaces) {
        for (const bExtras of bExtraSpaces) {
          // Compute a_i and b_i for every assertion
          const aOutputs: unknown[] = [];
          const bOutputs: unknown[] = [];
          let applicable = true;
          for (let i = 0; i < missionInputs.length; i++) {
            const a = callPrimitive(capA, missionInputs[i], aExtras);
            const b = callPrimitive(capB, missionInputs[i], bExtras);
            if (a === NOT_APPLICABLE || b === NOT_APPLICABLE) {
              applicable = false;
              break;
            }
            aOutputs.push(a);
            bOutputs.push(b);
          }

          if (!applicable) continue;

          // Skip degenerate same-cap-same-args (identical outputs)
          if (capA.algorithm_kind === capB.algorithm_kind
              && argsEqual(aExtras, bExtras)) continue;

          const induction = induceTemplate(expectedStrs, aOutputs, bOutputs);
          if (!induction) continue;

          // Verify template reproduces every expected exactly
          let matched = 0;
          for (let i = 0; i < expectedStrs.length; i++) {
            const rendered = renderTemplate(induction, aOutputs[i], bOutputs[i]);
            if (rendered === expectedStrs[i]) matched++;
          }
          const score = matched / expectedStrs.length;
          if (score < 0.999) continue;

          const cand: PairScore = {
            a_algorithm_kind: capA.algorithm_kind,
            b_algorithm_kind: capB.algorithm_kind,
            considered: true,
            applicable: true,
            template_found: true,
            matched_assertions: matched,
            total_assertions: expectedStrs.length,
            score,
            reason: `template '${induction.template}' reproduces all ${matched} expected outputs from A=${capA.algorithm_kind}(input, ${JSON.stringify(aExtras)}) and B=${capB.algorithm_kind}(input, ${JSON.stringify(bExtras)})`,
            template: induction.template,
            a_extracted_args: freezePrims(aExtras),
            b_extracted_args: freezePrims(bExtras),
          };
          if (!bestScoreForPair || cand.score > bestScoreForPair.score) {
            bestScoreForPair = cand;
          }
        }
      }

      if (bestScoreForPair) {
        scores.push(bestScoreForPair);
      } else {
        scores.push({
          a_algorithm_kind: capA.algorithm_kind,
          b_algorithm_kind: capB.algorithm_kind,
          considered: true,
          applicable: false,
          template_found: false,
          matched_assertions: 0,
          total_assertions: expectedStrs.length,
          score: 0,
          reason: `no (a_extras, b_extras) combination in bounded search space produced a template consistent across all ${expectedStrs.length} assertions`,
          template: null,
          a_extracted_args: Object.freeze([]),
          b_extracted_args: Object.freeze([]),
        });
      }
    }
  }

  // Pick best · ties broken by (distinct-cap first, shorter template, lex)
  const perfect = scores.filter((s) => s.score >= 0.999 && s.template !== null);
  if (perfect.length === 0) {
    return {
      target_function_name: input.target_function_name,
      target_file: input.target_file,
      matcher_inputs: {
        parsed_assertions: input.assertions.length,
        assertions_for_target_fn: relevant.length,
      },
      pairs_considered: Object.freeze(scores),
      selected_pair: null,
      selection_reason: `no pair produced a template consistent across all ${expectedStrs.length} assertions · composition boundary confirmed`,
      matcher_version: "F-C-02.v1",
    };
  }

  const sorted = [...perfect].sort((a, b) => {
    const aDistinct = a.a_algorithm_kind !== a.b_algorithm_kind ? 0 : 1;
    const bDistinct = b.a_algorithm_kind !== b.b_algorithm_kind ? 0 : 1;
    if (aDistinct !== bDistinct) return aDistinct - bDistinct;
    if ((a.template?.length ?? 0) !== (b.template?.length ?? 0)) return (a.template?.length ?? 0) - (b.template?.length ?? 0);
    return (a.a_algorithm_kind + "|" + a.b_algorithm_kind).localeCompare(b.a_algorithm_kind + "|" + b.b_algorithm_kind);
  });

  const winner = sorted[0];

  // Reconstruct placeholders from the winning induction
  const capA = CAPABILITY_REGISTRY.find((c) => c.algorithm_kind === winner.a_algorithm_kind)!;
  const capB = CAPABILITY_REGISTRY.find((c) => c.algorithm_kind === winner.b_algorithm_kind)!;
  const aOutputs = missionInputs.map((mi) => callPrimitive(capA, mi, winner.a_extracted_args));
  const bOutputs = missionInputs.map((mi) => callPrimitive(capB, mi, winner.b_extracted_args));
  const inductionAgain = induceTemplate(expectedStrs, aOutputs, bOutputs);

  const composition: PairComposition | null = inductionAgain ? {
    primitive_a: {
      algorithm_kind: winner.a_algorithm_kind,
      extracted_args: winner.a_extracted_args,
    },
    primitive_b: {
      algorithm_kind: winner.b_algorithm_kind,
      extracted_args: winner.b_extracted_args,
    },
    template: inductionAgain.template,
    placeholders: Object.freeze(inductionAgain.placeholders),
    return_type: "string",
  } : null;

  return {
    target_function_name: input.target_function_name,
    target_file: input.target_file,
    matcher_inputs: {
      parsed_assertions: input.assertions.length,
      assertions_for_target_fn: relevant.length,
    },
    pairs_considered: Object.freeze(scores),
    selected_pair: composition,
    selection_reason: composition
      ? `pair (${winner.a_algorithm_kind}, ${winner.b_algorithm_kind}) discovered from evidence · template '${composition.template}' reproduces all ${winner.total_assertions} expected outputs`
      : `winner selected but template reconstruction failed · treated as no selection`,
    matcher_version: "F-C-02.v1",
  };
}

function renderTemplate(ind: TemplateInduction, aOut: unknown, bOut: unknown): string {
  let out = ind.template;
  for (const ph of ind.placeholders) {
    const val = ph.source === "A" ? aOut : bOut;
    const scalar = ph.path === null ? stringify(val) : stringify((val as Record<string, unknown>)[ph.path]);
    out = out.replace(ph.rendered_placeholder, scalar);
  }
  return out;
}

function argsEqual(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function freezePrims(xs: readonly unknown[]): readonly (string | number | boolean)[] {
  const out: (string | number | boolean)[] = [];
  for (const x of xs) {
    if (typeof x === "string" || typeof x === "number" || typeof x === "boolean") out.push(x);
    else out.push(stringify(x));
  }
  return Object.freeze(out);
}
