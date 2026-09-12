#!/usr/bin/env node
// scripts/nex-lab-verify.mjs
//
// Founder ADR-0304 · Fact Verifier · v2 (2026-09-10 · cross-source).
//
// Groups harvest_raw rows across all sources by a LOOSE cross-source key
// (name_normalized_loose + coord_grid_2dec + room_family). For each group:
//
//   · source_count >= 2 distinct providers  → confidence 0.95 · STRONG
//   · source_count = 1 (single provider)    → deterministic score gate
//     - score ≥ 0.85 → written as provisional (source_count=1)
//     - score < 0.85 → left in harvest_raw for future runs
//
// Subject_ref is the cross_dedupe_hash (64-char sha256) so cross-source
// matches merge into ONE verified row. Idempotent: re-runs UPSERT by
// (subject_ref, field_name).
//
// Provider families recognised:
//   osm_*       → 'osm'
//   wikidata.*  → 'wikidata'
//   kemenparekraf.* → 'kemenparekraf' (B8, not wired yet)
//   any other prefix → the leading dot-segment
//
// Usage:
//   node scripts/nex-lab-verify.mjs                 # all rooms
//   node scripts/nex-lab-verify.mjs --room food
//   node scripts/nex-lab-verify.mjs --limit 5000    # cap rows scanned per room

import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, existsSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const LAB_DIR = join(REPO_ROOT, "data", "nex-lab");
const LOG_PATH = join(LAB_DIR, "verify.log");

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
const SCAN_LIMIT = Number(args.get("limit") ?? "20000");

const ROOMS = ["accommodation", "food", "transport", "business", "activities"];
const SINGLE_SOURCE_CONFIDENCE_GATE = 0.85;
const CROSS_SOURCE_CONFIDENCE = 0.95;

function log(line) {
  const ts = new Date().toISOString();
  const msg = `[${ts}] ${line}\n`;
  process.stdout.write(msg);
  if (process.stdout.isTTY) {
    try { if (!existsSync(LAB_DIR)) mkdirSync(LAB_DIR, { recursive: true }); appendFileSync(LOG_PATH, msg); } catch { /* silent */ }
  }
}

async function loadPg() { try { return (await import("pg")).Client; } catch { return null; } }
function readPgUrl() {
  try {
    const env = readFileSync(join(REPO_ROOT, ".env.local"), "utf8");
    const m = env.match(/^NEX_TAXONOMY_POSTGRES_URL\s*=\s*(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch { /* fall through */ }
  return "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

// ═══════════════════════════════════════════════════════════════════
// Loose cross-source key · name + coord@2dec + room-family
// 2 decimals ≈ 1.1 km bucket · tolerates OSM/Wikidata coord drift
// name_norm_loose collapses punctuation + common stop-words
// ═══════════════════════════════════════════════════════════════════

const STOP_WORDS = new Set([
  "the","a","an","of","in","on","at","by","for",
  "hotel","hotels","guesthouse","guest","house","hostel","motel","resort","inn","lodge","villa","villas","apartments","apartment","kos",
  "restaurant","restoran","cafe","warung","bar","pub","kafe","bistro",
  "airport","bandara","station","stasiun","terminal","bus","kereta",
  "shop","toko","store","market","pasar","mall","plaza","supermarket","apotek","pharmacy",
  "museum","park","taman","attraction","tourism","tourist",
  "and","dan","&"
]);
function nameNormLoose(name) {
  if (!name) return "";
  const lower = String(name).toLowerCase();
  const ascii = lower.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  const clean = ascii.replace(/[^a-z0-9\s]+/g, " ").replace(/\s+/g, " ").trim();
  const tokens = clean.split(" ").filter(t => t.length > 0 && !STOP_WORDS.has(t));
  if (tokens.length === 0) return clean; // if EVERY token was a stop word, keep raw
  return tokens.join(" ");
}
function coordGrid2(lat, lon) {
  if (typeof lat !== "number" || typeof lon !== "number") return "0,0";
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}
function crossDedupeHash(name, lat, lon, roomFamily) {
  const norm = nameNormLoose(name);
  const grid = coordGrid2(lat, lon);
  return createHash("sha256").update(`${norm}|${grid}|${roomFamily}`).digest("hex");
}

function sourceFamily(source) {
  if (!source) return "unknown";
  if (source.startsWith("osm")) return "osm";
  if (source.startsWith("wikidata")) return "wikidata";
  if (source.startsWith("kemenparekraf")) return "kemenparekraf";
  return String(source).split(/[._]/, 1)[0] || "unknown";
}

// ═══════════════════════════════════════════════════════════════════
// Single-source quality score (kept as fallback gate for one-provider rows)
// ═══════════════════════════════════════════════════════════════════

function scoreRecord(payload) {
  const signals = {};
  const notes = [];

  const name = String(payload?.name ?? "").trim();
  if (name.length === 0) { signals.name = 0; notes.push("no_name"); }
  else if (name.length < 2) { signals.name = 0.2; notes.push("name_too_short"); }
  else if (/^[a-z0-9\s]+$/i.test(name) && name.length <= 100) signals.name = 1;
  else if (/[<>{}[\]\\]/.test(name)) { signals.name = 0.3; notes.push("name_has_symbols"); }
  else signals.name = 0.8;

  const lat = payload?.coordinates?.lat;
  const lon = payload?.coordinates?.lon;
  if (typeof lat !== "number" || typeof lon !== "number") { signals.coords = 0; notes.push("no_coords"); }
  else if (lat === 0 && lon === 0) { signals.coords = 0.1; notes.push("null_island"); }
  else if (lat < -90 || lat > 90 || lon < -180 || lon > 180) { signals.coords = 0.1; notes.push("out_of_range"); }
  else signals.coords = 1;

  const addr = payload?.address ?? {};
  const hasStreet = !!(addr.street && String(addr.street).trim().length > 0);
  const hasCity = !!(addr.city && String(addr.city).trim().length > 0);
  const hasFreeForm = !!(addr.free_form && String(addr.free_form).trim().length > 0);
  if ((hasStreet && hasCity) || hasFreeForm) signals.address = 1;
  else if (hasStreet || hasCity) signals.address = 0.7;
  else { signals.address = 0.3; notes.push("no_address"); }

  const hasPhone = !!payload?.phone;
  const hasSite = !!payload?.website;
  if (hasPhone && hasSite) signals.contact = 1;
  else if (hasPhone || hasSite) signals.contact = 0.75;
  else { signals.contact = 0.3; notes.push("no_contact"); }

  const tagCount = Object.keys(payload?.raw_tags ?? {}).length;
  signals.tags = Math.min(1, tagCount / 8);
  if (tagCount < 3 && !payload?.wikidata_id) notes.push(`sparse_tags:${tagCount}`);
  // Wikidata rows have curated identities · give them credit for the wikidata_id itself
  if (payload?.wikidata_id) signals.tags = Math.max(signals.tags, 0.7);

  signals.source_ref = payload?.osm_id || payload?.wikidata_id ? 1 : 0.5;
  signals.dedupe = 1;

  const overall =
    signals.name       * 0.20 +
    signals.coords     * 0.15 +
    signals.address    * 0.15 +
    signals.contact    * 0.15 +
    signals.tags       * 0.15 +
    signals.source_ref * 0.10 +
    signals.dedupe     * 0.10;
  return { confidence: Number(overall.toFixed(3)), signals, notes };
}

// ═══════════════════════════════════════════════════════════════════
// Verify one room · cross-source aware
// ═══════════════════════════════════════════════════════════════════

async function verifyRoom(Client, url, roomSlug, scanLimit) {
  const schema = `nex_lab_${roomSlug}`;
  const c = new Client({ connectionString: url, connectionTimeoutMillis: 8000 });
  await c.connect();

  const stats = {
    scanned: 0,
    unnamed: 0,
    ungeocoded: 0,
    groups_total: 0,
    groups_cross_source: 0,
    groups_single_source: 0,
    verified_written_strong: 0,
    verified_written_provisional: 0,
    verified_rejected_low_score: 0,
    upsert_errors: 0,
  };
  try {
    const rows = (await c.query(
      `SELECT record_id, source, source_ref, payload FROM ${schema}.harvest_raw LIMIT $1`,
      [scanLimit],
    )).rows;
    stats.scanned = rows.length;

    // Group rows by cross_dedupe_hash
    const groups = new Map(); // hash → { name, lat, lon, records: [], families: Set }
    for (const r of rows) {
      const p = r.payload ?? {};
      const name = p.name;
      const lat = p.coordinates?.lat;
      const lon = p.coordinates?.lon;
      if (!name) { stats.unnamed++; continue; }
      if (typeof lat !== "number" || typeof lon !== "number") { stats.ungeocoded++; continue; }
      const hash = crossDedupeHash(name, lat, lon, roomSlug);
      if (!groups.has(hash)) groups.set(hash, { hash, name, lat, lon, records: [], families: new Set() });
      const g = groups.get(hash);
      g.records.push({ record_id: r.record_id, source: r.source, source_ref: r.source_ref, payload: p });
      g.families.add(sourceFamily(r.source));
    }
    stats.groups_total = groups.size;

    // For each group, write verified
    for (const g of groups.values()) {
      const familyCount = g.families.size;
      const crossSource = familyCount >= 2;
      if (crossSource) stats.groups_cross_source++; else stats.groups_single_source++;

      // Merge payloads · prefer non-null · prefer Wikidata for canonical name,
      // OSM for phone/website/address if present, either for coords
      const merged = { name: g.name, coordinates: { lat: g.lat, lon: g.lon } };
      for (const rec of g.records) {
        const p = rec.payload;
        if (!merged.phone && p.phone) merged.phone = p.phone;
        if (!merged.website && p.website) merged.website = p.website;
        if (!merged.address && (p.address?.free_form || p.address?.street || p.address?.city)) merged.address = p.address;
        if (!merged.city && p.city) merged.city = p.city;
        if (!merged.wikidata_id && p.wikidata_id) merged.wikidata_id = p.wikidata_id;
        if (!merged.osm_id && p.osm_id) merged.osm_id = p.osm_id;
        if (!merged.category && p.wikidata_class_qid) merged.category = p.wikidata_class_qid;
      }
      merged.source_families = Array.from(g.families).sort();
      const bestSingleScore = Math.max(0, ...g.records.map(r => scoreRecord(r.payload).confidence));

      // Gate: reject single-source rows that don't clear score threshold
      if (!crossSource && bestSingleScore < SINGLE_SOURCE_CONFIDENCE_GATE) {
        stats.verified_rejected_low_score++;
        continue;
      }

      const confidence = crossSource ? CROSS_SOURCE_CONFIDENCE : bestSingleScore;
      const evidenceRefs = g.records.map(r => r.source_ref || String(r.record_id));

      try {
        // Upsert: if subject_ref exists, replace with the strongest snapshot
        await c.query(`
          INSERT INTO ${schema}.verified
            (subject_ref, field_name, field_value, confidence, source_count, evidence_refs, verified_at)
          VALUES ($1, 'identity', $2, $3, $4, $5, now())
          ON CONFLICT (subject_ref, field_name)
          DO UPDATE SET
            field_value  = EXCLUDED.field_value,
            confidence   = GREATEST(${schema}.verified.confidence, EXCLUDED.confidence),
            source_count = GREATEST(${schema}.verified.source_count, EXCLUDED.source_count),
            evidence_refs = EXCLUDED.evidence_refs,
            verified_at  = now()
        `, [
          g.hash,
          merged,
          confidence,
          familyCount,
          evidenceRefs,
        ]);
        if (crossSource) stats.verified_written_strong++; else stats.verified_written_provisional++;
      } catch (err) {
        // ON CONFLICT requires a unique constraint on (subject_ref, field_name).
        // If it doesn't exist, fall back to naive insert + fail-safe.
        stats.upsert_errors++;
        if (stats.upsert_errors <= 3) log(`  upsert err in ${schema}: ${String(err.message).slice(0, 150)}`);
        try {
          // Existence check + conditional insert (no ON CONFLICT dependency)
          const exists = (await c.query(
            `SELECT fact_id FROM ${schema}.verified WHERE subject_ref=$1 AND field_name='identity' LIMIT 1`,
            [g.hash],
          )).rows.length > 0;
          if (exists) {
            await c.query(`
              UPDATE ${schema}.verified
                SET field_value=$2, confidence=GREATEST(confidence, $3), source_count=GREATEST(source_count, $4), evidence_refs=$5, verified_at=now()
              WHERE subject_ref=$1 AND field_name='identity'
            `, [g.hash, merged, confidence, familyCount, evidenceRefs]);
          } else {
            await c.query(`
              INSERT INTO ${schema}.verified
                (subject_ref, field_name, field_value, confidence, source_count, evidence_refs)
              VALUES ($1, 'identity', $2, $3, $4, $5)
            `, [g.hash, merged, confidence, familyCount, evidenceRefs]);
          }
          if (crossSource) stats.verified_written_strong++; else stats.verified_written_provisional++;
          stats.upsert_errors--; // recovered
        } catch (err2) {
          if (stats.upsert_errors <= 3) log(`  fallback err in ${schema}: ${String(err2.message).slice(0, 150)}`);
        }
      }
    }
  } finally { try { await c.end(); } catch { /* ignore */ } }
  return stats;
}

async function main() {
  const t0 = Date.now();
  const Client = await loadPg();
  if (!Client) { log("pg missing"); process.exit(2); }
  const url = readPgUrl();

  const targetRooms = CLI_ROOM ? [CLI_ROOM] : ROOMS;
  log(`verify start · rooms=${targetRooms.join(",")} · scan_limit=${SCAN_LIMIT} · single_gate=${SINGLE_SOURCE_CONFIDENCE_GATE} · cross_conf=${CROSS_SOURCE_CONFIDENCE}`);

  const totals = { scanned:0, groups_total:0, groups_cross_source:0, verified_written_strong:0, verified_written_provisional:0, verified_rejected_low_score:0, unnamed:0, ungeocoded:0, upsert_errors:0 };
  for (const room of targetRooms) {
    try {
      const s = await verifyRoom(Client, url, room, SCAN_LIMIT);
      log(`  ${room.padEnd(14)} scanned=${s.scanned} groups=${s.groups_total} cross_source=${s.groups_cross_source} strong_written=${s.verified_written_strong} provisional_written=${s.verified_written_provisional} rejected=${s.verified_rejected_low_score} unnamed=${s.unnamed} ungeocoded=${s.ungeocoded} upsert_errors=${s.upsert_errors}`);
      for (const k of Object.keys(totals)) totals[k] += (s[k] ?? 0);
    } catch (err) {
      log(`  ${room.padEnd(14)} ERR: ${String(err.message).slice(0, 200)}`);
    }
  }
  log(`verify done · ${Date.now() - t0}ms · scanned=${totals.scanned} groups=${totals.groups_total} cross_source=${totals.groups_cross_source} strong_written=${totals.verified_written_strong} provisional=${totals.verified_written_provisional} rejected=${totals.verified_rejected_low_score}`);
  process.exit(0);
}

main().catch((err) => { log(`fatal: ${String(err).slice(0, 400)}`); process.exit(1); });
