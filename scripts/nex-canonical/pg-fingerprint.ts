// scripts/nex-canonical/pg-fingerprint.ts
//
// NEX Business Canonical · Target-Fingerprint Verification · β §2
//
// Confirms that the live PostgreSQL connection resolves to the intended
// legacy NEX database BEFORE any `QUERY_SPECS` entry is executed. If the
// observed identity does not match the expected fingerprint along every
// required dimension, this module throws a fail-closed error and the
// β runner must STOP before touching any candidate-generation path.
//
// Four MANDATORY expected-fingerprint fields (all from runtime env):
//   · NEX_CANONICAL_PG_EXPECTED_DATABASE                → exact-match current_database()
//   · NEX_CANONICAL_PG_EXPECTED_USER                    → exact-match current_user
//   · NEX_CANONICAL_PG_EXPECTED_SERVER_VERSION_PREFIX   → prefix-match server_version
//   · NEX_CANONICAL_PG_EXPECTED_SCHEMAS                 → every schema must exist in
//                                                         information_schema.schemata
//
// SCOPE BOUNDARY
//   This module is PURE after α.2 (2026-10-08): types + env parsing +
//   comparison logic + hardcoded `FINGERPRINT_QUERIES` string constants
//   + error classes. It has ZERO runtime imports and does NOT open a
//   PostgreSQL connection. The live fingerprint path lives in
//   `pg-executor.ts` as `observeFingerprint()`, which binds to the
//   SAME Client that subsequent `execute()` calls use.
//
// SAFETY POSTURE
//   · Four distinct error classes so the β runner can distinguish the
//     failure category: credential-config vs fingerprint-config vs
//     connection-level vs mismatch. Credential-config failures (missing
//     NEX_CANONICAL_PG_*) throw `PgExecutorConfigError` from pg-executor,
//     NOT the classes defined here.
//   · All four introspection statements are hardcoded module-level
//     constants frozen with `Object.freeze`. No interpolation. No input
//     string reaches SQL rendering.
//   · This module does NOT import from the resolver surface
//     (`identity-matching`, `entity-universe`), does NOT read or write
//     the filesystem, does NOT open any network connection, and does
//     NOT import from `./pg-executor`.

// ═════════════════════════════════════════════════════════════════════
// §1 · Expected-fingerprint config · env-only · fail-closed
// ═════════════════════════════════════════════════════════════════════
//
// α.2 2026-10-08. This module is PURE: types + env parsing + comparison
// + hardcoded FINGERPRINT_QUERIES + error classes. The live-connection
// path lives in `pg-executor.ts` as the `observeFingerprint()` method
// of the single executor Client, closing the TOCTOU gap identified in
// the final-review wave. The previous two-connection functions
// `observeFingerprintLive` and `verifyFingerprintOrStop` have been
// REMOVED to prevent accidental reuse of the two-connection path.

export interface FingerprintExpectations {
  /** Must EXACTLY equal `current_database()` on the live connection. */
  database: string;
  /** Must EXACTLY equal `current_user` on the live connection. */
  user: string;
  /** Must be a PREFIX of `current_setting('server_version')`. */
  serverVersionPrefix: string;
  /** Every entry must appear in `information_schema.schemata`. */
  schemas: readonly string[];
}

/**
 * Thrown when any of the four REQUIRED fingerprint env vars is
 * absent/empty or malformed. Distinct from `PgExecutorConfigError`
 * (which is thrown for missing base credentials). The β runner uses
 * the class name to tell "I don't know what to expect" from
 * "I don't have credentials" from "I'm looking at the wrong DB".
 */
export class FingerprintConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FingerprintConfigError";
  }
}

/**
 * Parse the four REQUIRED fingerprint env vars. All four are mandatory.
 * Error messages name the env var but never echo any value from a
 * sibling env var.
 */
export function parseFingerprintExpectationsFromEnv(
  env: NodeJS.ProcessEnv,
): FingerprintExpectations {
  const required = (name: string): string => {
    const raw = env[name];
    if (typeof raw !== "string" || raw.length === 0) {
      throw new FingerprintConfigError(
        `missing required fingerprint env var: ${name}`,
      );
    }
    return raw;
  };
  const database = required("NEX_CANONICAL_PG_EXPECTED_DATABASE");
  const user = required("NEX_CANONICAL_PG_EXPECTED_USER");
  const serverVersionPrefix = required(
    "NEX_CANONICAL_PG_EXPECTED_SERVER_VERSION_PREFIX",
  );
  const schemasRaw = required("NEX_CANONICAL_PG_EXPECTED_SCHEMAS");
  const schemas = parseSchemasList(schemasRaw);
  if (schemas.length === 0) {
    throw new FingerprintConfigError(
      `NEX_CANONICAL_PG_EXPECTED_SCHEMAS parsed to zero schemas`,
    );
  }
  return { database, user, serverVersionPrefix, schemas };
}

/**
 * Pure · parses a comma-separated schema list. Trims whitespace, drops
 * empty entries, rejects schema names that aren't `[A-Za-z0-9_]+`.
 *
 * We deliberately reject punctuation and whitespace in schema names so
 * the schema-existence check does not surface a comparison surprise
 * (e.g. a user providing `"nex,"` or `"nex public"`).
 */
export function parseSchemasList(raw: string): readonly string[] {
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const p of parts) {
    if (!/^[A-Za-z0-9_]+$/.test(p)) {
      throw new FingerprintConfigError(
        `expected-schema name "${p}" contains invalid characters · allowed: [A-Za-z0-9_]`,
      );
    }
  }
  return parts;
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Live-observed fingerprint
// ═════════════════════════════════════════════════════════════════════

export interface ObservedFingerprint {
  database: string;
  user: string;
  serverVersion: string;
  schemasPresent: readonly string[];
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Pure comparison
// ═════════════════════════════════════════════════════════════════════

export interface FingerprintComparison {
  readonly ok: boolean;
  readonly mismatches: readonly string[];
}

/**
 * Pure comparison. Collects every mismatch (does not short-circuit) so
 * the β runner can report ALL problems in one go.
 */
export function compareFingerprint(
  observed: ObservedFingerprint,
  expected: FingerprintExpectations,
): FingerprintComparison {
  const mismatches: string[] = [];
  if (observed.database !== expected.database) {
    mismatches.push(
      `database: observed="${observed.database}" expected="${expected.database}"`,
    );
  }
  if (observed.user !== expected.user) {
    mismatches.push(
      `user: observed="${observed.user}" expected="${expected.user}"`,
    );
  }
  if (!observed.serverVersion.startsWith(expected.serverVersionPrefix)) {
    mismatches.push(
      `server_version: observed="${observed.serverVersion}" expected-prefix="${expected.serverVersionPrefix}"`,
    );
  }
  const missing = expected.schemas.filter(
    (s) => !observed.schemasPresent.includes(s),
  );
  if (missing.length > 0) {
    mismatches.push(
      `missing schemas: ${missing.map((s) => `"${s}"`).join(", ")}`,
    );
  }
  return { ok: mismatches.length === 0, mismatches };
}

/**
 * Thrown when the live connection resolves but the observed identity
 * does not match the expected fingerprint. Carries the full mismatch
 * list so the β runner can report every discrepancy.
 */
export class FingerprintMismatchError extends Error {
  readonly mismatches: readonly string[];
  constructor(mismatches: readonly string[]) {
    super(
      `pg-fingerprint STOP: target identity does not match the expected ` +
        `fingerprint. Mismatches: ${mismatches.join(" | ")}`,
    );
    this.name = "FingerprintMismatchError";
    this.mismatches = mismatches;
  }
}

/**
 * Thrown when the connection itself cannot be made or the introspection
 * queries fail (e.g. authentication rejected, host unreachable,
 * read-only session rejected an introspection query). Distinct from
 * `FingerprintMismatchError` so the β runner can categorise.
 */
export class FingerprintConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FingerprintConnectionError";
  }
}

// ═════════════════════════════════════════════════════════════════════
// §4 · Live introspection · hardcoded queries · not invoked in this wave
// ═════════════════════════════════════════════════════════════════════

/**
 * The four read-only PostgreSQL introspection statements the fingerprint
 * check runs. Hardcoded module-level constants · no interpolation · no
 * attacker-adjacent surface. Each is denylist-scanned at run time as
 * defence in depth.
 */
export const FINGERPRINT_QUERIES = Object.freeze({
  database: "SELECT current_database() AS db",
  user: "SELECT current_user AS usr",
  serverVersion: "SELECT current_setting('server_version') AS srv_version",
  schemas:
    "SELECT schema_name FROM information_schema.schemata ORDER BY schema_name",
} as const);

// ═════════════════════════════════════════════════════════════════════
// §5 · Static invariants · module-level
// ═════════════════════════════════════════════════════════════════════
//
// Deliberately re-asserted at the bottom of this file for grep-ability:
//
// This module is PURE: types, env parsing, comparison, hardcoded
// FINGERPRINT_QUERIES constants, and error classes. It has NO
// runtime imports · no `pg` Client · no filesystem · no network.
//
// This module does NOT import `identity-matching.ts`, `matchBusiness`,
// `nex.business_canonical` write code, or any resolver surface.
//
// This module writes NOTHING to disk · there is no `fs.writeFile`,
// `fs.appendFile`, `createWriteStream`, or `process.stdout.write` of
// query results.
//
// This module does NOT open any PostgreSQL connection. The live
// fingerprint path lives in `pg-executor.ts` as the
// `observeFingerprint()` method, which binds to the SAME Client that
// subsequent `execute()` calls use. The two-connection functions
// `observeFingerprintLive` and `verifyFingerprintOrStop` have been
// REMOVED in α.2 and must not be reintroduced.
//
// This module cannot be executed with `node pg-fingerprint.ts` directly;
// it exports functions but does not implement a module entry runner.
