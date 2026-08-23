// scripts/nex-acquisition/category-candidate-writer.mjs
//
// Directory Factory · Phase 1 · 2026-08-23
// Walker CATEGORY_CANDIDATE writer. Consumes Walker's persisted
// discovery output and — when a cluster meets doctrine thresholds —
// writes a PENDING candidate proposal to nex.category_candidate.
//
// Boundaries (locked by the Directory Factory doctrine + Walker-Stays-
// Pure doctrine · enforced by the writer's SQL surface):
//
//   ✓ Reads: nex.category_registry (id lookup only)
//            nex.food_business / nex.accommodation_business (Walker's own persist output)
//            nex.food_business_field_provenance / nex.accommodation_business_field_provenance
//                (cycle_run_id per field · Task #74 Direct-Provenance A)
//   ✓ Writes: nex.category_candidate ONLY.
//   ✗ NEVER writes to nex.category_registry.
//   ✗ NEVER sets admin_decision != 'pending'.
//   ✗ NEVER sets admin_reviewed_at / admin_reviewed_by / admin_notes.
//   ✗ NEVER inserts when business_count < 50 OR cycle_count < 2.
//   ✗ NEVER invents businesses · groups only what Walker persisted.
//
// The pipeline stays:
//   Walker discovers → THIS writer proposes → human approves via HQ
//   → (future Phase 3) Factory activates → Registry row → live directory.
//
// Idempotence:
//   Called after every cycle. Two-step upsert:
//     1. If a pending/approved candidate exists for the proposed_category_id,
//        UPDATE its counts + evidence + cycle-run pointer (do NOT touch
//        admin_decision — a prior human decision is preserved).
//     2. Otherwise INSERT a new pending row.
//   Backed by the partial-unique index
//   `category_candidate_active_dedup_idx` from migration 083 as last
//   defence against duplicates.
//
// Doctrine anchors:
//   project_nex_directory_factory_doctrine_2026_08_22
//   project_nex_walker_stays_pure_acquisition_2026_08_22
//   project_nex_universal_directory_image_doctrine_2026_08_22
//   project_nex_truth_invariant_2026_08_22
//   docs/nex/directory-factory-phase-0-plan.md (§9 Phase 1)

// ── Vertical metadata · used to route SQL against the right tables ──
// Whitelisted map — do NOT accept a caller-supplied businessTable /
// provenanceTable string (SQL-injection defence).
const VERTICAL_META = /** @type {const} */ ({
  food: {
    businessTable:    "nex.food_business",
    provenanceTable:  "nex.food_business_field_provenance",
  },
  accommodation: {
    businessTable:    "nex.accommodation_business",
    provenanceTable:  "nex.accommodation_business_field_provenance",
  },
});

const PARENT_VERTICAL_ENUM = new Set([
  "food", "accommodation", "rentals", "services", "tourism",
]);

// Thresholds enforced at DB level via CHECK constraints (migration 083).
// Mirrored here so the writer skips gracefully before hitting the CHECK.
const MIN_BUSINESS_COUNT = 50;
const MIN_CYCLE_COUNT    = 2;
const MAX_SAMPLE_BUSINESSES = 15;

/**
 * Propose category candidates from a completed Walker cycle.
 *
 * @param {import('pg').Pool} pool
 * @param {{
 *   cycleRunId: string,   // uuid returned by startCycleRun()
 *   vertical: keyof typeof VERTICAL_META,
 *   country: string,      // ISO 3166-1 alpha-2 e.g. "ID"
 *   city?: string,        // e.g. "Yogyakarta" · used in evidence only
 *   workerId: string,     // e.g. "acquisition:food:Yogyakarta"
 * }} opts
 * @returns {Promise<{
 *   proposed: Array<{ id: string, businessCount: number, cycleCount: number, confidence: number }>,
 *   updated:  Array<{ id: string, businessCount: number, cycleCount: number, confidence: number }>,
 *   skipped:  Array<{ id?: string, raw?: string, reason: string, [k: string]: any }>,
 *   summary:  string,
 * }>}
 */
export async function proposeCategoryCandidates(pool, opts) {
  const { cycleRunId, vertical, country, city, workerId } = opts;

  // Guard: vertical must be a known enum value (SQL-injection defence).
  if (!PARENT_VERTICAL_ENUM.has(vertical)) {
    return emptyResult(`unsupported-vertical:${vertical}`);
  }
  const meta = VERTICAL_META[vertical];
  if (!meta) {
    return emptyResult(`no-vertical-meta:${vertical}`);
  }

  // Guard: country must look like an ISO-2 code.
  if (typeof country !== "string" || !/^[A-Z]{2}$/.test(country)) {
    return emptyResult(`bad-country:${country}`);
  }

  // Load all Registry ids (active + inactive) so we never propose a
  // duplicate of something that already has canonical identity.
  const registryIds = new Set(
    (await pool.query(`SELECT id FROM nex.category_registry`)).rows.map((r) => r.id),
  );

  // Group Walker's persisted rows by their classifier-primary category.
  // country is bound as a parameter · table name is a whitelisted constant.
  const groupsRes = await pool.query(
    `SELECT category, COUNT(*)::int AS n
       FROM ${meta.businessTable}
      WHERE country = $1 AND category IS NOT NULL
      GROUP BY category
      ORDER BY n DESC`,
    [country],
  );

  /** @type {Array<{ id: string, businessCount: number, cycleCount: number, confidence: number }>} */
  const proposed = [];
  /** @type {Array<{ id: string, businessCount: number, cycleCount: number, confidence: number }>} */
  const updated  = [];
  /** @type {Array<{ id?: string, raw?: string, reason: string, [k: string]: any }>} */
  const skipped  = [];

  for (const row of groupsRes.rows) {
    const rawCategory = row.category;
    const businessCount = row.n;
    const proposedId = toKebab(rawCategory);

    if (!proposedId || !/^[a-z][a-z0-9-]*$/.test(proposedId)) {
      skipped.push({ raw: rawCategory, reason: "invalid-id-shape" });
      continue;
    }

    if (registryIds.has(proposedId)) {
      skipped.push({ id: proposedId, reason: "already-in-registry" });
      continue;
    }

    if (businessCount < MIN_BUSINESS_COUNT) {
      skipped.push({ id: proposedId, businessCount, reason: "below-business-threshold" });
      continue;
    }

    // Count DISTINCT cycle_run_ids from provenance rows attached to
    // businesses in this category. Task #74 Direct-Provenance A means
    // every field write carries the cycleRunId that produced it —
    // giving us multi-cycle observation evidence naturally.
    const cycleCountRes = await pool.query(
      `SELECT COUNT(DISTINCT p.cycle_run_id)::int AS n
         FROM ${meta.provenanceTable} p
         JOIN ${meta.businessTable} b
           ON b.public_listing_ref = p.business_ref
        WHERE b.category = $1
          AND b.country  = $2
          AND p.cycle_run_id IS NOT NULL`,
      [rawCategory, country],
    );
    const cycleCount = cycleCountRes.rows[0]?.n ?? 0;

    if (cycleCount < MIN_CYCLE_COUNT) {
      skipped.push({ id: proposedId, businessCount, cycleCount, reason: "below-cycle-threshold" });
      continue;
    }

    // Gather a bounded evidence sample — enough for a human reviewer
    // to answer "why is NEX proposing this directory?"
    const sampleBusinesses = await sampleBusinessesForCategory(
      pool, meta.businessTable, rawCategory, country, MAX_SAMPLE_BUSINESSES,
    );

    /** Phase 1 evidence · deliberately minimal but provenance-rich. */
    const evidence = {
      source:              "walker-classifier-primary",
      vertical,
      country,
      city:                city ?? null,
      classifier_primary:  rawCategory,
      pattern_key:         `primary=${rawCategory}`,
      observed_at:         new Date().toISOString(),
      cycle_run_id:        cycleRunId,
      thresholds: {
        business_count_required: MIN_BUSINESS_COUNT,
        cycle_count_required:    MIN_CYCLE_COUNT,
        business_count_observed: businessCount,
        cycle_count_observed:    cycleCount,
      },
    };

    // Phase 1 · simple asymptote confidence heuristic.
    // Meeting the threshold is worth ~0.5 · more evidence tends toward 1.
    const confidence = Number((businessCount / (businessCount + 50)).toFixed(3));

    const upsertResult = await upsertPendingCandidate(pool, {
      proposedId,
      proposedName:              humanize(rawCategory),
      displayNameEn:             humanize(rawCategory),
      suggestedParentVertical:   vertical,
      brainKeywords:             buildBrainKeywords(rawCategory),
      suggestedCountries:        [country],
      businessCount,
      cycleCount,
      confidence,
      evidence,
      discoveredBusinesses:      sampleBusinesses,
      proposedBy:                workerId,
      proposedCycleRunId:        cycleRunId,
    });

    if (upsertResult.inserted) {
      proposed.push({ id: proposedId, businessCount, cycleCount, confidence });
    } else {
      updated.push({ id: proposedId, businessCount, cycleCount, confidence });
    }
  }

  return {
    proposed,
    updated,
    skipped,
    summary: `phase1-candidates · proposed=${proposed.length} updated=${updated.length} skipped=${skipped.length}`,
  };
}

// ── Internal helpers ──────────────────────────────────────────────

/** @returns {Promise<Array<{business_ref: string, name: string, city: string, source_reference: string}>>} */
async function sampleBusinessesForCategory(pool, businessTable, rawCategory, country, limit) {
  const res = await pool.query(
    `SELECT public_listing_ref AS business_ref,
            business_name      AS name,
            city               AS city,
            source_reference   AS source_reference
       FROM ${businessTable}
      WHERE category = $1 AND country = $2
      ORDER BY public_listing_ref ASC
      LIMIT $3`,
    [rawCategory, country, limit],
  );
  return res.rows;
}

/**
 * Idempotent upsert of a PENDING candidate.
 *
 * Never touches admin_decision, admin_reviewed_at, admin_reviewed_by,
 * admin_notes. If a human has already reviewed the candidate
 * (admin_decision != 'pending'), this writer must not undo that —
 * which is why the WHERE filter only matches pending/approved rows and
 * the UPDATE never sets those columns.
 *
 * @returns {Promise<{ inserted: boolean, updated: boolean, id: string }>}
 */
async function upsertPendingCandidate(pool, f) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT id, admin_decision
         FROM nex.category_candidate
        WHERE proposed_category_id = $1
          AND admin_decision IN ('pending','approved')
        LIMIT 1`,
      [f.proposedId],
    );

    if (existing.rows.length > 0) {
      const existingId = existing.rows[0].id;
      // If the row is 'approved', we still refresh evidence + counts
      // (Factory activation in Phase 3 will consume the most recent
      // observed counts) — but admin_decision stays 'approved'.
      await client.query(
        `UPDATE nex.category_candidate
            SET business_count         = $2,
                cycle_count            = $3,
                confidence             = $4,
                evidence               = $5,
                discovered_businesses  = $6,
                proposed_cycle_run_id  = $7,
                proposed_by            = $8,
                suggested_countries    = $9,
                brain_keywords         = $10
          WHERE id = $1`,
        [
          existingId,
          f.businessCount,
          f.cycleCount,
          f.confidence,
          JSON.stringify(f.evidence),
          JSON.stringify(f.discoveredBusinesses),
          f.proposedCycleRunId,
          f.proposedBy,
          f.suggestedCountries,
          JSON.stringify(f.brainKeywords),
        ],
      );

      await client.query("COMMIT");
      return { inserted: false, updated: true, id: existingId };
    }

    // No pending/approved row exists · INSERT a new pending candidate.
    // admin_decision is INTENTIONALLY not specified — the column DEFAULT
    // is 'pending', which is the ONLY value this writer is allowed to
    // produce. This is enforced by never listing admin_decision here.
    const inserted = await client.query(
      `INSERT INTO nex.category_candidate
         (proposed_category_id, proposed_name, display_name_en,
          suggested_parent_vertical, brain_keywords, suggested_countries,
          business_count, cycle_count, confidence,
          evidence, discovered_businesses,
          proposed_by, proposed_cycle_run_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id`,
      [
        f.proposedId,
        f.proposedName,
        f.displayNameEn,
        f.suggestedParentVertical,
        JSON.stringify(f.brainKeywords),
        f.suggestedCountries,
        f.businessCount,
        f.cycleCount,
        f.confidence,
        JSON.stringify(f.evidence),
        JSON.stringify(f.discoveredBusinesses),
        f.proposedBy,
        f.proposedCycleRunId,
      ],
    );

    await client.query("COMMIT");
    return { inserted: true, updated: false, id: inserted.rows[0].id };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Convert an arbitrary category name to a kebab-case slug that passes
 *  the CHECK constraint `^[a-z][a-z0-9-]*$`. Returns empty string if
 *  no valid characters remain. */
export function toKebab(s) {
  if (typeof s !== "string") return "";
  const cleaned = s.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // Ensure it starts with a letter (leading digit would fail the CHECK).
  if (!/^[a-z]/.test(cleaned)) return "";
  return cleaned;
}

/** Human-readable label for a kebab / snake / space-separated id. */
export function humanize(s) {
  return String(s)
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

/** Seed a brain-keyword array from a raw category id.
 *  Splits kebab/underscore tokens so "coffee-cafe" → ["coffee-cafe","coffee","cafe"]. */
export function buildBrainKeywords(rawCategory) {
  const seed = String(rawCategory).toLowerCase();
  const words = seed.split(/[-_ ]+/).filter(Boolean);
  return Array.from(new Set([seed, ...words]));
}

function emptyResult(reason) {
  return { proposed: [], updated: [], skipped: [{ reason }], summary: `phase1-candidates · noop (${reason})` };
}
