#!/usr/bin/env node
// scripts/nex-lab-wikidata.mjs
//
// Founder ADR-0304 · Wikidata SPARQL cross-source verifier · v1.
//
// For every harvest_raw row that scored 0.60-0.84 (OSM-only), query
// Wikidata for a matching entity by name near the same coordinates.
// If found: write a verified row with:
//   · confidence = osm_score + 0.15 wikidata_bonus (capped at 0.99)
//   · source_count = 2
//   · evidence_refs = [osm_ref, wikidata_qid]
//
// GOLDEN RULE:
//   · Never fabricate a Wikidata match · empty result → SKIP silently
//   · Rate-limit ourselves to Wikidata policy (5 concurrent max · 30 s per query timeout)
//   · Cache Wikidata responses in data/nex-lab/wikidata-cache/ so re-runs are free
//   · Query CC0-licensed data only · doctrine-safe forever
//
// Usage:
//   node scripts/nex-lab-wikidata.mjs                   # all borderline rooms
//   node scripts/nex-lab-wikidata.mjs --room food       # one room
//   node scripts/nex-lab-wikidata.mjs --limit 50        # cap per room

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const LAB_DIR = join(REPO_ROOT, "data", "nex-lab");
const CACHE_DIR = join(LAB_DIR, "wikidata-cache");
const LOG_PATH = join(LAB_DIR, "wikidata.log");

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
const LIMIT = Number(args.get("limit") ?? "50");
const RESUME = args.get("resume") !== "false";

const ROOMS = ["accommodation", "food", "transport", "business", "activities"];
const WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";
const CONFIDENCE_THRESHOLD = 0.85;
const WIKIDATA_BONUS = 0.15;
const MAX_QUERIES_PER_SECOND = 1; // conservative · Wikidata allows more but we're friendly
const BBOX_RADIUS_KM = 2;

function log(line) {
  const ts = new Date().toISOString();
  const msg = `[${ts}] ${line}\n`;
  process.stdout.write(msg);
  try {
    if (!existsSync(LAB_DIR)) mkdirSync(LAB_DIR, { recursive: true });
    appendFileSync(LOG_PATH, msg);
  } catch { /* silent */ }
}

// ─── Score signal (mirrors nex-lab-verify.mjs) ────────────────────
function scoreRecord(payload) {
  const signals = {};
  const name = String(payload?.name ?? "").trim();
  if (name.length === 0) signals.name = 0;
  else if (name.length < 2) signals.name = 0.2;
  else if (/^[a-z0-9\s]+$/i.test(name) && name.length <= 100) signals.name = 1;
  else if (/[<>{}[\]\\]/.test(name)) signals.name = 0.3;
  else signals.name = 0.8;
  const lat = payload?.coordinates?.lat;
  const lon = payload?.coordinates?.lon;
  if (typeof lat !== "number" || typeof lon !== "number") signals.coords = 0;
  else if (lat === 0 && lon === 0) signals.coords = 0.1;
  else if (lat < -90 || lat > 90 || lon < -180 || lon > 180) signals.coords = 0.1;
  else signals.coords = 1;
  const addr = payload?.address ?? {};
  const hasStreet = !!(addr.street && String(addr.street).trim().length > 0);
  const hasCity = !!(addr.city && String(addr.city).trim().length > 0);
  signals.address = (hasStreet && hasCity) ? 1 : (hasStreet || hasCity) ? 0.7 : 0.3;
  const hasPhone = !!payload?.phone;
  const hasSite = !!payload?.website;
  signals.contact = (hasPhone && hasSite) ? 1 : (hasPhone || hasSite) ? 0.75 : 0.3;
  const tagCount = Object.keys(payload?.raw_tags ?? {}).length;
  signals.tags = Math.min(1, tagCount / 8);
  signals.source_ref = payload?.osm_id ? 1 : 0.5;
  signals.dedupe = 1;
  const overall = signals.name * 0.20 + signals.coords * 0.15 + signals.address * 0.15
    + signals.contact * 0.15 + signals.tags * 0.15 + signals.source_ref * 0.10 + signals.dedupe * 0.10;
  return { confidence: Number(overall.toFixed(3)), signals };
}

// ─── Wikidata cache · avoid re-querying ─────────────────────────
function cacheKey(name, lat, lon) {
  return createHash("sha256").update(`${name.toLowerCase()}|${lat.toFixed(2)}|${lon.toFixed(2)}`).digest("hex");
}
function cacheGet(key) {
  try {
    const p = join(CACHE_DIR, `${key.slice(0, 2)}`, `${key.slice(2)}.json`);
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, "utf8"));
  } catch { return null; }
}
function cacheSet(key, value) {
  try {
    const sub = join(CACHE_DIR, key.slice(0, 2));
    if (!existsSync(sub)) mkdirSync(sub, { recursive: true });
    writeFileSync(join(sub, `${key.slice(2)}.json`), JSON.stringify({ ts_iso: new Date().toISOString(), value }));
  } catch { /* silent */ }
}

// ─── SPARQL query · matches by label + geospatial ──────────────
function bboxAround(lat, lon, km) {
  const dLat = km / 111;
  const dLon = km / (111 * Math.cos((lat * Math.PI) / 180));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLon: lon - dLon, maxLon: lon + dLon };
}

function buildSparql(name, lat, lon) {
  const bbox = bboxAround(lat, lon, BBOX_RADIUS_KM);
  const esc = name.replace(/["\\]/g, "\\$&").slice(0, 100);
  // Query: entities whose label MATCHES or CONTAINS the OSM name, AND
  // coordinate is within a small geospatial box around the OSM point.
  // Uses altLabel too (Wikidata has aliases for many landmarks).
  return `
    SELECT ?item ?itemLabel ?coord WHERE {
      SERVICE wikibase:box {
        ?item wdt:P625 ?coord .
        bd:serviceParam wikibase:cornerWest "Point(${bbox.minLon.toFixed(4)} ${bbox.minLat.toFixed(4)})"^^geo:wktLiteral .
        bd:serviceParam wikibase:cornerEast "Point(${bbox.maxLon.toFixed(4)} ${bbox.maxLat.toFixed(4)})"^^geo:wktLiteral .
      }
      { ?item rdfs:label "${esc}"@en . }
      UNION { ?item rdfs:label "${esc}"@id . }
      UNION { ?item skos:altLabel "${esc}"@en . }
      UNION { ?item skos:altLabel "${esc}"@id . }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,id". }
    } LIMIT 5
  `.trim();
}

async function queryWikidata(name, lat, lon, attempt = 0) {
  const key = cacheKey(name, lat, lon);
  if (RESUME) {
    const cached = cacheGet(key);
    if (cached) return cached.value;
  }
  const BACKOFF = [2000, 5000, 15000];
  const url = `${WIKIDATA_ENDPOINT}?format=json&query=${encodeURIComponent(buildSparql(name, lat, lon))}`;
  try {
    const res = await fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": "NEX-Lab-Verifier/1.0 (github.com/nex)" },
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 429 || res.status === 503) {
      if (attempt >= BACKOFF.length) return { matches: [], error: `rate_limited_${res.status}` };
      await sleep(BACKOFF[attempt]);
      return queryWikidata(name, lat, lon, attempt + 1);
    }
    if (!res.ok) {
      cacheSet(key, { matches: [], error: `http_${res.status}` });
      return { matches: [], error: `http_${res.status}` };
    }
    const j = await res.json();
    const rows = j.results?.bindings ?? [];
    const matches = rows.map((r) => ({
      qid: r.item?.value?.replace("http://www.wikidata.org/entity/", "") ?? null,
      label: r.itemLabel?.value ?? null,
      coord: r.coord?.value ?? null,
    })).filter((m) => m.qid);
    const result = { matches };
    cacheSet(key, result);
    return result;
  } catch (err) {
    if (attempt >= BACKOFF.length) {
      const errResult = { matches: [], error: String(err).slice(0, 100) };
      cacheSet(key, errResult);
      return errResult;
    }
    await sleep(BACKOFF[attempt]);
    return queryWikidata(name, lat, lon, attempt + 1);
  }
}

// ─── Rate limiter ────────────────────────────────────────────────
async function throttled(fn) {
  const start = Date.now();
  const result = await fn();
  const elapsed = Date.now() - start;
  const minMs = 1000 / MAX_QUERIES_PER_SECOND;
  if (elapsed < minMs) await sleep(minMs - elapsed);
  return result;
}

// ─── Process one room ────────────────────────────────────────────
async function processRoom(Client, url, roomSlug, limit) {
  const schema = `nex_lab_${roomSlug}`;
  const c = new Client({ connectionString: url, connectionTimeoutMillis: 8000 });
  await c.connect();
  let seen = 0, queried = 0, matched = 0, verified = 0, cacheHits = 0;
  try {
    // Find harvest_raw rows NOT yet verified · score them · pick borderline
    const rows = (await c.query(`
      SELECT h.record_id, h.dedupe_hash, h.source_ref, h.payload
      FROM ${schema}.harvest_raw h
      WHERE NOT EXISTS (SELECT 1 FROM ${schema}.verified v WHERE v.subject_ref = h.dedupe_hash)
      LIMIT $1
    `, [limit * 5])).rows; // scan 5x limit · we filter to borderline in-memory

    const borderline = [];
    for (const r of rows) {
      const { confidence } = scoreRecord(r.payload);
      if (confidence >= 0.60 && confidence < CONFIDENCE_THRESHOLD) {
        borderline.push({ record: r, osm_confidence: confidence });
      }
      if (borderline.length >= limit) break;
    }
    log(`  ${roomSlug.padEnd(14)} · scanned=${rows.length} borderline=${borderline.length}`);

    for (const b of borderline) {
      seen++;
      const p = b.record.payload;
      const name = p?.name;
      const lat = p?.coordinates?.lat;
      const lon = p?.coordinates?.lon;
      if (!name || typeof lat !== "number" || typeof lon !== "number") continue;

      const key = cacheKey(name, lat, lon);
      const cached = cacheGet(key);
      if (cached) cacheHits++;

      const wd = await throttled(() => queryWikidata(name, lat, lon));
      queried++;
      if (wd.matches && wd.matches.length > 0) {
        matched++;
        const boosted = Math.min(0.99, b.osm_confidence + WIKIDATA_BONUS);
        try {
          await c.query(`
            INSERT INTO ${schema}.verified
              (subject_ref, field_name, field_value, confidence, source_count, evidence_refs)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            b.record.dedupe_hash,
            "identity",
            {
              name, city: p.city, coordinates: p.coordinates,
              phone: p.phone ?? null, website: p.website ?? null,
              address: p.address ?? null,
              wikidata_qids: wd.matches.map((m) => m.qid),
              osm_confidence: b.osm_confidence,
            },
            boosted,
            2, // OSM + Wikidata
            [b.record.source_ref ?? "osm", ...wd.matches.map((m) => `wikidata:${m.qid}`)],
          ]);
          verified++;
        } catch { /* dupe insert · skip */ }
      }
    }
  } finally { try { await c.end(); } catch { /* ignore */ } }
  return { seen, queried, matched, verified, cacheHits };
}

// ─── Main ─────────────────────────────────────────────────────────
async function main() {
  const t0 = Date.now();
  const { Client } = await import("pg").catch(() => ({}));
  if (!Client) { log("pg missing"); process.exit(2); }
  const url = process.env.NEX_TAXONOMY_POSTGRES_URL
    ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";

  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

  const targetRooms = CLI_ROOM ? [CLI_ROOM] : ROOMS;
  log(`wikidata start · rooms=${targetRooms.join(",")} · limit=${LIMIT} per room · endpoint=${WIKIDATA_ENDPOINT}`);

  let totalSeen = 0, totalMatched = 0, totalVerified = 0, totalCache = 0;
  for (const room of targetRooms) {
    try {
      const r = await processRoom(Client, url, room, LIMIT);
      log(`  ${room.padEnd(14)} · seen=${r.seen} queried=${r.queried} matched=${r.matched} verified=${r.verified} cache=${r.cacheHits}`);
      totalSeen += r.seen;
      totalMatched += r.matched;
      totalVerified += r.verified;
      totalCache += r.cacheHits;
    } catch (err) {
      log(`  ${room.padEnd(14)} · err: ${String(err).slice(0, 200)}`);
    }
  }

  const rate = totalSeen > 0 ? Math.round((totalMatched / totalSeen) * 1000) / 10 : 0;
  log(`wikidata done · seen=${totalSeen} matched=${totalMatched} (${rate}%) verified=${totalVerified} cache_hits=${totalCache} · ${Date.now() - t0}ms`);
  process.exit(0);
}

main().catch((err) => { log(`fatal: ${String(err).slice(0, 400)}`); process.exit(1); });
