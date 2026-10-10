import pg from "pg";
const c = new pg.Client({ connectionString: process.env.NEX_POSTGRES_URL });
await c.connect();
const q = async (s) => (await c.query(s)).rows;

console.log("=== baseline counts ===");
for (const [label, sql] of [
  ["canonical", "SELECT COUNT(*)::int AS n FROM nex.business_canonical"],
  ["directory_v", "SELECT COUNT(*)::int AS n FROM nex.business_directory_v"],
  ["evidence", "SELECT COUNT(*)::int AS n FROM nex.business_evidence"],
  ["lifecycle_log", "SELECT COUNT(*)::int AS n FROM nex.business_canonical_lifecycle_log"],
  ["food_eligible", `SELECT COUNT(*)::int AS n FROM nex.food_business WHERE country='ID' AND business_name IS NOT NULL AND length(trim(business_name))>0 AND city IS NOT NULL AND coordinates_lat IS NOT NULL AND coordinates_lng IS NOT NULL AND canonical_business_id IS NULL AND source_reference ~ '^(node|way|relation)/[0-9]+$'`],
]) {
  const r = await q(sql);
  console.log(label + ":", r[0].n);
}

console.log("\n=== business_evidence columns ===");
const cols = await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='nex' AND table_name='business_evidence' ORDER BY ordinal_position`);
for (const row of cols) console.log("  ", row.column_name, row.data_type);

console.log("\n=== lifecycle_log columns ===");
const cols2 = await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='nex' AND table_name='business_canonical_lifecycle_log' ORDER BY ordinal_position`);
for (const row of cols2) console.log("  ", row.column_name, row.data_type);

await c.end();
