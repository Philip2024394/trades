// scripts/nex-discovery-rotation/_provider-refresh.mjs
//
// Provider Refresh helper · Philip 2026-08-26 P3 addition.
//
// Sets cooldown_until = NOW() on matching saturated rotation-state rows so
// they become IMMEDIATELY eligible for reactivation on the next rotation-tick.
//
// CRITICAL constraint (Philip 2026-08-26):
//   "refresh makes a surface eligible; it does NOT force-spawn a walker.
//    The Rotation Controller should still control the rate at which they
//    are actually picked."
//
// So this helper NEVER touches the orchestrator, NEVER spawns a walker.
// It only manipulates rotation state · the Rotation Controller (via
// _rotation-tick + _orchestrator-tick) picks up the change on its own cadence.
//
// Usage:
//   refreshProvider(pool, { category: 'market', surface: 'nominatim', reason: 'overpass-fallback-v1' })
//   → all saturated market:nominatim rows get cooldown_until = NOW,
//     reactivation_reason = 'provider-refresh:overpass-fallback-v1'
//
// Returns the number of rows affected · does NOT wait for the tick.

/**
 * Refresh eligibility for saturated surfaces matching a filter.
 * @param {import('pg').Pool} pool
 * @param {object} filter
 * @param {string} filter.reason        e.g. 'overpass-fallback-v1' · appended to reactivation_reason
 * @param {string} [filter.category]    optional filter (food/accommodation/market/transport)
 * @param {string} [filter.surface]     optional filter (e.g. 'nominatim')
 * @param {string} [filter.city]        optional filter (e.g. 'Yogyakarta')
 * @returns {Promise<{updated: number, rows: Array<{city:string,category:string,surface:string}>}>}
 */
export async function refreshProvider(pool, { reason, category, surface, city } = {}) {
  if (!reason || typeof reason !== "string") {
    throw new Error("refreshProvider requires a non-empty reason string");
  }
  const conditions = ["state = 'saturated'"];
  const values = [`provider-refresh:${reason}`];
  let idx = 2;
  if (category) { conditions.push(`category = $${idx++}`); values.push(category); }
  if (surface)  { conditions.push(`surface  = $${idx++}`); values.push(surface); }
  if (city)     { conditions.push(`city     = $${idx++}`); values.push(city); }

  const q = await pool.query(
    `UPDATE nex.discovery_rotation_state
        SET cooldown_until = NOW(),
            reactivation_reason = $1
      WHERE ${conditions.join(" AND ")}
      RETURNING city, category, surface`,
    values
  );
  return { updated: q.rowCount, rows: q.rows };
}
