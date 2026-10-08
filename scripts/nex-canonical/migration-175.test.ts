// scripts/nex-canonical/migration-175.test.ts
//
// Structural tests for migration 175 (nex.business_directory_v).
// Pure · read-only inspection of the SQL file. No DB. No network.

import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const MIG_175_PATH = path.join(
  __dirname,
  "..",
  "..",
  "deploy",
  "postgres",
  "init",
  "175_nex_business_directory_v.sql",
);

/** The migration body with SQL `--` comments stripped. Mirrors the
 *  discipline in migration-170.test.ts and migration-179.test.ts. */
function readCode(): string {
  const sql = fs.readFileSync(MIG_175_PATH, "utf8");
  return sql.replace(/--[^\n]*/g, "");
}

// ═════════════════════════════════════════════════════════════════════
// §1 · File exists · target + idempotency
// ═════════════════════════════════════════════════════════════════════

describe("migration 175 · existence + idempotency", () => {
  test("file exists", () => {
    expect(fs.existsSync(MIG_175_PATH)).toBe(true);
  });

  test("targets nex.business_directory_v (the sealed publication view)", () => {
    const code = readCode();
    expect(code).toMatch(/\bCREATE\s+OR\s+REPLACE\s+VIEW\s+nex\.business_directory_v\b/i);
  });

  test("uses CREATE OR REPLACE VIEW (idempotent · re-runnable)", () => {
    const code = readCode();
    expect(code).toMatch(/\bCREATE\s+OR\s+REPLACE\s+VIEW\b/i);
    // Not a plain CREATE VIEW (would fail on re-run).
    const plainCreateView = /\bCREATE\s+VIEW\s+(?!OR\s+REPLACE)/i;
    expect(code).not.toMatch(plainCreateView);
  });

  test("declares exactly ONE view · no other DDL", () => {
    const code = readCode();
    const views = [...code.matchAll(/\bCREATE\s+(?:OR\s+REPLACE\s+)?VIEW\b/gi)];
    expect(views).toHaveLength(1);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · Publishable lifecycle set · founder decision D-1 (L1)
// ═════════════════════════════════════════════════════════════════════

describe("migration 175 · D-1 publishable lifecycle set (L1)", () => {
  test("filters lifecycle_state to the sealed L1 set", () => {
    const code = readCode();
    // All three publishable states must be literally present in the view SQL.
    expect(code).toMatch(/'VERIFIED'/);
    expect(code).toMatch(/'OWNER_CLAIMED'/);
    expect(code).toMatch(/'OWNER_VERIFIED'/);
    // And a single IN (...) clause binds them together.
    expect(code).toMatch(
      /lifecycle_state\s+IN\s*\(\s*'VERIFIED'\s*,\s*'OWNER_CLAIMED'\s*,\s*'OWNER_VERIFIED'\s*\)/i,
    );
  });

  test("does NOT admit DISCOVERED / ENRICHED / DORMANT / SUPERSEDED into the IN(...) clause", () => {
    const code = readCode();
    // Isolate the IN(...) list on the lifecycle filter.
    const inMatch = code.match(
      /lifecycle_state\s+IN\s*\(([^)]*)\)/i,
    );
    expect(inMatch).not.toBeNull();
    const insideParens = (inMatch?.[1] ?? "").toUpperCase();
    for (const forbidden of [
      "'DISCOVERED'",
      "'ENRICHED'",
      "'DORMANT'",
      "'SUPERSEDED'",
    ]) {
      expect(insideParens.includes(forbidden)).toBe(false);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · Supersession guard
// ═════════════════════════════════════════════════════════════════════

describe("migration 175 · supersession guard", () => {
  test("WHERE enforces superseded_by_business_id IS NULL", () => {
    const code = readCode();
    expect(code).toMatch(
      /superseded_by_business_id\s+IS\s+NULL/i,
    );
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · Source-permission predicate · founder decision D-2 (OR)
// ═════════════════════════════════════════════════════════════════════

describe("migration 175 · D-2 source permission (OR aggregation)", () => {
  test("WHERE contains an EXISTS subquery over business_evidence + source_registry", () => {
    const code = readCode();
    expect(code).toMatch(/\bEXISTS\s*\(/i);
    expect(code).toMatch(/\bnex\.business_evidence\b/i);
    expect(code).toMatch(/\bnex\.source_registry\b/i);
  });

  test("subquery joins evidence to source_registry on source_id", () => {
    const code = readCode();
    // Flexible match: evidence be / source_registry sr aliases joined on sr.source_id = be.source_id.
    expect(code).toMatch(
      /source_registry\s+sr[\s\S]{1,120}sr\.source_id\s*=\s*be\.source_id/i,
    );
  });

  test("subquery requires sr.can_display = TRUE", () => {
    const code = readCode();
    expect(code).toMatch(/sr\.can_display\s*=\s*TRUE/i);
  });

  test("subquery correlates to the outer canonical row (be.canonical_business_id = bc.canonical_business_id)", () => {
    const code = readCode();
    expect(code).toMatch(
      /be\.canonical_business_id\s*=\s*bc\.canonical_business_id/i,
    );
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · No destructive SQL · no DDL on existing tables · no GRANT/REVOKE
// ═════════════════════════════════════════════════════════════════════

describe("migration 175 · safety posture", () => {
  test("no DROP TABLE / DROP SCHEMA / TRUNCATE / DELETE / UPDATE / INSERT on existing tables", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(code).not.toMatch(/\bDROP\s+SCHEMA\b/i);
    expect(code).not.toMatch(/\bDROP\s+VIEW\b/i);
    expect(code).not.toMatch(/\bTRUNCATE\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\b/i);
    // An UPDATE on an existing table (there is no such statement here).
    expect(code).not.toMatch(/\bUPDATE\s+nex\.\w+\s+SET\b/i);
    // An INSERT into any table (there is no such statement here).
    expect(code).not.toMatch(/\bINSERT\s+INTO\s+nex\./i);
  });

  test("no ALTER on any existing table or schema", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(code).not.toMatch(/\bALTER\s+SCHEMA\b/i);
    expect(code).not.toMatch(/\bALTER\s+VIEW\b/i);
  });

  test("no GRANT or REVOKE statements (DP-3 lockdown is a separate wave)", () => {
    const code = readCode();
    // Statement-level grep · ignores incidental mentions of the words
    // inside string literals (e.g. COMMENT ON view text). A real GRANT
    // / REVOKE statement must specify a privilege and an object.
    expect(code).not.toMatch(/\bGRANT\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE|USAGE|EXECUTE|TRUNCATE|REFERENCES|TRIGGER)\b/i);
    expect(code).not.toMatch(/\bREVOKE\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE|USAGE|EXECUTE|TRUNCATE|REFERENCES|TRIGGER)\b/i);
  });

  test("no CREATE TABLE / INDEX / FUNCTION / MATERIALIZED VIEW · pure VIEW only", () => {
    const code = readCode();
    expect(code).not.toMatch(/\bCREATE\s+TABLE\b/i);
    expect(code).not.toMatch(/\bCREATE\s+INDEX\b/i);
    expect(code).not.toMatch(/\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/i);
    expect(code).not.toMatch(/\bCREATE\s+(?:OR\s+REPLACE\s+)?MATERIALIZED\s+VIEW\b/i);
    expect(code).not.toMatch(/\bCREATE\s+SCHEMA\b/i);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §6 · No synthetic / fixture-id / name-based filtering
// ═════════════════════════════════════════════════════════════════════

describe("migration 175 · no synthetic recognition", () => {
  test("does NOT reference the synthetic row's name_canonical", () => {
    const code = readCode();
    expect(code).not.toMatch(/SYNTHETIC\s+NEX\s+FIRST/i);
    expect(code).not.toMatch(/Synthetic\s+First-Write\s+Proof/i);
  });

  test("does NOT reference any specific candidate_id fixture", () => {
    const code = readCode();
    expect(code).not.toMatch(/cand-nex-first-live-write/i);
    expect(code).not.toMatch(/cand-nex-food-/i);
  });

  test("does NOT reference any specific canonical_business_id UUID", () => {
    const code = readCode();
    // 36-char UUID shape anywhere in the SQL body.
    expect(code).not.toMatch(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i,
    );
  });

  test("does NOT reference legacy ad-hoc source_id 'nex.food_business' (the sealed first-write anchor)", () => {
    const code = readCode();
    // The gate must disappear this row by policy (can_display=FALSE on
    // the ad-hoc source), not by naming it.
    expect(code).not.toMatch(/'nex\.food_business'/);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §7 · Column contract · byte-stable with directory-service SELECT
// ═════════════════════════════════════════════════════════════════════

describe("migration 175 · column contract (compatible with directory-service SELECT_COLUMNS)", () => {
  test("exposes every column the sealed Directory service reads", () => {
    const code = readCode();
    const requiredColumns = [
      "canonical_business_id",
      "entity_type",
      "country",
      "lifecycle_state",
      "name_canonical",
      "name_norm",
      "aliases",
      "phone_e164",
      "website_apex",
      "osm_id",
      "wikidata_qid",
      "city",
      "district",
      "street_line",
      "neighbourhood",
      "address",
      "coordinates",
      "category_ids",
      "services_products",
      "supersedes_business_id",
      "superseded_by_business_id",
      "last_verified_at",
    ];
    for (const col of requiredColumns) {
      expect(code).toMatch(new RegExp(`\\bbc\\.${col}\\b`));
    }
  });

  test("enumerates columns explicitly (does NOT use `SELECT bc.*`)", () => {
    const code = readCode();
    // `bc.*` would silently expose future canonical columns to visitors.
    expect(code).not.toMatch(/\bSELECT\s+bc\.\*/i);
    expect(code).not.toMatch(/\bSELECT\s+\*\s+FROM\s+nex\.business_canonical\b/i);
  });
});
