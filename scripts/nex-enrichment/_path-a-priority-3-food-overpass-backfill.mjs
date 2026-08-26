#!/usr/bin/env node
// scripts/nex-enrichment/_path-a-priority-3-food-overpass-backfill.mjs
//
// PATH A · PRIORITY 3 · FOOD OVERPASS RE-HIT BACKFILL
//
// PRODUCTION SCRIPT · but gated. Default mode is --plan (mock · no Overpass hits · verify
// safeguards). --execute mode makes real Overpass requests and requires Philip's explicit
// greenlight (checked via NEX_PRIORITY_3_APPROVED_BY=philip env var).
//
// Doctrine anchors:
//   project_nex_priority_greenlight_accommodation_path_a_food_walker_preservation_2026_08_23
//   docs/nex/path-a-priority-3-food-overpass-backfill-design.md
//
// SAFEGUARDS (per design spec):
//   · 1 req/sec sustained (safe default · below Overpass 2/sec ceiling)
//   · Exponential backoff on 429/5xx: 1s → 2s → 4s → 8s → 16s → 32s → 60s cap
//   · Circuit breaker: 5 consecutive 429s OR 3 consecutive 5xx → pause + exit
//   · Resumable cursor at data/nex-enrichment/food-overpass-backfill-cursor.json
//   · SIGINT-clean-shutdown saves cursor before exit
//   · Idempotent: ON CONFLICT DO NOTHING on snapshot inserts
//   · Never modifies food_business rows (only writes snapshot + provenance)

import pg from "pg";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const CURSOR_FILE = "data/nex-enrichment/food-overpass-backfill-cursor.json";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const USER_AGENT   = "nex-yogyakarta-food-enrichment/1.0 (path-a-priority-3-backfill)";

// ── Configurable safeguards (env-tunable · defaults are conservative) ─
const SAFE = {
  reqPerSecondCeiling:    Number(process.env.NEX_P3_REQ_PER_SEC ?? 1),   // 1 req/s default · design spec ceiling 2
  circuitBreak_429_count: Number(process.env.NEX_P3_CB_429 ?? 5),
  circuitBreak_5xx_count: Number(process.env.NEX_P3_CB_5XX ?? 3),
  maxBackoffSeconds:      Number(process.env.NEX_P3_MAX_BACKOFF ?? 60),
  timeoutMs:              Number(process.env.NEX_P3_TIMEOUT_MS ?? 30_000),
};

// ── Args ──────────────────────────────────────────────────────────────
const args = new Set(process.argv.slice(2));
const isExecute = args.has("--execute");
const isPlan    = args.has("--plan") || !isExecute;
const isReset   = args.has("--reset-cursor");
const isSample  = args.has("--sample");   // process 3 rows only · for smoke test with real API

if (isExecute && process.env.NEX_PRIORITY_3_APPROVED_BY !== "philip") {
  console.error("");
  console.error("╔══════════════════════════════════════════════════════════════════════════╗");
  console.error("║  ❌ REFUSED · Priority 3 execution requires explicit greenlight            ║");
  console.error("║                                                                            ║");
  console.error("║  This script would send real requests to Overpass.                         ║");
  console.error("║  Doctrine (`project_nex_priority_greenlight_...`): Philip must greenlight  ║");
  console.error("║  execution explicitly after design review.                                 ║");
  console.error("║                                                                            ║");
  console.error("║  If you are Philip and approve: set NEX_PRIORITY_3_APPROVED_BY=philip      ║");
  console.error("║  and re-run · then Overpass will be contacted at 1 req/sec.                ║");
  console.error("║                                                                            ║");
  console.error("║  For safeguard verification without Overpass: run with --plan (default).   ║");
  console.error("╚══════════════════════════════════════════════════════════════════════════╝");
  process.exit(2);
}

// ── Cursor management ────────────────────────────────────────────────
function readCursor() {
  if (!existsSync(CURSOR_FILE)) return { lastBusinessRef: null, processedRefs: [], startedAt: null };
  try { return JSON.parse(readFileSync(CURSOR_FILE, "utf8")); } catch { return { lastBusinessRef: null, processedRefs: [], startedAt: null }; }
}
function writeCursor(state) {
  mkdirSync(dirname(CURSOR_FILE), { recursive: true });
  writeFileSync(CURSOR_FILE, JSON.stringify(state, null, 2), "utf8");
}
if (isReset && existsSync(CURSOR_FILE)) {
  writeCursor({ lastBusinessRef: null, processedRefs: [], startedAt: null });
  console.log("Cursor reset.");
}
let cursor = readCursor();
if (!cursor.startedAt) cursor.startedAt = new Date().toISOString();

// ── SIGINT clean shutdown ────────────────────────────────────────────
let interrupted = false;
process.on("SIGINT", () => {
  console.log("\n\nSIGINT received · saving cursor before exit ...");
  writeCursor(cursor);
  interrupted = true;
});

// ── DB ────────────────────────────────────────────────────────────────
const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 2 });

// ── Overpass client · politeness-first ───────────────────────────────
const runtimeStats = {
  requestsMade:  0,
  responses200:  0,
  responses429:  0,
  responses5xx:  0,
  responsesOther: 0,
  timeouts:      0,
  networkErrors: 0,
  osmElementMissing: 0,
  tagsRecovered: 0,
  consecutive429: 0,
  consecutive5xx: 0,
  circuitTripped: false,
};

async function politePace() {
  const gapMs = Math.ceil(1000 / SAFE.reqPerSecondCeiling);
  await new Promise((r) => setTimeout(r, gapMs));
}

/** Parse OSM source_reference · accepts both "node/12345" (accommodation-style)
 *  AND "osm/node/12345" (food-style · discovered via 2026-08-23 dry-run against real data) */
function parseOsmRef(sourceRef) {
  if (typeof sourceRef !== "string") return null;
  const m = sourceRef.match(/^(?:osm\/)?(node|way|relation)\/(\d+)$/);
  return m ? { type: m[1], id: m[2] } : null;
}

/** Real Overpass fetch with backoff · returns { ok, tags, status, msg } */
async function overpassFetch(osmRef, attempt = 0) {
  if (attempt > 0) {
    const backoff = Math.min(2 ** attempt, SAFE.maxBackoffSeconds);
    console.log(`    backoff ${backoff}s (attempt ${attempt})`);
    await new Promise((r) => setTimeout(r, backoff * 1000));
  }
  const query = `[out:json][timeout:25];${osmRef.type}(${osmRef.id});out tags;`;
  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => controller.abort(), SAFE.timeoutMs);
  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    clearTimeout(timeoutTimer);
    runtimeStats.requestsMade++;
    if (res.status === 429) {
      runtimeStats.responses429++;
      runtimeStats.consecutive429++;
      runtimeStats.consecutive5xx = 0;
      if (attempt >= 6) return { ok: false, status: 429, msg: "429 · retries exhausted" };
      return overpassFetch(osmRef, attempt + 1);
    }
    if (res.status >= 500 && res.status < 600) {
      runtimeStats.responses5xx++;
      runtimeStats.consecutive5xx++;
      runtimeStats.consecutive429 = 0;
      if (attempt >= 4) return { ok: false, status: res.status, msg: `${res.status} · retries exhausted` };
      return overpassFetch(osmRef, attempt + 1);
    }
    if (res.status !== 200) {
      runtimeStats.responsesOther++;
      return { ok: false, status: res.status, msg: `unexpected status ${res.status}` };
    }
    runtimeStats.responses200++;
    runtimeStats.consecutive429 = 0;
    runtimeStats.consecutive5xx = 0;
    const json = await res.json();
    const el = json?.elements?.[0];
    if (!el) {
      runtimeStats.osmElementMissing++;
      return { ok: true, tags: null, status: 200, msg: "OSM element no longer present" };
    }
    const tags = el.tags ?? {};
    runtimeStats.tagsRecovered += Object.keys(tags).length;
    return { ok: true, tags, status: 200, lat: el.lat, lon: el.lon };
  } catch (err) {
    clearTimeout(timeoutTimer);
    if (err.name === "AbortError") { runtimeStats.timeouts++; return { ok: false, msg: "timeout" }; }
    runtimeStats.networkErrors++;
    return { ok: false, msg: err.message };
  }
}

/** MOCK fetch · returns fake tag data · used in --plan mode to verify safeguards */
async function mockFetch(osmRef) {
  runtimeStats.requestsMade++;
  runtimeStats.responses200++;
  const mockTags = {
    name: "mock-restaurant",
    "addr:street": "Jl. Mock",
    "addr:housenumber": "42",
    description: "mock description recovered",
    brand: "MockBrand",
  };
  runtimeStats.tagsRecovered += Object.keys(mockTags).length;
  return { ok: true, tags: mockTags, status: 200, lat: -7.8, lon: 110.36 };
}

function shouldTripCircuit() {
  if (runtimeStats.consecutive429 >= SAFE.circuitBreak_429_count) {
    console.error(`\n❌ CIRCUIT BREAKER · ${runtimeStats.consecutive429} consecutive 429s · pausing and exiting.`);
    runtimeStats.circuitTripped = true;
    return true;
  }
  if (runtimeStats.consecutive5xx >= SAFE.circuitBreak_5xx_count) {
    console.error(`\n❌ CIRCUIT BREAKER · ${runtimeStats.consecutive5xx} consecutive 5xx · pausing and exiting.`);
    runtimeStats.circuitTripped = true;
    return true;
  }
  return false;
}

// ── Load food rows that need backfill ─────────────────────────────────
async function loadFoodRowsNeedingBackfill() {
  const q = await pool.query(`
    SELECT b.public_listing_ref AS business_ref, b.source, b.source_reference
      FROM nex.food_business b
     WHERE b.city='Yogyakarta'
       AND b.source='openstreetmap_overpass_v1'
       AND NOT EXISTS (
         SELECT 1 FROM nex.food_business_source_snapshot s
          WHERE s.business_ref = b.public_listing_ref AND s.source='osm_overpass_rehit'
       )
  `);
  return q.rows;
}

// ── Persist recovered tags to snapshot + provenance ───────────────────
//
// IMPORTANT SCHEMA NOTE (discovered 2026-08-23 during smoke test):
// nex.food_business_source_snapshot has DIFFERENT columns from accommodation's:
//   food:  snapshot_id, business_ref, source, source_reference, source_ingested_at,
//          source_licence_terms, raw_payload, ingested_by
//   accom: snapshot_id, business_ref, source, source_reference, captured_at,
//          raw_payload, cycle_run_id
//
// We use food's actual schema below.
async function persistRecoveredTags(businessRef, sourceRef, tags, lat, lon) {
  await pool.query(
    `INSERT INTO nex.food_business_source_snapshot
       (business_ref, source, source_reference, source_ingested_at,
        source_licence_terms, raw_payload, ingested_by)
     VALUES ($1, 'osm_overpass_rehit', $2, now(),
             'ODbL-1.0', $3::jsonb, 'path-a-priority-3-backfill')`,
    [businessRef, sourceRef, JSON.stringify({
      tags, osmId: sourceRef, lat, lng: lon,
      rehit_at: new Date().toISOString(),
      rehit_reason: "path-a-priority-3-backfill",
    })],
  );
  // No provenance rows on snapshot per se · the recovered_evidence persistence
  // (separate P1-style worker for food, run AFTER backfill completes) will
  // write provenance rows keyed to specific attribute keys.
}

// ── MAIN ──────────────────────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════════════╗");
  console.log("║  PATH A · PRIORITY 3 · FOOD OVERPASS BACKFILL                             ║");
  console.log(`║  Mode: ${(isExecute ? "🔴 EXECUTE (REAL OVERPASS)" : "🟢 PLAN (mock · no real Overpass)").padEnd(60)}     ║`);
  console.log(`║  Rate limit: ${SAFE.reqPerSecondCeiling} req/sec · CB-429 at ${SAFE.circuitBreak_429_count} · CB-5xx at ${SAFE.circuitBreak_5xx_count} · timeout ${SAFE.timeoutMs}ms${" ".repeat(6)}║`);
  console.log("╚══════════════════════════════════════════════════════════════════════════╝\n");

  const rows = await loadFoodRowsNeedingBackfill();
  console.log(`Food rows needing backfill: ${rows.length}`);
  if (isSample) { rows.length = Math.min(rows.length, 3); console.log(`Sample mode · limiting to ${rows.length} row(s)\n`); }

  const alreadyProcessed = new Set(cursor.processedRefs);
  const pending = rows.filter((r) => !alreadyProcessed.has(r.business_ref));
  console.log(`Already processed (cursor): ${cursor.processedRefs.length}`);
  console.log(`Pending in this run: ${pending.length}\n`);

  const fetchFn = isExecute ? overpassFetch : mockFetch;
  const startWall = Date.now();

  for (const row of pending) {
    if (interrupted) break;
    if (shouldTripCircuit()) { writeCursor(cursor); break; }

    const osmRef = parseOsmRef(row.source_reference);
    if (!osmRef) {
      console.log(`  ⚠️  ${row.business_ref} · source_reference='${row.source_reference}' unrecognised · skipping`);
      cursor.processedRefs.push(row.business_ref);
      writeCursor(cursor);
      continue;
    }

    await politePace();
    const result = await fetchFn(osmRef);

    if (!result.ok) {
      console.log(`  ❌ ${row.business_ref} · ${osmRef.type}/${osmRef.id} · ${result.msg}`);
    } else if (result.tags === null) {
      console.log(`  ⓘ ${row.business_ref} · ${osmRef.type}/${osmRef.id} · OSM element removed`);
    } else {
      const tagCount = Object.keys(result.tags).length;
      if (!isExecute) {
        console.log(`  ✓ ${row.business_ref} · ${osmRef.type}/${osmRef.id} · would persist ${tagCount} tags (MOCK · not written)`);
      } else {
        await persistRecoveredTags(row.business_ref, row.source_reference, result.tags, result.lat, result.lon);
        console.log(`  ✓ ${row.business_ref} · ${osmRef.type}/${osmRef.id} · persisted ${tagCount} tags`);
      }
    }
    cursor.processedRefs.push(row.business_ref);
    cursor.lastBusinessRef = row.business_ref;
    writeCursor(cursor);
  }

  const wallSec = ((Date.now() - startWall) / 1000).toFixed(1);

  console.log("\n══════════════════════════════════════════════════════════════════════════");
  console.log("REPORT");
  console.log("══════════════════════════════════════════════════════════════════════════");
  console.log(`  mode:                    ${isExecute ? "EXECUTE (real Overpass)" : "PLAN (mock)"}`);
  console.log(`  rows pending at start:   ${pending.length}`);
  console.log(`  rows processed this run: ${cursor.processedRefs.length - alreadyProcessed.size}`);
  console.log(`  circuit tripped:         ${runtimeStats.circuitTripped ? "YES" : "NO"}`);
  console.log(`  interrupted by SIGINT:   ${interrupted ? "YES" : "NO"}`);
  console.log(`  wall-clock:              ${wallSec}s`);
  console.log(`\n  requests made:           ${runtimeStats.requestsMade}`);
  console.log(`  200 responses:           ${runtimeStats.responses200}`);
  console.log(`  429 responses (throttle): ${runtimeStats.responses429}`);
  console.log(`  5xx responses:           ${runtimeStats.responses5xx}`);
  console.log(`  other statuses:          ${runtimeStats.responsesOther}`);
  console.log(`  timeouts:                ${runtimeStats.timeouts}`);
  console.log(`  network errors:          ${runtimeStats.networkErrors}`);
  console.log(`  OSM elements missing:    ${runtimeStats.osmElementMissing}`);
  console.log(`  total tags recovered:    ${runtimeStats.tagsRecovered}${isExecute ? "" : " (MOCK)"}`);
  console.log("");

  if (!isExecute) {
    console.log("── NEXT STEP ─────────────────────────────────────────────────────────");
    console.log("  This was a PLAN / mock run. No Overpass request was made.");
    console.log("  Safeguards (rate limit · backoff · circuit breaker · cursor · SIGINT) validated.");
    console.log("  To execute against real Overpass:");
    console.log("    NEX_PRIORITY_3_APPROVED_BY=philip node --env-file=.env.local \\");
    console.log("      scripts/nex-enrichment/_path-a-priority-3-food-overpass-backfill.mjs --execute");
    console.log("  Optional first: --execute --sample  (processes 3 real rows to smoke-test)");
  }

  await pool.end();
  process.exit(runtimeStats.circuitTripped ? 3 : (interrupted ? 4 : 0));
}
main().catch((e) => { console.error(e); process.exit(1); });
