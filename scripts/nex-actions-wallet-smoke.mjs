// scripts/nex-actions-wallet-smoke.mjs
// F2 verification · 10 checks proving the NEX Sparks wallet is
// ledger-first, server-authoritative, idempotent, atomic, and immutable.
//
// Test users are namespaced with a random suffix per run so parallel runs
// never collide, and cleanup is optional (audit is designed to persist).

import pg from "pg";
import crypto from "node:crypto";
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.NEX_POSTGRES_URL });
const RUN_ID = crypto.randomBytes(4).toString("hex");
const U = (label) => `smoke:${RUN_ID}:${label}`;

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? " · " + detail : ""}`);
}

async function q(sql, params = []) {
  const r = await pool.query(sql, params);
  return r.rows;
}

async function balance(u) {
  const r = await q(`SELECT sparks_balance FROM nex.user_wallet WHERE user_id = $1`, [u]);
  return r[0] ? Number(r[0].sparks_balance) : 0;
}

async function ledger(u) {
  const r = await q(
    `SELECT kind, delta_sparks, balance_after, idempotency_key
       FROM nex.wallet_transaction WHERE user_id = $1
       ORDER BY created_at ASC`,
    [u],
  );
  return r.map((x) => ({
    kind: x.kind,
    delta: Number(x.delta_sparks),
    after: Number(x.balance_after),
    key: x.idempotency_key,
  }));
}

// ── 1 · Signup grant idempotency ─────────────────────────────────────
async function test_signup_idempotency() {
  const u = U("signup");
  await q(`SELECT nex.wallet_grant_sparks($1,'signup_grant',$2,$3,$4,NULL)`,
    [u, 200, `signup_grant:${u}`, "smoke signup"]);
  const bal1 = await balance(u);
  await q(`SELECT nex.wallet_grant_sparks($1,'signup_grant',$2,$3,$4,NULL)`,
    [u, 200, `signup_grant:${u}`, "smoke signup retry"]);
  const bal2 = await balance(u);
  const l = await ledger(u);
  const ok = bal1 === 200 && bal2 === 200 && l.length === 1;
  record("1 · signup grant idempotency (2nd call is no-op)", ok,
    `bal1=${bal1} bal2=${bal2} ledgerRows=${l.length}`);
}

// ── 2 · Zero-balance reserve must fail ────────────────────────────────
async function test_zero_balance_reserve() {
  const u = U("zero");
  await q(`INSERT INTO nex.user_wallet (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [u]);
  try {
    await q(`SELECT * FROM nex.wallet_reserve_spend($1,'grenade',$2,$3)`,
      [u, 100, `spend_reserved:grenade:${u}:${Date.now()}`]);
    record("2 · zero-balance reserve rejected", false, "reservation unexpectedly succeeded");
  } catch (e) {
    const ok = /insufficient sparks/.test(e.message);
    record("2 · zero-balance reserve rejected", ok, e.message.slice(0, 80));
  }
}

// ── 3 · Reserve → commit · ledger + balance correct ──────────────────
async function test_reserve_commit() {
  const u = U("reserve-commit");
  await q(`SELECT nex.wallet_grant_sparks($1,'signup_grant',200,$2,NULL,NULL)`,
    [u, `signup_grant:${u}`]);
  const key = `spend_reserved:grenade:${u}:${Date.now()}`;
  const r = await q(`SELECT * FROM nex.wallet_reserve_spend($1,'grenade',$2,$3)`,
    [u, 100, key]);
  const resId = r[0].transaction_id;
  const balAfterReserve = await balance(u);
  await q(`SELECT nex.wallet_commit_spend($1,$2,$3)`,
    [u, resId, `spend_committed:${resId}`]);
  const balAfterCommit = await balance(u);
  const l = await ledger(u);
  const kinds = l.map((x) => x.kind);
  const ok =
    balAfterReserve === 100 &&
    balAfterCommit === 100 &&
    kinds.join(",") === "signup_grant,spend_reserved,spend_committed";
  record("3 · reserve → commit · balance + ledger correct", ok,
    `balAfterReserve=${balAfterReserve} balAfterCommit=${balAfterCommit} kinds=${kinds.join("|")}`);
}

// ── 4 · Reserve → refund · balance restored exactly ──────────────────
async function test_reserve_refund() {
  const u = U("reserve-refund");
  await q(`SELECT nex.wallet_grant_sparks($1,'signup_grant',200,$2,NULL,NULL)`,
    [u, `signup_grant:${u}`]);
  const key = `spend_reserved:grenade:${u}:${Date.now()}`;
  const r = await q(`SELECT * FROM nex.wallet_reserve_spend($1,'grenade',$2,$3)`,
    [u, 100, key]);
  const resId = r[0].transaction_id;
  const midBal = await balance(u);
  await q(`SELECT nex.wallet_refund_spend($1,$2,$3)`,
    [u, resId, `spend_refunded:${resId}`]);
  const finalBal = await balance(u);
  const l = await ledger(u);
  const kinds = l.map((x) => x.kind);
  const ok =
    midBal === 100 &&
    finalBal === 200 &&
    kinds.join(",") === "signup_grant,spend_reserved,spend_refunded";
  record("4 · reserve → refund · balance restored", ok,
    `midBal=${midBal} finalBal=${finalBal} kinds=${kinds.join("|")}`);
}

// ── 5 · Duplicate reserve with same key · idempotent no double-spend ─
async function test_duplicate_reserve_idempotent() {
  const u = U("dup-reserve");
  await q(`SELECT nex.wallet_grant_sparks($1,'signup_grant',200,$2,NULL,NULL)`,
    [u, `signup_grant:${u}`]);
  const key = `spend_reserved:grenade:${u}:fixed-nonce`;
  const first = await q(`SELECT * FROM nex.wallet_reserve_spend($1,'grenade',$2,$3)`,
    [u, 100, key]);
  const second = await q(`SELECT * FROM nex.wallet_reserve_spend($1,'grenade',$2,$3)`,
    [u, 100, key]);
  const bal = await balance(u);
  const l = await ledger(u);
  const reserveRows = l.filter((x) => x.kind === "spend_reserved");
  const ok =
    first[0].transaction_id === second[0].transaction_id &&
    second[0].idempotent_hit === true &&
    bal === 100 &&
    reserveRows.length === 1;
  record("5 · duplicate reserve · idempotent no double-spend", ok,
    `sameId=${first[0].transaction_id === second[0].transaction_id} bal=${bal} reserveRows=${reserveRows.length}`);
}

// ── 6 · Direct UPDATE against ledger must be rejected ────────────────
async function test_ledger_immutability() {
  const u = U("immutable");
  await q(`SELECT nex.wallet_grant_sparks($1,'signup_grant',200,$2,NULL,NULL)`,
    [u, `signup_grant:${u}`]);
  const l = await ledger(u);
  const txnId = (await q(
    `SELECT transaction_id FROM nex.wallet_transaction WHERE user_id=$1 LIMIT 1`, [u]
  ))[0].transaction_id;
  let updateBlocked = false, deleteBlocked = false;
  try {
    await q(`UPDATE nex.wallet_transaction SET delta_sparks = 999 WHERE transaction_id = $1`, [txnId]);
  } catch (e) {
    updateBlocked = /append-only/.test(e.message);
  }
  try {
    await q(`DELETE FROM nex.wallet_transaction WHERE transaction_id = $1`, [txnId]);
  } catch (e) {
    deleteBlocked = /append-only/.test(e.message);
  }
  record("6 · ledger UPDATE + DELETE rejected", updateBlocked && deleteBlocked,
    `updateBlocked=${updateBlocked} deleteBlocked=${deleteBlocked}`);
}

// ── 7 · Balance invariant · wallet == sum(ledger) ─────────────────────
async function test_balance_invariant() {
  const rows = await q(`
    SELECT w.user_id, w.sparks_balance,
           coalesce((SELECT sum(delta_sparks) FROM nex.wallet_transaction wt
                       WHERE wt.user_id = w.user_id), 0) AS ledger_sum
      FROM nex.user_wallet w
     WHERE w.user_id LIKE $1
  `, [`smoke:${RUN_ID}:%`]);
  const bad = rows.filter((r) => Number(r.sparks_balance) !== Number(r.ledger_sum));
  const ok = bad.length === 0;
  record("7 · balance invariant · wallet == sum(ledger)", ok,
    `checked ${rows.length} users${bad.length ? " · mismatches: " + JSON.stringify(bad) : ""}`);
}

// ── 8 · Concurrency · two simultaneous reserves against tight balance ─
// Balance = 100 · two clients each try to reserve 100 · exactly ONE
// must succeed and balance never drops below zero.
async function test_concurrency() {
  const u = U("concurrent");
  await q(`SELECT nex.wallet_grant_sparks($1,'signup_grant',100,$2,NULL,NULL)`,
    [u, `signup_grant:${u}`]);
  const key1 = `spend_reserved:grenade:${u}:c1-${Date.now()}`;
  const key2 = `spend_reserved:grenade:${u}:c2-${Date.now()}`;
  const promises = [
    pool.query(`SELECT * FROM nex.wallet_reserve_spend($1,'grenade',$2,$3)`, [u, 100, key1]).then(r => ({ ok: true, r })).catch(e => ({ ok: false, e })),
    pool.query(`SELECT * FROM nex.wallet_reserve_spend($1,'grenade',$2,$3)`, [u, 100, key2]).then(r => ({ ok: true, r })).catch(e => ({ ok: false, e })),
  ];
  const [a, b] = await Promise.all(promises);
  const successes = [a, b].filter(x => x.ok).length;
  const failures  = [a, b].filter(x => !x.ok).length;
  const bal = await balance(u);
  const ok = successes === 1 && failures === 1 && bal === 0;
  record("8 · concurrency · exactly one of two reserves succeeds", ok,
    `successes=${successes} failures=${failures} bal=${bal}`);
}

// ── 9 · Failed handler → refund → no permanent Sparks lost ───────────
async function test_failed_handler_refund() {
  const u = U("failed-handler");
  await q(`SELECT nex.wallet_grant_sparks($1,'signup_grant',500,$2,NULL,NULL)`,
    [u, `signup_grant:${u}`]);
  // simulate 3 spend cycles with different outcomes
  const startBal = await balance(u);
  // Cycle A · commit
  const kA = `spend_reserved:grenade:${u}:a`;
  const rA = await q(`SELECT * FROM nex.wallet_reserve_spend($1,'grenade',100,$2)`, [u, kA]);
  await q(`SELECT nex.wallet_commit_spend($1,$2,$3)`, [u, rA[0].transaction_id, `spend_committed:${rA[0].transaction_id}`]);
  // Cycle B · refund (simulated handler failure)
  const kB = `spend_reserved:grenade:${u}:b`;
  const rB = await q(`SELECT * FROM nex.wallet_reserve_spend($1,'grenade',100,$2)`, [u, kB]);
  await q(`SELECT nex.wallet_refund_spend($1,$2,$3)`, [u, rB[0].transaction_id, `spend_refunded:${rB[0].transaction_id}`]);
  // Cycle C · refund
  const kC = `spend_reserved:grenade:${u}:c`;
  const rC = await q(`SELECT * FROM nex.wallet_reserve_spend($1,'grenade',100,$2)`, [u, kC]);
  await q(`SELECT nex.wallet_refund_spend($1,$2,$3)`, [u, rC[0].transaction_id, `spend_refunded:${rC[0].transaction_id}`]);
  const endBal = await balance(u);
  // 500 - 100 (committed) - 100 (refunded) - 100 (refunded) + 100 (refund) + 100 (refund) = 400
  // net: only the committed A permanently reduced balance
  const ok = startBal === 500 && endBal === 400;
  record("9 · failed handler → refund → balance intact", ok,
    `startBal=${startBal} endBal=${endBal} (expected 400)`);
}

// ── 10 · Unique constraint on idempotency_key actually prevents dup ──
async function test_unique_constraint() {
  const u = U("unique");
  await q(`INSERT INTO nex.user_wallet (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [u]);
  const key = `custom:${u}:duplicate-test`;
  // Manually insert same key twice · second must fail
  await q(
    `INSERT INTO nex.wallet_transaction (user_id, kind, delta_sparks, idempotency_key, balance_after)
     VALUES ($1,'promotion_grant',50,$2,50)`, [u, key]);
  let secondBlocked = false;
  try {
    await q(
      `INSERT INTO nex.wallet_transaction (user_id, kind, delta_sparks, idempotency_key, balance_after)
       VALUES ($1,'promotion_grant',50,$2,100)`, [u, key]);
  } catch (e) {
    secondBlocked = /duplicate key value/.test(e.message);
  }
  record("10 · unique(idempotency_key) prevents duplicates", secondBlocked, `secondBlocked=${secondBlocked}`);
}

// ── run all tests · report summary ────────────────────────────────────
async function main() {
  console.log("═".repeat(70));
  console.log(`NEX Sparks Wallet · F2 smoke suite · runId=${RUN_ID}`);
  console.log("═".repeat(70));

  try {
    await test_signup_idempotency();
    await test_zero_balance_reserve();
    await test_reserve_commit();
    await test_reserve_refund();
    await test_duplicate_reserve_idempotent();
    await test_ledger_immutability();
    await test_balance_invariant();
    await test_concurrency();
    await test_failed_handler_refund();
    await test_unique_constraint();
  } catch (e) {
    console.error("FATAL:", e.stack ?? e);
  }

  console.log("═".repeat(70));
  const passed = results.filter(r => r.ok).length;
  const failed = results.length - passed;
  console.log(`  ${passed} / ${results.length} passed · ${failed} failed`);
  console.log("═".repeat(70));
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main();
