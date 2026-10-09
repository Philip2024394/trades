// scripts/nex-canonical/rule-5m-proof-7-reproducibility.test.ts
//
// Rule 5m · Proof 7 · Reproducibility of measurement.
//
// SEALED CLAIM:
//   The measurement artefact records SHA-256 hashes of every corpus file
//   AND the resolver module. Re-running the measurement on byte-identical
//   inputs produces a byte-identical artefact (modulo the `measured_at`
//   stamp, which is injected explicitly for determinism).
//
// EVIDENCE BINDING:
//   See docs/doctrine/nex-rule-5m-proof-manifest-2026-10-09.md · Proof 7.
//
// SCOPE:
//   Verifies the SHAPE and the DETERMINISM INVARIANT. The actual
//   corpus/seed fixtures don't exist yet (founder-level work); this test
//   verifies the runner's determinism and its refusal to proceed when
//   prerequisites are missing.

import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  measure,
  MEASUREMENT_SCHEMA_VERSION,
  type MeasurementInputs,
} from "./eval-measurement-runner";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RESOLVER_PATH = path.join(REPO_ROOT, "scripts", "nex-canonical", "canonical-resolver.ts");

// ═════════════════════════════════════════════════════════════════════
// §1 · Fail-closed prerequisite check
// ═════════════════════════════════════════════════════════════════════

describe("Rule 5m · Proof 7 · prerequisite refusal (fail-closed)", () => {
  test("measure() throws when seed cohort file is missing", () => {
    const inputs: MeasurementInputs = {
      seedCohortPath: "/does/not/exist/seed.jsonl",
      positivePairsPath: RESOLVER_PATH,
      negativePairsPath: RESOLVER_PATH,
      ambiguousPairsPath: RESOLVER_PATH,
      resolverModulePath: RESOLVER_PATH,
      nowIso: "2026-10-09T00:00:00.000Z",
    };
    expect(() => measure(inputs)).toThrow(/prerequisite missing/);
  });

  test("measure() throws when resolver module file is missing", () => {
    const inputs: MeasurementInputs = {
      seedCohortPath: RESOLVER_PATH,
      positivePairsPath: RESOLVER_PATH,
      negativePairsPath: RESOLVER_PATH,
      ambiguousPairsPath: RESOLVER_PATH,
      resolverModulePath: "/does/not/exist/resolver.ts",
      nowIso: "2026-10-09T00:00:00.000Z",
    };
    expect(() => measure(inputs)).toThrow(/prerequisite missing/);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · Determinism · same inputs → byte-equal artefact
// ═════════════════════════════════════════════════════════════════════

/** Build minimal valid fixtures for a deterministic double-measurement test. */
function writeMinimalFixtures(dir: string): MeasurementInputs {
  const seedCohortPath = path.join(dir, "seed-cohort.jsonl");
  const positivePath = path.join(dir, "positive.jsonl");
  const negativePath = path.join(dir, "negative.jsonl");
  const ambiguousPath = path.join(dir, "ambiguous.jsonl");

  const seed = {
    seed_id: "11111111-1111-1111-1111-111111111111",
    entity_type: "food",
    country: "ID",
    identity: {
      name_canonical: "Fixture Warung",
      name_norm: "fixture warung",
      aliases: [],
      phone_e164: null,
      website_apex: null,
      osm_id: null,
      wikidata_qid: null,
      city: "Yogyakarta",
      coordinates: null,
    },
    provenance: {
      approved_by: "founder",
      approved_at: "2026-10-09T00:00:00.000Z",
      created_by: "founder",
      created_at: "2026-10-09T00:00:00.000Z",
      legacy_source_table: "nex.food_business",
      legacy_source_ref: "fixture-ref",
      risk_categories: ["R1"],
      high_confidence_rationale: "deterministic fixture",
    },
  };

  const candidate = {
    candidate_id: "cand-1",
    status: "pending_founder_review" as const,
    entity_type: "food" as const,
    country: "ID",
    identity: {
      name_canonical: "Fixture Warung",
      aliases: [],
      phone_e164: null,
      website_apex: null,
      osm_id: null,
      wikidata_qid: null,
      city: "Yogyakarta",
      district: null,
      coordinates: null,
    },
    legacy_source: {
      table: "nex.food_business",
      ref: "fixture-ref",
      internal_id: null,
    },
    risk_categories: ["R1"],
    selection_score: 0.5,
    selection_rationale: [
      { risk_category: "R1", contribution: 0.5, note: "n" },
    ],
    generation_source: {
      generator: "scripts/nex-canonical/generate-candidates.ts",
      generated_at: "2026-10-09T00:00:00.000Z",
      generation_run_id: "fixture-run",
    },
    caveats: [],
  };

  const positive = {
    pair_id: "pos-1",
    seed_id: seed.seed_id,
    candidate_payload: candidate,
    expected_target_canonical_business_id: seed.seed_id,
    label_decision: {
      expected_verdict: "MATCH" as const,
      labelled_by: "founder",
      labelled_at: "2026-10-09T00:00:00.000Z",
      label_version: 1,
    },
    candidate_source: {
      generator: "scripts/nex-canonical/generate-candidates.ts",
      generation_run_id: "fixture-run",
    },
  };

  fs.writeFileSync(seedCohortPath, JSON.stringify(seed) + "\n");
  fs.writeFileSync(positivePath, JSON.stringify(positive) + "\n");
  fs.writeFileSync(negativePath, "");    // empty · no negatives
  fs.writeFileSync(ambiguousPath, "");   // empty · no ambiguous

  return {
    seedCohortPath,
    positivePairsPath: positivePath,
    negativePairsPath: negativePath,
    ambiguousPairsPath: ambiguousPath,
    resolverModulePath: RESOLVER_PATH,
    nowIso: "2026-10-09T00:00:00.000Z",
  };
}

describe("Rule 5m · Proof 7 · reproducibility", () => {
  test("double-run on same fixtures + same nowIso produces byte-identical artefact", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rule5m-proof7-"));
    try {
      const inputs = writeMinimalFixtures(tmpDir);
      const a = measure(inputs);
      const b = measure(inputs);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("corpus hash changes when a corpus file byte changes", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rule5m-proof7-"));
    try {
      const inputs = writeMinimalFixtures(tmpDir);
      const a = measure(inputs);

      // Modify one byte in the positive corpus.
      fs.appendFileSync(inputs.positivePairsPath, "\n");
      const b = measure(inputs);

      expect(b.corpus_commit_hashes.positive).not.toBe(a.corpus_commit_hashes.positive);
      // Other hashes are unchanged.
      expect(b.corpus_commit_hashes.seed_cohort).toBe(a.corpus_commit_hashes.seed_cohort);
      expect(b.corpus_commit_hashes.negative).toBe(a.corpus_commit_hashes.negative);
      expect(b.corpus_commit_hashes.ambiguous).toBe(a.corpus_commit_hashes.ambiguous);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("resolver module hash is non-blank and reproducible", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rule5m-proof7-"));
    try {
      const inputs = writeMinimalFixtures(tmpDir);
      const a = measure(inputs);
      const b = measure(inputs);
      expect(a.resolver_module_hash.length).toBe(64);
      expect(a.resolver_module_hash).toBe(b.resolver_module_hash);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · Artefact schema invariants
// ═════════════════════════════════════════════════════════════════════

describe("Rule 5m · Proof 7 · artefact schema", () => {
  test("artefact pins schema_version to 'measurement-v1'", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rule5m-proof7-"));
    try {
      const inputs = writeMinimalFixtures(tmpDir);
      const a = measure(inputs);
      expect(a.schema_version).toBe(MEASUREMENT_SCHEMA_VERSION);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("rule_5j_gates reflects HARD + SOFT boolean outcomes", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rule5m-proof7-"));
    try {
      const inputs = writeMinimalFixtures(tmpDir);
      const a = measure(inputs);
      expect(typeof a.rule_5j_gates.false_merge_le_1pct).toBe("boolean");
      expect(typeof a.rule_5j_gates.precision_ge_98pct).toBe("boolean");
      expect(typeof a.rule_5j_gates.recall_ge_70pct).toBe("boolean");
      expect(typeof a.rule_5j_gates.abstention_ge_80pct).toBe("boolean");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("all_hard_gates_pass is the conjunction of the two HARD gates", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rule5m-proof7-"));
    try {
      const inputs = writeMinimalFixtures(tmpDir);
      const a = measure(inputs);
      expect(a.all_hard_gates_pass).toBe(
        a.rule_5j_gates.false_merge_le_1pct && a.rule_5j_gates.precision_ge_98pct,
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
