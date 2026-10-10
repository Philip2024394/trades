// scripts/nex-canonical/rule-5m-proof-1-seed-cohort-provenance.test.ts
//
// Rule 5m · Proof 1 · Seed cohort provenance.
//
// SEALED CLAIM:
//   The seed cohort file exists, contains ≥50 records, every record carries
//   `provenance.approved_by === "founder"` with a non-null `approved_at`, and
//   the cohort covers each of R1-R10 with ≥3 seeds whose `risk_categories`
//   array contains it.
//
// EVIDENCE BINDING:
//   See `docs/doctrine/nex-rule-5m-proof-manifest-2026-10-09.md` · Proof 1.
//
// HONESTY · WHY THIS PROOF CAN FAIL EVEN WITH A WELL-SAMPLED FIXTURE
//   The fixture at `tests/fixtures/canonical/seed-cohort-v1.jsonl` is sampled
//   READ-ONLY from `nex.food_business` by `_rule-5m-fixture-builder.mjs`.
//   The agent that sampled the rows does NOT have founder authority, so
//   `provenance.approved_by` is set to `"rule-5m-fixture-sampling"` · not
//   `"founder"`. Promoting the cohort to founder-approved requires explicit
//   founder review action outside this agent's scope. Until that review
//   happens, this proof correctly reports FAIL on the approver assertion.
//   This is the right behaviour · the manifest explicitly forbids forcing
//   `all_seven_pass: true` without producing the evidence it requires.
//
//   The resolver-defect / fixture-defect distinction:
//   · If this test fails because of the approver, the fixture is honestly
//     labelled and the proof is honestly MISSING-EVIDENCE.
//   · If this test fails because of count / R1-R10 coverage / schema, the
//     fixture itself has a problem and should be rebuilt.

import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SEED_COHORT_PATH = path.join(
  REPO_ROOT,
  "tests",
  "fixtures",
  "canonical",
  "seed-cohort-v1.jsonl",
);

// ═════════════════════════════════════════════════════════════════════
// §0 · Load the cohort file (fail-closed if missing)
// ═════════════════════════════════════════════════════════════════════

interface SeedRecord {
  readonly seed_id: string;
  readonly entity_type: string;
  readonly country: string;
  readonly identity: {
    readonly name_canonical: string;
    readonly name_norm?: string;
    readonly phone_e164: string | null;
    readonly wikidata_qid: string | null;
    readonly osm_id: string | null;
    readonly city: string | null;
    readonly coordinates: { readonly lat: number; readonly lng: number } | null;
  };
  readonly provenance: {
    readonly approved_by: string;
    readonly approved_at: string;
    readonly created_by: string;
    readonly created_at: string;
    readonly legacy_source_table: string;
    readonly legacy_source_ref: string;
    readonly risk_categories: readonly string[];
    readonly high_confidence_rationale: string;
  };
}

function loadSeeds(): SeedRecord[] {
  if (!fs.existsSync(SEED_COHORT_PATH)) {
    throw new Error(`seed cohort file missing: ${SEED_COHORT_PATH}`);
  }
  const text = fs.readFileSync(SEED_COHORT_PATH, "utf8");
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("//"))
    .map((l) => JSON.parse(l) as SeedRecord);
}

const SEEDS: readonly SeedRecord[] = loadSeeds();

// ═════════════════════════════════════════════════════════════════════
// §1 · Fixture file presence + minimum size
// ═════════════════════════════════════════════════════════════════════

describe("Rule 5m · Proof 1 · seed cohort file exists and has ≥50 records", () => {
  test("file exists at sealed path", () => {
    expect(fs.existsSync(SEED_COHORT_PATH)).toBe(true);
  });

  test("record count is in [50, 100]", () => {
    expect(SEEDS.length).toBeGreaterThanOrEqual(50);
    expect(SEEDS.length).toBeLessThanOrEqual(100);
  });

  test("every record has a non-empty seed_id and entity_type and country", () => {
    for (const s of SEEDS) {
      expect(typeof s.seed_id).toBe("string");
      expect(s.seed_id.length).toBeGreaterThan(0);
      expect(typeof s.entity_type).toBe("string");
      expect(s.entity_type.length).toBeGreaterThan(0);
      expect(typeof s.country).toBe("string");
      expect(s.country).toMatch(/^[A-Z]{2}$/);
    }
  });

  test("seed_id is globally unique inside the file", () => {
    const ids = new Set<string>();
    for (const s of SEEDS) {
      expect(ids.has(s.seed_id)).toBe(false);
      ids.add(s.seed_id);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · Approver provenance · the founder-approval gate
// ═════════════════════════════════════════════════════════════════════

describe("Rule 5m · Proof 1 · founder approval is sealed on every seed", () => {
  test("every record has provenance.approved_by === 'founder'", () => {
    // HONEST: if the fixture was authored by an agent (not the founder),
    // this assertion WILL fail. That failure is the proof's working
    // output · the evidence manifest requires founder-level approval.
    const nonFounder = SEEDS.filter((s) => s.provenance.approved_by !== "founder");
    expect(nonFounder.length).toBe(0);
  });

  test("every record has non-null approved_at ISO-8601 timestamp", () => {
    for (const s of SEEDS) {
      expect(typeof s.provenance.approved_at).toBe("string");
      expect(s.provenance.approved_at.length).toBeGreaterThan(0);
      // Loose ISO shape check.
      expect(s.provenance.approved_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · Risk-category coverage · R1–R10 each have ≥3 seeds
// ═════════════════════════════════════════════════════════════════════

describe("Rule 5m · Proof 1 · R1-R10 coverage is adequate", () => {
  const R_CATEGORIES = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10"];

  test.each(R_CATEGORIES)("category %s has ≥3 seeds", (r) => {
    const count = SEEDS.filter((s) => s.provenance.risk_categories.includes(r)).length;
    expect(count).toBeGreaterThanOrEqual(3);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · Legacy-source provenance is honest
// ═════════════════════════════════════════════════════════════════════

describe("Rule 5m · Proof 1 · legacy-source provenance is non-empty", () => {
  test("every seed carries legacy_source_table + legacy_source_ref OR is explicitly synthetic", () => {
    for (const s of SEEDS) {
      expect(typeof s.provenance.legacy_source_table).toBe("string");
      expect(typeof s.provenance.legacy_source_ref).toBe("string");
      expect(s.provenance.legacy_source_table.length).toBeGreaterThan(0);
      expect(s.provenance.legacy_source_ref.length).toBeGreaterThan(0);
    }
  });
});
