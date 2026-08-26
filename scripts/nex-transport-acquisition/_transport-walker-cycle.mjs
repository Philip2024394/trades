#!/usr/bin/env node
// scripts/nex-transport-acquisition/_transport-walker-cycle.mjs
//
// TRANSPORT WALKER · one cycle · continuous-scheduler safe.
//
// Reuses the query universe (src/lib/nex-transport-acquisition/query-universe.ts)
// so keyword expansion lives in ONE typed source of truth.
//
// Provider order:
//   1. Nominatim  (primary · known-working · rate-limit 1 req/1.5s)
//   2. Overpass   (fallback · when reachable)
//
// Doctrine:
//   · Public-source only · schema CHECK source_kind_must_be_public
//   · Discovery only · stage='discovered'
//   · Platform-signal queries (Gojek/Grab/etc.) NEVER label a record as an
//     affiliation · record's vehicle_types stays as the family's kindHint
//     (which for platform_signal is 'unknown').
//   · 0 outreach · 0 dispatch · 0 money
//   · Cycle recorded in nex.worker_cycle_run · provider_results in summary
//
// Invoked by scripts/nex-dev-scheduler.mjs entry `acquisition:transport:Yogyakarta`.

import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import {
  REJECTION_REASONS,
  createRejectionCounter,
  computeCycleOutcome,
} from "../nex-worker/rejection-reasons.mjs";
import {
  verifyInsertedRow,
  checkPersistenceInvariant,
} from "../nex-worker/persistence-contract.mjs";

const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 3 });

// P5 persistence contract 2026-08-26 · module-level worker_id (matches openCycle).
// Same label spans all cities per existing convention (transport walker takes --city
// but writes worker_id='acquisition:transport:Yogyakarta' historically).
const WORKER_ID = "acquisition:transport:Yogyakarta";

// ── Import query universe from TS-compiled runtime ────────────────────
// The scheduler runs `node` directly against the .mjs. We inline the query
// universe values here because dynamic-importing a .ts file at runtime isn't
// possible without a build step. The types.ts definitions remain the source
// of truth · this inlined list must be kept in sync (test enforces via test
// file counting query family keys).

const YOGYA_LOCATION_TERMS = [
  "Jogja", "Yogyakarta", "Kota Yogyakarta", "Sleman", "Bantul",
  "Kulon Progo", "Gunungkidul", "Depok Sleman", "Gamping", "Mlati",
  "Ngaglik", "Kasihan", "Banguntapan", "Wates", "Prambanan",
];
const PRIMARY_LOCATION_TERMS = ["Jogja", "Yogyakarta"];

const QUERY_FAMILIES = [
  { familyKey: "driver_ojek", vehicleKindHint: "motorcycle", supportsPassenger: true, supportsLogistics: false, isPlatformSignal: false,
    keywordsSingular: ["ojek","ojol","driver motor","jasa driver","supir","supir pribadi","driver pribadi","driver harian","driver freelance","driver lepas"],
    keywordsAlreadyLocalised: ["ojek jogja","ojek yogyakarta","driver jogja","driver yogyakarta"] },
  { familyKey: "passenger_car", vehicleKindHint: "car", supportsPassenger: true, supportsLogistics: false, isPlatformSignal: false,
    keywordsSingular: ["sewa mobil","sewa mobil dengan driver","rental mobil","rental mobil driver","car rental","private driver","private car","chauffeur","jasa transportasi","antar jemput"],
    keywordsAlreadyLocalised: ["transport jogja","antar jemput jogja"] },
  { familyKey: "taxi", vehicleKindHint: "taxi", supportsPassenger: true, supportsLogistics: false, isPlatformSignal: false,
    keywordsSingular: ["taxi"],
    keywordsAlreadyLocalised: ["taxi jogja","taxi yogyakarta","Bluebird Yogyakarta"] },
  { familyKey: "platform_signal", vehicleKindHint: "unknown", supportsPassenger: false, supportsLogistics: false, isPlatformSignal: true,
    keywordsSingular: [],
    keywordsAlreadyLocalised: ["Gojek Yogyakarta","Go-Jek Jogja","Grab Yogyakarta","Grab Jogja","Maxim Jogja","ShopeeFood Jogja","Shopee Express Jogja","GrabExpress Jogja"] },
  { familyKey: "courier", vehicleKindHint: "courier", supportsPassenger: false, supportsLogistics: true, isPlatformSignal: false,
    keywordsSingular: ["kurir","kurir motor","kurir mobil","delivery driver","jasa kirim barang","jasa antar barang","jasa pengiriman","local delivery","same day delivery","courier","courier service","ekspedisi"],
    keywordsAlreadyLocalised: ["kurir jogja","kurir yogyakarta","delivery jogja"] },
  { familyKey: "goods_pickup_truck", vehicleKindHint: "pickup", supportsPassenger: false, supportsLogistics: true, isPlatformSignal: false,
    keywordsSingular: ["pickup","sewa pickup","jasa pickup","angkut barang","angkutan barang","truk","sewa truk","jasa truk","truck rental","cargo","cargo transport","logistics","logistik","jasa logistik","pindahan","jasa pindahan"],
    keywordsAlreadyLocalised: ["sewa pickup jogja","sewa truk jogja","pindahan jogja"] },
  { familyKey: "tourism_airport", vehicleKindHint: "tourist_driver", supportsPassenger: true, supportsLogistics: false, isPlatformSignal: false,
    keywordsSingular: ["driver wisata","tour driver","private tour driver","airport transfer","airport driver","antar jemput bandara"],
    keywordsAlreadyLocalised: ["YIA airport transfer","Yogyakarta airport transport","hotel airport transfer jogja","tourist transport jogja","driver wisata jogja"] },
  { familyKey: "van_minibus_bus", vehicleKindHint: "minibus", supportsPassenger: true, supportsLogistics: false, isPlatformSignal: false,
    keywordsSingular: ["sewa van","rental van","minibus","sewa minibus","sewa bus","bus pariwisata","travel","shuttle"],
    keywordsAlreadyLocalised: ["sewa elf jogja","sewa bus jogja","bus pariwisata jogja","travel yogyakarta","shuttle jogja"] },
];

function generateQueries() {
  const out = [];
  for (const fam of QUERY_FAMILIES) {
    for (const kw of fam.keywordsAlreadyLocalised) {
      out.push({ query: kw, ...pickFam(fam) });
    }
    if (!fam.isPlatformSignal) {
      for (const kw of fam.keywordsSingular) {
        for (const loc of PRIMARY_LOCATION_TERMS) {
          out.push({ query: `${kw} ${loc}`, ...pickFam(fam) });
        }
      }
    }
  }
  const seen = new Set();
  return out.filter((q) => {
    const k = q.query.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
function pickFam(fam) {
  return {
    familyKey: fam.familyKey, vehicleKindHint: fam.vehicleKindHint,
    supportsPassenger: fam.supportsPassenger, supportsLogistics: fam.supportsLogistics,
    isPlatformSignal: fam.isPlatformSignal,
  };
}

// ── Config ────────────────────────────────────────────────────────────
// Yogyakarta default viewbox · Phase C (2026-08-24) makes the walker city-
// configurable · when --city=NAME is passed the viewbox is computed from
// city-bbox-catalogue.mjs and location terms swap to that city's canonical.
const YOGYA_VIEWBOX = "110.15,-7.55,110.55,-8.05"; // west,north,east,south
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "NEX-Transport-Walker/0.4 (public-source-only)";
const OVERPASS_ENDPOINTS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const OVERPASS_TIMEOUT_MS = 45000;
const CURSOR_FILE = path.resolve("data/nex-transport-walker-cursor.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Phase C (2026-08-24) · parse --city=NAME.
function parseArgs(argv) {
  const out = { city: null };
  for (const a of argv.slice(2)) {
    const m = a.match(/^--city=(.+)$/);
    if (m) out.city = m[1].trim();
  }
  return out;
}

// 2026-08-24 · Phase 1 refactor · city bboxes derived from the shared
// data/nex-city-catalogue.json (loaded via nex-city-catalogue/loader.mjs).
// Adding a city = one JSON entry · transport walker automatically supports it.
import { cityByAny, allCities } from "../nex-city-catalogue/loader.mjs";

// Legacy CITY_BBOX map kept as a shim so any downstream code that iterates
// or introspects it stays working. Populated once at module load.
const CITY_BBOX = Object.fromEntries(
  allCities().map((c) => [c.canonical, { sw: c.bboxSw, ne: c.bboxNe }]),
);

function cityFromArg(cityArg) {
  const c = cityByAny(cityArg);
  return c ? c.canonical : null;
}

function viewboxForCity(cityName) {
  const c = cityByAny(cityName);
  if (!c) return YOGYA_VIEWBOX;
  const [swLat, swLng] = c.bboxSw;
  const [neLat, neLng] = c.bboxNe;
  return `${swLng},${neLat},${neLng},${swLat}`;
}

// Provider Rate Governor helpers · Phase C (2026-08-24) · mirrors market walker.
// Every Nominatim/Overpass call acquires a lease from nex.provider_rate_lease
// so 10+ concurrent walkers cannot exceed the provider min_interval globally.
// Never bypass · governor is authoritative.
const TRANSPORT_WORKER_ID = "acquisition:transport:Yogyakarta";

// 2026-08-24 · P0 concurrency fix. Under MAX_SLOTS=10 burst the SERIALIZABLE
// acquire tx was aborting with SQLSTATE 40001 (see 7h forensic report ·
// transport = 100% failure with "could not serialize access..."). Retry with
// exponential + jitter backoff so a single conflict doesn't kill the cycle.
const SERIALIZATION_RETRYABLE_CODES = new Set(["40001", "40P01"]);
// 2026-08-24 · bumped 8 → 20 after transport:Bantul single-event forensic.
// See _provider-lease-helper.mjs for reasoning.
const MAX_SERIALIZATION_RETRIES = 20;

async function acquireProviderLease(provider) {
  // 2026-08-24 · Stage-10 stability · 30s → 300s per Philip's directive.
  // A legitimate worker patiently queued behind other legitimate workers
  // survives the burst · governor authoritative · no walker bypasses.
  const MAX_WAIT_MS = 300000;
  const deadline = Date.now() + MAX_WAIT_MS;
  let serializationAttempts = 0;
  while (Date.now() < deadline) {
    const client = await pool.connect();
    let doSerializationRetry = false;
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      const cfgR = await client.query(
        `SELECT provider, min_interval_ms, max_concurrent FROM nex.provider_rate_config WHERE provider = $1 FOR UPDATE`,
        [provider],
      );
      if (cfgR.rowCount === 0) { await client.query("ROLLBACK"); throw new Error(`Provider "${provider}" not configured`); }
      const cfg = cfgR.rows[0];
      const activeR = await client.query(
        `SELECT lease_id, acquired_at, expires_at FROM nex.provider_rate_lease WHERE provider = $1 AND released_at IS NULL`,
        [provider],
      );
      const now = Date.now();
      const effectivelyActive = activeR.rows.filter((r) => new Date(r.expires_at).getTime() > now);
      if (effectivelyActive.length >= cfg.max_concurrent) {
        const oldest = effectivelyActive.reduce((a, b) => (new Date(a.expires_at) < new Date(b.expires_at) ? a : b));
        const wait = Math.max(50, new Date(oldest.expires_at).getTime() - now);
        await client.query("COMMIT");
        await new Promise((r) => setTimeout(r, Math.min(wait, deadline - Date.now())));
        continue;
      }
      const lastR = await client.query(
        `SELECT MAX(released_at) AS latest FROM nex.provider_rate_lease WHERE provider = $1 AND released_at IS NOT NULL`,
        [provider],
      );
      const lastActivity = Math.max(
        lastR.rows[0]?.latest ? new Date(lastR.rows[0].latest).getTime() : 0,
        ...effectivelyActive.map((r) => new Date(r.acquired_at).getTime()),
        0,
      );
      if (lastActivity > 0 && (now - lastActivity) < cfg.min_interval_ms) {
        const wait = cfg.min_interval_ms - (now - lastActivity);
        await client.query("COMMIT");
        await new Promise((r) => setTimeout(r, Math.min(wait, deadline - Date.now())));
        continue;
      }
      const ins = await client.query(
        `INSERT INTO nex.provider_rate_lease (provider, walker_id) VALUES ($1, $2) RETURNING lease_id`,
        [provider, TRANSPORT_WORKER_ID],
      );
      await client.query("COMMIT");
      return ins.rows[0].lease_id;
    } catch (e) {
      try { await client.query("ROLLBACK"); } catch { /* ignore */ }
      if (SERIALIZATION_RETRYABLE_CODES.has(e?.code) && serializationAttempts < MAX_SERIALIZATION_RETRIES) {
        serializationAttempts += 1;
        doSerializationRetry = true;
      } else {
        throw e;
      }
    } finally {
      client.release();
    }
    if (doSerializationRetry) {
      const backoff = Math.min(50 * Math.pow(2, serializationAttempts), 2000);
      await new Promise((r) => setTimeout(r, backoff + Math.floor(Math.random() * backoff)));
    }
  }
  throw new Error(`Failed to acquire "${provider}" lease within ${MAX_WAIT_MS}ms`);
}

async function releaseProviderLease(leaseId) {
  try {
    await pool.query(`UPDATE nex.provider_rate_lease SET released_at = now() WHERE lease_id = $1 AND released_at IS NULL`, [leaseId]);
  } catch (e) {
    console.error(`  ! provider lease release failed:`, e.message ?? e);
  }
}

// Duplicate guard · mirrors market walker · orchestrator + fixed cron cannot
// double-fire same worker_config. Cycle skips gracefully if already running.
async function isAlreadyRunning(workerConfig) {
  try {
    const q = await pool.query(
      `SELECT id, started_at FROM nex.worker_cycle_run
        WHERE worker_id = 'acquisition:transport:Yogyakarta'
          AND worker_config = $1
          AND status = 'running'
          AND started_at > now() - interval '2 hours'
        LIMIT 1`,
      [workerConfig],
    );
    return q.rows[0] ?? null;
  } catch { return null; }
}

// ── Persistent cursor (which query index we've reached this run) ──────
function loadCursor() {
  try { return JSON.parse(fs.readFileSync(CURSOR_FILE, "utf8")); }
  catch { return { lastRunAt: null, runsToday: 0, todayKey: null }; }
}
function saveCursor(c) {
  try { fs.mkdirSync(path.dirname(CURSOR_FILE), { recursive: true }); } catch {}
  fs.writeFileSync(CURSOR_FILE, JSON.stringify(c, null, 2));
}

// ── Utilities ─────────────────────────────────────────────────────────
function normalisePhone(raw) {
  if (!raw) return null;
  let s = String(raw).trim();
  const wa = s.match(/wa\.me\/(\d+)/i); if (wa) s = wa[1];
  const digits = s.replace(/\D/g, "");
  if (digits.length === 0) return null;
  let nn;
  if (digits.startsWith("62")) nn = digits.slice(2);
  else if (digits.startsWith("0")) nn = digits.slice(1);
  else return null;
  if (nn.length < 9 || nn.length > 12) return null;
  return `+62${nn}`;
}
const buildWaLink = (e164) => (e164 && e164.startsWith("+62") ? `https://wa.me/${e164.slice(1)}` : null);
const newId = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
  const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
});

// ── cycle_run bookend ─────────────────────────────────────────────────
// Phase C (2026-08-24) · worker_config now includes city so orchestrator can
// dispatch per-city cycles · worker_id kept as 'acquisition:transport:Yogyakarta'
// (label · matches market walker convention where one worker_id spans cities).
async function openCycle(workerConfig) {
  const q = await pool.query(
    `INSERT INTO nex.worker_cycle_run (worker_id, worker_type, worker_config, started_at, status)
     VALUES ('acquisition:transport:Yogyakarta', 'acquisition', $1, now(), 'running') RETURNING id`,
    [workerConfig],
  );
  return q.rows[0].id;
}
async function closeCycle(id, status, summary) {
  // records_rejected sourced from the Phase 1 telemetry counter total when present
  // (MATCHED_EXISTING excluded per createRejectionCounter contract).
  const recordsRejected = summary.rejected_by_reason
    ? Object.entries(summary.rejected_by_reason)
        .filter(([k]) => k !== "MATCHED_EXISTING")
        .reduce((acc, [, v]) => acc + v, 0)
    : 0;
  await pool.query(
    `UPDATE nex.worker_cycle_run SET finished_at=now(),
        duration_ms=EXTRACT(MILLISECONDS FROM (now()-started_at))::int,
        status=$1, records_processed=$2, records_new=$3, records_rejected=$4, errors_count=$5, summary=$6::jsonb WHERE id=$7`,
    [status, summary.processed, summary.persisted, recordsRejected, summary.errors, JSON.stringify(summary), id],
  );
}

// ── Insert (idempotent · phone dedupe · name+jurisdiction fallback) ───
// P5 persistence contract 2026-08-26 · every INSERT stamps worker_id + cycle_run_id.
// ON CONFLICT UPDATE deliberately does NOT overwrite them · original attribution preserved.
async function insertRecord(rec, snap, { workerId, cycleRunId }) {
  await pool.query("BEGIN");
  try {
    let insertRes;
    if (rec.canonicalPhoneE164) {
      insertRes = await pool.query(
        `INSERT INTO nex.transport_acquisition_record (
           provider_id, provider_kind, business_name,
           canonical_phone_e164, public_whatsapp_link, public_email, website,
           home_jurisdiction, city, province, vehicle_types,
           supports_passenger, supports_logistics,
           discovery_stage, contactability, provenance,
           worker_id, cycle_run_id
         ) VALUES ($1, $2::nex.transport_provider_kind, $3, $4, $5, $6, $7,
                   $8, $9, $10, $11::nex.transport_vehicle_ontology[],
                   $12, $13,
                   'discovered', $14::nex.transport_contactability, $15::jsonb,
                   $16, $17)
         ON CONFLICT (canonical_phone_e164) DO UPDATE SET
           last_seen_at = now(),
           vehicle_types = (SELECT array_agg(DISTINCT v) FROM unnest(nex.transport_acquisition_record.vehicle_types || EXCLUDED.vehicle_types) as v)
         RETURNING provider_id, (xmax = 0) AS is_new`,
        [rec.providerId, rec.providerKind, rec.businessName,
         rec.canonicalPhoneE164, rec.publicWhatsappLink, rec.publicEmail, rec.website,
         rec.homeJurisdiction, rec.city, rec.province, rec.vehicleTypes,
         rec.supportsPassenger, rec.supportsLogistics,
         rec.contactability, JSON.stringify(rec.provenance),
         workerId, cycleRunId],
      );
    } else {
      // No phone · dedupe by (business_name, home_jurisdiction) via existence check
      const dup = await pool.query(
        `SELECT provider_id FROM nex.transport_acquisition_record WHERE business_name=$1 AND home_jurisdiction=$2 AND canonical_phone_e164 IS NULL LIMIT 1`,
        [rec.businessName, rec.homeJurisdiction],
      );
      if (dup.rowCount > 0) {
        await pool.query("COMMIT");
        return { isNew: false };
      }
      insertRes = await pool.query(
        `INSERT INTO nex.transport_acquisition_record (
           provider_id, provider_kind, business_name,
           canonical_phone_e164, public_whatsapp_link, public_email, website,
           home_jurisdiction, city, province, vehicle_types,
           supports_passenger, supports_logistics,
           discovery_stage, contactability, provenance,
           worker_id, cycle_run_id
         ) VALUES ($1, $2::nex.transport_provider_kind, $3, NULL, NULL, $4, $5,
                   $6, $7, $8, $9::nex.transport_vehicle_ontology[],
                   $10, $11,
                   'discovered', $12::nex.transport_contactability, $13::jsonb,
                   $14, $15)
         RETURNING provider_id, (xmax = 0) AS is_new`,
        [rec.providerId, rec.providerKind, rec.businessName,
         rec.publicEmail, rec.website,
         rec.homeJurisdiction, rec.city, rec.province, rec.vehicleTypes,
         rec.supportsPassenger, rec.supportsLogistics,
         rec.contactability, JSON.stringify(rec.provenance),
         workerId, cycleRunId],
      );
    }
    const providerId = insertRes.rows[0].provider_id;
    const isNew = insertRes.rows[0].is_new;
    await pool.query(
      `INSERT INTO nex.transport_acquisition_source_snapshot (
         snapshot_id, provider_id, source_url, source_kind, source_captured_at,
         source_licence_terms, raw_payload, public_evidence_note, ingested_by
       ) VALUES ($1, $2, $3, $4::nex.transport_source_kind, now(), $5, $6::jsonb, $7, $8)`,
      [newId(), providerId, snap.sourceUrl, snap.sourceKind, snap.sourceLicenceTerms,
       JSON.stringify(snap.rawPayload), snap.publicEvidenceNote, snap.ingestedBy],
    );
    await pool.query("COMMIT");
    // P5 persistence contract 2026-08-26 · verify the inserted row via three-way
    // match (pk + cycle_run_id + worker_id). Only for genuinely NEW rows;
    // ON CONFLICT UPDATE rows keep their original attribution.
    let verified = false;
    if (isNew) {
      verified = await verifyInsertedRow(pool, {
        table: "nex.transport_acquisition_record",
        primaryKeyColumn: "provider_id",
        returnedPk: providerId,
        cycleRunId, workerId,
      });
    }
    return { isNew, verified, providerId };
  } catch (e) {
    await pool.query("ROLLBACK");
    if (String(e.message).includes("duplicate key")) return { isNew: false };
    throw e;
  }
}

// ── Provider: Nominatim ───────────────────────────────────────────────
// P5 persistence contract 2026-08-26 · takes ctx {cycleRunId, workerId, counters}
// so INSERTs stamp attribution and per-provider insertVerified counts propagate.
async function providerNominatim(providerReport, cityName, rejectionCounter, ctx) {
  console.log(`── PROVIDER: NOMINATIM · ${cityName} ──────────────────────────`);
  const queries = generateQueries();
  console.log(`   ${queries.length} generated queries this cycle`);
  const perFamily = {};
  let totalReturned = 0, totalPersisted = 0, totalSkipped = 0, providerErrors = 0;
  const viewbox = viewboxForCity(cityName);

  for (const q of queries) {
    // POLITE_DELAY_MS removed 2026-08-24 · Provider Rate Governor authoritative
    // via nex.provider_rate_lease (nominatim min_interval_ms=1500). Walker
    // must not bypass · governor enforces globally across ALL walker children.
    const leaseId = await acquireProviderLease("nominatim");
    const url = new URL(NOMINATIM_URL);
    url.searchParams.set("q", q.query);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "20");
    url.searchParams.set("extratags", "1");
    url.searchParams.set("namedetails", "1");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("viewbox", viewbox);
    url.searchParams.set("bounded", "1");

    let results;
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 30000);
      const res = await fetch(url.toString(), { headers: { "User-Agent": USER_AGENT, "Accept": "application/json" }, signal: ac.signal });
      clearTimeout(timer);
      if (!res.ok) { providerErrors++; await releaseProviderLease(leaseId); continue; }
      results = await res.json();
    } catch { providerErrors++; await releaseProviderLease(leaseId); continue; }
    await releaseProviderLease(leaseId);

    perFamily[q.familyKey] = perFamily[q.familyKey] ?? { returned: 0, persisted: 0 };
    perFamily[q.familyKey].returned += results.length;
    totalReturned += results.length;

    for (const el of results) {
      const displayName = (el.namedetails?.name || el.name || (el.display_name ?? "").split(",")[0] || "").trim();
      if (displayName.length < 2) {
        totalSkipped++;
        rejectionCounter?.increment(REJECTION_REASONS.MALFORMED);
        continue;
      }
      const extratags = el.extratags || {};
      const rawPhone = extratags.phone || extratags["contact:phone"] || extratags.mobile || null;
      const email = extratags["contact:email"] || extratags.email || null;
      const website = extratags["contact:website"] || extratags.website || null;
      const canonicalPhone = normalisePhone(rawPhone);
      const addr = el.address || {};
      const osmType = el.osm_type || "node";
      const osmId = el.osm_id || el.place_id;
      const osmUrl = `https://www.openstreetmap.org/${osmType}/${osmId}`;

      // Platform-signal queries: vehicle_types stays 'unknown' · never fabricate affiliation
      const providerKind = q.isPlatformSignal ? "unknown" :
        (q.vehicleKindHint === "logistics_operator" || q.vehicleKindHint === "courier") ? "logistics_operator" :
        "transport_business";

      const record = {
        providerId: newId(), providerKind,
        businessName: displayName,
        canonicalPhoneE164: canonicalPhone,
        publicWhatsappLink: buildWaLink(canonicalPhone) || extratags["contact:whatsapp"] || null,
        publicEmail: email,
        website,
        homeJurisdiction: "ID/DIY/Yogyakarta",
        city: addr.city || addr.town || addr.county || null,
        province: addr.state || "DIY",
        vehicleTypes: [q.vehicleKindHint],
        supportsPassenger: q.supportsPassenger,
        supportsLogistics: q.supportsLogistics,
        contactability: canonicalPhone ? "contactable" : (rawPhone ? "invalid" : "unknown"),
        provenance: {
          composer: "transport-walker-cycle/query-universe/v0.3",
          query: q.query,
          family: q.familyKey,
          isPlatformSignal: q.isPlatformSignal,
          osm_ref: osmUrl,
          lat: el.lat, lon: el.lon,
        },
      };
      const snapshot = {
        sourceUrl: osmUrl,
        sourceKind: "public_maps_listing",
        sourceLicenceTerms: "ODbL-1.0",
        rawPayload: { query: q.query, family: q.familyKey, element: el },
        publicEvidenceNote: q.isPlatformSignal
          ? `Nominatim search for platform-signal keyword "${q.query}" returned ${osmType}/${osmId}. Platform name is search vocabulary only · no affiliation claim.`
          : `Nominatim search for "${q.query}" returned ${osmType}/${osmId}.`,
        ingestedBy: "transport-walker-cycle/query-universe/v0.3",
      };
      try {
        const r = await insertRecord(record, snapshot, { workerId: ctx.workerId, cycleRunId: ctx.cycleRunId });
        if (r.isNew) {
          totalPersisted++;
          perFamily[q.familyKey].persisted++;
          if (r.verified) ctx.counters.insertVerified++;
        }
        else { rejectionCounter?.increment(REJECTION_REASONS.MATCHED_EXISTING); }
      } catch { providerErrors++; }
    }
  }
  providerReport.push({
    provider: "nominatim",
    status: providerErrors < queries.length && totalReturned > 0 ? "SUCCESS" : (providerErrors === queries.length ? "FAILED" : "PARTIAL"),
    queries_run: queries.length,
    returned: totalReturned,
    persisted: totalPersisted,
    skipped: totalSkipped,
    errors: providerErrors,
    per_family: perFamily,
  });
  return { totalReturned, totalPersisted, totalSkipped, providerErrors };
}

// ── Provider: Overpass (fallback · fail-fast if unreachable) ─────────
// P5 persistence contract 2026-08-26 · takes ctx {cycleRunId, workerId, counters}.
async function providerOverpass(providerReport, rejectionCounter, ctx) {
  console.log("\n── PROVIDER: OVERPASS (fallback) ─────────────────────────────");
  const filters = [
    '["amenity"="taxi"]','["office"="taxi"]',
    '["amenity"="car_rental"]','["shop"="car_rental"]',
    '["amenity"="motorcycle_rental"]','["shop"="motorcycle_rental"]',
    '["office"="logistics"]','["office"="courier"]',
    '["amenity"="bus_station"]',
  ];
  const bbox = "-8.05,110.15,-7.55,110.55";
  const body = filters.map((f) => `nwr${f}(${bbox});`).join("\n  ");
  const query = `[out:json][timeout:60];\n(\n  ${body}\n);\nout center tags;`;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), OVERPASS_TIMEOUT_MS);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
        body: "data=" + encodeURIComponent(query), signal: ac.signal,
      });
      clearTimeout(timer);
      if (!res.ok) { console.log(`   ${endpoint} → HTTP ${res.status}`); continue; }
      const text = await res.text();
      const j = JSON.parse(text);
      const elements = j.elements || [];
      console.log(`   ${endpoint} → ${elements.length} feature(s)`);
      let persisted = 0;
      for (const el of elements) {
        const tags = el.tags || {};
        const name = tags.name || tags["name:id"] || tags["name:en"];
        if (!name) { rejectionCounter?.increment(REJECTION_REASONS.MALFORMED); continue; }
        const rawPhone = tags.phone || tags["contact:phone"];
        const canonicalPhone = normalisePhone(rawPhone);
        let vk = "unknown", pk = "transport_business", passenger = true, logistics = false;
        if (tags.amenity === "taxi" || tags.office === "taxi") { vk = "taxi"; }
        else if (tags.amenity === "car_rental" || tags.shop === "car_rental") { vk = "car"; }
        else if (tags.amenity === "motorcycle_rental" || tags.shop === "motorcycle_rental") { vk = "motorcycle"; passenger = false; }
        else if (tags.office === "logistics" || tags.office === "courier") { vk = "logistics_operator"; pk = "logistics_operator"; passenger = false; logistics = true; }
        else if (tags.amenity === "bus_station") { vk = "bus"; }
        const osmUrl = `https://www.openstreetmap.org/${el.type}/${el.id}`;
        try {
          const r = await insertRecord({
            providerId: newId(), providerKind: pk, businessName: name,
            canonicalPhoneE164: canonicalPhone,
            publicWhatsappLink: buildWaLink(canonicalPhone) || tags["contact:whatsapp"] || null,
            publicEmail: tags["contact:email"] || null, website: tags.website || null,
            homeJurisdiction: "ID/DIY/Yogyakarta",
            city: tags["addr:city"] || null, province: tags["addr:province"] || "DIY",
            vehicleTypes: [vk], supportsPassenger: passenger, supportsLogistics: logistics,
            contactability: canonicalPhone ? "contactable" : (rawPhone ? "invalid" : "unknown"),
            provenance: { composer: "transport-walker-cycle/overpass/v0.3", osm_ref: osmUrl },
          }, {
            sourceUrl: osmUrl, sourceKind: "public_business_directory", sourceLicenceTerms: "ODbL-1.0",
            rawPayload: { tags, osm_type: el.type, osm_id: el.id },
            publicEvidenceNote: `Overpass consolidated query returned ${el.type}/${el.id}.`,
            ingestedBy: "transport-walker-cycle/overpass/v0.3",
          }, { workerId: ctx.workerId, cycleRunId: ctx.cycleRunId });
          if (r.isNew) {
            persisted++;
            if (r.verified) ctx.counters.insertVerified++;
          }
          else rejectionCounter?.increment(REJECTION_REASONS.MATCHED_EXISTING);
        } catch {}
      }
      providerReport.push({ provider: "overpass", endpoint, status: "SUCCESS", returned: elements.length, persisted });
      return { totalReturned: elements.length, totalPersisted: persisted };
    } catch (e) {
      clearTimeout(timer);
      console.log(`   ${endpoint} → ${e.message}`);
    }
  }
  providerReport.push({ provider: "overpass", status: "FAILED", returned: 0, persisted: 0, note: "all mirrors unavailable" });
  return { totalReturned: 0, totalPersisted: 0 };
}

// ── Provider: Facebook Public (gated · honest NOT_CONFIGURED) ────────
//
// Doctrine: NEX must NEVER scrape Facebook. This provider makes ZERO network
// requests without full Meta app-review + env-var configuration. Missing any
// requirement → reports NOT_CONFIGURED honestly in the cycle summary. HQ
// page displays that status · never fabricates a "0 discovered" result.
async function providerFacebookPublic(providerReport) {
  console.log("\n── PROVIDER: FACEBOOK PUBLIC (gated) ────────────────────────");
  const missing = [];
  if (process.env.NEX_FACEBOOK_PROVIDER_ENABLED !== "true") missing.push("NEX_FACEBOOK_PROVIDER_ENABLED=true");
  if (!process.env.NEX_FACEBOOK_APP_ID)                     missing.push("NEX_FACEBOOK_APP_ID");
  if (!process.env.NEX_FACEBOOK_APP_SECRET)                 missing.push("NEX_FACEBOOK_APP_SECRET");
  if (!process.env.NEX_FACEBOOK_ACCESS_TOKEN)               missing.push("NEX_FACEBOOK_ACCESS_TOKEN");
  if (missing.length > 0) {
    console.log(`   NOT_CONFIGURED · missing: ${missing.join(", ")}`);
    providerReport.push({
      provider: "facebook_public", status: "NOT_CONFIGURED", returned: 0, persisted: 0,
      note: `missing: ${missing.join(", ")} · zero requests made · honest silence`,
    });
    return { totalReturned: 0, totalPersisted: 0 };
  }
  console.log("   REFUSED · META_APP_REVIEW_REQUIRED (env set · app-review not confirmed)");
  providerReport.push({
    provider: "facebook_public", status: "REFUSED", returned: 0, persisted: 0,
    note: "META_APP_REVIEW_REQUIRED · env-configured but Meta app-review approval not on record · zero requests made",
  });
  return { totalReturned: 0, totalPersisted: 0 };
}

// ── Main ─────────────────────────────────────────────────────────────
// Phase C (2026-08-24) · accepts --city=NAME · defaults to Yogyakarta.
// Duplicate guard · try/finally guarantees closeCycle even on error.
async function main() {
  const started = Date.now();
  const args = parseArgs(process.argv);
  const cityCanonical = cityFromArg(args.city) ?? "Yogyakarta";
  const workerConfig = `transport:${cityCanonical}:query-universe-v1`;

  console.log("╔══════════════════════════════════════════════════════════════════════════╗");
  console.log("║  TRANSPORT WALKER · query universe cycle · " + cityCanonical.padEnd(29) + "  ║");
  console.log("║  Nominatim · Overpass fallback · Facebook (gated) · 0 outreach            ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════╝");

  // Duplicate guard before opening a cycle_run row.
  const dupe = await isAlreadyRunning(workerConfig);
  if (dupe) {
    console.log(`⏸  SKIP_DUPLICATE · ${workerConfig} already running (started ${new Date(dupe.started_at).toISOString()})`);
    await pool.end();
    return;
  }

  const cursor = loadCursor();
  const today = new Date().toISOString().slice(0, 10);
  if (cursor.todayKey !== today) { cursor.todayKey = today; cursor.runsToday = 0; }
  cursor.runsToday += 1;
  console.log(`\nCycle #${cursor.runsToday} today · previous last run: ${cursor.lastRunAt ?? "never"}`);

  const cycleId = await openCycle(workerConfig);
  const providerReport = [];
  let totalReturned = 0, totalPersisted = 0;
  let unexpectedError = null;
  // Phase 1 rejection telemetry (2026-08-25) · per-reason histogram.
  const rejectionCounter = createRejectionCounter();
  // P5 persistence contract 2026-08-26 · thread-through context for providers.
  const persistCtx = { workerId: WORKER_ID, cycleRunId: cycleId, counters: { insertVerified: 0 } };

  try {
    const nom = await providerNominatim(providerReport, cityCanonical, rejectionCounter, persistCtx);
    const ovp = await providerOverpass(providerReport, rejectionCounter, persistCtx);
    const fb  = await providerFacebookPublic(providerReport);
    totalReturned  = nom.totalReturned  + ovp.totalReturned  + fb.totalReturned;
    totalPersisted = nom.totalPersisted + ovp.totalPersisted + fb.totalPersisted;
  } catch (e) {
    unexpectedError = e;
    console.error("   ✗ unexpected error mid-cycle:", e.message ?? e);
  }

  console.log("\n── SUMMARY ────────────────────────────────────────────────────");
  console.log(`  city            : ${cityCanonical}`);
  console.log(`  total returned  : ${totalReturned}`);
  console.log(`  total persisted : ${totalPersisted}`);
  console.log(`  runtime         : ${((Date.now() - started) / 1000).toFixed(1)}s`);
  for (const p of providerReport) {
    console.log(`  ${p.provider.padEnd(12)} status=${p.status.padEnd(8)} returned=${p.returned} persisted=${p.persisted}`);
  }

  const ladderSnapshot = [
    { id: "nominatim",                        pos: 1, status: "READY",              bestFor: ["transport_business","operator"] },
    { id: "overpass",                         pos: 2, status: "READY",              bestFor: ["transport_business","operator"] },
    { id: "facebook_public",                  pos: 3, status: process.env.NEX_FACEBOOK_PROVIDER_ENABLED === "true" && process.env.NEX_FACEBOOK_APP_ID && process.env.NEX_FACEBOOK_APP_SECRET && process.env.NEX_FACEBOOK_ACCESS_TOKEN ? "GATED_APPROVAL" : "GATED_ENV", bestFor: ["individual_driver","transport_business"] },
    { id: "google_places",                    pos: 4, status: process.env.NEX_GOOGLE_PLACES_ENABLED === "true" && process.env.NEX_GOOGLE_PLACES_API_KEY ? "GATED_APPROVAL" : "NOT_YET_INTEGRATED", bestFor: ["transport_business","operator"] },
    { id: "public_directory_indonesia",       pos: 5, status: "NOT_YET_INTEGRATED", bestFor: ["transport_business","operator","individual_driver"] },
    { id: "public_recruitment_advertisement", pos: 6, status: "NOT_YET_INTEGRATED", bestFor: ["individual_driver"] },
  ];
  console.log("\n── PROVIDER LADDER ────────────────────────────────────────────");
  for (const l of ladderSnapshot) console.log(`  #${l.pos} ${l.id.padEnd(34)} ${l.status.padEnd(20)} bestFor=${l.bestFor.join(",")}`);

  // P5 persistence contract 2026-08-26 · invariant check before closeCycle.
  let invariant = null;
  try {
    invariant = await checkPersistenceInvariant(pool, {
      table: "nex.transport_acquisition_record",
      cycleRunId: cycleId,
      insertVerified: persistCtx.counters.insertVerified,
    });
  } catch (invErr) {
    console.error("   ✗ invariant check failed:", invErr.message ?? invErr);
  }
  const recordsNewFromDb = invariant?.db_count ?? totalPersisted;
  const invariantFailed = invariant ? !invariant.held : false;

  const anySuccess = providerReport.some((p) => p.status === "SUCCESS" || p.status === "PARTIAL");
  const status = (unexpectedError || invariantFailed)
    ? "failed"
    : (anySuccess ? "completed" : (totalReturned > 0 ? "completed" : "failed"));
  try {
    const providerErroredCount = providerReport.filter((p) => p.status !== "SUCCESS" && p.status !== "PARTIAL" && p.status !== "NOT_CONFIGURED").length;
    const cycleOutcome = computeCycleOutcome({
      recordsProcessed: totalReturned,
      recordsNew:       recordsNewFromDb,
      recordsRejected:  rejectionCounter.total(),
      matchedExisting:  rejectionCounter.get(REJECTION_REASONS.MATCHED_EXISTING),
      providerReturned: totalReturned,
      providerErrored:  providerErroredCount,
    });
    await closeCycle(cycleId, status, {
      city: cityCanonical,
      processed: totalReturned, persisted: recordsNewFromDb,
      errors: providerReport.filter((p) => p.status !== "SUCCESS" && p.status !== "PARTIAL").length,
      provider_results: providerReport,
      provider_ladder: ladderSnapshot,
      runtime_ms: Date.now() - started,
      cycle_of_day: cursor.runsToday,
      unexpected_error: unexpectedError ? String(unexpectedError.message ?? unexpectedError) : null,
      // Phase 1 rejection telemetry (2026-08-25). Policy unchanged.
      rejected_by_reason: rejectionCounter.toObject(),
      cycle_outcome:      cycleOutcome,
      // Persistence contract evidence (2026-08-26 P5).
      persistence_invariant: invariant,
      persistence_counts: {
        insert_attempted:    totalPersisted,
        insert_returned:     totalPersisted,
        insert_verified:     persistCtx.counters.insertVerified,
        insert_conflicts:    rejectionCounter.get(REJECTION_REASONS.MATCHED_EXISTING),
        verification_failed: totalPersisted - persistCtx.counters.insertVerified,
        records_new_from_db: recordsNewFromDb,
      },
    });
  } catch (closeErr) {
    console.error("   ✗ closeCycle failed:", closeErr.message ?? closeErr);
  }

  cursor.lastRunAt = new Date().toISOString();
  saveCursor(cursor);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
