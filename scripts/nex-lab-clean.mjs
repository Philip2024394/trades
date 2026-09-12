#!/usr/bin/env node
// scripts/nex-lab-clean.mjs
//
// Founder ADR-0304 · Data cleaning · v1.
//
// Sweeps every Lab room and removes / flags data quality issues:
//   1. harvest_raw rows with empty name         → DELETE
//   2. harvest_raw rows with null/0,0 coords    → DELETE
//   3. harvest_raw rows with duplicate dedupe   → DELETE oldest (keep newest)
//   4. verified rows whose harvest source disappeared → DELETE
//   5. verified rows with confidence < 0.5      → DELETE (stale · re-verify with newer scorer)
//   6. Report per-room stats to data/nex-lab/clean.log
//
// Idempotent. Never touches nex.* (main NEX). Only cleans nex_lab_*.

import { existsSync, mkdirSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const LAB_DIR = join(REPO_ROOT, "data", "nex-lab");
const LOG_PATH = join(LAB_DIR, "clean.log");
const ROOMS = ["accommodation", "food", "transport", "business", "activities", "news"];

function log(line) {
  const ts = new Date().toISOString();
  const msg = `[${ts}] ${line}\n`;
  process.stdout.write(msg);
  try {
    if (!existsSync(LAB_DIR)) mkdirSync(LAB_DIR, { recursive: true });
    appendFileSync(LOG_PATH, msg);
  } catch { /* silent */ }
}

async function loadPg() { try { return (await import("pg")).Client; } catch { return null; } }
function readPgUrl() {
  return process.env.NEX_TAXONOMY_POSTGRES_URL
    ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

async function cleanRoom(client, roomSlug) {
  const schema = `nex_lab_${roomSlug}`;
  const out = { empty_name: 0, bad_coords: 0, dup_dedupe: 0, orphan_verified: 0, low_confidence: 0 };
  try {
    // 1. empty name (only for rooms with 'name' in payload · news uses 'title')
    if (roomSlug !== "news") {
      const r = await client.query(`
        DELETE FROM ${schema}.harvest_raw
        WHERE (payload->>'name') IS NULL OR trim(payload->>'name') = ''
      `);
      out.empty_name = r.rowCount ?? 0;
    }
    // 2. bad coords (only for geospatial rooms)
    if (roomSlug !== "news") {
      const r = await client.query(`
        DELETE FROM ${schema}.harvest_raw
        WHERE (payload->'coordinates'->>'lat') IS NULL
           OR (payload->'coordinates'->>'lon') IS NULL
           OR ((payload->'coordinates'->>'lat')::numeric = 0 AND (payload->'coordinates'->>'lon')::numeric = 0)
           OR abs((payload->'coordinates'->>'lat')::numeric) > 90
           OR abs((payload->'coordinates'->>'lon')::numeric) > 180
      `);
      out.bad_coords = r.rowCount ?? 0;
    }
    // 3. dedupe hash duplicates (keep newest)
    const r3 = await client.query(`
      DELETE FROM ${schema}.harvest_raw h
      WHERE h.record_id IN (
        SELECT record_id FROM (
          SELECT record_id, row_number() OVER (PARTITION BY dedupe_hash ORDER BY harvested_at DESC) AS rn
          FROM ${schema}.harvest_raw WHERE dedupe_hash IS NOT NULL
        ) x WHERE x.rn > 1
      )
    `);
    out.dup_dedupe = r3.rowCount ?? 0;
    // 4. orphaned verified · harvest_raw no longer contains the subject
    try {
      const r4 = await client.query(`
        DELETE FROM ${schema}.verified v
        WHERE NOT EXISTS (SELECT 1 FROM ${schema}.harvest_raw h WHERE h.dedupe_hash = v.subject_ref)
      `);
      out.orphan_verified = r4.rowCount ?? 0;
    } catch { /* verified table may not exist for empty rooms */ }
    // 5. very low confidence
    try {
      const r5 = await client.query(`DELETE FROM ${schema}.verified WHERE confidence < 0.50`);
      out.low_confidence = r5.rowCount ?? 0;
    } catch { /* ignore */ }
  } catch (err) {
    log(`  ${roomSlug} · err: ${String(err).slice(0, 200)}`);
  }
  return out;
}

async function main() {
  const t0 = Date.now();
  const Client = await loadPg();
  if (!Client) { log("pg missing"); process.exit(2); }
  const c = new Client({ connectionString: readPgUrl(), connectionTimeoutMillis: 8000 });
  await c.connect();
  log(`clean start · rooms=${ROOMS.join(",")}`);
  let totalDel = 0;
  try {
    for (const room of ROOMS) {
      const r = await cleanRoom(c, room);
      const roomTotal = Object.values(r).reduce((s, n) => s + n, 0);
      totalDel += roomTotal;
      log(`  ${room.padEnd(14)} · empty_name=${r.empty_name} bad_coords=${r.bad_coords} dup=${r.dup_dedupe} orphan_verified=${r.orphan_verified} low_conf=${r.low_confidence} · total=${roomTotal}`);
    }
    // VACUUM ANALYZE to reclaim space
    log(`vacuum analyze all lab schemas…`);
    for (const room of ROOMS) {
      try { await c.query(`VACUUM ANALYZE nex_lab_${room}.harvest_raw`); } catch { /* ignore */ }
      try { await c.query(`VACUUM ANALYZE nex_lab_${room}.verified`); } catch { /* ignore */ }
    }
  } finally { try { await c.end(); } catch { /* ignore */ } }
  log(`clean done · total_deleted=${totalDel} · ${Date.now() - t0}ms`);
  process.exit(0);
}

main().catch((err) => { log(`fatal: ${String(err).slice(0, 400)}`); process.exit(1); });
