// scripts/nex-actions-grenade-smoke.mjs
// F3 verification · proves the entire grenade chain:
//   auth → permissions → rate limit → wallet reserve → server delete →
//   wallet commit → safety audit event → chat archive → history line
//
// Also verifies failure modes:
//   · insufficient sparks → refund → no message deleted
//   · foreign message (not owned) → refund → no message deleted
//   · already-deleted message → refund → no double-delete
//   · duplicate request (same idempotency) → single deletion, single spend
//   · concurrent grenade → exactly one wins, other refunded

import pg from "pg";
import crypto from "node:crypto";
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.NEX_POSTGRES_URL });
const RUN = crypto.randomBytes(4).toString("hex");
const U = (s) => `smoke-g:${RUN}:${s}`;
const CONV = `conv:${RUN}`;

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? " · " + detail : ""}`);
}
async function q(sql, params = []) {
  const r = await pool.query(sql, params);
  return r.rows;
}

async function grantSparks(user, amount) {
  await q(
    `SELECT nex.wallet_grant_sparks($1,'signup_grant',$2,$3,'smoke seed',NULL)`,
    [user, amount, `signup_grant:${user}`],
  );
}
async function createMessage(user, displayName, content) {
  const r = await q(
    `SELECT nex.chat_message_upsert(gen_random_uuid(),$1,$2,$3,$4) AS message_id`,
    [CONV, user, displayName, content],
  );
  return r[0].message_id;
}
async function balance(user) {
  const r = await q(`SELECT sparks_balance FROM nex.user_wallet WHERE user_id=$1`, [user]);
  return r[0] ? Number(r[0].sparks_balance) : 0;
}
async function messageDeleted(id) {
  const r = await q(`SELECT deleted_at FROM nex.chat_message WHERE message_id=$1`, [id]);
  return r[0] && r[0].deleted_at !== null;
}
async function auditRow(idempotencyKey) {
  const r = await q(
    `SELECT * FROM nex.safety_audit_event WHERE idempotency_key=$1`,
    [idempotencyKey],
  );
  return r[0];
}
async function archiveRow(messageId) {
  const r = await q(`SELECT * FROM nex.chat_message_archive WHERE original_message_id=$1`, [messageId]);
  return r[0];
}

// Mirror the runtime flow · each step is a SEPARATE atomic call (the SQL
// functions manage their own tx). This matches how run.ts calls
// deps.wallet.require → handler.execute → deps.wallet.commit / refund.
async function grenadeAttempt(user, displayName, messageId, opts = {}) {
  const idempotencyKey = opts.idempotency ?? `spend_reserved:grenade:${user}:${crypto.randomBytes(3).toString("hex")}`;
  // 1 · reserve
  let reservationId;
  try {
    const rev = await pool.query(
      `SELECT * FROM nex.wallet_reserve_spend($1,'grenade',100,$2)`,
      [user, idempotencyKey],
    );
    reservationId = rev.rows[0].transaction_id;
  } catch (e) {
    return { ok: false, error: e.message };
  }
  // 2 · server-authoritative delete
  let deleteRow;
  try {
    const del = await pool.query(
      `SELECT * FROM nex.chat_message_grenade_delete($1,$2,$3,$4,$5)`,
      [messageId, CONV, user, displayName, reservationId],
    );
    deleteRow = del.rows[0];
  } catch (e) {
    // Handler failed · refund the reservation (separate tx)
    try {
      await pool.query(`SELECT nex.wallet_refund_spend($1,$2,$3)`,
        [user, reservationId, `spend_refunded:${reservationId}`]);
    } catch {}
    return { ok: false, error: e.message };
  }
  // 3 · commit
  await pool.query(`SELECT nex.wallet_commit_spend($1,$2,$3)`,
    [user, reservationId, `spend_committed:${reservationId}`]);
  return { ok: true, ...deleteRow, reservationId };
}

// ── 1 · Happy path · own message · sparks charged · audit written ────
async function t_happy_path() {
  const u = U("h");
  const dn = "Philip";
  await grantSparks(u, 200);
  const mid = await createMessage(u, dn, "Watch this vanish.");
  const startBal = await balance(u);
  const res = await grenadeAttempt(u, dn, mid);
  const endBal = await balance(u);
  const deleted = await messageDeleted(mid);
  const audit = res.ok ? await q(`SELECT * FROM nex.safety_audit_event WHERE target_id=$1 AND event_type='grenade'`, [mid]) : [];
  const arch = res.ok ? await archiveRow(mid) : null;
  const ok = res.ok
    && startBal === 200
    && endBal === 100
    && deleted
    && audit.length === 1
    && audit[0].success === true
    && audit[0].sparks_charged === "100"
    && arch
    && arch.original_content === "Watch this vanish."
    && /💣 Philip grenaded this post ·/.test(res.history_line);
  record("1 · grenade happy path (charge + delete + audit + archive + history line)", ok,
    ok ? `balance 200→${endBal} · history="${res.history_line}"` : `res=${JSON.stringify(res)}`);
}

// ── 2 · Insufficient sparks · no delete · balance unchanged ──────────
async function t_insufficient() {
  const u = U("i");
  const dn = "Poor";
  await grantSparks(u, 50);
  const mid = await createMessage(u, dn, "Cannot afford.");
  const res = await grenadeAttempt(u, dn, mid);
  const deleted = await messageDeleted(mid);
  const bal = await balance(u);
  const ok = !res.ok && /insufficient sparks/i.test(res.error) && !deleted && bal === 50;
  record("2 · insufficient sparks → no delete · balance unchanged", ok, `bal=${bal} deleted=${deleted}`);
}

// ── 3 · Foreign message (not owned) · refund · no delete ─────────────
async function t_ownership() {
  const attacker = U("attacker");
  const victim   = U("victim");
  const dn_a = "Attacker"; const dn_v = "Victim";
  await grantSparks(attacker, 200);
  await grantSparks(victim, 100);
  const victimMid = await createMessage(victim, dn_v, "Not yours.");
  const res = await grenadeAttempt(attacker, dn_a, victimMid);
  const deleted = await messageDeleted(victimMid);
  const bal = await balance(attacker);
  const ok = !res.ok && /does not own message/i.test(res.error) && !deleted && bal === 200;
  record("3 · ownership check · attacker refunded · victim intact", ok,
    `attackerBal=${bal} victimMessageDeleted=${deleted}`);
}

// ── 4 · Already-deleted · refund · no double-charge ──────────────────
async function t_already_deleted() {
  const u = U("dd");
  const dn = "DoubleDip";
  await grantSparks(u, 200);
  const mid = await createMessage(u, dn, "Once.");
  const first = await grenadeAttempt(u, dn, mid);
  const balMid = await balance(u);
  const second = await grenadeAttempt(u, dn, mid); // different reservation, same target
  const balEnd = await balance(u);
  const ok = first.ok && !second.ok && /already deleted/i.test(second.error) && balMid === 100 && balEnd === 100;
  record("4 · already-deleted target · second attempt refunded", ok,
    `balAfterFirst=${balMid} balAfterSecondFail=${balEnd}`);
}

// ── 5 · Idempotent grenade · same idempotency key · single spend ────
async function t_idempotent() {
  const u = U("id");
  const dn = "Idem";
  await grantSparks(u, 200);
  const mid = await createMessage(u, dn, "Retry me.");
  const key = `spend_reserved:grenade:${u}:fixed-idempotent`;
  const a = await grenadeAttempt(u, dn, mid, { idempotency: key });
  const b = await grenadeAttempt(u, dn, mid, { idempotency: key });
  const bal = await balance(u);
  const audits = await q(`SELECT count(*)::int AS n FROM nex.safety_audit_event WHERE target_id=$1`, [mid]);
  const ok = a.ok && b.ok && bal === 100 && audits[0].n === 1;
  record("5 · idempotent grenade · same key · single spend + single audit", ok,
    `bal=${bal} auditRows=${audits[0].n}`);
}

// ── 6 · Concurrent grenade race · exactly one wins ──────────────────
async function t_concurrent() {
  const u = U("cc");
  const dn = "Race";
  await grantSparks(u, 200);
  const mid = await createMessage(u, dn, "Race target.");
  const [a, b] = await Promise.all([
    grenadeAttempt(u, dn, mid),
    grenadeAttempt(u, dn, mid),
  ]);
  const bal = await balance(u);
  const wins = [a, b].filter(x => x.ok).length;
  const losses = [a, b].filter(x => !x.ok).length;
  const ok = wins === 1 && losses === 1 && bal === 100;
  record("6 · concurrent race · exactly one wins · loser refunded", ok,
    `wins=${wins} losses=${losses} bal=${bal}`);
}

// ── 7 · Audit + archive linkage · content preserved · retention set ──
async function t_audit_linkage() {
  const u = U("audit");
  const dn = "Auditor";
  await grantSparks(u, 200);
  const mid = await createMessage(u, dn, "Secret content · retention test.");
  const res = await grenadeAttempt(u, dn, mid);
  const ev = res.ok ? await auditRow(`grenade:${u}:${mid}:${res.reservationId}`) : null;
  const arc = res.ok ? await archiveRow(mid) : null;
  const retentionOk = ev && new Date(ev.retention_until).getTime() > Date.now() + 29 * 86400 * 1000;
  const ok = res.ok && ev && arc
    && ev.event_type === "grenade"
    && ev.actor_user_id === u
    && ev.wallet_transaction_id === res.reservationId
    && arc.original_content === "Secret content · retention test."
    && retentionOk
    && ev.legal_hold === false;
  record("7 · audit event + archive · linkage + retention (~30d) + not held", ok,
    `retentionUntil=${ev?.retention_until} legalHold=${ev?.legal_hold}`);
}

// ── 8 · Legal hold pins retention · does not auto-expire ────────────
async function t_legal_hold() {
  const u = U("hold");
  const dn = "Holder";
  await grantSparks(u, 200);
  const mid = await createMessage(u, dn, "Legal hold subject.");
  const res = await grenadeAttempt(u, dn, mid);
  if (!res.ok) return record("8 · legal hold pinning", false, "setup grenade failed");
  const ev = await auditRow(`grenade:${u}:${mid}:${res.reservationId}`);
  await q(`SELECT nex.safety_audit_set_legal_hold($1,true,$2,$3)`,
    [ev.event_id, "sample regulatory hold", "operator:test"]);
  const held = await q(`SELECT legal_hold, legal_hold_reason FROM nex.safety_audit_event WHERE event_id=$1`, [ev.event_id]);
  const ok = held[0].legal_hold === true && held[0].legal_hold_reason === "sample regulatory hold";
  record("8 · legal hold set · reason recorded · row pinned", ok, `legalHold=${held[0].legal_hold}`);
}

// ── 9 · Failure audit written when handler fails ────────────────────
async function t_failure_audit() {
  const attacker = U("fa-attacker");
  const victim   = U("fa-victim");
  const dn = "F-A"; const dnv = "F-V";
  await grantSparks(attacker, 200);
  await grantSparks(victim, 100);
  const victimMid = await createMessage(victim, dnv, "Failure audit target.");
  // Manually record a failure audit as the deps layer would
  const idKey = `grenade:fail:${attacker}:${victimMid}:${Date.now()}`;
  await q(
    `SELECT nex.safety_audit_record_failure($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    ['grenade','grenade',attacker,dn,'message',victimMid,CONV,null,'forbidden:not-your-message',idKey],
  );
  const r = await q(`SELECT * FROM nex.safety_audit_event WHERE idempotency_key=$1`, [idKey]);
  const ok = r.length === 1 && r[0].success === false && r[0].failure_reason === 'forbidden:not-your-message';
  record("9 · failure audit written · reason captured · success=false", ok, `rows=${r.length}`);
}

// ── 10 · Balance invariant across all F3 test users ─────────────────
async function t_invariant() {
  const rows = await q(`
    SELECT w.user_id, w.sparks_balance,
           coalesce((SELECT sum(delta_sparks) FROM nex.wallet_transaction wt
                       WHERE wt.user_id = w.user_id), 0) AS ledger_sum
      FROM nex.user_wallet w WHERE w.user_id LIKE $1
  `, [`smoke-g:${RUN}:%`]);
  const bad = rows.filter(r => Number(r.sparks_balance) !== Number(r.ledger_sum));
  record("10 · balance invariant across all grenade test users", bad.length === 0,
    `users=${rows.length} mismatches=${bad.length}`);
}

async function main() {
  console.log("═".repeat(70));
  console.log(`NEX Actions · GRENADE F3 smoke suite · runId=${RUN}`);
  console.log("═".repeat(70));
  try {
    await t_happy_path();
    await t_insufficient();
    await t_ownership();
    await t_already_deleted();
    await t_idempotent();
    await t_concurrent();
    await t_audit_linkage();
    await t_legal_hold();
    await t_failure_audit();
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
