#!/usr/bin/env node
// scripts/postgres-sql-explain-audit.mjs
//
// Founder BEGIN 2026-09-09 · POSTGRES-SQL-EXPLAIN-AUDIT
//
// DIAGNOSTIC ONLY · zero optimization applied · zero hiding tricks.
//
// Reconstructs the EXACT SQL the food + accommodation adapters fire
// (per src/lib/nex/brain/world-adapters/{food,accommodation}-postgres.ts)
// and captures:
//   - EXPLAIN (ANALYZE, BUFFERS) for count + rows
//   - Existing indexes on both tables
//   - Table statistics (n_live_tup, n_dead_tup, last_vacuum, last_analyze)
//   - N=50 latency sweep to look for the historical 11.6-second tail spike
//
// The Founder wants the answer to:
//   Why does food breakfast spike to 1.2-1.4s (once observed 11.6s)
//   while accommodation Malioboro stays at ~277ms?
//
// Zero writes. Zero optimization. Zero LLM. Zero fabrication.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/postgres-sql-explain-audit.mjs
//   npx tsx --env-file=.env.local scripts/postgres-sql-explain-audit.mjs --sweep=100

import pg from "pg";
import { performance } from "node:perf_hooks";
const { Pool } = pg;

const argv = process.argv.slice(2);
function argVal(name, def) {
  const idx = argv.indexOf(`--${name}`);
  const i2 = argv.findIndex((a) => a.startsWith(`--${name}=`));
  if (idx !== -1) return argv[idx + 1] ?? String(def);
  if (i2 !== -1) return argv[i2].slice(name.length + 3);
  return String(def);
}

const conn = process.env.NEX_POSTGRES_URL;
if (!conn) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }

const SWEEP_N = Number(argVal("sweep", 50));

const pool = new Pool({ connectionString: conn, max: 4, connectionTimeoutMillis: 8000 });

const VISIBILITY = "claim_status IN ('listed','invited','claimed','paying')";

// EXACT match with food-postgres.ts SELECT_COLS
const FOOD_COLS = `public_listing_ref, business_name, category, categories, city, district, address, coordinates_lat, coordinates_lng, phone, whatsapp_number, website, public_social_links, hero_image_url, hero_image_approved, rating, review_count, claim_status, owner_status, updated_at`;
const ACC_COLS = `public_listing_ref, business_name, category, categories, city, district, address, coordinates_lat, coordinates_lng, phone, whatsapp_number, website, public_social_links, star_rating, room_count, amenities, hero_image_url, rating, review_count, claim_status, owner_status, updated_at`;

// Reproduce the food "Any with breakfast?" case
// extractWorldSearchQuery("Any with breakfast?") returns undefined (regex doesn't match "any" verb)
// cityFilter = undefined (food default)
// sort = "rating" (not commerce · not price_asc)
// limit = 10
const FOOD_BREAKFAST_COUNT_SQL = `SELECT COUNT(*)::int AS n FROM nex.food_business WHERE country = $1 AND ${VISIBILITY}`;
const FOOD_BREAKFAST_ROWS_SQL  = `SELECT ${FOOD_COLS} FROM nex.food_business WHERE country = $1 AND ${VISIBILITY} ORDER BY rating DESC NULLS LAST, review_count DESC NULLS LAST LIMIT 10 OFFSET 0`;
const FOOD_BREAKFAST_PARAMS    = ["ID"];

// Also test what happens IF the query DID extract "breakfast"
const FOOD_WITH_QUERY_COUNT_SQL = `SELECT COUNT(*)::int AS n FROM nex.food_business WHERE country = $1 AND ${VISIBILITY} AND (business_name ILIKE $2 OR address ILIKE $2 OR district ILIKE $2)`;
const FOOD_WITH_QUERY_ROWS_SQL  = `SELECT ${FOOD_COLS} FROM nex.food_business WHERE country = $1 AND ${VISIBILITY} AND (business_name ILIKE $2 OR address ILIKE $2 OR district ILIKE $2) ORDER BY rating DESC NULLS LAST, review_count DESC NULLS LAST LIMIT 10 OFFSET 0`;
const FOOD_WITH_QUERY_PARAMS    = ["ID", "%breakfast%"];

// Accommodation "Find me hotels near Malioboro" case
// extractWorldSearchQuery returns undefined for accommodation (vertical !== accommodation path is skipped)
// mergedSlots.location = "Yogyakarta" (default for accommodation)
// cityFilter = "Yogyakarta"
// sort = "rating"
// limit = 10
const ACC_MALIOBORO_COUNT_SQL = `SELECT COUNT(*)::int AS n FROM nex.accommodation_business WHERE country = $1 AND ${VISIBILITY} AND city ILIKE $2`;
const ACC_MALIOBORO_ROWS_SQL  = `SELECT ${ACC_COLS} FROM nex.accommodation_business WHERE country = $1 AND ${VISIBILITY} AND city ILIKE $2 ORDER BY rating DESC NULLS LAST, review_count DESC NULLS LAST LIMIT 10 OFFSET 0`;
const ACC_MALIOBORO_PARAMS    = ["ID", "Yogyakarta"];

function pct(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, i)];
}
function stats(arr) {
  if (!arr.length) return { n: 0 };
  const s = [...arr].sort((a, b) => a - b);
  const sum = arr.reduce((a, b) => a + b, 0);
  return {
    n: arr.length,
    min: Math.round(s[0] * 100) / 100,
    p50: Math.round(pct(s, 50) * 100) / 100,
    p95: Math.round(pct(s, 95) * 100) / 100,
    p99: Math.round(pct(s, 99) * 100) / 100,
    max: Math.round(s[s.length - 1] * 100) / 100,
    mean: Math.round((sum / arr.length) * 100) / 100,
  };
}

async function explain(label, sql, params) {
  console.log(`\n━━━ EXPLAIN (ANALYZE, BUFFERS) · ${label} ━━━`);
  console.log(`SQL: ${sql}`);
  console.log(`params: ${JSON.stringify(params)}`);
  const q = await pool.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`, params);
  const plan = q.rows[0]["QUERY PLAN"][0];
  const p = plan.Plan;
  console.log(`Planning Time : ${plan["Planning Time"]} ms`);
  console.log(`Execution Time: ${plan["Execution Time"]} ms`);
  // Print the plan tree compactly
  function walk(node, depth) {
    const pad = "  ".repeat(depth);
    const rows = node["Actual Rows"];
    const loops = node["Actual Loops"];
    const startupMs = node["Actual Startup Time"];
    const totalMs = node["Actual Total Time"];
    const nodeType = node["Node Type"];
    const relation = node["Relation Name"] ? ` on ${node["Relation Name"]}` : "";
    const index = node["Index Name"] ? ` using ${node["Index Name"]}` : "";
    const filter = node["Filter"] ? `  Filter: ${node["Filter"]}` : "";
    const indexCond = node["Index Cond"] ? `  IndexCond: ${node["Index Cond"]}` : "";
    const rowsRemoved = node["Rows Removed by Filter"] ? `  RemovedByFilter: ${node["Rows Removed by Filter"]}` : "";
    const buffersHit = node["Shared Hit Blocks"] ?? 0;
    const buffersRead = node["Shared Read Blocks"] ?? 0;
    console.log(`${pad}${nodeType}${relation}${index}  actual: ${totalMs}ms  rows=${rows}  loops=${loops}  buffers_hit=${buffersHit} buffers_read=${buffersRead}`);
    if (filter) console.log(`${pad}  ${filter.trim()}`);
    if (indexCond) console.log(`${pad}  ${indexCond.trim()}`);
    if (rowsRemoved) console.log(`${pad}  ${rowsRemoved.trim()}`);
    for (const child of (node.Plans ?? [])) walk(child, depth + 1);
  }
  walk(p, 0);
  return { planningMs: plan["Planning Time"], executionMs: plan["Execution Time"], plan: p };
}

async function sweep(label, sql, params, n) {
  const samples = [];
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    await pool.query(sql, params);
    samples.push(performance.now() - t0);
    if (i % Math.max(1, Math.floor(n / 5)) === 0) process.stdout.write(`  ${label} ${i + 1}/${n} last=${samples[samples.length - 1].toFixed(1)}ms\n`);
  }
  const s = stats(samples);
  console.log(`  ${label} · n=${s.n} min=${s.min} P50=${s.p50} P95=${s.p95} P99=${s.p99} max=${s.max} mean=${s.mean}`);
  return { label, samples, stats: s };
}

async function indexes(table) {
  const q = await pool.query(`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'nex' AND tablename = $1 ORDER BY indexname`, [table]);
  return q.rows;
}

async function tableStats(table) {
  const q = await pool.query(`
    SELECT schemaname, relname, n_live_tup, n_dead_tup, last_vacuum, last_autovacuum, last_analyze, last_autoanalyze
    FROM pg_stat_user_tables
    WHERE schemaname = 'nex' AND relname = $1
  `, [table]);
  return q.rows[0] ?? null;
}

async function main() {
  console.log("━".repeat(78));
  console.log("POSTGRES-SQL-EXPLAIN-AUDIT · diagnostic only · zero optimization");
  console.log(`started : ${new Date().toISOString()}`);
  console.log("━".repeat(78));

  // ── 1. Indexes + table stats
  console.log(`\n────── 1. Indexes on nex.food_business ──────`);
  for (const idx of await indexes("food_business")) console.log(`  ${idx.indexname}: ${idx.indexdef}`);
  console.log(`\n────── 1. Indexes on nex.accommodation_business ──────`);
  for (const idx of await indexes("accommodation_business")) console.log(`  ${idx.indexname}: ${idx.indexdef}`);

  console.log(`\n────── 2. Table stats · nex.food_business ──────`);
  console.log(`  ${JSON.stringify(await tableStats("food_business"))}`);
  console.log(`\n────── 2. Table stats · nex.accommodation_business ──────`);
  console.log(`  ${JSON.stringify(await tableStats("accommodation_business"))}`);

  // ── 3. EXPLAIN (ANALYZE, BUFFERS) for each of the 4 real adapter queries
  console.log(`\n────── 3. EXPLAIN ANALYZE BUFFERS · adapter queries ──────`);
  const explains = {
    food_breakfast_count: await explain("food · 'Any with breakfast?' · COUNT", FOOD_BREAKFAST_COUNT_SQL, FOOD_BREAKFAST_PARAMS),
    food_breakfast_rows:  await explain("food · 'Any with breakfast?' · ROWS",  FOOD_BREAKFAST_ROWS_SQL,  FOOD_BREAKFAST_PARAMS),
    food_with_query_count: await explain("food · with ILIKE '%breakfast%' · COUNT (hypothetical)", FOOD_WITH_QUERY_COUNT_SQL, FOOD_WITH_QUERY_PARAMS),
    food_with_query_rows:  await explain("food · with ILIKE '%breakfast%' · ROWS  (hypothetical)", FOOD_WITH_QUERY_ROWS_SQL,  FOOD_WITH_QUERY_PARAMS),
    acc_malioboro_count: await explain("accommodation · 'Find me hotels near Malioboro' · COUNT (city='Yogyakarta')", ACC_MALIOBORO_COUNT_SQL, ACC_MALIOBORO_PARAMS),
    acc_malioboro_rows:  await explain("accommodation · 'Find me hotels near Malioboro' · ROWS  (city='Yogyakarta')", ACC_MALIOBORO_ROWS_SQL,  ACC_MALIOBORO_PARAMS),
  };

  // ── 4. Latency sweep (N=SWEEP_N) · look for the tail
  console.log(`\n────── 4. Latency sweep · N=${SWEEP_N} per query ──────`);
  const sweeps = {
    food_breakfast_count: await sweep("food_breakfast_count", FOOD_BREAKFAST_COUNT_SQL, FOOD_BREAKFAST_PARAMS, SWEEP_N),
    food_breakfast_rows:  await sweep("food_breakfast_rows",  FOOD_BREAKFAST_ROWS_SQL,  FOOD_BREAKFAST_PARAMS, SWEEP_N),
    food_with_query_count: await sweep("food_with_query_count", FOOD_WITH_QUERY_COUNT_SQL, FOOD_WITH_QUERY_PARAMS, SWEEP_N),
    food_with_query_rows:  await sweep("food_with_query_rows",  FOOD_WITH_QUERY_ROWS_SQL,  FOOD_WITH_QUERY_PARAMS, SWEEP_N),
    acc_malioboro_count: await sweep("acc_malioboro_count", ACC_MALIOBORO_COUNT_SQL, ACC_MALIOBORO_PARAMS, SWEEP_N),
    acc_malioboro_rows:  await sweep("acc_malioboro_rows",  ACC_MALIOBORO_ROWS_SQL,  ACC_MALIOBORO_PARAMS, SWEEP_N),
  };

  // ── 5. Summary table
  console.log(`\n━━━━━━ SUMMARY · Founder-format ━━━━━━`);
  console.log(`Table                                     n     P50      P95      P99      max      mean`);
  for (const [key, s] of Object.entries(sweeps)) {
    const st = s.stats;
    console.log(`  ${key.padEnd(38)}${String(st.n).padStart(3)}  ${String(st.p50).padStart(6)}ms  ${String(st.p95).padStart(6)}ms  ${String(st.p99).padStart(6)}ms  ${String(st.max).padStart(6)}ms  ${String(st.mean).padStart(6)}ms`);
  }
  console.log(`\nEXPLAIN Execution + Planning times (ms):`);
  for (const [key, e] of Object.entries(explains)) {
    console.log(`  ${key.padEnd(38)} planning=${e.planningMs}ms  execution=${e.executionMs}ms`);
  }

  console.log(`\n${"━".repeat(78)}`);
  console.log(`HARD STOP · diagnostic only · no optimization proposed`);
  console.log(`finished ${new Date().toISOString()}`);
  await pool.end();
}

main().catch((e) => { console.error(`FAILED:`, e?.stack ?? e); pool.end().finally(() => process.exit(1)); });
