// src/lib/nex/config/production-guard.mjs
//
// Self-contained boot-time fail-closed guard for .mjs entry points that
// cannot import the TypeScript module `src/lib/nex/config/pg.ts` (the
// production workforce launcher/watchdog/supervisor run as plain node,
// no tsx compile step).
//
// Behavior mirrors `assertProductionPostgresUrl` in pg.ts:
//   · NODE_ENV !== "production" → no-op (dev/test allowed to run locally).
//   · production + missing NEX_POSTGRES_URL → throw with code
//     "missing-postgres-url-in-production".
//   · production + malformed URL → throw with code "invalid-postgres-url".
//   · production + URL that matches the local dev DB (localhost /
//     127.0.0.1 / :5433 / /nex_dev) → throw with code
//     "production-url-points-at-dev".
//
// Any URL that appears in an error message is redacted so a credential
// never leaks to console/log/CI output.
//
// Contract with pg.ts: the code strings emitted here MUST match the ones
// pg.test.mjs (CFG11) locks. If pg.ts adds a new fail-closed reason,
// mirror it here.

const ENV_NAME = "NEX_POSTGRES_URL";

function makeErr(code, msg) {
  const e = new Error(msg);
  e.code = code;
  return e;
}

function redactUrl(url) {
  return String(url).replace(/:[^:@/]+@/, ":****@");
}

function looksLikeDevUrl(url) {
  return /localhost|127\.0\.0\.1|:5433\b|\/nex_dev\b/.test(url);
}

/**
 * Throws a stable-coded error if this process is running in production
 * with a NEX_POSTGRES_URL that is missing, malformed, or pointed at the
 * local dev DB. No-op otherwise.
 *
 * @param {NodeJS.ProcessEnv} [env] override for tests · defaults to process.env
 */
export function assertProductionPostgresUrl(env) {
  const e = env ?? process.env;
  if (e.NODE_ENV !== "production") return;

  const raw = e[ENV_NAME];
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw makeErr(
      "missing-postgres-url-in-production",
      `[nex-config] ${ENV_NAME} is required in production · fail-closed by design`,
    );
  }
  const url = raw.trim();
  if (!/^postgres(ql)?:\/\//.test(url)) {
    throw makeErr(
      "invalid-postgres-url",
      `[nex-config] ${ENV_NAME} must start with postgres:// or postgresql://`,
    );
  }
  if (looksLikeDevUrl(url)) {
    throw makeErr(
      "production-url-points-at-dev",
      `[nex-config] ${ENV_NAME} points at a dev/local database in production · refusing to boot · url=${redactUrl(url)}`,
    );
  }
}

/**
 * Development helper · same shape but for scripts that also want to
 * enforce presence in dev (workforce scripts read .env.local and refuse
 * to boot without a URL). Returns the validated URL.
 *
 * @param {NodeJS.ProcessEnv} [env] override for tests · defaults to process.env
 * @returns {string}
 */
export function requirePostgresUrl(env) {
  const e = env ?? process.env;
  const raw = e[ENV_NAME];
  if (typeof raw !== "string" || raw.trim().length === 0) {
    if (e.NODE_ENV === "production") {
      throw makeErr(
        "missing-postgres-url-in-production",
        `[nex-config] ${ENV_NAME} is required in production · fail-closed by design`,
      );
    }
    throw makeErr(
      "missing-postgres-url",
      `[nex-config] ${ENV_NAME} is not set · set it in .env.local before starting this process`,
    );
  }
  const url = raw.trim();
  if (!/^postgres(ql)?:\/\//.test(url)) {
    throw makeErr(
      "invalid-postgres-url",
      `[nex-config] ${ENV_NAME} must start with postgres:// or postgresql://`,
    );
  }
  if (e.NODE_ENV === "production" && looksLikeDevUrl(url)) {
    throw makeErr(
      "production-url-points-at-dev",
      `[nex-config] ${ENV_NAME} points at a dev/local database in production · refusing to boot · url=${redactUrl(url)}`,
    );
  }
  return url;
}

export { redactUrl, looksLikeDevUrl };
