// production-guard.test.mjs · contract tests for the self-contained
// .mjs boot guard used by the workforce launcher/watchdog/supervisor.
//
// Mirrors CFG12/CFG13 in pg.test.mjs so the two guards can never drift.

import { test } from "node:test";
import assert from "node:assert/strict";
import { assertProductionPostgresUrl, requirePostgresUrl, redactUrl, looksLikeDevUrl } from "../production-guard.mjs";

const PROD_URL = "postgresql://postgres.abcdef:secret@aws-0-eu-west-1.pooler.supabase.com:5432/postgres";
const DEV_URL  = "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";

test("assertProductionPostgresUrl is a no-op in dev/test/undefined", () => {
  assertProductionPostgresUrl({ NODE_ENV: "development" });
  assertProductionPostgresUrl({ NODE_ENV: "test" });
  assertProductionPostgresUrl({});
});

test("assertProductionPostgresUrl throws in production when NEX_POSTGRES_URL is missing", () => {
  try {
    assertProductionPostgresUrl({ NODE_ENV: "production" });
    assert.fail("expected throw");
  } catch (err) { assert.equal(err.code, "missing-postgres-url-in-production"); }

  try {
    assertProductionPostgresUrl({ NODE_ENV: "production", NEX_POSTGRES_URL: "   " });
    assert.fail("whitespace-only must be treated as unset");
  } catch (err) { assert.equal(err.code, "missing-postgres-url-in-production"); }
});

test("assertProductionPostgresUrl throws in production on malformed URL", () => {
  try {
    assertProductionPostgresUrl({ NODE_ENV: "production", NEX_POSTGRES_URL: "yes" });
    assert.fail("expected throw");
  } catch (err) { assert.equal(err.code, "invalid-postgres-url"); }
});

test("assertProductionPostgresUrl throws in production on any dev-looking URL", () => {
  for (const url of [
    "postgresql://postgres:pw@localhost:5432/appdb",
    "postgresql://postgres:pw@127.0.0.1:5432/appdb",
    "postgresql://postgres:pw@somewhere:5433/appdb",
    "postgresql://postgres:pw@remote-host:5432/nex_dev",
  ]) {
    try {
      assertProductionPostgresUrl({ NODE_ENV: "production", NEX_POSTGRES_URL: url });
      assert.fail(`expected throw for ${url}`);
    } catch (err) {
      assert.equal(err.code, "production-url-points-at-dev", `${url} → code=${err.code}`);
      assert.doesNotMatch(err.message, /:pw@/, "password must be redacted in error message");
    }
  }
});

test("assertProductionPostgresUrl PASSES for a real prod URL", () => {
  assertProductionPostgresUrl({ NODE_ENV: "production", NEX_POSTGRES_URL: PROD_URL });
});

test("requirePostgresUrl returns URL in dev when set", () => {
  assert.equal(requirePostgresUrl({ NODE_ENV: "development", NEX_POSTGRES_URL: DEV_URL }), DEV_URL);
  assert.equal(requirePostgresUrl({ NODE_ENV: "production", NEX_POSTGRES_URL: PROD_URL }), PROD_URL);
});

test("requirePostgresUrl throws code=missing-postgres-url in dev when unset", () => {
  try {
    requirePostgresUrl({ NODE_ENV: "development" });
    assert.fail("expected throw");
  } catch (err) { assert.equal(err.code, "missing-postgres-url"); }
});

test("requirePostgresUrl fails closed in production on all four bad states", () => {
  try { requirePostgresUrl({ NODE_ENV: "production" }); assert.fail(); }
  catch (err) { assert.equal(err.code, "missing-postgres-url-in-production"); }

  try { requirePostgresUrl({ NODE_ENV: "production", NEX_POSTGRES_URL: "  " }); assert.fail(); }
  catch (err) { assert.equal(err.code, "missing-postgres-url-in-production"); }

  try { requirePostgresUrl({ NODE_ENV: "production", NEX_POSTGRES_URL: "bad" }); assert.fail(); }
  catch (err) { assert.equal(err.code, "invalid-postgres-url"); }

  try { requirePostgresUrl({ NODE_ENV: "production", NEX_POSTGRES_URL: DEV_URL }); assert.fail(); }
  catch (err) { assert.equal(err.code, "production-url-points-at-dev"); }
});

test("redactUrl strips the password segment", () => {
  assert.equal(
    redactUrl("postgresql://postgres:supersecret@host:5432/db"),
    "postgresql://postgres:****@host:5432/db",
  );
  // URL without a password is unchanged.
  assert.equal(redactUrl("postgresql://host:5432/db"), "postgresql://host:5432/db");
});

test("looksLikeDevUrl detects the four exact patterns", () => {
  assert.equal(looksLikeDevUrl("postgresql://postgres:x@localhost:5432/db"), true);
  assert.equal(looksLikeDevUrl("postgresql://postgres:x@127.0.0.1:5432/db"), true);
  assert.equal(looksLikeDevUrl("postgresql://postgres:x@host:5433/db"),     true);
  assert.equal(looksLikeDevUrl("postgresql://postgres:x@host:5432/nex_dev"), true);
  // Non-dev URL passes.
  assert.equal(looksLikeDevUrl(PROD_URL), false);
});
