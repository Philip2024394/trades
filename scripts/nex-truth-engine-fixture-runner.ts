// scripts/nex-truth-engine-fixture-runner.ts
//
// Truth Engine Fixture Runner CLI · Stage 1a sub-step 1a.7.
//
// Founder-authorised sub-step 1a.7 · 2026-09-11.
//
// Reads 33 baseline fixtures from nex_test.fixture_row + fixture_expected.
// Runs each through the existing Stage 1a verifier + Guardian pipeline.
// Writes verdicts to nex_test.verifier_verdict.
// Executes 5 runs and proves byte-identical determinism.
//
// Guarantees:
//   - Writes only to nex_test.* (verifier_verdict + reproducibility_run)
//   - Zero writes to nex.* / nex_lab_* / any other schema
//   - Zero R-10 authorisation (authorisation_policy_ref stays null)
//   - Zero AUTHORITATIVE promotion
//   - Zero verifier / Guardian / rule module modifications
//   - Deterministic across 5+ runs
//
// Usage:
//   npx tsx --env-file=.env.local scripts/nex-truth-engine-fixture-runner.ts
//
// Environment: reads NEX_POSTGRES_URL from .env.local · falls back to
// DATABASE_URL if unset.

import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { Verifier } from "../src/lib/nex/truth-engine/verifier/verifier";
import { createStage1aGuardian } from "../src/lib/nex/truth-engine/guardian/guardian";
import { ALL_RULES } from "../src/lib/nex/truth-engine/verifier/rules/index";
import {
  compareRunsForDeterminism,
  formatRunnerReport,
  indexExpected,
  runSuite,
} from "../src/lib/nex/truth-engine/runner/fixture-runner";
import type {
  FixtureExpected,
  FixtureResult,
  FixtureRow,
  RunnerReport,
} from "../src/lib/nex/truth-engine/runner/types";

const GUARDIAN_VERSION = "guardian.v1.0.0-stage-1a";
const VERIFIER_INSTANCE_ID = "11111111-1111-4111-8111-111111111111"; // deterministic
const FIXED_CLOCK = () => "2026-09-11T08:00:00.000Z";
const RUNS = 5;

function requiredEnv(): string {
  const url = process.env.NEX_POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("NEX_POSTGRES_URL (or DATABASE_URL) is required in the environment.");
  return url;
}

async function loadFixtures(client: Client): Promise<{
  rows: FixtureRow[];
  expected: FixtureExpected[];
}> {
  const rowsRes = await client.query<{
    fixture_id: string;
    fixture_set_version: string;
    r_rule: string;
    fixture_purpose: string;
    input_row_shape: Record<string, unknown>;
    domain: string | null;
    cross_rule_interactions: string[];
    founder_authored: boolean;
    authored_by: string | null;
    notes: string | null;
  }>(`
    SELECT fixture_id, fixture_set_version, r_rule, fixture_purpose,
           input_row_shape, domain, cross_rule_interactions,
           founder_authored, authored_by, notes
    FROM nex_test.fixture_row
    WHERE fixture_set_version = 'fixture_set.v1.0.0'
    ORDER BY r_rule, fixture_purpose, fixture_id;
  `);

  const expectedRes = await client.query<{
    fixture_id: string;
    r_rule: string;
    expected_verdict: string;
    expected_reason: string | null;
    expected_confidence_band: string | null;
    expected_threshold_version: string | null;
  }>(`
    SELECT fixture_id, r_rule, expected_verdict, expected_reason,
           expected_confidence_band, expected_threshold_version
    FROM nex_test.fixture_expected
    ORDER BY fixture_id, r_rule;
  `);

  return {
    rows: rowsRes.rows,
    expected: expectedRes.rows,
  };
}

async function captureSubstrateSnapshot(client: Client) {
  const res = await client.query<{ tbl: string; count: string }>(`
    SELECT 'nex_test.fixture_row' AS tbl, COUNT(*)::text AS count FROM nex_test.fixture_row
    UNION ALL SELECT 'nex_test.fixture_expected', COUNT(*)::text FROM nex_test.fixture_expected
    UNION ALL SELECT 'nex_test.verifier_verdict', COUNT(*)::text FROM nex_test.verifier_verdict
    UNION ALL SELECT 'nex_test.reproducibility_run', COUNT(*)::text FROM nex_test.reproducibility_run
    UNION ALL SELECT 'nex.knowledge_records', COUNT(*)::text FROM nex.knowledge_records
    UNION ALL SELECT 'nex_tables_total', COUNT(*)::text FROM information_schema.tables WHERE table_schema='nex'
    UNION ALL SELECT 'nex_test_tables_total', COUNT(*)::text FROM information_schema.tables WHERE table_schema='nex_test'
    UNION ALL SELECT 'nex_lab_tables_total', COUNT(*)::text FROM information_schema.tables WHERE table_schema LIKE 'nex_lab_%'
    UNION ALL SELECT 'authoritative_verdicts', COUNT(*)::text FROM nex_test.verifier_verdict WHERE authorisation_policy_ref IS NOT NULL
  `);
  const snapshot: Record<string, number> = {};
  for (const r of res.rows) snapshot[r.tbl] = Number(r.count);
  return snapshot;
}

async function insertReproducibilityRun(
  client: Client,
  runId: string,
  ruleSetVersion: string,
): Promise<void> {
  await client.query(
    `
    INSERT INTO nex_test.reproducibility_run
      (reproducibility_run_id, fixture_set_version, verifier_instance_id,
       rule_set_version, run_started_at, run_status, fixtures_evaluated,
       fixtures_matched_expected, fixtures_diverged, notes)
    VALUES ($1, 'fixture_set.v1.0.0', $2, $3, now(), 'in_progress', 0, 0, 0,
            'Stage 1a sub-step 1a.7 · fixture runner · founder-authorised 2026-09-11');
  `,
    [runId, VERIFIER_INSTANCE_ID, ruleSetVersion],
  );
}

async function updateReproducibilityRunComplete(
  client: Client,
  runId: string,
  report: RunnerReport,
): Promise<void> {
  const determinismReport = {
    matches: report.matches,
    intentionalDivergences: report.intentionalDivergences,
    unexpectedDivergences: report.unexpectedDivergences,
    notRunnable: report.notRunnable,
    currentStateCounts: report.currentStateCounts,
    intentionalDivergencesByRule: report.intentionalDivergencesByRule,
    unexpectedByRule: report.unexpectedByRule,
  };
  await client.query(
    `
    UPDATE nex_test.reproducibility_run
    SET run_completed_at = now(),
        run_status = 'completed',
        fixtures_evaluated = $1,
        fixtures_matched_expected = $2,
        fixtures_diverged = $3,
        determinism_report = $4::jsonb
    WHERE reproducibility_run_id = $5;
  `,
    [
      report.fixturesEvaluated,
      report.matches,
      report.intentionalDivergences + report.unexpectedDivergences,
      JSON.stringify(determinismReport),
      runId,
    ],
  );
}

async function writeVerifierVerdicts(
  client: Client,
  runId: string,
  ruleSetVersion: string,
  results: readonly FixtureResult[],
): Promise<number> {
  let inserted = 0;
  for (const r of results) {
    if (r.envelope === null) continue; // NOT_RUNNABLE fixtures skipped
    // Guardian instance mismatch would be an audit issue · but the runner
    // constructs Guardian with the same guardianVersion the envelope carries.
    await client.query(
      `
      INSERT INTO nex_test.verifier_verdict
        (fixture_id, verifier_instance_id, rule_set_version, guardian_version,
         authorisation_policy_ref, truth_engine_ok, per_rule_verdicts,
         reproducibility_run_id, verdict_at, is_test_verdict, notes)
      VALUES ($1, $2, $3, $4, NULL, $5, $6::jsonb, $7, $8::timestamptz, true, $9);
    `,
      [
        r.fixture_id,
        VERIFIER_INSTANCE_ID,
        ruleSetVersion,
        GUARDIAN_VERSION,
        r.envelope.truthEngineOk,
        JSON.stringify(r.envelope.perRuleVerdicts),
        runId,
        r.envelope.verdictAt,
        `Stage 1a 1a.7 · classification=${r.classification} · guardian_accepted=${r.guardian_accepted}`,
      ],
    );
    inserted += 1;
  }
  return inserted;
}

function buildVerifier() {
  return new Verifier(
    {
      verifierInstanceId: VERIFIER_INSTANCE_ID,
      guardianVersion: GUARDIAN_VERSION,
      rules: ALL_RULES,
    },
    "all_must_pass",
    FIXED_CLOCK,
  );
}

async function main() {
  const url = requiredEnv();
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    console.log("=".repeat(78));
    console.log("Stage 1a · Sub-step 1a.7 · Truth Engine Fixture Runner");
    console.log("=".repeat(78));
    console.log(`Guardian version:      ${GUARDIAN_VERSION}`);
    console.log(`Verifier instance ID:  ${VERIFIER_INSTANCE_ID}`);
    console.log(`Runs planned:          ${RUNS}`);
    console.log("");

    // Pre-run snapshot
    const preSnapshot = await captureSubstrateSnapshot(client);
    console.log("PRE-RUN SUBSTRATE SNAPSHOT:");
    for (const [k, v] of Object.entries(preSnapshot)) console.log(`  ${k}: ${v}`);
    console.log("");

    // Load fixtures once
    const { rows, expected } = await loadFixtures(client);
    console.log(`Loaded ${rows.length} fixtures + ${expected.length} expected verdicts.`);
    console.log("");

    if (rows.length !== 33) {
      throw new Error(`Expected 33 fixtures at fixture_set.v1.0.0 · got ${rows.length}`);
    }

    const expectedMap = indexExpected(expected);

    // Execute N runs
    const reports: RunnerReport[] = [];
    for (let i = 1; i <= RUNS; i++) {
      const runId = randomUUID();
      const verifier = buildVerifier();
      const guardian = createStage1aGuardian(GUARDIAN_VERSION);

      // Insert reproducibility_run row
      const ruleSetVersion = buildVerifier().verify({
        objectSnapshotRef: "probe",
        objectSnapshot: {},
        evidenceRefs: [],
      }).ruleSetVersion;
      await insertReproducibilityRun(client, runId, ruleSetVersion);

      const report = runSuite(rows, expectedMap, verifier, guardian, runId);
      reports.push(report);

      // Write verdicts
      const inserted = await writeVerifierVerdicts(
        client,
        runId,
        ruleSetVersion,
        report.perFixture,
      );

      // Update reproducibility_run row
      await updateReproducibilityRunComplete(client, runId, report);

      console.log(`RUN ${i} of ${RUNS} · runId=${runId} · verdicts inserted=${inserted}`);
    }

    console.log("");
    console.log("=".repeat(78));
    console.log("PER-RUN REPORTS");
    console.log("=".repeat(78));
    for (let i = 0; i < reports.length; i++) {
      console.log("");
      console.log(`--- Run ${i + 1} ---`);
      console.log(formatRunnerReport(reports[i]));
    }

    // Determinism comparison
    const determinism = compareRunsForDeterminism(reports);
    console.log("");
    console.log("=".repeat(78));
    console.log("DETERMINISM COMPARISON");
    console.log("=".repeat(78));
    console.log(`Runs compared: ${determinism.runs}`);
    console.log(`Byte-identical across all runs: ${determinism.identical}`);
    if (!determinism.identical) {
      console.log("Diverging fixtures:");
      for (const f of determinism.divergingFixtures) console.log(`  ${f}`);
    }

    // Post-run substrate snapshot
    const postSnapshot = await captureSubstrateSnapshot(client);
    console.log("");
    console.log("=".repeat(78));
    console.log("POST-RUN SUBSTRATE SNAPSHOT (delta vs pre)");
    console.log("=".repeat(78));
    for (const [k, v] of Object.entries(postSnapshot)) {
      const pre = preSnapshot[k] ?? 0;
      const delta = v - pre;
      const marker = delta === 0 ? "unchanged" : `+${delta}`;
      console.log(`  ${k}: pre=${pre} · post=${v} · ${marker}`);
    }

    // Isolation invariants
    console.log("");
    console.log("=".repeat(78));
    console.log("SUBSTRATE ISOLATION INVARIANTS");
    console.log("=".repeat(78));
    const violations: string[] = [];
    if (postSnapshot["nex.knowledge_records"] !== preSnapshot["nex.knowledge_records"])
      violations.push("nex.knowledge_records mutated");
    if (postSnapshot["nex_tables_total"] !== preSnapshot["nex_tables_total"])
      violations.push("nex schema table count changed");
    if (postSnapshot["nex_lab_tables_total"] !== preSnapshot["nex_lab_tables_total"])
      violations.push("nex_lab_* table count changed");
    if (postSnapshot["nex_test_tables_total"] !== preSnapshot["nex_test_tables_total"])
      violations.push("nex_test schema table count changed");
    if (postSnapshot["nex_test.fixture_row"] !== preSnapshot["nex_test.fixture_row"])
      violations.push("nex_test.fixture_row mutated (should stay 33)");
    if (postSnapshot["nex_test.fixture_expected"] !== preSnapshot["nex_test.fixture_expected"])
      violations.push("nex_test.fixture_expected mutated (should stay 33)");
    if (postSnapshot["authoritative_verdicts"] !== 0)
      violations.push("R-10 authorisation created (authorisation_policy_ref non-null)");
    if (violations.length === 0) {
      console.log("  ALL ISOLATION INVARIANTS INTACT.");
    } else {
      console.log("  VIOLATIONS DETECTED:");
      for (const v of violations) console.log(`    - ${v}`);
    }

    // Final exit summary
    console.log("");
    console.log("=".repeat(78));
    console.log("FINAL RUNNER SUMMARY");
    console.log("=".repeat(78));
    const finalReport = reports[reports.length - 1];
    console.log(`Fixtures evaluated:                     ${finalReport.fixturesEvaluated}`);
    console.log(`Matches:                                ${finalReport.matches}`);
    console.log(`Intentional pending-policy divergences: ${finalReport.intentionalDivergences}`);
    console.log(`Unexpected divergences:                 ${finalReport.unexpectedDivergences}`);
    console.log(`Not runnable:                           ${finalReport.notRunnable}`);
    console.log(`Determinism (byte-identical N runs):    ${determinism.identical}`);
    console.log(`Substrate isolation intact:             ${violations.length === 0}`);
    console.log("");
    console.log(`Stage 1a 1a.7 exit criteria (unexpected=0 · determinism=true · isolation=intact):`);
    const passed =
      finalReport.unexpectedDivergences === 0 &&
      determinism.identical &&
      violations.length === 0;
    console.log(`  ${passed ? "PASS · READY FOR FOUNDER REVIEW" : "FAIL · MUST INVESTIGATE"}`);
    console.log("");

    if (!passed) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("Runner failed:", e);
  process.exit(1);
});
