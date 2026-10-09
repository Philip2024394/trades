// scripts/nex-canonical/migration-170.test.ts
//
// Structural tests for migration 170 (nex.business_evidence). Pure ·
// read-only inspection of the SQL file. No DB. No network.

import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const MIG_170_PATH = path.join(
  __dirname,
  "..",
  "..",
  "deploy",
  "postgres",
  "init",
  "170_nex_business_evidence.sql",
);
const MIG_166_PATH = path.join(
  __dirname,
  "..",
  "..",
  "deploy",
  "postgres",
  "init",
  "166_nex_source_registry.sql",
);
const MIG_167_PATH = path.join(
  __dirname,
  "..",
  "..",
  "deploy",
  "postgres",
  "init",
  "167_nex_business_canonical.sql",
);
const MIG_169_PATH = path.join(
  __dirname,
  "..",
  "..",
  "deploy",
  "postgres",
  "init",
  "169_nex_legacy_canonical_backfill.sql",
);

describe("migration 170 · existence + idempotence", () => {
  test("file exists", () => {
    expect(fs.existsSync(MIG_170_PATH)).toBe(true);
  });

  test("creates nex.business_evidence via CREATE TABLE IF NOT EXISTS (idempotent)", () => {
    const sql = fs.readFileSync(MIG_170_PATH, "utf8");
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS nex\.business_evidence/);
  });

  test("all indexes use IF NOT EXISTS (idempotent)", () => {
    const sql = fs.readFileSync(MIG_170_PATH, "utf8");
    const createIndexMatches = [...sql.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+([^;]*);/gi)];
    expect(createIndexMatches.length).toBeGreaterThan(0);
    for (const m of createIndexMatches) {
      expect(m[0]).toMatch(/IF NOT EXISTS/i);
    }
  });

  test("no destructive SQL · no DROP / TRUNCATE / DELETE / UPDATE / ALTER on existing tables", () => {
    const sql = fs.readFileSync(MIG_170_PATH, "utf8");
    // Strip SQL comments so we grep code only.
    const code = sql.replace(/--[^\n]*/g, "");
    expect(code).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(code).not.toMatch(/\bDROP\s+SCHEMA\b/i);
    expect(code).not.toMatch(/\bTRUNCATE\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(code).not.toMatch(/\bUPDATE\s+\w+\s+SET\b/i);
    // No ALTER on existing tables (business_canonical / source_registry).
    expect(code).not.toMatch(/\bALTER\s+TABLE\s+nex\.business_canonical\b/i);
    expect(code).not.toMatch(/\bALTER\s+TABLE\s+nex\.source_registry\b/i);
  });

  test("no DML / backfill · zero INSERT statements in migration 170", () => {
    const sql = fs.readFileSync(MIG_170_PATH, "utf8");
    const code = sql.replace(/--[^\n]*/g, "");
    expect(code).not.toMatch(/\bINSERT\s+INTO\b/i);
  });
});

describe("migration 170 · columns match HandoffEvidence", () => {
  const sql = fs.readFileSync(MIG_170_PATH, "utf8");

  test.each([
    "evidence_id",
    "canonical_business_id",
    "schema_version",
    "candidate_id",
    "candidate_integrity_hash",
    "decision_record_id",
    "review_package_id",
    "legacy_source_table",
    "legacy_source_ref",
    "legacy_source_internal_id",
    "resolver_verdict_kind",
    "resolver_target_id",
    "resolver_score",
    "observation_generator",
    "observation_run_id",
    "observation_generated_at",
    "observation_decision_timestamp",
    "observation_founder_id",
    "source_id",
    "created_at",
  ])("has column `%s`", (col) => {
    expect(sql).toContain(col);
  });

  test("canonical_business_id is NOT NULL · successful evidence must reference a canonical", () => {
    expect(sql).toMatch(/canonical_business_id\s+uuid\s+NOT NULL/);
  });

  test("schema_version is NOT NULL", () => {
    expect(sql).toMatch(/schema_version\s+text\s+NOT NULL/);
  });

  test("created_at is NOT NULL DEFAULT now()", () => {
    expect(sql).toMatch(/created_at\s+timestamptz\s+NOT NULL DEFAULT now\(\)/);
  });

  test("resolver_target_id is nullable · supports NO_MATCH case", () => {
    expect(sql).toMatch(/resolver_target_id\s+uuid\s+NULL/);
  });
});

describe("migration 170 · CHECK constraints", () => {
  const sql = fs.readFileSync(MIG_170_PATH, "utf8");

  test("ck_be_schema_version pins to 'evidence-v1'", () => {
    expect(sql).toContain("CONSTRAINT ck_be_schema_version");
    expect(sql).toContain("schema_version = 'evidence-v1'");
  });

  test("ck_be_resolver_verdict_kind limits to MATCH or NO_MATCH", () => {
    expect(sql).toContain("CONSTRAINT ck_be_resolver_verdict_kind");
    expect(sql).toContain("'MATCH'");
    expect(sql).toContain("'NO_MATCH'");
  });

  test("ck_be_resolver_score_range enforces [0,1]", () => {
    expect(sql).toContain("CONSTRAINT ck_be_resolver_score_range");
    expect(sql).toContain("resolver_score >= 0");
    expect(sql).toContain("resolver_score <= 1");
  });

  test.each([
    "ck_be_candidate_hash_fmt",
    "ck_be_decision_record_fmt",
    "ck_be_review_pkg_fmt",
  ])("%s enforces 64-char lowercase hex", (checkName) => {
    expect(sql).toContain(`CONSTRAINT ${checkName}`);
    // Each hex check uses the same regex pattern.
    expect(sql).toContain("[a-f0-9]{64}");
  });

  test("ck_be_verdict_target_consistency ties resolver_target_id to canonical_business_id on MATCH", () => {
    expect(sql).toContain("CONSTRAINT ck_be_verdict_target_consistency");
    expect(sql).toContain("resolver_target_id IS NULL");
    expect(sql).toContain("resolver_target_id = canonical_business_id");
  });
});

describe("migration 170 · foreign keys", () => {
  const sql = fs.readFileSync(MIG_170_PATH, "utf8");

  test("fk_be_canonical_business → nex.business_canonical", () => {
    expect(sql).toContain("CONSTRAINT fk_be_canonical_business");
    expect(sql).toMatch(
      /REFERENCES\s+nex\.business_canonical\s*\(\s*canonical_business_id\s*\)/,
    );
  });

  test("fk_be_source → nex.source_registry", () => {
    expect(sql).toContain("CONSTRAINT fk_be_source");
    expect(sql).toMatch(
      /REFERENCES\s+nex\.source_registry\s*\(\s*source_id\s*\)/,
    );
  });

  test("both FKs use ON DELETE RESTRICT · evidence is historical lineage", () => {
    // Count ON DELETE RESTRICT occurrences in CODE (strip -- comments
    // first · explanatory prose may mention it in headers too).
    const code = sql.replace(/--[^\n]*/g, "");
    const matches = code.match(/ON DELETE RESTRICT/g) ?? [];
    expect(matches.length).toBe(2);
  });
});

describe("migration 170 · indexes", () => {
  const sql = fs.readFileSync(MIG_170_PATH, "utf8");

  test.each([
    "idx_be_canonical_business",
    "idx_be_decision_record",
    "idx_be_candidate_id",
    "idx_be_source_id",
  ])("creates index `%s`", (idx) => {
    expect(sql).toContain(idx);
  });
});

describe("migration 170 · scope boundaries", () => {
  test("migration 166 is byte-identical to its pre-170 size (9864 bytes)", () => {
    const bytes = fs.statSync(MIG_166_PATH).size;
    expect(bytes).toBe(9864);
  });

  test("migration 167 is byte-identical to its pre-170 size (19017 bytes)", () => {
    const bytes = fs.statSync(MIG_167_PATH).size;
    expect(bytes).toBe(19017);
  });

  test("migration 169 exists · authored in Phase-1 build wave (2026-10-09)", () => {
    // Previously deferred by founder decision; authored in the Phase-1
    // spine build wave authorised 2026-10-09. See migration-169.test.ts
    // for the structural assertions on 169 itself. This test only
    // records the scope-boundary that 170 (business_evidence) does not
    // itself drag in the 169 legacy-FK columns.
    expect(fs.existsSync(MIG_169_PATH)).toBe(true);
  });
});
