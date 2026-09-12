#!/usr/bin/env node
// scripts/nex-lab-data-audit.mjs
//
// Founder 2026-09-10 · Lab Data Audit.
//
// Answers "where is all the data we had before?" by producing a table
// of every dataset in NEX storage with REAL row counts, REAL last-update
// timestamps, and whether the Lab currently exposes it.
//
// Zero fabrication. Zero UI redesign. Just facts.
//
// Output:
//   1. Console table (human-readable)
//   2. Markdown report at reports/lab-data-audit-<ISO>.md
//   3. JSON snapshot at data/nex-lab/audits/<ISO>.json

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const REPORTS_DIR = join(REPO_ROOT, "reports");
const AUDIT_DIR = join(REPO_ROOT, "data", "nex-lab", "audits");

function log(...args) { console.log(...args); }

function readPgUrl() {
  try {
    const env = readFileSync(join(REPO_ROOT, ".env.local"), "utf8");
    const m = env.match(/^NEX_TAXONOMY_POSTGRES_URL\s*=\s*(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch { /* fall through */ }
  return "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

// ─── Grep UI routes to see which tables are exposed ────────────────
// We look under src/app/nexapp for any file that references a table
// name. This is a heuristic · we mark "exposed=true" only if there's a
// direct mention (either in an API call path or a Postgres query).
function isTableExposed(schema, table) {
  const searchPattern = `${schema}.${table}`;
  const apiPath = `/api/nex/lab/`;
  try {
    // Use ripgrep-style search via node fs
    const paths = [
      join(REPO_ROOT, "src", "app", "nexapp"),
      join(REPO_ROOT, "src", "app", "api", "nex", "lab"),
      join(REPO_ROOT, "src", "app", "api", "nex", "hq"),
      join(REPO_ROOT, "src", "app", "api", "nex", "founder-window"),
      join(REPO_ROOT, "src", "app", "api", "nex", "marketing"),
    ];
    for (const p of paths) {
      if (!existsSync(p)) continue;
      const r = spawnSync("findstr", ["/S", "/M", searchPattern, `${p}\\*`], { encoding: "utf8", windowsHide: true });
      if (r.stdout && r.stdout.trim().length > 0) return { exposed: true, hits: r.stdout.trim().split("\n").length };
    }
    return { exposed: false, hits: 0 };
  } catch { return { exposed: null, hits: 0 }; }
}

// ─── Infer source from table + column names ────────────────────────
function inferSource(schema, table, columns) {
  const colNames = new Set(columns);
  const t = table.toLowerCase();
  const s = schema.toLowerCase();
  const hints = [];
  if (s.startsWith("nex_lab_")) hints.push("Lab room (crawler/harvester)");
  if (s === "nex_lab") hints.push("Lab shared (rooms/promotions/growth)");
  if (s === "nex_crawler") hints.push("Universal directory crawler");
  if (s === "nex" && (t.includes("food_business") || t.includes("accommodation_business") || t.includes("service_business")))
    hints.push("Wave 11 · promoted from Lab OR direct import");
  if (s === "nex" && t.includes("marketing_")) hints.push("ADR-0307 · Marketing DB");
  if (s === "nex" && t.includes("founder_window")) hints.push("Founder's Window telemetry");
  if (s === "nex" && (t === "events" || t === "audit_log" || t.endsWith("_events") || t.endsWith("_audit"))) hints.push("Immutable event log");
  if (s === "nex" && (t === "moderation_event" || t === "action_audit" || t === "turn_latency_event")) hints.push("Chat pipeline instrumentation");
  if (s === "nex" && (t === "fact_conflict" || t === "fact_lifecycle_event" || t === "retrieval_hit")) hints.push("Truth Engine");
  if (s === "nex" && (t === "voice_transcript" || t === "voice_synthesis")) hints.push("Voice subsystem (ADR)");
  if (s === "nex" && (t === "code_execution" || t === "file_extraction")) hints.push("Programmer/OCR subsystem");
  if (s === "nex" && t === "object_blobs") hints.push("Object storage backend");
  if (s === "public" && t.startsWith("hammerex_nex_")) hints.push("Legacy Hammerex-shared table");
  if (colNames.has("payload") && colNames.has("dedupe_hash")) hints.push("raw ingestion (harvest_raw pattern)");
  if (colNames.has("subject_ref") && colNames.has("field_value")) hints.push("verified (multi-source facts)");
  if (colNames.has("promotion_id")) hints.push("promotion pipeline");
  return hints.length ? hints.join(" · ") : "(inspect columns)";
}

// ─── Find best timestamp column for "last update" ──────────────────
const TIMESTAMP_CANDIDATES = [
  "updated_at", "last_verified_at", "harvested_at", "emitted_at", "sent_at",
  "extracted_at", "discovered_at", "fetched_at", "created_at", "observed_at",
  "recorded_at", "retrieved_at", "last_computed_at", "proposed_at_iso",
  "approved_at", "delivered_at", "received_at"
];

async function main() {
  if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });
  if (!existsSync(AUDIT_DIR)) mkdirSync(AUDIT_DIR, { recursive: true });

  const { Client } = await import("pg");
  const c = new Client({ connectionString: readPgUrl(), connectionTimeoutMillis: 8000 });
  let internetOk = false;
  try {
    const r = await fetch("https://1.1.1.1/cdn-cgi/trace", { signal: AbortSignal.timeout(4000) });
    internetOk = r.ok;
  } catch { /* offline */ }

  log("\n═════════════════════════════════════════════════════════════════");
  log("  LAB DATA AUDIT · 2026-09-10 · REAL COUNTS · ZERO FABRICATION");
  log("═════════════════════════════════════════════════════════════════");
  log(`  Internet: ${internetOk ? "ONLINE (1.1.1.1 reachable)" : "OFFLINE (say so)"}`);

  try { await c.connect(); }
  catch (err) {
    log(`  Postgres: OFFLINE — ${String(err).slice(0, 200)}`);
    log("  cannot audit while Postgres is unreachable · aborting");
    process.exit(2);
  }
  log("  Postgres: ONLINE\n");

  // Enumerate all tables across our schemas
  const schemas = await c.query(`
    SELECT DISTINCT table_schema FROM information_schema.tables
    WHERE table_schema LIKE 'nex%' OR table_schema = 'public' AND table_schema NOT IN ('information_schema','pg_catalog')
    ORDER BY table_schema
  `);
  const targetSchemas = schemas.rows.map(r => r.table_schema)
    .filter(s => s.startsWith("nex") || s === "public");

  log(`  Scanning ${targetSchemas.length} schemas: ${targetSchemas.join(", ")}\n`);

  const results = [];
  for (const schema of targetSchemas) {
    const tables = (await c.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = $1 AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
      [schema]
    )).rows;
    for (const { table_name } of tables) {
      // Skip Hammerex non-nex tables that would flood the report
      if (schema === "public" && !table_name.startsWith("hammerex_nex_")) continue;

      // Get column list
      const cols = (await c.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema=$1 AND table_name=$2
         ORDER BY ordinal_position`,
        [schema, table_name]
      )).rows.map(r => r.column_name);

      // Row count
      let rowCount = null;
      try {
        const rc = await c.query(`SELECT count(*)::bigint AS c FROM "${schema}"."${table_name}"`);
        rowCount = Number(rc.rows[0].c);
      } catch (err) { rowCount = `error: ${String(err).slice(0, 80)}`; }

      // Best timestamp
      let lastUpdate = null;
      const tsCol = TIMESTAMP_CANDIDATES.find(c => cols.includes(c));
      if (tsCol && typeof rowCount === "number" && rowCount > 0) {
        try {
          const r = await c.query(`SELECT max("${tsCol}") AS ts FROM "${schema}"."${table_name}"`);
          lastUpdate = r.rows[0].ts ? new Date(r.rows[0].ts).toISOString() : null;
        } catch { /* ignore */ }
      }

      // UI exposure check
      const exposure = isTableExposed(schema, table_name);
      const source = inferSource(schema, table_name, cols);
      results.push({
        schema, table: table_name,
        row_count: rowCount,
        last_update: lastUpdate,
        ts_column: tsCol ?? null,
        source_hint: source,
        lab_exposed: exposure.exposed,
        exposure_hits: exposure.hits,
        column_count: cols.length,
      });
    }
  }

  await c.end();

  // ─── Format output ───────────────────────────────────────────
  const populated = results.filter(r => typeof r.row_count === "number" && r.row_count > 0);
  const empty = results.filter(r => typeof r.row_count === "number" && r.row_count === 0);
  const errored = results.filter(r => typeof r.row_count === "string");
  const exposed = populated.filter(r => r.lab_exposed === true);
  const notExposed = populated.filter(r => r.lab_exposed === false);

  log("═════════════════════════════════════════════════════════════════");
  log("  SUMMARY");
  log("═════════════════════════════════════════════════════════════════");
  log(`  Total tables scanned:   ${results.length}`);
  log(`  Populated (>0 rows):    ${populated.length}`);
  log(`  Empty (0 rows):         ${empty.length}`);
  log(`  Errored:                ${errored.length}`);
  log(`  Exposed in Lab UI:      ${exposed.length}`);
  log(`  NOT exposed (data hidden): ${notExposed.length}`);

  log("\n═════════════════════════════════════════════════════════════════");
  log("  TOP 30 POPULATED TABLES · by row count");
  log("═════════════════════════════════════════════════════════════════");
  const top = [...populated].sort((a, b) => Number(b.row_count) - Number(a.row_count)).slice(0, 30);
  log("  " + "SCHEMA.TABLE".padEnd(56) + " " + "ROWS".padStart(10) + "  LAB?  LAST UPDATE");
  log("  " + "-".repeat(56 + 12 + 6 + 22));
  for (const r of top) {
    const key = `${r.schema}.${r.table}`.slice(0, 55).padEnd(56);
    const rows = String(Number(r.row_count).toLocaleString()).padStart(10);
    const labFlag = r.lab_exposed === true ? "  ✓ " : r.lab_exposed === false ? "  ✗ " : "  ? ";
    const upd = r.last_update ? r.last_update.slice(0, 19).replace("T", " ") : "-";
    log(`  ${key} ${rows}  ${labFlag} ${upd}`);
  }

  log("\n═════════════════════════════════════════════════════════════════");
  log("  DATA THAT EXISTS BUT LAB DOES NOT EXPOSE (top 20)");
  log("  → answers the founder's 'where is all the data we had before?' question");
  log("═════════════════════════════════════════════════════════════════");
  const hiddenTop = [...notExposed].sort((a, b) => Number(b.row_count) - Number(a.row_count)).slice(0, 20);
  log("  " + "SCHEMA.TABLE".padEnd(56) + " " + "ROWS".padStart(10) + "  SOURCE HINT");
  for (const r of hiddenTop) {
    const key = `${r.schema}.${r.table}`.slice(0, 55).padEnd(56);
    const rows = String(Number(r.row_count).toLocaleString()).padStart(10);
    log(`  ${key} ${rows}  ${r.source_hint.slice(0, 60)}`);
  }

  log("\n═════════════════════════════════════════════════════════════════");
  log("  EMPTY TABLES (schema exists, nothing written yet) — first 20");
  log("═════════════════════════════════════════════════════════════════");
  for (const r of empty.slice(0, 20)) {
    log(`  ${r.schema}.${r.table} · ${r.source_hint.slice(0, 60)}`);
  }
  if (empty.length > 20) log(`  ... and ${empty.length - 20} more`);

  // Write markdown report
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const mdPath = join(REPORTS_DIR, `lab-data-audit-${stamp}.md`);
  const mdLines = [
    `# NEX Lab Data Audit · ${new Date().toISOString().slice(0, 10)}`,
    ``,
    `Generated by \`scripts/nex-lab-data-audit.mjs\`. Real counts from live Postgres. Zero fabrication.`,
    ``,
    `- Internet: ${internetOk ? "ONLINE" : "OFFLINE"}`,
    `- Postgres: ONLINE`,
    `- Total tables scanned: ${results.length}`,
    `- Populated: ${populated.length} · Empty: ${empty.length} · Errored: ${errored.length}`,
    `- Exposed in Lab UI: ${exposed.length} · Hidden: ${notExposed.length}`,
    ``,
    `## Every dataset`,
    ``,
    `| Schema.Table | Rows | Last Update | Lab? | Source | Cols |`,
    `|---|---:|---|:---:|---|---:|`,
  ];
  for (const r of results.sort((a, b) => {
    const av = typeof a.row_count === "number" ? a.row_count : -1;
    const bv = typeof b.row_count === "number" ? b.row_count : -1;
    return bv - av;
  })) {
    const rows = typeof r.row_count === "number" ? Number(r.row_count).toLocaleString() : `_${r.row_count}_`;
    const upd = r.last_update ? r.last_update.slice(0, 19).replace("T", " ") : "—";
    const lab = r.lab_exposed === true ? "✅" : r.lab_exposed === false ? "❌" : "?";
    mdLines.push(`| \`${r.schema}.${r.table}\` | ${rows} | ${upd} | ${lab} | ${r.source_hint} | ${r.column_count} |`);
  }
  writeFileSync(mdPath, mdLines.join("\n"), "utf8");
  log(`\n  📄 Markdown report: ${mdPath}`);

  // Write JSON snapshot
  const jsonPath = join(AUDIT_DIR, `lab-data-audit-${stamp}.json`);
  writeFileSync(jsonPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    internet_online: internetOk,
    postgres_online: true,
    summary: { total: results.length, populated: populated.length, empty: empty.length, errored: errored.length, exposed: exposed.length, hidden: notExposed.length },
    datasets: results,
  }, null, 2), "utf8");
  log(`  📄 JSON snapshot: ${jsonPath}`);
  log("");
}

main().catch((err) => { console.error("audit fatal:", err); process.exit(1); });
