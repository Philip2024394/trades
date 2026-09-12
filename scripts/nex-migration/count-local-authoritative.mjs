// Authoritative SELECT COUNT for all 191 nex.* tables in LOCAL nex_dev.
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const PSQL = "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe";
const env = { ...process.env, PGPASSWORD: "Admin1phil" };
const list = spawnSync(PSQL, ["-h","localhost","-p","5433","-U","postgres","-d","nex_dev","-Atc","SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nex' AND c.relkind='r' ORDER BY c.relname"], { env, encoding: "utf8", timeout: 30000 });
const tables = list.stdout.trim().split(/\r?\n/).filter(Boolean);
console.log(`tables: ${tables.length}`);
const counts = {};
// Build a single SELECT with all counts as subqueries — fast, one round-trip
const cols = tables.map(t => `(SELECT count(*) FROM nex."${t}") AS "${t}"`).join(", ");
const cnt = spawnSync(PSQL, ["-h","localhost","-p","5433","-U","postgres","-d","nex_dev","-A","-t","-F","\t","-c",`SELECT ${cols}`], { env, encoding: "utf8", timeout: 120000, maxBuffer: 100*1024*1024 });
if (cnt.status !== 0) { console.error("failed:", cnt.stderr); process.exit(1); }
const values = cnt.stdout.trim().split("\t").map(v => Number(v));
tables.forEach((t, i) => counts[t] = values[i]);
const entries = Object.entries(counts).sort((a,b) => b[1] - a[1]);
const populated = entries.filter(([_,v]) => v > 0);
const empty = entries.filter(([_,v]) => v === 0);
const total = entries.reduce((a,[_,v]) => a+v, 0);
console.log(`populated: ${populated.length}  empty: ${empty.length}  total rows: ${total.toLocaleString()}`);
console.log("\ntop 30 by count:");
for (const [k,v] of populated.slice(0, 30)) console.log(`  ${k.padEnd(50)} ${v.toLocaleString().padStart(12)}`);
writeFileSync("scripts/nex-migration/local-authoritative-counts.json", JSON.stringify({populated, empty, total}, null, 2));
console.log("\nwritten to scripts/nex-migration/local-authoritative-counts.json");
