// src/lib/nex-agent/code-engine/capability-j3-verify-repair.ts
//
// NEX1 · CAPABILITY J.3 · APPLY · RERUN · PROVE · deterministic.
//
// taught_by = master_ai_engineer · 2026-09-12
// Teaching infrastructure only · NOT NEX1 independent authorship.
//
// Purpose: take a Nex1FailureDiagnosis produced by J.2, apply its proposal
// to source, rerun the ORIGINAL vitest, and prove the repair. On any
// failure — the mutation broke another test, the mutation didn't fix the
// original assertion, the mutation produced code that doesn't compile,
// or the diagnosis carried no proposal — this module ROLLS BACK the
// source to its original byte-identity and reports a specific failure
// verdict.
//
// CHAIN OF CUSTODY (per founder authorization 2026-09-12):
//   · J.3 executes only proposals that arrived embedded in a
//     Nex1FailureDiagnosis. Callers cannot bypass J.2 and hand J.3
//     a free-form `Nex1RepairProposal`.
//   · Snapshot → apply → rerun → verify → rollback (if unsafe) →
//     structured verdict. Every intermediate hash is recorded.
//
// Rollback verifies byte-identity after restoration. No file left mutated
// on exit.
//
// Removing this module must not remove any NEX1-owned identity, memory,
// evidence, orchestration, ladder, audit, or safety mechanism.

import ts from "typescript";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import type { Nex1FailureDiagnosis } from "./capability-j2-cause-analysis";
import { extractRuntimeFailures } from "./capability-j-runtime-diagnosis";

export type Nex1J3Verdict =
  | "verified_repair"
  | "rejected_no_proposal"
  | "rejected_apply_failed"
  | "rejected_still_failing"
  | "rejected_regression"
  | "rejected_compile_error"
  | "rollback_failed";

export interface Nex1J3RunSpec {
  readonly config_file: string;
  readonly test_files: readonly string[];
}

export interface Nex1J3Result {
  readonly verdict: Nex1J3Verdict;
  readonly diagnosis_kind: Nex1FailureDiagnosis["kind"];
  readonly proposal_summary: string | null;
  readonly original_hash: string;
  readonly modified_hash: string | null;
  readonly restored_hash: string | null;
  readonly first_run: { exit_code: number; passed: number; failed: number } | null;
  readonly second_run: { exit_code: number; passed: number; failed: number } | null;
  readonly elapsed_ms: number;
  readonly rollback_status: "restored" | "not_needed" | "failed";
  readonly reasoning_trace: readonly string[];
  readonly taught_by: "master_ai_engineer";
}

/**
 * @summary Execute a J.2-originated repair proposal, verify by rerunning
 * vitest, roll back on any failure, and produce a structured verdict.
 *
 * Chain-of-custody: this function ONLY accepts a Nex1FailureDiagnosis. If
 * the diagnosis carries no proposal, it refuses cleanly.
 */
export function executeAndVerifyRepair(
  diagnosis: Nex1FailureDiagnosis,
  runSpec: Nex1J3RunSpec,
  repoRoot: string,
): Nex1J3Result {
  const trace: string[] = [];
  const T = (s: string) => trace.push(s);
  const started = Date.now();

  // ── Chain-of-custody guard ─────────────────────────────────────────
  if (diagnosis.kind !== "proposal" || diagnosis.proposal === null) {
    return {
      verdict: "rejected_no_proposal",
      diagnosis_kind: diagnosis.kind,
      proposal_summary: null,
      original_hash: "",
      modified_hash: null,
      restored_hash: null,
      first_run: null,
      second_run: null,
      elapsed_ms: Date.now() - started,
      rollback_status: "not_needed",
      reasoning_trace: [`diagnosis.kind='${diagnosis.kind}' · no proposal to execute`],
      taught_by: "master_ai_engineer",
    };
  }

  const p = diagnosis.proposal;
  const targetAbs = resolve(repoRoot, p.target_file);
  if (!existsSync(targetAbs)) {
    return {
      verdict: "rejected_apply_failed",
      diagnosis_kind: diagnosis.kind,
      proposal_summary: describeProposal(p),
      original_hash: "",
      modified_hash: null,
      restored_hash: null,
      first_run: null,
      second_run: null,
      elapsed_ms: Date.now() - started,
      rollback_status: "not_needed",
      reasoning_trace: [`target file '${p.target_file}' not found on disk`],
      taught_by: "master_ai_engineer",
    };
  }

  const originalContent = readFileSync(targetAbs, "utf8");
  const originalHash = sha256(originalContent);
  T(`snapshotted target · ${p.target_file} · ${originalHash.slice(0, 12)}`);

  // ── First run · pre-repair baseline (the failure that led here) ────
  const firstRun = runVitest(runSpec, repoRoot);
  T(`first_run · exit=${firstRun.exit_code} · passed=${firstRun.passed} · failed=${firstRun.failed}`);

  // ── Apply the proposal ─────────────────────────────────────────────
  let mutated: { ok: true; content: string; hash: string } | { ok: false; reason: string };
  if (p.change_kind === "replace_return_literal") {
    mutated = applyReplaceReturnLiteral(originalContent, p.target_function, p.current_literal, p.proposed_literal);
  } else {
    mutated = { ok: false, reason: `unsupported change_kind '${p.change_kind}'` };
  }
  if (!mutated.ok) {
    return {
      verdict: "rejected_apply_failed",
      diagnosis_kind: diagnosis.kind,
      proposal_summary: describeProposal(p),
      original_hash: originalHash,
      modified_hash: null,
      restored_hash: originalHash,
      first_run: stripOutput(firstRun),
      second_run: null,
      elapsed_ms: Date.now() - started,
      rollback_status: "not_needed",
      reasoning_trace: [...trace, `apply failed · ${mutated.reason}`],
      taught_by: "master_ai_engineer",
    };
  }
  writeFileSync(targetAbs, mutated.content, "utf8");
  T(`applied · new hash ${mutated.hash.slice(0, 12)}`);

  // ── Second run · post-repair verification ──────────────────────────
  const secondRun = runVitest(runSpec, repoRoot);
  T(`second_run · exit=${secondRun.exit_code} · passed=${secondRun.passed} · failed=${secondRun.failed}`);

  // Rollback ALWAYS · J.3 must not leave source mutated between runs
  writeFileSync(targetAbs, originalContent, "utf8");
  const restoredHash = sha256(readFileSync(targetAbs, "utf8"));
  const rollbackOk = restoredHash === originalHash;
  T(`rollback · ${rollbackOk ? "restored" : "FAILED"} · ${restoredHash.slice(0, 12)}`);

  if (!rollbackOk) {
    return {
      verdict: "rollback_failed",
      diagnosis_kind: diagnosis.kind,
      proposal_summary: describeProposal(p),
      original_hash: originalHash,
      modified_hash: mutated.hash,
      restored_hash: restoredHash,
      first_run: stripOutput(firstRun),
      second_run: stripOutput(secondRun),
      elapsed_ms: Date.now() - started,
      rollback_status: "failed",
      reasoning_trace: trace,
      taught_by: "master_ai_engineer",
    };
  }

  // Interpret second run relative to first run
  // Detect vitest infrastructure/compile errors distinct from test failures:
  // when vitest can't parse/compile the file, `passed=0 failed=0 exit=1`.
  const looksLikeCompileError = secondRun.exit_code !== 0 && secondRun.passed === 0 && secondRun.failed === 0;
  if (looksLikeCompileError) {
    return {
      verdict: "rejected_compile_error",
      diagnosis_kind: diagnosis.kind,
      proposal_summary: describeProposal(p),
      original_hash: originalHash,
      modified_hash: mutated.hash,
      restored_hash: restoredHash,
      first_run: stripOutput(firstRun),
      second_run: stripOutput(secondRun),
      elapsed_ms: Date.now() - started,
      rollback_status: "restored",
      reasoning_trace: [...trace, "second_run reports 0/0 with non-zero exit · treated as compile/parse error"],
      taught_by: "master_ai_engineer",
    };
  }

  const stillFailing = secondRun.exit_code !== 0 || secondRun.failed > 0;

  // ── Verified repair · zero failures + no previously-passing test lost ──
  if (secondRun.failed === 0 && secondRun.exit_code === 0) {
    return {
      verdict: "verified_repair",
      diagnosis_kind: diagnosis.kind,
      proposal_summary: describeProposal(p),
      original_hash: originalHash,
      modified_hash: mutated.hash,
      restored_hash: restoredHash,
      first_run: stripOutput(firstRun),
      second_run: stripOutput(secondRun),
      elapsed_ms: Date.now() - started,
      rollback_status: "restored",
      reasoning_trace: [
        ...trace,
        `first: passed=${firstRun.passed} failed=${firstRun.failed}`,
        `second: passed=${secondRun.passed} failed=${secondRun.failed}`,
        `guard: zero failures · repair verified`,
      ],
      taught_by: "master_ai_engineer",
    };
  }

  // ── Regression detection · compare failing test-name sets ─────────
  // If any test that was PASSING in the first run is now FAILING, that is
  // a regression regardless of total counts.
  const firstFailingNames = failingTestNames(firstRun.output);
  const secondFailingNames = failingTestNames(secondRun.output);
  if (firstFailingNames && secondFailingNames) {
    const newlyFailing: string[] = [];
    for (const n of secondFailingNames) {
      if (!firstFailingNames.has(n)) newlyFailing.push(n);
    }
    if (newlyFailing.length > 0) {
      return {
        verdict: "rejected_regression",
        diagnosis_kind: diagnosis.kind,
        proposal_summary: describeProposal(p),
        original_hash: originalHash,
        modified_hash: mutated.hash,
        restored_hash: restoredHash,
        first_run: stripOutput(firstRun),
        second_run: stripOutput(secondRun),
        elapsed_ms: Date.now() - started,
        rollback_status: "restored",
        reasoning_trace: [
          ...trace,
          `first failing set = {${Array.from(firstFailingNames).join(", ")}}`,
          `second failing set = {${Array.from(secondFailingNames).join(", ")}}`,
          `newly failing (regression): {${newlyFailing.join(", ")}}`,
        ],
        taught_by: "master_ai_engineer",
      };
    }
  }

  if (stillFailing) {
    return {
      verdict: "rejected_still_failing",
      diagnosis_kind: diagnosis.kind,
      proposal_summary: describeProposal(p),
      original_hash: originalHash,
      modified_hash: mutated.hash,
      restored_hash: restoredHash,
      first_run: stripOutput(firstRun),
      second_run: stripOutput(secondRun),
      elapsed_ms: Date.now() - started,
      rollback_status: "restored",
      reasoning_trace: [...trace, `second_run still failing · repair did not close original assertion`],
      taught_by: "master_ai_engineer",
    };
  }

  // Fallback · shouldn't reach here in normal paths
  return {
    verdict: "rejected_still_failing",
    diagnosis_kind: diagnosis.kind,
    proposal_summary: describeProposal(p),
    original_hash: originalHash,
    modified_hash: mutated.hash,
    restored_hash: restoredHash,
    first_run: firstRun,
    second_run: secondRun,
    elapsed_ms: Date.now() - started,
    rollback_status: "restored",
    reasoning_trace: [...trace, "unclassified · defaulting to still_failing"],
    taught_by: "master_ai_engineer",
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function applyReplaceReturnLiteral(
  source: string,
  functionName: string,
  currentLiteral: string,
  proposedLiteral: string,
): { ok: true; content: string; hash: string } | { ok: false; reason: string } {
  const sf = ts.createSourceFile("__t.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const box: { hit: { start: number; end: number } | null } = { hit: null };
  const visit = (node: ts.Node) => {
    if (box.hit) return;
    let fnBody: ts.Block | undefined;
    if (ts.isFunctionDeclaration(node) && node.name?.text === functionName) fnBody = node.body;
    else if (
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === functionName)
    ) {
      const decl = node.declarationList.declarations.find((d) => ts.isIdentifier(d.name) && d.name.text === functionName);
      if (decl && decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) && ts.isBlock(decl.initializer.body)) {
        fnBody = decl.initializer.body;
      }
    }
    if (fnBody) {
      for (const s of fnBody.statements) {
        if (ts.isReturnStatement(s) && s.expression) {
          const litText = s.expression.getText(sf);
          if (litText === currentLiteral) {
            box.hit = { start: s.expression.getStart(sf), end: s.expression.getEnd() };
            return;
          }
        }
      }
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (!box.hit) {
    return { ok: false, reason: `function '${functionName}' with return literal '${currentLiteral}' not found` };
  }
  const next = source.slice(0, box.hit.start) + proposedLiteral + source.slice(box.hit.end);
  return { ok: true, content: next, hash: sha256(next) };
}

function runVitest(runSpec: Nex1J3RunSpec, repoRoot: string): { exit_code: number; passed: number; failed: number; output: string } {
  const args = ["vitest", "run", `--config=${runSpec.config_file}`, ...runSpec.test_files, "--reporter=default"];
  const vt = spawnSync("npx", args, {
    stdio: "pipe", shell: true, encoding: "utf8", cwd: repoRoot,
    env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096" },
  });
  const output = (vt.stdout ?? "") + "\n" + (vt.stderr ?? "");
  const passed = Number(/(\d+)\s+passed/.exec(output)?.[1] ?? "0");
  const failed = Number(/(\d+)\s+failed/.exec(output)?.[1] ?? "0");
  return { exit_code: vt.status ?? 1, passed, failed, output };
}

/**
 * @summary Extract the set of failing test names from vitest output using J.1.
 * Returns null when J.1 refused (e.g. empty/malformed/crash).
 */
function failingTestNames(output: string): Set<string> | null {
  const extract = extractRuntimeFailures(output);
  if (extract.kind !== "ok") return null;
  const names = new Set<string>();
  for (const f of extract.findings) {
    if (f.test_name) names.add(f.test_name);
  }
  return names;
}

function stripOutput(run: { exit_code: number; passed: number; failed: number; output: string }): { exit_code: number; passed: number; failed: number } {
  return { exit_code: run.exit_code, passed: run.passed, failed: run.failed };
}

function describeProposal(p: { change_kind: string; target_file: string; target_function: string; current_literal: string; proposed_literal: string }): string {
  return `${p.change_kind}(${p.target_file}#${p.target_function} · ${p.current_literal} → ${p.proposed_literal})`;
}

function sha256(t: string): string {
  return createHash("sha256").update(t).digest("hex");
}
