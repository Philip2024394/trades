// src/lib/nex-agent/code-engine/capability-j23-multi-hop-recovery.ts
//
// NEX1 · CAPABILITY J.2.3 · MULTI-HOP CAUSE ANALYSIS · deterministic.
//
// taught_by = master_ai_engineer · 2026-09-12
// Teaching infrastructure only · NOT NEX1 independent authorship.
//
// Purpose: chain J.1 → J.2 → apply-repair → rerun in a bounded loop. When
// fixing one bug uncovers another, keep going up to `max_hops`. On any
// unsafe outcome — J.2 refusal, regression (a previously-passing test
// now failing), apply failure, or hop-cap exceeded — roll back ALL
// mutations made during the multi-hop attempt.
//
// Discipline (per founder authorization 2026-09-12):
//   · Chain of custody preserved · every hop's proposal goes through J.2
//   · Regression detection · compare failing-test names against the
//     INITIAL failing set. Any new failure appearing during the chain
//     means a repair introduced a regression · rollback and refuse.
//   · Hop cap enforced · exceeded → refuse and rollback.
//   · Apply uses J.3's exact replace_return_literal splicer semantics.
//   · Always rollback the accumulated snapshots at the end for
//     byte-identity in the harness.
//
// Removing this module must not remove any NEX1-owned identity, memory,
// evidence, orchestration, ladder, audit, or safety mechanism.

import ts from "typescript";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { extractRuntimeFailures } from "./capability-j-runtime-diagnosis";
import { diagnoseAndPropose } from "./capability-j2-cause-analysis";
import type { Nex1J3RunSpec } from "./capability-j3-verify-repair";

export type Nex1MultiHopVerdict =
  | "all_verified_multi_hop"
  | "refused_no_findings_ever"
  | "refused_hop_cap_exceeded"
  | "refused_mid_chain_j2"
  | "refused_mid_chain_regression"
  | "refused_apply_failed";

export interface Nex1MultiHopHopRecord {
  readonly hop_number: number;
  readonly test_name: string | null;
  readonly expected: string | null;
  readonly actual: string | null;
  readonly diagnosis_kind: string;
  readonly proposal_summary: string | null;
  readonly applied: boolean;
  readonly result: string;
}

export interface Nex1MultiHopResult {
  readonly verdict: Nex1MultiHopVerdict;
  readonly hops: readonly Nex1MultiHopHopRecord[];
  readonly initial_failing_names: readonly string[];
  readonly final_failing_names: readonly string[];
  readonly rollback_status: "restored" | "not_needed" | "failed";
  readonly newly_failing_names?: readonly string[];
  readonly reasoning_trace: readonly string[];
  readonly taught_by: "master_ai_engineer";
}

export async function executeMultiHopRecovery(
  runSpec: Nex1J3RunSpec,
  repoRoot: string,
  maxHops: number = 3,
): Promise<Nex1MultiHopResult> {
  const trace: string[] = [];
  const T = (s: string) => trace.push(s);
  const hops: Nex1MultiHopHopRecord[] = [];
  const snapshots = new Map<string, string>();

  const rollbackAll = (): "restored" | "failed" => {
    for (const [target, content] of snapshots) {
      try {
        writeFileSync(resolve(repoRoot, target), content, "utf8");
      } catch {
        return "failed";
      }
    }
    return "restored";
  };

  // Initial run · capture failing set for regression detection
  const initial = runVitest(runSpec, repoRoot);
  const initialFailing = failingTestNames(initial.output);
  T(`initial vitest exit=${initial.exit_code} · failing_count=${initialFailing?.size ?? 0}`);
  if (!initialFailing || initialFailing.size === 0) {
    return {
      verdict: "refused_no_findings_ever",
      hops: [],
      initial_failing_names: [],
      final_failing_names: [],
      rollback_status: "not_needed",
      reasoning_trace: trace,
      taught_by: "master_ai_engineer",
    };
  }
  const initialFailingArr = Array.from(initialFailing);
  let currentOutput = initial.output;
  let hopNum = 0;

  // Loop shape: verify (check clean) → detect regression → find failure →
  // apply. Cap trips ONLY when the check-clean step still has failures
  // AND we've already applied `maxHops` fixes.
  while (true) {
    // Regression check · any current failure not in the initial set?
    const currentFailing = failingTestNames(currentOutput);
    const newlyFailing: string[] = [];
    if (currentFailing) {
      for (const n of currentFailing) if (!initialFailing.has(n)) newlyFailing.push(n);
    }
    if (newlyFailing.length > 0) {
      T(`REGRESSION detected · newly failing: [${newlyFailing.join(", ")}]`);
      const rb = rollbackAll();
      return {
        verdict: "refused_mid_chain_regression",
        hops,
        initial_failing_names: initialFailingArr,
        final_failing_names: currentFailing ? Array.from(currentFailing) : [],
        newly_failing_names: newlyFailing,
        rollback_status: snapshots.size > 0 ? rb : "not_needed",
        reasoning_trace: trace,
        taught_by: "master_ai_engineer",
      };
    }

    // Extract failures for this hop
    const extract = extractRuntimeFailures(currentOutput);
    if (extract.kind !== "ok" || extract.findings.length === 0) {
      T(`no failures remaining · all_verified_multi_hop (after ${hopNum} hops)`);
      const rb = rollbackAll();
      return {
        verdict: "all_verified_multi_hop",
        hops,
        initial_failing_names: initialFailingArr,
        final_failing_names: [],
        rollback_status: snapshots.size > 0 ? rb : "not_needed",
        reasoning_trace: trace,
        taught_by: "master_ai_engineer",
      };
    }

    // Cap check · we're about to try another hop
    if (hopNum >= maxHops) {
      T(`hop cap ${maxHops} exceeded · still failing: ${currentFailing?.size ?? 0}`);
      const rb = rollbackAll();
      return {
        verdict: "refused_hop_cap_exceeded",
        hops,
        initial_failing_names: initialFailingArr,
        final_failing_names: currentFailing ? Array.from(currentFailing) : [],
        rollback_status: rb,
        reasoning_trace: trace,
        taught_by: "master_ai_engineer",
      };
    }
    hopNum++;

    // Take first finding for this hop
    const finding = extract.findings[0];
    const diagnosis = diagnoseAndPropose(finding, repoRoot);
    T(`hop ${hopNum} · finding=${finding.test_name} · J.2 kind=${diagnosis.kind}`);

    if (diagnosis.kind !== "proposal" || !diagnosis.proposal) {
      hops.push({
        hop_number: hopNum,
        test_name: finding.test_name,
        expected: finding.expected,
        actual: finding.actual,
        diagnosis_kind: diagnosis.kind,
        proposal_summary: null,
        applied: false,
        result: `J.2 refused (${diagnosis.kind})`,
      });
      const rb = rollbackAll();
      return {
        verdict: "refused_mid_chain_j2",
        hops,
        initial_failing_names: initialFailingArr,
        final_failing_names: currentFailing ? Array.from(currentFailing) : [],
        rollback_status: snapshots.size > 0 ? rb : "not_needed",
        reasoning_trace: trace,
        taught_by: "master_ai_engineer",
      };
    }

    // Snapshot target before applying
    const targetPath = diagnosis.proposal.target_file;
    const abs = resolve(repoRoot, targetPath);
    if (!snapshots.has(targetPath)) snapshots.set(targetPath, readFileSync(abs, "utf8"));

    // Apply proposal · same semantics as J.3's replace_return_literal splicer
    const before = readFileSync(abs, "utf8");
    const applied = applyReplaceReturnLiteral(
      before,
      diagnosis.proposal.target_function,
      diagnosis.proposal.current_literal,
      diagnosis.proposal.proposed_literal,
    );
    if (!applied.ok) {
      hops.push({
        hop_number: hopNum,
        test_name: finding.test_name,
        expected: finding.expected,
        actual: finding.actual,
        diagnosis_kind: "proposal",
        proposal_summary: describeProposal(diagnosis.proposal),
        applied: false,
        result: `apply failed · ${applied.reason}`,
      });
      const rb = rollbackAll();
      return {
        verdict: "refused_apply_failed",
        hops,
        initial_failing_names: initialFailingArr,
        final_failing_names: [],
        rollback_status: rb,
        reasoning_trace: trace,
        taught_by: "master_ai_engineer",
      };
    }
    writeFileSync(abs, applied.content, "utf8");
    hops.push({
      hop_number: hopNum,
      test_name: finding.test_name,
      expected: finding.expected,
      actual: finding.actual,
      diagnosis_kind: "proposal",
      proposal_summary: describeProposal(diagnosis.proposal),
      applied: true,
      result: "applied · next iteration will rerun vitest",
    });

    // Rerun vitest for next iteration
    const nextRun = runVitest(runSpec, repoRoot);
    currentOutput = nextRun.output;
  }
}

// ─── Local helpers (duplicated from J.3 by design · avoids export churn) ─

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

function failingTestNames(output: string): Set<string> | null {
  const extract = extractRuntimeFailures(output);
  if (extract.kind !== "ok") return null;
  const names = new Set<string>();
  for (const f of extract.findings) if (f.test_name) names.add(f.test_name);
  return names;
}

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
      } else if (decl && decl.initializer && (ts.isStringLiteral(decl.initializer) || ts.isNumericLiteral(decl.initializer) || decl.initializer.kind === ts.SyntaxKind.TrueKeyword || decl.initializer.kind === ts.SyntaxKind.FalseKeyword || decl.initializer.kind === ts.SyntaxKind.NullKeyword)) {
        // Also handle imported constants: `export const X = <lit>;`
        const litText = decl.initializer.getText(sf);
        if (litText === currentLiteral) {
          box.hit = { start: decl.initializer.getStart(sf), end: decl.initializer.getEnd() };
          return;
        }
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
    return { ok: false, reason: `function/constant '${functionName}' with literal '${currentLiteral}' not found` };
  }
  const next = source.slice(0, box.hit.start) + proposedLiteral + source.slice(box.hit.end);
  return { ok: true, content: next, hash: createHash("sha256").update(next).digest("hex") };
}

function describeProposal(p: { change_kind: string; target_file: string; target_function: string; current_literal: string; proposed_literal: string }): string {
  return `${p.change_kind}(${p.target_function} · ${p.current_literal} → ${p.proposed_literal} in ${p.target_file})`;
}
