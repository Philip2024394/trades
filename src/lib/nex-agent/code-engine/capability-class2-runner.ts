// src/lib/nex-agent/code-engine/capability-class2-runner.ts
//
// NEX1 · Fix 24 · Class 2 Runner · orchestrator that wraps the existing
// verified spec-driven coding loop with a Class 2 Bridge fallback.
// Founder-authorised 2026-09-18.
//
// PURPOSE
//   Provide a single entry that lets a caller supply either a natural-
//   language founder_goal, a target source file, or both. The runner:
//
//     1. Tries the existing extractor on founder_goal first (byte-identical
//        to the current runtime-verified behaviour if extraction succeeds).
//     2. If extraction is INSUFFICIENT AND the target's adjacent `.test.ts`
//        file contains a supported failing vitest assertion, the Class 2
//        Bridge synthesises canonical `When X, Y should be Z` prose from
//        that assertion.
//     3. Calls runSpecificationDrivenCodingLoop with the (possibly
//        synthesised) prose.
//
//   This module NEVER modifies runSpecificationDrivenCodingLoop and NEVER
//   touches Fix 23a/b/c. It sits strictly upstream of them.
//
// COEXISTENCE POLICY (D2)
//   The bridge only activates when the target has an adjacent
//   `<name>.test.ts` file whose content contains a supported assertion.
//   It does NOT create or modify that test. The spec-driven loop then
//   creates its own `<name>.spec-derived.test.ts` as usual — both live
//   side by side. A design consequence: after the mutation, both tests
//   pass or both fail together, because they assert the same thing
//   against the same source. This preserves invariants without requiring
//   the loop to be modified.

import fs from "node:fs";
import path from "node:path";
import {
  runSpecificationDrivenCodingLoop,
  type SpecificationDrivenLoopInput,
  type SpecificationDrivenLoopResult,
} from "./capability-specification-driven-loop";
import {
  extractSpecification,
  classifyExtraction,
  type ExtractSpecificationResult,
} from "./capability-specification-extractor";
import {
  composeExpectedBehaviourFromAssertion,
  type Class2BridgeResult,
} from "./capability-class2-bridge";
import { parseVitestAssertion } from "./capability-vitest-assertion-parser";

export type Class2RunnerPathTaken =
  | "EXTRACTOR_SUCCESS_NO_BRIDGE"
  | "BRIDGE_USED_FROM_FAILING_TEST"
  | "BRIDGE_ATTEMPTED_REFUSED"
  | "NO_FAILING_TEST_FOUND"
  | "NO_TARGET_SUPPLIED";

export interface Class2RunnerInput {
  readonly repo_root: string;
  /** Optional natural-language goal (e.g. `"Fix X. When Y, Z should be W."`
   *  OR open-ended `"analyse this file and fix the bug"`). */
  readonly founder_goal?: string;
  /** Target source file (absolute or repo-relative). */
  readonly target_source_file: string;
  /** Optional adjacent test file path override (repo-relative). When absent,
   *  the runner infers `<target-basename>.test.ts` next to the target. */
  readonly test_file_hint?: string | null;
}

export interface Class2RunnerResult {
  readonly ok: boolean;
  readonly path_taken: Class2RunnerPathTaken;
  readonly bridge_result: Class2BridgeResult | null;
  readonly synthesised_prose: string | null;
  readonly used_prose: string;
  readonly loop_result: SpecificationDrivenLoopResult | null;
  readonly notes: readonly string[];
}

/** Read the file synchronously; returns null if it does not exist. */
function readFileOrNull(absPath: string): string | null {
  try {
    if (!fs.existsSync(absPath)) return null;
    return fs.readFileSync(absPath, "utf8");
  } catch {
    return null;
  }
}

/** Extract every `expect(...).<matcher>(...)` assertion source string from a
 *  test file, in source order. Robust to newlines within a single assertion.
 *  Deterministic. Zero AST library dependency. */
export function extractAssertionsFromTestSource(source: string): readonly string[] {
  const results: string[] = [];
  const expectRe = /\bexpect\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = expectRe.exec(source)) !== null) {
    const start = m.index;
    // Balance parens to find end of expect(...)
    let depth = 0;
    let i = start;
    while (i < source.length && source[i] !== "(") i++;
    if (source[i] !== "(") break;
    depth = 1;
    i++;
    while (i < source.length && depth > 0) {
      const c = source[i];
      if (c === "(") depth++;
      else if (c === ")") depth--;
      i++;
    }
    // i is now one past the matching close of expect(...)
    // Skip any chained `.name(...)` sequences until the whole assertion is captured.
    let j = i;
    // Skip whitespace/newlines
    while (j < source.length && /[\s\r\n]/.test(source[j])) j++;
    while (source[j] === ".") {
      // consume identifier
      j++;
      while (j < source.length && /[A-Za-z_$0-9]/.test(source[j])) j++;
      // if followed by '(', balance to its close
      while (j < source.length && /\s/.test(source[j])) j++;
      if (source[j] === "(") {
        let d = 1;
        j++;
        while (j < source.length && d > 0) {
          const c = source[j];
          if (c === "(") d++;
          else if (c === ")") d--;
          j++;
        }
      }
      // whitespace/newlines then possibly another `.`
      while (j < source.length && /[\s\r\n]/.test(source[j])) j++;
    }
    const raw = source.slice(start, j).trim();
    if (raw !== "" && raw.startsWith("expect")) {
      // Normalise whitespace inside the assertion for the parser
      results.push(raw.replace(/\s+/g, " "));
    }
    expectRe.lastIndex = j;
  }
  return results;
}

/** Locate the first assertion in `test_file_source` that our parser accepts
 *  (supported matcher + primitive expected). Returns null if none. */
export function findFirstSupportedAssertion(test_file_source: string): string | null {
  const assertions = extractAssertionsFromTestSource(test_file_source);
  for (const a of assertions) {
    const p = parseVitestAssertion(a);
    if (p.ok && p.expected_is_simple_primitive) return a;
  }
  return null;
}

/** Runner entry. Deterministic. Zero LLM. */
export async function runClass2Bridged(
  input: Class2RunnerInput,
): Promise<Class2RunnerResult> {
  const notes: string[] = [];
  const targetAbs = path.isAbsolute(input.target_source_file)
    ? input.target_source_file
    : path.join(input.repo_root, input.target_source_file);

  if (!fs.existsSync(targetAbs)) {
    return {
      ok: false,
      path_taken: "NO_TARGET_SUPPLIED",
      bridge_result: null,
      synthesised_prose: null,
      used_prose: input.founder_goal ?? "",
      loop_result: null,
      notes: [`target source file not found: ${targetAbs}`],
    };
  }

  const providedGoal = typeof input.founder_goal === "string" ? input.founder_goal : "";

  // ─── Step 1 · Try extractor on the provided prose ──────────────────────
  let useProse = providedGoal;
  let bridge_result: Class2BridgeResult | null = null;
  let path_taken: Class2RunnerPathTaken = "EXTRACTOR_SUCCESS_NO_BRIDGE";
  let synthesised_prose: string | null = null;

  const extractorResult: ExtractSpecificationResult = extractSpecification(providedGoal);
  const classification = classifyExtraction(extractorResult);
  const highOrMedium = extractorResult.expected_behaviours.filter(
    (b) => b.confidence === "high" || b.confidence === "medium",
  );
  const extractorInsufficient =
    classification === "SPECIFICATION_INSUFFICIENT" || highOrMedium.length === 0;
  notes.push(
    `extractor · classification=${classification} · high_or_medium=${highOrMedium.length}`,
  );

  if (extractorInsufficient) {
    // ─── Step 2 · Try Class 2 Bridge from adjacent failing test ──────────
    const targetDir = path.dirname(targetAbs);
    const targetBase = path.basename(targetAbs).replace(/\.(tsx?|jsx?|mjs|cjs)$/, "");
    // Search order:
    //   1. Explicit test_file_hint if given
    //   2. Sibling <baseName>.test.ts (standard vitest convention)
    //   3. Sibling <baseName>.assertion.ts (Fix 24 convention for fixture
    //      files that must NOT be picked up by the default vitest include
    //      pattern — allows a failing assertion source to live next to a
    //      buggy source file without contaminating CI)
    const searchPaths: string[] =
      typeof input.test_file_hint === "string" && input.test_file_hint !== ""
        ? [
            path.isAbsolute(input.test_file_hint)
              ? input.test_file_hint
              : path.join(input.repo_root, input.test_file_hint),
          ]
        : [
            path.join(targetDir, `${targetBase}.test.ts`),
            path.join(targetDir, `${targetBase}.assertion.ts`),
          ];
    let inferredTestAbs: string | null = null;
    let testSource: string | null = null;
    for (const p of searchPaths) {
      const s = readFileOrNull(p);
      if (s !== null) {
        inferredTestAbs = p;
        testSource = s;
        break;
      }
    }
    notes.push(`bridge · searched: ${searchPaths.join(" | ")} · found=${inferredTestAbs ?? "none"}`);
    if (testSource === null || inferredTestAbs === null) {
      notes.push(`bridge · no adjacent test file found in any search path`);
      path_taken = "NO_FAILING_TEST_FOUND";
    } else {
      const assertion = findFirstSupportedAssertion(testSource);
      if (assertion === null) {
        notes.push(`bridge · test file present but no supported assertion found`);
        path_taken = "NO_FAILING_TEST_FOUND";
      } else {
        bridge_result = composeExpectedBehaviourFromAssertion({
          assertion_source: assertion,
          test_file_hint: path.relative(input.repo_root, inferredTestAbs),
        });
        if (!bridge_result.ok) {
          notes.push(
            `bridge · refused: ${bridge_result.refusal_kind} · ${bridge_result.detail}`,
          );
          path_taken = "BRIDGE_ATTEMPTED_REFUSED";
        } else {
          synthesised_prose = bridge_result.synthesised_prose;
          // Prepend a coding verb so the classifier accepts the prose (the
          // spec-driven-loop is often driven from chat-turn which requires
          // a coding-family verb for state=understood). The extractor itself
          // does not require the verb, but keeping the exact form
          // `Fix <target>. When X, Y should be Z.` matches the runtime-
          // verified Batch 1 Closure Test C pattern.
          const targetRel = path.relative(input.repo_root, targetAbs);
          useProse = `Fix ${targetRel}. ${synthesised_prose}`;
          path_taken = "BRIDGE_USED_FROM_FAILING_TEST";
          notes.push(`bridge · synthesised prose: ${useProse}`);
        }
      }
    }
  }

  // ─── Step 3 · Run existing spec-driven coding loop ────────────────────
  const loopInput: SpecificationDrivenLoopInput = {
    repo_root: input.repo_root,
    founder_goal: useProse,
    target_source_file: targetAbs,
  };
  const loopResult = await runSpecificationDrivenCodingLoop(loopInput);

  return {
    ok: loopResult.overall_verdict === "CODING_LOOP_RUNTIME_VERIFIED",
    path_taken,
    bridge_result,
    synthesised_prose,
    used_prose: useProse,
    loop_result: loopResult,
    notes,
  };
}

export const CLASS2_RUNNER_VERSION = "fix24.v1";
