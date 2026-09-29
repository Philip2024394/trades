#!/usr/bin/env node
// scripts/nex-e2e/purge-delivered-encrypted.mjs
//
// Bridge 78 · Manual (or external-cron) trigger for the delivered-
// encrypted purge. Calls the nex_purge_delivered_encrypted_messages()
// SQL function shipped by migration 094 and prints how many rows the
// server dropped.
//
// Bridge 87 extension: BEFORE calling the SQL function, walks the ripe
// rows that carry an encrypted attachment envelope and deletes the
// corresponding object from the nex-peer-chat-attachments bucket. This
// closes the "phone is the database" loop for media — without it,
// encrypted attachment bytes would linger in storage after their
// message rows were purged (the SQL function cannot call storage APIs).
//
// Usage:
//   node scripts/nex-e2e/purge-delivered-encrypted.mjs           # 7-day retention
//   node scripts/nex-e2e/purge-delivered-encrypted.mjs --days 3  # 3-day retention
//   node scripts/nex-e2e/purge-delivered-encrypted.mjs --dry-run # count only
//
// Environment:
//   DATABASE_URL                    · Postgres connection string
//   NEXT_PUBLIC_SUPABASE_URL        · Supabase REST base for storage API
//   SUPABASE_SERVICE_ROLE_KEY       · storage-delete authority
//
// External-cron examples:
//   · Vercel Cron:    schedule "0 * * * *" pointing at a /api/cron route
//                     that spawns this script
//   · GitHub Actions: schedule workflow that runs this script
//   · Systemd timer:  OnCalendar=hourly

import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

const BUCKET = "nex-peer-chat-attachments";
const STORAGE_PREFIX = "enc/"; // Bridge 81 layout

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
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

function arg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx > -1 ? process.argv[idx + 1] : fallback;
}
const dryRun = process.argv.includes("--dry-run");
const days = Number.parseInt(arg("days", "7"), 10);
if (!Number.isFinite(days) || days < 1) {
  console.error(`Invalid --days value: ${days}. Must be >= 1.`);
  process.exit(1);
}

// Storage delete helper · Supabase Storage API. Only invoked for
// URLs that resolve to our bucket + encrypted prefix.
async function deleteStorageObjects(paths) {
  if (paths.length === 0) return { ok: true, deleted: 0 };
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) {
    return { ok: false, error: "supabase_env_missing" };
  }
  const url = `${base}/storage/v1/object/${BUCKET}`;
  const resp = await fetch(url, {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${key}`,
      "apikey": key,
    },
    body: JSON.stringify({ prefixes: paths }),
  });
  if (!resp.ok) {
    return { ok: false, error: `${resp.status} ${resp.statusText}` };
  }
  return { ok: true, deleted: paths.length };
}

/** Parse a storage_path out of a public URL. Returns null if the URL
 *  isn't shape-matching our bucket + prefix. */
function pathFromPublicUrl(url) {
  if (typeof url !== "string") return null;
  const marker = `/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const path = url.slice(idx + marker.length);
  if (!path.startsWith(STORAGE_PREFIX)) return null;
  return path;
}

const pg = new Client({ connectionString: process.env.DATABASE_URL });
await pg.connect();

try {
  // 1. Find ripe encrypted rows that carry an attachment envelope.
  const ripe = await pg.query(
    `select id, attachment_meta
       from nex_peer_message
      where encrypted = true
        and delivered_at is not null
        and delivered_at < (now() - ($1 || ' days')::interval)
        and attachment_meta is not null`,
    [days],
  );

  const storagePaths = [];
  for (const row of ripe.rows) {
    const env = row.attachment_meta?.envelope;
    if (!env || typeof env !== "object") continue;
    const p = pathFromPublicUrl(env.storage_url);
    if (p) storagePaths.push(p);
  }

  if (dryRun) {
    const count = await pg.query(
      `select count(*)::int as n
         from nex_peer_message
        where encrypted = true
          and delivered_at is not null
          and delivered_at < (now() - ($1 || ' days')::interval)`,
      [days],
    );
    console.log(
      `[dry-run] Would purge ${count.rows[0].n} encrypted rows older than ${days}d.`,
    );
    console.log(
      `[dry-run] Would also delete ${storagePaths.length} encrypted attachment object${storagePaths.length === 1 ? "" : "s"} from ${BUCKET}.`,
    );
  } else {
    // 2. Delete storage objects FIRST · a partial failure leaves the
    // row (safe · we can retry), whereas deleting the row first would
    // orphan the object.
    if (storagePaths.length > 0) {
      const del = await deleteStorageObjects(storagePaths);
      if (!del.ok) {
        console.warn(
          `Storage delete failed (${del.error}) · continuing to row purge · rerun to retry orphans.`,
        );
      } else {
        console.log(
          `Deleted ${del.deleted} encrypted attachment object${del.deleted === 1 ? "" : "s"}.`,
        );
      }
    }

    // 3. Purge rows.
    const result = await pg.query(
      "select nex_purge_delivered_encrypted_messages($1) as purged",
      [days],
    );
    const n = result.rows[0].purged;
    console.log(
      `Purged ${n} encrypted peer-message row${n === 1 ? "" : "s"} older than ${days}d.`,
    );
  }
} finally {
  await pg.end();
}
