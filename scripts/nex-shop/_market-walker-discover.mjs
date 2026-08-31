#!/usr/bin/env node
// scripts/nex-shop/_market-walker-discover.mjs
//
// NEX MARKET WALKER · Yogyakarta discovery · multi-provider.
//
// Discovers publicly-advertised businesses that could later become NEX Market
// sellers. Persists to nex.mp_seller at status='discovered'.
//
// Doctrine:
//   · Public-source only (Nominatim primary · Overpass fallback)
//   · DISCOVERED ≠ CANDIDATE ≠ REGISTERED ≠ VERIFIED ≠ ACTIVE
//   · Zero automatic outreach
//   · Zone-based cursor · progressively eats through Indonesia's business universe
//
// Zones (JSON cursor at data/nex-shop-walker-zone-cursor.json):
//   yogyakarta-city · sleman · bantul · kulon-progo · gunungkidul
//   central-java-magelang · central-java-solo · central-java-klaten
//   (future) jakarta · bali · surabaya · medan · makassar · ...

import fs from "node:fs";
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
const CURSOR_FILE = "C:\\Users\\Victus\\trades\\data\\nex-shop-walker-zone-cursor.json";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "NEX-Market-Walker/0.1 (public-source-only)";
const POLITE_DELAY_MS = 1500;

// 2026-08-24 · Phase 1 refactor · ZONES derived from the shared
// data/nex-city-catalogue.json. Zone id preserves the legacy format
// ("yogyakarta-city", "central-java-{slug}" for Central Java cities, plain
// slug for DIY regencies) so existing rotation state history + worker_config
// LIKE patterns keep matching. Adding a city to the JSON automatically
// enrolls it into the market walker's zone cursor rotation.
import { allCities, jurisdictionForCity } from "../nex-city-catalogue/loader.mjs";

function computeZoneId(city) {
  if (city.canonical === "Yogyakarta") return "yogyakarta-city";
  if (city.region === "Central Java")   return `central-java-${city.slug}`;
  return city.slug;
}

const ZONES = allCities().map((c) => ({
  id:            computeZoneId(c),   // legacy zone identifier · used by cursor + jurisdiction display
  citySlug:      c.slug,             // 2026-08-24 · Phase 2 · canonical city slug for worker_config
  label:         c.canonical,
  // Market walker bbox format: [west,south,east,north].
  bbox:          [c.bboxSw[1], c.bboxSw[0], c.bboxNe[1], c.bboxNe[0]],
  jurisdiction:  jurisdictionForCity(c.canonical),
}));

// Commerce category → { keyword variants · category slug · vehicle_kind free }
const CATEGORY_SEARCHES = [
  { cat: "electronics",     keywords: ["toko elektronik", "electronics store"] },
  { cat: "phones",          keywords: ["toko handphone", "mobile phone shop"] },
  { cat: "computers",       keywords: ["toko komputer", "computer shop"] },
  { cat: "fashion",         keywords: ["toko baju", "clothing shop"] },
  { cat: "furniture",       keywords: ["toko furniture", "toko mebel"] },
  { cat: "home",            keywords: ["toko peralatan rumah tangga"] },
  { cat: "appliances",      keywords: ["toko elektronik rumah tangga", "appliance store"] },
  { cat: "building_hardware", keywords: ["toko bangunan", "hardware store"] },
  { cat: "tools",           keywords: ["toko perkakas"] },
  { cat: "motorbike",       keywords: ["toko motor", "bengkel motor"] },
  { cat: "parts_accessories", keywords: ["toko onderdil motor", "toko sparepart"] },
  { cat: "food_beverage",   keywords: ["toko roti", "toko oleh oleh"] },   // product-selling F&B only
  { cat: "beauty",          keywords: ["toko kosmetik"] },
  { cat: "sports",          keywords: ["toko olahraga"] },
];

// Curated Indonesian storefront keywords · Philip 2026-08-24 · cross of
// Indonesian shop/business prefixes with common storefront/service nouns.
// These broaden the Nominatim query universe beyond the 14 CATEGORY_SEARCHES
// so the Market Walker actually surfaces the small-owner pattern
// (toko/jual/supplier/distributor/grosir/jasa) that dominates Indonesian
// commercial signage. Kept small (<40) so one zone's cycle stays polite.
const CURATED_STOREFRONT_KEYWORDS = [
  // toko (shop) · generic + common categories
  "toko",
  "toko sembako",
  "toko kelontong",
  "toko bangunan",
  "toko baju",
  "toko elektronik",
  "toko motor",
  "toko oleh oleh",
  "toko obat",
  "toko buku",
  // jual (selling / for sale)
  "jual beli",
  "jual motor bekas",
  "jual hp",
  "jual sepeda",
  // supplier
  "supplier",
  "supplier bahan bangunan",
  "supplier alat tulis",
  // distributor
  "distributor",
  "distributor makanan",
  "distributor kosmetik",
  // grosir (wholesale)
  "grosir",
  "grosir baju",
  "grosir sembako",
  "grosir kosmetik",
  // jasa (service)
  "jasa laundry",
  "jasa fotocopy",
  "jasa jahit",
  "jasa servis",
  "jasa cetak",
  // warung (small shop / stall) · very common in Indonesia
  "warung",
  "warung makan",
  "warung sembako",
];

// Load a rotating sample of L3 micro-niche labels from the 3-level taxonomy
// (nex.mp_category level=3). Uses random ordering so successive cycles cover
// different slices of the 242-label universe · 20 per cycle keeps polite.
async function loadTaxonomyKeywords() {
  try {
    const q = await pool.query(
      `SELECT label FROM nex.mp_category WHERE level = 3 ORDER BY random() LIMIT 20`,
    );
    return q.rows.map((r) => String(r.label));
  } catch (e) {
    console.log(`   loadTaxonomyKeywords() failed · continuing with curated only · ${e.message}`);
    return [];
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Cursor state ──────────────────────────────────────────────────────
function loadCursor() {
  try { return JSON.parse(fs.readFileSync(CURSOR_FILE, "utf8")); }
  catch { return { processedZones: [], lastRunAt: null }; }
}
function saveCursor(c) {
  const dir = CURSOR_FILE.substring(0, CURSOR_FILE.lastIndexOf("\\"));
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  fs.writeFileSync(CURSOR_FILE, JSON.stringify(c, null, 2));
}

// ── cycle_run bookend ─────────────────────────────────────────────────
async function openCycle(zoneId) {
  const q = await pool.query(
    `INSERT INTO nex.worker_cycle_run (worker_id, worker_type, worker_config, started_at, status)
     VALUES ('acquisition:market:Yogyakarta', 'acquisition', $1, now(), 'running') RETURNING id`,
    [`market:${zoneId}:nominatim`],
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

// ── Category lookup ───────────────────────────────────────────────────
async function categoryIdByKey(key) {
  const q = await pool.query(`SELECT category_id FROM nex.mp_category WHERE key=$1`, [key]);
  return q.rows[0]?.category_id ?? null;
}

// ── Seller insert · Phase 1a unified through resolver (Philip 2026-08-27) ─
// Root cause of 2,324 mp_seller dupes: this walker used slug = slugify(name)
// + jurisdiction-tail, while _marketplace-persister used slug = name +
// crockford5(hash(source_reference)). Same real-world shop discovered via
// both walkers → two different slugs → two rows.
//
// Fix: BOTH writers now call buildMpSellerSlug({name, city, source, sourceRef})
// via the shared identity-resolver module. When Nominatim gives us an
// osm_type/osm_id pair we pass it as source_reference so future Overpass
// discovery of the same OSM element resolves to the same row.

import {
  resolveIdentity, mergeEnrichment, buildMpSellerSlug,
} from "../nex-worker/identity-resolver.mjs";

async function upsertDiscoveredSeller(businessName, city, jurisdiction, bio, discoveredFrom, sourceMeta, { workerId, cycleRunId }) {
  const source = sourceMeta?.source ?? "nominatim";
  const sourceReference = sourceMeta?.sourceReference ?? null;
  const slug = buildMpSellerSlug({ displayName: businessName, city, source, sourceReference });
  const incomingForLog = {
    source, sourceReference,
    name: businessName, city,
    website: null, phone: null, whatsapp: null,
    lat: sourceMeta?.lat ?? null, lng: sourceMeta?.lng ?? null,
    extras: { bio, jurisdiction, discoveredFrom },
  };

  // Resolver first: strong match → merge (never create second row).
  const resolved = await resolveIdentity(pool, {
    table: "nex.mp_seller", candidate: incomingForLog,
  });
  if (resolved.match === "strong") {
    await mergeEnrichment(pool, {
      table: "nex.mp_seller", existing: resolved.existing,
      incoming: incomingForLog, layer: resolved.layer,
      enrichableFields: ["city", "jurisdiction", "bio"],
      incomingValues: { city, jurisdiction, bio },
      workerId, cycleRunId,
    });
    return { seller_id: resolved.existing.seller_id, is_new: false };
  }
  if (resolved.match === "candidate") {
    await mergeEnrichment(pool, {
      table: "nex.mp_seller", existing: resolved.existing,
      incoming: incomingForLog, layer: "name_city",
      enrichableFields: [], incomingValues: {},
      workerId, cycleRunId,
    }).catch(() => {});
    // Fall through to INSERT.
  }

  // Persistence contract 2026-08-26 P5 · every INSERT stamps worker_id + cycle_run_id.
  // ON CONFLICT UPDATE deliberately does NOT overwrite them · original attribution preserved.
  const q = await pool.query(
    `INSERT INTO nex.mp_seller
       (slug, display_name, city, jurisdiction, status, bio, discovered_from,
        source, source_reference, worker_id, cycle_run_id)
     VALUES ($1, $2, $3, $4, 'discovered', $5, $6, $7, $8, $9, $10)
     ON CONFLICT (slug) DO UPDATE SET
       updated_at = now(),
       city = COALESCE(nex.mp_seller.city, EXCLUDED.city),
       bio = COALESCE(nex.mp_seller.bio, EXCLUDED.bio),
       source = COALESCE(nex.mp_seller.source, EXCLUDED.source),
       source_reference = COALESCE(nex.mp_seller.source_reference, EXCLUDED.source_reference)
     RETURNING seller_id, (xmax = 0) AS is_new`,
    [slug, businessName, city, jurisdiction, bio, discoveredFrom, source, sourceReference, workerId, cycleRunId],
  );
  return q.rows[0];
}

// ── Nominatim provider ────────────────────────────────────────────────
// Wrapped by the Provider Rate Governor (2026-08-24 Phase A). Governor
// enforces per-provider rate globally regardless of how many walker child
// processes are running in parallel · never bypass.
const WORKER_ID = "acquisition:market:Yogyakarta";

// 2026-08-24 · P0 concurrency fix. Same 40001 issue as transport walker · under
// MAX_SLOTS=10 the SERIALIZABLE lease-acquire tx aborts under contention.
// Retry with exponential + jitter backoff.
const MARKET_SERIALIZATION_RETRYABLE = new Set(["40001", "40P01"]);
// 2026-08-24 · bumped 8 → 20 after transport:Bantul single-event forensic
// (see _provider-lease-helper.mjs for reasoning).
const MARKET_MAX_SERIALIZATION_RETRIES = 20;

async function acquireGovernorLease(provider) {
  // Inline mirror of src/lib/nex-hq/provider-rate-governor.ts decideAcquire
  // so this .mjs script doesn't need a TS import. Retries with backoff up to
  // 300s (bumped from 30s on 2026-08-24 · Stage-10 stability doctrine).
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
        [provider, WORKER_ID],
      );
      await client.query("COMMIT");
      return ins.rows[0].lease_id;
    } catch (e) {
      try { await client.query("ROLLBACK"); } catch { /* ignore */ }
      if (MARKET_SERIALIZATION_RETRYABLE.has(e?.code) && serializationAttempts < MARKET_MAX_SERIALIZATION_RETRIES) {
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

async function releaseGovernorLease(leaseId) {
  try {
    await pool.query(`UPDATE nex.provider_rate_lease SET released_at = now() WHERE lease_id = $1 AND released_at IS NULL`, [leaseId]);
  } catch (e) {
    console.error(`   ! lease release failed:`, e.message ?? e);
  }
}

async function nominatimSearch(query, bbox) {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "20");
  url.searchParams.set("extratags", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("viewbox", `${bbox[0]},${bbox[3]},${bbox[2]},${bbox[1]}`);
  url.searchParams.set("bounded", "1");

  // Governor-gated call · waits behind other walkers if rate limit dictates.
  const leaseId = await acquireGovernorLease("nominatim");
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 30000);
  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT, "Accept": "application/json" },
      signal: ac.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    clearTimeout(timer);
    throw e;
  } finally {
    await releaseGovernorLease(leaseId);
  }
}

// ── One zone cycle ────────────────────────────────────────────────────
// Wrapped in try/finally so closeCycle ALWAYS fires · never leaves a zombie
// 'running' row. Per Philip 2026-08-24: "Failure must not stop the workforce."
// A failed cycle records status=failed with error count · rotation controller
// then knows this cycle was not productive · orchestrator can move on.
async function runZoneCycle(zone) {
  console.log(`\n── ZONE: ${zone.label} · ${zone.jurisdiction} ────────────────`);
  // 2026-08-24 · Phase 2 · worker_config uses canonical city SLUG so the
  // orchestrator + rotation-tick see market cycles under the same prefix they
  // compute (market:{slug}:nominatim). Legacy zone.id (yogyakarta-city, central-
  // java-*) remains the walker's INTERNAL cursor/jurisdiction key.
  const cycleId = await openCycle(zone.citySlug);
  const perSourceCounts = { curated: { returned: 0, persisted: 0 }, taxonomy_l2: { returned: 0, persisted: 0 } };
  let totalReturned = 0, totalPersisted = 0, totalErrors = 0;
  let totalInsertVerified = 0;   // P5 persistence contract counter
  let unexpectedError = null;
  // Phase 1 rejection telemetry (2026-08-25) · per-reason histogram.
  const rejectionCounter = createRejectionCounter();

  try {
    const taxonomyKeywords = await loadTaxonomyKeywords();
    const allKeywords = [
      ...CURATED_STOREFRONT_KEYWORDS.map((kw) => ({ kw, source: "curated" })),
      ...taxonomyKeywords.map((kw) => ({ kw, source: "taxonomy_l2" })),
    ];
    console.log(`   ${allKeywords.length} keywords this cycle (${CURATED_STOREFRONT_KEYWORDS.length} curated + ${taxonomyKeywords.length} taxonomy L2)`);

    for (const { kw, source } of allKeywords) {
        // POLITE_DELAY_MS removed 2026-08-24 · Provider Rate Governor is now
        // authoritative · acquires lease inside nominatimSearch · waits for
        // provider min_interval globally regardless of walker count.
        let results;
        try {
          results = await nominatimSearch(kw, zone.bbox);
        } catch (e) {
          console.log(`   "${kw}" → ${e.message}`);
          totalErrors++;
          continue;
        }
        totalReturned += results.length;
        perSourceCounts[source].returned += results.length;

        for (const el of results) {
          const name = (el.name || (el.display_name || "").split(",")[0] || "").trim();
          if (name.length < 2) {
            rejectionCounter.increment(REJECTION_REASONS.MALFORMED);
            continue;
          }
          const addr = el.address || {};
          const city = addr.city || addr.town || addr.county || zone.label;
          const bio = `Discovered via Nominatim search for "${kw}" in ${zone.label} on ${new Date().toISOString().slice(0, 10)}. Public source only · not yet contacted.`;
          // Phase 1a · pass OSM identity + coords so resolver's Layer 1
          // (source, source_reference) match closes the two-writer duplicate
          // hole that produced 2,324 mp_seller dupes.
          const sourceMeta = {
            source: "nominatim",
            sourceReference: (el.osm_type && el.osm_id) ? `${el.osm_type}/${el.osm_id}` : (el.place_id ? `place/${el.place_id}` : null),
            lat: el.lat != null ? Number(el.lat) : null,
            lng: el.lon != null ? Number(el.lon) : null,
          };
          try {
            const r = await upsertDiscoveredSeller(name, city, zone.jurisdiction, bio, `walker:market:${zone.id}`, sourceMeta, {
              workerId: WORKER_ID, cycleRunId: cycleId,
            });
            if (r.is_new) {
              totalPersisted++;
              perSourceCounts[source].persisted++;
              // P5 persistence contract · SELECT-verify three-way match.
              const verified = await verifyInsertedRow(pool, {
                table: "nex.mp_seller", primaryKeyColumn: "seller_id",
                returnedPk: r.seller_id, cycleRunId: cycleId, workerId: WORKER_ID,
              });
              if (verified) totalInsertVerified++;
              // If verify fails, the invariant check will catch it as delta > 0.
            } else {
              rejectionCounter.increment(REJECTION_REASONS.MATCHED_EXISTING);
            }
          } catch (e) {
            totalErrors++;
          }
        }
    }
  } catch (e) {
    unexpectedError = e;
    console.error(`   ✗ unexpected error mid-cycle:`, e.message ?? e);
  } finally {
    // Status resolution rule (feeds back to rotation controller · never faked):
    //   · unexpected error → 'failed' (records_new stays 0 · not counted productive)
    //   · totalPersisted > 0 → 'completed' regardless of some keyword errors
    //   · zero persisted + errors > 0 → 'failed'
    //   · zero persisted + zero errors → 'completed' (honest saturation signal)
    // P5 persistence contract 2026-08-26 · check invariant BEFORE deciding
    // final status. Any mismatch = FAILED (no errors_count escape hatch).
    let invariant = null;
    try {
      invariant = await checkPersistenceInvariant(pool, {
        table: "nex.mp_seller", cycleRunId: cycleId, insertVerified: totalInsertVerified,
      });
    } catch (invErr) {
      console.error(`   ✗ invariant check failed:`, invErr.message ?? invErr);
    }
    // records_new is DB truth when invariant available · else fall back to counter.
    const recordsNewFromDb = invariant?.db_count ?? totalPersisted;
    const invariantFailed = invariant ? !invariant.held : false;
    const status = (unexpectedError || invariantFailed)
      ? "failed"
      : (recordsNewFromDb > 0 ? "completed" : (totalErrors > 0 ? "failed" : "completed"));
    try {
      const cycleOutcome = computeCycleOutcome({
        recordsProcessed: totalReturned,
        recordsNew:       recordsNewFromDb,
        recordsRejected:  rejectionCounter.total(),
        matchedExisting:  rejectionCounter.get(REJECTION_REASONS.MATCHED_EXISTING),
        providerReturned: totalReturned,
        providerErrored:  totalErrors,
      });
      await closeCycle(cycleId, status, {
        zone: zone.id, zone_label: zone.label, jurisdiction: zone.jurisdiction,
        processed: totalReturned, persisted: recordsNewFromDb, errors: totalErrors,
        per_source: perSourceCounts,
        unexpected_error: unexpectedError ? String(unexpectedError.message ?? unexpectedError) : null,
        provider_results: [{
          provider: "nominatim",
          status: (totalErrors === 0 && !unexpectedError) || totalReturned > 0 ? "SUCCESS" : "FAILED",
          returned: totalReturned, persisted: recordsNewFromDb,
        }],
        // Phase 1 rejection telemetry (2026-08-25). Policy unchanged.
        rejected_by_reason: rejectionCounter.toObject(),
        cycle_outcome:      cycleOutcome,
        // Persistence contract evidence (2026-08-26 P5).
        persistence_invariant: invariant,
        persistence_counts: {
          insert_attempted:    totalPersisted,       // pre-verify count of successful ON CONFLICT INSERTs
          insert_returned:     totalPersisted,       // same in market walker (returns are RETURNING result)
          insert_verified:     totalInsertVerified,
          insert_conflicts:    rejectionCounter.get(REJECTION_REASONS.MATCHED_EXISTING),
          verification_failed: totalPersisted - totalInsertVerified,
          records_new_from_db: recordsNewFromDb,
        },
      });
    } catch (closeErr) {
      console.error(`   ✗ closeCycle failed:`, closeErr.message ?? closeErr);
    }
    console.log(`   → returned ${totalReturned} · persisted ${totalPersisted} · errors ${totalErrors} · status=${status}`);
  }
  return { totalReturned, totalPersisted, totalErrors, status: unexpectedError ? "failed" : (totalPersisted > 0 ? "completed" : (totalErrors > 0 ? "failed" : "completed")) };
}

// Parse CLI args · supports --city=NAME to run a specific city.
// When --city is provided the orchestrator is authoritative · we skip the
// zone cursor. When absent, backward-compatible: pick next-unwalked-today via cursor.
function parseArgs(argv) {
  const out = { city: null };
  for (const a of argv.slice(2)) {
    const m = a.match(/^--city=(.+)$/);
    if (m) out.city = m[1].trim();
  }
  return out;
}

// Match a --city value to a ZONE row · case-insensitive · hyphen-tolerant ·
// substring-tolerant so orchestrator names like "Solo" match zone labels
// "Solo (Surakarta)" and "Yogyakarta" matches "Kota Yogyakarta". Exact matches
// still preferred · substring fallback avoids the orchestrator having to know
// zone-file quirks.
function zoneForCity(cityArg) {
  if (!cityArg) return null;
  const norm = cityArg.toLowerCase().replace(/-/g, " ").trim();
  const argLower = cityArg.toLowerCase();
  // Exact match first (label OR id)
  const exact = ZONES.find((z) => z.label.toLowerCase() === norm || z.id.toLowerCase() === argLower);
  if (exact) return exact;
  // Substring match on label (e.g. "solo" → "Solo (Surakarta)")
  const labelContains = ZONES.find((z) => z.label.toLowerCase().includes(norm));
  if (labelContains) return labelContains;
  // Substring match on id (e.g. "solo" → "central-java-solo")
  const idContains = ZONES.find((z) => z.id.toLowerCase().includes(argLower));
  if (idContains) return idContains;
  return null;
}

// Guard: refuse to start if another cycle for this exact worker_config is
// already 'running' in worker_cycle_run. Protects against orchestrator +
// fixed-cron double-fire and against re-runs during zombie recovery.
async function isAlreadyRunning(zoneId) {
  const q = await pool.query(
    `SELECT id, started_at FROM nex.worker_cycle_run
      WHERE worker_id = 'acquisition:market:Yogyakarta'
        AND worker_config = $1
        AND status = 'running'
        AND started_at > now() - interval '2 hours'
      LIMIT 1`,
    [`market:${zoneId}:nominatim`],
  );
  return q.rows[0] ?? null;
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  const started = Date.now();
  const args = parseArgs(process.argv);
  console.log("╔══════════════════════════════════════════════════════════════════════════╗");
  console.log("║  NEX MARKET WALKER · Yogyakarta + Central Java discovery                  ║");
  console.log(`║  Nominatim primary · ${(args.city ? "orchestrator-assigned city" : "zone cursor").padEnd(28)} · 0 outreach                ║`);
  console.log("╚══════════════════════════════════════════════════════════════════════════╝");

  // Orchestrator-assigned path: --city=NAME · authoritative · skip cursor.
  if (args.city) {
    const zone = zoneForCity(args.city);
    if (!zone) {
      console.log(`\n✗ --city="${args.city}" does not match any known ZONE · aborting`);
      console.log(`  Known zones: ${ZONES.map((z) => z.id).join(", ")}`);
      await pool.end();
      process.exit(2);
    }
    const dupe = await isAlreadyRunning(zone.citySlug);
    if (dupe) {
      console.log(`\n⏸  SKIP_DUPLICATE · cycle already running for market/${zone.id} (started ${new Date(dupe.started_at).toISOString()})`);
      await pool.end();
      return;
    }
    console.log(`\nOrchestrator assigned: ${zone.label} (${zone.id})\n`);
    const result = await runZoneCycle(zone);

    // Cursor gets updated so the fixed-cron path also knows this zone was
    // walked today · prevents duplicate work when both entry points active.
    const cursor = loadCursor();
    const today = new Date().toISOString().slice(0, 10);
    cursor.processedZones = (cursor.processedZones ?? []).slice(-100);
    cursor.processedZones.push({ zone: zone.id, date: today, at: new Date().toISOString(), ...result, source: "orchestrator" });
    cursor.lastRunAt = new Date().toISOString();
    saveCursor(cursor);

    console.log(`\nRuntime: ${((Date.now() - started) / 1000).toFixed(1)}s`);
    await pool.end();
    return;
  }

  // Standalone / fixed-cron path (2026-08-24 UPGRADED · non-stop rhythm).
  // Zone-guard changed from "not run today" (1× per zone per day) to "not
  // run in last ZONE_COOLDOWN_MS" (per Philip: "Commerce · Indonesia
  // workforce market place walker should be non-stop working"). With 8 zones
  // and a 2h cooldown per zone, every zone is revisited ~12× per day at the
  // 15-min scheduler cadence · matches food/accommodation continuous rhythm.
  const ZONE_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2h · rotation depth · never re-hits same zone within 2h
  const cursor = loadCursor();
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const recentlyProcessed = new Set(
    (cursor.processedZones ?? [])
      .filter((p) => p.at && (now - new Date(p.at).getTime()) < ZONE_COOLDOWN_MS)
      .map((p) => p.zone),
  );
  const nextZone = ZONES.find((z) => !recentlyProcessed.has(z.id));

  if (!nextZone) {
    console.log("\nAll zones processed within cooldown · nothing to do this tick.");
    console.log("Zones on cooldown:", [...recentlyProcessed].join(", "));
    console.log(`Next zone becomes eligible in ~${Math.round(ZONE_COOLDOWN_MS / 60000)} min or on next tick.`);
    await pool.end();
    return;
  }
  console.log(`Next zone: ${nextZone.label} (${nextZone.id})`);
  console.log(`Zones on cooldown (last 2h): ${[...recentlyProcessed].join(", ") || "(none)"}\n`);

  const result = await runZoneCycle(nextZone);
  cursor.processedZones.push({ zone: nextZone.id, date: today, at: new Date().toISOString(), ...result });
  cursor.lastRunAt = new Date().toISOString();
  // Keep only recent entries (last 30 days worth)
  cursor.processedZones = cursor.processedZones.slice(-100);
  saveCursor(cursor);

  console.log(`\nRuntime: ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(`Cursor saved · next scheduler tick will pick a different zone.`);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
