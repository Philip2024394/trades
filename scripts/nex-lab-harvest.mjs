#!/usr/bin/env node
// scripts/nex-lab-harvest.mjs
//
// Founder ADR-0304 · Universal Lab harvester · B1 (2026-09-10)
//
// Single entry point for all 5 domain harvesters. Multi-endpoint OSM
// Overpass failover with per-endpoint circuit-breaker persisted between
// runs. Honest exit codes so the supervisor cannot lie about outcomes.
//
// Exit codes:
//   0 · rows landed in Postgres (inserted + updated > 0)
//   2 · all Overpass endpoints unreachable this run
//   3 · fetch succeeded but zero named + geocoded elements
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
const CURSOR_PATH = join(LAB_DIR, "harvest-cursor.json");
const HEALTH_PATH = join(LAB_DIR, "overpass-health.json");
const LOG_PATH = join(LAB_DIR, "harvest.log");

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
const CLI_CITY = args.get("city");
const MAX_RESULTS = Number(args.get("max") ?? "500");
const DRY = args.get("dry") === "true";

// ─── Room configurations · one canonical OSM query per room ──────
const ROOM_QUERIES = {
  accommodation: {
    schema: "nex_lab_accommodation",
    overpass: (bbox) =>
      `[out:json][timeout:60];node["tourism"~"^(hotel|guest_house|hostel|apartment|motel|chalet)$"](${bbox});out center;`,
    source: "osm_overpass_tourism",
  },
  food: {
    schema: "nex_lab_food",
    overpass: (bbox) =>
      `[out:json][timeout:60];(node["amenity"~"^(restaurant|cafe|fast_food|food_court|bar|pub|ice_cream)$"](${bbox});node["shop"="convenience"](${bbox}););out center;`,
    source: "osm_overpass_amenity_food",
  },
  transport: {
    schema: "nex_lab_transport",
    overpass: (bbox) =>
      `[out:json][timeout:60];(node["public_transport"="station"](${bbox});node["amenity"~"^(bus_station|taxi|ferry_terminal)$"](${bbox});node["aeroway"="aerodrome"](${bbox}););out center;`,
    source: "osm_overpass_transport",
  },
  business: {
    schema: "nex_lab_business",
    overpass: (bbox) =>
      `[out:json][timeout:60];(node["shop"](${bbox});node["office"](${bbox});node["craft"](${bbox}););out center;`,
    source: "osm_overpass_shop_office_craft",
  },
  activities: {
    schema: "nex_lab_activities",
    overpass: (bbox) =>
      `[out:json][timeout:60];(node["tourism"~"^(attraction|museum|theme_park|zoo|viewpoint|artwork|gallery)$"](${bbox});node["leisure"~"^(park|beach_resort|water_park|dive_centre)$"](${bbox});node["shop"="rental"](${bbox}););out center;`,
    source: "osm_overpass_tourism_leisure",
  },
};

const CITY_BBOXES = {
  yogyakarta: { sw: { lat: -8.0, lon: 110.30 }, ne: { lat: -7.70, lon: 110.50 } },
  bali:       { sw: { lat: -8.85, lon: 115.00 }, ne: { lat: -8.05, lon: 115.60 } },
  jakarta:    { sw: { lat: -6.40, lon: 106.65 }, ne: { lat: -6.05, lon: 107.05 } },
  bandung:    { sw: { lat: -7.00, lon: 107.50 }, ne: { lat: -6.80, lon: 107.75 } },
  surabaya:   { sw: { lat: -7.35, lon: 112.60 }, ne: { lat: -7.15, lon: 112.85 } },
};

// 5-endpoint failover matching src/lib/nex/indonesia/live/osm-overpass.ts
// Order = preferred priority; runtime picks by breaker state + fewest recent failures.
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

const USER_AGENT = "NEX-Lab-Harvester/2.0 (+ODbL-attribution-respected)";
const PER_ENDPOINT_TIMEOUT_MS = 15_000;
const BREAKER_OPEN_AFTER_CONSECUTIVE = 3;
const BREAKER_OPEN_FOR_MS = 15 * 60_000; // 15 min

// ─── Logging (never crashes) ──────────────────────────────────────
function log(line) {
  const ts = new Date().toISOString();
  const msg = `[${ts}] ${line}\n`;
  process.stdout.write(msg);
  try {
    if (!existsSync(LAB_DIR)) mkdirSync(LAB_DIR, { recursive: true });
    appendFileSync(LOG_PATH, msg);
  } catch { /* silent */ }
}

// ─── Per-endpoint health · persisted between runs ─────────────────
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
    // Half-open · give it another chance
    h.breaker_open_until = null;
    h.consecutive_failures = Math.max(0, h.consecutive_failures - 1);
    return false;
  }
  return true;
}
function pickEndpointOrder(health) {
  return [...OVERPASS_ENDPOINTS].sort((a, b) => {
    const aOpen = isBreakerOpen(health, a) ? 1 : 0;
    const bOpen = isBreakerOpen(health, b) ? 1 : 0;
    if (aOpen !== bOpen) return aOpen - bOpen;
    const ha = endpointHealth(health, a);
    const hb = endpointHealth(health, b);
    if (ha.consecutive_failures !== hb.consecutive_failures) return ha.consecutive_failures - hb.consecutive_failures;
    return OVERPASS_ENDPOINTS.indexOf(a) - OVERPASS_ENDPOINTS.indexOf(b);
  });
}

// ─── Overpass fetch with 5-endpoint failover ─────────────────────
async function fetchOverpassWithFailover(query, health) {
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
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after")) || 30;
        recordFailure(health, endpoint, `http_429_retry_after_${retryAfter}s`);
        attempts.push({ endpoint, status: 429, ms: Date.now() - t0, retry_after: retryAfter });
        // Do NOT sleep on 429 here · move to next endpoint; supervisor will pace the next full cycle.
        continue;
      }
      if (res.status >= 500 || res.status === 504) {
        recordFailure(health, endpoint, `http_${res.status}`);
        attempts.push({ endpoint, status: res.status, ms: Date.now() - t0 });
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
      attempts.push({ endpoint, error: reason.slice(0, 100), ms: Date.now() - t0 });
    }
  }
  return { ok: false, endpoint_used: null, attempts };
}

// ─── Dedupe hash ─────────────────────────────────────────────────
function makeDedupeHash(name, lat, lon, phone) {
  const nameNorm = String(name || "").toLowerCase().replace(/\s+/g, " ").trim();
  const phoneLast6 = String(phone || "").replace(/\D/g, "").slice(-6);
  const coordKey = `${Number(lat).toFixed(3)},${Number(lon).toFixed(3)}`;
  return createHash("sha256")
    .update(`${nameNorm}||${phoneLast6}|${coordKey}`)
    .digest("hex");
}

// ─── Normalise an OSM element into harvest_raw shape ─────────────
function normalise(el, cityCanonical, source) {
  const tags = el.tags ?? {};
  const name = (tags.name || tags["name:en"] || tags["name:id"] || "").trim();
  if (!name) return null;
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  return {
    source,
    source_ref: `node/${el.id}`,
    dedupe_hash: makeDedupeHash(name, lat, lon, tags.phone),
    payload: {
      name,
      city: cityCanonical,
      coordinates: { lat, lon },
      phone: tags.phone ?? null,
      website: tags.website ?? null,
      address: {
        street: tags["addr:street"] ?? null,
        housenumber: tags["addr:housenumber"] ?? null,
        city: tags["addr:city"] ?? null,
        postcode: tags["addr:postcode"] ?? null,
      },
      raw_tags: tags,
      osm_type: el.type,
      osm_id: el.id,
    },
  };
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
            `UPDATE ${schema}.harvest_raw SET payload=$1, harvested_at=now() WHERE record_id=$2`,
            [r.payload, existing.rows[0].record_id],
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

// ─── Founder's Window emission (fire-and-forget) ─────────────────
async function emitFW(kind, status, message, reference = {}) {
  try {
    const { Client } = await import("pg");
    const pgUrl = process.env.NEX_TAXONOMY_POSTGRES_URL
      ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
    const c = new Client({ connectionString: pgUrl, connectionTimeoutMillis: 5000 });
    await c.connect();
    await c.query(
      `INSERT INTO nex.founder_window_event (subsystem, event_kind, status, actor, message, reference)
       VALUES ('lab_harvest', $1, $2, 'nex-lab-harvest.mjs', $3, $4::jsonb)`,
      [kind, status, message, JSON.stringify(reference)]
    );
    await c.end();
  } catch { /* silent · dashboard is a lens */ }
}

// ─── Rotation cursor ─────────────────────────────────────────────
function loadCursor() {
  try { if (existsSync(CURSOR_PATH)) return JSON.parse(readFileSync(CURSOR_PATH, "utf8")); }
  catch { /* start fresh */ }
  return { room_idx: 0, city_idx: 0, runs: 0 };
}
function saveCursor(state) {
  try {
    if (!existsSync(LAB_DIR)) mkdirSync(LAB_DIR, { recursive: true });
    writeFileSync(CURSOR_PATH, JSON.stringify(state, null, 2), "utf8");
  } catch { /* silent */ }
}
function pickRotation() {
  const rooms = Object.keys(ROOM_QUERIES);
  const cities = Object.keys(CITY_BBOXES);
  const c = loadCursor();
  const room = rooms[c.room_idx % rooms.length];
  const city = cities[c.city_idx % cities.length];
  const next = {
    ...c,
    city_idx: (c.city_idx + 1) % cities.length,
    room_idx: (c.city_idx + 1) % cities.length === 0 ? (c.room_idx + 1) % rooms.length : c.room_idx,
    runs: (c.runs ?? 0) + 1,
    last_iso: new Date().toISOString(),
    last_room: room,
    last_city: city,
  };
  saveCursor(next);
  return { room, city, cursor: next };
}

// ─── runOne · returns honest structured result ───────────────────
async function runOne(room, city, health) {
  const t0 = Date.now();
  const roomCfg = ROOM_QUERIES[room];
  if (!roomCfg) return { room, city, outcome: "unknown_room" };
  const bbox = CITY_BBOXES[city];
  if (!bbox) return { room, city, outcome: "unknown_city" };
  const bboxStr = `${bbox.sw.lat},${bbox.sw.lon},${bbox.ne.lat},${bbox.ne.lon}`;
  const query = roomCfg.overpass(bboxStr);
  log(`  ▶ ${room.padEnd(14)} @ ${city.padEnd(11)} querying overpass (${OVERPASS_ENDPOINTS.length}-endpoint failover)…`);
  emitFW("research_started", "info", `${room} @ ${city} · overpass`, { room, city, source: roomCfg.source });

  const fetchResult = await fetchOverpassWithFailover(query, health);
  if (!fetchResult.ok) {
    // Every endpoint failed. This is the LOUD condition.
    const summary = fetchResult.attempts.map(a =>
      a.skipped ? `${a.endpoint}:${a.skipped}` :
      a.status ? `${a.endpoint}:${a.status}` :
      `${a.endpoint}:${a.error || "err"}`).join(" | ");
    log(`  ✗ ${room}/${city} ALL_ENDPOINTS_DOWN · ${summary}`);
    emitFW("research_completed", "error", `${room} @ ${city} · all Overpass endpoints unreachable`,
      { room, city, attempts: fetchResult.attempts });
    return { room, city, outcome: "all_endpoints_down", attempts: fetchResult.attempts, duration_ms: Date.now() - t0 };
  }

  const elements = (fetchResult.json && Array.isArray(fetchResult.json.elements)) ? fetchResult.json.elements : [];
  const records = [];
  for (const el of elements) {
    if (records.length >= MAX_RESULTS) break;
    const n = normalise(el, city, roomCfg.source);
    if (n) records.push(n);
  }

  if (DRY) {
    log(`  ${room}/${city} DRY · endpoint=${fetchResult.endpoint_used} fetched=${elements.length} kept=${records.length}`);
    return { room, city, outcome: "dry_ok", endpoint_used: fetchResult.endpoint_used, fetched: elements.length, kept: records.length, duration_ms: Date.now() - t0 };
  }

  if (records.length === 0) {
    log(`  ⊘ ${room}/${city} EMPTY · endpoint=${fetchResult.endpoint_used} fetched=${elements.length} named+geocoded=0`);
    emitFW("research_completed", "info", `${room} @ ${city} · empty result`,
      { room, city, fetched: elements.length, endpoint: fetchResult.endpoint_used });
    return { room, city, outcome: "empty_response", endpoint_used: fetchResult.endpoint_used, fetched: elements.length, kept: 0, duration_ms: Date.now() - t0 };
  }

  const persist = await persistToLab(records, roomCfg.schema);
  const rowsIn = persist.inserted + persist.updated;
  const outcome = rowsIn > 0 ? "rows_in" : "persist_zero";
  log(`  ${outcome === "rows_in" ? "✓" : "◇"} ${room.padEnd(14)} @ ${city.padEnd(11)} · endpoint=${fetchResult.endpoint_used} fetched=${elements.length} kept=${records.length} inserted=${persist.inserted} updated=${persist.updated} errors=${persist.errors}`);
  emitFW("research_completed", outcome === "rows_in" ? "ok" : "warn",
    `${room} @ ${city} · +${persist.inserted} / ${persist.updated} updated`,
    { room, city, fetched: elements.length, kept: records.length, endpoint: fetchResult.endpoint_used, ...persist, duration_ms: Date.now() - t0 });
  if (persist.inserted > 0) {
    emitFW("evidence_discovered", "ok",
      `${persist.inserted} new ${room} businesses in ${city}`,
      { room, city, count: persist.inserted });
  }
  return { room, city, outcome, endpoint_used: fetchResult.endpoint_used, fetched: elements.length, kept: records.length, ...persist, duration_ms: Date.now() - t0 };
}

// ─── Main · picks exit code from honest outcomes ─────────────────
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
      log(`start · full-round · anchor city=${p.city} (run #${p.cursor.runs})`);
      const rooms = Object.keys(ROOM_QUERIES);
      for (const room of rooms) {
        results.push(await runOne(room, p.city, health));
        await sleep(1500); // polite pause between rooms
      }
    }
  } finally {
    saveHealth(health);
  }
  const totals = results.reduce((acc, r) => {
    acc.rows_in += r.outcome === "rows_in" ? (r.inserted + r.updated) : 0;
    if (r.outcome === "rows_in") acc.cycles_rows_in++;
    if (r.outcome === "all_endpoints_down") acc.cycles_endpoints_down++;
    if (r.outcome === "empty_response") acc.cycles_empty++;
    if (r.outcome === "persist_zero") acc.cycles_persist_zero++;
    return acc;
  }, { rows_in: 0, cycles_rows_in: 0, cycles_endpoints_down: 0, cycles_empty: 0, cycles_persist_zero: 0 });
  log(`done · ${Date.now() - t0}ms · rows_in=${totals.rows_in} cycles[rows_in=${totals.cycles_rows_in} endpoints_down=${totals.cycles_endpoints_down} empty=${totals.cycles_empty} persist_zero=${totals.cycles_persist_zero}]`);

  // Exit code precedence · rows_in beats everything · else surface worst signal
  if (totals.rows_in > 0) process.exit(0);
  if (totals.cycles_endpoints_down > 0 && totals.cycles_rows_in === 0) process.exit(2);
  if (totals.cycles_persist_zero > 0) process.exit(4);
  process.exit(3);
}

main().catch((err) => { log(`fatal: ${String(err).slice(0, 400)}`); process.exit(1); });
