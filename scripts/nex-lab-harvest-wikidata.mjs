#!/usr/bin/env node
// scripts/nex-lab-harvest-wikidata.mjs
//
// Founder ADR-0304 · Wikidata SPARQL adapter · B3 (2026-09-10)
//
// Second independent source for Indonesian business discovery. CC0
// licensed · no API key · reachable when Overpass mirrors are not.
// Independent network path from Overpass — the whole point of B3.
//
// Usage:
//   node scripts/nex-lab-harvest-wikidata.mjs --room accommodation
//   node scripts/nex-lab-harvest-wikidata.mjs --room food --limit 300
//   node scripts/nex-lab-harvest-wikidata.mjs                       # rotates rooms via cursor
//
// Emits rows into nex_lab_{room}.harvest_raw with source_id='wikidata.sparql'
// so B5 (verifier) can cross-check them against OSM entries by
// (name_norm, coords_grid_10m, category).
//
// Exit codes (same contract as nex-lab-harvest.mjs):
//   0 · rows landed in Postgres (inserted + updated > 0)
//   2 · Wikidata endpoint unreachable
//   3 · fetch succeeded but zero named + geocoded results
//   4 · reached Postgres but persist step wrote nothing
//   1 · unhandled crash

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const LAB_DIR = join(REPO_ROOT, "data", "nex-lab");
const CURSOR_PATH = join(LAB_DIR, "wikidata-cursor.json");
const HEALTH_PATH = join(LAB_DIR, "wikidata-health.json");
const LOG_PATH = join(LAB_DIR, "wikidata.log");

// ─── CLI ──────────────────────────────────────────────────────────
const args = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) {
    const key = a.replace(/^--/, "");
    const next = process.argv[i + 1];
    if (next && !next.startsWith("--")) { args.set(key, next); i++; }
    else args.set(key, "true");
  }
}
const CLI_ROOM = args.get("room");
const LIMIT = Number(args.get("limit") ?? "500");
const DRY = args.get("dry") === "true";

// ─── Room → Wikidata Q-IDs (canonical instance-of classes) ───────
// Q252 = Indonesia (country). Every query filters wdt:P17=wd:Q252.
const ROOM_CLASSES = {
  accommodation: {
    schema: "nex_lab_accommodation",
    classes: ["Q27686", "Q1937821", "Q4993986", "Q17158079", "Q39614"],
    // hotel, guest house, hostel, motel, resort
    label_hint: "accommodation",
  },
  food: {
    schema: "nex_lab_food",
    classes: ["Q11707", "Q30022", "Q210284", "Q1783121", "Q207703"],
    // restaurant, cafe, bar, fast food restaurant, bistro
    label_hint: "food",
  },
  transport: {
    schema: "nex_lab_transport",
    classes: ["Q1248784", "Q55488", "Q494829", "Q1595958", "Q928830"],
    // airport, railway station, bus station, ferry terminal, metro station
    label_hint: "transport",
  },
  business: {
    schema: "nex_lab_business",
    classes: ["Q11315", "Q6499202", "Q157570", "Q40357", "Q422258", "Q11707"],
    // shopping mall, department store, bakery, pharmacy, supermarket, restaurant (falls back to food too)
    label_hint: "business",
  },
  activities: {
    schema: "nex_lab_activities",
    classes: ["Q570116", "Q33506", "Q194195", "Q43501", "Q22698", "Q40080", "Q23413"],
    // tourist attraction, museum, amusement park, zoo, park, beach, castle
    label_hint: "activities",
  },
};

// ─── 5-city bbox map (identical to OSM harvester for cross-source consistency) ─
const CITY_BBOXES = {
  yogyakarta: { sw: { lat: -8.0, lon: 110.30 }, ne: { lat: -7.70, lon: 110.50 } },
  bali:       { sw: { lat: -8.85, lon: 115.00 }, ne: { lat: -8.05, lon: 115.60 } },
  jakarta:    { sw: { lat: -6.40, lon: 106.65 }, ne: { lat: -6.05, lon: 107.05 } },
  bandung:    { sw: { lat: -7.00, lon: 107.50 }, ne: { lat: -6.80, lon: 107.75 } },
  surabaya:   { sw: { lat: -7.35, lon: 112.60 }, ne: { lat: -7.15, lon: 112.85 } },
};
function assignCity(lat, lon) {
  for (const [city, b] of Object.entries(CITY_BBOXES)) {
    if (lat >= b.sw.lat && lat <= b.ne.lat && lon >= b.sw.lon && lon <= b.ne.lon) return city;
  }
  return null; // outside 5-city net · still inserted with null city
}

const WIKIDATA_ENDPOINTS = [
  "https://query.wikidata.org/sparql",
  "https://qlever.cs.uni-freiburg.de/api/wikidata",
];

// Wikidata's UA policy requires an identifiable client with a contact url.
const USER_AGENT = "NEX-Lab-Harvester/2.0 (Indonesia business discovery; contact: nex.lab@thenetworkers.app) node/" + process.versions.node;
const PER_ENDPOINT_TIMEOUT_MS = 45_000; // Wikidata queries are slower than Overpass
const BREAKER_OPEN_AFTER_CONSECUTIVE = 3;
const BREAKER_OPEN_FOR_MS = 15 * 60_000;

// ─── Logging ─────────────────────────────────────────────────────
function log(line) {
  const ts = new Date().toISOString();
  const msg = `[${ts}] ${line}\n`;
  process.stdout.write(msg);
  try {
    if (!existsSync(LAB_DIR)) mkdirSync(LAB_DIR, { recursive: true });
    appendFileSync(LOG_PATH, msg);
  } catch { /* silent */ }
}

// ─── Per-endpoint health · persisted between runs ────────────────
function loadHealth() {
  try {
    if (existsSync(HEALTH_PATH)) {
      const parsed = JSON.parse(readFileSync(HEALTH_PATH, "utf8"));
      if (parsed && typeof parsed === "object" && parsed.endpoints) return parsed;
    }
  } catch { /* fall through */ }
  return { endpoints: {} };
}
function saveHealth(health) {
  try {
    if (!existsSync(LAB_DIR)) mkdirSync(LAB_DIR, { recursive: true });
    writeFileSync(HEALTH_PATH, JSON.stringify(health, null, 2), "utf8");
  } catch { /* silent */ }
}
function endpointHealth(health, endpoint) {
  if (!health.endpoints[endpoint]) {
    health.endpoints[endpoint] = {
      consecutive_failures: 0,
      breaker_open_until: null,
      last_success_at: null,
      last_failure_at: null,
      last_error: null,
      requests_attempted: 0,
      requests_succeeded: 0,
      bytes_in_total: 0,
    };
  }
  return health.endpoints[endpoint];
}
function recordSuccess(health, endpoint, bytes) {
  const h = endpointHealth(health, endpoint);
  h.consecutive_failures = 0;
  h.breaker_open_until = null;
  h.last_success_at = new Date().toISOString();
  h.last_error = null;
  h.requests_attempted++;
  h.requests_succeeded++;
  h.bytes_in_total += bytes;
}
function recordFailure(health, endpoint, reason) {
  const h = endpointHealth(health, endpoint);
  h.consecutive_failures++;
  h.last_failure_at = new Date().toISOString();
  h.last_error = String(reason).slice(0, 160);
  h.requests_attempted++;
  if (h.consecutive_failures >= BREAKER_OPEN_AFTER_CONSECUTIVE) {
    h.breaker_open_until = new Date(Date.now() + BREAKER_OPEN_FOR_MS).toISOString();
  }
}
function isBreakerOpen(health, endpoint) {
  const h = endpointHealth(health, endpoint);
  if (!h.breaker_open_until) return false;
  const until = Date.parse(h.breaker_open_until);
  if (Number.isFinite(until) && Date.now() >= until) {
    h.breaker_open_until = null;
    h.consecutive_failures = Math.max(0, h.consecutive_failures - 1);
    return false;
  }
  return true;
}
function pickEndpointOrder(health) {
  return [...WIKIDATA_ENDPOINTS].sort((a, b) => {
    const aOpen = isBreakerOpen(health, a) ? 1 : 0;
    const bOpen = isBreakerOpen(health, b) ? 1 : 0;
    if (aOpen !== bOpen) return aOpen - bOpen;
    const ha = endpointHealth(health, a);
    const hb = endpointHealth(health, b);
    if (ha.consecutive_failures !== hb.consecutive_failures) return ha.consecutive_failures - hb.consecutive_failures;
    return WIKIDATA_ENDPOINTS.indexOf(a) - WIKIDATA_ENDPOINTS.indexOf(b);
  });
}

// ─── SPARQL query builder ────────────────────────────────────────
function buildSparqlQuery(classQids, limit, offset = 0) {
  const values = classQids.map(q => `wd:${q}`).join(" ");
  // wdt:P17 = country ; Q252 = Indonesia ; wdt:P31 = instance of ;
  // wdt:P625 = coordinate location ; wdt:P6375 = street address ;
  // wdt:P856 = official website ; wdt:P1329 = phone number.
  // ORDER BY ?item is required for stable pagination (Wikidata streams
  // results in an unspecified order otherwise · pagination without
  // ORDER BY would return duplicate rows across offsets).
  return `SELECT ?item ?itemLabel ?coord ?address ?website ?phone ?classQid WHERE {
  ?item wdt:P17 wd:Q252 .
  ?item wdt:P31 ?class .
  VALUES ?class { ${values} } .
  BIND(STRAFTER(STR(?class), "http://www.wikidata.org/entity/") AS ?classQid) .
  ?item wdt:P625 ?coord .
  OPTIONAL { ?item wdt:P6375 ?address }
  OPTIONAL { ?item wdt:P856 ?website }
  OPTIONAL { ?item wdt:P1329 ?phone }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,id" . }
}
ORDER BY ?item
LIMIT ${limit} OFFSET ${offset}`;
}

// ─── Fetch with failover ─────────────────────────────────────────
async function fetchSparqlWithFailover(query, health) {
  const attempts = [];
  const ordered = pickEndpointOrder(health);
  for (const endpoint of ordered) {
    if (isBreakerOpen(health, endpoint)) {
      attempts.push({ endpoint, skipped: "breaker_open" });
      continue;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PER_ENDPOINT_TIMEOUT_MS);
    const t0 = Date.now();
    try {
      const params = new URLSearchParams({ query, format: "json" });
      const res = await fetch(endpoint + "?" + params.toString(), {
        method: "GET",
        headers: {
          "Accept": "application/sparql-results+json",
          "User-Agent": USER_AGENT,
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after")) || 60;
        recordFailure(health, endpoint, `http_429_retry_after_${retryAfter}s`);
        attempts.push({ endpoint, status: 429, ms: Date.now() - t0, retry_after: retryAfter });
        continue;
      }
      if (!res.ok) {
        recordFailure(health, endpoint, `http_${res.status}`);
        attempts.push({ endpoint, status: res.status, ms: Date.now() - t0 });
        continue;
      }
      const text = await res.text();
      const bytes = Buffer.byteLength(text, "utf8");
      let json;
      try { json = JSON.parse(text); }
      catch (e) {
        recordFailure(health, endpoint, `parse_error:${String(e.message).slice(0, 40)}`);
        attempts.push({ endpoint, status: res.status, ms: Date.now() - t0, parse_error: true, bytes });
        continue;
      }
      recordSuccess(health, endpoint, bytes);
      attempts.push({ endpoint, status: res.status, ms: Date.now() - t0, bytes, ok: true });
      return { ok: true, json, endpoint_used: endpoint, bytes, attempts };
    } catch (err) {
      clearTimeout(timer);
      const isAbort = err && err.name === "AbortError";
      const reason = isAbort ? "timeout" : (err.message ?? String(err));
      recordFailure(health, endpoint, reason);
      attempts.push({ endpoint, error: String(reason).slice(0, 100), ms: Date.now() - t0 });
    }
  }
  return { ok: false, endpoint_used: null, attempts };
}

// ─── Parse Wikidata SPARQL JSON bindings ─────────────────────────
function parseCoord(wkt) {
  // Wikidata returns coordinates as "Point(lon lat)"
  if (!wkt || typeof wkt !== "string") return null;
  const m = wkt.match(/^Point\(\s*([-\d.]+)\s+([-\d.]+)\s*\)$/);
  if (!m) return null;
  const lon = Number(m[1]);
  const lat = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

function normalise(binding, source) {
  const name = binding.itemLabel?.value?.trim();
  if (!name) return null;
  const coord = parseCoord(binding.coord?.value);
  if (!coord) return null;
  // If the "label" is the raw Q-id, Wikidata didn't have a language-specific label; skip.
  if (/^Q\d+$/.test(name)) return null;
  const wikidataId = binding.item?.value?.replace(/^.*\/entity\//, "") ?? null;
  const city = assignCity(coord.lat, coord.lon);
  const classQid = binding.classQid?.value ?? null;
  const address = binding.address?.value ?? null;
  const website = binding.website?.value ?? null;
  const phone = binding.phone?.value ?? null;

  return {
    source,
    source_ref: wikidataId ? `wikidata:${wikidataId}` : `wikidata:coord/${coord.lat},${coord.lon}`,
    dedupe_hash: makeDedupeHash(name, coord.lat, coord.lon, phone),
    payload: {
      name,
      city,
      coordinates: coord,
      phone,
      website,
      address: address ? { free_form: address } : { free_form: null },
      wikidata_id: wikidataId,
      wikidata_class_qid: classQid,
      source_license: "CC0",
    },
  };
}

function makeDedupeHash(name, lat, lon, phone) {
  const nameNorm = String(name || "").toLowerCase().replace(/\s+/g, " ").trim();
  const phoneLast6 = String(phone || "").replace(/\D/g, "").slice(-6);
  const coordKey = `${Number(lat).toFixed(3)},${Number(lon).toFixed(3)}`;
  return createHash("sha256")
    .update(`${nameNorm}||${phoneLast6}|${coordKey}`)
    .digest("hex");
}

// ─── Persist to nex_lab_{room}.harvest_raw ───────────────────────
async function persistToLab(records, schema) {
  const pgUrl = process.env.NEX_TAXONOMY_POSTGRES_URL
    ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
  let ClientMod;
  try { ClientMod = (await import("pg")).Client; }
  catch { log("pg missing · cannot persist"); return { inserted: 0, updated: 0, errors: 1, pg_available: false }; }
  const c = new ClientMod({ connectionString: pgUrl, connectionTimeoutMillis: 8000 });
  await c.connect();
  let inserted = 0, updated = 0, errors = 0;
  try {
    for (const r of records) {
      try {
        const existing = await c.query(
          `SELECT record_id FROM ${schema}.harvest_raw WHERE dedupe_hash = $1 LIMIT 1`,
          [r.dedupe_hash],
        );
        if (existing.rows.length > 0) {
          await c.query(
            `UPDATE ${schema}.harvest_raw SET payload=$1, harvested_at=now(), source=$2, source_ref=$3 WHERE record_id=$4`,
            [r.payload, r.source, r.source_ref, existing.rows[0].record_id],
          );
          updated++;
        } else {
          await c.query(
            `INSERT INTO ${schema}.harvest_raw (source, source_ref, dedupe_hash, payload) VALUES ($1, $2, $3, $4)`,
            [r.source, r.source_ref, r.dedupe_hash, r.payload],
          );
          inserted++;
        }
      } catch { errors++; }
    }
  } finally { try { await c.end(); } catch { /* ignore */ } }
  return { inserted, updated, errors, pg_available: true };
}

// ─── Founder's Window emission ────────────────────────────────────
async function emitFW(kind, status, message, reference = {}) {
  try {
    const { Client } = await import("pg");
    const pgUrl = process.env.NEX_TAXONOMY_POSTGRES_URL
      ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
    const c = new Client({ connectionString: pgUrl, connectionTimeoutMillis: 5000 });
    await c.connect();
    await c.query(
      `INSERT INTO nex.founder_window_event (subsystem, event_kind, status, actor, message, reference)
       VALUES ('lab_wikidata', $1, $2, 'nex-lab-harvest-wikidata.mjs', $3, $4::jsonb)`,
      [kind, status, message, JSON.stringify(reference)]
    );
    await c.end();
  } catch { /* silent */ }
}

// ─── Rotation cursor (rooms only · Wikidata is country-scoped) ───
// Also tracks per-room OFFSET so we walk the full result set over time.
// OFFSET resets to 0 when a fetch returns fewer than LIMIT rows (end of data).
function loadCursor() {
  try {
    if (existsSync(CURSOR_PATH)) {
      const parsed = JSON.parse(readFileSync(CURSOR_PATH, "utf8"));
      if (!parsed.offsets) parsed.offsets = {};
      return parsed;
    }
  } catch { /* start fresh */ }
  return { room_idx: 0, runs: 0, offsets: {} };
}
function saveCursor(state) {
  try {
    if (!existsSync(LAB_DIR)) mkdirSync(LAB_DIR, { recursive: true });
    writeFileSync(CURSOR_PATH, JSON.stringify(state, null, 2), "utf8");
  } catch { /* silent */ }
}
function pickRotation() {
  const rooms = Object.keys(ROOM_CLASSES);
  const c = loadCursor();
  const room = rooms[c.room_idx % rooms.length];
  const next = {
    room_idx: (c.room_idx + 1) % rooms.length,
    runs: (c.runs ?? 0) + 1,
    last_iso: new Date().toISOString(),
    last_room: room,
    offsets: c.offsets ?? {},
  };
  saveCursor(next);
  return { room, cursor: next };
}
function readOffset(room) {
  try {
    if (!existsSync(CURSOR_PATH)) return 0;
    const c = JSON.parse(readFileSync(CURSOR_PATH, "utf8"));
    return Number(c.offsets?.[room] ?? 0) || 0;
  } catch { return 0; }
}
function writeOffset(room, offset) {
  try {
    const c = existsSync(CURSOR_PATH) ? JSON.parse(readFileSync(CURSOR_PATH, "utf8")) : { room_idx: 0, runs: 0, offsets: {} };
    if (!c.offsets) c.offsets = {};
    c.offsets[room] = offset;
    if (!existsSync(LAB_DIR)) mkdirSync(LAB_DIR, { recursive: true });
    writeFileSync(CURSOR_PATH, JSON.stringify(c, null, 2), "utf8");
  } catch { /* silent */ }
}

// ─── runOne: one Wikidata cycle for one room ─────────────────────
async function runOne(room, health) {
  const t0 = Date.now();
  const roomCfg = ROOM_CLASSES[room];
  if (!roomCfg) return { room, outcome: "unknown_room" };
  const source = `wikidata.sparql.${roomCfg.label_hint}`;
  const offset = readOffset(room);
  const query = buildSparqlQuery(roomCfg.classes, LIMIT, offset);
  log(`  ▶ ${room.padEnd(14)} querying Wikidata SPARQL (classes=${roomCfg.classes.length} limit=${LIMIT} offset=${offset})…`);
  emitFW("research_started", "info", `${room} · wikidata sparql`, { room, classes: roomCfg.classes, source, offset });

  const fetchResult = await fetchSparqlWithFailover(query, health);
  if (!fetchResult.ok) {
    const summary = fetchResult.attempts.map(a =>
      a.skipped ? `${a.endpoint}:${a.skipped}` :
      a.status ? `${a.endpoint}:${a.status}` :
      `${a.endpoint}:${a.error || "err"}`).join(" | ");
    log(`  ✗ ${room} ALL_ENDPOINTS_DOWN · ${summary}`);
    emitFW("research_completed", "error", `${room} · wikidata all endpoints unreachable`, { room, attempts: fetchResult.attempts });
    return { room, outcome: "all_endpoints_down", attempts: fetchResult.attempts, duration_ms: Date.now() - t0 };
  }

  const bindings = fetchResult.json?.results?.bindings ?? [];
  const records = [];
  for (const b of bindings) {
    const n = normalise(b, source);
    if (n) records.push(n);
  }

  if (DRY) {
    log(`  ${room} DRY · endpoint=${fetchResult.endpoint_used} raw_bindings=${bindings.length} named+geocoded=${records.length}`);
    return { room, outcome: "dry_ok", endpoint_used: fetchResult.endpoint_used, raw_bindings: bindings.length, kept: records.length, duration_ms: Date.now() - t0 };
  }

  if (records.length === 0) {
    log(`  ⊘ ${room} EMPTY · endpoint=${fetchResult.endpoint_used} raw_bindings=${bindings.length} named+geocoded=0 offset=${offset}`);
    emitFW("research_completed", "info", `${room} · wikidata empty result`, { room, raw_bindings: bindings.length, offset });
    // If we asked with a non-zero offset and got nothing, we walked past the end · reset for next run.
    if (offset > 0) writeOffset(room, 0);
    return { room, outcome: "empty_response", endpoint_used: fetchResult.endpoint_used, raw_bindings: bindings.length, kept: 0, duration_ms: Date.now() - t0 };
  }

  const persist = await persistToLab(records, roomCfg.schema);
  const rowsIn = persist.inserted + persist.updated;
  const outcome = rowsIn > 0 ? "rows_in" : "persist_zero";
  const cityCounts = records.reduce((acc, r) => { const c = r.payload.city ?? "unassigned"; acc[c] = (acc[c] ?? 0) + 1; return acc; }, {});
  const cityStr = Object.entries(cityCounts).map(([c, n]) => `${c}=${n}`).join(",");
  // Advance OFFSET · reset when we get fewer than a full page (end of dataset).
  const nextOffset = bindings.length < LIMIT ? 0 : offset + LIMIT;
  writeOffset(room, nextOffset);
  log(`  ${outcome === "rows_in" ? "✓" : "◇"} ${room.padEnd(14)} · endpoint=${fetchResult.endpoint_used} bindings=${bindings.length} kept=${records.length} inserted=${persist.inserted} updated=${persist.updated} errors=${persist.errors} offset[${offset}→${nextOffset}] cities[${cityStr}]`);
  emitFW("research_completed", outcome === "rows_in" ? "ok" : "warn",
    `${room} · wikidata · +${persist.inserted} / ${persist.updated} updated`,
    { room, raw_bindings: bindings.length, kept: records.length, endpoint: fetchResult.endpoint_used, ...persist, city_counts: cityCounts, duration_ms: Date.now() - t0 });
  if (persist.inserted > 0) {
    emitFW("evidence_discovered", "ok",
      `${persist.inserted} new ${room} entities from Wikidata`,
      { room, count: persist.inserted, city_counts: cityCounts });
  }
  return { room, outcome, endpoint_used: fetchResult.endpoint_used, raw_bindings: bindings.length, kept: records.length, ...persist, duration_ms: Date.now() - t0 };
}

// ─── Main ─────────────────────────────────────────────────────────
async function main() {
  const t0 = Date.now();
  const health = loadHealth();
  const results = [];
  try {
    if (CLI_ROOM) {
      log(`start · explicit room=${CLI_ROOM}`);
      results.push(await runOne(CLI_ROOM, health));
    } else {
      const p = pickRotation();
      log(`start · rotation room=${p.room} (run #${p.cursor.runs})`);
      results.push(await runOne(p.room, health));
    }
  } finally {
    saveHealth(health);
  }
  const totals = results.reduce((acc, r) => {
    acc.rows_in += r.outcome === "rows_in" ? ((r.inserted ?? 0) + (r.updated ?? 0)) : 0;
    if (r.outcome === "rows_in") acc.cycles_rows_in++;
    if (r.outcome === "all_endpoints_down") acc.cycles_endpoints_down++;
    if (r.outcome === "empty_response") acc.cycles_empty++;
    if (r.outcome === "persist_zero") acc.cycles_persist_zero++;
    return acc;
  }, { rows_in: 0, cycles_rows_in: 0, cycles_endpoints_down: 0, cycles_empty: 0, cycles_persist_zero: 0 });
  log(`done · ${Date.now() - t0}ms · rows_in=${totals.rows_in} cycles[rows_in=${totals.cycles_rows_in} endpoints_down=${totals.cycles_endpoints_down} empty=${totals.cycles_empty} persist_zero=${totals.cycles_persist_zero}]`);

  if (totals.rows_in > 0) process.exit(0);
  if (totals.cycles_endpoints_down > 0 && totals.cycles_rows_in === 0) process.exit(2);
  if (totals.cycles_persist_zero > 0) process.exit(4);
  process.exit(3);
}

main().catch((err) => { log(`fatal: ${String(err).slice(0, 400)}`); process.exit(1); });
