// scripts/nex-canonical/rule-5m-measurement-runner.ts
//
// NEX Canonical · Rule 5m · Measurement Runner · Agent-6 CLI entry.
//
// WHAT THIS FILE IS
//   A thin, deterministic wrapper around the sealed `eval-measurement-runner`
//   that resolves the agent-6 fixture layout:
//     · tests/fixtures/canonical/seed-cohort-v1.jsonl
//     · tests/fixtures/eval/positive-pairs-v1.jsonl
//     · tests/fixtures/eval/negative-pairs-v1.jsonl
//     · tests/fixtures/eval/ambiguous-pairs-v1.jsonl
//
//   The sealed `measure()` function from `./eval-measurement-runner` is the
//   single implementation. This file does not re-implement its logic · it
//   locates the correct fixture paths, calls `measure()`, writes
//   `measurement-run-latest.json`, and reports the Rule-5j gate outcomes.
//
// WHY THIS FILE EXISTS
//   The agent-6 task scope asks for `rule-5m-measurement-runner.ts`. The
//   existing `eval-measurement-runner.ts` IS the measurement implementation
//   and MUST NOT be duplicated. This file provides the Rule-5m-named entry
//   point so the aggregator and proof manifest can bind to a consistently
//   named artefact without touching the sealed implementation.
//
// SAFETY POSTURE
//   · Pure. No DB writes. No network. No clock side effects other than
//     the explicit `measured_at` stamp injected into the artefact.
//   · Fail-closed · refuses to measure if any prerequisite fixture is missing.

import * as fs from "node:fs";
import * as path from "node:path";
import {
  measure,
  MEASUREMENT_SCHEMA_VERSION,
  type MeasurementArtefact,
  type MeasurementInputs,
} from "./eval-measurement-runner";

export { MEASUREMENT_SCHEMA_VERSION };
export type { MeasurementArtefact, MeasurementInputs };

// ═════════════════════════════════════════════════════════════════════
// §1 · Default fixture layout · agent-6 scoped
// ═════════════════════════════════════════════════════════════════════

const REPO_ROOT = path.resolve(__dirname, "..", "..");

export const AGENT_6_FIXTURE_PATHS = Object.freeze({
  seedCohortPath: path.join(REPO_ROOT, "tests", "fixtures", "canonical", "seed-cohort-v1.jsonl"),
  positivePairsPath: path.join(REPO_ROOT, "tests", "fixtures", "eval", "positive-pairs-v1.jsonl"),
  negativePairsPath: path.join(REPO_ROOT, "tests", "fixtures", "eval", "negative-pairs-v1.jsonl"),
  ambiguousPairsPath: path.join(REPO_ROOT, "tests", "fixtures", "eval", "ambiguous-pairs-v1.jsonl"),
  resolverModulePath: path.join(REPO_ROOT, "scripts", "nex-canonical", "canonical-resolver.ts"),
} as const);

// ═════════════════════════════════════════════════════════════════════
// §2 · Public entry point · pure
// ═════════════════════════════════════════════════════════════════════

/** Run the sealed measurement against the agent-6 fixture layout.
 *  Deterministic given the fixtures + `nowIso`. */
export function runRule5mMeasurement(
  nowIso: string,
  overrides?: Partial<MeasurementInputs>,
): MeasurementArtefact {
  const inputs: MeasurementInputs = {
    seedCohortPath: AGENT_6_FIXTURE_PATHS.seedCohortPath,
    positivePairsPath: AGENT_6_FIXTURE_PATHS.positivePairsPath,
    negativePairsPath: AGENT_6_FIXTURE_PATHS.negativePairsPath,
    ambiguousPairsPath: AGENT_6_FIXTURE_PATHS.ambiguousPairsPath,
    resolverModulePath: AGENT_6_FIXTURE_PATHS.resolverModulePath,
    nowIso,
    ...overrides,
  };
  return measure(inputs);
}

// ═════════════════════════════════════════════════════════════════════
// §3 · CLI · write artefact + print gate outcomes
// ═════════════════════════════════════════════════════════════════════

const isMain = (() => {
  try {
    return require.main === module;
  } catch {
    return false;
  }
})();

function main(): void {
  const nowIso = new Date().toISOString();
  let artefact: MeasurementArtefact;
  try {
    artefact = runRule5mMeasurement(nowIso);
  } catch (e) {
    console.error("rule-5m-measurement-runner: refusing to proceed · " + ((e instanceof Error) ? e.message : String(e)));
    process.exit(1);
  }
  const outPath = path.join(REPO_ROOT, "rule-5m-measurement-latest.json");
  fs.writeFileSync(outPath, JSON.stringify(artefact, null, 2) + "\n");
  console.log("Rule 5m · Measurement complete");
  console.log("  false_merge_rate = " + artefact.metrics.false_merge_rate.toFixed(4));
  console.log("  precision        = " + artefact.metrics.precision.toFixed(4));
  console.log("  recall           = " + artefact.metrics.recall.toFixed(4));
  console.log("  abstention(amb)  = " + artefact.metrics.abstention_rate_on_ambiguous.toFixed(4));
  console.log("  gates: fm≤1%=" + artefact.rule_5j_gates.false_merge_le_1pct +
              "  p≥98%=" + artefact.rule_5j_gates.precision_ge_98pct +
              "  r≥70%=" + artefact.rule_5j_gates.recall_ge_70pct +
              "  abst≥80%=" + artefact.rule_5j_gates.abstention_ge_80pct);
  console.log("  all_hard_gates_pass = " + artefact.all_hard_gates_pass);
  console.log("  all_gates_pass      = " + artefact.all_gates_pass);
  console.log("Artefact → " + outPath);
  if (!artefact.all_hard_gates_pass) process.exit(1);
}

if (isMain) main();
