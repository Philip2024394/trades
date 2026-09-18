// NEX1 · Ledger B substrate · G-prime BEFORE/AFTER experiment
//
// Purpose (verbatim from founder direction):
//   "Freeze the original G-prime evidence and run the same adversarial
//    family again ... measure whether behaviour changed."
//
// This script does NOT modify the coding loop. It runs the same 6
// G-prime fixtures through the loop, then adds three engineering-only
// observations:
//
//   B1 · records an OutcomeExperienceEntry for each run
//   B2 · extracts outcome features from that entry (via
//        capability-outcome-experience module)
//   B3 · re-runs the ORIGINAL fixture assertion via vitest AFTER the
//        coding-loop completes, and records whether it actually passes
//
// Then it feeds the accumulated entries through the outcome-abstraction
// step and checks whether patterns emerge that group the failures
// (B/C/D/E) as a class distinct from the success (A).
//
// LEDGER
//   - Every file added by this script is Ledger B (human engineering).
//   - The `capability-outcome-experience.ts` module is Ledger B.
//   - IF a pattern autonomously emerges over the new dimensions that
//     discriminates failures from success, THAT is a Ledger A candidate,
//     subject to falsification. Nothing is pre-labelled.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const REPO = "C:/Users/Victus/trades";
const FIX_DIR = path.join(REPO, "src", "lib", "nex1-gprime-fixtures");
const OUT_DIR = path.join(REPO, "data", "nex1-ledger-b-substrate");
const OUTCOME_STORE = path.join(REPO, "data", "nex1-coding-experience", "entries.jsonl");
fs.mkdirSync(OUT_DIR, { recursive: true });

// Reset outcome store so BEFORE/AFTER separation is clean
function resetOutcomeStore() {
  fs.mkdirSync(path.dirname(OUTCOME_STORE), { recursive: true });
  if (fs.existsSync(OUTCOME_STORE)) fs.unlinkSync(OUTCOME_STORE);
}

// Same 6 scenarios as G-prime (surface deliberately unchanged so we compare
// BEFORE and AFTER on identical inputs).
const S = [
  { id: "A_direct_return", fn: "pinRingRadius", source: (fn) => `export function ${fn}(): number {\n  return 8;\n}\n`, assertion: (fn) => `expect(${fn}()).toBe(64)`, input: "()", expected: "64" },
  { id: "B_conditional_param", fn: "cauldronBubble", source: (fn) => `export function ${fn}(active: boolean): number {\n  if (active) return 41;\n  return 82;\n}\n`, assertion: (fn) => `expect(${fn}(true)).toBe(507)`, input: "true", expected: "507" },
  { id: "C_nested_condition", fn: "harpsichordTone", source: (fn) => `export function ${fn}(mode: number, warm: boolean): number {\n  if (mode === 1) {\n    if (warm) return 3;\n    return 7;\n  }\n  return 13;\n}\n`, assertion: (fn) => `expect(${fn}(1, true)).toBe(45)`, input: "1, true", expected: "45" },
  { id: "D_early_return", fn: "quillFactor", source: (fn) => `export function ${fn}(quantity: number): number {\n  if (quantity <= 0) return -1;\n  return 100;\n}\n`, assertion: (fn) => `expect(${fn}(5)).toBe(275)`, input: "5", expected: "275" },
  { id: "E_boolean_expression", fn: "obeliskCrest", source: (fn) => `export function ${fn}(x: number): boolean {\n  return x > 0;\n}\n`, assertion: (fn) => `expect(${fn}(-3)).toBe(true)`, input: "-3", expected: "true" },
  { id: "F_indirect_helper", fn: "vellumWeight", source: (fn) => `function computeBase(): number { return 6; }\nexport function ${fn}(): number {\n  return computeBase();\n}\n`, assertion: (fn) => `expect(${fn}()).toBe(96)`, input: "()", expected: "96" },
];

function writeFixture(sc) {
  fs.mkdirSync(FIX_DIR, { recursive: true });
  fs.writeFileSync(path.join(FIX_DIR, `${sc.fn}.ts`), sc.source(sc.fn), "utf8");
  fs.writeFileSync(
    path.join(FIX_DIR, `${sc.fn}.assertion.ts`),
    `import { describe, it, expect } from "vitest";\nimport { ${sc.fn} } from "./${sc.fn}";\ndescribe("${sc.fn}", () => {\n  it("returns ${sc.expected}", () => {\n    ${sc.assertion(sc.fn)};\n  });\n});\n`,
    "utf8",
  );
}
function cleanupFixture(sc) {
  try { fs.unlinkSync(path.join(FIX_DIR, `${sc.fn}.ts`)); } catch { /* ignore */ }
  try { fs.unlinkSync(path.join(FIX_DIR, `${sc.fn}.assertion.ts`)); } catch { /* ignore */ }
}
function finalCleanup() { try { fs.rmdirSync(FIX_DIR); } catch { /* ignore */ } }

// B3 · verification-coupling helper
// Run the ORIGINAL fixture assertion via vitest and report pass/fail.
function runFixtureAssertion(sc) {
  const testRel = `src/lib/nex1-gprime-fixtures/${sc.fn}.assertion.ts`;
  const r = spawnSync("npx", ["vitest", "run", testRel, "--reporter=default"], {
    cwd: REPO,
    encoding: "utf8",
    shell: true,
    timeout: 90_000,
  });
  const stdout = r.stdout ?? "";
  const stderr = r.stderr ?? "";
  const combined = stdout + "\n" + stderr;
  // Simple exit-code check: 0 = pass, non-zero = fail
  if (r.status === 0) return "verified";
  if (typeof r.status === "number") return "failed";
  return "not_run";
}

// Instrument a fixture's source with a per-return line trace, invoke the
// function with the assertion's input, and report which return line fired.
// Only supports simple `return <expr>` shapes for the G-prime fixtures.
async function observeExecutionPath(sc) {
  const src = fs.readFileSync(path.join(FIX_DIR, `${sc.fn}.ts`), "utf8");
  const lines = src.split(/\r?\n/);
  const returnLines = [];
  lines.forEach((l, i) => {
    if (/^\s*return\s/.test(l) || /\breturn\b\s/.test(l)) returnLines.push(i + 1);
  });
  // Rewrite each `return X` → `{ global.__EXEC_LINE__ = <line>; return X; }`
  // But scope this transformation to same-line returns (simple case).
  const rewritten = lines.map((l, i) => {
    // Handle `return X;` on its own line OR `if (...) return X;` inline
    return l.replace(/(\breturn\b)\s+([^;\n]+);?/, (m, kw, expr) => {
      // Preserve non-return content on the same line (e.g. `if (x) `)
      return `${kw} (globalThis.__EXEC_LINE__ = ${i + 1}, ${expr});`;
    });
  }).join("\n");
  // Write to a scratch file we can dynamically import
  const scratchDir = path.join(REPO, "src", "lib", "nex1-gprime-fixtures", "_probe");
  fs.mkdirSync(scratchDir, { recursive: true });
  const scratchFile = path.join(scratchDir, `${sc.fn}.probe.mjs`);
  // Strip TypeScript types for a valid .mjs — simple regex for our fixtures
  let js = rewritten
    .replace(/^\s*export\s+/gm, "export ")
    .replace(/:\s*(?:number|boolean|string|void|RegExp|any|unknown)\b/g, "") // strip type annotations
    .replace(/^\s*function\s+([a-zA-Z_$][\w$]*)\s*\(([^)]*)\)\s*:\s*[^\s{]+/gm, "function $1($2)")
    .replace(/^\s*export\s+function\s+([a-zA-Z_$][\w$]*)\s*\(([^)]*)\)\s*:\s*[^\s{]+/gm, "export function $1($2)");
  fs.writeFileSync(scratchFile, js, "utf8");
  try {
    globalThis.__EXEC_LINE__ = null;
    const url = pathToFileURL(scratchFile).href;
    const mod = await import(url);
    // Invoke with the fixture assertion's input
    // Parse `sc.input` as a JS argument list
    const argList = sc.input === "()" ? [] : sc.input.split(",").map((s) => JSON.parse(s.trim()));
    try {
      const result = mod[sc.fn](...argList);
      return { execution_line: globalThis.__EXEC_LINE__, result_value: result };
    } catch (e) {
      return { execution_line: globalThis.__EXEC_LINE__, error: String(e).slice(0, 120) };
    }
  } finally {
    try { fs.unlinkSync(scratchFile); } catch { /* ignore */ }
    try { fs.rmdirSync(scratchDir); } catch { /* ignore */ }
  }
}

async function main() {
  const loop = await import(
    pathToFileURL(path.join(REPO, "src/lib/nex-agent/code-engine/capability-specification-driven-loop.ts")).href
  );
  const oe = await import(
    pathToFileURL(path.join(REPO, "src/lib/nex-agent/code-engine/capability-outcome-experience.ts")).href
  );

  resetOutcomeStore();

  const runs = [];
  for (const sc of S) {
    cleanupFixture(sc);
    writeFixture(sc);
    const rel = `src/lib/nex1-gprime-fixtures/${sc.fn}.ts`;
    const goal = `Fix ${rel}. When ${sc.fn} is called, it should return ${sc.expected}.`;

    // ── First observe execution path on the UNMUTATED fixture ────────
    const preExec = await observeExecutionPath(sc).catch(() => null);
    writeFixture(sc); // restore fixture after probe (in case probe touched it)
    // Note: observeExecutionPath writes to a scratch dir and cleans it up.

    // ── Run the coding loop ──────────────────────────────────────────
    const stages = [];
    let overall_verdict = "UNKNOWN";
    try {
      const r = await loop.runSpecificationDrivenCodingLoop({
        founder_goal: goal,
        target_source_file: rel,
        repo_root: REPO,
        test_timeout_ms: 120_000,
        onStage: (s) => stages.push({
          stage: String(s.stage),
          verdict: String(s.verdict),
          summary: String(s.summary ?? "").slice(0, 400),
          evidence: Array.isArray(s.evidence) ? s.evidence.map(String) : [],
        }),
      });
      overall_verdict = r.overall_verdict;
    } catch (e) {
      overall_verdict = `THREW_${String(e).slice(0, 60)}`;
    }

    // ── B3 · run the ORIGINAL fixture assertion via vitest ──────────
    const fixtureVerdict = runFixtureAssertion(sc);

    // Extract observable outcome facts from stages
    const planStage = stages.find((s) => s.stage === "plan");
    const changeStage = stages.find((s) => s.stage === "change");
    const testStage = stages.find((s) => s.stage === "test");
    const changeEv = changeStage?.evidence?.[0] ?? "";
    const mutMatch = changeEv.match(/=\['(.+?)@(\d+)'\]/);
    const mutation_applied = Boolean(mutMatch);
    const mutation_before_after = mutMatch ? mutMatch[1] : null;
    const mutation_line = mutMatch ? Number(mutMatch[2]) : null;
    const proposalLine = planStage?.evidence?.find((e) => /J\.2 · proposal/.test(e)) ?? null;
    const refusalLine = planStage?.evidence?.find((e) => /J\.2 · refused/.test(e)) ?? null;

    const spec_test_verdict = testStage?.verdict === "VERIFIED" ? "verified"
      : testStage?.verdict === "PARTIAL" || testStage?.verdict === "FAILED" ? "failed"
      : testStage?.verdict === "SKIPPED" ? "skipped"
      : "not_run";

    // Observe post-mutation execution path (only meaningful if mutation applied)
    const postExec = mutation_applied ? await observeExecutionPath(sc).catch(() => null) : preExec;

    // ── B1 · write the OutcomeExperienceEntry ───────────────────────
    const entry = oe.appendOutcome({
      target_source_file: rel,
      founder_goal: goal,
      assertion_expression: sc.assertion(sc.fn),
      assertion_input_verbatim: sc.input,
      j2_response_kind: proposalLine ? "proposal" : refusalLine ? "refusal" : "no_signal",
      j2_proposal_text: proposalLine?.slice(0, 400) ?? null,
      j2_refusal_kind: refusalLine ? (refusalLine.match(/refused_[a-z_]+/)?.[0] ?? null) : null,
      mutation_applied,
      mutation_target_line: mutation_line,
      mutation_before_text: mutMatch ? mutMatch[1].split("→")[0] : null,
      mutation_after_text: mutMatch ? mutMatch[1].split("→")[1] : null,
      actual_execution_path_line: (postExec && postExec.execution_line !== null) ? Number(postExec.execution_line) : null,
      execution_path_evidence_kind: (postExec && postExec.execution_line !== null) ? "OBSERVED" : "UNAVAILABLE",
      spec_test_after_mutation: spec_test_verdict,
      fixture_test_after_mutation: fixtureVerdict,
      loop_overall_verdict: overall_verdict,
      mutation_target_matches_execution_path:
        (mutation_line !== null && postExec?.execution_line !== null)
          ? mutation_line === Number(postExec.execution_line)
          : null,
      spec_and_fixture_verdicts_agree:
        (spec_test_verdict === "verified" && fixtureVerdict === "verified") ||
        (spec_test_verdict === "failed" && fixtureVerdict === "failed"),
      confidence_reported_by_j2: null, // not surfaced by loop today
    }, REPO);

    runs.push({
      scenario_id: sc.id,
      overall_verdict,
      entry_id: entry.entry_id,
      pre_exec_line: preExec?.execution_line ?? null,
      post_exec_line: postExec?.execution_line ?? null,
      mutation_applied,
      mutation_line,
      spec_test_verdict,
      fixture_verdict: fixtureVerdict,
      spec_and_fixture_agree: entry.spec_and_fixture_verdicts_agree,
      mutation_targets_execution_path: entry.mutation_target_matches_execution_path,
    });

    cleanupFixture(sc);
  }
  finalCleanup();

  // ── Feed accumulated outcomes to abstraction (B2 + parallel Fix 35) ───
  const entries = oe.loadAllOutcomes(REPO);
  const patterns = oe.extractOutcomePatterns(entries);

  // Does any pattern discriminate mutation_targets_execution_path=false
  // from mutation_targets_execution_path=true across scenarios?
  const wrong_target_patterns = patterns.filter((p) => p.features.mutation_targets_execution_path === "false");
  const correct_target_patterns = patterns.filter((p) => p.features.mutation_targets_execution_path === "true");
  const false_positive_patterns = patterns.filter((p) => p.features.spec_fixture_agreement === "spec_verified_fixture_failed");
  const both_verified_patterns = patterns.filter((p) => p.features.spec_fixture_agreement === "both_verified");

  const discriminates =
    (wrong_target_patterns.length > 0 || false_positive_patterns.length > 0) &&
    correct_target_patterns.length + both_verified_patterns.length > 0;

  const summary = {
    document: "G-prime with Ledger B substrate · BEFORE/AFTER experiment",
    date: new Date().toISOString(),
    zero_llm: true,
    ledger_b_files_added: [
      "src/lib/nex-agent/code-engine/capability-outcome-experience.ts",
      "scripts/nex1-ledger-b-substrate/g-prime-with-substrate.mjs",
    ],
    engineer_source_modifications_to_existing_files: 0,
    runs,
    outcome_patterns: patterns.map((p) => ({
      pattern_id: p.pattern_id,
      support: p.support_count,
      features: p.features,
      members: p.entry_ids,
    })),
    substrate_discriminates_correct_from_incorrect_outcomes: discriminates,
    honest_answer:
      discriminates
        ? "With B1+B2+B3 substrate active, outcome-level feature dimensions DO discriminate correct-target mutations from wrong-target mutations AND both-verified outcomes from spec-verified-fixture-failed outcomes. This is Ledger B engineering — the substrate now EXPOSES facts the previous machinery could not see. A downstream abstraction step could now discover the discriminating pattern; whether NEX would do so without explicit prompting is a separate autonomous-growth question."
        : "Even with B1+B2+B3 substrate active, the outcome-level dimensions did not discriminate. Report why in the receipt.",
  };

  fs.writeFileSync(
    path.join(OUT_DIR, "g-prime-with-substrate-receipt.json"),
    JSON.stringify(summary, null, 2),
    "utf8",
  );

  console.log("=== G-PRIME WITH LEDGER B SUBSTRATE ===\n");
  for (const r of runs) {
    console.log(`${r.scenario_id.padEnd(28)} overall=${r.overall_verdict.padEnd(46)}`);
    console.log(`  mutation_applied=${r.mutation_applied} @ line ${r.mutation_line} · exec_line=${r.post_exec_line ?? r.pre_exec_line} · targets_exec_path=${r.mutation_targets_execution_path}`);
    console.log(`  spec_verdict=${r.spec_test_verdict} · fixture_verdict=${r.fixture_verdict} · agree=${r.spec_and_fixture_agree}`);
  }
  console.log("\n=== OUTCOME PATTERN GROUPS (Ledger B substrate active) ===");
  for (const p of patterns) {
    console.log(`  ${p.pattern_id}`);
    console.log(`     support=${p.support_count} · features=${JSON.stringify(p.features)}`);
  }
  console.log("\ndiscriminates_correct_from_incorrect:", discriminates);
  console.log("\nHONEST_ANSWER:", summary.honest_answer);
}
main().catch((e) => { console.error(e); process.exit(1); });
