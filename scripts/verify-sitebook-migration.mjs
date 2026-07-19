// Verify the SiteBook migrations landed — list the new tables + confirm
// the homeowners.slug column exists.

const token   = process.env.SUPABASE_ACCESS_TOKEN;
const project = process.env.SUPABASE_PROJECT_REF;

async function q(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql })
  });
  const j = await res.json();
  return { ok: res.ok, rows: j };
}

const sitebookTables = await q(`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema='public'
    AND (table_name LIKE 'hammerex_sitebook%' OR table_name = 'hammerex_homeowners')
  ORDER BY table_name;
`);
console.log("SITEBOOK TABLES:");
console.log(JSON.stringify(sitebookTables.rows, null, 2));

const homeownersCols = await q(`
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='hammerex_homeowners'
    AND column_name IN ('slug','house_nickname','email','session_token')
  ORDER BY column_name;
`);
console.log("\nHOMEOWNER KEY COLUMNS:");
console.log(JSON.stringify(homeownersCols.rows, null, 2));

const yardBeaconCols = await q(`
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='hammerex_trade_off_yard_posts'
    AND column_name IN ('sitebook_project_id','sitebook_homeowner_id');
`);
console.log("\nYARD-POSTS SITEBOOK LINK COLUMNS:");
console.log(JSON.stringify(yardBeaconCols.rows, null, 2));

const storageBucket = await q(`SELECT id, name, public FROM storage.buckets WHERE id='sitebook-photos';`);
console.log("\nSTORAGE BUCKET 'sitebook-photos':");
console.log(JSON.stringify(storageBucket.rows, null, 2));

process.exit(0);
