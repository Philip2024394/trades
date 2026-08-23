// Verify the 4 new SQL queries added to /admin/(authed)/nex/food-hq
// return sensible shapes so the HQ tile renders correctly.

import pg from "pg";
const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });

console.log("── HQ Push/Pull tile · data source verification ──");
console.log("");

const universe = await pool.query(`SELECT * FROM nex.food_universe_ratio`);
console.log("1. nex.food_universe_ratio:");
console.log("   ", universe.rows[0]);
console.log("");

const pending = await pool.query(`SELECT count(*)::int AS n FROM nex.food_pending_self_service_claims`);
console.log(`2. pending self-service claims: ${pending.rows[0].n}`);
console.log("");

const v24 = await pool.query(`
  SELECT count(*)::int AS n FROM nex.food_claim_code
  WHERE consumed_at IS NOT NULL
    AND consumed_at > now() - interval '24 hours'
    AND entry_path IN ('self_service_claim', 'self_service_register')
`);
console.log(`3. verified via self-service · last 24h: ${v24.rows[0].n}`);

const v7d = await pool.query(`
  SELECT count(*)::int AS n FROM nex.food_claim_code
  WHERE consumed_at IS NOT NULL
    AND consumed_at > now() - interval '7 days'
    AND entry_path IN ('self_service_claim', 'self_service_register')
`);
console.log(`4. verified via self-service · last 7d: ${v7d.rows[0].n}`);
console.log("");

console.log("── HQ tile will render ──");
console.log(`  Discovery Universe: ${universe.rows[0].discovery_universe}`);
console.log(`  Commercial Universe: ${universe.rows[0].commercial_universe}`);
console.log(`  Ratio: ${(Number(universe.rows[0].commercial_ratio) * 100).toFixed(1)}%`);
console.log(`  Pending self-service claims: ${pending.rows[0].n}`);
console.log(`  Verified 24h: ${v24.rows[0].n}`);
console.log(`  Verified 7d: ${v7d.rows[0].n}`);

await pool.end();
