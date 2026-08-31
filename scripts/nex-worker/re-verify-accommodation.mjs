// NEX Re-Verify Worker · ACCOMMODATION · Philip 2026-08-27.
//
// Runs every 15 minutes (see scripts/nex-dev-scheduler.mjs).
// Cap 10 candidates per cycle. Reuses accommodationYogyakartaConfig's
// applyEnrichmentToExisting for the COALESCE writeback + image extraction.
// Does NOT spawn discovery cycles · does NOT touch rotation state.

import pg from "pg";
import { accommodationYogyakartaConfig } from "../nex-acquisition/configs/accommodation-yogyakarta.mjs";
import { runReVerifyCycle, RE_VERIFY_BATCH_CAP } from "./_re-verify-common.mjs";

const CONN = process.env.NEX_POSTGRES_URL;
if (!CONN) {
  console.error("[re-verify:accommodation] NEX_POSTGRES_URL not set");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: CONN });
try {
  const result = await runReVerifyCycle({
    pool,
    config: accommodationYogyakartaConfig,
    tableName: "nex.accommodation_business",
    workerType: "re_verify_accommodation",
    workerConfig: "re_verify:accommodation",
    batchSize: RE_VERIFY_BATCH_CAP,
  });
  console.log(`[re-verify:accommodation] complete`, {
    cycle_run_id: result.cycleRunId,
    duration_ms: result.durationMs,
    ...result.counters,
  });
} catch (err) {
  console.error(`[re-verify:accommodation] fatal:`, err.message);
  process.exit(1);
} finally {
  await pool.end();
}
