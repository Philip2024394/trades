// scripts/nex-canonical/pg-fingerprint.test.ts
//
// Pure/unit tests for the target-fingerprint verification mechanism.
// No DB. No network. No pg Client instantiated.
//
// Scope boundary (fingerprint-design authorization 2026-10-08):
//   · Prove statically-provable fingerprint properties only · env
//     parsing, comparison, denylist of hardcoded queries, error-class
//     distinction, source-grep invariants.
//   · PostgreSQL-specific runtime behaviour (does the server actually
//     return the expected fingerprint under this user) is NOT tested
//     here · that requires live β execution against a real target.

import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  assertNoForbiddenKeyword,
  PgExecutorConfigError,
} from "./pg-executor";
import {
  FINGERPRINT_QUERIES,
  FingerprintConfigError,
  FingerprintConnectionError,
  FingerprintMismatchError,
  compareFingerprint,
  parseFingerprintExpectationsFromEnv,
  parseSchemasList,
  type FingerprintExpectations,
  type ObservedFingerprint,
} from "./pg-fingerprint";

// ═════════════════════════════════════════════════════════════════════
// §1 · parseFingerprintExpectationsFromEnv · env-only · fail-closed
// ═════════════════════════════════════════════════════════════════════

const completeEnv: NodeJS.ProcessEnv = {
  NEX_CANONICAL_PG_EXPECTED_DATABASE: "nex_business",
  NEX_CANONICAL_PG_EXPECTED_USER: "nex_readonly",
  NEX_CANONICAL_PG_EXPECTED_SERVER_VERSION_PREFIX: "15.",
  NEX_CANONICAL_PG_EXPECTED_SCHEMAS: "nex,public",
};

describe("parseFingerprintExpectationsFromEnv · four required vars", () => {
  test("happy path returns the parsed expectations", () => {
    const e = parseFingerprintExpectationsFromEnv(completeEnv);
    expect(e.database).toBe("nex_business");
    expect(e.user).toBe("nex_readonly");
    expect(e.serverVersionPrefix).toBe("15.");
    expect(e.schemas).toEqual(["nex", "public"]);
  });

  test.each([
    "NEX_CANONICAL_PG_EXPECTED_DATABASE",
    "NEX_CANONICAL_PG_EXPECTED_USER",
    "NEX_CANONICAL_PG_EXPECTED_SERVER_VERSION_PREFIX",
    "NEX_CANONICAL_PG_EXPECTED_SCHEMAS",
  ])("missing %s throws FingerprintConfigError", (varName) => {
    const env = { ...completeEnv };
    delete env[varName];
    expect(() => parseFingerprintExpectationsFromEnv(env)).toThrow(
      FingerprintConfigError,
    );
  });

  test("empty string is treated as missing · DATABASE", () => {
    const env = { ...completeEnv, NEX_CANONICAL_PG_EXPECTED_DATABASE: "" };
    expect(() => parseFingerprintExpectationsFromEnv(env)).toThrow(
      /NEX_CANONICAL_PG_EXPECTED_DATABASE/,
    );
  });

  test("empty string is treated as missing · USER", () => {
    const env = { ...completeEnv, NEX_CANONICAL_PG_EXPECTED_USER: "" };
    expect(() => parseFingerprintExpectationsFromEnv(env)).toThrow(
      /NEX_CANONICAL_PG_EXPECTED_USER/,
    );
  });

  test("empty string is treated as missing · VERSION_PREFIX", () => {
    const env = {
      ...completeEnv,
      NEX_CANONICAL_PG_EXPECTED_SERVER_VERSION_PREFIX: "",
    };
    expect(() => parseFingerprintExpectationsFromEnv(env)).toThrow(
      /NEX_CANONICAL_PG_EXPECTED_SERVER_VERSION_PREFIX/,
    );
  });

  test("empty string is treated as missing · SCHEMAS", () => {
    const env = { ...completeEnv, NEX_CANONICAL_PG_EXPECTED_SCHEMAS: "" };
    expect(() => parseFingerprintExpectationsFromEnv(env)).toThrow(
      /NEX_CANONICAL_PG_EXPECTED_SCHEMAS/,
    );
  });

  test("SCHEMAS of pure commas throws · parses to zero entries", () => {
    const env = { ...completeEnv, NEX_CANONICAL_PG_EXPECTED_SCHEMAS: ",,," };
    expect(() => parseFingerprintExpectationsFromEnv(env)).toThrow(
      /parsed to zero schemas/,
    );
  });

  test("error message names the env var but does NOT echo any other value", () => {
    const env = { ...completeEnv };
    delete env.NEX_CANONICAL_PG_EXPECTED_USER;
    try {
      parseFingerprintExpectationsFromEnv(env);
      expect.fail("expected throw");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("NEX_CANONICAL_PG_EXPECTED_USER");
      // Must not leak sibling values into the error message.
      expect(msg).not.toContain("nex_business");
      expect(msg).not.toContain("15.");
      expect(msg).not.toContain("nex,public");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · parseSchemasList · syntax/charset validation
// ═════════════════════════════════════════════════════════════════════

describe("parseSchemasList", () => {
  test("single schema", () => {
    expect(parseSchemasList("nex")).toEqual(["nex"]);
  });

  test("multiple schemas", () => {
    expect(parseSchemasList("nex,public")).toEqual(["nex", "public"]);
  });

  test("trims whitespace around entries", () => {
    expect(parseSchemasList(" nex , public ")).toEqual(["nex", "public"]);
  });

  test("drops empty entries from trailing commas", () => {
    expect(parseSchemasList("nex,,public,")).toEqual(["nex", "public"]);
  });

  test("rejects a schema with a dot", () => {
    expect(() => parseSchemasList("nex.public")).toThrow(
      FingerprintConfigError,
    );
  });

  test("rejects a schema with a space inside", () => {
    expect(() => parseSchemasList("nex public")).toThrow(
      FingerprintConfigError,
    );
  });

  test("rejects a schema with punctuation (quote)", () => {
    expect(() => parseSchemasList('nex"evil')).toThrow(FingerprintConfigError);
  });

  test("rejects a schema with a semicolon", () => {
    expect(() => parseSchemasList("nex;drop")).toThrow(FingerprintConfigError);
  });

  test("accepts digits and underscores", () => {
    expect(parseSchemasList("nex_2026,v1_data")).toEqual([
      "nex_2026",
      "v1_data",
    ]);
  });

  test("empty raw string parses to zero", () => {
    expect(parseSchemasList("")).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · compareFingerprint · pure
// ═════════════════════════════════════════════════════════════════════

const expectedSample: FingerprintExpectations = {
  database: "nex_business",
  user: "nex_readonly",
  serverVersionPrefix: "15.",
  schemas: ["nex", "public"],
};

const observedPerfect: ObservedFingerprint = {
  database: "nex_business",
  user: "nex_readonly",
  serverVersion: "15.4 (Debian 15.4-1.pgdg120+1)",
  schemasPresent: ["information_schema", "nex", "pg_catalog", "public"],
};

describe("compareFingerprint", () => {
  test("perfect match returns ok=true, no mismatches", () => {
    const r = compareFingerprint(observedPerfect, expectedSample);
    expect(r.ok).toBe(true);
    expect(r.mismatches).toEqual([]);
  });

  test("observed schemas is a superset of expected · still ok", () => {
    const r = compareFingerprint(
      { ...observedPerfect, schemasPresent: [...observedPerfect.schemasPresent, "extra_schema"] },
      expectedSample,
    );
    expect(r.ok).toBe(true);
  });

  test("database mismatch produces one mismatch", () => {
    const r = compareFingerprint(
      { ...observedPerfect, database: "wrong_db" },
      expectedSample,
    );
    expect(r.ok).toBe(false);
    expect(r.mismatches.length).toBe(1);
    expect(r.mismatches[0]).toContain("database");
    expect(r.mismatches[0]).toContain("wrong_db");
    expect(r.mismatches[0]).toContain("nex_business");
  });

  test("user mismatch produces one mismatch", () => {
    const r = compareFingerprint(
      { ...observedPerfect, user: "postgres" },
      expectedSample,
    );
    expect(r.ok).toBe(false);
    expect(r.mismatches.length).toBe(1);
    expect(r.mismatches[0]).toContain("user");
    expect(r.mismatches[0]).toContain("postgres");
  });

  test("server_version does not start with expected prefix produces one mismatch", () => {
    const r = compareFingerprint(
      { ...observedPerfect, serverVersion: "14.9" },
      expectedSample,
    );
    expect(r.ok).toBe(false);
    expect(r.mismatches.length).toBe(1);
    expect(r.mismatches[0]).toContain("server_version");
  });

  test("missing one required schema produces one mismatch · the missing name is listed", () => {
    const r = compareFingerprint(
      { ...observedPerfect, schemasPresent: ["public"] },
      expectedSample,
    );
    expect(r.ok).toBe(false);
    expect(r.mismatches.length).toBe(1);
    expect(r.mismatches[0]).toContain("missing schemas");
    expect(r.mismatches[0]).toContain('"nex"');
  });

  test("multiple missing schemas listed in one entry", () => {
    const r = compareFingerprint(
      {
        ...observedPerfect,
        schemasPresent: ["information_schema", "pg_catalog"],
      },
      expectedSample,
    );
    expect(r.ok).toBe(false);
    expect(r.mismatches[0]).toContain('"nex"');
    expect(r.mismatches[0]).toContain('"public"');
  });

  test("all four dimensions mismatch produces four mismatch entries", () => {
    const r = compareFingerprint(
      {
        database: "wrong_db",
        user: "wrong_user",
        serverVersion: "10.0",
        schemasPresent: ["pg_catalog"],
      },
      expectedSample,
    );
    expect(r.ok).toBe(false);
    expect(r.mismatches.length).toBe(4);
  });

  test("case-sensitive database comparison · 'nex_business' != 'NEX_BUSINESS'", () => {
    const r = compareFingerprint(
      { ...observedPerfect, database: "NEX_BUSINESS" },
      expectedSample,
    );
    expect(r.ok).toBe(false);
  });

  test("version prefix match is literal · '15' is NOT a prefix of '15.4' when expected prefix is '15.'", () => {
    // expectedSample.serverVersionPrefix === "15."
    // observed.serverVersion === "15 (no dot)" would FAIL
    const r = compareFingerprint(
      { ...observedPerfect, serverVersion: "15" },
      expectedSample,
    );
    expect(r.ok).toBe(false);
  });

  test("version prefix match on exact prefix is accepted", () => {
    const r = compareFingerprint(
      { ...observedPerfect, serverVersion: "15.0" },
      expectedSample,
    );
    expect(r.ok).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · FINGERPRINT_QUERIES · frozen · denylist-clean · SELECT-only
// ═════════════════════════════════════════════════════════════════════

describe("FINGERPRINT_QUERIES · hardcoded introspection catalogue", () => {
  test("object is frozen · cannot add a fifth query", () => {
    expect(Object.isFrozen(FINGERPRINT_QUERIES)).toBe(true);
    expect(() => {
      (FINGERPRINT_QUERIES as unknown as Record<string, string>)["evil"] =
        "DROP TABLE x";
    }).toThrow();
  });

  test("every entry starts with 'SELECT '", () => {
    for (const sql of Object.values(FINGERPRINT_QUERIES)) {
      expect(sql.startsWith("SELECT ")).toBe(true);
    }
  });

  test("every entry passes the denylist", () => {
    for (const sql of Object.values(FINGERPRINT_QUERIES)) {
      expect(() => assertNoForbiddenKeyword(sql)).not.toThrow();
    }
  });

  test("exactly four queries · database/user/serverVersion/schemas", () => {
    const keys = Object.keys(FINGERPRINT_QUERIES).sort();
    expect(keys).toEqual(["database", "schemas", "serverVersion", "user"]);
  });

  test("every query references only read-only introspection surfaces", () => {
    // Allow current_database(), current_user, current_setting(),
    // information_schema.schemata. Reject anything that would read
    // user-table data from the business schemas.
    for (const sql of Object.values(FINGERPRINT_QUERIES)) {
      const okRefs =
        /current_database\(\)|current_user|current_setting\(|information_schema\.schemata/.test(
          sql,
        );
      expect(okRefs).toBe(true);
      // Guard against accidental table references in the business
      // schemas · fingerprint queries must not read user data.
      expect(sql).not.toMatch(/\bnex\.\w+/);
      expect(sql).not.toMatch(/\bfood\b/i);
      expect(sql).not.toMatch(/\baccommodation\b/i);
      expect(sql).not.toMatch(/\bservice\b/i);
      expect(sql).not.toMatch(/\bmp_seller\b/i);
      expect(sql).not.toMatch(/\btransport_acquisition_record\b/i);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · Error classes · distinct · distinguish failure categories
// ═════════════════════════════════════════════════════════════════════

describe("error classes · four distinct failure categories", () => {
  test("FingerprintConfigError name is set and is NOT a FingerprintMismatchError", () => {
    const e = new FingerprintConfigError("missing env");
    expect(e.name).toBe("FingerprintConfigError");
    expect(e).toBeInstanceOf(FingerprintConfigError);
    expect(e).not.toBeInstanceOf(FingerprintMismatchError);
    expect(e).not.toBeInstanceOf(FingerprintConnectionError);
    expect(e).not.toBeInstanceOf(PgExecutorConfigError);
  });

  test("FingerprintMismatchError carries mismatches and has correct name", () => {
    const e = new FingerprintMismatchError([
      'database: observed="wrong" expected="right"',
    ]);
    expect(e.name).toBe("FingerprintMismatchError");
    expect(e.mismatches.length).toBe(1);
    expect(e).toBeInstanceOf(FingerprintMismatchError);
    expect(e).not.toBeInstanceOf(FingerprintConfigError);
    expect(e).not.toBeInstanceOf(FingerprintConnectionError);
  });

  test("FingerprintConnectionError name is set and is distinct", () => {
    const e = new FingerprintConnectionError("cannot connect");
    expect(e.name).toBe("FingerprintConnectionError");
    expect(e).toBeInstanceOf(FingerprintConnectionError);
    expect(e).not.toBeInstanceOf(FingerprintConfigError);
    expect(e).not.toBeInstanceOf(FingerprintMismatchError);
  });

  test("PgExecutorConfigError (base credentials) is a separate class", () => {
    const credErr = new PgExecutorConfigError("missing credentials");
    expect(credErr.name).toBe("PgExecutorConfigError");
    expect(credErr).not.toBeInstanceOf(FingerprintConfigError);
    expect(credErr).not.toBeInstanceOf(FingerprintMismatchError);
    expect(credErr).not.toBeInstanceOf(FingerprintConnectionError);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §6 · Module-level grep invariants
// ═════════════════════════════════════════════════════════════════════

/** Strip comments from source so grep assertions catch real code only
 *  (prose documentation that mentions forbidden names is expected). */
describe("pg-fingerprint source · no resolver surface · no disk writes", () => {
  const srcPath = path.join(__dirname, "pg-fingerprint.ts");
  const src = fs.readFileSync(srcPath, "utf8");
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/\/\/[^\n]*/g, ""); // line comments

  test("CODE does NOT import identity-matching", () => {
    expect(code).not.toMatch(/from\s+["'][^"']*identity-matching/);
    expect(code).not.toMatch(/require\(["'][^"']*identity-matching/);
  });

  test("CODE does NOT invoke matchBusiness(...)", () => {
    expect(code).not.toMatch(/\bmatchBusiness\s*\(/);
    expect(code).not.toMatch(/\{\s*matchBusiness\b/);
  });

  test("CODE does NOT import from entity-universe", () => {
    expect(code).not.toMatch(/from\s+["'][^"']*entity-universe/);
  });

  test("CODE does NOT invoke fs.writeFile / fs.appendFile / createWriteStream", () => {
    expect(code).not.toMatch(/\bfs\.writeFile\s*\(/);
    expect(code).not.toMatch(/\bfs\.writeFileSync\s*\(/);
    expect(code).not.toMatch(/\bfs\.appendFile\s*\(/);
    expect(code).not.toMatch(/\bfs\.appendFileSync\s*\(/);
    expect(code).not.toMatch(/\bcreateWriteStream\s*\(/);
  });

  test("CODE does NOT reference generate-candidates (fingerprint is upstream of candidate generation)", () => {
    expect(code).not.toMatch(/from\s+["'][^"']*generate-candidates/);
    expect(code).not.toMatch(/\bQUERY_SPECS\b/);
    expect(code).not.toMatch(/\bgenerateCandidates\s*\(/);
  });

  test("CODE does NOT contain the four mutation-shape SQL patterns", () => {
    // Belt-and-braces · the FINGERPRINT_QUERIES block is reviewed above,
    // but we also assert the module nowhere contains a mutation-shape
    // SQL string.
    const mutationShapes = [
      /\bINSERT\s+INTO\b/i,
      /\bUPDATE\s+\w+\s+SET\b/i,
      /\bDELETE\s+FROM\b/i,
      /\bCREATE\s+(TABLE|SCHEMA|INDEX|VIEW|OR\s+REPLACE)/i,
      /\bALTER\s+(TABLE|SCHEMA|SYSTEM)/i,
      /\bDROP\s+(TABLE|SCHEMA|INDEX|VIEW)/i,
      /\bTRUNCATE\b/i,
      /\bGRANT\s+\w+\s+ON\b/i,
      /\bREVOKE\s+\w+\s+ON\b/i,
    ];
    for (const re of mutationShapes) {
      expect(re.test(code)).toBe(false);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §7 · α.2 · deprecated two-connection path REMOVED
// ═════════════════════════════════════════════════════════════════════

describe("α.2 · pg-fingerprint is pure · no live-connect functions exported", () => {
  test("observeFingerprintLive is no longer exported", async () => {
    const mod = (await import("./pg-fingerprint")) as Record<string, unknown>;
    expect("observeFingerprintLive" in mod).toBe(false);
    expect(mod.observeFingerprintLive).toBeUndefined();
  });

  test("verifyFingerprintOrStop is no longer exported", async () => {
    const mod = (await import("./pg-fingerprint")) as Record<string, unknown>;
    expect("verifyFingerprintOrStop" in mod).toBe(false);
    expect(mod.verifyFingerprintOrStop).toBeUndefined();
  });

  test("pg-fingerprint source has NO `pg` import · pure module", () => {
    const srcPath = path.join(__dirname, "pg-fingerprint.ts");
    const src = fs.readFileSync(srcPath, "utf8");
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    // No runtime `pg` import.
    expect(code).not.toMatch(/from\s+["']pg["']/);
    expect(code).not.toMatch(/require\(["']pg["']/);
    // No `new Client(` anywhere in code.
    expect(code).not.toMatch(/\bnew\s+Client\s*\(/);
    // No `c.connect` / `c.end` references.
    expect(code).not.toMatch(/\bc\.connect\s*\(/);
    expect(code).not.toMatch(/\bc\.end\s*\(/);
    expect(code).not.toMatch(/\bc\.query\s*\(/);
  });

  test("pg-fingerprint source has NO import from ./pg-executor · breaks the former cycle", () => {
    const srcPath = path.join(__dirname, "pg-fingerprint.ts");
    const src = fs.readFileSync(srcPath, "utf8");
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(code).not.toMatch(/from\s+["']\.\/pg-executor["']/);
    expect(code).not.toMatch(/require\(["']\.\/pg-executor["']/);
  });
});
