// scripts/nex-hq/reconcile-check.mjs · Philip 2026-08-29.
//
// One-shot invocation of the reconciliation classifier against the live
// dev DB. Wraps `checkReconciliation` from src/lib/nex-hq/reconciliation.ts
// so the same code path is exercised whether run manually here or from a
// nightly cron. READ ONLY.
//
// Usage: node --import tsx scripts/nex-hq/reconcile-check.mjs [windowHours]
//
// Env: NEX_POSTGRES_URL

import pg from "pg";
import { checkReconciliation } from "../../src/lib/nex-hq/reconciliation.ts";

const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }

const windowHours = Number.parseInt(process.argv[2] ?? "24", 10);
const pool = new pg.Pool({ connectionString: url });

try {
  const r = await checkReconciliation(pool, { windowHours });
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.pass ? 0 : 1);
} finally {
  await pool.end();
}
