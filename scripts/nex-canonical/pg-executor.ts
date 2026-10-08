// scripts/nex-canonical/pg-executor.ts
//
// NEX Business Canonical · Read-Only PostgreSQL executor for the
// candidate-generation mechanism · Step α of the Path A chain.
//
// Governing docs
//   · docs/doctrine/nex-business-canonical-seed-cohort-and-eval-corpus-design-2026-10-08.md
//   · Sealed memory · project_nex_directory_spine_sealed_2026_10_07.md
//     Rules 5h · 5i · 5j · 5l · 5n
//
// WHAT THIS FILE IS
//   The real-DB-backed implementation of the `QueryExecutor` contract
//   defined by scripts/nex-canonical/generate-candidates.ts. It takes
//   the 8 authored `QuerySpec` definitions and executes them against
//   a PostgreSQL instance in strictly read-only mode.
//
// WHAT THIS FILE IS NOT
//   · Not auto-wired to the candidate generator. The generator's
//     `nonExecutionGuardMain()` still refuses direct invocation. An
//     authorised caller script must explicitly import this module and
//     pass the executor into `generateCandidates()`.
//   · Not a DB connection in Step α. This file ships the mechanism;
//     it is NOT executed during the authoring/review wave. A separate
//     founder authorization is required for Step β (live execution).
//   · Not a mutator. The mechanism exists exclusively to run
//     read-only `SELECT` statements emitted deterministically from
//     the authored `QuerySpec` catalogue. It does not accept arbitrary
//     SQL input and has no code path to any mutation keyword.
//
// SAFETY POSTURE (fail-closed by default)
//   This file is designed so that bugs trend toward refusal, not toward
//   accidental mutation. In particular:
//     · Every query runs inside an explicit `BEGIN READ ONLY` txn with
//       `SET LOCAL default_transaction_read_only = on` as belt-and-braces.
//     · `SET LOCAL statement_timeout` is applied per-session before any
//       SELECT fires.
//     · Every `QuerySpec` must match (by object-identity) one of the
//       entries in the authored `QUERY_SPECS` catalogue · an unknown
//       spec is rejected before any SQL is emitted.
//     · Every emitted SQL string is scanned for a sealed denylist of
//       mutation / DDL keywords as a pure-text defence in depth. Any
//       match aborts the transaction.
//     · Column names are drawn only from the whitelisted `columns`
//       array on the spec. The `where.legacy_specific_conditions` entries
//       are the ONLY attacker-adjacent surface, and they are themselves
//       authored by the same file that authored the spec object · so the
//       threat surface is "a developer edits generate-candidates.ts in a
//       dangerous way", not "a user injects SQL." The denylist scan
//       catches that developer error too.
//     · All result sets are capped by a hard row ceiling even when the
//       spec declares `limit: null`.
//     · Credentials are read exclusively from runtime env vars that
//       the caller provides at process start. No credential is baked
//       into source, documentation, logs, or error messages.
//     · Error messages are sanitised to strip any accidental credential
//       echo before being returned.
//     · The executor imports `pg` directly and NEVER imports
//       `src/lib/nex/entity-universe/identity-matching.ts` or any
//       resolver surface. There is no resolver call anywhere in this
//       file.
//
// WHAT IS PROVABLE STATICALLY (unit-testable without a live DB)
//   · Mutation-keyword denylist rejects every forbidden keyword.
//   · Unknown `QuerySpec` object identity is rejected.
//   · SQL rendering produces a SELECT with LIMIT clamped to the ceiling.
//   · Config parse fails closed when required env vars are missing.
//   · Error message sanitiser strips passwords from PG error strings.
//   · The module does NOT import identity-matching at the type level.
//
// WHAT IS NOT STATICALLY PROVABLE (requires live Step β verification)
//   · Postgres actually honours `BEGIN READ ONLY` on the target
//     deployment (true for all supported versions, but configurational
//     drift exists; must be verified live).
//   · `statement_timeout` is honoured by the planner.
//   · Credentials in the deployment env are actually readable by the
//     process · Step β will test this by trying to connect.
//   · Round-trip latencies and connection-pool exhaustion behaviour.
//   · Whether the authored `legacy_specific_conditions` SQL strings
//     parse successfully in the target PG dialect (they are PG-only
//     by convention, but no live parse happens in Step α).

import { Client, type QueryResult } from "pg";
import { QUERY_SPECS, type QuerySpec, type QueryExecutor } from "./generate-candidates";
import {
  FINGERPRINT_QUERIES,
  FingerprintConnectionError,
  type ObservedFingerprint,
} from "./pg-fingerprint";

// ═════════════════════════════════════════════════════════════════════
// §1 · Config · env-var-only · fail-closed on missing/invalid
// ═════════════════════════════════════════════════════════════════════

export interface PgExecutorConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  /** Hard upper bound on rows returned per query, independent of
   *  the spec's own `limit`. Default 10000. */
  resultRowCeiling: number;
  /** PG `statement_timeout` in milliseconds. Default 30000 (30s). */
  statementTimeoutMs: number;
  /** Transaction-level timeout as a belt-and-braces override of
   *  statement_timeout. Default 60000 (60s). */
  idleInTransactionTimeoutMs: number;
}

/** Parse config exclusively from runtime env vars. Fails closed if
 *  any required var is missing or malformed. Never reads any file. */
export function parsePgExecutorConfigFromEnv(
  env: NodeJS.ProcessEnv,
): PgExecutorConfig {
  const required = (name: string): string => {
    const raw = env[name];
    if (typeof raw !== "string" || raw.length === 0) {
      // Error message deliberately contains ONLY the env var name ·
      // never its value, never a hint about expected shape.
      throw new PgExecutorConfigError(
        `missing required env var: ${name}`,
      );
    }
    return raw;
  };
  const optionalInt = (name: string, def: number): number => {
    const raw = env[name];
    if (raw === undefined || raw === "") return def;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) {
      throw new PgExecutorConfigError(
        `env var ${name} is not a positive integer`,
      );
    }
    return n;
  };
  const host = required("NEX_CANONICAL_PG_HOST");
  const port = optionalInt("NEX_CANONICAL_PG_PORT", 5432);
  const database = required("NEX_CANONICAL_PG_DATABASE");
  const user = required("NEX_CANONICAL_PG_USER");
  const password = required("NEX_CANONICAL_PG_PASSWORD");
  const ssl = (env["NEX_CANONICAL_PG_SSL"] ?? "true").toLowerCase() === "true";
  const resultRowCeiling = optionalInt(
    "NEX_CANONICAL_PG_ROW_CEILING",
    10000,
  );
  const statementTimeoutMs = optionalInt(
    "NEX_CANONICAL_PG_STATEMENT_TIMEOUT_MS",
    30000,
  );
  const idleInTransactionTimeoutMs = optionalInt(
    "NEX_CANONICAL_PG_IDLE_IN_TX_TIMEOUT_MS",
    60000,
  );
  return {
    host,
    port,
    database,
    user,
    password,
    ssl,
    resultRowCeiling,
    statementTimeoutMs,
    idleInTransactionTimeoutMs,
  };
}

export class PgExecutorConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PgExecutorConfigError";
  }
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Mutation / DDL denylist · defence in depth
// ═════════════════════════════════════════════════════════════════════

/** Sealed list of SQL tokens that must NEVER appear in a rendered
 *  statement from this executor. Case-insensitive · whole-word match. */
export const FORBIDDEN_SQL_KEYWORDS: readonly string[] = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "CREATE",
  "ALTER",
  "DROP",
  "TRUNCATE",
  "GRANT",
  "REVOKE",
  "MERGE",
  "COPY",
  "CALL",
  "VACUUM",
  "REINDEX",
  "CLUSTER",
] as const;

const FORBIDDEN_REGEX = new RegExp(
  `\\b(?:${FORBIDDEN_SQL_KEYWORDS.join("|")})\\b`,
  "i",
);

export class ForbiddenSqlError extends Error {
  readonly matchedKeyword: string;
  constructor(matchedKeyword: string, sqlExcerpt: string) {
    super(
      `pg-executor refused to run SQL containing forbidden keyword "${matchedKeyword}". ` +
        `Rule 5n read-only invariant · fail-closed. ` +
        `SQL excerpt (first 200 chars, no values): ${sqlExcerpt.slice(0, 200)}`,
    );
    this.name = "ForbiddenSqlError";
    this.matchedKeyword = matchedKeyword;
  }
}

/** Pure · scans the SQL text for any forbidden keyword and returns
 *  the first matched keyword, or null if the text is clean. */
export function findForbiddenKeyword(sql: string): string | null {
  const m = FORBIDDEN_REGEX.exec(sql);
  return m ? m[0].toUpperCase() : null;
}

/** Throws ForbiddenSqlError if the SQL contains any denylisted keyword. */
export function assertNoForbiddenKeyword(sql: string): void {
  const kw = findForbiddenKeyword(sql);
  if (kw !== null) {
    throw new ForbiddenSqlError(kw, sql);
  }
}

// ═════════════════════════════════════════════════════════════════════
// §3 · QuerySpec allowlist · identity-based
// ═════════════════════════════════════════════════════════════════════

/** Build the allowlist from the authored QUERY_SPECS catalogue by
 *  object identity. A spec that does not match (by `===`) any entry
 *  from the sealed catalogue is rejected before any SQL emission. */
const ALLOWED_SPECS: ReadonlySet<QuerySpec> = new Set(QUERY_SPECS);

export class UnknownQuerySpecError extends Error {
  constructor(specId: string) {
    super(
      `pg-executor refused: QuerySpec "${specId}" is not in the authored ` +
        `QUERY_SPECS catalogue. Only authored, reviewed specs are permitted.`,
    );
    this.name = "UnknownQuerySpecError";
  }
}

/** True iff the spec is in the authored catalogue by object identity. */
export function isAllowedSpec(spec: QuerySpec): boolean {
  return ALLOWED_SPECS.has(spec);
}

// ═════════════════════════════════════════════════════════════════════
// §4 · SQL rendering · deterministic · bounded
// ═════════════════════════════════════════════════════════════════════

export interface RenderedQuery {
  sql: string;
  spec_id: string;
  effective_limit: number;
}

/** Pure · deterministic · renders a SELECT from a validated spec with
 *  a hard LIMIT applied. Column list comes exclusively from the spec's
 *  `columns` array · the WHERE clause is composed from the spec's
 *  `where.legacy_specific_conditions` strings joined with AND.
 *
 *  Column identifiers are quoted with double quotes. Table names are
 *  rendered verbatim (schema-qualified). This keeps the rendered SQL
 *  grep-able and reviewable. */
export function renderSelect(
  spec: QuerySpec,
  config: Pick<PgExecutorConfig, "resultRowCeiling">,
): RenderedQuery {
  const columns = spec.columns.map((c) => quoteIdent(c)).join(", ");
  const where =
    spec.where.legacy_specific_conditions.length > 0
      ? ` WHERE ${spec.where.legacy_specific_conditions.join(" AND ")}`
      : "";
  const orderBy =
    spec.order_by.length > 0
      ? ` ORDER BY ${spec.order_by.map((c) => quoteIdent(c)).join(", ")}`
      : "";
  const specLimit = spec.limit;
  const effectiveLimit =
    specLimit === null
      ? config.resultRowCeiling
      : Math.min(specLimit, config.resultRowCeiling);
  const sql =
    `SELECT ${columns}` +
    ` FROM ${spec.legacy_table}` +
    where +
    orderBy +
    ` LIMIT ${effectiveLimit}`;
  return { sql, spec_id: spec.spec_id, effective_limit: effectiveLimit };
}

/** Pure · quotes a SQL identifier with double quotes · escapes
 *  embedded double quotes. Does NOT accept arbitrary strings · the
 *  caller is responsible for only passing identifiers from an authored
 *  `columns` array. */
export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

// ═════════════════════════════════════════════════════════════════════
// §5 · Error sanitisation · never echo credentials
// ═════════════════════════════════════════════════════════════════════

/** Pure · scrubs a string of likely-credential patterns before it is
 *  surfaced through an error, log, or return value. Belt-and-braces ·
 *  the primary defence is to never put credentials into error paths
 *  in the first place, but PG client errors occasionally echo
 *  connection details. */
export function sanitiseErrorText(input: string): string {
  let out = input;
  // Strip postgres:// URLs with credentials.
  out = out.replace(
    /postgres(?:ql)?:\/\/[^:]*:[^@]*@[^\s'"]+/gi,
    "postgres://[redacted]",
  );
  // Strip password=... pairs anywhere in the string.
  out = out.replace(/password\s*=\s*['"][^'"]*['"]/gi, "password=[redacted]");
  out = out.replace(/password\s*=\s*\S+/gi, "password=[redacted]");
  // Strip "key" / "token" / "secret" patterns. The replacement redacts
  // only the content AFTER the `:` or `=` separator · scrubbing from
  // the start of the match would wrongly rewrite the token-NAME
  // (e.g. "service_role_key" is itself a long alphanumeric run) and
  // leave the actual credential value exposed.
  out = out.replace(
    /(?:api[_-]?key|service[_-]?role[_-]?key|secret|token)\s*[:=]\s*['"]?[A-Za-z0-9+/._-]{8,}['"]?/gi,
    (match) => {
      const sepIndex = match.search(/[:=]/);
      if (sepIndex < 0) return match;
      const prefix = match.slice(0, sepIndex + 1);
      const rest = match.slice(sepIndex + 1);
      return prefix + rest.replace(/[A-Za-z0-9+/._-]{8,}/, "[redacted]");
    },
  );
  return out;
}

// ═════════════════════════════════════════════════════════════════════
// §6 · The executor itself
// ═════════════════════════════════════════════════════════════════════

/**
 * Extended QueryExecutor surface exposed by `createPgExecutor`. Adds a
 * fingerprint-observation method that runs on the EXACT SAME Client
 * instance later used by `execute()`. This is the α.2 same-session
 * binding that closes the TOCTOU gap identified in the final-review
 * wave (2026-10-08).
 */
export interface PgExecutor extends QueryExecutor {
  /** Run the four hardcoded `FINGERPRINT_QUERIES` on this executor's
   *  Client. Lazily opens the Client (same path as `execute`), so the
   *  observed fingerprint and every subsequent QUERY_SPEC share the
   *  same connection. Rolls back and surfaces a sanitised
   *  `FingerprintConnectionError` on any failure. The Client is NOT
   *  closed on failure; the caller is responsible for `close()`. */
  observeFingerprint(): Promise<ObservedFingerprint>;
  /** Explicitly required (not optional) · the α.2 flow may need to
   *  tear down the Client on fingerprint mismatch. */
  close(): Promise<void>;
}

/** Construct a PgExecutor backed by a single pg Client. The client is
 *  created lazily on the first `execute()` or `observeFingerprint()`
 *  call. The caller is responsible for calling `close()` to release
 *  the connection. */
export function createPgExecutor(config: PgExecutorConfig): PgExecutor {
  let client: Client | null = null;
  let sessionConfigured = false;
  // α.1 single-flight gate · 2026-10-08. Serialises concurrent execute()
  // calls so their per-call BEGIN/COMMIT transaction envelopes cannot
  // interleave on the single underlying pg Client. pg.Client is one
  // physical connection; two concurrent execute()s would otherwise land
  // nested BEGINs on the same connection and the per-call read-only
  // invariant would become ambiguous. Errors are swallowed on the chain
  // (never on the returned promise) so one failing call does not poison
  // subsequent calls.
  let chain: Promise<unknown> = Promise.resolve();

  async function ensureClient(): Promise<Client> {
    if (client !== null) return client;
    const c = new Client({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      // Hard caps at the client layer in case server-level timeouts
      // are not honoured in a given deployment.
      statement_timeout: config.statementTimeoutMs,
      query_timeout: config.statementTimeoutMs,
      connectionTimeoutMillis: 10000,
    });
    await c.connect();
    client = c;
    return c;
  }

  async function configureSessionOnce(c: Client): Promise<void> {
    if (sessionConfigured) return;
    // Session-level read-only + bounded timeouts. SET LOCAL would be
    // scoped to the surrounding transaction only; we want these to
    // apply to every statement on this connection, so we use plain
    // SET at the session scope.
    const sessionGuards = [
      `SET statement_timeout = ${config.statementTimeoutMs}`,
      `SET idle_in_transaction_session_timeout = ${config.idleInTransactionTimeoutMs}`,
      `SET default_transaction_read_only = on`,
      `SET default_transaction_isolation = 'repeatable read'`,
    ];
    for (const g of sessionGuards) {
      // Session-config statements are internal · they do not contain
      // user data · still scanned for denylist as belt-and-braces.
      assertNoForbiddenKeyword(g);
      await c.query(g);
    }
    sessionConfigured = true;
  }

  async function doExecute(
    spec: QuerySpec,
  ): Promise<readonly Record<string, unknown>[]> {
    // Guard 1 · spec must be in the authored catalogue by identity.
    if (!isAllowedSpec(spec)) {
      throw new UnknownQuerySpecError(spec.spec_id);
    }
    // Guard 2 · spec declares read-only mode.
    if (spec.mode !== "readonly") {
      throw new Error(
        `pg-executor refused: QuerySpec "${spec.spec_id}" has mode "${spec.mode}" ` +
          `· only "readonly" is permitted.`,
      );
    }
    const rendered = renderSelect(spec, config);
    // Guard 3 · rendered SQL must not contain any forbidden keyword.
    assertNoForbiddenKeyword(rendered.sql);

    const c = await ensureClient();
    await configureSessionOnce(c);

    // Guard 4 · wrap the query in an explicit READ ONLY transaction.
    // We do NOT nest transactions; one query per transaction keeps the
    // read-only invariant local and easy to reason about.
    let result: QueryResult<Record<string, unknown>>;
    try {
      await c.query("BEGIN TRANSACTION READ ONLY");
      // Belt-and-braces · SET LOCAL inside the txn as well.
      await c.query("SET LOCAL default_transaction_read_only = on");
      await c.query(`SET LOCAL statement_timeout = ${config.statementTimeoutMs}`);
      result = await c.query<Record<string, unknown>>(rendered.sql);
      await c.query("COMMIT");
    } catch (err) {
      // Attempt a safe rollback. We swallow rollback errors because
      // we are already in an error path and PG rejects ROLLBACK outside
      // a transaction, which would mask the real cause.
      try {
        await c.query("ROLLBACK");
      } catch {
        /* intentional swallow · see comment above */
      }
      const sanitised = sanitiseErrorText(
        err instanceof Error ? err.message : String(err),
      );
      throw new Error(
        `pg-executor query "${rendered.spec_id}" failed: ${sanitised}`,
      );
    }

    // Hard cap on returned rows · defence in depth even though
    // rendered SQL already carries LIMIT.
    const rows = result.rows.slice(0, rendered.effective_limit);
    return rows;
  }

  async function execute(
    spec: QuerySpec,
  ): Promise<readonly Record<string, unknown>[]> {
    // α.1 single-flight · see chain declaration above. Each execute() is
    // linked to the previous one so doExecute runs strictly one-at-a-time.
    // The chain's .catch swallows errors for the chain reference only ·
    // the returned promise still surfaces rejection to the caller.
    const next = chain.then(() => doExecute(spec));
    chain = next.catch(() => {});
    return next;
  }

  // α.2 same-session fingerprint binding · 2026-10-08.
  //
  // `doObserveFingerprint` runs on the EXACT SAME Client that subsequent
  // `doExecute` calls use. The guarantee: the Client that passes
  // fingerprint IS the Client that runs QUERY_SPECS. This closes the
  // TOCTOU gap where a hypothetical DNS/LB re-route could have placed
  // the two phases on different backends.
  //
  // Safety mirrors `doExecute`:
  //   · same `ensureClient` + `configureSessionOnce` path
  //   · explicit `BEGIN TRANSACTION READ ONLY` + `SET LOCAL`
  //   · every statement passes `assertNoForbiddenKeyword`
  //   · only the hardcoded `FINGERPRINT_QUERIES` are sent
  //   · errors are classified as `FingerprintConnectionError` with
  //     sanitised message · no credential leak
  //   · rolls back on failure · does NOT close the Client (caller
  //     decides via `close()`)
  async function doObserveFingerprint(): Promise<ObservedFingerprint> {
    let c: Client;
    try {
      c = await ensureClient();
    } catch (err) {
      const sanitised = sanitiseErrorText(
        err instanceof Error ? err.message : String(err),
      );
      throw new FingerprintConnectionError(
        `pg-executor: cannot connect to target: ${sanitised}`,
      );
    }
    try {
      await configureSessionOnce(c);

      assertNoForbiddenKeyword("BEGIN TRANSACTION READ ONLY");
      await c.query("BEGIN TRANSACTION READ ONLY");
      assertNoForbiddenKeyword("SET LOCAL default_transaction_read_only = on");
      await c.query("SET LOCAL default_transaction_read_only = on");
      assertNoForbiddenKeyword(
        `SET LOCAL statement_timeout = ${config.statementTimeoutMs}`,
      );
      await c.query(
        `SET LOCAL statement_timeout = ${config.statementTimeoutMs}`,
      );

      assertNoForbiddenKeyword(FINGERPRINT_QUERIES.database);
      const dbResult = await c.query<{ db: string }>(
        FINGERPRINT_QUERIES.database,
      );
      assertNoForbiddenKeyword(FINGERPRINT_QUERIES.user);
      const userResult = await c.query<{ usr: string }>(
        FINGERPRINT_QUERIES.user,
      );
      assertNoForbiddenKeyword(FINGERPRINT_QUERIES.serverVersion);
      const versionResult = await c.query<{ srv_version: string }>(
        FINGERPRINT_QUERIES.serverVersion,
      );
      assertNoForbiddenKeyword(FINGERPRINT_QUERIES.schemas);
      const schemasResult = await c.query<{ schema_name: string }>(
        FINGERPRINT_QUERIES.schemas,
      );

      assertNoForbiddenKeyword("COMMIT");
      await c.query("COMMIT");

      return {
        database: dbResult.rows[0]?.db ?? "",
        user: userResult.rows[0]?.usr ?? "",
        serverVersion: versionResult.rows[0]?.srv_version ?? "",
        schemasPresent: schemasResult.rows.map((r) => r.schema_name),
      };
    } catch (err) {
      try {
        await c.query("ROLLBACK");
      } catch {
        /* intentional swallow · already in failure */
      }
      const sanitised = sanitiseErrorText(
        err instanceof Error ? err.message : String(err),
      );
      throw new FingerprintConnectionError(
        `pg-executor: fingerprint introspection failed: ${sanitised}`,
      );
    }
  }

  async function observeFingerprint(): Promise<ObservedFingerprint> {
    // Serialise through the α.1 single-flight chain so a fingerprint
    // call cannot race with a parallel execute() on the same Client.
    const next = chain.then(() => doObserveFingerprint());
    chain = next.catch(() => {});
    return next;
  }

  async function close(): Promise<void> {
    if (client === null) return;
    try {
      await client.end();
    } finally {
      client = null;
      sessionConfigured = false;
      // α.1 · reset chain so a close/reopen cycle on this instance begins
      // with a fresh serialisation state. Functionally harmless today ·
      // belt-and-braces for callers that reuse the executor after close().
      chain = Promise.resolve();
    }
  }

  return { execute, close, observeFingerprint };
}

// ═════════════════════════════════════════════════════════════════════
// §7 · Static safety invariants · module-level
// ═════════════════════════════════════════════════════════════════════
//
// Deliberately re-asserted at the bottom of the file for grep-ability:
//
// This module does NOT import identity-matching.ts, matchBusiness,
// nex.business_canonical write code, or any resolver surface. Grep
// this file for `identity-matching` or `matchBusiness` and both should
// return zero hits.
//
// This module writes nothing to disk. There is no `fs.writeFile` call,
// no `process.stdout.write` of query results, no serialization of
// candidates. Output is returned to the caller only.
//
// This module cannot be executed with `node pg-executor.ts` directly ·
// it exports functions but does not implement a module-entry runner.
// A separate authorised caller script is required to compose it with
// `generateCandidates()`.
