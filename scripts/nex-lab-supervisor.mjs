#!/usr/bin/env node
// scripts/nex-lab-supervisor.mjs
//
// Founder ADR-0304 · Lab Supervisor (single-shot cycle).
// Windows Scheduled Task fires this every 30 min. Each invocation:
//   1. Snapshots row counts per Lab room → nex_lab.growth_history
//   2. Checks pending promotion count
//   3. Rotates + prunes Lab ledgers
//   4. Reports to data/nex-lab/supervisor.log
//
// Idempotent. Safe to run 100x/day. Never blocks.

import { readdirSync, statSync, existsSync, mkdirSync, appendFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const LAB_DIR = join(REPO_ROOT, "data", "nex-lab");
const LOG_PATH = join(LAB_DIR, "supervisor.log");

function log(line) {
  const ts = new Date().toISOString();
  const msg = `[${ts}] ${line}\n`;
  process.stdout.write(msg);
  try {
    if (!existsSync(LAB_DIR)) mkdirSync(LAB_DIR, { recursive: true });
    appendFileSync(LOG_PATH, msg);
  } catch { /* never break */ }
}

async function loadPgClient() {
  try {
    const { Client } = await import("pg");
    return Client;
  } catch { return null; }
}

function readLocalPgUrl() {
  try {
    const env = readFileSync(join(REPO_ROOT, ".env.local"), "utf8");
    const m = env.match(/^NEX_TAXONOMY_POSTGRES_URL\s*=\s*(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch { /* ignore */ }
  return "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

async function snapshotRoomGrowth(Client, url) {
  const c = new Client({ connectionString: url, connectionTimeoutMillis: 8000 });
  await c.connect();
  try {
    const rooms = (await c.query("SELECT room_slug, schema_name FROM nex_lab.rooms ORDER BY room_slug")).rows;
    let snapshotsWritten = 0;
    for (const r of rooms) {
      for (const [metricKey, tableName] of [["harvest_rows", "harvest_raw"], ["verified_rows", "verified"]]) {
        try {
          const cnt = (await c.query(`SELECT count(*)::bigint c FROM ${r.schema_name}.${tableName}`)).rows[0].c;
          await c.query(
            `INSERT INTO nex_lab.growth_history (room_slug, metric_key, metric_value) VALUES ($1, $2, $3)`,
            [r.room_slug, metricKey, Number(cnt)],
          );
          snapshotsWritten++;
        } catch { /* room may not have table yet · skip */ }
      }
    }
    return { rooms: rooms.length, snapshots: snapshotsWritten };
  } finally {
    try { await c.end(); } catch { /* ignore */ }
  }
}

async function countPendingPromotions(Client, url) {
  const c = new Client({ connectionString: url, connectionTimeoutMillis: 5000 });
  await c.connect();
  try {
    const r = await c.query("SELECT count(*)::int c FROM nex_lab.promotion_events WHERE status = 'pending'");
    return r.rows[0].c;
  } finally {
    try { await c.end(); } catch { /* ignore */ }
  }
}

function rotateLabLedgers() {
  let rotated = 0, pruned = 0;
  try {
    if (!existsSync(LAB_DIR)) return { rotated, pruned };
    const ROTATE_AT = 5 * 1024 * 1024;
    const KEEP_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    function scan(dir) {
      let entries;
      try { entries = readdirSync(dir); } catch { return; }
      for (const name of entries) {
        const full = join(dir, name);
        try {
          const st = statSync(full);
          if (st.isDirectory()) { scan(full); continue; }
          if (!name.endsWith(".jsonl")) continue;
          if (name === "supervisor.log") continue;
          if (st.size >= ROTATE_AT) {
            const stamp = new Date().toISOString().replace(/[-:.]/g, "").replace(/Z$/, "Z");
            const { renameSync } = require("node:fs");
            try { renameSync(full, `${full}.${stamp}.archived`); rotated++; } catch { /* ignore */ }
          }
          if (name.includes(".archived") && (now - st.mtimeMs) > KEEP_MS) {
            const { unlinkSync } = require("node:fs");
            try { unlinkSync(full); pruned++; } catch { /* ignore */ }
          }
        } catch { /* per-file */ }
      }
    }
    scan(LAB_DIR);
  } catch { /* ignore */ }
  return { rotated, pruned };
}

async function main() {
  const t0 = Date.now();
  log(`lab-supervisor start · pid=${process.pid}`);

  const Client = await loadPgClient();
  if (!Client) { log("pg module missing · skipping DB steps"); process.exit(0); }
  const url = readLocalPgUrl();

  try {
    const growth = await snapshotRoomGrowth(Client, url);
    log(`growth · ${growth.rooms} rooms · ${growth.snapshots} snapshots written`);
  } catch (err) {
    log(`growth err: ${String(err).slice(0, 200)}`);
  }

  try {
    const pending = await countPendingPromotions(Client, url);
    log(`promotions · pending=${pending}`);
  } catch (err) {
    log(`promotions err: ${String(err).slice(0, 200)}`);
  }

  const rot = rotateLabLedgers();
  log(`rotate · ${rot.rotated} rotated · ${rot.pruned} pruned`);

  const durMs = Date.now() - t0;
  log(`lab-supervisor done · ${durMs}ms`);
  process.exit(0);
}

main().catch((err) => { log(`fatal: ${String(err).slice(0, 500)}`); process.exit(1); });
