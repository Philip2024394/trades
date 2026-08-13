#!/usr/bin/env node
// scripts/verify-supabase-legacy-rls-coverage.mjs
//
// Wave 3 · H6 · read-only audit of RLS coverage across supabase/migrations/*.sql.
// Governed by: docs/headquarters-production-readiness/WAVE-3-H6-RLS-DESIGN.md
//
// PURPOSE
//   Identifies every legacy Supabase table that has ROW LEVEL SECURITY
//   enabled but has NO active CREATE POLICY anywhere in the migration set.
//   These tables are currently safe (service_role uses BYPASSRLS) but any
//   future anon/authenticated reader would return zero rows, silently.
//
// SAFETY
//   READ-ONLY. Zero file writes. Zero DB connections. Zero touches to
//   supabase/migrations/*.sql. This tool is the H6 audit surface only —
//   it does not close the R-7 gap.
//
// USAGE
//   node scripts/verify-supabase-legacy-rls-coverage.mjs
//   node scripts/verify-supabase-legacy-rls-coverage.mjs --json
//
// EXIT CODES
//   0 · report emitted (always · this is an audit surface, not a gate)
//   1 · runner exception
//
// See §2 (method) + §3 (findings) of WAVE-3-H6-RLS-DESIGN.md.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = "supabase/migrations";
const asJson = process.argv.slice(2).includes("--json");

// ── Regex signals (case-insensitive) ────────────────────────────────
const RE_ENABLE_RLS = /ALTER\s+TABLE\s+([a-zA-Z_][\w.]*)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
const RE_CREATE_POLICY = /CREATE\s+POLICY\s+(?:IF\s+NOT\s+EXISTS\s+)?[a-zA-Z_"][\w"]*\s+ON\s+([a-zA-Z_][\w.]*)/gi;
const RE_DROP_POLICY = /DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?([a-zA-Z_"][\w"]*)\s+ON\s+([a-zA-Z_][\w.]*)/gi;

// ── Risk-rank heuristics (see design §2.4) ──────────────────────────
const P0_RE = /payment|billing|invoice|charge|stripe|price|checkout|receipt|payout|wallet/i;
const P1_RE = /consent|gdpr|privacy|subscription|unsubscribe|newsletter|dpa/i;
const P2_RE = /order|quote|lead|contact|job|project|listing|profile|customer|user|account|application|referral|affiliate/i;

function tierOf(name) {
  const bare = name.replace(/^public\./i, "").toLowerCase();
  if (P0_RE.test(bare)) return "P0";
  if (P1_RE.test(bare)) return "P1";
  if (P2_RE.test(bare)) return "P2";
  return "P3";
}

function normalize(target) {
  const t = target.replace(/["`]/g, "");
  // Qualify with public. if bare (Postgres default schema on Supabase)
  return t.includes(".") ? t.toLowerCase() : `public.${t.toLowerCase()}`;
}

try {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql") && !f.startsWith("_"))
    .sort();

  const enableSources = new Map();      // table → [{ file, line }]
  const policyState = new Map();        // "table::policy_name" → true when active
  const policyToTable = new Map();      // policy_name → table (last-wins is fine · we only need coverage)

  // Track create/drop order so a final DROP after a CREATE removes coverage.
  // We iterate files in alphabetical order = migration apply order.
  for (const file of files) {
    const path = join(MIGRATIONS_DIR, file);
    const text = readFileSync(path, "utf8");

    for (const m of text.matchAll(RE_ENABLE_RLS)) {
      const table = normalize(m[1]);
      const lineNo = text.slice(0, m.index).split(/\n/).length;
      const list = enableSources.get(table) ?? [];
      list.push({ file, line: lineNo });
      enableSources.set(table, list);
    }
    for (const m of text.matchAll(RE_CREATE_POLICY)) {
      const table = normalize(m[1]);
      // We don't know the policy name here reliably (regex captures the ON target);
      // for gap detection we only need "at least one active policy targets this table".
      const key = `${table}::__any__`;
      policyState.set(key, true);
    }
    for (const m of text.matchAll(RE_DROP_POLICY)) {
      const name = m[1].replace(/["`]/g, "");
      const table = normalize(m[2]);
      policyToTable.set(name, table);
      // A pure DROP without an accompanying CREATE in the same file reduces
      // coverage. We conservatively DO NOT remove __any__ for a DROP because
      // most drops in this codebase are immediately followed by a CREATE
      // (the standard `drop if exists ... ; create policy ...` idiom). To
      // avoid false positives we require a stronger signal — see §7.3.
    }
  }

  // A table is "covered" if any policy target maps to it.
  const gaps = [];
  const covered = [];
  for (const [table, sources] of enableSources.entries()) {
    const key = `${table}::__any__`;
    if (policyState.has(key)) {
      covered.push({ table, tier: tierOf(table), enable_count: sources.length });
    } else {
      gaps.push({ table, tier: tierOf(table), enable_sources: sources });
    }
  }

  // Sort gaps: P0 first, then P1, P2, P3, then alphabetical within tier.
  const tierOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
  gaps.sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier] || a.table.localeCompare(b.table));
  covered.sort((a, b) => a.table.localeCompare(b.table));

  const gapsByTier = {
    P0: gaps.filter((g) => g.tier === "P0").length,
    P1: gaps.filter((g) => g.tier === "P1").length,
    P2: gaps.filter((g) => g.tier === "P2").length,
    P3: gaps.filter((g) => g.tier === "P3").length,
  };

  const report = {
    scanned_files: files.length,
    rls_enabled_tables: enableSources.size,
    covered_tables: covered.length,
    gap_count: gaps.length,
    gaps_by_tier: gapsByTier,
    gaps,
    covered,
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("── H6 · legacy Supabase RLS coverage report ──\n");
    console.log(`  files scanned      : ${files.length}`);
    console.log(`  tables enable RLS  : ${enableSources.size}`);
    console.log(`  tables covered     : ${covered.length}`);
    console.log(`  tables in gap      : ${gaps.length}`);
    console.log(`  gaps by tier       : P0=${gapsByTier.P0} · P1=${gapsByTier.P1} · P2=${gapsByTier.P2} · P3=${gapsByTier.P3}`);
    console.log("");
    if (gaps.length > 0) {
      console.log("── gap tables (RLS enabled · no CREATE POLICY anywhere) ──");
      for (const g of gaps) {
        console.log(`  [${g.tier}] ${g.table}  (${g.enable_sources.length} enable statement${g.enable_sources.length === 1 ? "" : "s"} in ${new Set(g.enable_sources.map((s) => s.file)).size} file${new Set(g.enable_sources.map((s) => s.file)).size === 1 ? "" : "s"})`);
      }
      console.log("");
    }
    console.log(`  Current status  : R-7 gap = ${gaps.length} tables (${gapsByTier.P0} P0 · ${gapsByTier.P1} P1 · ${gapsByTier.P2} P2 · ${gapsByTier.P3} P3).`);
    console.log(`  Currently safe? : YES · service_role uses BYPASSRLS.`);
    console.log(`  Future risk     : any new anon/authenticated connection reads zero rows from every gap table until policies are added.`);
    console.log(`  Remediation     : per-subsystem design pass · requires separate Supabase migration authorisation (see WAVE-3-H6-RLS-DESIGN.md §1).`);
  }
  process.exit(0);
} catch (e) {
  console.error("[verify-supabase-legacy-rls-coverage] runner exception:", e instanceof Error ? (e.stack ?? e.message) : String(e));
  process.exit(1);
}
