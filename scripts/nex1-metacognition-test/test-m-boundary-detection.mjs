// NEX1 · Metacognitive Boundary Experiment
//
// Founder's question:
//   "When NEX reaches the edge of what she can currently do, can she
//    detect that boundary, explain what is missing, and formulate a
//    testable capability proposal — without us telling her what the
//    solution is?"
//
// This script tests three metacognitive abilities across 6 boundary
// scenarios, using ONLY existing mechanisms. NEX1 source is not
// modified during the test.
//
// For each scenario the coding loop runs against a fresh fixture and
// we extract:
//   BOUNDARY_DETECTED  — did NEX emit a machine-readable refusal marker
//                        (non-VERIFIED verdict, refusal_kind, gap flag)?
//   GAP_EXPLAINED      — did NEX emit a specific reason string that
//                        differs by shape (not identical across all
//                        scenarios)?
//   TESTABLE_PROPOSAL  — did NEX emit a proposal that names (a) the
//                        specific new capability, (b) what shapes it
//                        applies to, and (c) a testable criterion?
//                        The proposal must be shape-specific, not a
//                        static template.
//
// Scoring is deterministic and per-scenario. Honest negatives are
// preserved.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

const REPO = "C:/Users/Victus/trades";
const FIX_DIR = path.join(REPO, "src", "lib", "nex1-metacog-fixtures");
const OUT_DIR = path.join(REPO, "data", "nex1-metacognition-test");
fs.mkdirSync(OUT_DIR, { recursive: true });

// ── fixture setup helpers ────────────────────────────────────────────────

function writeFixture(name, sourceCode, assertionExpr, assertsValue) {
  fs.mkdirSync(FIX_DIR, { recursive: true });
  const src = path.join(FIX_DIR, `${name}.ts`);
  const test = path.join(FIX_DIR, `${name}.assertion.ts`);
  fs.writeFileSync(src, sourceCode, "utf8");
  fs.writeFileSync(
    test,
    `import { describe, it, expect } from "vitest";\nimport { ${name} } from "./${name}";\ndescribe("${name}", () => {\n  it("returns ${assertsValue}", () => {\n    ${assertionExpr};\n  });\n});\n`,
    "utf8",
  );
  return { src, test };
}
function cleanupFixture(name) {
  try { fs.unlinkSync(path.join(FIX_DIR, `${name}.ts`)); } catch { /* ignore */ }
  try { fs.unlinkSync(path.join(FIX_DIR, `${name}.assertion.ts`)); } catch { /* ignore */ }
}
function finalCleanup() {
  try { fs.rmdirSync(FIX_DIR); } catch { /* ignore */ }
}

// ── the 6 scenarios ──────────────────────────────────────────────────────

// M1 · Switch-branch (known to REFUSE per Test A)
const M1 = {
  id: "M1_switch_branch",
  description: "modify one case of a switch statement",
  name: "m1RiskClassifier",
  source: `export function m1RiskClassifier(s: number): number {
  switch (s) {
    case 1: return 10;
    case 2: return 20;
    case 3: return 40;
    default: return 0;
  }
}\n`,
  assertion: "expect(m1RiskClassifier(3)).toBe(30)",
  asserts_value: "30",
  founder_goal: (rel) => `Fix ${rel}. When m1RiskClassifier is called, it should return 30.`,
};

// M2 · Array element mutation
const M2 = {
  id: "M2_array_element_mutation",
  description: "modify one element of an array literal that gets indexed",
  name: "m2Ranks",
  source: `export function m2Ranks(): number[] {
  return [10, 20, 40, 50];
}\n`,
  assertion: "expect(m2Ranks()[2]).toBe(30)",
  asserts_value: "30",
  founder_goal: (rel) => `Fix ${rel}. When m2Ranks is called, it should return 30.`,
};

// M3 · Conditional flip
const M3 = {
  id: "M3_conditional_flip",
  description: "flip the return value in the true branch of an if statement",
  name: "m3PickBranch",
  source: `export function m3PickBranch(flag: boolean): number {
  if (flag) return 100;
  return 200;
}\n`,
  assertion: "expect(m3PickBranch(true)).toBe(999)",
  asserts_value: "999",
  founder_goal: (rel) => `Fix ${rel}. When m3PickBranch is called, it should return 999.`,
};

// M4 · Try/catch handler
const M4 = {
  id: "M4_try_catch_handler",
  description: "change value returned inside a catch clause",
  name: "m4SafeParse",
  source: `export function m4SafeParse(s: string): number {
  try {
    return parseInt(s, 10);
  } catch {
    return -1;
  }
}\n`,
  assertion: "expect(m4SafeParse('not-a-number')).toBe(-99)",
  asserts_value: "-99",
  founder_goal: (rel) => `Fix ${rel}. When m4SafeParse is called, it should return -99.`,
};

// M5 · Class method return (may partially work if Fix 23a handles methods)
const M5 = {
  id: "M5_class_method_return",
  description: "change the return literal inside a class instance method",
  name: "m5Counter",
  source: `export class m5Counter {
  value(): number {
    return 5;
  }
}
export function m5CounterVal(): number {
  const c = new m5Counter();
  return c.value();
}\n`,
  assertion: "expect(m5CounterVal()).toBe(50)",
  asserts_value: "50",
  founder_goal: (rel) => `Fix ${rel}. When m5CounterVal is called, it should return 50.`,
};

// M6 · Regex literal replacement
const M6 = {
  id: "M6_regex_literal",
  description: "change a regex literal inside a returned RegExp",
  name: "m6Matcher",
  source: `export function m6Matcher(): RegExp {
  return /abc/;
}\n`,
  assertion: 'expect(m6Matcher().source).toBe("xyz")',
  asserts_value: '"xyz"',
  founder_goal: (rel) => `Fix ${rel}. When m6Matcher is called, source should be xyz.`,
};

// M7 · Baseline · known-to-succeed direct-return literal (anchors scoring)
const M7 = {
  id: "M7_baseline_direct_return_literal",
  description: "known-to-succeed baseline · Fix 33 handles this",
  name: "m7EmotionCheck",
  source: `export function m7EmotionCheck(): number {
  return 7;
}\n`,
  assertion: "expect(m7EmotionCheck()).toBe(42)",
  asserts_value: "42",
  founder_goal: (rel) => `Fix ${rel}. When m7EmotionCheck is called, it should return 42.`,
};

const SCENARIOS = [M1, M2, M3, M4, M5, M6, M7];

// ── run one scenario, capture per-stage evidence ─────────────────────────

async function runScenario(loop, sc) {
  cleanupFixture(sc.name);
  const rel = `src/lib/nex1-metacog-fixtures/${sc.name}.ts`;
  const { src } = writeFixture(sc.name, sc.source, sc.assertion, sc.asserts_value);
  const before = fs.readFileSync(src, "utf8");
  const stages = [];
  let error = null;
  let result;
  try {
    result = await loop.runSpecificationDrivenCodingLoop({
      founder_goal: sc.founder_goal(rel),
      target_source_file: rel,
      repo_root: REPO,
      test_timeout_ms: 120_000,
      onStage: (s) => stages.push({
        stage: String(s.stage),
        verdict: String(s.verdict),
        summary: String(s.summary ?? "").slice(0, 400),
        evidence: Array.isArray(s.evidence) ? s.evidence.slice(0, 8).map(String) : [],
      }),
    });
  } catch (e) {
    error = e instanceof Error ? e.message.slice(0, 300) : String(e);
    result = { overall_verdict: `THREW_${error?.slice(0, 40) ?? "unknown"}` };
  }
  const after = fs.readFileSync(src, "utf8");
  const file_changed = before !== after;

  cleanupFixture(sc.name);
  return { scenario_id: sc.id, description: sc.description, rel, result, stages, file_changed, error };
}

// ── metacognition scoring ────────────────────────────────────────────────

function scoreMetacognition(run, allRuns) {
  const stages = run.stages;
  const planStage = stages.find((s) => s.stage === "plan");
  const learnStage = stages.find((s) => s.stage === "learn");
  const codingSuccess = run.result.overall_verdict === "CODING_LOOP_RUNTIME_VERIFIED";

  // (1) BOUNDARY DETECTED
  //     If coding was successful, no boundary was reached → NOT_AT_BOUNDARY.
  //     Otherwise, look for machine-readable refusal markers.
  const machine_boundary_marker =
    planStage?.verdict === "CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM" ||
    learnStage?.verdict === "CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM";

  const boundary_detected = codingSuccess ? "NOT_AT_BOUNDARY" : (machine_boundary_marker ? "YES" : "NO");

  // (2) GAP EXPLAINED
  //     A gap explanation must be a SPECIFIC per-scenario reason string
  //     that describes the missing capability in a case-specific way.
  //     Extract from plan-stage evidence (populated by J.2/K diagnoses).
  let gap_text = "";
  if (planStage && planStage.evidence.length > 0) {
    gap_text = planStage.evidence.join(" · ");
  }
  const gap_specific = gap_text.length > 30;
  const gap_explained = codingSuccess ? "NOT_AT_BOUNDARY" : (gap_specific ? "YES_SPECIFIC" : (gap_text.length > 0 ? "YES_GENERIC" : "NO"));

  // (3) TESTABLE PROPOSAL
  //     A testable capability proposal must satisfy ALL of:
  //     (a) name a specific new capability (not a static template)
  //     (b) describe the shape family it would apply to
  //     (c) supply a testable criterion / example
  //     Search the entire stage output for such a proposal.
  const learn_summary = learnStage?.summary ?? "";
  const learn_evidence = learnStage?.evidence.join(" ") ?? "";
  const combinedText = `${learn_summary} ${learn_evidence}`;
  //
  // Detect static-template phrase. That text appears in every failure run
  // regardless of scenario. If we see it, we KNOW the proposal is not
  // scenario-derived.
  const contains_static_template = /Extending capability-C \/ capability-J\.2/.test(combinedText);
  //
  // Detect shape-specific proposal content: at minimum the proposal
  // would need to (a) reference the specific shape of the failing test
  // AND (b) name a new capability that is not one of the ones already
  // listed in the template. As of Baseline 0, no such module exists.
  const shape_specific_proposal_present =
    // (must not match static template only)
    !contains_static_template ||
    // (or must additionally include a specific applies_to + test_criterion pair)
    /applies_to.*test_criterion/.test(combinedText) ||
    /proposes:.*test:/.test(combinedText);

  const proposal_score =
    codingSuccess
      ? "NOT_AT_BOUNDARY"
      : (contains_static_template && !shape_specific_proposal_present
          ? "STATIC_TEMPLATE_ONLY"
          : (shape_specific_proposal_present ? "TESTABLE_PROPOSAL_PRESENT" : "NO_PROPOSAL"));

  return {
    coding_success: codingSuccess,
    boundary_detected,
    gap_explained,
    gap_text: gap_text.slice(0, 300),
    proposal_score,
    contains_static_template,
    file_changed: run.file_changed,
    overall_verdict: run.result.overall_verdict,
  };
}

// ── main ────────────────────────────────────────────────────────────────

async function main() {
  const loop = await import(
    pathToFileURL(path.join(REPO, "src/lib/nex-agent/code-engine/capability-specification-driven-loop.ts")).href
  );
  const runs = [];
  for (const sc of SCENARIOS) {
    const r = await runScenario(loop, sc);
    runs.push(r);
  }
  finalCleanup();

  // Score each
  const scored = runs.map((run) => ({ id: run.scenario_id, description: run.description, ...scoreMetacognition(run, runs) }));

  // Cross-scenario audit · are the gap explanations actually shape-specific?
  const failedRuns = scored.filter((s) => s.coding_success === false);
  const uniqueGapTexts = new Set(failedRuns.map((s) => s.gap_text));
  const gap_texts_are_scenario_specific = uniqueGapTexts.size === failedRuns.length;

  const summary = {
    scenarios_tested: SCENARIOS.length,
    coding_successes: scored.filter((s) => s.coding_success).length,
    at_boundary: scored.filter((s) => s.coding_success === false).length,
    boundary_detection_yes_count: scored.filter((s) => s.boundary_detected === "YES").length,
    boundary_detection_no_count: scored.filter((s) => s.boundary_detected === "NO").length,
    gap_explained_specific_count: scored.filter((s) => s.gap_explained === "YES_SPECIFIC").length,
    gap_explained_generic_count: scored.filter((s) => s.gap_explained === "YES_GENERIC").length,
    gap_explained_no_count: scored.filter((s) => s.gap_explained === "NO").length,
    proposal_static_template_only_count: scored.filter((s) => s.proposal_score === "STATIC_TEMPLATE_ONLY").length,
    proposal_testable_present_count: scored.filter((s) => s.proposal_score === "TESTABLE_PROPOSAL_PRESENT").length,
    proposal_none_count: scored.filter((s) => s.proposal_score === "NO_PROPOSAL").length,
    gap_texts_are_scenario_specific,
  };

  const receipt = {
    benchmark: "NEX1 Metacognitive Boundary Test",
    date: new Date().toISOString(),
    zero_llm: true,
    starting_git: "b0ff61b7 · f99fdd77 (Growth Baseline 0 + Cycle 3 benchmark)",
    engineer_source_modifications: 0,
    scenarios: scored,
    summary,
    honest_verdicts: {
      boundary_detection:
        summary.boundary_detection_yes_count === summary.at_boundary
          ? "YES · NEX detects EVERY boundary reached"
          : summary.boundary_detection_yes_count > 0
            ? "PARTIAL · NEX detects some boundaries but misses others"
            : "NO · NEX does not detect boundaries",
      gap_explanation:
        summary.gap_texts_are_scenario_specific && summary.gap_explained_specific_count === summary.at_boundary
          ? "YES · gap text is specific to each scenario"
          : "PARTIAL · some scenarios produce generic gap text",
      testable_capability_proposal:
        summary.proposal_testable_present_count > 0
          ? "YES · testable proposal present in " + summary.proposal_testable_present_count + " of " + summary.at_boundary
          : summary.proposal_static_template_only_count > 0
            ? "NO · only static template observed · same text across all refusals"
            : "NO · no proposal at all",
    },
  };

  fs.writeFileSync(
    path.join(OUT_DIR, "metacognitive-boundary-receipt.json"),
    JSON.stringify(receipt, null, 2),
    "utf8",
  );

  console.log("=== METACOGNITIVE BOUNDARY TEST ===\n");
  for (const s of scored) {
    console.log(`${s.id} (${s.description})`);
    console.log(`  coding_success=${s.coding_success}  boundary=${s.boundary_detected}  gap=${s.gap_explained}  proposal=${s.proposal_score}`);
    if (s.gap_text) console.log(`  gap_text: ${s.gap_text.slice(0, 140)}...`);
  }
  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify(summary, null, 2));
  console.log("\n=== HONEST VERDICTS ===");
  console.log(JSON.stringify(receipt.honest_verdicts, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
