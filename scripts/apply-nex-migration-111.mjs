// scripts/apply-nex-migration-111.mjs
//
// Applies Migration 111 · nex_gallery_image · Bridge Gallery-A.
// Idempotent · re-running is safe (CREATE TABLE IF NOT EXISTS).

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

const MIGRATION_FILE = "111_nex_gallery_image.sql";
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
      `SELECT version FROM nex_migration_history WHERE version = '111'`,
    );
    record("Ledger 111", "1 row", `${q.rows.length}`, q.rows.length === 1);
  }

  {
    const q = await pg.query(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns
        WHERE table_name = 'nex_gallery_image'
        ORDER BY ordinal_position`,
    );
    const expectedCols = [
      "id",
      "business_id",
      "image_url",
      "caption",
      "long_description",
      "sort_order",
      "created_at",
      "updated_at",
    ];
    const actualCols = q.rows.map((r) => r.column_name);
    record(
      "Table columns present",
      expectedCols.join(","),
      actualCols.join(","),
      expectedCols.every((c) => actualCols.includes(c)),
    );
  }

  {
    const q = await pg.query(
      `SELECT policyname FROM pg_policies
        WHERE tablename = 'nex_gallery_image'
        ORDER BY policyname`,
    );
    const names = q.rows.map((r) => r.policyname);
    record(
      "RLS policies present",
      "nex_gallery_image_deny_client_write, nex_gallery_image_public_read",
      names.join(", "),
      names.includes("nex_gallery_image_public_read") &&
        names.includes("nex_gallery_image_deny_client_write"),
    );
  }

  {
    const q = await pg.query(
      `SELECT indexname FROM pg_indexes
        WHERE tablename = 'nex_gallery_image'
          AND indexname = 'nex_gallery_image_business_idx'`,
    );
    record(
      "business_id + sort_order composite index",
      "1 row",
      `${q.rows.length}`,
      q.rows.length === 1,
    );
  }

  // Round-trip: create business + insert gallery row + read back + delete.
  const owner = await pg.query(
    `INSERT INTO nex_account (display_name) VALUES ($1) RETURNING id`,
    [`_m111_owner_${Math.random().toString(36).slice(2, 8)}`],
  );
  const ownerId = owner.rows[0].id;
  const slug = `m111biz${Math.random().toString(36).slice(2, 10)}`;
  const biz = await pg.query(
    `INSERT INTO nex_business (owner_account_id, display_name, slug, market_reach, accepts_cod, accepts_pickup, samples_available, accepts_oem, local_postage_included)
       VALUES ($1,$2,$3,'local',false,false,false,false,false) RETURNING id`,
    [ownerId, "M111 Roundtrip", slug],
  );
  const bizId = biz.rows[0].id;

  const testUrl =
    "https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-business-assets/gallery/roundtrip/photo.png";
  const ins = await pg.query(
    `INSERT INTO nex_gallery_image
       (business_id, image_url, caption, long_description, sort_order)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, caption, long_description, sort_order`,
    [
      bizId,
      testUrl,
      "Studio front on rainy morning",
      "This is the studio front on a rainy Ubud morning. The wooden facade was built from reclaimed teak sourced in Denpasar.",
      3,
    ],
  );
  record(
    "Insert row · caption + long_description + sort_order round-trip",
    "caption='Studio front on rainy morning' · sort_order=3",
    `caption='${ins.rows[0].caption}' · sort_order=${ins.rows[0].sort_order}`,
    ins.rows[0].caption === "Studio front on rainy morning" &&
      ins.rows[0].sort_order === 3,
  );

  const readback = await pg.query(
    `SELECT image_url, caption, long_description
       FROM nex_gallery_image WHERE business_id = $1`,
    [bizId],
  );
  record(
    "Read back gallery row",
    testUrl,
    `${readback.rows[0].image_url}`,
    readback.rows[0].image_url === testUrl,
  );

  // Verify caption length CHECK
  try {
    await pg.query(
      `INSERT INTO nex_gallery_image (business_id, image_url, caption)
         VALUES ($1, $2, $3)`,
      [bizId, testUrl, "x".repeat(201)],
    );
    record(
      "CHECK constraint · caption > 200 chars rejected",
      "throws",
      "no error",
      false,
    );
  } catch (e) {
    record(
      "CHECK constraint · caption > 200 chars rejected",
      "throws",
      "threw as expected",
      /caption_len/.test(e.message) || /check constraint/i.test(e.message),
    );
  }

  await pg.query(`DELETE FROM nex_gallery_image WHERE business_id = $1`, [
    bizId,
  ]);
  await pg.query(`DELETE FROM nex_business WHERE id = $1`, [bizId]);
  await pg.query(`DELETE FROM nex_account WHERE id = $1`, [ownerId]);

  const pass = results.filter((r) => r.pass).length;
  const fail = results.filter((r) => !r.pass).length;
  console.log(
    `\n  ${pass} passed · ${fail} failed · ${results.length} total`,
  );
  if (fail > 0) process.exit(1);
  console.log("\n✓ Migration 111 applied and verified.");
} finally {
  await pg.end();
}
