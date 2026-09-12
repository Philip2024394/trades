import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(__dirname, "..", ".env.tools.local"), "utf8");
const TOKEN = envText.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF = envText.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];
const MGMT = `https://api.supabase.com/v1/projects/${REF}/database/query`;
async function q(sql) {
  const r = await fetch(MGMT, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }) });
  return { status: r.status, body: await r.text() };
}
const listRes = await q("SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' ORDER BY c.relname");
const tables = JSON.parse(listRes.body).map(r => r.relname);
console.log(`total tables: ${tables.length}`);
const allCounts = {};
const chunkSize = 30;
for (let i = 0; i < tables.length; i += chunkSize) {
  const chunk = tables.slice(i, i + chunkSize);
  const cols = chunk.map(n => `(SELECT count(*) FROM nex."${n}") AS "${n}"`).join(", ");
  const r = await q(`SELECT ${cols}`);
  if (r.status >= 400) { console.log(`chunk ${i} error:`, r.body.slice(0, 200)); continue; }
  const row = JSON.parse(r.body)[0];
  Object.assign(allCounts, row);
  process.stderr.write(".");
}
process.stderr.write("\n");
const entries = Object.entries(allCounts).map(([k, v]) => [k, Number(v)]).sort((a, b) => b[1] - a[1]);
const populated = entries.filter(([k, v]) => v > 0);
const empty = entries.filter(([k, v]) => v === 0);
const totalRows = entries.reduce((a, [k, v]) => a + v, 0);
console.log(`\npopulated tables: ${populated.length}`);
console.log(`empty tables:     ${empty.length}`);
console.log(`total rows:       ${totalRows.toLocaleString()}`);
console.log(`\npopulated tables (rows > 0):`);
for (const [k, v] of populated) console.log(`  ${k.padEnd(52)} ${v.toLocaleString().padStart(12)}`);
console.log(`\nempty tables (${empty.length} total):`);
for (const [k, v] of empty) console.log(`  ${k}`);
writeFileSync(resolve(__dirname, "nex-migration", "authoritative-nex-row-counts.json"), JSON.stringify({ populated, empty, totalRows }, null, 2));
