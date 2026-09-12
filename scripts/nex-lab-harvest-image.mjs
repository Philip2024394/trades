#!/usr/bin/env node
// scripts/nex-lab-harvest-image.mjs
//
// Founder ADR-0304 · Image Lab harvester · Wikimedia Commons (CC-licensed).
//
// This is the ONLY source of images NEX may pull automatically. ADR-0022 forbids
// copying images from Google Business, Facebook, Instagram, Booking, Agoda, etc.
// Wikimedia Commons is explicitly permitted because every file carries a public
// CC / ODbL / public-domain licence and attribution is preserved.
//
// Each cycle:
//   1. Pick a category (rotating from a curated list of Indonesian tourism
//      categories · one per invocation)
//   2. List up to 50 files in that category via MediaWiki API list=categorymembers
//   3. For each file, resolve imageinfo (URL · license · thumb · size · uploader)
//   4. Insert into nex_lab_image.harvest_raw with source='wikimedia.commons.<cat_slug>'
//
// Dedupe hash = sha256(canonical file title). Same file across categories collapses.
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
const CURSOR_PATH = join(LAB_DIR, "image-cursor.json");
const HEALTH_PATH = join(LAB_DIR, "image-health.json");
const LOG_PATH = join(LAB_DIR, "image.log");

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
const CLI_CATEGORY = args.get("category");
const PAGE_LIMIT = Math.min(50, Number(args.get("limit") ?? "50"));
const DRY = args.get("dry") === "true";

// Curated Indonesia tourism/business categories (safe CC-licensed images)
const CATEGORIES = [
  "Hotels_in_Indonesia",
  "Resorts_in_Indonesia",
  "Restaurants_in_Indonesia",
  "Museums_in_Indonesia",
  "Beaches_of_Indonesia",
  "Waterfalls_of_Indonesia",
  "Volcanoes_of_Indonesia",
  "Temples_in_Indonesia",
  "Airports_in_Indonesia",
  "Railway_stations_in_Indonesia",
  "Tourist_attractions_in_Indonesia",
  "Shopping_malls_in_Indonesia",
  "Markets_in_Indonesia",
  "Traditional_Indonesian_food",
  "National_parks_of_Indonesia",
];

const ENDPOINT = "https://commons.wikimedia.org/w/api.php";
const USER_AGENT = "NEX-Lab-Harvester/2.0 (Indonesia tourism image discovery; contact: nex.lab@thenetworkers.app) node/" + process.versions.node;
const PER_REQUEST_TIMEOUT_MS = 20_000;
const MIN_REQUEST_INTERVAL_MS = 500; // 2 req/sec · well under Commons limits
const BREAKER_OPEN_AFTER_CONSECUTIVE = 3;
const BREAKER_OPEN_FOR_MS = 10 * 60_000;

function log(line) {
  const ts = new Date().toISOString();
  const msg = `[${ts}] ${line}\n`;
  process.stdout.write(msg);
  if (process.stdout.isTTY) {
    try { if (!existsSync(LAB_DIR)) mkdirSync(LAB_DIR, { recursive: true }); appendFileSync(LOG_PATH, msg); } catch { /* silent */ }
  }
}

// ─── Health tracking ─────────────────────────────────────────────
function loadHealth() {
  try { if (existsSync(HEALTH_PATH)) { const p = JSON.parse(readFileSync(HEALTH_PATH, "utf8")); if (p?.endpoints) return p; } } catch {}
  return { endpoints: {} };
}
function saveHealth(h) { try { if (!existsSync(LAB_DIR)) mkdirSync(LAB_DIR, { recursive: true }); writeFileSync(HEALTH_PATH, JSON.stringify(h, null, 2), "utf8"); } catch {} }
function eh(h, ep) { if (!h.endpoints[ep]) h.endpoints[ep] = { consecutive_failures: 0, breaker_open_until: null, last_success_at: null, last_failure_at: null, last_error: null, requests_attempted: 0, requests_succeeded: 0, bytes_in_total: 0 }; return h.endpoints[ep]; }
function ok(h, ep, bytes) { const x = eh(h, ep); x.consecutive_failures = 0; x.breaker_open_until = null; x.last_success_at = new Date().toISOString(); x.last_error = null; x.requests_attempted++; x.requests_succeeded++; x.bytes_in_total += bytes; }
function fail(h, ep, reason) { const x = eh(h, ep); x.consecutive_failures++; x.last_failure_at = new Date().toISOString(); x.last_error = String(reason).slice(0, 160); x.requests_attempted++; if (x.consecutive_failures >= BREAKER_OPEN_AFTER_CONSECUTIVE) x.breaker_open_until = new Date(Date.now() + BREAKER_OPEN_FOR_MS).toISOString(); }
function open(h, ep) { const x = eh(h, ep); if (!x.breaker_open_until) return false; if (Date.now() >= Date.parse(x.breaker_open_until)) { x.breaker_open_until = null; x.consecutive_failures = Math.max(0, x.consecutive_failures - 1); return false; } return true; }

// ─── Rate-limited fetch ─────────────────────────────────────────
let __lastReq = 0;
async function fetchJson(params, health) {
  if (open(health, ENDPOINT)) return { ok: false, error: "breaker_open" };
  const wait = __lastReq + MIN_REQUEST_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  __lastReq = Date.now();
  const url = ENDPOINT + "?" + new URLSearchParams({ ...params, format: "json", formatversion: "2" }).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_REQUEST_TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers: { "user-agent": USER_AGENT, "accept": "application/json" }, signal: controller.signal });
    clearTimeout(timer);
    if (r.status === 429) { fail(health, ENDPOINT, `http_429`); return { ok: false, error: "http_429" }; }
    if (!r.ok) { fail(health, ENDPOINT, `http_${r.status}`); return { ok: false, error: `http_${r.status}` }; }
    const text = await r.text();
    const bytes = Buffer.byteLength(text, "utf8");
    try { const j = JSON.parse(text); ok(health, ENDPOINT, bytes); return { ok: true, json: j, bytes }; }
    catch (e) { fail(health, ENDPOINT, `parse:${String(e.message).slice(0, 40)}`); return { ok: false, error: "parse" }; }
  } catch (err) {
    clearTimeout(timer);
    const reason = err && err.name === "AbortError" ? "timeout" : (err.message ?? String(err));
    fail(health, ENDPOINT, reason);
    return { ok: false, error: reason };
  }
}

// ─── Rotation cursor ────────────────────────────────────────────
function loadCursor() { try { if (existsSync(CURSOR_PATH)) return JSON.parse(readFileSync(CURSOR_PATH, "utf8")); } catch {} return { cat_idx: 0, runs: 0, cmcontinue: {} }; }
function saveCursor(s) { try { if (!existsSync(LAB_DIR)) mkdirSync(LAB_DIR, { recursive: true }); writeFileSync(CURSOR_PATH, JSON.stringify(s, null, 2), "utf8"); } catch {} }
function pickCategory() {
  const c = loadCursor();
  const cat = CATEGORIES[c.cat_idx % CATEGORIES.length];
  const next = { ...c, cat_idx: (c.cat_idx + 1) % CATEGORIES.length, runs: (c.runs ?? 0) + 1, last_iso: new Date().toISOString(), last_cat: cat };
  saveCursor(next);
  return { category: cat, cmcontinue: c.cmcontinue?.[cat] ?? "" };
}
function saveContinue(cat, token) {
  try {
    const c = existsSync(CURSOR_PATH) ? JSON.parse(readFileSync(CURSOR_PATH, "utf8")) : { cat_idx: 0, runs: 0, cmcontinue: {} };
    if (!c.cmcontinue) c.cmcontinue = {};
    if (token) c.cmcontinue[cat] = token; else delete c.cmcontinue[cat];
    writeFileSync(CURSOR_PATH, JSON.stringify(c, null, 2), "utf8");
  } catch {}
}

// ─── Normalise a Commons file into harvest_raw payload ──────────
function catSlug(cat) { return cat.toLowerCase().replace(/_/g, "_"); }
function normalise(page, imageinfo, category) {
  const title = page.title;
  if (!title) return null;
  const ii = imageinfo?.[0] ?? {};
  const url = ii.url ?? null;
  const thumb = ii.thumburl ?? null;
  const extmeta = ii.extmetadata ?? {};
  const license = extmeta.LicenseShortName?.value ?? extmeta.License?.value ?? "unknown";
  const licenseUrl = extmeta.LicenseUrl?.value ?? null;
  const artist = extmeta.Artist?.value ?? null;
  const dateOriginal = extmeta.DateTimeOriginal?.value ?? null;
  const objectName = extmeta.ObjectName?.value ?? null;
  const description = extmeta.ImageDescription?.value ?? null;
  const attribution = extmeta.Attribution?.value ?? null;
  const permission = extmeta.Permission?.value ?? null;
  const gpsLat = extmeta.GPSLatitude?.value ?? null;
  const gpsLon = extmeta.GPSLongitude?.value ?? null;
  const w = ii.width ?? null;
  const h = ii.height ?? null;
  return {
    source: `wikimedia.commons.${catSlug(category)}`,
    source_ref: `commons:${page.pageid}`,
    dedupe_hash: createHash("sha256").update(title.toLowerCase().trim()).digest("hex"),
    payload: {
      title,
      pageid: page.pageid,
      canonical_url: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
      image_url: url,
      thumb_url: thumb,
      width: w,
      height: h,
      mime: ii.mime ?? null,
      size_bytes: ii.size ?? null,
      license,
      license_url: licenseUrl,
      artist: artist ? String(artist).replace(/<[^>]+>/g, "").slice(0, 300) : null,
      description: description ? String(description).replace(/<[^>]+>/g, "").slice(0, 800) : null,
      attribution: attribution ? String(attribution).replace(/<[^>]+>/g, "").slice(0, 300) : null,
      permission: permission ? String(permission).replace(/<[^>]+>/g, "").slice(0, 200) : null,
      date_original: dateOriginal,
      object_name: objectName,
      gps: (gpsLat && gpsLon) ? { lat: Number(gpsLat), lon: Number(gpsLon) } : null,
      category,
      source_license_family: "wikimedia_commons",
      // ADR-0022 compliance stamp · reminds anyone reading downstream
      adr_0022_compliant: true,
    },
  };
}

// ─── Persist ────────────────────────────────────────────────────
async function persistToLab(records) {
  const pgUrl = process.env.NEX_TAXONOMY_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
  let ClientMod; try { ClientMod = (await import("pg")).Client; } catch { return { inserted: 0, updated: 0, errors: 1 }; }
  const c = new ClientMod({ connectionString: pgUrl, connectionTimeoutMillis: 8000 });
  await c.connect();
  let inserted = 0, updated = 0, errors = 0;
  try {
    for (const r of records) {
      try {
        const existing = await c.query(`SELECT record_id FROM nex_lab_image.harvest_raw WHERE dedupe_hash = $1 LIMIT 1`, [r.dedupe_hash]);
        if (existing.rows.length > 0) {
          await c.query(`UPDATE nex_lab_image.harvest_raw SET payload=$1, harvested_at=now(), source=$2, source_ref=$3 WHERE record_id=$4`, [r.payload, r.source, r.source_ref, existing.rows[0].record_id]);
          updated++;
        } else {
          await c.query(`INSERT INTO nex_lab_image.harvest_raw (source, source_ref, dedupe_hash, payload) VALUES ($1, $2, $3, $4)`, [r.source, r.source_ref, r.dedupe_hash, r.payload]);
          inserted++;
        }
      } catch (err) { errors++; if (errors <= 2) log(`  insert err: ${String(err.message).slice(0, 120)}`); }
    }
  } finally { try { await c.end(); } catch {} }
  return { inserted, updated, errors };
}

// ─── runOne · fetch one category page (up to PAGE_LIMIT files) ──
async function runOne(category, cmcontinueToken, health) {
  const t0 = Date.now();
  log(`  ▶ category=${category} cmcontinue=${cmcontinueToken || "-"} limit=${PAGE_LIMIT}`);
  const listRes = await fetchJson({
    action: "query",
    list: "categorymembers",
    cmtitle: `Category:${category}`,
    cmtype: "file",
    cmlimit: String(PAGE_LIMIT),
    ...(cmcontinueToken ? { cmcontinue: cmcontinueToken } : {}),
  }, health);
  if (!listRes.ok) { log(`  ✗ list failed: ${listRes.error}`); return { outcome: "all_endpoints_down", duration_ms: Date.now() - t0 }; }
  const members = listRes.json.query?.categorymembers ?? [];
  const nextToken = listRes.json.continue?.cmcontinue ?? null;
  if (members.length === 0) {
    saveContinue(category, null); // reset when end of category reached
    log(`  ⊘ empty · resetting cmcontinue for category=${category}`);
    return { outcome: "empty_response", duration_ms: Date.now() - t0 };
  }
  // Batch imageinfo query · MediaWiki API allows up to 50 titles per request
  const titles = members.map(m => m.title).join("|");
  const iiRes = await fetchJson({
    action: "query",
    titles,
    prop: "imageinfo",
    iiprop: "url|extmetadata|size|mime",
    iiurlwidth: "800",
    iimetadataversion: "2",
  }, health);
  if (!iiRes.ok) { log(`  ✗ imageinfo failed: ${iiRes.error}`); return { outcome: "all_endpoints_down", duration_ms: Date.now() - t0 }; }
  const pages = iiRes.json.query?.pages ?? [];
  const records = [];
  for (const p of pages) {
    const rec = normalise(p, p.imageinfo, category);
    if (rec && rec.payload.image_url) records.push(rec);
  }
  if (DRY) {
    log(`  ${category} DRY · members=${members.length} kept=${records.length} cmcontinue=${nextToken || "-"}`);
    return { outcome: "dry_ok", members: members.length, kept: records.length, duration_ms: Date.now() - t0 };
  }
  if (records.length === 0) {
    log(`  ◇ ${category} · members=${members.length} kept=0 (no imageinfo URLs)`);
    saveContinue(category, nextToken);
    return { outcome: "empty_response", members: members.length, kept: 0, duration_ms: Date.now() - t0 };
  }
  const persist = await persistToLab(records);
  saveContinue(category, nextToken);
  const rowsIn = persist.inserted + persist.updated;
  const outcome = rowsIn > 0 ? "rows_in" : "persist_zero";
  log(`  ${outcome === "rows_in" ? "✓" : "◇"} ${category} · members=${members.length} kept=${records.length} inserted=${persist.inserted} updated=${persist.updated} errors=${persist.errors} next=${nextToken || "-"}`);
  return { outcome, ...persist, members: members.length, kept: records.length, duration_ms: Date.now() - t0 };
}

async function main() {
  const t0 = Date.now();
  const health = loadHealth();
  const results = [];
  try {
    if (CLI_CATEGORY) {
      log(`start · explicit category=${CLI_CATEGORY}`);
      results.push(await runOne(CLI_CATEGORY, "", health));
    } else {
      const p = pickCategory();
      log(`start · rotation category=${p.category} (cmcontinue=${p.cmcontinue || "-"})`);
      results.push(await runOne(p.category, p.cmcontinue, health));
    }
  } finally { saveHealth(health); }
  const t = results.reduce((a, r) => {
    a.rows_in += r.outcome === "rows_in" ? ((r.inserted ?? 0) + (r.updated ?? 0)) : 0;
    if (r.outcome === "rows_in") a.cycles_rows_in++;
    if (r.outcome === "all_endpoints_down") a.cycles_endpoints_down++;
    if (r.outcome === "empty_response") a.cycles_empty++;
    if (r.outcome === "persist_zero") a.cycles_persist_zero++;
    return a;
  }, { rows_in: 0, cycles_rows_in: 0, cycles_endpoints_down: 0, cycles_empty: 0, cycles_persist_zero: 0 });
  log(`done · ${Date.now() - t0}ms · rows_in=${t.rows_in} cycles[rows_in=${t.cycles_rows_in} endpoints_down=${t.cycles_endpoints_down} empty=${t.cycles_empty} persist_zero=${t.cycles_persist_zero}]`);
  if (t.rows_in > 0) process.exit(0);
  if (t.cycles_endpoints_down > 0 && t.cycles_rows_in === 0) process.exit(2);
  if (t.cycles_persist_zero > 0) process.exit(4);
  process.exit(3);
}

main().catch((err) => { log(`fatal: ${String(err).slice(0, 400)}`); process.exit(1); });
