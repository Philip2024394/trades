// src/lib/nex-mobility/pool.ts · Philip 2026-08-29
//
// Shared pg pool for the NEX Mobility server layer. Used by the extracted
// acceptOffer / completeRequest functions and by the integration tests.
//
// The pool is created lazily on first use so that non-DB code paths (e.g.,
// vitest for the pure fee module) don't open a Postgres connection.

import pg from "pg";
import { getPostgresUrl } from "@/lib/nex/config/pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getMobilityPool(): pg.Pool {
  if (!pool) {
    // Fail closed · no silent localhost fallback. In production, this also
    // rejects URLs pointing at the local dev DB (getPostgresUrl · CFG12).
    pool = new Pool({
      connectionString: getPostgresUrl(),
      max: 5,
    });
  }
  return pool;
}
