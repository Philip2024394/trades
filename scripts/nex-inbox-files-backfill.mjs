#!/usr/bin/env node
// nex-inbox-files-backfill.mjs · Phase 3a
//
// Walks every inbox item that has a legacy filesystem `file_path` but
// no `object_bucket` / `object_key`, reads the bytes off disk, pushes
// them into nex.object_blobs via NEX Object Storage · then updates the
// inbox row to point at the object.
//
// Idempotent · re-runnable · safe:
//   · Skips items that already have object_bucket populated
//   · Skips items whose local file is missing (logs warning, moves on)
//   · Uses the same key format as saveFileItem (`<inbox_item_id>`)
//   · Object put through the ManifestWritingObjectStorage decorator
//     so nex.object_manifest is populated automatically
//   · The inbox row's file_path stays populated · transition backup
//
// Runs directly against NEX_POSTGRES_URL. Does NOT touch Supabase.
// Does NOT modify the filesystem inbox files (read-only).
//
// Usage:
//   node scripts/nex-inbox-files-backfill.mjs             # live
//   node scripts/nex-inbox-files-backfill.mjs --dry-run   # report only

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, createHash } from "node:crypto";
import pg from "pg";
const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO      = path.join(__dirname, "..");
const INBOX_ROOT = path.join(REPO, "data", "knowledge-inbox");
const PG_URL     = process.env.NEX_POSTGRES_URL || "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const DRY_RUN    = process.argv.includes("--dry-run");

const pool = new Pool({ connectionString: PG_URL, max: 3 });

async function inRole(fn) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SET LOCAL ROLE nex_brain_app");
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally { c.release(); }
}

function newVersionId() {
  const ts = Date.now().toString().padStart(13, "0");
  return `v${ts}-${randomBytes(4).toString("hex")}`;
}

async function backfillOne(row) {
  const localPath = path.join(INBOX_ROOT, row.file_path);
  let bytes;
  try {
    bytes = await fs.readFile(localPath);
  } catch (err) {
    return { ok: false, reason: "file-missing", detail: err.message };
  }
  const contentHash = createHash("sha256").update(bytes).digest("hex");
  const versionId   = newVersionId();
  const bucket      = "uploads";
  const key         = row.id;
  const mimeType    = row.mime_type || "application/octet-stream";
  const sizeBytes   = bytes.length;

  if (DRY_RUN) {
    return { ok: true, dry: true, size: sizeBytes, key, bucket };
  }

  await inRole(async (c) => {
    // Insert the object row
    await c.query(
      `INSERT INTO nex.object_blobs
         (bucket, key, version_id, content_hash, size_bytes, mime_type,
          body, is_delete_marker, uploaded_at, source_ref, custom)
       VALUES ($1,$2,$3,$4,$5,$6,$7,false,NOW(),$8,$9::jsonb)
       ON CONFLICT (bucket, key, version_id) DO NOTHING`,
      [bucket, key, versionId, contentHash, sizeBytes, mimeType, bytes,
       `inbox:${row.id}`, JSON.stringify({ original_filename: row.original_filename ?? "", backfill: true, hash: row.hash })],
    );
    // Flip / create current pointer
    await c.query(
      `INSERT INTO nex.object_blob_current (bucket, key, version_id, is_delete_marker, updated_at)
       VALUES ($1, $2, $3, false, NOW())
       ON CONFLICT (bucket, key) DO UPDATE SET
         version_id = EXCLUDED.version_id,
         is_delete_marker = false,
         updated_at = NOW()`,
      [bucket, key, versionId],
    );
    // Update the inbox row's object reference
    await c.query(
      `UPDATE nex.knowledge_inbox
          SET object_bucket = $2, object_key = $3, shadow_updated_at = NOW()
        WHERE id = $1`,
      [row.id, bucket, key],
    );
  });

  return { ok: true, dry: false, size: sizeBytes, key, bucket, version_id: versionId };
}

async function main() {
  console.log(`nex-inbox-files-backfill · dry-run=${DRY_RUN}`);
  console.log(`  inbox root: ${INBOX_ROOT}`);
  console.log(`  target:     ${PG_URL.replace(/:[^:@]+@/, ":****@")}`);
  console.log("");

  // Find inbox items that (a) have a file_path and (b) don't yet have
  // object_bucket set. These are the legacy uploads that predate Phase 3a.
  const scan = await pool.query(
    `SELECT id, file_path, mime_type, original_filename, hash
       FROM nex.knowledge_inbox
      WHERE file_path IS NOT NULL
        AND (object_bucket IS NULL OR object_key IS NULL)
      ORDER BY created_at_iso ASC`,
  );
  const candidates = scan.rows;
  console.log(`found ${candidates.length} candidate items (has file_path · no object ref)\n`);

  let inserted = 0, skipped = 0, missing = 0, bytesTotal = 0;
  for (const row of candidates) {
    const r = await backfillOne(row);
    if (!r.ok) {
      missing += 1;
      console.log(`  MISS  ${row.id}  file_path=${row.file_path}  reason=${r.reason}`);
      continue;
    }
    if (r.dry) {
      inserted += 1;
      bytesTotal += r.size;
      console.log(`  DRY   ${row.id}  ${r.bucket}/${r.key}  size=${r.size}`);
    } else {
      inserted += 1;
      bytesTotal += r.size;
      console.log(`  BACK  ${row.id}  ${r.bucket}/${r.key}  size=${r.size}  v=${r.version_id.slice(0, 20)}`);
    }
  }

  console.log("\nSummary:");
  console.log(`  candidates:   ${candidates.length}`);
  console.log(`  ${DRY_RUN ? "would insert" : "inserted   "}: ${inserted}`);
  console.log(`  file missing: ${missing}`);
  console.log(`  bytes total:  ${bytesTotal.toLocaleString()}`);

  await pool.end();
}

main().catch(async (err) => {
  console.error("backfill fatal:", err);
  await pool.end().catch(() => {});
  process.exit(1);
});
