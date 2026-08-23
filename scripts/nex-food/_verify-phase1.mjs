#!/usr/bin/env node
// One-shot verification that Phase 1 migration landed cleanly.
// Reads nex.food_business columns + indexes + enums and prints them.
import pg from "pg";

const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });

const cols = await pool.query(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_schema='nex' AND table_name='food_business'
  ORDER BY ordinal_position
`);
console.log(`nex.food_business columns: ${cols.rowCount}`);
cols.rows.forEach((c) => console.log(`  ${c.column_name.padEnd(28)} ${c.data_type}`));

const idx = await pool.query(`
  SELECT indexname FROM pg_indexes
  WHERE schemaname='nex' AND tablename='food_business'
  ORDER BY indexname
`);
console.log(`\nindexes: ${idx.rowCount}`);
idx.rows.forEach((i) => console.log(`  ${i.indexname}`));

const enums = await pool.query(`
  SELECT typname FROM pg_type WHERE typname LIKE 'nex_food%' ORDER BY typname
`);
console.log(`\nenums: ${enums.rowCount}`);
enums.rows.forEach((e) => console.log(`  ${e.typname}`));

const count = await pool.query(`SELECT COUNT(*)::int AS n FROM nex.food_business`);
console.log(`\nrows currently in nex.food_business: ${count.rows[0].n}`);

await pool.end();
