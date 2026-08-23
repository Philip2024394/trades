// scripts/nex-factory/record-candidate-scores.mjs
//
// Directory Factory · Calibration Harness · batched score recorder.
//
// Loads candidates from nex.category_candidate (pending + approved by
// default), runs the Era 1 scorer against each, INSERTs one score row
// per candidate into nex.category_candidate_score. Never activates
// anything · never modifies category_registry or category_candidate.
//
// Score history preserved: each pass appends new rows. Latest score
// per candidate = MAX(computed_at) in the report generator.

import { scoreCandidate, loadRegistrySnapshot } from "./score-candidate.mjs";

/**
 * Record scores for a filtered set of candidates.
 *
 * @param {import('pg').Pool} pool
 * @param {{
 *   computedBy: string,          // e.g. 'scorer:era1:cycle-hook' or 'scorer:era1:manual'
 *   filter?: 'pending-only' | 'pending-and-approved' | 'all',
 * }} opts
 */
export async function recordCandidateScores(pool, opts) {
  const { computedBy, filter = "pending-and-approved" } = opts;

  const whereClause = {
    "pending-only":         `WHERE admin_decision = 'pending'`,
    "pending-and-approved": `WHERE admin_decision IN ('pending','approved')`,
    "all":                  ``,
  }[filter] ?? `WHERE admin_decision IN ('pending','approved')`;

  const candidatesRes = await pool.query(
    `SELECT id, proposed_category_id, proposed_name, display_name_en,
            suggested_parent_vertical, brain_keywords, suggested_countries,
            business_count, cycle_count, confidence,
            evidence, discovered_businesses, image_candidates,
            duplicate_of_registry_id, superseded_by_candidate_id,
            admin_decision
       FROM nex.category_candidate
       ${whereClause}
      ORDER BY created_at ASC`,
  );

  if (candidatesRes.rows.length === 0) {
    return { scored: 0, skipped: 0, summary: `phase-calib · no candidates to score` };
  }

  const registrySnapshot = await loadRegistrySnapshot(pool);

  let scored = 0;
  let skipped = 0;
  const errors = [];

  for (const candidate of candidatesRes.rows) {
    try {
      const result = await scoreCandidate({
        pool,
        candidate,
        registryIds:      registrySnapshot.registryIds,
        registryRoutes:   registrySnapshot.registryRoutes,
        registryKeywords: registrySnapshot.registryKeywords,
      });

      await pool.query(
        `INSERT INTO nex.category_candidate_score
           (candidate_id, computed_by, scorer_version,
            quality_score, safety_score, provisional_tier,
            primary_hazard, signals, quality_breakdown, safety_breakdown)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          candidate.id,
          computedBy,
          result.scorer_version,
          result.quality_score,
          result.safety_score,
          result.provisional_tier,
          result.primary_hazard,
          JSON.stringify(result.signals),
          JSON.stringify(result.quality_breakdown),
          JSON.stringify(result.safety_breakdown),
        ],
      );
      scored += 1;
    } catch (err) {
      skipped += 1;
      errors.push({ candidateId: candidate.id, error: String(err?.message ?? err) });
    }
  }

  return {
    scored,
    skipped,
    errors,
    summary: `phase-calib · scored=${scored} skipped=${skipped}`,
  };
}
