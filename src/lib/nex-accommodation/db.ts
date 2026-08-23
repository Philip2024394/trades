// src/lib/nex-accommodation/db.ts
//
// Task #89 Phase B (2026-08-22) · accommodation DB pool.
// Reuses the same shared Postgres pool as Food (nex_dev). Same connection
// string · same runtime · zero new infra. Kept as its own module so
// accommodation code doesn't reach into nex-food/ (isolation per Philip's
// "each vertical has its own data" rule while still sharing physical DB).

import { getFoodDbPool } from "@/lib/nex-food/db";

// Same pool · same Postgres · isolation is at the query/table level, not connection level.
export function getAccommodationDbPool() {
  return getFoodDbPool();
}
