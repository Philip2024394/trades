#!/usr/bin/env node
// legacy-rls-coverage-drift.test.mjs · Wave 3 · H6 · drift-catcher
//
// Governed by: docs/headquarters-production-readiness/WAVE-3-H6-RLS-DESIGN.md
//
// Locks the H6 gap size at the baseline captured on 2026-08-10. Any future
// legacy Supabase migration that adds another RLS-enabled-no-policy table
// increases the count and fails this test in CI. Author must either:
//   (a) add a matching CREATE POLICY in the same migration file · OR
//   (b) update BASELINE_TOTAL below AND record a waiver reason in the
//       inline comment · so the growth is visible in code review
//
// This drift-catcher does NOT enforce a policy shape (that requires the
// per-subsystem design pass H6 defers). It only prevents silent expansion
// of the gap.
//
// Assertions:
//   CD1 · gap count reported by scripts/verify-supabase-legacy-rls-coverage.mjs
//         does not exceed BASELINE_TOTAL
//   CD2 · gaps-by-tier P0/P1 counts do not exceed the recorded per-tier
//         baseline (extra sensitivity for financial + regulatory tiers)

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..", "..", "..", "..", "..");

// ── H6 baseline · captured 2026-08-10 by first run of the audit script ──
// Do NOT lower these numbers without evidence that the gap has been closed.
// Do NOT raise them without recording a waiver reason.
const BASELINE_TOTAL = 191;
const BASELINE_P0 = 9;   // financial · direct revenue impact
const BASELINE_P1 = 5;   // consent · regulatory
const BASELINE_P2 = 32;  // customer workflow
const BASELINE_P3 = 145; // infrastructure / metadata

function runAudit() {
  const r = spawnSync("node", [join(REPO, "scripts/verify-supabase-legacy-rls-coverage.mjs"), "--json"], {
    cwd: REPO, encoding: "utf8",
  });
  if (r.status !== 0) throw new Error(`audit script exit ${r.status}: ${r.stderr}`);
  return JSON.parse(r.stdout);
}

test("CD1 · legacy Supabase RLS-no-policy gap does not exceed baseline", () => {
  const report = runAudit();
  assert.ok(report.gap_count <= BASELINE_TOTAL,
    `H6 drift · gap grew from baseline ${BASELINE_TOTAL} to ${report.gap_count}. ` +
    `Either add a CREATE POLICY for the new RLS-enabled table in the same migration file, ` +
    `or update BASELINE_TOTAL in this test with a documented waiver reason.`);
});

test("CD2 · P0 (financial) + P1 (consent) gap counts do not exceed per-tier baseline", () => {
  const report = runAudit();
  assert.ok(report.gaps_by_tier.P0 <= BASELINE_P0,
    `H6 drift · P0 (financial) gap grew from ${BASELINE_P0} to ${report.gaps_by_tier.P0}. ` +
    `Financial tables need policies · this is the highest-risk tier.`);
  assert.ok(report.gaps_by_tier.P1 <= BASELINE_P1,
    `H6 drift · P1 (consent/regulatory) gap grew from ${BASELINE_P1} to ${report.gaps_by_tier.P1}. ` +
    `Regulatory tables need policies before any anon/authenticated reader is added.`);
});
