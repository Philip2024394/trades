// NEX App Builder · Supabase-admin quarantine audit (Philip 2026-08-14).
//
// Scans the codebase for `supabaseAdmin.from('<tenant-table>')` calls
// that are NOT explicitly annotated with a security justification.
//
// Runs in CI-style — exit 0 = clean, exit 1 = un-annotated tenant writes found.
//
// A legitimate `supabaseAdmin` use must include the sentinel comment
// on the line immediately above OR on the same line:
//   // NEX_ADMIN_OK: <reason> (e.g. "bootstrap: edit_token → merchant lookup")
//
// The list of TENANT TABLES that require merchant scoping lives in
// TENANT_TABLES below. As we migrate more tables to RLS + scoped client,
// add them here so the audit widens with the security boundary.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const TENANT_TABLES = [
  "studio_layouts",
  // Add more as they're migrated onto scoped-client + RLS:
  // "studio_brands", "studio_pages", ...
];

const ROOTS = ["src", "scripts"];
const SKIP_DIRS = new Set(["node_modules", ".next", ".vercel", "dist", "tmp-audit", "tmp"]);
const SENTINEL = /NEX_ADMIN_OK\s*:\s*.{5,}/i;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mts|mjs|js)$/.test(entry)) out.push(full);
  }
  return out;
}

const files = ROOTS.flatMap((r) => {
  try { return walk(r); } catch { return []; }
});

let violations = 0;
for (const file of files) {
  // Skip the audit script itself + the scoped client + the runtime types
  if (file.includes("audit-supabase-admin.mjs")) continue;
  if (file.endsWith("scopedClient.ts")) continue;

  let src;
  try { src = readFileSync(file, "utf8"); } catch { continue; }
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match .from('studio_layouts') or .from("studio_layouts")
    for (const table of TENANT_TABLES) {
      const re = new RegExp(`\\.from\\(['\"]${table}['\"]\\)`);
      if (!re.test(line)) continue;
      // Only flag if the line is a supabaseAdmin caller (or via clearly-privileged chain)
      const isAdmin = /supabaseAdmin/.test(line) ||
        (i > 0 && /supabaseAdmin/.test(lines[i - 1])) ||
        (i > 1 && /supabaseAdmin/.test(lines[i - 2]));
      if (!isAdmin) continue;
      // Check for sentinel annotation on this line or up to 3 lines above
      const scope = lines.slice(Math.max(0, i - 3), i + 1).join("\n");
      if (SENTINEL.test(scope)) continue;
      console.error(
        `VIOLATION: ${file}:${i + 1}  supabaseAdmin.from('${table}') without NEX_ADMIN_OK annotation`
      );
      console.error(`  line: ${line.trim().slice(0, 120)}`);
      violations++;
    }
  }
}

if (violations > 0) {
  console.error("");
  console.error(`FAIL: ${violations} un-annotated tenant-table admin call(s) found.`);
  console.error(`Every legitimate supabaseAdmin.from('<tenant>') must be preceded by`);
  console.error(`  // NEX_ADMIN_OK: <reason (5+ chars)>`);
  console.error(`or replaced with scopedStudioClient(session).from('<tenant>').`);
  process.exit(1);
}

console.log(`OK: 0 un-annotated tenant-table admin calls in ${files.length} scanned files.`);
console.log(`Watched tables: ${TENANT_TABLES.join(", ")}`);
