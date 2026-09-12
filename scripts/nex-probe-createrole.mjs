// Probe: can postgres (via Management API) create a login role for pg_restore?
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(__dirname, "..", ".env.tools.local"), "utf8");
const TOKEN = envText.match(/NEX_SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const REF = envText.match(/NEX_SUPABASE_PROJECT_REF=(\S+)/)[1];
const ENDPOINT = `https://api.supabase.com/v1/projects/${REF}/database/query`;
async function q(sql) {
  const r = await fetch(ENDPOINT, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }) });
  return { status: r.status, body: await r.text() };
}
console.log("Probe 1: DROP any leftover probe role");
console.log(await q("DROP ROLE IF EXISTS nex_migrate_probe;"));
console.log("\nProbe 2: CREATE ROLE with LOGIN + PASSWORD");
console.log(await q("CREATE ROLE nex_migrate_probe WITH LOGIN PASSWORD 'probe_temp_9d3f' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;"));
console.log("\nProbe 3: check role exists");
console.log(await q("SELECT rolname, rolcanlogin FROM pg_roles WHERE rolname='nex_migrate_probe';"));
console.log("\nProbe 4: cleanup");
console.log(await q("DROP ROLE nex_migrate_probe;"));
