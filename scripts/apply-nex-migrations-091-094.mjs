// Applies migrations 091..094 to the NEX Supabase project.
//   091 · nex_peer_message reactions (Bridge 66)
//   092 · nex_account_device_key    (Bridge 74)
//   093 · nex_peer_message encrypted (Bridge 76)
//   094 · purge function             (Bridge 78)

import fs from "node:fs";
import path from "node:path";
import pkg from "pg";
const { Client } = pkg;

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

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL missing · check .env.local");
  process.exit(1);
}

const files = [
  "091_nex_peer_message_reactions.sql",
  "092_nex_account_device_key.sql",
  "093_nex_peer_message_encrypted.sql",
  "094_nex_purge_delivered_encrypted.sql",
];

const pg = new Client({ connectionString: process.env.DATABASE_URL });
await pg.connect();
try {
  for (const file of files) {
    console.log(`\nApplying ${file} …`);
    const sql = fs.readFileSync(
      path.join(process.cwd(), "nex-supabase", "migrations", file),
      "utf-8",
    );
    await pg.query(sql);
    console.log(`  ✓ ${file}`);
  }

  console.log("\nVerification:");
  const tables = await pg.query(
    `select tablename from pg_tables
      where schemaname='public'
        and tablename = 'nex_account_device_key'`,
  );
  console.log(`  nex_account_device_key: ${tables.rows.length ? "present" : "MISSING"}`);

  const cols = await pg.query(
    `select column_name from information_schema.columns
      where table_name = 'nex_peer_message'
        and column_name in ('reactions', 'encrypted', 'ciphertext', 'nonce',
                             'delivered_at', 'message_group_id',
                             'sender_public_key', 'sender_device_id',
                             'recipient_device_id')
      order by column_name`,
  );
  console.log(`  nex_peer_message new cols: ${cols.rows.map((r) => r.column_name).join(", ")}`);

  const fn = await pg.query(
    `select proname from pg_proc
      where proname = 'nex_purge_delivered_encrypted_messages'`,
  );
  console.log(`  purge fn: ${fn.rows.length ? "present" : "MISSING"}`);
} finally {
  await pg.end();
}
