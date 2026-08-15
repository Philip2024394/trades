// NEX App Builder · Stage 2 verification (Philip 2026-08-14).
//
// Proves the RLS policies on `nex_security_test_studio_layouts` enforce
// merchant ownership. Runs 4 scenarios against a REAL Supabase Postgres
// via the Management API `/database/query` endpoint. Each scenario runs
// inside a transaction that switches roles + sets the JWT-claim GUC
// exactly as PostgREST would, then rolls back to leave no residue.
//
// Never prints secrets or tokens. Prints only assertion results.

import { readFileSync } from "node:fs";

const MERCHANT_A = "11111111-1111-1111-1111-111111111111";
const MERCHANT_B = "22222222-2222-2222-2222-222222222222";
const NEW_BRAND_A = "00000000-0000-0000-0000-000000000001";
const TEST_TABLE = "public.nex_security_test_studio_layouts";

// Read tools env for API access
const toolsEnv = Object.fromEntries(
  readFileSync(".env.tools.local", "utf8")
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]])
);
const ACCESS_TOKEN = toolsEnv.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = toolsEnv.SUPABASE_PROJECT_REF;
if (!ACCESS_TOKEN || !PROJECT_REF) {
  console.error("FAIL: missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF in .env.tools.local");
  process.exit(1);
}
const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

async function runSql(sql) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query: sql })
  });
  const text = await res.text();
  try {
    return { status: res.status, json: JSON.parse(text) };
  } catch {
    return { status: res.status, json: null, text };
  }
}

let passCount = 0;
let failCount = 0;
function assert(cond, label) {
  if (cond) { console.log("PASS: " + label); passCount++; }
  else      { console.error("FAIL: " + label); failCount++; }
}

console.log("Stage 2 · 4-scenario RLS test against " + TEST_TABLE);
console.log("");

// ─────────────────────────────────────────────────────────────
// Scenario 1 · Merchant A JWT reads OWN rows
// ─────────────────────────────────────────────────────────────
console.log("Scenario 1: Merchant A JWT → SELECT own rows");
{
  const claims = JSON.stringify({ role: "authenticated", merchant_id: MERCHANT_A });
  const sql = `begin; set local role authenticated; set local request.jwt.claims to '${claims}'; select count(*)::int as own_count, min(merchant_id::text) as first_mid, max(merchant_id::text) as last_mid from ${TEST_TABLE}; rollback;`;
  const r = await runSql(sql);
  assert(r.status === 201, "Scenario 1 · request succeeded (HTTP " + r.status + ")");
  const row = r.json?.[0];
  assert(row?.own_count === 1, "Scenario 1 · Merchant A sees exactly 1 row (got " + row?.own_count + ")");
  assert(row?.first_mid === MERCHANT_A, "Scenario 1 · row belongs to Merchant A");
  assert(row?.last_mid  === MERCHANT_A, "Scenario 1 · no Merchant B rows leaked");
}
console.log("");

// ─────────────────────────────────────────────────────────────
// Scenario 2 · Merchant A CANNOT INSERT as Merchant B (RLS with-check violation)
// ─────────────────────────────────────────────────────────────
console.log("Scenario 2: Merchant A JWT → INSERT as Merchant B must FAIL");
{
  const claims = JSON.stringify({ role: "authenticated", merchant_id: MERCHANT_A });
  const sql = `begin; set local role authenticated; set local request.jwt.claims to '${claims}'; insert into ${TEST_TABLE} (merchant_id, brand_id, page_id, layout_json) values ('${MERCHANT_B}', '${NEW_BRAND_A}', 'stolen_page', '{}'::jsonb); rollback;`;
  const r = await runSql(sql);
  const errMsg = r.json?.message || r.text || "";
  assert(
    r.status !== 201 && /row-level security/i.test(errMsg),
    "Scenario 2 · cross-merchant INSERT blocked by RLS policy (got: " + (errMsg.slice(0, 100) || "no error") + ")"
  );
}
console.log("");

// ─────────────────────────────────────────────────────────────
// Scenario 3 · Merchant A UPDATE Merchant B's row must FAIL (returns 0 rows updated)
// ─────────────────────────────────────────────────────────────
console.log("Scenario 3: Merchant A JWT → UPDATE Merchant B's row must be denied");
{
  const claims = JSON.stringify({ role: "authenticated", merchant_id: MERCHANT_A });
  const sql = `begin; set local role authenticated; set local request.jwt.claims to '${claims}'; with u as (update ${TEST_TABLE} set page_id = 'hijacked' where merchant_id = '${MERCHANT_B}' returning id) select count(*)::int as updated_count from u; rollback;`;
  const r = await runSql(sql);
  assert(r.status === 201, "Scenario 3 · request succeeded structurally");
  const row = r.json?.[0];
  assert(row?.updated_count === 0, "Scenario 3 · zero rows updated (RLS filtered — got " + row?.updated_count + ")");
}
console.log("");

// ─────────────────────────────────────────────────────────────
// Scenario 4 · Anon role (no JWT) is fully denied
// ─────────────────────────────────────────────────────────────
console.log("Scenario 4: anon role → SELECT and INSERT must fail");
{
  const sql = `begin; set local role anon; select count(*) from ${TEST_TABLE}; rollback;`;
  const r = await runSql(sql);
  const errMsg = r.json?.message || r.text || "";
  assert(
    r.status !== 201 && /permission denied|not permitted|row-level security/i.test(errMsg),
    "Scenario 4 · anon SELECT blocked (got: " + (errMsg.slice(0, 120) || "no error") + ")"
  );

  const sql2 = `begin; set local role anon; insert into ${TEST_TABLE} (merchant_id, brand_id, page_id, layout_json) values ('${MERCHANT_A}', '${NEW_BRAND_A}', 'anon_hijack', '{}'::jsonb); rollback;`;
  const r2 = await runSql(sql2);
  const err2 = r2.json?.message || r2.text || "";
  assert(
    r2.status !== 201 && /permission denied|not permitted|row-level security/i.test(err2),
    "Scenario 4 · anon INSERT blocked (got: " + (err2.slice(0, 120) || "no error") + ")"
  );
}
console.log("");

// ─────────────────────────────────────────────────────────────
// Scenario 5 · Dev-bypass simulation (authenticated role but no merchant_id claim)
//   Represents "session logic loosened; JWT lacks merchant_id" case.
//   nex_current_merchant_id() returns NULL → policy predicate FALSE → 0 rows.
// ─────────────────────────────────────────────────────────────
console.log("Scenario 5: authenticated role WITHOUT merchant_id claim (dev-bypass shape) → denied");
{
  const claims = JSON.stringify({ role: "authenticated" }); // no merchant_id
  const sql = `begin; set local role authenticated; set local request.jwt.claims to '${claims}'; select count(*)::int as visible_count from ${TEST_TABLE}; rollback;`;
  const r = await runSql(sql);
  const row = r.json?.[0];
  assert(row?.visible_count === 0, "Scenario 5 · SELECT returns 0 rows when merchant_id claim missing");

  const sql2 = `begin; set local role authenticated; set local request.jwt.claims to '${claims}'; insert into ${TEST_TABLE} (merchant_id, brand_id, page_id, layout_json) values ('${MERCHANT_A}', '${NEW_BRAND_A}', 'no_claim_insert', '{}'::jsonb); rollback;`;
  const r2 = await runSql(sql2);
  const err2 = r2.json?.message || r2.text || "";
  assert(
    r2.status !== 201 && /row-level security/i.test(err2),
    "Scenario 5 · INSERT rejected when merchant_id claim missing (got: " + (err2.slice(0, 120) || "no error") + ")"
  );
}
console.log("");

// ─────────────────────────────────────────────────────────────
// Scenario 6 · Merchant A INSERT own row succeeds
// ─────────────────────────────────────────────────────────────
console.log("Scenario 6: Merchant A JWT → INSERT own row must SUCCEED");
{
  const claims = JSON.stringify({ role: "authenticated", merchant_id: MERCHANT_A });
  const sql = `begin; set local role authenticated; set local request.jwt.claims to '${claims}'; with i as (insert into ${TEST_TABLE} (merchant_id, brand_id, page_id, layout_json) values ('${MERCHANT_A}', '${NEW_BRAND_A}', 'own_ok', '{}'::jsonb) returning id) select count(*)::int as inserted_count from i; rollback;`;
  const r = await runSql(sql);
  const row = r.json?.[0];
  assert(row?.inserted_count === 1, "Scenario 6 · own-row INSERT succeeded");
}
console.log("");

// ─────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────
console.log("=".repeat(60));
console.log(`Stage 2 RLS 4-scenario test · ${passCount} passed · ${failCount} failed`);
console.log("=".repeat(60));
if (failCount > 0) process.exit(1);
