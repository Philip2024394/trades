// Cycle 4 · Phase C + D · runtime measurement of mb_outcome_quality
//
// Procedure:
//   1. The outcome-experience store already contains 6 entries from the
//      Ledger B substrate phase (commit 35f9e67c).
//   2. Present 3 FRESH fixtures NEX has never seen, from the same M3
//      family (execution-path-ambiguous shapes).
//   3. BEFORE running the coding loop on each fixture, consult
//      mb_outcome_quality with the proposed-action observation.
//   4. AFTER the coding loop, observe what actually happened.
//   5. Compare mb_outcome_quality's prediction against actual outcome.
//   6. Score prediction accuracy honestly.
//
// The brain has 6 accumulated priors. Of those, 2 are "correct target"
// (A, D · mutation_targets_execution_path=true), 2 are "wrong target"
// (B, C · mutation_targets_execution_path=false), and 2 are "no mutation"
// (E, F · not applicable). With only 2 correct-target priors vs 2
// wrong-target priors, the fraction is 2/4 = 0.5. That's between
// RISKY_THRESHOLD (0.5) and SAFE_THRESHOLD (0.75), so the brain will
// predict "unknown_no_prior_evidence" — a genuinely honest signal.
//
// If we run 3 additional adversarial fixtures and add their outcomes to
// the store, the fraction shifts based on actual results.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const REPO = "C:/Users/Victus/trades";
const FIX_DIR = path.join(REPO, "src", "lib", "nex1-cycle4-fixtures");
const OUT_DIR = path.join(REPO, "data", "nex1-cycle-4");
fs.mkdirSync(OUT_DIR, { recursive: true });

// Three fresh, adversarial-family fixtures NEX has never seen
const FRESH = [
  {
    id: "N1_conditional_binary",
    fn: "sextantHeading",
    source: (fn) => `export function ${fn}(atNoon: boolean): number {\n  if (atNoon) return 12;\n  return 24;\n}\n`,
    assertion: (fn) => `expect(${fn}(true)).toBe(360)`,
    input: "true",
    expected: "360",
    execution_path_ambiguous: true, // if-branch reached, not fall-through
  },
  {
    id: "N2_early_guard_negative",
    fn: "compassBias",
    source: (fn) => `export function ${fn}(dampen: number): number {\n  if (dampen < 0) return 0;\n  return 45;\n}\n`,
    assertion: (fn) => `expect(${fn}(-2)).toBe(-90)`,
    input: "-2",
    expected: "-90",
    execution_path_ambiguous: true, // guard-branch reached (unlike D which skipped its guard)
  },
  {
    id: "N3_no_ambiguity",
    fn: "quarantineLevel",
    source: (fn) => `export function ${fn}(): number {\n  return 3;\n}\n`,
    assertion: (fn) => `expect(${fn}()).toBe(42)`,
    input: "()",
    expected: "42",
    execution_path_ambiguous: false, // baseline · single return · clearly correct if mutation applies
  },
];

function writeFixture(sc) {
  fs.mkdirSync(FIX_DIR, { recursive: true });
  const src = path.join(FIX_DIR, `${sc.fn}.ts`);
  const test = path.join(FIX_DIR, `${sc.fn}.assertion.ts`);
  fs.writeFileSync(src, sc.source(sc.fn), "utf8");
  fs.writeFileSync(
    test,
    `import { describe, it, expect } from "vitest";\nimport { ${sc.fn} } from "./${sc.fn}";\ndescribe("${sc.fn}", () => {\n  it("returns ${sc.expected}", () => {\n    ${sc.assertion(sc.fn)};\n  });\n});\n`,
    "utf8",
  );
  return src;
}
function cleanupFixture(sc) {
  try { fs.unlinkSync(path.join(FIX_DIR, `${sc.fn}.ts`)); } catch { /* ignore */ }
  try { fs.unlinkSync(path.join(FIX_DIR, `${sc.fn}.assertion.ts`)); } catch { /* ignore */ }
}

async function observeExecutionPath(sc) {
  const src = fs.readFileSync(path.join(FIX_DIR, `${sc.fn}.ts`), "utf8");
  const lines = src.split(/\r?\n/);
  const rewritten = lines.map((l, i) => {
    return l.replace(/(\breturn\b)\s+([^;\n]+);?/, (m, kw, expr) => {
      return `${kw} (globalThis.__EXEC_LINE__ = ${i + 1}, ${expr});`;
    });
  }).join("\n");
  let js = rewritten
    .replace(/^\s*export\s+/gm, "export ")
    .replace(/:\s*(?:number|boolean|string|void|RegExp|any|unknown)\b/g, "")
    .replace(/^\s*function\s+([a-zA-Z_$][\w$]*)\s*\(([^)]*)\)\s*:\s*[^\s{]+/gm, "function $1($2)")
    .replace(/^\s*export\s+function\s+([a-zA-Z_$][\w$]*)\s*\(([^)]*)\)\s*:\s*[^\s{]+/gm, "export function $1($2)");
  const scratchDir = path.join(FIX_DIR, "_probe");
  fs.mkdirSync(scratchDir, { recursive: true });
  const scratchFile = path.join(scratchDir, `${sc.fn}.probe.mjs`);
  fs.writeFileSync(scratchFile, js, "utf8");
  try {
    globalThis.__EXEC_LINE__ = null;
    const mod = await import(pathToFileURL(scratchFile).href);
    const argList = sc.input === "()" ? [] : sc.input.split(",").map((s) => JSON.parse(s.trim()));
    try {
      mod[sc.fn](...argList);
      return { execution_line: globalThis.__EXEC_LINE__ };
    } catch {
      return { execution_line: globalThis.__EXEC_LINE__ };
    }
  } finally {
    try { fs.unlinkSync(scratchFile); } catch { /* ignore */ }
    try { fs.rmdirSync(scratchDir); } catch { /* ignore */ }
  }
}

async function main() {
  const mbq = await import(pathToFileURL(path.join(REPO, "src/lib/nex-agent/code-engine/capability-mb-outcome-quality.ts")).href);
  const oe = await import(pathToFileURL(path.join(REPO, "src/lib/nex-agent/code-engine/capability-outcome-experience.ts")).href);
  const loop = await import(pathToFileURL(path.join(REPO, "src/lib/nex-agent/code-engine/capability-specification-driven-loop.ts")).href);

  const priorEntries = oe.loadAllOutcomes(REPO);
  const priorCount = priorEntries.length;

  const runs = [];
  for (const sc of FRESH) {
    cleanupFixture(sc);
    writeFixture(sc);
    const rel = `src/lib/nex1-cycle4-fixtures/${sc.fn}.ts`;

    // ── PHASE C · consult mb_outcome_quality BEFORE running the loop ──
    // The brain reads the outcome-experience store (currently 6 entries
    // from Ledger B substrate phase). Prediction is informational only.
    const preAction = mbq.predictOutcomeQuality({
      kind: "proposed_action",
      data: {
        source_file: rel,
        j2_response_kind: "proposal", // conservative assumption before J.2 runs
        execution_path_known: true, // we observe post-hoc regardless
        repo_root: REPO,
      },
    });

    // ── observe pre-mutation execution path ──
    const preExec = await observeExecutionPath(sc).catch(() => ({ execution_line: null }));

    // ── run coding loop ──
    const stages = [];
    let overall_verdict;
    try {
      const r = await loop.runSpecificationDrivenCodingLoop({
        founder_goal: `Fix ${rel}. When ${sc.fn} is called, it should return ${sc.expected}.`,
        target_source_file: rel,
        repo_root: REPO,
        test_timeout_ms: 120_000,
        onStage: (s) => stages.push({ stage: String(s.stage), verdict: String(s.verdict), evidence: Array.isArray(s.evidence) ? s.evidence.map(String) : [] }),
      });
      overall_verdict = r.overall_verdict;
    } catch (e) {
      overall_verdict = `THREW_${String(e).slice(0, 40)}`;
    }

    // ── observe post-mutation execution path ──
    const postExec = await observeExecutionPath(sc).catch(() => ({ execution_line: null }));

    // ── extract facts ──
    const changeStage = stages.find((s) => s.stage === "change");
    const mutMatch = changeStage?.evidence?.[0]?.match(/=\['(.+?)@(\d+)'\]/);
    const mutation_applied = Boolean(mutMatch);
    const mutation_line = mutMatch ? Number(mutMatch[2]) : null;
    const actual_execution_line = postExec.execution_line ?? preExec.execution_line;
    const mutation_targets_execution_path =
      mutation_line !== null && actual_execution_line !== null
        ? mutation_line === actual_execution_line
        : null;

    // ── append this outcome to the store for future predictions ──
    oe.appendOutcome({
      target_source_file: rel,
      founder_goal: `Fix ${rel}. When ${sc.fn} is called, it should return ${sc.expected}.`,
      assertion_expression: sc.assertion(sc.fn),
      assertion_input_verbatim: sc.input,
      j2_response_kind: mutation_applied ? "proposal" : "refusal",
      j2_proposal_text: null,
      j2_refusal_kind: null,
      mutation_applied,
      mutation_target_line: mutation_line,
      mutation_before_text: mutMatch ? mutMatch[1].split("→")[0] : null,
      mutation_after_text: mutMatch ? mutMatch[1].split("→")[1] : null,
      actual_execution_path_line: actual_execution_line,
      execution_path_evidence_kind: actual_execution_line !== null ? "OBSERVED" : "UNAVAILABLE",
      spec_test_after_mutation: "not_run", // simplified for Phase D · fixture verdict harness has known bug
      fixture_test_after_mutation: "not_run",
      loop_overall_verdict: overall_verdict,
      mutation_target_matches_execution_path: mutation_targets_execution_path,
      spec_and_fixture_verdicts_agree: null,
      confidence_reported_by_j2: null,
    }, REPO);

    // ── scoring · did the brain's pre-action prediction align with reality? ──
    let prediction_matches_outcome = "not_applicable";
    if (mutation_targets_execution_path !== null) {
      const brainSaid = preAction.prediction;
      if (mutation_targets_execution_path === true) {
        // Reality · mutation was on-target. Brain predicting "safe" would be right,
        // "risky" wrong, "unknown" not-comparable.
        prediction_matches_outcome = brainSaid === "safe_by_prior_evidence" ? "correct" : brainSaid === "risky_by_prior_evidence" ? "wrong" : "unknown_not_comparable";
      } else {
        prediction_matches_outcome = brainSaid === "risky_by_prior_evidence" ? "correct" : brainSaid === "safe_by_prior_evidence" ? "wrong" : "unknown_not_comparable";
      }
    }

    runs.push({
      scenario_id: sc.id,
      execution_path_ambiguous: sc.execution_path_ambiguous,
      pre_action_prediction: preAction.prediction,
      pre_action_confidence: preAction.confidence,
      pre_action_rule_hits: preAction.rule_hits,
      overall_verdict,
      mutation_applied,
      mutation_line,
      actual_execution_line,
      mutation_targets_execution_path,
      prediction_matches_outcome,
    });

    cleanupFixture(sc);
  }
  try { fs.rmdirSync(FIX_DIR); } catch { /* ignore */ }

  const receipt = {
    experiment: "Cycle 4 · Phase C+D · runtime measurement",
    date: new Date().toISOString(),
    zero_llm: true,
    ledger_b_additions_this_phase: [
      "src/lib/nex-agent/code-engine/capability-mb-outcome-quality.ts",
      "scripts/nex1-cycle-4/phase-c-d-runtime-measurement.mjs",
    ],
    engineer_source_modifications_to_existing_files: 0,
    priors_available_at_start: priorCount,
    runs,
    aggregate: {
      total_scenarios: runs.length,
      predictions_correct: runs.filter((r) => r.prediction_matches_outcome === "correct").length,
      predictions_wrong: runs.filter((r) => r.prediction_matches_outcome === "wrong").length,
      predictions_unknown: runs.filter((r) => r.prediction_matches_outcome === "unknown_not_comparable").length,
      not_applicable: runs.filter((r) => r.prediction_matches_outcome === "not_applicable").length,
    },
  };
  fs.writeFileSync(
    path.join(OUT_DIR, "phase-c-d-runtime-measurement-receipt.json"),
    JSON.stringify(receipt, null, 2),
    "utf8",
  );

  console.log("=== CYCLE 4 · PHASE C+D · RUNTIME MEASUREMENT ===\n");
  console.log("priors available at start of phase:", priorCount);
  for (const r of runs) {
    console.log(`${r.scenario_id.padEnd(28)} ambiguous=${r.execution_path_ambiguous}`);
    console.log(`  pre-action prediction: ${r.pre_action_prediction} (confidence=${r.pre_action_confidence})`);
    console.log(`  rule_hits: [${r.pre_action_rule_hits.join(",")}]`);
    console.log(`  actual: mutation @ ${r.mutation_line} · exec_line=${r.actual_execution_line} · targets_path=${r.mutation_targets_execution_path}`);
    console.log(`  prediction vs outcome: ${r.prediction_matches_outcome}`);
    console.log();
  }
  console.log("=== AGGREGATE ===");
  console.log(JSON.stringify(receipt.aggregate, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
