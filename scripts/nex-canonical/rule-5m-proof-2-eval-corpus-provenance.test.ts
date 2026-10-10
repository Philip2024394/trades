// scripts/nex-canonical/rule-5m-proof-2-eval-corpus-provenance.test.ts
//
// Rule 5m · Proof 2 · Eval corpus provenance.
//
// SEALED CLAIM:
//   The three eval corpus files exist. Every pair has
//   `label_decision.labelled_by ∈ {"founder", "admin:*"}`. No label revision
//   is in-place mutated · every chain terminates (no superseded_by cycle).
//
// EVIDENCE BINDING:
//   See `docs/doctrine/nex-rule-5m-proof-manifest-2026-10-09.md` · Proof 2.
//
// HONESTY · WHY THIS PROOF CAN FAIL EVEN WITH WELL-SAMPLED FIXTURES
//   Pairs were synthesised against sampled real rows by
//   `_rule-5m-fixture-builder.mjs`. The labeller string on every pair is
//   `"rule-5m-fixture-sampling"` — the agent, not the founder. Promoting
//   each pair's `labelled_by` to `"founder"` or `"admin:<handle>"`
//   requires explicit founder/admin review. Until that happens, this
//   proof correctly reports FAIL on the labeller assertion.
//
//   The three per-vertical corpus files declared by the agent-6 task are:
//     tests/fixtures/canonical/eval-corpus-1.jsonl   (accommodation)
//     tests/fixtures/canonical/eval-corpus-2.jsonl   (service)
//     tests/fixtures/canonical/eval-corpus-3.jsonl   (mp_seller)
//
//   The sealed doctrine's label-class split (`positive`/`negative`/
//   `ambiguous`) is enforced on the derived files at
//   tests/fixtures/eval/{positive,negative,ambiguous}-pairs-v1.jsonl —
//   this proof asserts BOTH shapes because both exist and both must be
//   honest. The per-vertical file set is scoped by agent-6; the
//   per-label file set is what the measurement runner consumes.

import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..", "..");

const EVAL_CORPUS_PATHS = {
  // Per-vertical fixtures authored by agent-6.
  accommodation: path.join(REPO_ROOT, "tests", "fixtures", "canonical", "eval-corpus-1.jsonl"),
  service: path.join(REPO_ROOT, "tests", "fixtures", "canonical", "eval-corpus-2.jsonl"),
  mp_seller: path.join(REPO_ROOT, "tests", "fixtures", "canonical", "eval-corpus-3.jsonl"),
  // Per-label fixtures that the sealed measurement runner consumes.
  positive: path.join(REPO_ROOT, "tests", "fixtures", "eval", "positive-pairs-v1.jsonl"),
  negative: path.join(REPO_ROOT, "tests", "fixtures", "eval", "negative-pairs-v1.jsonl"),
  ambiguous: path.join(REPO_ROOT, "tests", "fixtures", "eval", "ambiguous-pairs-v1.jsonl"),
} as const;

// ═════════════════════════════════════════════════════════════════════
// §0 · Minimal pair shape · defensive to allow MISSING_EXPECTED_OUTPUT
// ═════════════════════════════════════════════════════════════════════

interface EvalPair {
  readonly pair_id: string;
  readonly seed_id: string | null;
  readonly candidate_payload: unknown;
  readonly expected_target_canonical_business_id: string | null;
  readonly label_decision: {
    readonly expected_verdict:
      | "MATCH"
      | "NO_MATCH"
      | "AMBIGUOUS"
      | "MISSING_EXPECTED_OUTPUT";
    readonly labelled_by: string;
    readonly labelled_at: string;
    readonly label_version: number;
    readonly superseded_by_pair_id?: string;
  };
  readonly candidate_source: {
    readonly generator: string;
    readonly generation_run_id: string;
  };
}

function readPairs(abs: string): EvalPair[] {
  if (!fs.existsSync(abs)) throw new Error(`eval corpus file missing: ${abs}`);
  const text = fs.readFileSync(abs, "utf8");
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("//"))
    .map((l) => JSON.parse(l) as EvalPair);
}

// Eager load (per-vertical + per-label) only when present. Fail-closed if any missing.
const ALL_PAIRS: Record<string, EvalPair[]> = Object.fromEntries(
  Object.entries(EVAL_CORPUS_PATHS).map(([k, p]) => [k, readPairs(p)]),
);

// ═════════════════════════════════════════════════════════════════════
// §1 · File presence
// ═════════════════════════════════════════════════════════════════════

describe("Rule 5m · Proof 2 · all 6 eval corpus files exist", () => {
  test.each(Object.entries(EVAL_CORPUS_PATHS))("fixture %s present", (_name, abs) => {
    expect(fs.existsSync(abs)).toBe(true);
  });

  test("per-vertical corpora have the agent-6 target size of 50 rows each", () => {
    expect(ALL_PAIRS.accommodation.length).toBe(50);
    expect(ALL_PAIRS.service.length).toBe(50);
    expect(ALL_PAIRS.mp_seller.length).toBe(50);
  });

  test("per-label corpora have at least one pair each (soft size · honest start)", () => {
    expect(ALL_PAIRS.positive.length).toBeGreaterThan(0);
    expect(ALL_PAIRS.negative.length).toBeGreaterThan(0);
    expect(ALL_PAIRS.ambiguous.length).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · Pair id uniqueness per file
// ═════════════════════════════════════════════════════════════════════

describe("Rule 5m · Proof 2 · pair_id uniqueness per file", () => {
  test.each(Object.entries(ALL_PAIRS))("pair_id unique in %s", (_name, pairs) => {
    const seen = new Set<string>();
    for (const p of pairs) {
      expect(seen.has(p.pair_id)).toBe(false);
      seen.add(p.pair_id);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · Labeller provenance · founder OR admin · never a generator name
// ═════════════════════════════════════════════════════════════════════

describe("Rule 5m · Proof 2 · labelled_by matches founder/admin pattern", () => {
  const LABELLER_PATTERN = /^(founder|admin:[A-Za-z0-9_\-]+)$/;

  test("every pair across every file carries a founder/admin label", () => {
    // HONEST: when fixtures are agent-authored, this will fail · surfacing
    // the real evidence gap. The sealed doctrine forbids
    // `wikidata_qid_overlap` or any generator name in `labelled_by`.
    const violators: Array<{ file: string; pair_id: string; labelled_by: string }> = [];
    for (const [file, pairs] of Object.entries(ALL_PAIRS)) {
      for (const p of pairs) {
        if (!LABELLER_PATTERN.test(p.label_decision.labelled_by)) {
          violators.push({
            file,
            pair_id: p.pair_id,
            labelled_by: p.label_decision.labelled_by,
          });
        }
      }
    }
    // Surface the first 3 for readability on failure.
    expect(violators.slice(0, 3)).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · Supersession is append-only · no cycles
// ═════════════════════════════════════════════════════════════════════

describe("Rule 5m · Proof 2 · supersession chains terminate (no cycles)", () => {
  test("every superseded_by_pair_id resolves without a cycle", () => {
    for (const [file, pairs] of Object.entries(ALL_PAIRS)) {
      const byId = new Map(pairs.map((p) => [p.pair_id, p]));
      for (const start of pairs) {
        const seen = new Set<string>();
        let cur: EvalPair | undefined = start;
        while (cur && cur.label_decision.superseded_by_pair_id) {
          if (seen.has(cur.pair_id)) {
            throw new Error(`cycle detected in ${file} starting at ${start.pair_id}`);
          }
          seen.add(cur.pair_id);
          cur = byId.get(cur.label_decision.superseded_by_pair_id);
        }
      }
    }
    // If no throw, all chains terminate.
    expect(true).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · Expected-verdict discipline · MISSING_EXPECTED_OUTPUT is honest
// ═════════════════════════════════════════════════════════════════════

describe("Rule 5m · Proof 2 · expected_verdict is one of the sealed values", () => {
  const SEALED_VERDICTS = new Set([
    "MATCH",
    "NO_MATCH",
    "AMBIGUOUS",
    "MISSING_EXPECTED_OUTPUT",
  ]);

  test.each(Object.entries(ALL_PAIRS))("every pair in %s has a sealed verdict", (_name, pairs) => {
    for (const p of pairs) {
      expect(SEALED_VERDICTS.has(p.label_decision.expected_verdict)).toBe(true);
    }
  });

  test("positive-pairs file has NO MISSING_EXPECTED_OUTPUT entries · they must be MATCH", () => {
    const nonMatch = ALL_PAIRS.positive.filter(
      (p) => p.label_decision.expected_verdict !== "MATCH",
    );
    expect(nonMatch).toEqual([]);
  });

  test("negative-pairs file has NO MISSING_EXPECTED_OUTPUT · they must be NO_MATCH", () => {
    const nonNoMatch = ALL_PAIRS.negative.filter(
      (p) => p.label_decision.expected_verdict !== "NO_MATCH",
    );
    expect(nonNoMatch).toEqual([]);
  });
});
