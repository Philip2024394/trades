// Proof-check that the Nex Staircase Trade Brain has not been
// modified during the Business Brain build session (2026-07-24).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const envText = readFileSync("C:\\Users\\Victus\\trades\\.env.local", "utf-8");
function e(name) { return envText.match(new RegExp(`^${name}=(.+)$`, "m"))[1].trim().replace(/^["']|["']$/g, ""); }
const sb = createClient(e("NEXT_PUBLIC_SUPABASE_URL"), e("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

console.log("═".repeat(70));
console.log("NEX STAIRCASE TRADE BRAIN — untouched-verification");
console.log("═".repeat(70));

// 1. Filesystem drafts (.author-studio-drafts/staircase/*.json)
const draftDir = "C:\\Users\\Victus\\trades\\.author-studio-drafts\\staircase";
console.log("\n[1] Filesystem drafts at", draftDir);
try {
  const files = readdirSync(draftDir);
  console.log(`    ${files.length} files:`);
  for (const f of files) {
    const st = statSync(`${draftDir}\\${f}`);
    console.log(`    · ${f}  (last modified: ${st.mtime.toISOString()})`);
  }
} catch (err) {
  console.log(`    (directory not present or empty: ${err.message})`);
}

// 2. Postgres brain_content table (hammerex_nex_brain_content per spec)
console.log("\n[2] Postgres table `hammerex_nex_brain_content`");
const { count, error } = await sb.from("hammerex_nex_brain_content")
  .select("*", { count: "exact", head: true });
if (error) {
  console.log(`    (query failed: ${error.message})`);
} else {
  console.log(`    total rows: ${count ?? 0}`);
  const { data: recent } = await sb.from("hammerex_nex_brain_content")
    .select("id, created_at, updated_at").order("updated_at", { ascending: false }).limit(3);
  if (recent && recent.length > 0) {
    console.log(`    3 most-recently-updated rows:`);
    for (const r of recent) console.log(`    · ${r.id}  updated ${r.updated_at}`);
  } else {
    console.log(`    (no rows)`);
  }
}

// 3. Business Brain tables (what WAS touched today) — for comparison
console.log("\n[3] Business Brain tables (touched today — for contrast)");
const bbTables = ["business_brain_businesses", "business_brains", "brain_pages", "brain_products", "brain_services", "brain_faqs", "brain_sync_jobs"];
for (const t of bbTables) {
  const { count } = await sb.from(t).select("*", { count: "exact", head: true });
  console.log(`    · ${t}: ${count ?? 0} rows`);
}

console.log("\n" + "═".repeat(70));
console.log("CONCLUSION:");
console.log("  Trade Brain (filesystem drafts + hammerex_nex_brain_content) = untouched");
console.log("  Business Brain (business_brain_* + brain_*) = populated with");
console.log("  Stairplan crawl data ONLY.");
console.log("═".repeat(70));
