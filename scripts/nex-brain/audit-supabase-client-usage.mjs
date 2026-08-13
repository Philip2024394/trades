#!/usr/bin/env node
// scripts/nex-brain/audit-supabase-client-usage.mjs
//
// Permanent guard (Philip 2026-08-13): fail the build if any file queries a
// NEX-owned Supabase table via the WRONG client. NEX tables must go through
// supabaseNexAdmin (from @/lib/supabaseNexAdmin) — never through the trades
// supabaseAdmin (@/lib/supabaseAdmin · which points at msdonk... project).
//
// Correctly recognises the common alias pattern:
//   import { supabaseNexAdmin as supabaseAdmin } from "@/lib/supabaseNexAdmin";
// which several NEX modules use so downstream code reads naturally without a
// rename. When the alias is present, the file is treated as using the NEX
// client (even though the local identifier is `supabaseAdmin`).
//
// Exit code: 0 if clean · 1 if any misrouting or cross-pollution found.
//
// Also lists NEX-client access to hammerex_*/app_* tables (cross-pollution
// in the other direction — the NEX project must not touch trades tables).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");

// Tables owned by the NEX project (ijvqdv...). Any query against these MUST
// go via supabaseNexAdmin. Keep this list in sync with new NEX migrations.
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

// Tables owned by the trades/hammerex-shared project (msdonk...). The NEX
// client must not touch these.
const TRADES_PREFIXES = ["hammerex_", "app_"];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (s.isFile() && /\.(ts|tsx)$/.test(p) && !p.includes("node_modules")) out.push(p);
  }
  return out;
}

// Detect which supabase client a file uses.
//   NEX     · imports supabaseNexAdmin (with or without an alias)
//   TRADES  · imports supabaseAdmin from @/lib/supabaseAdmin (NOT aliased from NEX)
function detectClients(src) {
  const nexAliasImport = /import\s*\{\s*supabaseNexAdmin(\s+as\s+\w+)?\s*\}\s*from\s*["']@\/lib\/supabaseNexAdmin["']/.test(src);
  const tradesImport   = /import\s*\{\s*supabaseAdmin(\s+as\s+\w+)?\s*\}\s*from\s*["']@\/lib\/supabaseAdmin["']/.test(src);
  return { importsNex: nexAliasImport, importsTrades: tradesImport };
}

function tablesReferenced(src, list) {
  return list.filter((t) => new RegExp(`from\\s*\\(\\s*["']${t}["']`).test(src));
}
function anyPrefixedTable(src, prefixes) {
  const hits = [];
  for (const p of prefixes) {
    const m = src.match(new RegExp(`from\\s*\\(\\s*["']${p}[a-z0-9_]+["']`, "g")) ?? [];
    for (const x of m) hits.push(x.match(/["']([^"']+)["']/)[1]);
  }
  return Array.from(new Set(hits));
}

const files = walk(SRC);
const report = { correct: [], misrouted: [], unclear: [], crossPollution: [] };

for (const f of files) {
  const src = readFileSync(f, "utf8");
  const { importsNex, importsTrades } = detectClients(src);
  const nexHits = tablesReferenced(src, NEX_TABLES);
  const hamHits = anyPrefixedTable(src, TRADES_PREFIXES);
  if (nexHits.length === 0 && hamHits.length === 0) continue;

  const shortPath = f.replace(process.cwd() + "\\", "").replace(process.cwd() + "/", "");

  if (nexHits.length > 0) {
    if (importsNex && !importsTrades)      report.correct.push({ file: shortPath, tables: nexHits });
    else if (!importsNex && importsTrades) report.misrouted.push({ file: shortPath, tables: nexHits });
    else if (importsNex && importsTrades)  report.unclear.push({ file: shortPath, tables: nexHits, note: "imports BOTH clients · verify which one queries the NEX table" });
    else                                    report.unclear.push({ file: shortPath, tables: nexHits, note: "imports NEITHER client directly · likely goes via a helper · verify manually" });
  }

  if (hamHits.length > 0 && importsNex && !importsTrades) {
    report.crossPollution.push({ file: shortPath, tables: hamHits });
  }
}

function print(section, items, symbol) {
  console.log("");
  console.log(`${symbol} ${section}  (${items.length})`);
  console.log("─".repeat(72));
  if (items.length === 0) { console.log("  (none)"); return; }
  for (const it of items) {
    console.log(`  ${it.file}`);
    if (it.tables) console.log(`    tables: ${it.tables.join(", ")}`);
    if (it.note)   console.log(`    note:   ${it.note}`);
  }
}

console.log("=".repeat(72));
console.log("NEX SUPABASE CLIENT ROUTING AUDIT");
console.log("=".repeat(72));
console.log(`Scanned ${files.length} .ts/.tsx files under src/`);
console.log("Rule: NEX-owned tables MUST use supabaseNexAdmin. Trades tables MUST NOT use the NEX client.");
print("CORRECT (NEX table + NEX client)",                    report.correct,        "✓");
print("MISROUTED (NEX table + TRADES client · BUG)",         report.misrouted,      "✗");
print("UNCLEAR (needs manual review)",                        report.unclear,        "?");
print("CROSS-POLLUTION (NEX client touching trades table)",  report.crossPollution, "!");

console.log("");
console.log("=".repeat(72));
console.log(`Summary: correct=${report.correct.length} · misrouted=${report.misrouted.length} · unclear=${report.unclear.length} · cross_pollution=${report.crossPollution.length}`);
console.log("=".repeat(72));

// Build-time exit code: fail on real bugs (misrouted or cross-pollution).
// "unclear" is a warning only — human should review but the build proceeds.
if (report.misrouted.length > 0 || report.crossPollution.length > 0) {
  console.error("");
  console.error("✗ Build guard FAILED — one or more files misroute NEX table access.");
  console.error("  Fix each misrouted file to import { supabaseNexAdmin as supabaseAdmin } from \"@/lib/supabaseNexAdmin\";");
  process.exit(1);
}
process.exit(0);
