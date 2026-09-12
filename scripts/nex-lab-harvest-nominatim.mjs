#!/usr/bin/env node
// scripts/nex-lab-harvest-nominatim.mjs
//
// Founder ADR-0304 · B8 · Third-source harvester: Nominatim.
//
// Nominatim is OSM's text-search endpoint. Uses an independent network
// path from Overpass (nominatim.openstreetmap.org). Works when Overpass
// mirrors are unreachable from a given box (as they were this session).
//
// This is a STAND-IN for a future Kemenparekraf adapter (the Indonesian
// government tourism registry). Nominatim provides real, reachable Indonesia
// data today; the Kemenparekraf slot in the source stack can replace this
// file's fetch function later once partnership credentials arrive. The rest
// of the adapter (normaliser · dedupe · exit codes · health tracking) is
// generic and reusable.
//
// ODbL 1.0 licence · attribution respected.
// Rate limit: 1 request/second per Nominatim usage policy · enforced here.
//
// Emits rows to nex_lab_{room}.harvest_raw with source_id='nominatim.osm.<room>'
// so B5 verifier can cross-check against Overpass and Wikidata rows.
//
// Exit codes match the OSM harvester contract: 0/2/3/4/1.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const LAB_DIR = join(REPO_ROOT, "data", "nex-lab");
const CURSOR_PATH = join(LAB_DIR, "nominatim-cursor.json");
const HEALTH_PATH = join(LAB_DIR, "nominatim-health.json");
const LOG_PATH = join(LAB_DIR, "nominatim.log");

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
const CLI_CITY = args.get("city");
const MAX_PER_QUERY = Number(args.get("max") ?? "40");
const DRY = args.get("dry") === "true";

// ─── Room → Nominatim query terms ────────────────────────────────
const ROOM_QUERIES = {
  accommodation: { schema: "nex_lab_accommodation", terms: ["hotel", "guest house", "hostel", "villa", "resort"] },
  food:          { schema: "nex_lab_food",          terms: ["restaurant", "cafe", "warung", "bakery"] },
  transport:     { schema: "nex_lab_transport",     terms: ["airport", "train station", "bus terminal", "ferry terminal"] },
  business:      { schema: "nex_lab_business",      terms: ["shop", "mall", "market", "supermarket", "pharmacy"] },
  activities:    { schema: "nex_lab_activities",    terms: ["museum", "park", "beach", "temple", "attraction"] },
};

const CITY_BBOXES = {
  yogyakarta: { sw: { lat: -8.0, lon: 110.30 }, ne: { lat: -7.70, lon: 110.50 } },
  bali:       { sw: { lat: -8.85, lon: 115.00 }, ne: { lat: -8.05, lon: 115.60 } },
  jakarta:    { sw: { lat: -6.40, lon: 106.65 }, ne: { lat: -6.05, lon: 107.05 } },
  bandung:    { sw: { lat: -7.00, lon: 107.50 }, ne: { lat: -6.80, lon: 107.75 } },
  surabaya:   { sw: { lat: -7.35, lon: 112.60 }, ne: { lat: -7.15, lon: 112.85 } },
};

const NOMINATIM_ENDPOINTS = [
  "https://nominatim.openstreetmap.org/search",
];
const USER_AGENT = "NEX-Lab-Harvester/2.0 (Indonesia business discovery; contact: nex.lab@thenetworkers.app) node/" + process.versions.node;
const PER_REQUEST_TIMEOUT_MS = 15_000;
const NOMINATIM_MIN_INTERVAL_MS = 1_100; // 1 req/sec policy · 1100 to be safe
const BREAKER_OPEN_AFTER_CONSECUTIVE = 3;
const BREAKER_OPEN_FOR_MS = 15 * 60_000;

function log(line) {
  const ts = new Date().toISOString();
  const msg = `[${ts}] ${line}\n`;
  process.stdout.write(msg);
  if (process.stdout.isTTY) {
    try { if (!existsSync(LAB_DIR)) mkdirSync(LAB_DIR, { recursive: true }); appendFileSync(LOG_PATH, msg); } catch { /* silent */ }
  }
}

// ─── Health tracking (mirrors OSM harvester pattern) ─────────────
function loadHealth() {
  try {
    if (existsSync(HEALTH_PATH)) {
      const parsed = JSON.parse(readFileSync(HEALTH_PATH, "utf8"));
      if (parsed?.endpoints) return parsed;
    }
  } catch { /* fall through */ }
  return { endpoints: {} };
}
function saveHealth(h) {
  try {
    if (!existsSync(LAB_DIR)) mkdirSync(LAB_DIR, { recursive: true });
    writeFileSync(HEALTH_PATH, JSON.stringify(h, null, 2), "utf8");
  } catch { /* silent */ }
}
function endpointHealth(health, endpoint) {
  if (!health.endpoints[endpoint]) health.endpoints[endpoint] = {
    consecutive_failures: 0, breaker_open_until: null, last_success_at: null, last_failure_at: null,
    last_error: null, requests_attempted: 0, requests_succeeded: 0, bytes_in_total: 0,
  };
  return health.endpoints[endpoint];
}
function recordSuccess(h, ep, bytes) { const x = endpointHealth(h, ep); x.consecutive_failures = 0; x.breaker_open_until = null; x.last_success_at = new Date().toISOString(); x.last_error = null; x.requests_attempted++; x.requests_succeeded++; x.bytes_in_total += bytes; }
function recordFailure(h, ep, reason) { const x = endpointHealth(h, ep); x.consecutive_failures++; x.last_failure_at = new Date().toISOString(); x.last_error = String(reason).slice(0, 160); x.requests_attempted++; if (x.consecutive_failures >= BREAKER_OPEN_AFTER_CONSECUTIVE) x.breaker_open_until = new Date(Date.now() + BREAKER_OPEN_FOR_MS).toISOString(); }
function isBreakerOpen(h, ep) { const x = endpointHealth(h, ep); if (!x.breaker_open_until) return false; if (Date.now() >= Date.parse(x.breaker_open_until)) { x.breaker_open_until = null; x.consecutive_failures = Math.max(0, x.consecutive_failures - 1); return false; } return true; }

// ─── Nominatim fetch (one query at a time · 1 req/sec) ───────────
let __lastRequestAt = 0;
async function fetchNominatimQuery(term, city, health) {
  const bbox = CITY_BBOXES[city];
  const params = new URLSearchParams({
    q: term,
    format: "json",
    limit: String(MAX_PER_QUERY),
    countrycodes: "id",
    extratags: "1",
    addressdetails: "1",
    "accept-language": "en,id",
  });
  if (bbox) {
    params.set("viewbox", `${bbox.sw.lon},${bbox.ne.lat},${bbox.ne.lon},${bbox.sw.lat}`);
    params.set("bounded", "1");
  }
  const url = NOMINATIM_ENDPOINTS[0] + "?" + params.toString();
  const attempts = [];
  for (const endpoint of NOMINATIM_ENDPOINTS) {
    if (isBreakerOpen(health, endpoint)) { attempts.push({ endpoint, skipped: "breaker_open" }); continue; }
    // Enforce 1-req/sec
    const wait = __lastRequestAt + NOMINATIM_MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    __lastRequestAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PER_REQUEST_TIMEOUT_MS);
    const t0 = Date.now();
    try {
      const res = await fetch(url, { method: "GET", headers: { "user-agent": USER_AGENT, "accept": "application/json" }, signal: controller.signal });
      clearTimeout(timer);
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after")) || 60;
        recordFailure(health, endpoint, `http_429_retry_after_${retryAfter}s`);
        attempts.push({ endpoint, status: 429, retry_after: retryAfter, ms: Date.now() - t0 });
        continue;
      }
      if (!res.ok) { recordFailure(health, endpoint, `http_${res.status}`); attempts.push({ endpoint, status: res.status, ms: Date.now() - t0 }); continue; }
      const text = await res.text();
      const bytes = Buffer.byteLength(text, "utf8");
      let json;
      try { json = JSON.parse(text); }
      catch (e) { recordFailure(health, endpoint, `parse_error:${String(e.message).slice(0, 40)}`); attempts.push({ endpoint, status: res.status, ms: Date.now() - t0, parse_error: true, bytes }); continue; }
      recordSuccess(health, endpoint, bytes);
      attempts.push({ endpoint, status: res.status, ms: Date.now() - t0, bytes, ok: true, results: Array.isArray(json) ? json.length : 0 });
      return { ok: true, results: json, attempts };
    } catch (err) {
      clearTimeout(timer);
      const isAbort = err && err.name === "AbortError";
      const reason = isAbort ? "timeout" : (err.message ?? String(err));
      recordFailure(health, endpoint, reason);
      attempts.push({ endpoint, error: String(reason).slice(0, 100), ms: Date.now() - t0 });
    }
  }
  return { ok: false, attempts };
}

// ─── Normalise a Nominatim result into harvest_raw shape ─────────
function makeDedupeHash(name, lat, lon, phone) {
  const nameNorm = String(name || "").toLowerCase().replace(/\s+/g, " ").trim();
  const phoneLast6 = String(phone || "").replace(/\D/g, "").slice(-6);
  const coordKey = `${Number(lat).toFixed(3)},${Number(lon).toFixed(3)}`;
  return createHash("sha256").update(`${nameNorm}||${phoneLast6}|${coordKey}`).digest("hex");
}
function normalise(r, room, city) {
  const name = String(r.name ?? r.display_name?.split(",")[0] ?? "").trim();
  if (!name) return null;
  const lat = Number(r.lat), lon = Number(r.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const addr = r.address ?? {};
  const extra = r.extratags ?? {};
  return {
    source: `nominatim.osm.${room}`,
    source_ref: `${r.osm_type}/${r.osm_id}`,
    dedupe_hash: makeDedupeHash(name, lat, lon, extra.phone ?? addr.phone),
    payload: {
      name,
      city,
      coordinates: { lat, lon },
      phone: extra.phone ?? extra["contact:phone"] ?? null,
      website: extra.website ?? extra["contact:website"] ?? null,
      address: {
        street: addr.road ?? null,
        housenumber: addr.house_number ?? null,
        city: addr.city ?? addr.town ?? addr.village ?? null,
        postcode: addr.postcode ?? null,
        district: addr.suburb ?? addr.neighbourhood ?? null,
      },
      raw_tags: extra,
      osm_type: r.osm_type,
      osm_id: r.osm_id,
      nominatim_place_id: r.place_id,
      nominatim_class: r.class,
      nominatim_type: r.type,
      display_name: r.display_name,
      source_license: "ODbL",
    },
  };
}

// ─── Persist ────────────────────────────────────────────────────
async function persistToLab(records, schema) {
  const pgUrl = process.env.NEX_TAXONOMY_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
  let ClientMod;
  try { ClientMod = (await import("pg")).Client; } catch { log("pg missing"); return { inserted: 0, updated: 0, errors: 1 }; }
  const c = new ClientMod({ connectionString: pgUrl, connectionTimeoutMillis: 8000 });
  await c.connect();
  let inserted = 0, updated = 0, errors = 0;
  try {
    for (const r of records) {
      try {
        const existing = await c.query(`SELECT record_id FROM ${schema}.harvest_raw WHERE dedupe_hash = $1 LIMIT 1`, [r.dedupe_hash]);
        if (existing.rows.length > 0) {
          await c.query(`UPDATE ${schema}.harvest_raw SET payload=$1, harvested_at=now(), source=$2, source_ref=$3 WHERE record_id=$4`, [r.payload, r.source, r.source_ref, existing.rows[0].record_id]);
          updated++;
        } else {
          await c.query(`INSERT INTO ${schema}.harvest_raw (source, source_ref, dedupe_hash, payload) VALUES ($1, $2, $3, $4)`, [r.source, r.source_ref, r.dedupe_hash, r.payload]);
          inserted++;
        }
      } catch { errors++; }
    }
  } finally { try { await c.end(); } catch { /* ignore */ } }
  return { inserted, updated, errors };
}

// ─── Rotation cursor ────────────────────────────────────────────
function loadCursor() { try { if (existsSync(CURSOR_PATH)) return JSON.parse(readFileSync(CURSOR_PATH, "utf8")); } catch {} return { room_idx: 0, city_idx: 0, runs: 0 }; }
function saveCursor(s) { try { if (!existsSync(LAB_DIR)) mkdirSync(LAB_DIR, { recursive: true }); writeFileSync(CURSOR_PATH, JSON.stringify(s, null, 2), "utf8"); } catch {} }
function pickRotation() {
  const rooms = Object.keys(ROOM_QUERIES);
  const cities = Object.keys(CITY_BBOXES);
  const c = loadCursor();
  const room = rooms[c.room_idx % rooms.length];
  const city = cities[c.city_idx % cities.length];
  const next = {
    city_idx: (c.city_idx + 1) % cities.length,
    room_idx: (c.city_idx + 1) % cities.length === 0 ? (c.room_idx + 1) % rooms.length : c.room_idx,
    runs: (c.runs ?? 0) + 1,
    last_iso: new Date().toISOString(), last_room: room, last_city: city,
  };
  saveCursor(next);
  return { room, city, cursor: next };
}

// ─── runOne · one room × city cycle · iterates queries ──────────
async function runOne(room, city, health) {
  const t0 = Date.now();
  const cfg = ROOM_QUERIES[room];
  if (!cfg) return { room, city, outcome: "unknown_room" };
  if (!CITY_BBOXES[city]) return { room, city, outcome: "unknown_city" };
  log(`  ▶ ${room.padEnd(14)} @ ${city.padEnd(11)} nominatim (terms=${cfg.terms.length})…`);

  let totalKept = 0;
  let totalResults = 0;
  const allRecords = [];
  let queriesOk = 0, queriesDown = 0;

  for (const term of cfg.terms) {
    const r = await fetchNominatimQuery(term, city, health);
    if (!r.ok) { queriesDown++; continue; }
    queriesOk++;
    const results = Array.isArray(r.results) ? r.results : [];
    totalResults += results.length;
    for (const item of results) {
      const rec = normalise(item, room, city);
      if (rec) allRecords.push(rec);
    }
  }

  totalKept = allRecords.length;

  if (queriesOk === 0) {
    log(`  ✗ ${room}/${city} ALL_QUERIES_FAILED`);
    return { room, city, outcome: "all_endpoints_down", duration_ms: Date.now() - t0 };
  }
  if (DRY) {
    log(`  ${room}/${city} DRY · queries_ok=${queriesOk} results=${totalResults} kept=${totalKept}`);
    return { room, city, outcome: "dry_ok", queries_ok: queriesOk, results: totalResults, kept: totalKept, duration_ms: Date.now() - t0 };
  }
  if (totalKept === 0) {
    log(`  ⊘ ${room}/${city} EMPTY · queries_ok=${queriesOk} results=${totalResults}`);
    return { room, city, outcome: "empty_response", queries_ok: queriesOk, kept: 0, duration_ms: Date.now() - t0 };
  }

  const persist = await persistToLab(allRecords, cfg.schema);
  const rowsIn = persist.inserted + persist.updated;
  const outcome = rowsIn > 0 ? "rows_in" : "persist_zero";
  log(`  ${outcome === "rows_in" ? "✓" : "◇"} ${room.padEnd(14)} @ ${city.padEnd(11)} · queries_ok=${queriesOk}/${cfg.terms.length} results=${totalResults} kept=${totalKept} inserted=${persist.inserted} updated=${persist.updated} errors=${persist.errors}`);
  return { room, city, outcome, ...persist, duration_ms: Date.now() - t0 };
}

async function main() {
  const t0 = Date.now();
  const health = loadHealth();
  const results = [];
  try {
    if (CLI_ROOM && CLI_CITY) {
      log(`start · explicit room=${CLI_ROOM} city=${CLI_CITY}`);
      results.push(await runOne(CLI_ROOM, CLI_CITY, health));
    } else {
      const p = pickRotation();
      log(`start · rotation room=${p.room} city=${p.city} (run #${p.cursor.runs})`);
      results.push(await runOne(p.room, p.city, health));
    }
  } finally { saveHealth(health); }
  const totals = results.reduce((a, r) => {
    a.rows_in += r.outcome === "rows_in" ? ((r.inserted ?? 0) + (r.updated ?? 0)) : 0;
    if (r.outcome === "rows_in") a.cycles_rows_in++;
    if (r.outcome === "all_endpoints_down") a.cycles_endpoints_down++;
    if (r.outcome === "empty_response") a.cycles_empty++;
    if (r.outcome === "persist_zero") a.cycles_persist_zero++;
    return a;
  }, { rows_in: 0, cycles_rows_in: 0, cycles_endpoints_down: 0, cycles_empty: 0, cycles_persist_zero: 0 });
  log(`done · ${Date.now() - t0}ms · rows_in=${totals.rows_in} cycles[rows_in=${totals.cycles_rows_in} endpoints_down=${totals.cycles_endpoints_down} empty=${totals.cycles_empty} persist_zero=${totals.cycles_persist_zero}]`);

  if (totals.rows_in > 0) process.exit(0);
  if (totals.cycles_endpoints_down > 0 && totals.cycles_rows_in === 0) process.exit(2);
  if (totals.cycles_persist_zero > 0) process.exit(4);
  process.exit(3);
}

main().catch((err) => { log(`fatal: ${String(err).slice(0, 400)}`); process.exit(1); });
