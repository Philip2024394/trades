import { readFileSync } from "node:fs";

const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const tokenMatch = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
const token = tokenMatch[1].trim();
const ref = "msdonkkechxzgagyguoe";

async function query(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.json();
}

const tables = ["hammerex_trade_off_listings", "hammerex_xrated_reviews"];
for (const t of tables) {
  console.log(`\n=== ${t} ===`);
  const rows = await query(
    `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='${t}' ORDER BY ordinal_position;`
  );
  for (const r of rows) {
    console.log(`  ${r.column_name}: ${r.data_type} ${r.is_nullable === "NO" ? "NOT NULL" : ""} ${r.column_default ? `DEFAULT ${r.column_default}` : ""}`);
  }
}

// Inspect Mike Watson row for conventions
console.log("\n=== Sample listing (Mike Watson) ===");
const sample = await query(
  "SELECT * FROM hammerex_trade_off_listings WHERE slug LIKE 'mike%' OR display_name ILIKE '%mike%' LIMIT 1;"
);
console.log(JSON.stringify(sample, null, 2).slice(0, 4000));
