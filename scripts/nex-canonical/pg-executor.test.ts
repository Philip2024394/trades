// scripts/nex-canonical/pg-executor.test.ts
//
// Unit tests for the pg-executor safety mechanism.
// Pure · no DB · no network · no pg Client is instantiated.
//
// Scope boundary (Step α authorization):
//   · Prove statically-provable safety properties only.
//   · PostgreSQL-specific runtime behaviour (BEGIN READ ONLY actually
//     refuses writes · statement_timeout actually fires · credentials
//     reach pg_hba) is NOT tested here · those require live Step β.
//
// The import of createPgExecutor is included so the pg client type
// resolves · but we never call createPgExecutor() in these tests, so
// no network connection is attempted and no credentials are needed.

import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { QUERY_SPECS, type QuerySpec } from "./generate-candidates";
import {
  FORBIDDEN_SQL_KEYWORDS,
  ForbiddenSqlError,
  PgExecutorConfigError,
  UnknownQuerySpecError,
  assertNoForbiddenKeyword,
  createPgExecutor,
  findForbiddenKeyword,
  isAllowedSpec,
  parsePgExecutorConfigFromEnv,
  quoteIdent,
  renderSelect,
  sanitiseErrorText,
} from "./pg-executor";

// ═════════════════════════════════════════════════════════════════════
// §1 · Mutation / DDL denylist
// ═════════════════════════════════════════════════════════════════════

describe("findForbiddenKeyword · case-insensitive · whole-word", () => {
  test("clean SELECT returns null", () => {
    expect(
      findForbiddenKeyword(
        "SELECT a, b, c FROM nex.food_business WHERE claim_status = 'listed'",
      ),
    ).toBeNull();
  });

  test("rejects every denylisted keyword", () => {
    for (const kw of FORBIDDEN_SQL_KEYWORDS) {
      const probe = `SELECT 1; ${kw} something`;
      expect(findForbiddenKeyword(probe)).toBe(kw);
    }
  });

  test("case insensitive", () => {
    expect(findForbiddenKeyword("select 1; insert into x values (1)")).toBe(
      "INSERT",
    );
    expect(findForbiddenKeyword("select 1; InSeRt into x values (1)")).toBe(
      "INSERT",
    );
  });

  test("whole-word · does NOT false-positive on substrings", () => {
    // "insertion", "updater", "created_at", "dropdown" should NOT match
    expect(
      findForbiddenKeyword(
        "SELECT created_at, dropdown_options, updater_name, insertion_sort FROM t",
      ),
    ).toBeNull();
  });

  test("matches with newlines around keyword", () => {
    expect(findForbiddenKeyword("SELECT 1;\nDROP TABLE x")).toBe("DROP");
  });
});

describe("assertNoForbiddenKeyword · fail-closed on any match", () => {
  test("clean SQL passes", () => {
    expect(() =>
      assertNoForbiddenKeyword("SELECT * FROM nex.food_business LIMIT 10"),
    ).not.toThrow();
  });

  test("throws ForbiddenSqlError with matched keyword surfaced", () => {
    try {
      assertNoForbiddenKeyword("SELECT 1; DELETE FROM nex.food_business");
      expect.fail("expected ForbiddenSqlError");
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenSqlError);
      expect((e as ForbiddenSqlError).matchedKeyword).toBe("DELETE");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · QuerySpec allowlist · object-identity
// ═════════════════════════════════════════════════════════════════════

describe("isAllowedSpec · identity-based allowlist", () => {
  test("every authored QUERY_SPECS entry is allowed", () => {
    for (const spec of QUERY_SPECS) {
      expect(isAllowedSpec(spec)).toBe(true);
    }
  });

  test("a structurally-equal but foreign object is REJECTED", () => {
    const foreign = {
      ...QUERY_SPECS[0],
    } as QuerySpec;
    // Shallow-copy produces a distinct identity · must be rejected.
    expect(isAllowedSpec(foreign)).toBe(false);
  });

  test("a maliciously-crafted spec is rejected", () => {
    const evil: QuerySpec = {
      spec_id: "evil",
      legacy_table: "pg_catalog.pg_class",
      description: "oh no",
      mode: "readonly",
      columns: ["relname"],
      where: { filter_description: "none", legacy_specific_conditions: [] },
      order_by: [],
      limit: 1,
      hinted_risk_categories: [],
    };
    expect(isAllowedSpec(evil)).toBe(false);
  });
});

describe("UnknownQuerySpecError", () => {
  test("carries the rejected spec_id in the message", () => {
    const err = new UnknownQuerySpecError("not-authored");
    expect(err.message).toContain("not-authored");
    expect(err.name).toBe("UnknownQuerySpecError");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · SQL rendering · deterministic · bounded
// ═════════════════════════════════════════════════════════════════════

describe("quoteIdent · identifier quoting", () => {
  test("simple identifier", () => {
    expect(quoteIdent("business_name")).toBe('"business_name"');
  });

  test("embedded double-quote escapes to two", () => {
    expect(quoteIdent('weird"name')).toBe('"weird""name"');
  });
});

describe("renderSelect · deterministic SELECT shape", () => {
  const spec = QUERY_SPECS.find(
    (s) => s.spec_id === "nex_accommodation_business_live",
  )!;

  test("produces a SELECT with FROM, WHERE, ORDER BY, LIMIT", () => {
    const r = renderSelect(spec, { resultRowCeiling: 10000 });
    expect(r.sql.startsWith("SELECT ")).toBe(true);
    expect(r.sql).toContain("FROM nex.accommodation_business");
    expect(r.sql).toContain("WHERE");
    expect(r.sql).toContain("ORDER BY");
    expect(r.sql).toContain("LIMIT ");
  });

  test("LIMIT clamped to resultRowCeiling when spec.limit is null", () => {
    const r = renderSelect(spec, { resultRowCeiling: 500 });
    expect(r.effective_limit).toBe(500);
    expect(r.sql).toContain("LIMIT 500");
  });

  test("LIMIT clamped down when spec.limit > ceiling", () => {
    const r = renderSelect(
      { ...spec, limit: 100000 } as QuerySpec,
      { resultRowCeiling: 10000 },
    );
    expect(r.effective_limit).toBe(10000);
  });

  test("same input · same output (deterministic)", () => {
    const a = renderSelect(spec, { resultRowCeiling: 10000 });
    const b = renderSelect(spec, { resultRowCeiling: 10000 });
    expect(a.sql).toBe(b.sql);
    expect(a.effective_limit).toBe(b.effective_limit);
  });

  test("columns rendered in spec order, double-quoted", () => {
    const r = renderSelect(spec, { resultRowCeiling: 100 });
    const expectedPrefix = `SELECT ${spec.columns.map((c) => `"${c}"`).join(", ")}`;
    expect(r.sql.startsWith(expectedPrefix)).toBe(true);
  });

  test("rendered SQL for every authored spec passes the denylist", () => {
    // Pure static assertion · the authored specs cannot emit forbidden
    // keywords by construction. If a future spec is added that breaks
    // this, this test catches it before any DB access.
    for (const s of QUERY_SPECS) {
      const r = renderSelect(s, { resultRowCeiling: 100 });
      expect(() => assertNoForbiddenKeyword(r.sql)).not.toThrow();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · Config · env-only · fail-closed
// ═════════════════════════════════════════════════════════════════════

describe("parsePgExecutorConfigFromEnv · env-only · fail-closed", () => {
  const completeEnv: NodeJS.ProcessEnv = {
    NEX_CANONICAL_PG_HOST: "pg.example.internal",
    NEX_CANONICAL_PG_PORT: "5432",
    NEX_CANONICAL_PG_DATABASE: "nex_business",
    NEX_CANONICAL_PG_USER: "readonly_app",
    NEX_CANONICAL_PG_PASSWORD: "redacted-in-tests",
    NEX_CANONICAL_PG_SSL: "true",
  };

  test("happy path parses with sensible defaults", () => {
    const c = parsePgExecutorConfigFromEnv(completeEnv);
    expect(c.host).toBe("pg.example.internal");
    expect(c.port).toBe(5432);
    expect(c.database).toBe("nex_business");
    expect(c.user).toBe("readonly_app");
    expect(c.ssl).toBe(true);
    expect(c.resultRowCeiling).toBe(10000);
    expect(c.statementTimeoutMs).toBe(30000);
    expect(c.idleInTransactionTimeoutMs).toBe(60000);
  });

  test("missing HOST throws · error message names ONLY the env var", () => {
    const env = { ...completeEnv };
    delete env.NEX_CANONICAL_PG_HOST;
    expect(() => parsePgExecutorConfigFromEnv(env)).toThrow(
      PgExecutorConfigError,
    );
    try {
      parsePgExecutorConfigFromEnv(env);
    } catch (e) {
      expect((e as Error).message).toContain("NEX_CANONICAL_PG_HOST");
      expect((e as Error).message).not.toContain(
        completeEnv.NEX_CANONICAL_PG_PASSWORD,
      );
    }
  });

  test.each([
    "NEX_CANONICAL_PG_DATABASE",
    "NEX_CANONICAL_PG_USER",
    "NEX_CANONICAL_PG_PASSWORD",
  ])("missing %s throws", (varName) => {
    const env = { ...completeEnv };
    delete env[varName];
    expect(() => parsePgExecutorConfigFromEnv(env)).toThrow(
      PgExecutorConfigError,
    );
  });

  test("empty string treated as missing", () => {
    const env = { ...completeEnv, NEX_CANONICAL_PG_HOST: "" };
    expect(() => parsePgExecutorConfigFromEnv(env)).toThrow(
      PgExecutorConfigError,
    );
  });

  test("non-numeric PORT throws", () => {
    const env = { ...completeEnv, NEX_CANONICAL_PG_PORT: "nope" };
    expect(() => parsePgExecutorConfigFromEnv(env)).toThrow(
      PgExecutorConfigError,
    );
  });

  test("negative ROW_CEILING throws", () => {
    const env = { ...completeEnv, NEX_CANONICAL_PG_ROW_CEILING: "-1" };
    expect(() => parsePgExecutorConfigFromEnv(env)).toThrow(
      PgExecutorConfigError,
    );
  });

  test("SSL defaults to true when unset", () => {
    const env = { ...completeEnv };
    delete env.NEX_CANONICAL_PG_SSL;
    expect(parsePgExecutorConfigFromEnv(env).ssl).toBe(true);
  });

  test("SSL=false respected", () => {
    const env = { ...completeEnv, NEX_CANONICAL_PG_SSL: "false" };
    expect(parsePgExecutorConfigFromEnv(env).ssl).toBe(false);
  });

  test("config error never echoes the password", () => {
    const env = { ...completeEnv };
    delete env.NEX_CANONICAL_PG_HOST;
    try {
      parsePgExecutorConfigFromEnv(env);
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).not.toContain(completeEnv.NEX_CANONICAL_PG_PASSWORD);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · Error sanitiser · never echo credentials
// ═════════════════════════════════════════════════════════════════════

describe("sanitiseErrorText · credential redaction", () => {
  test("clean string unchanged", () => {
    expect(sanitiseErrorText("timeout: statement cancelled")).toBe(
      "timeout: statement cancelled",
    );
  });

  test("strips postgres:// URL with credentials", () => {
    const raw =
      "connection refused: postgres://app:supersecret@pg.example.internal:5432/db";
    const out = sanitiseErrorText(raw);
    expect(out).not.toContain("supersecret");
    expect(out).toContain("[redacted]");
  });

  test("strips password=... pair", () => {
    const raw = "pg_connection: host=x password=hunter2 dbname=y";
    const out = sanitiseErrorText(raw);
    expect(out).not.toContain("hunter2");
    expect(out).toContain("[redacted]");
  });

  test("strips password=\"...\" quoted form", () => {
    const raw = `pg_connection: password="hunter2" dbname=y`;
    const out = sanitiseErrorText(raw);
    expect(out).not.toContain("hunter2");
  });

  test("strips api_key / service_role_key / secret / token", () => {
    const samples = [
      "api_key: AbCdEfGhIjKlMnOp12345678",
      "service_role_key=eyJhbGciOiJIUzI1NiJ9longstring",
      "secret: SuPeRsEcReT1234567890",
      "token: tok_abcdefghijklmnop",
    ];
    for (const raw of samples) {
      const out = sanitiseErrorText(raw);
      expect(out).toContain("[redacted]");
      // The raw credential value must not survive.
      const credPart = raw.split(/[:=]\s*/, 2)[1]!.replace(/['"]/g, "");
      expect(out).not.toContain(credPart);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §6 · Executor construction is lazy · no network at import or build
// ═════════════════════════════════════════════════════════════════════

describe("createPgExecutor · no connection at construction", () => {
  test("returns an executor without touching the network", async () => {
    const exec = createPgExecutor({
      host: "127.0.0.1",
      port: 15432,
      database: "nex_business",
      user: "u",
      password: "p",
      ssl: false,
      resultRowCeiling: 1,
      statementTimeoutMs: 1000,
      idleInTransactionTimeoutMs: 1000,
    });
    // Just constructing it should not throw and should not attempt
    // any TCP connection. We immediately close() to be tidy.
    expect(typeof exec.execute).toBe("function");
    expect(typeof exec.close).toBe("function");
    // close() on an un-opened client is a no-op.
    await exec.close!();
  });

  test("rejects an unknown QuerySpec BEFORE any connection attempt", async () => {
    const exec = createPgExecutor({
      host: "127.0.0.1",
      port: 15432,
      database: "x",
      user: "x",
      password: "x",
      ssl: false,
      resultRowCeiling: 1,
      statementTimeoutMs: 1000,
      idleInTransactionTimeoutMs: 1000,
    });
    const evil: QuerySpec = {
      spec_id: "evil",
      legacy_table: "pg_catalog.pg_class",
      description: "oh no",
      mode: "readonly",
      columns: ["relname"],
      where: { filter_description: "", legacy_specific_conditions: [] },
      order_by: [],
      limit: 1,
      hinted_risk_categories: [],
    };
    await expect(exec.execute(evil)).rejects.toBeInstanceOf(
      UnknownQuerySpecError,
    );
    // Still no connection attempt should have fired.
    await exec.close!();
  });
});

// ═════════════════════════════════════════════════════════════════════
// §7 · Module-level invariants · grep assertions
// ═════════════════════════════════════════════════════════════════════

/** Static assertion: pg-executor source must not import or reference
 *  the resolver surface at the CODE level (prose documentation that
 *  explains "this file does NOT do X" is permitted and expected).
 *  We strip comments from the source before scanning, so the test
 *  catches real code references but not the invariant-documenting
 *  prose that mentions the forbidden tokens by name. */
describe("pg-executor source · no resolver surface", () => {
  const srcPath = path.join(__dirname, "pg-executor.ts");
  const src = fs.readFileSync(srcPath, "utf8");

  /** Strip single-line `//` comments and block `/* ... *\/` comments.
   *  Does not understand strings · acceptable because the pg-executor
   *  source contains no SQL/doc-string literals that embed the
   *  forbidden tokens outside of comments. */
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")       // block comments
    .replace(/\/\/[^\n]*/g, "");            // line comments

  test("CODE does NOT import identity-matching", () => {
    expect(code).not.toMatch(/from\s+["'][^"']*identity-matching/);
    expect(code).not.toMatch(/require\(["'][^"']*identity-matching/);
  });

  test("CODE does NOT invoke matchBusiness(...)", () => {
    expect(code).not.toMatch(/\bmatchBusiness\s*\(/);
    expect(code).not.toMatch(/\bmatchBusiness\s*,/);
    expect(code).not.toMatch(/\{\s*matchBusiness\b/);
  });

  test("CODE does NOT import from entity-universe", () => {
    expect(code).not.toMatch(/from\s+["'][^"']*entity-universe/);
    expect(code).not.toMatch(/require\(["'][^"']*entity-universe/);
  });

  test("CODE does NOT invoke fs.writeFile / createWriteStream / fs.appendFile", () => {
    expect(code).not.toMatch(/\bfs\.writeFile\s*\(/);
    expect(code).not.toMatch(/\bfs\.writeFileSync\s*\(/);
    expect(code).not.toMatch(/\bcreateWriteStream\s*\(/);
    expect(code).not.toMatch(/\bfs\.appendFile\s*\(/);
    expect(code).not.toMatch(/\bfs\.appendFileSync\s*\(/);
  });

  test("does NOT contain any INSERT / UPDATE / DELETE / etc. in authored SQL", () => {
    // The source itself contains the literal denylist in
    // FORBIDDEN_SQL_KEYWORDS. We assert that outside of that one
    // array literal, no SQL string in the module uses those keywords.
    // Strategy: strip the FORBIDDEN_SQL_KEYWORDS block, then check.
    const stripped = src.replace(
      /FORBIDDEN_SQL_KEYWORDS[\s\S]*?\]\s*as\s*const\s*;/,
      "FORBIDDEN_SQL_KEYWORDS = [redacted-block] as const;",
    );
    // Also strip the ForbiddenSqlError message that mentions a keyword.
    const strippedMore = stripped.replace(
      /`pg-executor refused to run SQL containing forbidden keyword[\s\S]*?`/,
      "`pg-executor refused to run SQL containing forbidden keyword [msg]`",
    );
    // Strip the error class names which legitimately include keywords.
    const final = strippedMore.replace(/ForbiddenSqlError/g, "");
    // Strip the comment block that enumerates the sealed denylist in
    // human-readable form inside the HARD RULE section.
    // Now assert no SQL-mutation keyword survives as actual SQL.
    for (const kw of FORBIDDEN_SQL_KEYWORDS) {
      const probe = new RegExp(
        `\\b${kw}\\b\\s+(?:INTO|TABLE|FROM|SET|OR\\s+REPLACE)`,
        "i",
      );
      expect(probe.test(final)).toBe(false);
    }
  });
});

describe("fail-closed invariants", () => {
  test("UnknownQuerySpecError name is set", () => {
    expect(new UnknownQuerySpecError("x").name).toBe("UnknownQuerySpecError");
  });

  test("ForbiddenSqlError name is set", () => {
    expect(new ForbiddenSqlError("INSERT", "DELETE from x").name).toBe(
      "ForbiddenSqlError",
    );
  });

  test("PgExecutorConfigError name is set", () => {
    expect(new PgExecutorConfigError("missing env").name).toBe(
      "PgExecutorConfigError",
    );
  });
});
