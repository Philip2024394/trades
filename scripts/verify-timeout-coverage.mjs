#!/usr/bin/env node
// scripts/verify-timeout-coverage.mjs
//
// Wave 3 · H3 · static timeout-coverage report.
// Governed by: docs/headquarters-production-readiness/WAVE-3-H3-TIMEOUT-BUDGETS.md
//
// Read-only. No DB connection, no writes. Enumerates:
//   · Every `new Pool(` site under src/lib/nex/**
//   · For each, whether it passes `connectionTimeoutMillis`
//   · Every transactional wrapper (withBrainRole + PostgresBrainStore::withTx)
//     and whether it emits SET LOCAL statement_timeout + idle_in_transaction
//   · Total `await *.query(` sites under src/lib/nex/**
//   · The 5 configured timeout classes and their current default values
//
// USAGE
//   node scripts/verify-timeout-coverage.mjs
//   node scripts/verify-timeout-coverage.mjs --json
//
// EXIT CODES  0 · report emitted · 1 · runner exception

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const NEX_ROOT = "src/lib/nex";

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
      if (!/\.(ts|mjs)$/.test(e.name)) continue;
      if (/\.test\.(ts|mjs)$/.test(e.name)) continue;
      out.push(p);
    }
  }
  return out;
}

function relPath(p) { return relative(process.cwd(), p).split(sep).join("/"); }

try {
  const files = existsSync(NEX_ROOT) ? walk(NEX_ROOT) : [];
  const poolSites = [];
  const wrapperReport = { withBrainRole: null, pgAdapterWithTx: null, sharedPool: null };
  let queryCount = 0;

  for (const f of files) {
    const src = readFileSync(f, "utf8");
    queryCount += (src.match(/await\s+\w+\.query\s*\(/g) ?? []).length;
    if (/new\s+Pool\s*\(/.test(src)) {
      const passesCT = /connectionTimeoutMillis\s*:/.test(src);
      poolSites.push({ file: relPath(f), passes_connection_timeout: passesCT });
    }
  }

  // Wrapper-specific checks
  const withBrainRolePath = "src/lib/nex/db/with-brain-role.ts";
  if (existsSync(withBrainRolePath)) {
    const src = readFileSync(withBrainRolePath, "utf8");
    wrapperReport.withBrainRole = {
      emits_statement_timeout: /SET LOCAL statement_timeout/.test(src),
      emits_idle_transaction: /SET LOCAL idle_in_transaction_session_timeout/.test(src),
    };
  }
  const pgAdapterPath = "src/lib/nex/brain/adapters/postgres.ts";
  if (existsSync(pgAdapterPath)) {
    const src = readFileSync(pgAdapterPath, "utf8");
    wrapperReport.pgAdapterWithTx = {
      emits_statement_timeout: /SET LOCAL statement_timeout/.test(src),
      emits_idle_transaction: /SET LOCAL idle_in_transaction_session_timeout/.test(src),
    };
  }
  const sharedPoolPath = "src/lib/nex/db.ts";
  if (existsSync(sharedPoolPath)) {
    const src = readFileSync(sharedPoolPath, "utf8");
    wrapperReport.sharedPool = {
      passes_connection_timeout: /connectionTimeoutMillis\s*:/.test(src),
    };
  }

  const poolsWith  = poolSites.filter((s) => s.passes_connection_timeout).length;
  const poolsWithout = poolSites.length - poolsWith;

  if (asJson) {
    console.log(JSON.stringify({
      pools_total: poolSites.length,
      pools_with_connection_timeout: poolsWith,
      pools_without_connection_timeout: poolsWithout,
      pools: poolSites,
      wrappers: wrapperReport,
      sql_statement_sites: queryCount,
    }, null, 2));
  } else {
    console.log("── H3 · timeout-coverage report ──\n");
    console.log(`  pools total       : ${poolSites.length}`);
    console.log(`  pools with T-3    : ${poolsWith}`);
    console.log(`  pools without T-3 : ${poolsWithout}`);
    console.log("");
    console.log("  per-pool detail:");
    for (const s of poolSites) {
      const badge = s.passes_connection_timeout ? "✓" : "·";
      console.log(`    ${badge} ${s.file}  (T-3: ${s.passes_connection_timeout ? "yes" : "no"})`);
    }
    console.log("");
    console.log("  wrapper injection:");
    const w = wrapperReport;
    console.log(`    ${w.withBrainRole?.emits_statement_timeout && w.withBrainRole?.emits_idle_transaction ? "✓" : "·"} withBrainRole   · statement=${w.withBrainRole?.emits_statement_timeout} · idle_tx=${w.withBrainRole?.emits_idle_transaction}`);
    console.log(`    ${w.pgAdapterWithTx?.emits_statement_timeout && w.pgAdapterWithTx?.emits_idle_transaction ? "✓" : "·"} PostgresBrainStore::withTx · statement=${w.pgAdapterWithTx?.emits_statement_timeout} · idle_tx=${w.pgAdapterWithTx?.emits_idle_transaction}`);
    console.log(`    ${w.sharedPool?.passes_connection_timeout ? "✓" : "·"} shared pool (db.ts) · connectionTimeoutMillis=${w.sharedPool?.passes_connection_timeout}`);
    console.log("");
    console.log(`  total \`await *.query(\` sites : ${queryCount}`);
    console.log("");
    const remaining = poolsWithout > 0
      ? `${poolsWithout} per-subsystem pool(s) still lack T-3 · recorded as OPEN per H3 scope (see WAVE-3-H3-TIMEOUT-BUDGETS.md §4.2)`
      : "every pool has T-3 coverage";
    console.log(`  remaining unbudgeted: ${remaining}`);
  }
  process.exit(0);
} catch (e) {
  console.error("[verify-timeout-coverage] runner exception:", e instanceof Error ? (e.stack ?? e.message) : String(e));
  process.exit(1);
}
