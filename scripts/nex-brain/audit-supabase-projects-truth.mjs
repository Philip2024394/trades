// scripts/nex-brain/audit-supabase-projects-truth.mjs
//
// Ground-truth audit: query BOTH Supabase projects and prove which one holds
// each NEX-owned table. Reports:
//   · Which project owns each table (present + row count)
//   · Any table that exists in the WRONG project (would be contamination)
//   · Any table that exists in BOTH (bad — split brain)
//   · Any table missing from both (dead migration reference)
//
// Never writes. Only SELECTs.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { join } from "node:path";

function loadDotEnv(path) {
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["'](.*)["']$/, "$1");
  }
}
loadDotEnv(join(process.cwd(), ".env.local"));

const NEX_URL    = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const NEX_KEY    = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY;
const TRADES_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const TRADES_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!NEX_URL || !NEX_KEY) { console.error("Missing NEX Supabase env"); process.exit(1); }
if (!TRADES_URL || !TRADES_KEY) { console.error("Missing trades Supabase env"); process.exit(1); }

// Mask project IDs for logs
const maskUrl = (u) => u.replace(/(https:\/\/)([a-z0-9]{6})[a-z0-9]{14}/, "$1$2**HIDDEN**");
console.log("NEX project    :", maskUrl(NEX_URL));
console.log("TRADES project :", maskUrl(TRADES_URL));
console.log("");

const nex    = createClient(NEX_URL,    NEX_KEY,    { auth: { persistSession: false } });
const trades = createClient(TRADES_URL, TRADES_KEY, { auth: { persistSession: false } });

// Tables Philip has said are NEX-owned.
const NEX_TABLES = [
  "directory_seeds",
  "nex_collection_url_queue",
  "nex_collection_fetch_errors",
  "nex_materials_hardwood_boards",
  "nex_materials_hardwood_packs",
  "nex_materials_sheets",
  "nex_materials_hardware",
  "nex_events",
  "nex_contacts",
  "nex_refacing_cases",
  "nex_reference_images",
  "nex_membership_activations",
  "nex_chat_threads",
];

// Probe: does the table exist in the project? Returns { present, rowCount, error }.
async function probe(client, table) {
  try {
    const res = await client.from(table).select("*", { count: "exact", head: true });
    if (res.error) {
      const code = (res.error).code ?? "";
      const msg = (res.error).message ?? "";
      // 42P01 = undefined_table  (Postgres)
      // PGRST205 = "Could not find the table in the schema cache"  (PostgREST)
      if (code === "42P01" || code === "PGRST205" || /does not exist|schema cache/i.test(msg)) {
        return { present: false, rowCount: null };
      }
      return { present: false, rowCount: null, error: `${code} ${msg}` };
    }
    return { present: true, rowCount: res.count ?? 0 };
  } catch (err) {
    return { present: false, rowCount: null, error: String(err) };
  }
}

console.log("Probing every NEX-owned table in BOTH projects…");
console.log("");
console.log("Table".padEnd(38) + "NEX (ijvqdv..)".padEnd(24) + "TRADES (msdonk..)");
console.log("─".repeat(90));

const results = [];
for (const t of NEX_TABLES) {
  const [nx, tr] = await Promise.all([probe(nex, t), probe(trades, t)]);
  results.push({ table: t, nex: nx, trades: tr });
  const nStr = nx.present ? `✓ ${nx.rowCount} rows` : (nx.error ? `err: ${nx.error.slice(0, 20)}` : "—");
  const tStr = tr.present ? `✗ CONTAMINATION (${tr.rowCount} rows)` : (tr.error ? `err: ${tr.error.slice(0, 20)}` : "—");
  console.log(t.padEnd(38) + nStr.padEnd(24) + tStr);
}

console.log("");
console.log("─".repeat(90));

// Verdicts
const ownedByNexOnly    = results.filter((r) => r.nex.present && !r.trades.present);
const ownedByTradesOnly = results.filter((r) => !r.nex.present && r.trades.present);
const ownedByBoth       = results.filter((r) => r.nex.present && r.trades.present);
const missingFromBoth   = results.filter((r) => !r.nex.present && !r.trades.present);

console.log(`✓ NEX-only         : ${ownedByNexOnly.length}   (correct)`);
console.log(`✗ TRADES-only      : ${ownedByTradesOnly.length}   (WRONG project holds NEX data)`);
console.log(`⚠ BOTH projects    : ${ownedByBoth.length}   (split brain — data in two places)`);
console.log(`ℹ Missing from both: ${missingFromBoth.length}   (table listed but doesn't exist yet in either project)`);

if (ownedByTradesOnly.length > 0) {
  console.log("");
  console.log("WRONG-PROJECT TABLES:");
  for (const r of ownedByTradesOnly) console.log(`  · ${r.table}  (${r.trades.rowCount} rows in TRADES project)`);
}
if (ownedByBoth.length > 0) {
  console.log("");
  console.log("SPLIT-BRAIN TABLES:");
  for (const r of ownedByBoth) console.log(`  · ${r.table}  · NEX=${r.nex.rowCount}  · TRADES=${r.trades.rowCount}`);
}
if (missingFromBoth.length > 0) {
  console.log("");
  console.log("TABLES MISSING FROM BOTH PROJECTS (probably never created · code referencing them will error):");
  for (const r of missingFromBoth) console.log(`  · ${r.table}`);
}

console.log("");
console.log("─".repeat(90));
console.log("Done.");
