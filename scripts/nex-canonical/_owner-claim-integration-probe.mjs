// scripts/nex-canonical/_owner-claim-integration-probe.mjs
//
// NEX Directory · Owner Claim · DB-level integration probe.
//
// Authored by Agent B (end-to-end proof) · 2026-10-10.
//
// WHAT THIS SCRIPT IS
//   A thin CLI around the sealed owner-claim services. It writes draft
//   rows + claim rows into local `nex_dev` so Playwright specs can
//   drive the UI against real DB state (and verify DB transitions after
//   each UI step). Every write is session-identity-gated to `nex_dev`.
//
// WHAT THIS SCRIPT IS NOT
//   · Not a UI test runner. Playwright owns that.
//   · Not a seed for production data. Every row this script writes
//     uses the "e2e-probe:" fingerprint prefix so cleanup can target
//     only its own rows (never a real owner draft).
//   · Not a bypass of the sealed `createClaim` service. The
//     `--seed-claim-with-code` command calls the real
//     `createClaim` function with a known plaintext input obtained
//     by injecting a stub into `node:crypto.randomInt` BEFORE
//     requiring the service, so the sealed hashing path still runs
//     and the DB row is identical in shape to a production claim.
//     The only non-production part is the deterministic 6-digit code.
//
// COMMANDS
//   --seed-draft <canonical_id> [--fingerprint <fp>]
//       Insert a `nex.business_claim_draft` row at status=draft with a
//       minimal food-kind draft. Returns {ok, draft_fingerprint}.
//
//   --seed-contact <canonical_id> --fingerprint <fp> --email <addr>
//       Transition the draft to status=contact_pending with email channel.
//
//   --seed-claim-with-code <canonical_id> --fingerprint <fp> --code <6digits>
//       Call sealed createClaim with a deterministic plaintext code
//       and flip the draft to code_requested. Prints {claim_id, code}.
//
//   --check-draft-status <canonical_id> --fingerprint <fp>
//       Print the current status row as JSON.
//
//   --check-canonical-lifecycle <canonical_id>
//       Print lifecycle_state as JSON.
//
//   --cleanup <canonical_id> [--fingerprint <fp>]
//       Delete the test draft + any PENDING/VERIFIED test claim rows
//       for this canonical (gated to the e2e-probe fingerprint).
//       If --fingerprint is omitted, cleans ALL rows whose fingerprint
//       starts with "e2e-probe:" for this canonical.
//
//   --restore-canonical-lifecycle <canonical_id> --state <STATE>
//       Flip canonical lifecycle_state back (used after a verified
//       claim test to restore the original). Only accepts the sealed
//       lifecycle names.
//
// EXIT
//   0 · ok (JSON printed on stdout)
//   1 · identity gate failed OR missing args OR DB error
//
// SAFETY
//   · Session identity check runs before any write. We refuse any db
//     other than `nex_dev`.
//   · The only canonical we touch via UPDATE is the one explicitly
//     passed in. The only lifecycle flip we ever do is caused by the
//     sealed verifyClaim path through createClaim; we never DIRECTLY
//     write to nex.business_canonical except via --restore-...

import "node:process";
import pg from "pg";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const TEST_FP_PREFIX = "e2e-probe:";

function log(obj) {
  // One-line JSON is the sealed stdout contract so Playwright can parse.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(obj));
}

function fail(reason, detail) {
  log({ ok: false, reason, detail: detail ?? null });
  process.exit(1);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

function getConn() {
  const url =
    process.env.NEX_CANONICAL_PG_URL
    ?? process.env.NEX_POSTGRES_URL
    ?? process.env.DATABASE_URL;
  if (!url) fail("db_url_missing");
  return url;
}

async function identityGate(client) {
  const r = await client.query(
    "SELECT current_database() AS db, current_user AS usr",
  );
  const db = r.rows[0].db;
  if (db !== "nex_dev") {
    fail("identity_gate_failed", `expected nex_dev got ${db}`);
  }
  return { db, user: r.rows[0].usr };
}

function requireUuid(id, label) {
  if (
    typeof id !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    fail("invalid_uuid", `${label}: ${id}`);
  }
}

function makeFingerprint(suffix) {
  // The sealed CHECK enforces 8..128 chars. "e2e-probe:" is 10 chars so
  // we always clear the floor. The suffix is a UUID or caller-provided.
  return `${TEST_FP_PREFIX}${suffix}`;
}

function assertTestFingerprint(fp) {
  if (typeof fp !== "string" || !fp.startsWith(TEST_FP_PREFIX)) {
    fail(
      "unsafe_fingerprint",
      "Probe refuses to touch rows outside the e2e-probe: namespace.",
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// Draft shape used by --seed-draft (minimal food kind)
// ─────────────────────────────────────────────────────────────────────

const MINIMAL_FOOD_DRAFT = {
  kind: "food",
  cuisines: ["Indonesian"],
  dietary: [],
  menuSections: [],
  openingHours: [
    { day: 1, open: "08:00", close: "20:00", closed: false },
    { day: 2, open: "08:00", close: "20:00", closed: false },
    { day: 3, open: "08:00", close: "20:00", closed: false },
    { day: 4, open: "08:00", close: "20:00", closed: false },
    { day: 5, open: "08:00", close: "20:00", closed: false },
    { day: 6, open: "08:00", close: "20:00", closed: false },
    { day: 7, open: "", close: "", closed: true },
  ],
  description: "Probe-authored seed draft for e2e verification.",
};

// ─────────────────────────────────────────────────────────────────────
// Command handlers
// ─────────────────────────────────────────────────────────────────────

async function cmdSeedDraft(args) {
  const canonicalId = args._[0];
  requireUuid(canonicalId, "canonical_id");
  const fingerprint = args.fingerprint ?? makeFingerprint(cryptoUuid());
  assertTestFingerprint(fingerprint);

  const client = new pg.Client({ connectionString: getConn() });
  await client.connect();
  try {
    await identityGate(client);
    // Canonical must exist.
    const chk = await client.query(
      "SELECT lifecycle_state FROM nex.business_canonical WHERE canonical_business_id = $1",
      [canonicalId],
    );
    if (chk.rowCount !== 1) fail("canonical_not_found", canonicalId);
    const lifecycle = chk.rows[0].lifecycle_state;

    await client.query(
      `INSERT INTO nex.business_claim_draft
         (canonical_business_id, draft_fingerprint, draft_json, status)
       VALUES ($1, $2, $3::jsonb, 'draft')
       ON CONFLICT (canonical_business_id, draft_fingerprint) DO UPDATE
         SET draft_json = EXCLUDED.draft_json,
             status = 'draft',
             last_touched_at = now()`,
      [canonicalId, fingerprint, JSON.stringify(MINIMAL_FOOD_DRAFT)],
    );
    log({
      ok: true,
      canonical_business_id: canonicalId,
      draft_fingerprint: fingerprint,
      status: "draft",
      lifecycle_state: lifecycle,
    });
  } finally {
    await client.end();
  }
}

async function cmdSeedContact(args) {
  const canonicalId = args._[0];
  requireUuid(canonicalId, "canonical_id");
  const fingerprint = args.fingerprint;
  const email = args.email;
  if (typeof fingerprint !== "string") fail("missing_arg", "--fingerprint");
  if (typeof email !== "string" || email.length < 3) fail("missing_arg", "--email");
  assertTestFingerprint(fingerprint);

  const client = new pg.Client({ connectionString: getConn() });
  await client.connect();
  try {
    await identityGate(client);
    const r = await client.query(
      `UPDATE nex.business_claim_draft
          SET contact_channel = 'email',
              contact_destination = $3,
              status = 'contact_pending',
              last_touched_at = now()
        WHERE canonical_business_id = $1
          AND draft_fingerprint     = $2`,
      [canonicalId, fingerprint, email],
    );
    if (r.rowCount === 0) fail("draft_not_found", `${canonicalId}/${fingerprint}`);
    log({
      ok: true,
      canonical_business_id: canonicalId,
      draft_fingerprint: fingerprint,
      status: "contact_pending",
    });
  } finally {
    await client.end();
  }
}

async function cmdSeedClaimWithCode(args) {
  const canonicalId = args._[0];
  requireUuid(canonicalId, "canonical_id");
  const fingerprint = args.fingerprint;
  const code = args.code;
  if (typeof fingerprint !== "string") fail("missing_arg", "--fingerprint");
  if (typeof code !== "string" || !/^[0-9]{6}$/.test(code)) {
    fail("missing_arg", "--code must be 6 digits");
  }
  assertTestFingerprint(fingerprint);

  // Stub node:crypto.randomInt so sealed createClaim mints the known code.
  // We require claim-service AFTER the stub is in place so the module
  // captures the stubbed randomInt reference. (If the service already
  // destructured the symbol at import time this won't help · in that
  // case the generator is non-replaceable and the test should fall back
  // to seeding the hash directly via the sealed service's shape.)
  const digits = code.split("").map((c) => Number(c));
  let idx = 0;
  const crypto = require("node:crypto");
  const originalRandomInt = crypto.randomInt;
  crypto.randomInt = (minOrMax, maybeMax) => {
    // The sealed generateClaimCode calls randomInt(0, 10) six times.
    // We replay our deterministic digits in order; after six, fall back.
    if (minOrMax === 0 && maybeMax === 10 && idx < digits.length) {
      return digits[idx++];
    }
    return originalRandomInt(minOrMax, maybeMax);
  };

  // Register tsx loader so we can require the TS source directly.
  try {
    require("tsx/cjs");
  } catch (e) {
    fail("tsx_loader_missing", e instanceof Error ? e.message : String(e));
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const svcPath = require.resolve(
    "../../src/lib/nex-native/claims/claim-service.ts",
  );
  const svc = require(svcPath);

  const conn = getConn();
  // Session identity check via a short-lived client before the sealed
  // service makes its own connection.
  const probeClient = new pg.Client({ connectionString: conn });
  await probeClient.connect();
  try {
    await identityGate(probeClient);
  } finally {
    await probeClient.end();
  }

  try {
    const create = await svc.createClaim({
      canonical_business_id: canonicalId,
      claim_channel: "email",
      destination: args.email || "e2e-probe@nex-directory.test",
      requested_by: fingerprint,
      connectionString: conn,
    });
    if (!create.ok) {
      fail("createClaim_failed", `${create.reason}:${create.detail ?? ""}`);
    }
    // Flip draft to code_requested so verifyClaimCodeAction sees the
    // expected status.
    const client = new pg.Client({ connectionString: conn });
    await client.connect();
    try {
      const r = await client.query(
        `UPDATE nex.business_claim_draft
            SET status = 'code_requested',
                last_touched_at = now()
          WHERE canonical_business_id = $1
            AND draft_fingerprint     = $2`,
        [canonicalId, fingerprint],
      );
      if (r.rowCount === 0) {
        fail("draft_not_found_for_transition", `${canonicalId}/${fingerprint}`);
      }
    } finally {
      await client.end();
    }
    log({
      ok: true,
      canonical_business_id: canonicalId,
      draft_fingerprint: fingerprint,
      claim_id: create.claim_id,
      plaintext_code: create.plaintext_code,
      expected_code: code,
      codes_match: create.plaintext_code === code,
      expires_at: create.expires_at,
    });
  } finally {
    crypto.randomInt = originalRandomInt;
  }
}

async function cmdCheckDraftStatus(args) {
  const canonicalId = args._[0];
  requireUuid(canonicalId, "canonical_id");
  const fingerprint = args.fingerprint;
  if (typeof fingerprint !== "string") fail("missing_arg", "--fingerprint");

  const client = new pg.Client({ connectionString: getConn() });
  await client.connect();
  try {
    await identityGate(client);
    const r = await client.query(
      `SELECT draft_id, canonical_business_id, draft_fingerprint,
              status, status_reason, contact_channel, contact_destination,
              created_at, last_touched_at, expires_at
         FROM nex.business_claim_draft
        WHERE canonical_business_id = $1
          AND draft_fingerprint     = $2`,
      [canonicalId, fingerprint],
    );
    if (r.rowCount === 0) {
      log({ ok: true, found: false });
      return;
    }
    const row = r.rows[0];
    log({
      ok: true,
      found: true,
      draft_id: row.draft_id,
      canonical_business_id: row.canonical_business_id,
      draft_fingerprint: row.draft_fingerprint,
      status: row.status,
      status_reason: row.status_reason,
      contact_channel: row.contact_channel,
      contact_destination: row.contact_destination,
      created_at: row.created_at,
      last_touched_at: row.last_touched_at,
      expires_at: row.expires_at,
    });
  } finally {
    await client.end();
  }
}

async function cmdCheckCanonicalLifecycle(args) {
  const canonicalId = args._[0];
  requireUuid(canonicalId, "canonical_id");

  const client = new pg.Client({ connectionString: getConn() });
  await client.connect();
  try {
    await identityGate(client);
    const r = await client.query(
      `SELECT lifecycle_state, name_canonical
         FROM nex.business_canonical
        WHERE canonical_business_id = $1`,
      [canonicalId],
    );
    if (r.rowCount === 0) fail("canonical_not_found", canonicalId);
    log({
      ok: true,
      canonical_business_id: canonicalId,
      lifecycle_state: r.rows[0].lifecycle_state,
      name_canonical: r.rows[0].name_canonical,
    });
  } finally {
    await client.end();
  }
}

async function cmdCleanup(args) {
  const canonicalId = args._[0];
  requireUuid(canonicalId, "canonical_id");
  const fingerprint = args.fingerprint;
  const client = new pg.Client({ connectionString: getConn() });
  await client.connect();
  try {
    await identityGate(client);
    let draftRows = 0;
    let claimRows = 0;
    if (typeof fingerprint === "string" && fingerprint.length > 0) {
      assertTestFingerprint(fingerprint);
      const d = await client.query(
        `DELETE FROM nex.business_claim_draft
          WHERE canonical_business_id = $1
            AND draft_fingerprint     = $2`,
        [canonicalId, fingerprint],
      );
      draftRows = d.rowCount;
      // Claims created by the probe have requested_by = fingerprint OR
      // destination = e2e-probe@... . Scope strictly to the fingerprint.
      const c = await client.query(
        `DELETE FROM nex.business_claim
          WHERE canonical_business_id = $1
            AND requested_by          = $2`,
        [canonicalId, fingerprint],
      );
      claimRows = c.rowCount;
    } else {
      // No fingerprint provided — delete ONLY e2e-probe:% drafts and
      // claims for the given canonical.
      const d = await client.query(
        `DELETE FROM nex.business_claim_draft
          WHERE canonical_business_id = $1
            AND draft_fingerprint LIKE 'e2e-probe:%'`,
        [canonicalId],
      );
      draftRows = d.rowCount;
      const c = await client.query(
        `DELETE FROM nex.business_claim
          WHERE canonical_business_id = $1
            AND requested_by LIKE 'e2e-probe:%'`,
        [canonicalId],
      );
      claimRows = c.rowCount;
    }
    log({
      ok: true,
      canonical_business_id: canonicalId,
      drafts_deleted: draftRows,
      claims_deleted: claimRows,
    });
  } finally {
    await client.end();
  }
}

async function cmdRestoreCanonicalLifecycle(args) {
  const canonicalId = args._[0];
  requireUuid(canonicalId, "canonical_id");
  const state = args.state;
  const sealed = [
    "DISCOVERED",
    "ENRICHED",
    "VERIFIED",
    "OWNER_CLAIMED",
    "ADMIN_PROMOTED",
    "CANDIDATE",
    "RETIRED",
  ];
  if (typeof state !== "string" || !sealed.includes(state)) {
    fail("invalid_state", `must be one of ${sealed.join("|")}`);
  }
  const client = new pg.Client({ connectionString: getConn() });
  await client.connect();
  try {
    await identityGate(client);
    const r = await client.query(
      `UPDATE nex.business_canonical
          SET lifecycle_state = $2,
              updated_at = now()
        WHERE canonical_business_id = $1
          AND lifecycle_state = 'OWNER_CLAIMED'`,
      [canonicalId, state],
    );
    if (r.rowCount === 0) {
      log({ ok: true, note: "no_owner_claimed_row_to_restore" });
      return;
    }
    log({
      ok: true,
      canonical_business_id: canonicalId,
      restored_to: state,
    });
  } finally {
    await client.end();
  }
}

function cryptoUuid() {
  return require("node:crypto").randomUUID();
}

// ─────────────────────────────────────────────────────────────────────
// Dispatcher
// ─────────────────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    fail(
      "usage",
      "commands: --seed-draft|--seed-contact|--seed-claim-with-code|--check-draft-status|--check-canonical-lifecycle|--cleanup|--restore-canonical-lifecycle",
    );
  }
  const cmd = argv[0];
  const rest = parseArgs(argv.slice(1));
  switch (cmd) {
    case "--seed-draft":                   return cmdSeedDraft(rest);
    case "--seed-contact":                 return cmdSeedContact(rest);
    case "--seed-claim-with-code":         return cmdSeedClaimWithCode(rest);
    case "--check-draft-status":           return cmdCheckDraftStatus(rest);
    case "--check-canonical-lifecycle":    return cmdCheckCanonicalLifecycle(rest);
    case "--cleanup":                      return cmdCleanup(rest);
    case "--restore-canonical-lifecycle":  return cmdRestoreCanonicalLifecycle(rest);
    default:
      fail("unknown_command", cmd);
  }
}

main().catch((err) => {
  fail("probe_crashed", err instanceof Error ? err.message : String(err));
});
