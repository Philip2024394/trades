// src/lib/nex/config/pg.ts
//
// Wave 11 · Step 11 · Group F · F28 remediation.
//
// SINGLE authoritative reader for NEX_POSTGRES_URL across the
// Headquarters surface. Every HQ site that used to do
// `process.env.NEX_POSTGRES_URL` for a connection now routes through
// this module so the following invariants hold:
//
//   1 · Reading the env var happens in ONE file.
//   2 · Production deploy with the env var unset FAILS CLOSED with a
//       clear code (`missing-postgres-url-in-production`) rather than
//       silently degrading (previous behavior: some callers threw,
//       some returned null, some fell back to a hardcoded local URL —
//       the exact "divergent behavior on missing var" F28 flagged).
//   3 · Dev/test callers may still degrade gracefully via the
//       `-OrNull` variant — the strict variant + prod-guard only
//       apply where the caller actively needs the URL.
//
// The drift-catcher `src/lib/nex/config/tests/adoption-drift.test.mjs`
// enforces that no HQ file outside a documented exception list reads
// the env var directly.
//
// Design choice · NO auto-fallback to `postgresql://…localhost:5433`.
// Previous scripts hardcoded that string as a dev default; that
// masked genuine misconfiguration. Callers who want a dev default
// must supply it explicitly at the call site (`getPostgresUrlOrNull()
// ?? "postgresql://localhost:5432/dev"`) so the intent is visible.

const ENV_NAME = "NEX_POSTGRES_URL";

export type PgConfigError = Error & {
  code:
    | "missing-postgres-url-in-production"
    | "missing-postgres-url"
    | "invalid-postgres-url";
};

function makeErr(code: PgConfigError["code"], msg: string): PgConfigError {
  const e = new Error(msg) as PgConfigError;
  e.code = code;
  return e;
}

// Injection point for tests · production callers pass no argument.
// Test files construct their own `env` map and call the helpers with
// it to prove behavior without polluting `process.env`.
type EnvLike = { NEX_POSTGRES_URL?: string; NODE_ENV?: string };

function readEnv(env?: EnvLike): EnvLike {
  return env ?? (process.env as EnvLike);
}

function isProduction(env: EnvLike): boolean {
  return env.NODE_ENV === "production";
}

function trimmedUrl(env: EnvLike): string | null {
  const raw = env.NEX_POSTGRES_URL;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  return trimmed;
}

/**
 * Returns the validated NEX_POSTGRES_URL or throws.
 *
 * Behavior:
 *   · `NODE_ENV=production` + unset/empty/whitespace-only → throws
 *      `PgConfigError` with `code="missing-postgres-url-in-production"`.
 *      This is the fail-closed signal for a misconfigured prod deploy.
 *   · `NODE_ENV` anything else + unset → throws
 *      `PgConfigError` with `code="missing-postgres-url"`.
 *      Dev/test callers who need degradation should use
 *      `getPostgresUrlOrNull()` instead.
 *   · URL present but not a valid `postgres://` / `postgresql://` URI
 *      → throws with `code="invalid-postgres-url"`.
 *
 * Use this in code paths that MUST have a working connection
 * (adapter constructors, migration scripts).
 */
export function getPostgresUrl(env?: EnvLike): string {
  const e = readEnv(env);
  const url = trimmedUrl(e);
  if (url === null) {
    if (isProduction(e)) {
      throw makeErr(
        "missing-postgres-url-in-production",
        `[nex-config] ${ENV_NAME} is required in production · fail-closed by design (F28)`,
      );
    }
    throw makeErr(
      "missing-postgres-url",
      `[nex-config] ${ENV_NAME} is not set · either set it in .env.local or use getPostgresUrlOrNull() at the call site`,
    );
  }
  // Minimal shape validation · pg driver does the full parse. This
  // just catches "PGURL=yes" or someone's shell alias.
  if (!/^postgres(ql)?:\/\//.test(url)) {
    throw makeErr(
      "invalid-postgres-url",
      `[nex-config] ${ENV_NAME} must start with postgres:// or postgresql:// · got: ${url.slice(0, 24)}…`,
    );
  }
  return url;
}

/**
 * Returns the validated NEX_POSTGRES_URL or `null` if unset.
 *
 * Behavior:
 *   · Unset / empty / whitespace-only → `null` (never throws).
 *   · URL present but malformed → throws `PgConfigError` with
 *     `code="invalid-postgres-url"` (a bad URL is a real bug worth
 *     surfacing even in the nullable variant).
 *
 * Use this in code paths that MAY degrade gracefully — the shared pool
 * factory (`src/lib/nex/db.ts::withClient`) is the canonical example:
 * without a URL it returns `null` and callers no-op instead of
 * crashing the whole process on cold-boot in a dev container.
 */
export function getPostgresUrlOrNull(env?: EnvLike): string | null {
  const e = readEnv(env);
  const url = trimmedUrl(e);
  if (url === null) return null;
  if (!/^postgres(ql)?:\/\//.test(url)) {
    throw makeErr(
      "invalid-postgres-url",
      `[nex-config] ${ENV_NAME} must start with postgres:// or postgresql:// · got: ${url.slice(0, 24)}…`,
    );
  }
  return url;
}

/**
 * Boolean helper · "is Postgres configured right now?" without the
 * cost of validation error paths. Equivalent to
 * `getPostgresUrlOrNull() !== null` but doesn't throw on malformed
 * URLs · returns `false` instead (backend selection should never
 * throw · it should just pick a different backend).
 */
export function hasPostgresUrl(env?: EnvLike): boolean {
  const e = readEnv(env);
  const url = trimmedUrl(e);
  if (url === null) return false;
  return /^postgres(ql)?:\/\//.test(url);
}
