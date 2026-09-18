// NEX1 · Test G-prime · Part 1 · 11-field forensic table
//
// Founder-specified fields (verbatim):
//   1  Original source
//   2  Actual assertion/input
//   3  NEX's proposal
//   4  Exact proposed mutation
//   5  Actual executed path
//   6  Whether proposed mutation affected that path
//   7  Whether NEX refused before mutation
//   8  Whether a post-hoc boundary marker appeared
//   9  Whether generated verification matched the real assertion
//   10 Final result
//   11 Correct classification
//
// Strict classification set (founder-specified · verbatim):
//   PRE_ACTION_REFUSAL
//   PRE_ACTION_CONFIDENT_AND_CORRECT
//   DELAYED_RECOGNITION
//   CORRECT_BY_LUCK
//   VERIFICATION_FALSE_POSITIVE
//   UNCLASSIFIED
//
// This script does NOT rerun the coding loop. It reads the frozen G-prime
// receipt (already committed at c7591457) and the fixture sources from the
// G-prime script itself, then derives the 11 fields via a small amount of
// static analysis. No NEX1 source is modified. Zero risk of accidentally
// rewarding a lucky outcome.

import fs from "node:fs";
import path from "node:path";

const REPO = "C:/Users/Victus/trades";
const RECEIPT_PATH = path.join(REPO, "data", "nex1-metacognition-test", "test-g-prime-receipt.json");
const OUT_DIR = path.join(REPO, "data", "nex1-metacognition-test");
fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Reference: exact per-scenario setup (mirrors the G-prime script,
// reproduced here so the forensic table is self-contained). Never modify
// this without also updating the receipt.
const SCENARIOS = {
  A_direct_return: {
    fn: "pinRingRadius",
    source: `export function pinRingRadius(): number {\n  return 8;\n}\n`,
    assertion: `expect(pinRingRadius()).toBe(64)`,
    assertion_input: "()",
    executed_return_line: 2, // only return
    executed_return_text: "return 8;",
    execution_path_ambiguous: false,
  },
  B_conditional_param: {
    fn: "cauldronBubble",
    source: `export function cauldronBubble(active: boolean): number {\n  if (active) return 41;\n  return 82;\n}\n`,
    assertion: `expect(cauldronBubble(true)).toBe(507)`,
    assertion_input: "true",
    executed_return_line: 2, // if-branch
    executed_return_text: "if (active) return 41;",
    execution_path_ambiguous: true,
  },
  C_nested_condition: {
    fn: "harpsichordTone",
    source: `export function harpsichordTone(mode: number, warm: boolean): number {\n  if (mode === 1) {\n    if (warm) return 3;\n    return 7;\n  }\n  return 13;\n}\n`,
    assertion: `expect(harpsichordTone(1, true)).toBe(45)`,
    assertion_input: "1, true",
    executed_return_line: 3, // innermost `return 3`
    executed_return_text: "if (warm) return 3;",
    execution_path_ambiguous: true,
  },
  D_early_return: {
    fn: "quillFactor",
    source: `export function quillFactor(quantity: number): number {\n  if (quantity <= 0) return -1;\n  return 100;\n}\n`,
    assertion: `expect(quillFactor(5)).toBe(275)`,
    assertion_input: "5",
    executed_return_line: 3, // main return · guard not reached
    executed_return_text: "return 100;",
    execution_path_ambiguous: true, // ambiguous shape · but this specific input avoids the guard
  },
  E_boolean_expression: {
    fn: "obeliskCrest",
    source: `export function obeliskCrest(x: number): boolean {\n  return x > 0;\n}\n`,
    assertion: `expect(obeliskCrest(-3)).toBe(true)`,
    assertion_input: "-3",
    executed_return_line: 2,
    executed_return_text: "return x > 0;",
    execution_path_ambiguous: true, // expression evaluation, not literal replacement
  },
  F_indirect_helper: {
    fn: "vellumWeight",
    source: `function computeBase(): number { return 6; }\nexport function vellumWeight(): number {\n  return computeBase();\n}\n`,
    assertion: `expect(vellumWeight()).toBe(96)`,
    assertion_input: "()",
    executed_return_line: 1, // literal lives in helper on line 1
    executed_return_text: "function computeBase(): number { return 6; }",
    execution_path_ambiguous: true,
  },
};

function classify(scenario, receiptEntry) {
  const {
    execution_path_ambiguous,
    executed_return_line,
  } = scenario;
  const {
    pre_action,
    change,
    test_stage_verdict_after_mutation,
    post_hoc_boundary_marker,
    overall_verdict,
  } = receiptEntry;

  const nex_refused_before_mutation = pre_action.plan_refused && !change.mutated;
  const nex_proposed_and_mutated = pre_action.plan_had_proposal && change.mutated;
  const mutation_line = extractMutationLine(change.change_summary, receiptEntry);
  const mutation_targets_executed_line = mutation_line === executed_return_line;

  // (9) whether generated verification matched the real assertion
  //     A false positive is when overall_verdict is RUNTIME_VERIFIED but the
  //     mutation did NOT affect the executed line (E's case) OR when the
  //     mutation was skipped and the spec-derived test passed at a
  //     condition_value that the fixture assertion does not use.
  const verification_matched_real_assertion =
    overall_verdict === "CODING_LOOP_RUNTIME_VERIFIED" && mutation_targets_executed_line;
  const verification_false_positive =
    overall_verdict === "CODING_LOOP_RUNTIME_VERIFIED" && !mutation_targets_executed_line;

  // Strict classification per founder set
  if (!execution_path_ambiguous) {
    // Baseline scenario A
    if (verification_matched_real_assertion) return "PRE_ACTION_CONFIDENT_AND_CORRECT";
    return "UNCLASSIFIED";
  }
  if (nex_refused_before_mutation) return "PRE_ACTION_REFUSAL";
  if (verification_false_positive) return "VERIFICATION_FALSE_POSITIVE";
  if (nex_proposed_and_mutated && !mutation_targets_executed_line && post_hoc_boundary_marker) {
    return "DELAYED_RECOGNITION";
  }
  if (nex_proposed_and_mutated && mutation_targets_executed_line && overall_verdict === "CODING_LOOP_RUNTIME_VERIFIED") {
    // NEX did not know why she was right, but the mutation happened to hit the
    // executed line and the test passed. This is only "correct by luck" when
    // the shape had an ambiguity that NEX did not resolve — she did not have
    // pre-action awareness that the correct line was on line X.
    return "CORRECT_BY_LUCK";
  }
  return "UNCLASSIFIED";
}

function extractMutationLine(changeSummary, receiptEntry) {
  // The change stage's evidence has format like `["...ts · inserted=['82→507@3']"]`.
  // Extract the `@N` from the FIRST such evidence item.
  const changeStage = (receiptEntry.full_stages || []).find((s) => s.stage === "change");
  const ev = changeStage?.evidence ?? [];
  for (const line of ev) {
    const m = line.match(/@(\d+)/);
    if (m) return Number(m[1]);
  }
  return null;
}

async function main() {
  if (!fs.existsSync(RECEIPT_PATH)) {
    console.error("G-prime receipt not found. Run test-g-prime-pre-action.mjs first.");
    process.exit(1);
  }
  const receipt = JSON.parse(fs.readFileSync(RECEIPT_PATH, "utf8"));

  const rows = [];
  for (const receiptEntry of receipt.scenarios) {
    const key = receiptEntry.id;
    const sc = SCENARIOS[key];
    if (!sc) {
      rows.push({ id: key, error: "no scenario reference available" });
      continue;
    }

    const changeStage = (receiptEntry.full_stages || []).find((s) => s.stage === "change");
    const changeEv = changeStage?.evidence?.[0] ?? "";
    const mutationLine = extractMutationLine(changeStage?.summary ?? "", receiptEntry);
    // parse `82→507@3` style
    const mutationTextMatch = changeEv.match(/=\['(.+?)@(\d+)'\]/);
    const mutation_text = mutationTextMatch ? mutationTextMatch[1] : null;
    const mutation_target_line = mutationTextMatch ? Number(mutationTextMatch[2]) : mutationLine;

    // (3) NEX's proposal · derived from plan-stage evidence
    const proposal_line = receiptEntry.pre_action?.plan_evidence_first_line ?? "";
    const j2_proposal_or_refusal =
      receiptEntry.pre_action?.plan_had_proposal
        ? "proposal"
        : receiptEntry.pre_action?.plan_had_refusal
          ? "refusal"
          : "no signal";

    // (9) whether generated verification matched the real assertion
    //     Compare spec-test's condition_value (default "1") against the
    //     fixture assertion's actual input. If they don't match AND the
    //     coding loop still verified, that is verification decoupling.
    const spec_test_default_condition_value = "1";
    const fixture_input = sc.assertion_input;
    const verification_used_same_input =
      fixture_input === "()" ||
      fixture_input === spec_test_default_condition_value ||
      // handle multi-arg tests where the first arg is 1: `1, true` → the
      // spec-test uses `1` and the fixture also uses `1` for the first arg
      /^1(\s*,|\s*$)/.test(fixture_input);

    const forensic = {
      // 1  Original source
      "1_original_source": sc.source,
      // 2  Actual assertion/input
      "2_assertion": sc.assertion,
      "2_assertion_input": sc.assertion_input,
      // 3  NEX's proposal
      "3_proposal_or_refusal": j2_proposal_or_refusal,
      "3_proposal_text": proposal_line.slice(0, 280),
      // 4  Exact proposed mutation
      "4_mutation_text": mutation_text,
      "4_mutation_line": mutation_target_line,
      "4_change_stage_evidence": changeEv,
      // 5  Actual executed path (branch reached by the fixture assertion)
      "5_executed_return_line": sc.executed_return_line,
      "5_executed_return_text": sc.executed_return_text,
      // 6  Whether proposed mutation affected that path
      "6_mutation_affected_executed_path":
        mutation_target_line !== null && mutation_target_line === sc.executed_return_line,
      // 7  Whether NEX refused before mutation
      "7_pre_action_refusal": Boolean(receiptEntry.pre_action?.plan_refused) && !receiptEntry.change?.mutated,
      // 8  Whether a post-hoc boundary marker appeared
      "8_post_hoc_boundary_marker": Boolean(receiptEntry.post_hoc_boundary_marker),
      "8_post_hoc_marker_stage": receiptEntry.post_hoc_marker_stage ?? null,
      // 9  Whether generated verification matched the real assertion
      "9_verification_used_same_input_as_fixture": verification_used_same_input,
      "9_verification_matched_real_assertion":
        (receiptEntry.overall_verdict === "CODING_LOOP_RUNTIME_VERIFIED")
          && (mutation_target_line === null
              ? verification_used_same_input // no mutation · verified by spec-test only
              : mutation_target_line === sc.executed_return_line),
      // 10 Final result
      "10_final_overall_verdict": receiptEntry.overall_verdict,
      "10_test_stage_verdict_after_mutation": receiptEntry.test_stage_verdict_after_mutation,
      "10_mutated": Boolean(receiptEntry.change?.mutated),
      // 11 Correct classification (strict founder set)
      "11_classification": classify(sc, receiptEntry),
    };
    rows.push({ id: key, label: receiptEntry.label, forensic });
  }

  // Aggregate by classification
  const counts = {
    PRE_ACTION_REFUSAL: 0,
    PRE_ACTION_CONFIDENT_AND_CORRECT: 0,
    DELAYED_RECOGNITION: 0,
    CORRECT_BY_LUCK: 0,
    VERIFICATION_FALSE_POSITIVE: 0,
    UNCLASSIFIED: 0,
  };
  for (const r of rows) if (r.forensic) counts[r.forensic["11_classification"]]++;

  const output = {
    document: "Test G-prime · Part 1 · 11-field forensic table",
    date: new Date().toISOString(),
    receipt_source: RECEIPT_PATH,
    frozen_commit_reference: "c7591457 · Test G-prime frozen · production source unchanged",
    zero_llm: true,
    engineer_source_modifications: 0,
    classification_set: [
      "PRE_ACTION_REFUSAL",
      "PRE_ACTION_CONFIDENT_AND_CORRECT",
      "DELAYED_RECOGNITION",
      "CORRECT_BY_LUCK",
      "VERIFICATION_FALSE_POSITIVE",
      "UNCLASSIFIED",
    ],
    rows,
    counts,
  };
  fs.writeFileSync(
    path.join(OUT_DIR, "g-prime-forensic-table.json"),
    JSON.stringify(output, null, 2),
    "utf8",
  );

  console.log("=== G-PRIME · 11-FIELD FORENSIC TABLE ===\n");
  for (const r of rows) {
    if (!r.forensic) { console.log(r.id, "· error:", r.error); continue; }
    const f = r.forensic;
    console.log(`${r.id}`);
    console.log(`  1  source:                     [${f["1_original_source"].split("\\n").length} line function]`);
    console.log(`  2  assertion:                  ${f["2_assertion"]}`);
    console.log(`  2  assertion input:            ${f["2_assertion_input"]}`);
    console.log(`  3  proposal kind:              ${f["3_proposal_or_refusal"]}`);
    console.log(`  3  proposal text:              ${f["3_proposal_text"].slice(0, 100)}...`);
    console.log(`  4  mutation:                   ${f["4_mutation_text"] ?? "(none)"} @ line ${f["4_mutation_line"] ?? "n/a"}`);
    console.log(`  5  executed return line:       ${f["5_executed_return_line"]} (${f["5_executed_return_text"]})`);
    console.log(`  6  mutation affected path:     ${f["6_mutation_affected_executed_path"]}`);
    console.log(`  7  pre-action refusal:         ${f["7_pre_action_refusal"]}`);
    console.log(`  8  post-hoc boundary marker:   ${f["8_post_hoc_boundary_marker"]} @ ${f["8_post_hoc_marker_stage"] ?? "n/a"}`);
    console.log(`  9  verification matched real:  ${f["9_verification_matched_real_assertion"]} (input=${f["9_verification_used_same_input_as_fixture"] ? "same" : "different"})`);
    console.log(`  10 final:                      ${f["10_final_overall_verdict"]} (test=${f["10_test_stage_verdict_after_mutation"]} · mutated=${f["10_mutated"]})`);
    console.log(`  11 CLASSIFICATION:             ${f["11_classification"]}`);
    console.log();
  }
  console.log("=== AGGREGATE COUNTS ===");
  console.log(JSON.stringify(counts, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
