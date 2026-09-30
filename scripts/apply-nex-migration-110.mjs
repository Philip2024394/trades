// scripts/apply-nex-migration-110.mjs

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

const MIGRATION_FILE = "110_nex_business_qr_code.sql";
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

  {
    const q = await pg.query(
      `SELECT version FROM nex_migration_history WHERE version = '110'`,
    );
    record("Ledger 110", "1 row", `${q.rows.length}`, q.rows.length === 1);
  }

  {
    const q = await pg.query(
      `SELECT column_name, data_type FROM information_schema.columns
        WHERE table_name = 'nex_business' AND column_name = 'qr_code_image_url'`,
    );
    record(
      "Column nex_business.qr_code_image_url (text)",
      "1 row · data_type=text",
      JSON.stringify(q.rows[0] || null),
      q.rows.length === 1 && q.rows[0].data_type === "text",
    );
  }

  {
    const q = await pg.query(
      `SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'nex-business-assets'`,
    );
    record(
      "Bucket nex-business-assets exists · public · 2MB cap",
      "1 row · public=true · file_size_limit=2097152",
      JSON.stringify(q.rows[0] || null),
      q.rows.length === 1 &&
        q.rows[0].public === true &&
        Number(q.rows[0].file_size_limit) === 2097152,
    );
  }

  {
    const q = await pg.query(
      `SELECT policyname FROM pg_policies
        WHERE tablename = 'objects'
          AND policyname = 'nex_business_assets_public_read'`,
    );
    record(
      "Public-read RLS policy on storage.objects present",
      "1 row",
      `${q.rows.length}`,
      q.rows.length === 1,
    );
  }

  // Round-trip: create biz + set qr_code_image_url + read back
  const owner = await pg.query(
    `INSERT INTO nex_account (display_name) VALUES ($1) RETURNING id`,
    [`_m110_owner_${Math.random().toString(36).slice(2, 8)}`],
  );
  const ownerId = owner.rows[0].id;
  const slug = `m110biz${Math.random().toString(36).slice(2, 10)}`;
  const biz = await pg.query(
    `INSERT INTO nex_business (owner_account_id, display_name, slug, market_reach, accepts_cod, accepts_pickup, samples_available, accepts_oem, local_postage_included)
       VALUES ($1,$2,$3,'local',false,false,false,false,false) RETURNING id, qr_code_image_url`,
    [ownerId, "M110 Roundtrip", slug],
  );
  record(
    "Default qr_code_image_url NULL on insert",
    "null",
    `${biz.rows[0].qr_code_image_url}`,
    biz.rows[0].qr_code_image_url === null,
  );

  const testUrl =
    "https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-business-assets/roundtrip/qr.png";
  await pg.query(
    `UPDATE nex_business SET qr_code_image_url = $1 WHERE id = $2`,
    [testUrl, biz.rows[0].id],
  );
  const readback = await pg.query(
    `SELECT qr_code_image_url FROM nex_business WHERE id = $1`,
    [biz.rows[0].id],
  );
  record(
    "Round-trip · qr_code_image_url persists",
    testUrl,
    `${readback.rows[0].qr_code_image_url}`,
    readback.rows[0].qr_code_image_url === testUrl,
  );

  await pg.query(`DELETE FROM nex_business WHERE id = $1`, [biz.rows[0].id]);
  await pg.query(`DELETE FROM nex_account WHERE id = $1`, [ownerId]);

  const pass = results.filter((r) => r.pass).length;
  const fail = results.filter((r) => !r.pass).length;
  console.log(
    `\n  ${pass} passed · ${fail} failed · ${results.length} total`,
  );
  if (fail > 0) process.exit(1);
  console.log("\n✓ Migration 110 applied and verified.");
} finally {
  await pg.end();
}
