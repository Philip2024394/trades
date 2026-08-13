#!/usr/bin/env node
// scripts/check-migration-declarations.mjs
//
// Wave 3 · H1.c · Static check · "code depends on migration N which isn't declared."
// Governed by: docs/headquarters-production-readiness/WAVE-3-H1-MIGRATION-HYGIENE.md
//
// PURPOSE
//   Closes gap #2 from the WORLD-CLASS-OPS gap register. Guarantees that every
//   NEX-side `INSERT ... ON CONFLICT (col_list) [WHERE predicate] DO ...`
//   references a UNIQUE index / constraint declared in
//   `deploy/postgres/init/*.sql`. Prevents recurrence of the "migration N not
//   applied but code depends on it" landmine.
//
// SAFETY
//   Pure static analysis. No DB connection. No file writes.
//
// USAGE
//   node scripts/check-migration-declarations.mjs        # non-blocking (exit 0)
//   node scripts/check-migration-declarations.mjs --strict  # blocking (exit 1 on FAIL)
//   node scripts/check-migration-declarations.mjs --json    # machine output
//
// EXIT CODES
//   0 · every site classified (accept / exempt / dynamic) OR non-strict mode
//   1 · at least one FAIL site AND --strict
//   2 · runner exception
//
// See §3-4 of WAVE-3-H1-MIGRATION-HYGIENE.md for the failure mode + exception matrix.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const INIT_DIR = "deploy/postgres/init";
const SRC_ROOTS = ["src/lib/nex", "src/app/api/nex"];

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const asJson = args.includes("--json");

// ── Helpers ──────────────────────────────────────────────────────────
function walk(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try { entries = readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const p = join(cur, e.name);
      if (e.isDirectory()) { stack.push(p); continue; }
      if (!/\.(ts|tsx|mjs|mts|cts|js)$/.test(e.name)) continue;
      // E3 · exempt test files
      if (/\.test\.(ts|tsx|mjs|mts|cts|js)$/.test(e.name)) continue;
      // E7 · exempt non-NEX-Postgres adapters (Supabase / filesystem)
      if (/[\/\\](adapters|storage[\/\\]adapters)[\/\\](supabase|filesystem)\.(ts|mjs)$/.test(p)) continue;
      // E7 · exempt the pg-to-supabase-shadow file (writes to Supabase side)
      if (/pg-to-supabase-shadow\.ts$/.test(p)) continue;
      out.push(p);
    }
  }
  return out;
}

function stripLineComments(text) {
  // Strip // and /* */ comments coarsely. Safe for grep-scale detection.
  // Preserves line numbers by keeping newlines.
  const noBlock = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  const noLine = noBlock.replace(/\/\/[^\n]*/g, "");
  return noLine;
}

function normalizeCols(csv) {
  return csv
    .split(",")
    .map((c) => c.trim().replace(/^["`]|["`]$/g, "").toLowerCase())
    .filter(Boolean);
}
function colSetKey(cols) {
  return [...cols].sort().join(",");
}
function normalizeWhere(pred) {
  if (!pred) return null;
  // Strip ALL whitespace — SQL predicates are whitespace-insensitive outside
  // string literals, so `('a','b')` and `('a', 'b')` are semantically equal.
  // This may over-match if a string literal legitimately contains whitespace
  // that matters to the predicate; that case is documented in
  // WAVE-3-H1-MIGRATION-HYGIENE.md §4.5.
  return pred.trim().replace(/\s+/g, "").toLowerCase();
}

// ── Build manifest from deploy/postgres/init/*.sql ────────────────────
function buildManifest() {
  const files = readdirSync(INIT_DIR).filter((f) => f.endsWith(".sql")).sort();
  const declaredTables = new Set();       // "schema.table"
  const uniqueDecls = [];                 // { schemaTable, cols[], colSetKey, where, source }
  const namedConstraints = new Set();     // constraint name → schemaTable

  const NAMED_UNIQUE = /CONSTRAINT\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+UNIQUE\s*\(([^)]+)\)/gi;
  const TABLE_UNIQUE = /(?:^|\s|,)UNIQUE\s*\(([^)]+)\)/gi;
  const TABLE_PK     = /(?:^|\s|,)PRIMARY\s+KEY\s*\(([^)]+)\)/gi;
  const INLINE_PK    = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s+[^,()]*?PRIMARY\s+KEY/gim;
  const INLINE_UQ    = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s+[^,()]*?\bUNIQUE\b/gim;

  for (const file of files) {
    const sql = readFileSync(join(INIT_DIR, file), "utf8");

    // CREATE TABLE blocks → declared tables + inline / table-level uniques
    const tblRe = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)\s*\(([\s\S]*?)\)\s*;/gi;
    for (const m of sql.matchAll(tblRe)) {
      const rawName = m[1];
      const [schema, table] = rawName.includes(".") ? rawName.split(".") : ["public", rawName];
      const schemaTable = `${schema.toLowerCase()}.${table.toLowerCase()}`;
      declaredTables.add(schemaTable);
      const body = m[2];

      for (const c of body.matchAll(TABLE_PK)) {
        const cols = normalizeCols(c[1]);
        uniqueDecls.push({ schemaTable, cols, colSetKey: colSetKey(cols), where: null, source: `${file} · PRIMARY KEY` });
      }
      for (const c of body.matchAll(TABLE_UNIQUE)) {
        const cols = normalizeCols(c[1]);
        uniqueDecls.push({ schemaTable, cols, colSetKey: colSetKey(cols), where: null, source: `${file} · UNIQUE(...)` });
      }
      for (const c of body.matchAll(NAMED_UNIQUE)) {
        const cName = c[1].toLowerCase();
        const cols = normalizeCols(c[2]);
        uniqueDecls.push({ schemaTable, cols, colSetKey: colSetKey(cols), where: null, source: `${file} · CONSTRAINT ${cName}` });
        namedConstraints.add(`${schemaTable}::${cName}`);
      }
      for (const c of body.matchAll(INLINE_PK)) {
        const cols = normalizeCols(c[1]);
        uniqueDecls.push({ schemaTable, cols, colSetKey: colSetKey(cols), where: null, source: `${file} · inline PK` });
      }
      for (const c of body.matchAll(INLINE_UQ)) {
        // Only single-column inline UNIQUE (multi-col UNIQUE is table-level)
        const cols = normalizeCols(c[1]);
        uniqueDecls.push({ schemaTable, cols, colSetKey: colSetKey(cols), where: null, source: `${file} · inline UNIQUE` });
      }
    }

    // CREATE UNIQUE INDEX ... ON schema.table (cols) [WHERE ...]
    const uidxRe = /CREATE\s+UNIQUE\s+INDEX(?:\s+CONCURRENTLY)?(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+ON\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)\s*\(([^)]+)\)(?:\s+WHERE\s+([^;]+))?\s*;/gi;
    for (const m of sql.matchAll(uidxRe)) {
      const idxName = m[1].toLowerCase();
      const rawName = m[2];
      const [schema, table] = rawName.includes(".") ? rawName.split(".") : ["public", rawName];
      const schemaTable = `${schema.toLowerCase()}.${table.toLowerCase()}`;
      const cols = normalizeCols(m[3]);
      const where = normalizeWhere(m[4] ?? null);
      uniqueDecls.push({ schemaTable, cols, colSetKey: colSetKey(cols), where, source: `${file} · UNIQUE INDEX ${idxName}`, idxName });
    }
  }

  return { declaredTables, uniqueDecls, namedConstraints };
}

// ── Locate all backtick template literals in the file ─────────────────
// Returns [{ start, end, body }] · start/end are indices in the original text.
// Handles nested template literals inside ${...} interpolations. Skips
// escaped backticks (\`). Does not distinguish backticks in JS regexes /
// single- or double-quoted strings · false positives there would only
// widen the set of matched sites, not narrow it (and would eventually be
// caught by other rules).
function findTemplateLiterals(text) {
  const out = [];
  let i = 0;
  const N = text.length;

  function parseLiteral(openIdx) {
    let j = openIdx + 1;
    while (j < N) {
      const c = text[j];
      if (c === "\\") { j += 2; continue; }
      if (c === "`") return { start: openIdx, end: j, body: text.slice(openIdx + 1, j) };
      if (c === "$" && text[j + 1] === "{") {
        // Enter interpolation · balance braces · recurse on nested backticks
        j += 2;
        let depth = 1;
        while (j < N && depth > 0) {
          const d = text[j];
          if (d === "\\") { j += 2; continue; }
          if (d === "`") {
            const inner = parseLiteral(j);
            if (inner) { j = inner.end + 1; continue; }
            j++;
            continue;
          }
          if (d === "{") depth++;
          else if (d === "}") depth--;
          j++;
        }
        continue;
      }
      j++;
    }
    return null;
  }

  while (i < N) {
    const openIdx = text.indexOf("`", i);
    if (openIdx < 0) break;
    const lit = parseLiteral(openIdx);
    if (!lit) break;
    out.push(lit);
    i = lit.end + 1;
  }
  return out;
}

// ── Extract ON CONFLICT sites ─────────────────────────────────────────
function extractSites(text, filePath) {
  const stripped = stripLineComments(text);
  const templates = findTemplateLiterals(stripped);
  const sites = [];

  const OC = /ON\s+CONFLICT\b/gi;
  for (const t of templates) {
    // Only sites where an INSERT/MERGE INTO exists in the same template
    // literal count. Filters out ON CONFLICT tokens that appear inside JS
    // string literals like error messages.
    const body = t.body;
    // `\$\{...\}` alternate FIRST so `${table}` doesn't get sniped by the
    // identifier class matching a bare `$`.
    const tblMatch = /(?:INSERT\s+INTO|MERGE\s+INTO)\s+(\$\{[^}]+\}|[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)/gi;
    const targets = [];
    let tm;
    while ((tm = tblMatch.exec(body)) !== null) targets.push({ pos: tm.index, table: tm[1] });
    if (targets.length === 0) continue;

    for (const m of body.matchAll(OC)) {
      const idxInBody = m.index;
      const absIdx = t.start + 1 + idxInBody;
      const line = stripped.slice(0, absIdx).split(/\n/).length;

      // Nearest INSERT/MERGE INTO before this ON CONFLICT
      const priorTargets = targets.filter((x) => x.pos < idxInBody);
      if (priorTargets.length === 0) {
        sites.push({ filePath, line, kind: "orphan-on-conflict", reason: "ON CONFLICT in template literal without a preceding INSERT/MERGE INTO" });
        continue;
      }
      const target = priorTargets[priorTargets.length - 1].table;

      // Dynamic target table (e.g. `${table}`) → classify as dynamic
      if (target.includes("${")) {
        sites.push({ filePath, line, kind: "dynamic-table", targetRaw: target });
        continue;
      }
      const [schema, table] = target.includes(".") ? target.split(".") : ["public", target];
      const schemaTable = `${schema.toLowerCase()}.${table.toLowerCase()}`;

      // Slice the payload after ON CONFLICT
      const after = body.slice(idxInBody).replace(/^ON\s+CONFLICT\b/i, "").trimStart();

      const site = { filePath, line, schemaTable };
      classifyPayload(after, site);
      sites.push(site);
    }
  }
  return sites;
}

function classifyPayload(payload, site) {

  if (/^DO\b/i.test(payload)) { site.kind = "bare-do"; return; }

  const onConstraint = payload.match(/^ON\s+CONSTRAINT\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
  if (onConstraint) { site.kind = "on-constraint"; site.constraint = onConstraint[1].toLowerCase(); return; }

  const parenMatch = payload.match(/^\(([^)]+)\)(?:\s+WHERE\s+((?:[^)]|\([^)]*\))*?))?\s*DO\b/i);
  if (parenMatch) {
    const colsRaw = parenMatch[1];
    const whereRaw = parenMatch[2] ?? null;
    if (/\$\{[^}]+\}/.test(colsRaw)) { site.kind = "dynamic"; site.colsRaw = colsRaw; return; }
    const cols = normalizeCols(colsRaw);
    site.kind = "cols";
    site.cols = cols;
    site.colSetKey = colSetKey(cols);
    site.where = normalizeWhere(whereRaw);
    return;
  }

  site.kind = "unrecognized";
  site.snippet = payload.slice(0, 80);
}

// ── Verdict per site ──────────────────────────────────────────────────
function verdict(site, manifest) {
  if (site.kind === "orphan-on-conflict") return { status: "exempt", reason: "ON CONFLICT token inside a template literal without INSERT/MERGE INTO · not SQL context" };
  if (site.kind === "dynamic-table") return { status: "dynamic", reason: `dynamic target table (${site.targetRaw}) · unverifiable statically (E6)` };
  if (site.kind === "bare-do") return { status: "accept", reason: "bare ON CONFLICT DO NOTHING · uses any unique constraint (E1)" };
  if (site.kind === "unrecognized") return { status: "review", reason: `unrecognized ON CONFLICT shape · snippet=${site.snippet}` };

  // Table scope filter (E5): only fail on tables declared in deploy/postgres/init/
  if (!manifest.declaredTables.has(site.schemaTable)) {
    return { status: "exempt", reason: `table ${site.schemaTable} not declared in ${INIT_DIR} (E5 · out-of-scope)` };
  }

  if (site.kind === "dynamic") {
    return { status: "dynamic", reason: `dynamic column list (${site.colsRaw}) · unverifiable statically (E6)` };
  }

  if (site.kind === "on-constraint") {
    const key = `${site.schemaTable}::${site.constraint}`;
    if (manifest.namedConstraints.has(key)) {
      return { status: "pass", reason: `matched named CONSTRAINT ${site.constraint} on ${site.schemaTable} (E2)` };
    }
    return { status: "fail", reason: `no declared CONSTRAINT ${site.constraint} on ${site.schemaTable}` };
  }

  if (site.kind === "cols") {
    const candidates = manifest.uniqueDecls.filter((d) => d.schemaTable === site.schemaTable && d.colSetKey === site.colSetKey);
    if (candidates.length === 0) {
      return { status: "fail", reason: `no declared UNIQUE index/constraint on ${site.schemaTable}(${site.cols.join(",")})` };
    }
    // Match WHERE clause if the site has one
    if (site.where) {
      const withWhere = candidates.filter((d) => d.where && d.where === site.where);
      if (withWhere.length > 0) {
        return { status: "pass", reason: `matched partial index ${withWhere[0].source} · WHERE identical` };
      }
      const partialCandidates = candidates.filter((d) => d.where);
      if (partialCandidates.length > 0) {
        return { status: "fail", reason: `column set matches but WHERE differs · code=${site.where} · declared=${partialCandidates.map((c) => c.where).join(" | ")}` };
      }
      return { status: "fail", reason: `code has WHERE ${site.where} but no declared partial index matches` };
    }
    // No WHERE on the site — any declared uniqueness on the col set is fine (bare unique or PK)
    const bare = candidates.filter((d) => !d.where);
    if (bare.length > 0) {
      return { status: "pass", reason: `matched declaration in ${bare[0].source}` };
    }
    return { status: "fail", reason: `only partial-unique declarations found on those cols (${candidates.map((c) => c.source).join(" | ")}) · code lacks WHERE` };
  }

  return { status: "review", reason: `unhandled site kind: ${site.kind}` };
}

// ── Main ──────────────────────────────────────────────────────────────
try {
  const manifest = buildManifest();
  const sources = SRC_ROOTS.flatMap((r) => {
    try { statSync(r); } catch { return []; }
    return walk(r);
  });

  const allSites = [];
  for (const f of sources) {
    const text = readFileSync(f, "utf8");
    const sites = extractSites(text, f);
    for (const s of sites) allSites.push({ ...s, ...verdict(s, manifest) });
  }

  const buckets = { pass: [], fail: [], dynamic: [], exempt: [], accept: [], review: [] };
  for (const s of allSites) buckets[s.status].push(s);

  if (asJson) {
    console.log(JSON.stringify({
      manifest_summary: {
        declared_tables: manifest.declaredTables.size,
        unique_declarations: manifest.uniqueDecls.length,
        named_constraints: manifest.namedConstraints.size,
      },
      site_count_by_status: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])),
      failures: buckets.fail,
      review: buckets.review,
      dynamic: buckets.dynamic,
    }, null, 2));
  } else {
    console.log("── H1.c · migration-declaration static check ──");
    console.log(`  scanned      : ${sources.length} source files under ${SRC_ROOTS.join(" · ")}`);
    console.log(`  manifest     : ${manifest.declaredTables.size} declared tables · ${manifest.uniqueDecls.length} unique decls · ${manifest.namedConstraints.size} named constraints`);
    console.log(`  ON CONFLICT  : ${allSites.length} sites`);
    console.log("");
    console.log(`  pass    : ${buckets.pass.length}`);
    console.log(`  accept  : ${buckets.accept.length}  (bare DO NOTHING)`);
    console.log(`  exempt  : ${buckets.exempt.length}  (table not declared in ${INIT_DIR})`);
    console.log(`  dynamic : ${buckets.dynamic.length}  (\${...} col list · manual review)`);
    console.log(`  review  : ${buckets.review.length}  (unrecognized shape · target table not resolvable)`);
    console.log(`  FAIL    : ${buckets.fail.length}`);
    console.log("");
    if (buckets.pass.length > 0) {
      console.log("── passes ──");
      for (const s of buckets.pass) console.log(`  ✓ ${relPath(s.filePath)}:${s.line}  →  ${s.reason}`);
      console.log("");
    }
    if (buckets.dynamic.length > 0) {
      console.log("── dynamic (unverifiable · manual review) ──");
      for (const s of buckets.dynamic) console.log(`  ? ${relPath(s.filePath)}:${s.line}  →  ${s.reason}`);
      console.log("");
    }
    if (buckets.review.length > 0) {
      console.log("── review (unrecognized shape) ──");
      for (const s of buckets.review) console.log(`  ? ${relPath(s.filePath)}:${s.line}  →  ${s.reason}`);
      console.log("");
    }
    if (buckets.fail.length > 0) {
      console.log("── FAIL (undeclared dependency) ──");
      for (const s of buckets.fail) console.log(`  ✗ ${relPath(s.filePath)}:${s.line}  →  ${s.reason}`);
      console.log("");
    }
    if (buckets.exempt.length > 0) {
      console.log("── exempt ──");
      for (const s of buckets.exempt) console.log(`  · ${relPath(s.filePath)}:${s.line}  →  ${s.reason}`);
      console.log("");
    }
    if (buckets.accept.length > 0) {
      console.log("── accept (bare DO NOTHING) ──");
      for (const s of buckets.accept) console.log(`  · ${relPath(s.filePath)}:${s.line}  →  target=${s.schemaTable}`);
      console.log("");
    }
    console.log(`Verdict · ${buckets.fail.length === 0 ? "PASS" : "FAIL"} · ${strict ? "strict mode · exit " + (buckets.fail.length === 0 ? "0" : "1") : "non-strict · always exit 0"}`);
  }

  process.exit(strict && buckets.fail.length > 0 ? 1 : 0);
} catch (e) {
  console.error("[check-migration-declarations] runner exception:", e instanceof Error ? (e.stack ?? e.message) : String(e));
  process.exit(2);
}

function relPath(p) {
  return relative(process.cwd(), p).split(sep).join("/");
}
