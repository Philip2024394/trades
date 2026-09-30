// scripts/apply-nex-migration-109.mjs

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

const MIGRATION_FILE = "109_nex_business_info_pages.sql";
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
      `SELECT version FROM nex_migration_history WHERE version = '109'`,
    );
    record("Ledger 109", "1 row", `${q.rows.length}`, q.rows.length === 1);
  }

  {
    const q = await pg.query(
      `SELECT column_name, data_type FROM information_schema.columns
        WHERE table_name = 'nex_business' AND column_name = 'info_pages'`,
    );
    record(
      "Column nex_business.info_pages (jsonb)",
      "1 row · data_type=jsonb",
      JSON.stringify(q.rows[0] || null),
      q.rows.length === 1 && q.rows[0].data_type === "jsonb",
    );
  }

  // Round-trip: create biz + write a full info_pages payload + read back
  const owner = await pg.query(
    `INSERT INTO nex_account (display_name) VALUES ($1) RETURNING id`,
    [`_m109_owner_${Math.random().toString(36).slice(2, 8)}`],
  );
  const ownerId = owner.rows[0].id;
  const slug = `m109biz${Math.random().toString(36).slice(2, 10)}`;
  const biz = await pg.query(
    `INSERT INTO nex_business (owner_account_id, display_name, slug, market_reach, accepts_cod, accepts_pickup, samples_available, accepts_oem, local_postage_included)
       VALUES ($1,$2,$3,'local',false,false,false,false,false) RETURNING id`,
    [ownerId, "M109 Roundtrip", slug],
  );
  const bizId = biz.rows[0].id;

  const payload = {
    delivery_details:
      "We deliver Ubud + Denpasar 08:00-21:00 · last order 20:30",
    custom_orders:
      "Yes — pick your own filling, packaging, message on the box",
    services_scope: null,
    custom_buttons: [
      {
        icon: "☕",
        label: "Beans we use",
        body: "Single-origin Bali arabica from Kintamani farmers.",
        image_url: null,
        external_url: null,
      },
      {
        icon: "🎨",
        label: "Custom cakes",
        body: "Wedding + birthday cakes · Rp 300k+",
        image_url: null,
        external_url: "https://mariascakes.com",
      },
    ],
  };
  await pg.query(
    `UPDATE nex_business SET info_pages = $1::jsonb WHERE id = $2`,
    [JSON.stringify(payload), bizId],
  );
  const readback = await pg.query(
    `SELECT info_pages FROM nex_business WHERE id = $1`,
    [bizId],
  );
  record(
    "Round-trip · full info_pages payload persists (jsonb)",
    "custom_buttons.length=2 · delivery_details non-null",
    JSON.stringify({
      buttonsLen: readback.rows[0].info_pages.custom_buttons.length,
      deliveryPresent: !!readback.rows[0].info_pages.delivery_details,
    }),
    readback.rows[0].info_pages.custom_buttons.length === 2 &&
      !!readback.rows[0].info_pages.delivery_details,
  );

  // NULL default check
  const bizNull = await pg.query(
    `INSERT INTO nex_business (owner_account_id, display_name, slug, market_reach, accepts_cod, accepts_pickup, samples_available, accepts_oem, local_postage_included)
       VALUES ($1,$2,$3,'local',false,false,false,false,false) RETURNING id, info_pages`,
    [ownerId, "M109 Null Check", `m109null${Math.random().toString(36).slice(2, 10)}`],
  );
  record(
    "Default info_pages NULL on insert",
    "null",
    `${bizNull.rows[0].info_pages}`,
    bizNull.rows[0].info_pages === null,
  );

  await pg.query(`DELETE FROM nex_business WHERE id IN ($1, $2)`, [
    bizId,
    bizNull.rows[0].id,
  ]);
  await pg.query(`DELETE FROM nex_account WHERE id = $1`, [ownerId]);

  const pass = results.filter((r) => r.pass).length;
  const fail = results.filter((r) => !r.pass).length;
  console.log(
    `\n  ${pass} passed · ${fail} failed · ${results.length} total`,
  );
  if (fail > 0) process.exit(1);
  console.log("\n✓ Migration 109 applied and verified.");
} finally {
  await pg.end();
}
