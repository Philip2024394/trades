// scripts/nex-actions-signup-grant-smoke.mjs
// F3.5 verification · signup Sparks grant via the real HTTP path.
// Proves:
//   1. First call grants 200 Sparks
//   2. Repeat call returns the same balance · does NOT double-grant
//   3. Balance invariant (wallet == ledger sum)
//   4. Existing users are never accidentally re-granted

import pg from "pg";
import crypto from "node:crypto";
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.NEX_POSTGRES_URL });
const RUN = crypto.randomBytes(4).toString("hex");
const U = (s) => `signup-smoke:${RUN}:${s}`;

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? " · " + detail : ""}`);
}

async function post(userId) {
  const resp = await fetch("http://localhost:3008/api/nex-actions/wallet/signup-grant", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-nex-user-id": userId },
    body: JSON.stringify({ userId }),
  });
  const body = await resp.json();
  return { status: resp.status, body };
}
async function balance(u) {
  const r = await pool.query(`SELECT sparks_balance FROM nex.user_wallet WHERE user_id=$1`, [u]);
  return r.rows[0] ? Number(r.rows[0].sparks_balance) : 0;
}
async function ledgerCount(u, kind) {
  const r = await pool.query(
    `SELECT count(*)::int AS n FROM nex.wallet_transaction WHERE user_id=$1 AND kind=$2`,
    [u, kind],
  );
  return r.rows[0]?.n ?? 0;
}

async function t_first_grant() {
  const u = U("first");
  const r = await post(u);
  const bal = await balance(u);
  const grantRows = await ledgerCount(u, "signup_grant");
  const ok = r.status === 200 && r.body.ok === true && r.body.balance === 200
    && r.body.granted === 200 && bal === 200 && grantRows === 1;
  record("1 · first signup grant · 200 Sparks · single ledger row", ok,
    `status=${r.status} bal=${bal} grantRows=${grantRows}`);
}

async function t_retry_idempotent() {
  const u = U("retry");
  await post(u); // first
  const r2 = await post(u); // repeat
  const r3 = await post(u); // repeat again
  const bal = await balance(u);
  const grantRows = await ledgerCount(u, "signup_grant");
  const ok = r2.status === 200 && r3.status === 200
    && r2.body.balance === 200 && r3.body.balance === 200
    && bal === 200 && grantRows === 1;
  record("2 · repeat calls · idempotent · single grant · balance stable", ok,
    `bal=${bal} grantRows=${grantRows}`);
}

async function t_no_double_grant_after_spend() {
  // Simulate a user who spent some Sparks · repeat signup grant call must NOT
  // top them back up.
  const u = U("spent");
  await post(u); // grant 200
  await pool.query(
    `SELECT nex.wallet_reserve_spend($1,'grenade',100,$2)`,
    [u, `spend_reserved:grenade:${u}:setup`],
  );
  const balBefore = await balance(u); // should be 100
  const r = await post(u); // repeat grant · must be no-op
  const balAfter = await balance(u);
  const ok = balBefore === 100 && balAfter === 100 && r.body.ok === true;
  record("3 · existing user with spent Sparks · repeat grant does not top up", ok,
    `balBefore=${balBefore} balAfter=${balAfter}`);
}

async function t_invariant() {
  const rows = await pool.query(`
    SELECT w.user_id, w.sparks_balance,
           coalesce((SELECT sum(delta_sparks) FROM nex.wallet_transaction wt
                       WHERE wt.user_id = w.user_id), 0) AS ledger_sum
      FROM nex.user_wallet w WHERE w.user_id LIKE $1
  `, [`signup-smoke:${RUN}:%`]);
  const bad = rows.rows.filter(r => Number(r.sparks_balance) !== Number(r.ledger_sum));
  record("4 · balance invariant across all signup test users", bad.length === 0,
    `users=${rows.rows.length} mismatches=${bad.length}`);
}

async function main() {
  console.log("═".repeat(70));
  console.log(`NEX Actions · SIGNUP GRANT smoke · runId=${RUN}`);
  console.log("═".repeat(70));
  try {
    await t_first_grant();
    await t_retry_idempotent();
    await t_no_double_grant_after_spend();
    await t_invariant();
  } catch (e) { console.error("FATAL:", e.stack ?? e); }
  console.log("═".repeat(70));
  const passed = results.filter(r => r.ok).length;
  const failed = results.length - passed;
  console.log(`  ${passed} / ${results.length} passed · ${failed} failed`);
  console.log("═".repeat(70));
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}
main();
