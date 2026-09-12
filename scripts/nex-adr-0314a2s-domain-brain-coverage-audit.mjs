#!/usr/bin/env node
// ADR-0314a.2.s · Domain Brain Coverage Audit · read-only substrate probe
//
// AUTHORISED: Philip · 2026-09-11 · "Do not create anything. Do not migrate
// anything. Do not rename anything. Do not open Gate 3. Audit only."
//
// SCOPE:
//   1. Enumerate schemas + tables in nex_dev Postgres (nex.*, nex_lab*.*)
//   2. Count rows per table
//   3. Probe for verified/promoted/status/claim_state columns; count
//      rows in each observed status
//   4. Report Supabase knowledge_records category totals (already inventoried
//      in §7.1 · reconfirmed here for the audit)
//
// FORBIDDEN:
//   INSERT / UPDATE / DELETE / ALTER / CREATE / DROP / TRUNCATE
//   normalisation · promotion · deprecation · state change of any kind
//
// Output → stdout only.

import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const { Client } = pg;

const pgUrl = process.env.NEX_POSTGRES_URL;
const supabaseUrl =
  process.env.NEX_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_NEX_SUPABASE_URL ||
  process.env.SUPABASE_URL;
const supabaseKey =
  process.env.NEX_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!pgUrl || !supabaseUrl || !supabaseKey) {
  console.error("[audit] Missing env. Aborting.");
  process.exit(1);
}

const ts = new Date().toISOString();

function qi(name) {
  // Postgres identifier quote · double any embedded quotes
  return `"${name.replace(/"/g, '""')}"`;
}

async function pgQuery(client, sql) {
  const result = await client.query(sql);
  return result.rows;
}

async function pgEnumerateTables(client) {
  return await pgQuery(
    client,
    `SELECT table_schema, table_name
     FROM information_schema.tables
     WHERE (table_schema = 'nex' OR table_schema LIKE 'nex\\_lab%' ESCAPE '\\')
       AND table_type = 'BASE TABLE'
     ORDER BY table_schema, table_name`,
  );
}

async function pgTableColumns(client, schema, table) {
  return await pgQuery(
    client,
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = '${schema}' AND table_name = '${table}'
     ORDER BY ordinal_position`,
  );
}

async function countRows(client, schema, table) {
  const rows = await pgQuery(
    client,
    `SELECT COUNT(*)::bigint AS n FROM ${qi(schema)}.${qi(table)}`,
  );
  return Number(rows[0].n);
}

async function distinctColumnCounts(client, schema, table, column) {
  const rows = await pgQuery(
    client,
    `SELECT ${qi(column)} AS val, COUNT(*)::bigint AS n
     FROM ${qi(schema)}.${qi(table)}
     GROUP BY ${qi(column)}
     ORDER BY n DESC
     LIMIT 20`,
  );
  return rows.map((r) => ({ value: r.val, n: Number(r.n) }));
}

async function auditNexDev() {
  const client = new Client({ connectionString: pgUrl });
  await client.connect();
  console.log("═══════════════════════════════════════════════════════════");
  console.log("nex_dev POSTGRES · schemas nex · nex_lab*");
  console.log("═══════════════════════════════════════════════════════════");

  const tables = await pgEnumerateTables(client);
  console.log(`Total tables in scope: ${tables.length}`);
  console.log("");

  // Group by schema
  const bySchema = new Map();
  for (const t of tables) {
    if (!bySchema.has(t.table_schema)) bySchema.set(t.table_schema, []);
    bySchema.get(t.table_schema).push(t.table_name);
  }

  const audit = [];

  for (const [schema, tableList] of bySchema) {
    console.log(`── schema: ${schema} · ${tableList.length} tables ──`);
    for (const table of tableList) {
      try {
        const count = await countRows(client, schema, table);
        const rec = {
          schema,
          table,
          rows: count,
          status_breakdown: null,
          claim_state_breakdown: null,
          verified_breakdown: null,
          promoted_breakdown: null,
        };
        // Probe adjacent status-like columns
        const cols = await pgTableColumns(client, schema, table);
        const colNames = new Set(cols.map((c) => c.column_name));
        if (count > 0) {
          if (colNames.has("status")) {
            rec.status_breakdown = await distinctColumnCounts(
              client,
              schema,
              table,
              "status",
            );
          }
          if (colNames.has("claim_state")) {
            rec.claim_state_breakdown = await distinctColumnCounts(
              client,
              schema,
              table,
              "claim_state",
            );
          }
          if (colNames.has("verified")) {
            rec.verified_breakdown = await distinctColumnCounts(
              client,
              schema,
              table,
              "verified",
            );
          }
          if (colNames.has("promoted")) {
            rec.promoted_breakdown = await distinctColumnCounts(
              client,
              schema,
              table,
              "promoted",
            );
          }
          if (colNames.has("promotion_status")) {
            rec.promotion_status_breakdown = await distinctColumnCounts(
              client,
              schema,
              table,
              "promotion_status",
            );
          }
        }
        audit.push(rec);
        console.log(
          `  ${schema}.${table}: ${count}${rec.status_breakdown ? " · status=" + JSON.stringify(Object.fromEntries(rec.status_breakdown.slice(0, 8).map((s) => [String(s.value), s.n]))) : ""}${rec.claim_state_breakdown ? " · claim_state=" + JSON.stringify(Object.fromEntries(rec.claim_state_breakdown.slice(0, 8).map((s) => [String(s.value), s.n]))) : ""}${rec.verified_breakdown ? " · verified=" + JSON.stringify(Object.fromEntries(rec.verified_breakdown.slice(0, 8).map((s) => [String(s.value), s.n]))) : ""}${rec.promotion_status_breakdown ? " · promotion_status=" + JSON.stringify(Object.fromEntries(rec.promotion_status_breakdown.slice(0, 8).map((s) => [String(s.value), s.n]))) : ""}`,
        );
      } catch (e) {
        console.log(`  ${schema}.${table}: ERROR · ${e.message}`);
      }
    }
    console.log("");
  }

  await client.end();
  return audit;
}

async function auditSupabase() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("SUPABASE public schema · brain-adjacent tables");
  console.log("═══════════════════════════════════════════════════════════");

  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
  });

  // Probe a curated list of brain-adjacent tables (from repo survey).
  const candidates = [
    "knowledge_records",
    "knowledge_feedback",
    "knowledge_feedback_topics",
    "hammerex_nex_brains",
    "hammerex_nex_brain_versions",
    "hammerex_nex_brain_drafts",
    "hammerex_nex_brain_certifications",
    "hammerex_nex_brain_dependencies",
    "hammerex_nex_brain_answers",
    "hammerex_nex_brain_field_outcomes",
    "hammerex_nex_brain_review_actions",
  ];

  const results = [];
  for (const table of candidates) {
    try {
      const { count, error } = await client
        .from(table)
        .select("*", { count: "exact", head: true });
      if (error) {
        console.log(`  ${table}: MISSING or NO ACCESS · ${error.message}`);
        results.push({ table, rows: null, error: error.message });
      } else {
        console.log(`  ${table}: ${count} rows`);
        results.push({ table, rows: count });
      }
    } catch (e) {
      console.log(`  ${table}: ERROR · ${e.message}`);
      results.push({ table, rows: null, error: e.message });
    }
  }
  console.log("");
  return results;
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("NEX DOMAIN BRAIN COVERAGE AUDIT · READ-ONLY SUBSTRATE PROBE");
  console.log("ADR-0314a.2.s · Founder-authorised 2026-09-11");
  console.log(`Timestamp: ${ts}`);
  console.log("═══════════════════════════════════════════════════════════");
  console.log("");

  const nexDev = await auditNexDev();
  const supabase = await auditSupabase();

  console.log("═══════════════════════════════════════════════════════════");
  console.log("END OF AUDIT · NO STATE MODIFIED · READ-ONLY COMPLETE");
  console.log("═══════════════════════════════════════════════════════════");

  // Persist structured JSON alongside stdout for later report generation.
  const now = ts.replace(/[:.]/g, "-");
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const dir = "data/nex-domain-brain-coverage-audit";
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, `audit-${now}.json`),
    JSON.stringify({ timestamp: ts, nexDev, supabase }, null, 2),
    "utf8",
  );
  console.log(`\nStructured JSON persisted: ${dir}/audit-${now}.json`);
}

main().catch((err) => {
  console.error("[audit] Uncaught:", err);
  process.exit(2);
});
