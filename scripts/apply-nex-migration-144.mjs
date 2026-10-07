// scripts/apply-nex-migration-144.mjs
//
// B.6A infrastructure repair · apply + verify migration 144.
// Adds `application/octet-stream` to nex-peer-chat-attachments bucket
// allowed_mime_types so the sealed Bridge 81 encrypted-attachment
// route can actually upload opaque ciphertext.
// Founder-authorised 2026-10-07.

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

const MIGRATION_FILE = "144_nex_peer_chat_attachments_bucket_allow_opaque.sql";
const EXPECTED_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";
const BUCKET_ID = "nex-peer-chat-attachments";
const NEW_MIME = "application/octet-stream";
const PRESERVED_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
];

if (!process.env.DATABASE_URL?.includes(EXPECTED_PROJECT_REF)) {
  console.error(`Refusing · DATABASE_URL not pointing at ${EXPECTED_PROJECT_REF}`);
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
  // Capture bucket state BEFORE.
  const before = await pg.query(
    `SELECT public, file_size_limit, allowed_mime_types
       FROM storage.buckets WHERE id = $1`,
    [BUCKET_ID],
  );
  if (before.rows.length !== 1) {
    console.error(`Bucket ${BUCKET_ID} does not exist · migration 055 missing?`);
    process.exit(2);
  }
  console.log(`\nBucket ${BUCKET_ID} BEFORE 144:`);
  console.log(`  public:             ${before.rows[0].public}`);
  console.log(`  file_size_limit:    ${before.rows[0].file_size_limit}`);
  console.log(`  allowed_mime_types: ${JSON.stringify(before.rows[0].allowed_mime_types)}`);
  const hadOctetBefore = (before.rows[0].allowed_mime_types ?? []).includes(NEW_MIME);
  console.log(`  (${hadOctetBefore ? "already" : "did NOT yet"} include ${NEW_MIME})\n`);

  console.log(`Applying ${MIGRATION_FILE} …`);
  const sql = fs.readFileSync(
    path.join(process.cwd(), "nex-supabase", "migrations", MIGRATION_FILE),
    "utf-8",
  );
  await pg.query(sql);
  console.log(`  ✓ committed\n`);

  // Capture bucket state AFTER.
  const after = await pg.query(
    `SELECT public, file_size_limit, allowed_mime_types
       FROM storage.buckets WHERE id = $1`,
    [BUCKET_ID],
  );
  const row = after.rows[0];
  console.log(`Bucket ${BUCKET_ID} AFTER 144:`);
  console.log(`  public:             ${row.public}`);
  console.log(`  file_size_limit:    ${row.file_size_limit}`);
  console.log(`  allowed_mime_types: ${JSON.stringify(row.allowed_mime_types)}\n`);

  // 1 · application/octet-stream is now in the whitelist.
  {
    const list = row.allowed_mime_types ?? [];
    record(
      `${BUCKET_ID} · allowed_mime_types now includes ${NEW_MIME}`,
      "true",
      String(list.includes(NEW_MIME)),
      list.includes(NEW_MIME),
    );
  }

  // 2 · All 055-era MIMEs are still present.
  {
    const list = new Set(row.allowed_mime_types ?? []);
    const missing = PRESERVED_MIMES.filter((m) => !list.has(m));
    record(
      "055 whitelist preserved · all image/video/audio MIMEs intact",
      "0 missing",
      `${missing.length} missing: [${missing.join(", ")}]`,
      missing.length === 0,
    );
  }

  // 3 · file_size_limit still 25 MB (26214400). pg returns bigint
  // as a string, so compare via Number().
  {
    const n = Number(row.file_size_limit);
    record(
      "file_size_limit unchanged · 25 MB",
      "26214400",
      String(row.file_size_limit),
      n === 26214400,
    );
  }

  // 4 · public still true.
  {
    record(
      "public read posture unchanged · true",
      "true",
      String(row.public),
      row.public === true,
    );
  }

  // 5 · No new buckets created · the one bucket is still the one bucket.
  {
    const q = await pg.query(
      `SELECT COUNT(*)::int AS n FROM storage.buckets WHERE id = $1`,
      [BUCKET_ID],
    );
    record(
      `Still exactly one ${BUCKET_ID} bucket · no accidental duplicate`,
      "1",
      String(q.rows[0].n),
      q.rows[0].n === 1,
    );
  }

  // 6 · Migration ledger row.
  {
    const q = await pg.query(
      `SELECT version FROM nex_migration_history WHERE version = '144'`,
    );
    record(
      "Migration ledger · row for 144 recorded",
      "1 row",
      String(q.rows.length),
      q.rows.length === 1,
    );
  }

  const pass = results.filter((r) => r.pass).length;
  const fail = results.filter((r) => !r.pass).length;
  console.log(`\n  ${pass} passed · ${fail} failed · ${results.length} total`);
  if (fail > 0) process.exit(1);
  console.log("\n✓ Migration 144 applied and verified.");
} finally {
  await pg.end();
}
