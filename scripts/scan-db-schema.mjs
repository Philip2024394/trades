#!/usr/bin/env node
// scripts/scan-db-schema.mjs
// Scans the Thenetworkers Supabase Postgres public schema and writes docs/DB_SCHEMA.md.
// Uses only Node built-ins: fs, node:fs/promises, native fetch.

import fs from "node:fs";
import { mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const ENV_FILE = path.join(ROOT, ".env.tools.local");
const OUT_DIR = path.join(ROOT, "docs");
const OUT_FILE = path.join(OUT_DIR, "DB_SCHEMA.md");

// -------- Env parser (line-by-line KEY=value, ignores comments/blank lines) --------
function loadEnv(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Env file not found: ${file}`);
  }
  const raw = fs.readFileSync(file, "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    // Strip optional surrounding quotes
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const env = loadEnv(ENV_FILE);
const TOKEN = env.SUPABASE_ACCESS_TOKEN;
const REF = env.SUPABASE_PROJECT_REF;
if (!TOKEN || !REF) {
  throw new Error(
    "Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF in .env.tools.local"
  );
}

const API = `https://api.supabase.com/v1/projects/${REF}/database/query`;

// -------- Query helper --------
async function query(sql, label) {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Query [${label}] failed: HTTP ${res.status} — ${text.slice(0, 400)}`
    );
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Query [${label}] returned non-JSON: ${text.slice(0, 200)}`
    );
  }
}

// -------- Queries --------
const Q_TABLES = `
  SELECT table_schema, table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name
`;

const Q_COLUMNS = `
  SELECT table_name, column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public'
  ORDER BY table_name, ordinal_position
`;

const Q_FKS = `
  SELECT
    tc.table_name AS from_table,
    kcu.column_name AS from_column,
    ccu.table_name AS to_table,
    ccu.column_name AS to_column
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
   AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
`;

const Q_INDEXES = `
  SELECT tablename, indexname, indexdef
  FROM pg_indexes
  WHERE schemaname = 'public'
  ORDER BY tablename, indexname
`;

// -------- Grouping --------
function groupOf(name) {
  if (name.startsWith("hammerex_")) return "hammerex";
  if (name.startsWith("app_")) return "app";
  if (name.startsWith("os_")) return "os";
  return "other";
}

const GROUP_META = {
  hammerex: {
    heading: "`hammerex_*` — Networkers core (legacy prefix)",
    order: 1,
  },
  app: { heading: "`app_*` — Per-app tables (manifest apps)", order: 2 },
  os: { heading: "`os_*` — Homeowner OS (Construction Notebook)", order: 3 },
  other: { heading: "Other", order: 4 },
};

// -------- Extract index columns from indexdef --------
function extractIndexCols(def) {
  // indexdef looks like: CREATE [UNIQUE] INDEX name ON schema.table USING method (col_a, col_b)
  const m = def.match(/\(([^)]*)\)\s*(?:WHERE .+)?$/);
  return m ? m[1].trim() : "";
}

// -------- Escape pipe chars for markdown table cells --------
function esc(s) {
  if (s === null || s === undefined || s === "") return "—";
  return String(s).replace(/\|/g, "\\|");
}

// -------- Main --------
const errors = [];

async function safeQuery(sql, label) {
  try {
    return await query(sql, label);
  } catch (e) {
    errors.push({ label, message: e.message });
    return null;
  }
}

async function main() {
  console.log(`[scan-db-schema] project ref: ${REF}`);
  console.log(`[scan-db-schema] querying tables…`);
  const tables = (await safeQuery(Q_TABLES, "tables")) || [];
  console.log(`[scan-db-schema] querying columns…`);
  const columns = (await safeQuery(Q_COLUMNS, "columns")) || [];
  console.log(`[scan-db-schema] querying foreign keys…`);
  const fks = (await safeQuery(Q_FKS, "foreign_keys")) || [];
  console.log(`[scan-db-schema] querying indexes…`);
  const indexes = (await safeQuery(Q_INDEXES, "indexes")) || [];

  // Index by table
  const columnsByTable = new Map();
  for (const c of columns) {
    if (!columnsByTable.has(c.table_name)) columnsByTable.set(c.table_name, []);
    columnsByTable.get(c.table_name).push(c);
  }

  const fksByTable = new Map();
  for (const f of fks) {
    if (!fksByTable.has(f.from_table)) fksByTable.set(f.from_table, []);
    fksByTable.get(f.from_table).push(f);
  }

  const indexesByTable = new Map();
  for (const i of indexes) {
    if (!indexesByTable.has(i.tablename)) indexesByTable.set(i.tablename, []);
    indexesByTable.get(i.tablename).push(i);
  }

  // Group tables
  const grouped = { hammerex: [], app: [], os: [], other: [] };
  for (const t of tables) {
    grouped[groupOf(t.table_name)].push(t.table_name);
  }

  const totalTables = tables.length;
  const totalCols = columns.length;
  const totalFks = fks.length;
  const totalIdx = indexes.length;

  // -------- Render Markdown --------
  const lines = [];
  lines.push("# Database Schema — Thenetworkers");
  lines.push("");
  lines.push(
    `_Auto-generated by \`scripts/scan-db-schema.mjs\` on ${new Date().toISOString()}._`
  );
  lines.push("");
  lines.push(
    `**Snapshot:** ${totalTables} tables · ${totalCols} columns · ${totalFks} foreign keys · ${totalIdx} indexes.`
  );
  lines.push("");
  lines.push("## Grouped by prefix");
  lines.push("");

  const groupKeys = Object.keys(GROUP_META).sort(
    (a, b) => GROUP_META[a].order - GROUP_META[b].order
  );
  for (const key of groupKeys) {
    const names = grouped[key].slice().sort();
    if (names.length === 0) continue;
    lines.push(`### ${GROUP_META[key].heading}`);
    for (const name of names) {
      const nCols = (columnsByTable.get(name) || []).length;
      const nFks = (fksByTable.get(name) || []).length;
      const anchor = name.toLowerCase();
      lines.push(`- [${name}](#${anchor}) — ${nCols} cols, ${nFks} FKs`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("## Tables");
  lines.push("");

  // Render tables in stable alphabetical order (matches TOC anchors)
  const tableOrder = tables
    .map((t) => t.table_name)
    .slice()
    .sort();

  for (const name of tableOrder) {
    lines.push(`### \`${name}\``);
    lines.push("");
    const cols = columnsByTable.get(name) || [];
    if (cols.length === 0) {
      lines.push("_No columns found._");
    } else {
      lines.push("| column | type | nullable | default |");
      lines.push("|---|---|---|---|");
      for (const c of cols) {
        lines.push(
          `| ${esc(c.column_name)} | ${esc(c.data_type)} | ${esc(
            c.is_nullable
          )} | ${esc(c.column_default)} |`
        );
      }
    }
    lines.push("");

    const tFks = fksByTable.get(name) || [];
    lines.push("**Foreign keys:**");
    if (tFks.length === 0) {
      lines.push("");
      lines.push("- _none_");
    } else {
      lines.push("");
      for (const f of tFks) {
        lines.push(
          `- \`${f.from_column}\` → \`${f.to_table}.${f.to_column}\``
        );
      }
    }
    lines.push("");

    const tIdx = indexesByTable.get(name) || [];
    lines.push("**Indexes:**");
    if (tIdx.length === 0) {
      lines.push("");
      lines.push("- _none_");
    } else {
      lines.push("");
      for (const i of tIdx) {
        const cols = extractIndexCols(i.indexdef);
        lines.push(`- \`${i.indexname}\` — \`(${cols})\``);
      }
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  if (errors.length > 0) {
    lines.push("## Errors encountered");
    lines.push("");
    for (const e of errors) {
      lines.push(`- **${e.label}**: ${e.message}`);
    }
    lines.push("");
  }

  await mkdir(OUT_DIR, { recursive: true });
  const output = lines.join("\n");
  await writeFile(OUT_FILE, output, "utf8");
  const st = await stat(OUT_FILE);

  console.log("");
  console.log("[scan-db-schema] Done.");
  console.log(`  tables:       ${totalTables}`);
  console.log(`  columns:      ${totalCols}`);
  console.log(`  foreign keys: ${totalFks}`);
  console.log(`  indexes:      ${totalIdx}`);
  console.log(`  output:       ${OUT_FILE}`);
  console.log(`  size (bytes): ${st.size}`);
  if (errors.length > 0) {
    console.log(`  errors:       ${errors.length}`);
    for (const e of errors) console.log(`    - ${e.label}: ${e.message}`);
  }
}

main().catch((err) => {
  console.error("[scan-db-schema] Fatal:", err);
  process.exit(1);
});
