// NEX Re-Verify Worker Tier · common library · Philip 2026-08-27.
//
// Runs in PARALLEL with discovery · reuses existing enrichment machinery ·
// touches EXISTING business rows only · never spawns new discovery cycles ·
// never mutates rotation state / cooldowns.
//
// Doctrine (Philip 2026-08-27):
//   · Discovery finds NEW businesses. Re-Verify improves KNOWN businesses.
//   · Cooldown protects a SURFACE from being hammered · doesn't stop the
//     whole discovery machine. Re-Verify keeps the workforce productive
//     during cooldown gaps.
//   · Re-Verify DOES NOT count toward saturation · does NOT change rotation
//     state · does NOT bypass any provider budget or governor.
//   · Batch cap = 10 candidates per cycle (Philip lock).
//   · Observable SEPARATELY from discovery via worker_cycle_run.worker_type.
//
// Reuses:
//   · businessWebsiteSource (own-site enrichment · og:image extraction ·
//     ADR-0022 compliant · 15s per-request timeout · own-domain politeness)
//   · applyEnrichmentToExisting from each vertical's config (COALESCE
//     writeback · owner_status='verified' guard · ON CONFLICT DO NOTHING
//     on nex.business_image · Universal Image Doctrine)
//
// Adds:
//   · cycle_run row per re-verify tick with detailed funnel counters
//     (candidates_read · fetch_attempted · fetch_succeeded · gain_returned ·
//     image_extracted · image_written · text_writes) so HQ can distinguish
//     re-verify output from discovery output.

import { randomUUID } from "node:crypto";
import { businessWebsiteSource } from "../nex-acquisition/sources/business-website.mjs";

/** Batch cap per Philip 2026-08-27 · non-negotiable · re-verify never hammers. */
export const RE_VERIFY_BATCH_CAP = 10;

/**
 * Read up to `limit` candidates from a vertical's business table.
 * Criteria:
 *   · has a website (enrichable via own-site)
 *   · not owner-verified (safe to modify · Discovery ≠ Outreach doctrine)
 *   · either never enriched (hero_image_url NULL) OR aged > 30 days
 * Ordered by NULL-hero first, then oldest-verified first (prioritise the
 * records that have never been touched).
 */
export async function readCandidates(pool, tableName, limit = RE_VERIFY_BATCH_CAP) {
  const { rows } = await pool.query(
    `SELECT public_listing_ref, business_name, website, hero_image_url,
            last_verified_at, owner_status
       FROM ${tableName}
      WHERE website IS NOT NULL
        AND website != ''
        AND (owner_status IS NULL OR owner_status != 'verified')
        AND (
          hero_image_url IS NULL
          OR last_verified_at IS NULL
          OR last_verified_at < now() - interval '30 days'
        )
      ORDER BY (hero_image_url IS NULL) DESC,
               last_verified_at ASC NULLS FIRST
      LIMIT $1`,
    [limit],
  );
  return rows;
}

/**
 * Run one re-verify cycle · fetch each candidate's own website via the
 * existing businessWebsiteSource · apply enrichment via the vertical's
 * applyEnrichmentToExisting · record a cycle_run row with funnel counters.
 *
 * Returns { workerId, cycleRunId, counters, durationMs }.
 */
export async function runReVerifyCycle({
  pool,
  config,          // vertical config (must expose config.persistence.applyEnrichmentToExisting)
  tableName,       // e.g. 'nex.food_business' | 'nex.accommodation_business'
  workerType,      // e.g. 're_verify_food' · distinct from discovery worker types
  workerConfig,    // e.g. 're_verify:food' · observable in HQ separately from discovery
  batchSize = RE_VERIFY_BATCH_CAP,
}) {
  const workerId   = randomUUID();
  const cycleRunId = randomUUID();
  const startMs    = Date.now();
  const counters = {
    mode: "re_verify",
    candidates_read: 0,
    fetch_attempted: 0,
    fetch_succeeded: 0,
    gain_returned: 0,
    image_extracted: 0,
    image_written: 0,
    text_writes: 0,
    errors: 0,
  };

  let candidates = [];
  try {
    candidates = await readCandidates(pool, tableName, batchSize);
    counters.candidates_read = candidates.length;
  } catch (err) {
    counters.errors++;
    console.error(`[re-verify] readCandidates(${tableName}) failed:`, err.message);
  }

  const source = businessWebsiteSource();

  for (const cand of candidates) {
    try {
      counters.fetch_attempted++;
      const gain = await source.enrich({ record: cand, config: {}, log: () => {} });
      if (!gain) continue;                            // no website content · silent skip
      counters.fetch_succeeded++;
      counters.gain_returned++;
      if (gain.image_url) counters.image_extracted++;

      const written = await config.persistence.applyEnrichmentToExisting(
        pool, cand, gain, { workerId, cycleRunId, sourceName: source.name },
      );
      if (written > 0) {
        counters.text_writes++;
        if (gain.image_url) counters.image_written++;
      }
    } catch (err) {
      counters.errors++;
      console.error(`[re-verify] ${cand.public_listing_ref}: ${err.message}`);
    }
  }

  const durationMs = Date.now() - startMs;

  // Record a cycle_run row · distinct worker_type keeps HQ dashboards able
  // to separate discovery output from re-verify output. Never counts toward
  // discovery saturation because rotation-tick's saturation counter reads
  // worker_config LIKE 'food:%'/'accommodation:%' etc, NOT 're_verify:%'.
  try {
    await pool.query(
      `INSERT INTO nex.worker_cycle_run (
         id, worker_id, worker_type, worker_config,
         started_at, finished_at, duration_ms,
         status, records_processed, records_new, records_rejected, errors_count,
         summary
       ) VALUES (
         $1::uuid, $2, $3, $4,
         to_timestamp($5::bigint / 1000.0), now(), $6,
         $7, $8, $9, $10, $11,
         $12::jsonb
       )`,
      [
        cycleRunId, workerId, workerType, workerConfig,
        startMs, durationMs,
        "completed", counters.candidates_read, 0, 0, counters.errors,
        JSON.stringify(counters),
      ],
    );
  } catch (err) {
    console.error(`[re-verify] cycle_run insert failed:`, err.message);
  }

  return { workerId, cycleRunId, counters, durationMs };
}
