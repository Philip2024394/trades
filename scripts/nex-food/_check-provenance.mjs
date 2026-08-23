import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL });
const cols = await pool.query(`
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema='nex' AND table_name='food_business_field_provenance'
  ORDER BY ordinal_position
`);
console.log("── nex.food_business_field_provenance columns ──");
for (const r of cols.rows) console.log(`  ${r.column_name.padEnd(28)}  ${r.data_type.padEnd(30)}  ${r.is_nullable==='YES'?'NULL':'NOT NULL'}`);
const cons = await pool.query(`
  SELECT conname, pg_get_constraintdef(oid) as def
  FROM pg_constraint
  WHERE conrelid = 'nex.food_business_field_provenance'::regclass
`);
console.log("── constraints ──");
for (const r of cons.rows) console.log(`  ${r.conname}  ${r.def}`);
await pool.end();