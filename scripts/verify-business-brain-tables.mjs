import { readFileSync } from "node:fs";
const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const token = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();
const ref = "msdonkkechxzgagyguoe";

const query = `
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'business_brain_businesses','business_brains','brain_pages','brain_documents',
      'brain_products','brain_services','brain_faqs','brain_media','brain_quotes',
      'brain_conversations','brain_sync_jobs'
    )
  ORDER BY table_name;
`;

const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query })
});
const rows = await r.json();
console.log(`Found ${rows.length}/11 tables:`);
for (const row of rows) console.log(`  ✓ ${row.table_name}`);
