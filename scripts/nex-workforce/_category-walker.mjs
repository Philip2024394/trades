#!/usr/bin/env node
// scripts/nex-workforce/_category-walker.mjs
//
// NEX Workforce · GENERIC PARAMETRIC CATEGORY WALKER · Philip 2026-08-27.
//
// One walker binary serves ALL 100 planned category-specialists (Phase 1 ships 10).
// Adding a category = ONE JSON entry in data/nex-job-registry.json · no code change.
//
// Contract (called by orchestrator):
//   node _category-walker.mjs --category=<slug> --city=<CanonicalCity> [--strategy-index=N]
//
// What this walker does:
//   1. Loads the job from data/nex-job-registry.json by category_slug
//   2. Loads the city bbox from data/nex-city-catalogue.json
//   3. For each strategy (or --strategy-index if pinned): dispatches to the
//      provider (Phase 1 · overpass only)
//   4. Filters candidates by bbox · dedupes against target_table by natural key
//   5. Persists to job.target_table (Phase 1 · nex.service_business only)
//   6. Writes worker_cycle_run + heartbeat rows so HQ + rotation-tick see it
//
// Preserves in every cycle:
//   · Provider Rate Governor lease (via osmOverpassSource)
//   · Discovery ≠ Outreach (owner_status guard on writes · never set to verified)
//   · Never fake records_new (SELECT-verify pattern)
//   · Cutover 5 acquisition freeze (does NOT touch existing food/accommodation
//     acquisition surface · service_business is a new table)
//
// Phase 1 scope limits (documented honestly):
//   · Only PERSISTS when target_table = nex.service_business
//   · If target_table = food_business or accommodation_business, walker runs
//     discovery + writes summary but SKIPS persistence · Phase 1.5 adds slim
//     inserters for those tables
//   · This lets us prove the mechanism with 6/10 jobs writing records + all
//     10/10 jobs cycling through rotation

import pg from "pg";
import { randomUUID, createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { jobBySlug } from "./_job-registry.mjs";
import { allCities } from "../nex-city-catalogue/loader.mjs";
import { osmOverpassSource } from "../nex-acquisition/sources/osm-overpass.mjs";
import { businessWebsiteSource } from "../nex-acquisition/sources/business-website.mjs";
import { persistHospitalityCandidate } from "./_hospitality-persister.mjs";
import { persistMarketplaceSeller } from "./_marketplace-persister.mjs";
import {
  REJECTION_REASONS,
  createRejectionCounter,
  computeCycleOutcome,
} from "../nex-worker/rejection-reasons.mjs";

// ═══════════════════════════════════════════════════════════════════════
// LEGACY WORKFORCE QUARANTINE · 2026-09-04 · fail-closed at boot
// ═══════════════════════════════════════════════════════════════════════
// This walker is the Phase 1B production execution unit spawned by the
// legacy nex-acquisition-workforce supervisor. It writes directly to
// nex.food_business / nex.accommodation_business / nex.worker_cycle_run /
// nex.worker_heartbeat bypassing the workforce v2 persister boundary
// (Slice 4.1 v2 extensions.digest) proven by Gate 5A #4 on 2026-09-04.
//
// Defense-in-depth: even if a caller bypasses the launcher + watchdog +
// supervisor quarantines, execution is refused here BEFORE any pg.Pool()
// call, before any Overpass request, before any nex.* write.
//
// Import-time note: this file's top-level `import` statements (osm-overpass,
// business-website, persist helpers) resolve their modules but do NOT open
// DB connections or make network requests. The guard below fires before
// any of the walker's runtime logic executes.
//
// No env-var bypass. To re-enable: edit this guard block + Readiness Gate
// + explicit Philip authorization. See run-production-launcher.mjs for
// full quarantine context.
// ═══════════════════════════════════════════════════════════════════════
process.stderr.write("═══════════════════════════════════════════════════════════════════════\n");
process.stderr.write(" NEX LEGACY WORKFORCE · QUARANTINED · _category-walker.mjs\n");
process.stderr.write("═══════════════════════════════════════════════════════════════════════\n");
process.stderr.write(" Legacy walker quarantined (2026-09-04). No DB connection, no Overpass\n");
process.stderr.write(" request, no writes to nex.food_business / nex.accommodation_business /\n");
process.stderr.write(" nex.worker_*. Exiting code 2. Superseded by scripts/nex-workforce-v2/.\n");
process.stderr.write("═══════════════════════════════════════════════════════════════════════\n");
process.exit(2);

// ═══════════════════════════════════════════════════════════════════════
// ORIGINAL WALKER LOGIC PRESERVED BELOW (UNREACHABLE)
// ═══════════════════════════════════════════════════════════════════════

// Phase 1.5 (Philip 2026-08-27) · category slug → (vertical category value, target table).
// Hotels/guesthouses land in accommodation_business · restaurants/cafes in food_business.
// Legacy category values MUST match the CHECK constraint on each vertical table.
const HOSPITALITY_MAP = Object.freeze({
  hotels:       { verticalCategory: "hotel",       targetTable: "nex.accommodation_business", businessType: "accommodation" },
  guesthouses:  { verticalCategory: "guesthouse",  targetTable: "nex.accommodation_business", businessType: "accommodation" },
  restaurants:  { verticalCategory: "restaurant",  targetTable: "nex.food_business",          businessType: "food" },
  cafes:        { verticalCategory: "coffee-cafe", targetTable: "nex.food_business",          businessType: "food" },
});

/** Max website-fetch attempts per walker cycle · Philip 2026-08-27 (B).
 * Each fetch = up to ~30s worst case (homepage + up to 3 contact-page probes).
 * Cap of 5 keeps a cycle bounded to ~150s worst-case for image work while
 * still growing the image inventory meaningfully every cycle. Once a business
 * has an image, subsequent cycles skip it (hero_image_url IS NULL guard). */
const IMAGE_FETCH_QUOTA_PER_CYCLE = 5;

const NEX_POSTGRES_URL = process.env.NEX_POSTGRES_URL
  ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";

// ── Argument parser (minimal · no dependencies) ─────────────────────────
function parseArgs(argv) {
  const out = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([\w-]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

// ── Strategy → osm-overpass config translator ──────────────────────────
// Registry stores strategies as { provider, query_kind, params: { key: value } }.
// osmOverpassSource expects { amenities, shopTypes, tourismTypes, extendedTagPairs }.
// This function maps the former to the latter for a SINGLE strategy · walker
// runs one strategy at a time so rotation state stays surface-grained.
export function strategyToOverpassConfig(strategy) {
  if (strategy.provider !== "overpass") {
    throw new Error(`only 'overpass' supported in Phase 1 · got '${strategy.provider}'`);
  }
  if (strategy.query_kind !== "tag") {
    throw new Error(`only 'tag' query_kind supported in Phase 1 · got '${strategy.query_kind}'`);
  }
  const cfg = { amenities: [], shopTypes: [], tourismTypes: [], extendedTagPairs: [] };
  for (const [key, value] of Object.entries(strategy.params ?? {})) {
    if (key === "amenity") cfg.amenities.push(value);
    else if (key === "shop") cfg.shopTypes.push(value);
    else if (key === "tourism") cfg.tourismTypes.push(value);
    else if (key === "tag_pairs" && Array.isArray(value)) {
      for (const pair of value) cfg.extendedTagPairs.push(pair);
    } else {
      // Any other key (leisure, sport, office, ...) becomes an extendedTagPair.
      cfg.extendedTagPairs.push([key, value]);
    }
  }
  return cfg;
}

// ── Public listing ref generator · #SB-YYYY-XXXXX ─────────────────────
// Crockford Base32 · deterministic from source_reference · same pattern as
// #FL-* (food) and #AC-* (accommodation). Ensures re-running the walker on
// the same OSM element produces the same ref (idempotent).
const CROCKFORD = "ABCDEFGHJKMNPQRSTVWXYZ0123456789".split("");
export function generateServiceRef(sourceReference) {
  const year = new Date().getUTCFullYear();
  const digest = createHash("sha256").update(String(sourceReference)).digest();
  let out = "";
  for (let i = 0; i < 5; i++) out += CROCKFORD[digest[i] % CROCKFORD.length];
  return `#SB-${year}-${out}`;
}

// ── Bbox filter (Overpass returns everything in the query bbox · re-verify
//    on the strict city bbox because relations can extend beyond).
function insideBbox(lat, lng, bbox) {
  if (lat == null || lng == null) return false;
  return lat >= bbox.sw[0] && lat <= bbox.ne[0]
      && lng >= bbox.sw[1] && lng <= bbox.ne[1];
}

// ── Service-business inserter · Phase 1 only supports nex.service_business.
// Returns { insertedRef | null, rejectionReason | null }.
// Uses ON CONFLICT DO NOTHING on (source, source_reference) unique index so
// concurrent walker runs never double-insert the same OSM element.
export async function persistServiceBusiness(pool, {
  categorySlug, city, candidate, workerId, cycleRunId,
}) {
  if (!candidate.name) return { insertedRef: null, rejectionReason: REJECTION_REASONS.MALFORMED };
  if (candidate.lat == null || candidate.lng == null) {
    return { insertedRef: null, rejectionReason: REJECTION_REASONS.GEO_MISS };
  }

  const publicRef = generateServiceRef(candidate.sourceReference);

  const insertRes = await pool.query(
    `INSERT INTO nex.service_business (
       public_listing_ref, business_name, category_slug, categories,
       address, city, coordinates_lng, coordinates_lat,
       phone, whatsapp_number, website,
       source, source_reference, source_licence_terms, source_updated_at,
       last_verified_at, verification_source,
       worker_id, cycle_run_id
     )
     VALUES ($1, $2, $3, $4::text[],
             $5, $6, $7, $8,
             $9, $10, $11,
             $12, $13, $14, $15,
             $16, $17,
             $18, $19::uuid)
     ON CONFLICT (source, source_reference) DO NOTHING
     RETURNING public_listing_ref, internal_id`,
    [
      publicRef, candidate.name, categorySlug, candidate.categories ?? [],
      candidate.address ?? null, city, candidate.lng, candidate.lat,
      candidate.phone ?? null, candidate.whatsapp ?? null, candidate.website ?? null,
      candidate.sourceType ?? "osm_overpass", candidate.sourceReference ?? null,
      candidate.sourceLicenceTerms ?? null, candidate.sourceUpdatedAt ?? null,
      candidate.lastVerifiedAt ?? null, candidate.verificationSource ?? null,
      workerId, cycleRunId,
    ],
  );

  if (insertRes.rowCount === 0) {
    // Existing (source, source_reference) tuple · natural-key dedup hit.
    // Return the existing ref so caller can still enrich (image/etc) if
    // the pre-existing row hasn't been enriched yet.
    return { insertedRef: null, existingRef: publicRef, rejectionReason: REJECTION_REASONS.MATCHED_EXISTING };
  }

  // Preserve raw OSM payload for future re-classification (source_snapshot).
  try {
    await pool.query(
      `INSERT INTO nex.service_business_source_snapshot
         (business_ref, source, source_reference, raw_payload, worker_id, cycle_run_id)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6::uuid)
       ON CONFLICT (source, source_reference) DO NOTHING`,
      [
        publicRef, candidate.sourceType ?? "osm_overpass",
        candidate.sourceReference ?? "unknown", JSON.stringify(candidate.rawTags ?? {}),
        workerId, cycleRunId,
      ],
    );
  } catch (err) {
    // Snapshot failure is non-fatal · the row is already persisted.
    console.error(`[category-walker] snapshot insert failed for ${publicRef}: ${err.message}`);
  }

  return { insertedRef: insertRes.rows[0].public_listing_ref, existingRef: null, rejectionReason: null };
}

/**
 * Fetch a business's website, extract og:image (or fallback tag), persist to
 * nex.business_image (universal image layer), and populate the target table's
 * hero_image_url. Philip 2026-08-27 (B + Phase 1.5): image extraction is part
 * of the acquisition pipeline, not a separate step.
 *
 * Provenance chain: business → identity → website → image → nex.business_image
 *
 * Generalised 2026-08-27 to work for services + food + accommodation. Caller
 * supplies targetTable + businessType so the same enricher services all
 * verticals · food/accommodation get the extra hero_image_source/approved/
 * provenance columns their schema exposes.
 *
 * Returns { attempted, extracted, written } counters (all 0/1).
 * Never throws · businessWebsiteSource is fail-soft (returns null on any error).
 */
export async function enrichWithImage(pool, {
  publicRef, candidate, workerId, cycleRunId,
  targetTable = "nex.service_business",
  businessType = "services",
}) {
  const counters = { attempted: 0, extracted: 0, written: 0 };
  if (!candidate.website) return counters;

  // Skip if this business already has a hero image (cheap guard · avoids
  // re-fetching websites we've already imaged in a prior cycle).
  const existingHero = await pool.query(
    `SELECT hero_image_url FROM ${targetTable} WHERE public_listing_ref = $1 LIMIT 1`,
    [publicRef],
  );
  if (existingHero.rows[0]?.hero_image_url) return counters;

  counters.attempted = 1;
  const source = businessWebsiteSource();
  const gain = await source.enrich({
    record: { website: candidate.website },
    config: {},
    log: () => {},
  }).catch(() => null);

  if (!gain?.image_url) return counters;
  counters.extracted = 1;

  const provenance = {
    source_url:    gain._sourceReference ?? candidate.website,
    method:        gain.image_source_method ?? "unknown",
    extracted_at:  new Date().toISOString(),
    worker_id:     workerId,
    cycle_run_id:  cycleRunId,
    walker_family: `category-walker/${businessType}`,
  };
  try {
    const imgRes = await pool.query(
      `INSERT INTO nex.business_image (
         business_type, business_country, business_ref, image_type,
         url, source, provenance, confidence, cycle_run_id, approved, owner_approved
       ) VALUES (
         $1, 'ID', $2, 'VERIFIED_REAL',
         $3, 'business_website', $4::jsonb, 0.6, $5::uuid, false, false
       )
       ON CONFLICT (business_type, business_country, business_ref, image_type) DO NOTHING
       RETURNING id`,
      [businessType, publicRef, gain.image_url, JSON.stringify(provenance), cycleRunId],
    );
    if (imgRes.rowCount > 0) counters.written = 1;

    // Denormalised hero_image_url on the target table for fast card lookup.
    // food_business + accommodation_business ALSO have hero_image_source +
    // hero_image_approved + hero_image_provenance columns · populate them so
    // the row matches legacy walker output shape. service_business omits
    // those columns · guard the UPDATE with a target-specific branch.
    if (targetTable === "nex.service_business") {
      await pool.query(
        `UPDATE ${targetTable}
           SET hero_image_url = $1, updated_at = now()
         WHERE public_listing_ref = $2 AND hero_image_url IS NULL`,
        [gain.image_url, publicRef],
      );
    } else {
      await pool.query(
        `UPDATE ${targetTable}
           SET hero_image_url = $1,
               hero_image_source = 'walker:business_website',
               hero_image_approved = false,
               hero_image_provenance = $2::jsonb,
               updated_at = now()
         WHERE public_listing_ref = $3 AND hero_image_url IS NULL`,
        [gain.image_url, JSON.stringify(provenance), publicRef],
      );
    }
  } catch (err) {
    console.error(`  [image] persist failed for ${publicRef}: ${err.message}`);
  }
  return counters;
}

// ── Heartbeat + cycle_run helpers ──────────────────────────────────────
async function writeHeartbeat(pool, { workerId, workerType, workerConfig, status, cycleRunId }) {
  await pool.query(
    `INSERT INTO nex.worker_heartbeat (worker_id, worker_type, worker_config, last_heartbeat_at, last_status, last_cycle_run_id)
     VALUES ($1, $2, $3, now(), $4, $5::uuid)
     ON CONFLICT (worker_id) DO UPDATE SET
       last_heartbeat_at = EXCLUDED.last_heartbeat_at,
       last_status       = EXCLUDED.last_status,
       last_cycle_run_id = EXCLUDED.last_cycle_run_id`,
    [workerId, workerType, workerConfig, status, cycleRunId],
  );
}

/**
 * Insert a placeholder worker_cycle_run row at cycle start · status='running'.
 * Needed BEFORE any persistence that references cycle_run_id via FK (e.g.
 * nex.business_image.cycle_run_id → nex.worker_cycle_run(id)). Without this,
 * mid-cycle inserts throw silently on FK violation and image extraction fails.
 * Philip 2026-08-27 (B).
 */
async function insertCycleRunStart(pool, params) {
  await pool.query(
    `INSERT INTO nex.worker_cycle_run (
       id, worker_id, worker_type, worker_config,
       started_at, status, errors_count, summary
     ) VALUES (
       $1::uuid, $2, $3, $4,
       to_timestamp($5::bigint / 1000.0), 'running', 0, '{}'::jsonb
     )`,
    [
      params.cycleRunId, params.workerId, params.workerType, params.workerConfig,
      params.startMs,
    ],
  );
}

async function updateCycleRunFinish(pool, params) {
  await pool.query(
    `UPDATE nex.worker_cycle_run SET
       finished_at = now(),
       duration_ms = $2,
       status = $3,
       records_processed = $4,
       records_new = $5,
       records_rejected = $6,
       errors_count = $7,
       summary = $8::jsonb
     WHERE id = $1::uuid`,
    [
      params.cycleRunId, params.durationMs,
      params.status, params.processed, params.newCount, params.rejected, params.errors,
      JSON.stringify(params.summary),
    ],
  );
}

// ── Main cycle ─────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv);
  const categorySlug = args.category;
  const city = args.city;
  const strategyIndex = args["strategy-index"] != null ? parseInt(args["strategy-index"], 10) : null;

  if (!categorySlug || !city) {
    console.error("USAGE: _category-walker.mjs --category=<slug> --city=<CanonicalCity> [--strategy-index=N]");
    process.exit(1);
  }

  const job = jobBySlug(categorySlug);
  const cities = allCities();
  const cityEntry = cities.find((c) => c.canonical === city);
  if (!cityEntry) {
    console.error(`unknown city "${city}" · not in data/nex-city-catalogue.json`);
    process.exit(1);
  }
  const bbox = { sw: cityEntry.bboxSw, ne: cityEntry.bboxNe };

  const workerId    = randomUUID();
  const cycleRunId  = randomUUID();
  const startMs     = Date.now();
  const workerType  = `category:${categorySlug}`;
  const workerConfig = `${categorySlug}:${city}:overpass`;

  const pool = new pg.Pool({
    connectionString: NEX_POSTGRES_URL,
    max: 3,
    // DB timeout guardrail · Philip 2026-09-03 Fix #1 (approved after
    // root-cause diagnosis of restaurants:Yogyakarta stall). Any single
    // pg.query() that outlasts 30s fails at the driver (query_timeout)
    // AND at Postgres (statement_timeout · belt-and-braces). Per-candidate
    // try/catch (below) catches, increments errorCount, and advances to
    // the next candidate — walker never hangs indefinitely on a single
    // slow query. CYCLE_TIMEOUT_MS deliberately unchanged.
    query_timeout: 30_000,
    statement_timeout: 30_000,
  });

  const strategies = strategyIndex != null ? [job.strategies[strategyIndex]] : job.strategies;
  const rejections = createRejectionCounter();
  const counters = {
    mode: "category_walker",
    job_id: job.id,
    category_slug: categorySlug,
    city,
    strategies_run: 0,
    candidates_fetched: 0,
    candidates_after_bbox: 0,
    persisted_new: 0,
    persisted_target_table: job.target_table,
    persistence_skipped_phase_1: false,
    // Philip 2026-08-27 (B) · image extraction counters
    image_attempted: 0,
    image_extracted: 0,
    image_written: 0,
  };

  let status = "completed";
  let errorCount = 0;

  // Write cycle_run row at START (status='running') so mid-cycle inserts
  // that reference cycle_run_id via FK (nex.business_image) don't throw.
  // Also emits the heartbeat.
  try {
    await insertCycleRunStart(pool, {
      cycleRunId, workerId, workerType, workerConfig, startMs,
    });
  } catch (err) {
    console.error(`[category-walker] cycle_run start insert failed: ${err.message}`);
    // Not fatal · continue · image inserts may still work if the FK isn't
    // resolved on insert timing (it's a normal FK · will fail loudly if row missing).
  }
  await writeHeartbeat(pool, {
    workerId, workerType, workerConfig, status: "running", cycleRunId,
  });

  try {
    for (const [idx, strategy] of strategies.entries()) {
      counters.strategies_run += 1;
      const overpassConfig = strategyToOverpassConfig(strategy);
      const source = osmOverpassSource();

      // osmOverpassSource.discover() calls extractCandidate() internally,
      // which needs EITHER a classifier(amenity, shop, cuisine, tags) that
      // returns {primary, secondary[]} OR a legacy categoryMapping(amenity,
      // cuisine, tags). We use a classifier fixed to the job's category_slug
      // because the job's Overpass query IS filtered to the right tag - every
      // element returned already belongs to this category by construction.
      overpassConfig.classifier = (_amenity, _shop, _cuisine, _tags) => ({
        primary: categorySlug,
        secondary: [],
      });

      // Reuse existing Overpass source · Provider Rate Governor lease acquired
      // inside · endpoint failover · 24h cache. Returns an ARRAY of candidate
      // objects (NOT a raw `{elements:[...]}` payload).
      const candidates = await source.discover({
        config: {
          vertical: `workforce-${categorySlug}`,   // cache namespace
          osmOverpass: overpassConfig,
        },
        bbox,
        log: (msg) => console.log(`  [strategy ${idx}] ${msg}`),
      });
      counters.candidates_fetched += candidates.length;

      // Re-check bbox on candidates: ways/relations may have centres just
      // outside the strict city bbox even after the Overpass filter.
      const inside = candidates.filter((c) => insideBbox(c.lat, c.lng, bbox));
      counters.candidates_after_bbox += inside.length;

      // Persistence path · Phase 1.5 (Philip 2026-08-27) opens up hotels /
      // guesthouses / restaurants / cafes to their vertical tables.
      // Phase 2 marketplace (Philip 2026-08-27) opens up retail-* categories
      // to nex.mp_seller (Indonesia-wide 24/7 seller discovery for NEX Market).
      const hospitalityMapping = HOSPITALITY_MAP[categorySlug];
      const isService     = job.target_table === "nex.service_business";
      const isHospitality = !isService && hospitalityMapping != null
                          && hospitalityMapping.targetTable === job.target_table;
      const isMarketplace = job.target_table === "nex.mp_seller";

      if (!isService && !isHospitality && !isMarketplace) {
        counters.persistence_skipped_phase_1 = true;
        console.log(`  [strategy ${idx}] persistence skipped · target_table=${job.target_table} not yet wired · ${inside.length} candidates discovered but not persisted`);
        continue;
      }

      for (const [candidateIdx, candidate] of inside.entries()) {
        // Progress log every 50 candidates · Philip 2026-09-03 Fix #1.
        // Makes future stalls diagnosable to the exact candidate index
        // within one bucket instead of "cycle hung somewhere".
        if (candidateIdx % 50 === 0) console.log(`  [strategy ${idx}] persisting ${candidateIdx + 1}/${inside.length}`);
        try {
          let insertedRef = null;
          let existingRef = null;
          let rejectionReason = null;

          if (isService) {
            const r = await persistServiceBusiness(pool, {
              categorySlug, city, candidate, workerId, cycleRunId,
            });
            insertedRef = r.insertedRef;
            existingRef = r.existingRef;
            rejectionReason = r.rejectionReason;
          } else if (isMarketplace) {
            // Phase 2 marketplace · seller persister · nex.mp_seller.
            const r = await persistMarketplaceSeller(pool, {
              candidate, city, workerId, cycleRunId, categorySlug,
            });
            insertedRef = r.insertedSlug;
            existingRef = r.existingSlug;
            rejectionReason = r.rejectionReason;
          } else {
            // Phase 1.5 · hospitality persister · food_business + accommodation_business.
            const r = await persistHospitalityCandidate(pool, {
              targetTable:      hospitalityMapping.targetTable,
              verticalCategory: hospitalityMapping.verticalCategory,
              candidate, city, workerId, cycleRunId,
            });
            insertedRef = r.insertedRef;
            existingRef = r.existingRef;
            rejectionReason = r.rejectionReason;
          }

          if (insertedRef) counters.persisted_new += 1;
          else if (rejectionReason) rejections.increment(rejectionReason);

          // Philip 2026-08-27 (B) · image extraction inline with acquisition.
          // Runs on both freshly-inserted AND existing (matched) rows that
          // don't yet have a hero image. Quota keeps cycles bounded.
          // Phase 2 marketplace: mp_seller has no hero_image_url column · we
          // skip image enrichment for marketplace rows until Phase 3 wires
          // cover_image_ref writes.
          const refToEnrich = insertedRef ?? existingRef;
          if (refToEnrich && !isMarketplace
              && counters.image_attempted < IMAGE_FETCH_QUOTA_PER_CYCLE
              && candidate.website) {
            const imgCounts = await enrichWithImage(pool, {
              publicRef: refToEnrich, candidate, workerId, cycleRunId,
              targetTable:  isService ? "nex.service_business" : hospitalityMapping.targetTable,
              businessType: isService ? "services"             : hospitalityMapping.businessType,
            });
            counters.image_attempted += imgCounts.attempted;
            counters.image_extracted += imgCounts.extracted;
            counters.image_written   += imgCounts.written;
          }
        } catch (err) {
          errorCount += 1;
          rejections.increment(REJECTION_REASONS.OTHER);
          console.error(`  [strategy ${idx}] persistence failed for ${candidate.sourceReference}: ${err.message}`);
        }
      }
    }
  } catch (err) {
    status = "failed";
    errorCount += 1;
    console.error(`[category-walker] fatal: ${err.message}`);
  }

  const durationMs = Date.now() - startMs;
  const rejectionSnapshot = rejections.toObject();
  const matchedExisting = rejections.get(REJECTION_REASONS.MATCHED_EXISTING);
  const rejectedTotal   = rejections.total();
  const cycleOutcome = computeCycleOutcome({
    recordsProcessed: counters.candidates_after_bbox,
    recordsNew:       counters.persisted_new,
    recordsRejected:  rejectedTotal,
    matchedExisting,
    providerReturned: counters.candidates_fetched,
    providerErrored:  status === "failed" ? 1 : 0,
    budgetExhausted:  false,
  });
  counters.rejections   = rejectionSnapshot;
  counters.cycle_outcome = cycleOutcome;

  try {
    await updateCycleRunFinish(pool, {
      cycleRunId, durationMs, status,
      processed: counters.candidates_after_bbox,
      newCount: counters.persisted_new,
      rejected: rejectedTotal,
      errors: errorCount,
      summary: counters,
    });
    await writeHeartbeat(pool, {
      workerId, workerType, workerConfig, status, cycleRunId,
    });
  } catch (err) {
    console.error(`[category-walker] cycle_run finalize failed: ${err.message}`);
  }

  console.log(`[category-walker] complete`, {
    cycle_run_id: cycleRunId,
    duration_ms: durationMs,
    status,
    ...counters,
  });

  await pool.end();
  process.exit(status === "completed" ? 0 : 1);
}

// Only run main() when invoked as CLI · lets tests import pure helpers.
const invokedAsScript = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedAsScript) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
