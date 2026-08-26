// scripts/nex-worker/provider-registry.mjs
//
// NEX Provider Registry accessor · Discovery Fabric P8 · Foundation A.
// Philip 2026-08-26 · design spec at docs/nex-fabric/02-provider-abstraction-router-failure.md
//
// Doctrine anchor: project_nex_walker_production_launch_directive_2026_08_26
//
// WRITE DISCIPLINE (constitutional):
//   · Health probes are the ONLY writer to `current_health_state` and
//     `reliability_score`. There is not yet a probe in P8 · updateHealth()
//     exists here so the future probe has one canonical entry point.
//   · Walkers only READ (getProvider / listProviders / listHealthyProviders).
//   · Future router only READS.
//   · Never bypass licence, ban-evade, or defeat rate limits. This module is
//     provider-INDEPENDENT, not provider-EVASIVE.
//
// Zero side effects on read functions · deterministic · pool-agnostic (pass
// any pg.Pool-shaped { query } object · trivially mockable in tests).

const HEALTHY_STATES = new Set(["green", "yellow"]);
const ALL_STATES = new Set(["green", "yellow", "red", "circuit-open", "disabled"]);

/**
 * Fetch a single provider by id.
 * @param {{ query: Function }} pool
 * @param {string} providerId
 * @returns {Promise<object|null>} row or null
 */
export async function getProvider(pool, providerId) {
  const q = await pool.query(
    `SELECT * FROM nex.provider_registry WHERE provider_id = $1`,
    [providerId]
  );
  return q.rows[0] ?? null;
}

/**
 * List providers, optionally filtered by health state and/or a required
 * capability. Ordered by reliability_score DESC so callers get the best-known
 * provider first (useful when router is not yet in place).
 *
 * @param {{ query: Function }} pool
 * @param {object} [filter]
 * @param {string} [filter.healthState]  exact match against current_health_state
 * @param {string} [filter.capability]   must appear in capabilities[] (uses @>)
 * @returns {Promise<object[]>}
 */
export async function listProviders(pool, filter = {}) {
  const { healthState, capability } = filter;
  const clauses = [];
  const params = [];

  if (healthState) {
    if (!ALL_STATES.has(healthState)) {
      throw new Error(`listProviders: unknown healthState '${healthState}'`);
    }
    params.push(healthState);
    clauses.push(`current_health_state = $${params.length}`);
  }
  if (capability) {
    params.push([capability]);
    clauses.push(`capabilities @> $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const q = await pool.query(
    `SELECT * FROM nex.provider_registry ${where}
      ORDER BY reliability_score DESC, provider_id ASC`,
    params
  );
  return q.rows;
}

/**
 * Convenience: green + yellow only (excludes red, circuit-open, disabled).
 * Ordered by reliability_score DESC.
 *
 * @param {{ query: Function }} pool
 * @returns {Promise<object[]>}
 */
export async function listHealthyProviders(pool) {
  const q = await pool.query(
    `SELECT * FROM nex.provider_registry
      WHERE current_health_state = ANY($1::text[])
      ORDER BY reliability_score DESC, provider_id ASC`,
    [Array.from(HEALTHY_STATES)]
  );
  return q.rows;
}

/**
 * Update health + reliability. WRITER for probes only · walkers must not call.
 * Records the `source` in updated_at column (updated_at is a timestamp; source
 * itself is intentionally not persisted in P8 · a probe_sample table lands
 * later once we've earned the need).
 *
 * @param {{ query: Function }} pool
 * @param {string} providerId
 * @param {object} update
 * @param {string} [update.healthState]      one of green|yellow|red|circuit-open|disabled
 * @param {number} [update.reliabilityScore] 0..100
 * @param {string} [update.source]           free-text · currently not persisted (reserved for future probe_sample table)
 * @returns {Promise<object|null>} updated row or null if unknown providerId
 */
export async function updateHealth(pool, providerId, update = {}) {
  const { healthState, reliabilityScore, source } = update;

  if (healthState !== undefined && !ALL_STATES.has(healthState)) {
    throw new Error(`updateHealth: unknown healthState '${healthState}'`);
  }
  if (
    reliabilityScore !== undefined &&
    (typeof reliabilityScore !== "number" || reliabilityScore < 0 || reliabilityScore > 100)
  ) {
    throw new Error(`updateHealth: reliabilityScore must be 0..100, got ${reliabilityScore}`);
  }

  const sets = [];
  const params = [];
  if (healthState !== undefined) {
    params.push(healthState);
    sets.push(`current_health_state = $${params.length}`);
  }
  if (reliabilityScore !== undefined) {
    params.push(reliabilityScore);
    sets.push(`reliability_score = $${params.length}`);
  }
  sets.push(`updated_at = now()`);

  if (sets.length === 1) {
    // Only updated_at would change · treat as no-op so probes can call defensively.
    return getProvider(pool, providerId);
  }

  params.push(providerId);
  const q = await pool.query(
    `UPDATE nex.provider_registry
        SET ${sets.join(", ")}
      WHERE provider_id = $${params.length}
      RETURNING *`,
    params
  );
  // `source` is accepted for signature compatibility; not stored in P8.
  void source;
  return q.rows[0] ?? null;
}
