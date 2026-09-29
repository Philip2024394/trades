#!/usr/bin/env node
// scripts/nex-e2e/purge-delivered-encrypted.mjs
//
// Bridge 78 · Manual (or external-cron) trigger for the delivered-
// encrypted purge. Calls the nex_purge_delivered_encrypted_messages()
// SQL function shipped by migration 094 and prints how many rows the
// server dropped.
//
// Usage:
//   node scripts/nex-e2e/purge-delivered-encrypted.mjs           # 7-day retention
//   node scripts/nex-e2e/purge-delivered-encrypted.mjs --days 3  # 3-day retention
//   node scripts/nex-e2e/purge-delivered-encrypted.mjs --dry-run # count only
//
// Environment:
//   DATABASE_URL   ·  Postgres connection string for the NEX project
//                     (Supabase → Project Settings → Database → Connection string)
//
// External-cron examples:
//   · Vercel Cron:    schedule "0 * * * *" pointing at a /api/cron route
//                     that spawns this script
//   · GitHub Actions: schedule workflow that runs this script
//   · Systemd timer:  OnCalendar=hourly

import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

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

const pg = new Client({ connectionString: process.env.DATABASE_URL });
await pg.connect();

try {
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
  } else {
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
