// scripts/nex-canonical/first-live-write-runner.ts
//
// NEX Canonical · Thin runner for the sealed first-live-write
// orchestrator. ONE-SHOT per process.
//
// WHAT THIS RUNNER DOES
//   · Checks the required NEX_CANONICAL_PG_* env vars (REQUIRED_WRITE_ENV_VARS).
//   · Builds the non-secret preflight summary and prints it.
//   · Parses the expected fingerprint from env (database/user/server_version/schemas).
//   · Builds the synthetic first-live-write plan (pure).
//   · Opens pg write + read sessions via the sealed adapters.
//   · Invokes runFirstLiveCanonicalWrite().
//   · Prints the sanitised write + readback reports.
//
// WHAT THIS RUNNER DOES NOT DO
//   · Does NOT persist anything to disk (no JSONL log · a separate wave).
//   · Does NOT invent env values. If the required vars are missing, it
//     exits with code 1 before opening any connection.
//   · Does NOT inject founder approval. The approval is already baked
//     into the sealed synthetic candidate fixture.
//   · Does NOT log credentials. All error paths pass through sanitiseErr.
//   · Does NOT bypass the fingerprint check. The EXPECTED_* env vars
//     must be set explicitly by the operator to prove intent before any
//     write touches a database.
//   · Does NOT auto-run on import · main() runs only when executed as
//     a script.
//
// LOCAL-DEV CONVENIENCE
//   For local development the Next.js app connects to canonical PG via
//   a single URL env var `NEX_POSTGRES_URL` (handled by src/lib/nex/db.ts).
//   If the split-credential NEX_CANONICAL_PG_* vars are unset but
//   NEX_POSTGRES_URL is set, this runner derives the split credentials
//   from the URL. It does NOT derive the EXPECTED_* oracle values ·
//   those must be set explicitly to prove the operator knows which
//   database they are writing into.
//
// EXIT CODES
//   0  · one canonical row + one evidence row written and read back OK
//   1  · env gate refused (missing required vars)
//   2  · orchestrator abstained (write or readback did not complete)
//  99  · unexpected error (sanitised)

import {
  createPgWriteSessionFactory,
  parsePgWriteAdapterConfigFromEnv,
} from "./pg-write-adapter";
import {
  createPgReadSessionFactory,
  parsePgReadAdapterConfigFromEnv,
} from "./pg-read-adapter";
import { parseFingerprintExpectationsFromEnv } from "./pg-fingerprint";
import {
  buildPreflightSummary,
  buildSyntheticFirstWritePlan,
  checkRequiredEnvVars,
  runFirstLiveCanonicalWrite,
} from "./first-live-write";
import { isAbstained } from "./intelligence-result";

/** Minimal credential-safe redactor for diagnostic strings. Belt-and-braces ·
 *  the pg driver rarely echoes credentials but this runner's logs could
 *  surface a stray URL fragment. Mirrors the sanitiser in
 *  src/lib/nex-native/directory/directory-service.ts. */
function sanitiseErr(message: string): string {
  let out = message;
  out = out.replace(
    /postgres(?:ql)?:\/\/[^:]*:[^@]*@[^\s'"]+/gi,
    "postgres://[redacted]",
  );
  out = out.replace(/password\s*=\s*['"][^'"]*['"]/gi, "password=[redacted]");
  out = out.replace(/password\s*=\s*\S+/gi, "password=[redacted]");
  return out;
}

/** Local-dev convenience: derive split NEX_CANONICAL_PG_* credential
 *  env vars from NEX_POSTGRES_URL when the split form is unset. Does
 *  NOT derive the EXPECTED_* oracle values · those must be set
 *  explicitly by the operator. */
function deriveSplitCredsFromUrlIfNeeded(env: NodeJS.ProcessEnv): void {
  if (env.NEX_CANONICAL_PG_HOST) return;
  const url = env.NEX_POSTGRES_URL;
  if (!url) return;
  try {
    const u = new URL(url);
    env.NEX_CANONICAL_PG_HOST = u.hostname;
    if (u.port) env.NEX_CANONICAL_PG_PORT = u.port;
    const db = u.pathname.replace(/^\//, "");
    if (db.length > 0) env.NEX_CANONICAL_PG_DATABASE = db;
    if (u.username.length > 0) {
      env.NEX_CANONICAL_PG_USER = decodeURIComponent(u.username);
    }
    if (u.password.length > 0) {
      env.NEX_CANONICAL_PG_PASSWORD = decodeURIComponent(u.password);
    }
    // Local dev typically no SSL · operator sets explicitly if needed.
    if (!env.NEX_CANONICAL_PG_SSL) env.NEX_CANONICAL_PG_SSL = "false";
  } catch {
    // Malformed URL · adapter config parsing will fail-closed below.
  }
}

async function main(): Promise<number> {
  deriveSplitCredsFromUrlIfNeeded(process.env);

  // ─── §1 · env gate · must have all required vars before we connect ──
  const gate = checkRequiredEnvVars(process.env);
  console.log("=== first-live-write-runner ===");
  console.log(
    "required env vars present : " +
      (gate.ok ? "YES" : `NO · missing: ${gate.missing.join(", ")}`),
  );
  if (!gate.ok) {
    console.error("ABORT · required env vars missing · no connection opened");
    return 1;
  }

  // ─── §2 · preflight summary (never prints credentials) ─────────────
  const summary = buildPreflightSummary(process.env);
  console.log("preflight summary:");
  console.log(JSON.stringify(summary, null, 2));

  // ─── §3 · expected fingerprint oracle ──────────────────────────────
  const expected = parseFingerprintExpectationsFromEnv(process.env);

  // ─── §4 · build the synthetic plan (pure) ──────────────────────────
  const ctx = buildSyntheticFirstWritePlan();
  console.log("plan built:");
  console.log("  kind                : " + ctx.plan.kind);
  console.log(
    "  decision_record_id  : " + ctx.decisionRecord.decision_record_id,
  );
  console.log("  review_package_id   : " + ctx.reviewPackage.package_id);
  console.log(
    "  candidate_id        : " + ctx.candidate.candidate_id,
  );
  console.log(
    "  candidate_name      : " + ctx.candidate.identity.name_canonical,
  );

  // ─── §5 · open pg session factories ────────────────────────────────
  const writeFactory = createPgWriteSessionFactory(
    parsePgWriteAdapterConfigFromEnv(process.env),
  );
  const readFactory = createPgReadSessionFactory(
    parsePgReadAdapterConfigFromEnv(process.env),
  );

  // ─── §6 · run the one-shot orchestrator ────────────────────────────
  console.log("running runFirstLiveCanonicalWrite ...");
  const result = await runFirstLiveCanonicalWrite({
    plan: ctx.plan,
    write_session_factory: writeFactory,
    readback_session_factory: readFactory,
    expected_fingerprint: expected,
  });

  if (isAbstained(result)) {
    console.error(
      "ABSTAINED · code=" +
        result.reason.code +
        " · " +
        sanitiseErr(result.reason.message),
    );
    console.error(
      "details : " + JSON.stringify(result.reason.details ?? {}, null, 2),
    );
    return 2;
  }

  console.log("ANSWERED:");
  console.log(JSON.stringify(result.value, null, 2));
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(
      "UNEXPECTED ERROR · " +
        sanitiseErr(err instanceof Error ? err.message : String(err)),
    );
    process.exit(99);
  });
