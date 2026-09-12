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
    | "invalid-postgres-url"
    | "production-url-points-at-dev";
};

function makeErr(code: PgConfigError["code"], msg: string): PgConfigError {
  const e = new Error(msg) as PgConfigError;
  e.code = code;
  return e;
}

// Dev-URL sentinel · rejected only when NODE_ENV=production.
// Matches: localhost · 127.0.0.1 · :5433 (the local dev PG17 port) · /nex_dev
// database. Intentionally NOT matched: :5432 (may be a valid prod pooler port)
// or Supabase pooler hostnames. The point is to catch the exact silent-fallback
// URL that the pre-Wave-11 code hardcoded.
function looksLikeDevUrl(url: string): boolean {
  return /localhost|127\.0\.0\.1|:5433\b|\/nex_dev\b/.test(url);
}

/**
 * Redact the password segment of a Postgres URL so it can safely appear in
 * error messages and logs. Never emit the raw URL — it always contains a
 * credential in production.
 */
function redactUrl(url: string): string {
  return url.replace(/:[^:@/]+@/, ":****@");
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
  // Production must never point at the local dev DB. This closes the exact
  // silent-fallback loop the pre-Wave-11 code opened (`?? "postgresql://…
  // localhost:5433/nex_dev"`). Dev/test/CI URLs pointing at localhost are
  // still allowed because NODE_ENV !== "production" there.
  if (isProduction(e) && looksLikeDevUrl(url)) {
    throw makeErr(
      "production-url-points-at-dev",
      `[nex-config] ${ENV_NAME} points at a dev/local database in production · refusing to boot · url=${redactUrl(url)}`,
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
 *   · NODE_ENV=production AND URL looks like the local dev DB
 *     (localhost/127.0.0.1/:5433/nex_dev) → throws
 *     `code="production-url-points-at-dev"`. Callers that "degrade
 *     gracefully" must still fail closed when the URL is present but
 *     dangerous — a silent connection to nex_dev in prod is exactly
 *     what this whole system is engineered to prevent.
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
  if (isProduction(e) && looksLikeDevUrl(url)) {
    throw makeErr(
      "production-url-points-at-dev",
      `[nex-config] ${ENV_NAME} points at a dev/local database in production · refusing to boot · url=${redactUrl(url)}`,
    );
  }
  return url;
}

/**
 * Boot-time fail-closed guard for the Next.js production process.
 *
 * · NODE_ENV !== "production" → no-op (dev/test may run against localhost).
 * · production + missing / malformed / localhost / nex_dev → throws with
 *   a stable `code` field so the deploy pipeline can grep for it.
 *
 * Intended for exactly ONE call at process boot (Next.js
 * `src/instrumentation.ts`). Downstream code keeps using `getPostgresUrl`
 * / `getPostgresUrlOrNull` and inherits the same tightening for free.
 */
export function assertProductionPostgresUrl(env?: EnvLike): void {
  const e = readEnv(env);
  if (!isProduction(e)) return;
  // getPostgresUrl re-runs the missing / malformed / dev-url checks. If
  // any of them fire, the PgConfigError propagates unchanged with its
  // stable .code · that's the intentional contract with the boot caller.
  getPostgresUrl(e);
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
