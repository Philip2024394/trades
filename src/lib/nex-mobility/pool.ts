// src/lib/nex-mobility/pool.ts · Philip 2026-08-29
//
// Shared pg pool for the NEX Mobility server layer. Used by the extracted
// acceptOffer / completeRequest functions and by the integration tests.
//
// The pool is created lazily on first use so that non-DB code paths (e.g.,
// vitest for the pure fee module) don't open a Postgres connection.

import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getMobilityPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString:
        process.env.NEX_POSTGRES_URL ??
        "postgresql://postgres:Admin1phil@localhost:5433/nex_dev",
      max: 5,
    });
  }
  return pool;
}
