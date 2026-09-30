// scripts/apply-nex-migration-106.mjs
//
// Bridge 99 Migration 106 · scope dedup to (send_intent_id, device_id).

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import pkg from "pg";
const { Client, Pool } = pkg;

function loadEnv() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
loadEnv();

const MIGRATION_FILE = "106_nex_bridge99_dedup_device_scope.sql";
const EXPECTED = "ijvqdvsvwtwxzcqmoqit";

if (!process.env.DATABASE_URL?.includes(EXPECTED)) {
  console.error(`Refusing · DATABASE_URL not ${EXPECTED}`);
  process.exit(2);
}

const results = [];
function record(check, expected, actual, pass) {
  results.push({ check, expected, actual, pass });
  console.log(`  ${pass ? "✓" : "✗"} ${check}`);
  console.log(`      expected: ${expected}`);
  console.log(`      actual:   ${actual}`);
}

const pg = new Client({ connectionString: process.env.DATABASE_URL });
await pg.connect();
try {
  console.log(`Applying ${MIGRATION_FILE} …`);
  const sql = fs.readFileSync(
    path.join(process.cwd(), "nex-supabase", "migrations", MIGRATION_FILE),
    "utf-8",
  );
  await pg.query(sql);
  console.log(`  ✓ committed`);

  // Ledger
  {
    const q = await pg.query(
      `SELECT version FROM nex_migration_history WHERE version = '106'`,
    );
    record("Ledger 106", "1 row", `${q.rows.length}`, q.rows.length === 1);
  }

  // PK now (send_intent_id, device_id)
  {
    const q = await pg.query(`
      SELECT array_agg(a.attname ORDER BY array_position(i.indkey, a.attnum)) AS cols
        FROM pg_index i
        JOIN pg_class c ON c.oid = i.indrelid
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
       WHERE c.relname = 'nex_bridge99_first_send_intent'
         AND i.indisprimary
    `);
    // pg returns text[] as a plain JS array in modern versions but as
    // a Postgres array literal string ("{a,b}") in some · handle both.
    const raw = q.rows[0].cols;
    const cols = Array.isArray(raw)
      ? raw
      : String(raw).replace(/^\{|\}$/g, "").split(",");
    record(
      "Composite PRIMARY KEY (send_intent_id, device_id)",
      "send_intent_id + device_id both present",
      JSON.stringify(cols),
      cols.length === 2 &&
        cols.includes("send_intent_id") &&
        cols.includes("device_id"),
    );
  }

  // Setup: owner account
  const owner = await pg.query(
    `INSERT INTO nex_account (display_name) VALUES ($1) RETURNING id`,
    [`_m106_owner_${Math.random().toString(36).slice(2, 8)}`],
  );
  const ownerId = owner.rows[0].id;
  const created = [];

  function rows() {
    return JSON.stringify([
      {
        recipient_device_id: "test-device-1",
        ciphertext: Buffer.from("ct").toString("base64"),
        nonce: Buffer.from("nonce-24bytes-padding-ok").toString("base64"),
      },
    ]);
  }

  async function call(client, intent, deviceId) {
    const r = await client.query(
      `SELECT nex_bridge99_create_first_message(
         'New visitor',$1,$2,$3::uuid,NULL,$4::uuid,$5,$6::jsonb,$7
       ) AS result`,
      [
        deviceId,
        "A".repeat(43),
        ownerId,
        intent,
        randomUUID(),
        rows(),
        `_fp_${randomUUID().slice(0, 8)}`,
      ],
    );
    return r.rows[0].result;
  }

  // Sequential same-intent + same-device → cached (unchanged from M105)
  {
    const intent = randomUUID();
    const device = `dev-A-${randomUUID().slice(0, 8)}`;
    const a = await call(pg, intent, device);
    const b = await call(pg, intent, device);
    created.push(a.account_id);
    record(
      "Same intent + same device sequential → same account, dedup=true",
      "b.account_id === a.account_id AND b.deduplicated===true",
      `a=${a.account_id} b=${b.account_id} dedup=${b.deduplicated}`,
      b.account_id === a.account_id && b.deduplicated === true,
    );
  }

  // Same intent + DIFFERENT device → fresh account (new behaviour in M106)
  {
    const intent = randomUUID();
    const deviceA = `dev-C-${randomUUID().slice(0, 8)}`;
    const deviceB = `dev-D-${randomUUID().slice(0, 8)}`;
    const a = await call(pg, intent, deviceA);
    const b = await call(pg, intent, deviceB);
    created.push(a.account_id, b.account_id);
    record(
      "Same intent + DIFFERENT device → independent accounts (M106 boundary)",
      "a.account_id !== b.account_id AND both deduplicated===false",
      `a=${a.account_id} b=${b.account_id} dupA=${a.deduplicated} dupB=${b.deduplicated}`,
      a.account_id !== b.account_id &&
        a.deduplicated === false &&
        b.deduplicated === false,
    );
    // Two dedup rows for same intent, different devices
    const q = await pg.query(
      `SELECT count(*)::int AS n FROM nex_bridge99_first_send_intent WHERE send_intent_id = $1`,
      [intent],
    );
    record(
      "Two dedup rows for same intent (one per device)",
      "2",
      `${q.rows[0].n}`,
      Number(q.rows[0].n) === 2,
    );
  }

  // Concurrent same-intent + same-device → still one account (race protection preserved)
  {
    const intent = randomUUID();
    const device = `dev-E-${randomUUID().slice(0, 8)}`;
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 4,
    });
    try {
      const [a, b] = await Promise.all([
        (async () => {
          const c = await pool.connect();
          try {
            return await call(c, intent, device);
          } finally {
            c.release();
          }
        })(),
        (async () => {
          const c = await pool.connect();
          try {
            return await call(c, intent, device);
          } finally {
            c.release();
          }
        })(),
      ]);
      created.push(a.account_id);
      record(
        "Concurrent same intent + same device → one account (race preserved)",
        "same account, one dedup=true and one dedup=false",
        `a=${a.account_id} b=${b.account_id} dupA=${a.deduplicated} dupB=${b.deduplicated}`,
        a.account_id === b.account_id &&
          [a.deduplicated, b.deduplicated].sort().join() === "false,true",
      );
    } finally {
      await pool.end();
    }
  }

  // Concurrent same-intent + different-device → two accounts (race serialised but each creates)
  {
    const intent = randomUUID();
    const deviceA = `dev-F-${randomUUID().slice(0, 8)}`;
    const deviceB = `dev-G-${randomUUID().slice(0, 8)}`;
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 4,
    });
    try {
      const [a, b] = await Promise.all([
        (async () => {
          const c = await pool.connect();
          try {
            return await call(c, intent, deviceA);
          } finally {
            c.release();
          }
        })(),
        (async () => {
          const c = await pool.connect();
          try {
            return await call(c, intent, deviceB);
          } finally {
            c.release();
          }
        })(),
      ]);
      created.push(a.account_id, b.account_id);
      record(
        "Concurrent same intent + different device → independent accounts",
        "different account ids, both deduplicated=false",
        `a=${a.account_id} b=${b.account_id} dupA=${a.deduplicated} dupB=${b.deduplicated}`,
        a.account_id !== b.account_id &&
          a.deduplicated === false &&
          b.deduplicated === false,
      );
    } finally {
      await pool.end();
    }
  }

  // Cleanup
  await pg.query(`DELETE FROM nex_account WHERE id = ANY($1::uuid[])`, [
    created,
  ]);
  await pg.query(`DELETE FROM nex_account WHERE id = $1`, [ownerId]);

  const pass = results.filter((r) => r.pass).length;
  const fail = results.filter((r) => !r.pass).length;
  console.log(
    `\n  ${pass} passed · ${fail} failed · ${results.length} total`,
  );
  if (fail > 0) process.exit(1);
  console.log("\n✓ Migration 106 applied and verified.");
} finally {
  await pg.end();
}
