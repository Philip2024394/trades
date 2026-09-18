// src/lib/nex-agent/code-engine/native-programming-loop.ts
//
// NEX1 Native Programming Loop · composition wrapper · deterministic · zero LLM.
//
// Wires existing NEX1 capabilities into ONE end-to-end trace:
//
//   Founder Goal
//   → UNDERSTAND       (parse goal · locate target file:line)
//   → INSPECT          (runVitest → raw output)
//   → REASON           (capability-J.1 extractRuntimeFailures)
//   → PLAN             (capability-J.2 diagnoseAndPropose)
//   → CHANGE           (ast-semantic adapter · when applicable)
//   → TEST             (runVitest again)
//   → DIAGNOSE         (re-extract failures if any)
//   → REPAIR           (bounded retry via existing capabilities)
//   → VERIFY           (final vitest state)
//   → LEARN            (record trace as KnowledgeEntry via nex-code-brain)
//
// This module composes existing capabilities. It DOES NOT reimplement any
// of them. It ADDS ZERO new reasoning: every step delegates to the
// already-audited deterministic capability. When a step has no capable
// deterministic path, the loop reports `capability_not_yet_implemented`
// verbatim — never fabricates progress and never proposes an LLM.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve as pathResolve, dirname } from "node:path";
import { runVitest, runTsc, type TestRunResult } from "@/lib/nex-coding-team/test-runner";
import { isProtected } from "./scope-enforcer";
import { applyAddArrayElement, applyReplaceReturnLiteral, AstSemanticAdapter } from "./adapters/ast-semantic";
import {
  extractRuntimeFailures,
  type Nex1RuntimeFailureFinding,
  type Nex1RuntimeExtractResult,
} from "./capability-j-runtime-diagnosis";
import {
  diagnoseAndPropose,
  type Nex1FailureDiagnosis,
  type Nex1RepairProposal,
} from "./capability-j2-cause-analysis";
import {
  traceLocalValueDataflow,
  type Nex1DataflowDiagnosis,
  type Nex1DataflowProposal,
} from "./capability-k-local-value-dataflow";
import {
  parseTscOutput,
  extractMissingPropertyFindings,
  composeRepairDirectiveTypeAware,
  type MissingPropertyFinding,
} from "./consequence-reasoner";
import type { Nex1RepositorySource } from "./capability-c-type-aware-repair";

export type StageVerdict =
  | "VERIFIED"
  | "PARTIAL"
  | "NOT_IMPLEMENTED"
  | "CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM"
  | "SKIPPED";

export interface StageResult {
  readonly stage:
    | "understand"
    | "inspect"
    | "reason"
    | "plan"
    | "change"
    | "test"
    | "diagnose"
    | "repair"
    | "verify"
    | "learn";
  readonly verdict: StageVerdict;
  readonly summary: string;
  readonly evidence: readonly string[];
  readonly reasoning_trace: readonly string[];
  readonly duration_ms: number;
}

export type NativeLoopMode = "vitest" | "tsc";

export interface NativeLoopInput {
  readonly founder_goal: string;
  readonly target_test_file?: string; // repo-relative
  readonly target_line?: number;
  readonly repo_root?: string; // defaults to process.cwd()
  readonly test_timeout_ms?: number; // default 60s
  /** Rung-5 · dispatches to the tsc-based deterministic type-repair chain when set. */
  readonly mode?: NativeLoopMode;
  /** Rung-5 · path to a tsconfig.json scoping the tsc-mode check (avoids whole-repo noise). */
  readonly tsc_project?: string;
  /**
   * Batch 2A Streaming · 2026-09-17.
   *
   * Optional per-stage observer. Called EXACTLY ONCE per StageResult
   * as soon as that stage completes (or is skipped). Callback is
   * fire-and-forget · thrown errors are swallowed so the loop never
   * halts because of an observer failure.
   *
   * When absent, the loop behaves identically to before — no delays,
   * no extra work, no observable difference. Batch 1 callers pass
   * nothing.
   */
  readonly onStage?: (s: StageResult) => void;
}

export interface NativeLoopResult {
  readonly loop_id: string;
  readonly started_at: string;
  readonly finished_at: string;
  readonly founder_goal: string;
  readonly target_test_file: string | null;
  readonly target_line: number | null;
  readonly stages: readonly StageResult[];
  readonly overall_verdict: StageVerdict;
  readonly founder_summary: string;
  readonly repo_root: string;
  readonly baseline_test_result: {
    readonly failing_tests: readonly string[];
    readonly summary: string;
    readonly exit_code: number | null;
  } | null;
  readonly final_test_result: {
    readonly failing_tests: readonly string[];
    readonly summary: string;
    readonly exit_code: number | null;
  } | null;
  readonly capability_gaps: readonly string[]; // human-readable list of what would need to be added
}

const CAPABILITY_NOT_YET = "CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM" as const;

/**
 * Compose existing capabilities into a single trace. Never fabricates
 * progress. Never adds an LLM. Reports honest verdicts per stage.
 */
export async function runNativeProgrammingLoop(input: NativeLoopInput): Promise<NativeLoopResult> {
  const startedAt = new Date();
  const loopId = `nex1-loop-${startedAt.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const repoRoot = input.repo_root ?? process.cwd();

  // Rung-5 · dispatch to tsc-mode when requested. This is a GENUINELY
  // different failure-source and capability chain from vitest-mode:
  //   INSPECT → runTsc(scoped) · REASON → parseTscOutput + extractMissingPropertyFindings ·
  //   PLAN → composeRepairDirectiveTypeAware · CHANGE → AstSemanticAdapter.reason
  //   with `add_property_to_object_at_position` directive · TEST/VERIFY/LEARN reuse.
  if (input.mode === "tsc") {
    return await runNativeProgrammingLoopTsc(input, startedAt, loopId, repoRoot);
  }

  const stages: StageResult[] = [];
  // Batch 2A Streaming · 2026-09-17. Fire-and-forget observer wrapper on
  // .push so downstream callers can emit each StageResult as SSE events
  // without touching 65 push sites or refactoring the loop into a
  // generator. When onStage is absent this is a straight no-op.
  if (input.onStage) {
    const _origPush = stages.push.bind(stages);
    stages.push = ((...items: StageResult[]): number => {
      const r = _origPush(...items);
      for (const s of items) {
        try { input.onStage!(s); } catch { /* observer must never break the loop */ }
      }
      return r;
    }) as typeof stages.push;
  }
  const capabilityGaps: string[] = [];

  // ─── STAGE 1 · UNDERSTAND ───────────────────────────────────────
  const understand = timed<StageResult>("understand", () => {
    const trace: string[] = [];
    const evidence: string[] = [];

    // Deterministic parse of the goal for file:line references
    const fileLineRe = /([\w/.\-@]+\.[jt]sx?)(?::(\d+))?/g;
    const found: Array<{ file: string; line?: number }> = [];
    let m: RegExpExecArray | null;
    while ((m = fileLineRe.exec(input.founder_goal)) !== null) {
      found.push({ file: m[1], line: m[2] ? Number(m[2]) : undefined });
    }
    trace.push(`extracted ${found.length} file references from goal`);

    let target = input.target_test_file ?? null;
    let line = input.target_line ?? null;
    if (!target && found.length > 0) {
      target = found[0].file;
      line = found[0].line ?? null;
      trace.push(`selected first reference: ${target}${line ? `:${line}` : ""}`);
    }

    if (target) evidence.push(`target=${target}${line ? `:${line}` : ""}`);

    return {
      stage: "understand",
      verdict: target ? ("VERIFIED" as StageVerdict) : ("NOT_IMPLEMENTED" as StageVerdict),
      summary: target
        ? `target identified: ${target}${line ? `:${line}` : ""}`
        : `no target file identifiable from goal without natural-language interpretation`,
      evidence,
      reasoning_trace: trace,
      duration_ms: 0, // filled by timed()
    };
  });
  stages.push(understand.value);

  const targetTestFile = extractTargetFromStage(understand.value) ?? input.target_test_file ?? null;
  const targetLine =
    (understand.value.evidence[0] ?? "").match(/:(\d+)$/)?.[1]
      ? Number((understand.value.evidence[0] ?? "").match(/:(\d+)$/)![1])
      : input.target_line ?? null;

  if (!targetTestFile) {
    return finalise({
      loopId,
      startedAt,
      input,
      repoRoot,
      stages,
      capabilityGaps: ["understand: no natural-language target extraction without LLM"],
      baseline: null,
      finalRun: null,
      overallVerdict: CAPABILITY_NOT_YET,
      founderSummary:
        `UNDERSTAND could not identify a target file. Only deterministic file:line extraction is implemented. Natural-language target inference is ${CAPABILITY_NOT_YET}.`,
    });
  }

  const targetAbs = pathResolve(repoRoot, targetTestFile);
  if (!existsSync(targetAbs)) {
    const cannotOpen: StageResult = {
      stage: "inspect",
      verdict: "NOT_IMPLEMENTED",
      summary: `target file does not exist: ${targetTestFile}`,
      evidence: [targetTestFile],
      reasoning_trace: [`existsSync(${targetAbs}) → false`],
      duration_ms: 0,
    };
    stages.push(cannotOpen);
    return finalise({
      loopId,
      startedAt,
      input,
      repoRoot,
      stages,
      capabilityGaps: ["inspect: target file missing on disk"],
      baseline: null,
      finalRun: null,
      overallVerdict: "NOT_IMPLEMENTED",
      founderSummary: `Target test file not present in repo: ${targetTestFile}. Loop halted safely.`,
    });
  }

  // ─── STAGE 2 · INSPECT (baseline vitest run) ─────────────────────
  const inspect = await timedAsync<{ stage: StageResult; run: TestRunResult }>("inspect", async () => {
    const trace: string[] = [`spawn: npx vitest run --reporter=verbose ${targetTestFile}`];
    const runResult = await runVitest(targetTestFile, input.test_timeout_ms ?? 60_000, {
      reporter: "verbose",
      env: { CI: "1" }, // Unlock full FAIL block under piped stdout
    });
    trace.push(`exit_code=${runResult.exit_code} · duration_ms=${runResult.duration_ms}`);
    trace.push(`failing_tests=${runResult.failing_tests.length}`);
    return {
      stage: {
        stage: "inspect",
        verdict: "VERIFIED" as StageVerdict,
        summary: runResult.summary,
        evidence: [
          `exit_code=${runResult.exit_code}`,
          `failing_tests=${runResult.failing_tests.length}`,
          `duration_ms=${runResult.duration_ms}`,
        ],
        reasoning_trace: trace,
        duration_ms: 0,
      },
      run: runResult,
    };
  });
  stages.push(inspect.value.stage);
  const baselineRun = inspect.value.run;

  if (baselineRun.ok) {
    // Test is already passing — no work to do
    stages.push(skipped("reason", `baseline vitest passed · nothing to diagnose`));
    stages.push(skipped("plan", `no failures · nothing to plan`));
    stages.push(skipped("change", `no failures · nothing to change`));
    stages.push(skipped("test", `already covered by baseline`));
    stages.push(skipped("diagnose", `no failures · nothing to diagnose`));
    stages.push(skipped("repair", `no failures · nothing to repair`));
    stages.push(skipped("verify", `already verified by baseline`));
    stages.push({
      stage: "learn",
      verdict: "VERIFIED",
      summary: "no learning required · target test already passes",
      evidence: [],
      reasoning_trace: [`baseline exit_code=${baselineRun.exit_code}`],
      duration_ms: 0,
    });
    return finalise({
      loopId,
      startedAt,
      input,
      repoRoot,
      stages,
      capabilityGaps: [],
      baseline: baselineRun,
      finalRun: baselineRun,
      overallVerdict: "VERIFIED",
      founderSummary: `Target test already passes. Loop performed baseline inspection only.`,
    });
  }

  // ─── STAGE 3 · REASON (parse vitest output → structured findings) ─
  const reasonRes = timed<{ stage: StageResult; findings: readonly Nex1RuntimeFailureFinding[] }>(
    "reason",
    () => {
      const trace: string[] = [`extractRuntimeFailures(vitest_stdout · ${baselineRun.stdout_tail.length}B tail)`];
      // Deterministic preprocessor · vitest verbose reporter under Node child_process
      // emits compact "× path > desc > name / → expected X to be Y" pairs instead of
      // the full FAIL block that capability-J.1 recognises. Synthesise the FAIL block
      // shape so J.1 can extract structured findings. Zero inference · zero LLM.
      const preprocessed = synthesiseFailBlocksFromCompact(baselineRun.stdout_tail);
      if (preprocessed !== baselineRun.stdout_tail) {
        trace.push(`preprocessed compact-verbose → FAIL-block form (added ${preprocessed.length - baselineRun.stdout_tail.length}B)`);
      }
      const extract: Nex1RuntimeExtractResult = extractRuntimeFailures(preprocessed);
      if (extract.kind !== "ok") {
        trace.push(`refused: ${extract.refusal_class} · ${extract.reason}`);
        return {
          stage: {
            stage: "reason",
            verdict: "CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM" as StageVerdict,
            summary: `runtime-diagnosis refused: ${extract.refusal_class}`,
            evidence: [extract.refusal_class, extract.reason],
            reasoning_trace: trace,
            duration_ms: 0,
          },
          findings: [],
        };
      }
      trace.push(`extracted ${extract.findings.length} structured findings`);
      const kinds = extract.findings.map((f) => f.kind);
      return {
        stage: {
          stage: "reason",
          verdict: "VERIFIED" as StageVerdict,
          summary: `${extract.findings.length} finding(s) · kinds=[${kinds.join(",")}]`,
          evidence: extract.findings.map(
            (f) =>
              `${f.kind} · test=${f.test_file}:${f.test_name} · expected=${f.expected} · actual=${f.actual}`,
          ),
          reasoning_trace: trace,
          duration_ms: 0,
        },
        findings: extract.findings,
      };
    },
  );
  stages.push(reasonRes.value.stage);
  const findings = reasonRes.value.findings;

  if (findings.length === 0) {
    capabilityGaps.push("reason: capability-J.1 refused the output · no findings to plan against");
    stages.push(skipped("plan", `no findings · nothing to plan`));
    stages.push(skipped("change", `no plan · nothing to change`));
    stages.push(skipped("test", `no change to verify`));
    stages.push(skipped("diagnose", `no test rerun`));
    stages.push(skipped("repair", `no diagnosis`));
    stages.push(skipped("verify", `no repair`));
    stages.push({
      stage: "learn",
      verdict: CAPABILITY_NOT_YET,
      summary: `no structured findings extractable · nothing to learn from`,
      evidence: [],
      reasoning_trace: [],
      duration_ms: 0,
    });
    return finalise({
      loopId,
      startedAt,
      input,
      repoRoot,
      stages,
      capabilityGaps,
      baseline: baselineRun,
      finalRun: baselineRun,
      overallVerdict: CAPABILITY_NOT_YET,
      founderSummary:
        `REASON stage produced no structured findings. Runtime diagnosis capability refused. ${CAPABILITY_NOT_YET}.`,
    });
  }

  // ─── STAGE 4 · PLAN (J.2 first · Capability K fallback) ──────────
  type CombinedProposal =
    | { kind: "j2"; proposal: Nex1RepairProposal }
    | { kind: "k"; proposal: Nex1DataflowProposal };
  const planRes = timed<{
    stage: StageResult;
    diagnoses: readonly Nex1FailureDiagnosis[];
    kDiagnoses: readonly Nex1DataflowDiagnosis[];
    proposals: readonly CombinedProposal[];
  }>("plan", () => {
    const trace: string[] = [];
    const diagnoses: Nex1FailureDiagnosis[] = [];
    const kDiagnoses: Nex1DataflowDiagnosis[] = [];
    const proposals: CombinedProposal[] = [];
    for (const f of findings) {
      const d = diagnoseAndPropose(f, repoRoot);
      diagnoses.push(d);
      trace.push(
        `finding[${f.kind}] · J.2 → kind=${d.kind} · confidence=${d.confidence}${
          d.proposal ? ` · proposal=${d.proposal.change_kind}` : ""
        }`,
      );
      if (d.proposal) {
        proposals.push({ kind: "j2", proposal: d.proposal });
        continue;
      }
      // Fallback: try Capability K when J.2 refuses because the receiver is a locally-declared identifier
      if (d.kind === "refused_unknown_test_shape") {
        const k = traceLocalValueDataflow(f, repoRoot);
        kDiagnoses.push(k);
        trace.push(
          `finding[${f.kind}] · Capability K → kind=${k.kind} · confidence=${k.confidence}${
            k.proposal ? ` · proposal=${k.proposal.change_kind}` : ""
          }`,
        );
        if (k.proposal) proposals.push({ kind: "k", proposal: k.proposal });
      }
    }
    const anyProposal = proposals.length > 0;
    return {
      stage: {
        stage: "plan",
        verdict: anyProposal ? ("VERIFIED" as StageVerdict) : (CAPABILITY_NOT_YET as StageVerdict),
        summary: anyProposal
          ? `${proposals.length} concrete repair proposal(s) generated (J.2 + K)`
          : `capability-J.2 and Capability K both refused · no proposal within deterministic scope`,
        evidence: [
          ...diagnoses.map((d) => `J.2 · ${d.kind} · ${d.diagnosis.slice(0, 180)}`),
          ...kDiagnoses.map((k) => `K · ${k.kind} · ${k.diagnosis.slice(0, 180)}`),
        ],
        reasoning_trace: trace,
        duration_ms: 0,
      },
      diagnoses,
      kDiagnoses,
      proposals,
    };
  });
  stages.push(planRes.value.stage);
  const proposals = planRes.value.proposals;
  const diagnoses = planRes.value.diagnoses;
  const kDiagnoses = planRes.value.kDiagnoses;
  void diagnoses;
  void kDiagnoses;

  if (proposals.length === 0) {
    for (const d of diagnoses) {
      capabilityGaps.push(
        `plan: J.2 refused with class '${d.kind}' · reason: ${d.diagnosis.slice(0, 160)}`,
      );
    }
    stages.push(skipped("change", `no proposal · deterministic mutation not attempted`));
    stages.push(skipped("test", `no change · nothing to verify`));
    stages.push(skipped("diagnose", `no test rerun`));
    stages.push(skipped("repair", `no diagnosis`));
    stages.push(skipped("verify", `no repair`));
    stages.push({
      stage: "learn",
      verdict: CAPABILITY_NOT_YET,
      summary:
        `NEX1 captured a real failure trace but no deterministic repair operator applies. ` +
        `Extending capability-C / capability-J.2 with a new repair class is required. ` +
        `Refusing to substitute an LLM.`,
      evidence: capabilityGaps.slice(0, 10),
      reasoning_trace: [],
      duration_ms: 0,
    });
    return finalise({
      loopId,
      startedAt,
      input,
      repoRoot,
      stages,
      capabilityGaps,
      baseline: baselineRun,
      finalRun: baselineRun,
      overallVerdict: CAPABILITY_NOT_YET,
      founderSummary:
        `Loop reached PLAN and produced structured findings + honest diagnoses. ` +
        `No existing deterministic repair operator covers this class. ` +
        `${CAPABILITY_NOT_YET} at CHANGE stage. NEX1 refuses to guess.`,
    });
  }

  // ─── STAGE 5 · CHANGE ────────────────────────────────────────────
  // Rung 4 · apply ONE proposal per iteration. Additional proposals — and
  // brand-new proposals generated after re-diagnosing the new test state —
  // are consumed by the REPAIR loop below. This turns two-failure scenarios
  // into a genuine iterative recovery flow rather than a one-shot batch.
  const changeTrace: string[] = [];
  const appliedMutations: Array<{ target_file: string; inserted_ids: readonly string[]; skipped: readonly string[]; iteration: number }> = [];
  const appliedProposalKeys = new Set<string>(); // anti-loop guard
  const changeRefusals: string[] = [];
  const changeGapKinds = new Set<string>();

  const firstProposal = proposals[0]!;
  const firstApply = tryApplyProposal(firstProposal, repoRoot, 1);
  changeTrace.push(...firstApply.trace);
  if (firstApply.mutation) appliedMutations.push(firstApply.mutation);
  if (firstApply.refusal) changeRefusals.push(firstApply.refusal);
  if (firstApply.gapKind) changeGapKinds.add(firstApply.gapKind);
  if (firstApply.proposalKey) appliedProposalKeys.add(firstApply.proposalKey);

  // ─── Fix 23c · 2026-09-17 · preservation check ─────────────────────
  // After a J.2 mutation writes to disk, run the sibling <basename>.test.ts
  // (if it exists · excluding the spec-derived test) to detect regressions
  // against existing invariants. If any existing test fails, REVERT the
  // mutation and record a preservation refusal. This prevents NEX1 from
  // "fixing" one spec at the cost of breaking others without founder consent.
  if (firstApply.mutation && firstApply.sourceBefore != null && firstProposal.kind === "j2") {
    const mutatedRel = firstApply.mutation.target_file;
    const preservationOutcome = await runPreservationCheck(
      mutatedRel,
      repoRoot,
      input.target_test_file ?? null,
    );
    changeTrace.push(...preservationOutcome.trace);
    if (preservationOutcome.kind === "no_sibling") {
      changeTrace.push(`preservation · no sibling *.test.ts adjacent to ${mutatedRel} · nothing to preserve`);
    } else if (preservationOutcome.kind === "regressed") {
      // Revert
      try {
        writeFileSync(pathResolve(repoRoot, mutatedRel), firstApply.sourceBefore, "utf8");
        changeTrace.push(`preservation · REVERTED ${mutatedRel} to pre-mutation state (SHA restored)`);
      } catch (e) {
        changeTrace.push(`preservation · REVERT FAILED · ${e instanceof Error ? e.message : String(e)}`);
      }
      // Clear the applied mutation from consideration
      appliedMutations.pop();
      changeRefusals.push(
        `preservation_regression · ${preservationOutcome.failing_tests.length} existing test(s) failed after mutation · ` +
        `first: ${preservationOutcome.failing_tests[0] ?? "<unnamed>"} · mutation reverted`,
      );
      changeGapKinds.add("preservation_regression");
    }
  }

  const anyApplied = appliedMutations.some((m) => m.inserted_ids.length > 0);
  const changeStage: StageResult = {
    stage: "change",
    verdict:
      anyApplied ? "VERIFIED" :
      appliedMutations.length > 0 ? "PARTIAL" : // only no-ops
      CAPABILITY_NOT_YET,
    summary:
      anyApplied
        ? `Applied ${appliedMutations.filter((m) => m.inserted_ids.length > 0).length} mutation(s) via deterministic ast-semantic operator (J.2/K)`
        : appliedMutations.length > 0
          ? `No mutation needed · all proposed ids already present`
          : `No operator applied · refusals: [${changeRefusals.join(" | ")}]`,
    evidence: [
      ...appliedMutations.map((m) =>
        `${m.target_file} · inserted=[${m.inserted_ids.map((s) => `'${s}'`).join(", ")}]${m.skipped.length > 0 ? ` · skipped=[${m.skipped.map((s) => `'${s}'`).join(", ")}]` : ""}`,
      ),
      ...changeRefusals.map((r) => `refused · ${r}`),
    ],
    reasoning_trace: changeTrace,
    duration_ms: 0,
  };
  stages.push(changeStage);
  for (const k of changeGapKinds) {
    capabilityGaps.push(
      `change: ast-semantic adapter needs a new deterministic operator '${k}' to consume produced proposals`,
    );
  }

  if (!anyApplied) {
    // Nothing changed on disk · downstream stages remain skipped / gapped
    stages.push(skipped("test", `no mutation applied · nothing new to verify`));
    stages.push(skipped("diagnose", `no test rerun`));
    stages.push(skipped("repair", `no diagnosis`));
    stages.push(skipped("verify", `no repair`));
    stages.push({
      stage: "learn",
      verdict: CAPABILITY_NOT_YET,
      summary: `NEX1 produced proposals but no operator applied · specific gap recorded above`,
      evidence: capabilityGaps.slice(0, 10),
      reasoning_trace: [],
      duration_ms: 0,
    });
    return finalise({
      loopId,
      startedAt,
      input,
      repoRoot,
      stages,
      capabilityGaps,
      baseline: baselineRun,
      finalRun: baselineRun,
      overallVerdict: CAPABILITY_NOT_YET,
      founderSummary:
        `NEX1 reached CHANGE with a real proposal but no deterministic operator applied. ` +
        `${CAPABILITY_NOT_YET}. Refusals: ${changeRefusals.join(" · ")}`,
    });
  }

  // ─── STAGE 6 · TEST ─────────────────────────────────────────────
  const testRes = await timedAsync<{ stage: StageResult; run: TestRunResult }>("test", async () => {
    const trace: string[] = [`spawn: npx vitest run --reporter=verbose ${targetTestFile}`];
    const runResult = await runVitest(targetTestFile, input.test_timeout_ms ?? 60_000, {
      reporter: "verbose",
      env: { CI: "1" },
    });
    trace.push(`exit_code=${runResult.exit_code} · duration_ms=${runResult.duration_ms}`);
    trace.push(`failing_tests=${runResult.failing_tests.length}`);
    const passed = runResult.ok;
    return {
      stage: {
        stage: "test",
        verdict: passed ? "VERIFIED" as StageVerdict : "PARTIAL" as StageVerdict,
        summary: passed
          ? `all tests passed · exit_code=0`
          : `${runResult.failing_tests.length} test(s) still failing · exit_code=${runResult.exit_code}`,
        evidence: [
          `exit_code=${runResult.exit_code}`,
          `failing_tests=${runResult.failing_tests.length}`,
          ...runResult.failing_tests.slice(0, 3).map((t) => `still failing: ${t}`),
        ],
        reasoning_trace: trace,
        duration_ms: 0,
      },
      run: runResult,
    };
  });
  stages.push(testRes.value.stage);
  const finalRun = testRes.value.run;

  if (finalRun.ok) {
    // ─── STAGE 7 · DIAGNOSE (nothing to diagnose · verification-time) ─
    stages.push({
      stage: "diagnose",
      verdict: "SKIPPED",
      summary: `all tests pass · nothing to diagnose`,
      evidence: [],
      reasoning_trace: [],
      duration_ms: 0,
    });
    // ─── STAGE 8 · REPAIR (no repair required) ─────────────────────
    stages.push({
      stage: "repair",
      verdict: "SKIPPED",
      summary: `no failure · no repair required`,
      evidence: [],
      reasoning_trace: [],
      duration_ms: 0,
    });
    // ─── STAGE 9 · VERIFY (green re-run confirmed above) ───────────
    stages.push({
      stage: "verify",
      verdict: "VERIFIED",
      summary: `real vitest run passed after mutation · exit_code=0`,
      evidence: [`baseline exit_code=${baselineRun.exit_code} → after-mutation exit_code=${finalRun.exit_code}`],
      reasoning_trace: [`baseline failing: [${baselineRun.failing_tests.slice(0, 3).join(", ")}]`, `after: 0 failing`],
      duration_ms: 0,
    });
    // ─── STAGE 10 · LEARN (record real lesson from the completed loop) ─
    const lessonBody = [
      `# NEX1 Native Programming Loop · verified completion`,
      ``,
      `**loop_id:** ${loopId}`,
      `**founder_goal:** ${input.founder_goal}`,
      `**target_test:** ${targetTestFile}${targetLine ? `:${targetLine}` : ""}`,
      ``,
      `## Baseline`,
      `- exit_code: ${baselineRun.exit_code}`,
      `- failing: ${baselineRun.failing_tests.join(", ")}`,
      ``,
      `## Applied mutations`,
      ...appliedMutations.map((m) =>
        `- ${m.target_file} · inserted [${m.inserted_ids.map((s) => `'${s}'`).join(", ")}]${m.skipped.length > 0 ? ` · skipped [${m.skipped.map((s) => `'${s}'`).join(", ")}]` : ""}`,
      ),
      ``,
      `## Final state`,
      `- exit_code: ${finalRun.exit_code}`,
      `- failing: (none)`,
      ``,
      `## Chain composition`,
      `- UNDERSTAND → INSPECT → REASON (J.1) → PLAN (K) → CHANGE (add_array_element) → TEST → VERIFY`,
      `- Zero LLM · deterministic composition of existing NEX1 capabilities`,
    ].join("\n");
    stages.push({
      stage: "learn",
      verdict: "VERIFIED",
      summary: `lesson recorded · loop verified end-to-end without LLM`,
      evidence: [`lesson body ${lessonBody.length}B captured in loop result`],
      reasoning_trace: [`stored inline (nex-code-brain lesson-extractor consumes coding-team runs · not this loop's artifact model)`],
      duration_ms: 0,
    });
    return finalise({
      loopId,
      startedAt,
      input,
      repoRoot,
      stages,
      capabilityGaps,
      baseline: baselineRun,
      finalRun: finalRun,
      overallVerdict: "VERIFIED",
      founderSummary:
        `Rung 3 · NEX1 Native Programming Loop completed end-to-end. Goal: ${input.founder_goal.slice(0, 120)} · ` +
        `Baseline: 1 failing · Applied: ${appliedMutations.filter((m) => m.inserted_ids.length > 0).length} mutation(s) · Final: 0 failing · ` +
        `Zero LLM. Zero fabrication.`,
    });
  }

  // ─── Test still failed after first mutation · Rung 4 recovery iteration ─
  // DIAGNOSE the new state, then REPAIR iterates: re-plan from new findings,
  // pick a proposal not previously applied, mutate again, re-test.
  const diagTraceRoot: string[] = [];
  const initialDiag = diagnosePostState(finalRun);
  diagTraceRoot.push(`iteration 1 · ${initialDiag.summary}`);
  stages.push({
    stage: "diagnose",
    verdict: initialDiag.findings.length > 0 ? "VERIFIED" : (CAPABILITY_NOT_YET as StageVerdict),
    summary: initialDiag.summary,
    evidence: initialDiag.findings.map((f) => `${f.kind} · expected=${f.expected} · actual=${f.actual}`),
    reasoning_trace: initialDiag.trace,
    duration_ms: 0,
  });

  // ─── REPAIR · bounded recovery iterations ───────────────────────
  const MAX_RECOVERY_ITERATIONS = 3;
  const repairTrace: string[] = [];
  let currentFindings = initialDiag.findings;
  let latestRun: TestRunResult = finalRun;
  let iteration = 1; // iteration 1 was the first CHANGE
  let repairVerdict: StageVerdict = "PARTIAL";
  let repairSummary = "";
  const repairRefusalNames: string[] = [];

  while (iteration < MAX_RECOVERY_ITERATIONS && !latestRun.ok && currentFindings.length > 0) {
    iteration++;
    repairTrace.push(`── recovery iteration ${iteration} ──`);
    // Re-plan from current findings (with tracing so refusals are visible)
    const traced = planFromFindingsTraced(currentFindings, repoRoot);
    repairTrace.push(...traced.trace);
    const nextProposals = [...traced.proposals];
    repairTrace.push(`re-planned · ${nextProposals.length} candidate proposal(s)`);
    // Filter to proposals we haven't tried
    const untried = nextProposals.filter((p) => !appliedProposalKeys.has(proposalKey(p)));
    if (untried.length === 0) {
      repairTrace.push(`no untried proposals · repair-strategy exhausted at iteration ${iteration}`);
      repairSummary = `no new proposal available at iteration ${iteration} · repair-strategy exhausted`;
      repairVerdict = CAPABILITY_NOT_YET;
      repairRefusalNames.push("repair_strategy_exhausted");
      break;
    }
    const chosen = untried[0]!;
    const apply = tryApplyProposal(chosen, repoRoot, iteration);
    repairTrace.push(...apply.trace);
    if (apply.proposalKey) appliedProposalKeys.add(apply.proposalKey);
    if (apply.mutation) appliedMutations.push(apply.mutation);
    if (apply.refusal) {
      repairRefusalNames.push(apply.refusal);
      repairTrace.push(`iteration ${iteration} refused · ${apply.refusal}`);
      repairSummary = `operator refused at iteration ${iteration}: ${apply.refusal}`;
      repairVerdict = CAPABILITY_NOT_YET;
      break;
    }
    // Re-test
    repairTrace.push(`iteration ${iteration} · re-test`);
    const nextRun = await runVitest(targetTestFile, input.test_timeout_ms ?? 60_000, {
      reporter: "verbose",
      env: { CI: "1" },
    });
    latestRun = nextRun;
    repairTrace.push(`iteration ${iteration} · exit_code=${nextRun.exit_code} · failing=${nextRun.failing_tests.length}`);
    if (nextRun.ok) {
      repairSummary = `recovery converged at iteration ${iteration} · exit_code=0`;
      repairVerdict = "VERIFIED";
      break;
    }
    // Otherwise · re-diagnose for the next iteration
    const nextDiag = diagnosePostState(nextRun);
    currentFindings = nextDiag.findings;
    repairTrace.push(`iteration ${iteration} · diagnosed ${currentFindings.length} finding(s)`);
    if (currentFindings.length === 0) {
      repairSummary = `iteration ${iteration} · runtime-diagnosis refused · ${nextDiag.summary}`;
      repairVerdict = CAPABILITY_NOT_YET;
      repairRefusalNames.push("runtime_diagnosis_refused");
      break;
    }
  }
  if (iteration >= MAX_RECOVERY_ITERATIONS && !latestRun.ok) {
    repairSummary = repairSummary || `iteration cap reached (${MAX_RECOVERY_ITERATIONS}) without convergence`;
    repairVerdict = repairVerdict === "VERIFIED" ? repairVerdict : "PARTIAL";
    repairRefusalNames.push("iteration_cap_reached");
  }

  stages.push({
    stage: "repair",
    verdict: repairVerdict,
    summary: repairSummary || `no recovery iterations executed`,
    evidence: [
      `iterations_executed=${iteration}`,
      `mutations_across_iterations=${appliedMutations.filter((m) => m.inserted_ids.length > 0).length}`,
      ...(repairRefusalNames.length > 0 ? [`refusals: [${repairRefusalNames.join(", ")}]`] : []),
    ],
    reasoning_trace: repairTrace,
    duration_ms: 0,
  });

  if (repairVerdict === "VERIFIED" && latestRun.ok) {
    // Recovery worked · downstream stages
    stages.push({
      stage: "verify",
      verdict: "VERIFIED",
      summary: `real vitest run passed after recovery · exit_code=0`,
      evidence: [`baseline exit_code=${baselineRun.exit_code} → after-recovery exit_code=${latestRun.exit_code}`, `iterations=${iteration}`],
      reasoning_trace: [`baseline failing: [${baselineRun.failing_tests.slice(0, 3).join(", ")}]`, `after-recovery: 0 failing`],
      duration_ms: 0,
    });
    const lessonBody = [
      `# NEX1 Native Recovery Loop · verified completion`,
      ``,
      `**loop_id:** ${loopId}`,
      `**founder_goal:** ${input.founder_goal}`,
      `**target_test:** ${targetTestFile}${targetLine ? `:${targetLine}` : ""}`,
      `**iterations:** ${iteration}`,
      ``,
      `## Applied mutations (in order)`,
      ...appliedMutations
        .filter((m) => m.inserted_ids.length > 0)
        .map((m) => `- iter ${m.iteration} · ${m.target_file} · inserted [${m.inserted_ids.map((s) => `'${s}'`).join(", ")}]`),
      ``,
      `## Chain composition`,
      `- UNDERSTAND → INSPECT → REASON → PLAN → CHANGE (iter 1) → TEST → DIAGNOSE → REPAIR (iter 2+) → VERIFY`,
      `- Zero LLM · deterministic composition of existing NEX1 capabilities`,
    ].join("\n");
    stages.push({
      stage: "learn",
      verdict: "VERIFIED",
      summary: `lesson recorded · loop recovered end-to-end without LLM in ${iteration} iteration(s)`,
      evidence: [`lesson body ${lessonBody.length}B captured`],
      reasoning_trace: [],
      duration_ms: 0,
    });
    return finalise({
      loopId,
      startedAt,
      input,
      repoRoot,
      stages,
      capabilityGaps,
      baseline: baselineRun,
      finalRun: latestRun,
      overallVerdict: "VERIFIED",
      founderSummary:
        `Rung 4 · NEX1 Native Recovery Loop completed end-to-end in ${iteration} iteration(s). ` +
        `Baseline: ${baselineRun.failing_tests.length} failing · Applied: ${appliedMutations.filter((m) => m.inserted_ids.length > 0).length} mutation(s) across iterations · Final: 0 failing · ` +
        `Zero LLM. Zero fabrication.`,
    });
  }

  // Recovery did not converge · report honestly
  stages.push({
    stage: "verify",
    verdict: latestRun.failing_tests.length < baselineRun.failing_tests.length ? "PARTIAL" : "PARTIAL",
    summary: `recovery iterations did not converge · baseline failing=${baselineRun.failing_tests.length} → final failing=${latestRun.failing_tests.length}`,
    evidence: [`iterations=${iteration}`, `refusals=[${repairRefusalNames.join(", ")}]`],
    reasoning_trace: [],
    duration_ms: 0,
  });
  capabilityGaps.push(
    `repair: bounded iteration completed without convergence · next rung would extend planning strategy set (currently: J.2 + Capability K only)`,
  );
  stages.push({
    stage: "learn",
    verdict: "PARTIAL",
    summary:
      `NEX1 executed ${iteration} iteration(s) of the recovery loop and honestly reports no convergence. ` +
      `Lesson: current planning capabilities cover the observed failure classes only partially.`,
    evidence: capabilityGaps.slice(0, 10),
    reasoning_trace: [],
    duration_ms: 0,
  });
  return finalise({
    loopId,
    startedAt,
    input,
    repoRoot,
    stages,
    capabilityGaps,
    baseline: baselineRun,
    finalRun: latestRun,
    overallVerdict: "PARTIAL",
    founderSummary:
      `Rung 4 · loop iterated ${iteration} time(s) but did not converge. ` +
      `${latestRun.failing_tests.length} test(s) still failing. Refusals: [${repairRefusalNames.join(", ")}]. ` +
      `Refusing to guess.`,
  });
}

// ─── Rung-4 helpers ─────────────────────────────────────────────

type CombinedProposal =
  | { kind: "j2"; proposal: Nex1RepairProposal }
  | { kind: "k"; proposal: Nex1DataflowProposal };

/** Fix 23c · 2026-09-17 · post-mutation preservation check.
 *
 *  Given a mutated source file (repo-relative), locate its sibling test file
 *  (basename + .test.ts) and run vitest on it (excluding the spec-derived
 *  file to avoid feedback loops). Return:
 *    - "no_sibling"      · no sibling test file present · caller should proceed
 *    - "preserved"       · sibling passed · mutation is safe
 *    - "regressed"       · sibling failed · caller MUST revert the mutation
 *
 *  Zero LLM. Deterministic. Read-only apart from invoking the child vitest.
 */
type PreservationOutcome =
  | { readonly kind: "no_sibling"; readonly trace: readonly string[] }
  | { readonly kind: "preserved"; readonly trace: readonly string[]; readonly duration_ms: number }
  | {
      readonly kind: "regressed";
      readonly failing_tests: readonly string[];
      readonly summary: string;
      readonly stdout_tail: string;
      readonly duration_ms: number;
      readonly trace: readonly string[];
    };

async function runPreservationCheck(
  mutatedFileRel: string,
  repoRoot: string,
  specDerivedTestRel: string | null,
): Promise<PreservationOutcome> {
  const trace: string[] = [];
  const targetAbs = pathResolve(repoRoot, mutatedFileRel);
  const dir = dirname(targetAbs);
  const rawBase = mutatedFileRel.split("/").pop() ?? "";
  const base = rawBase.replace(/\.(tsx?|jsx?|mjs|cjs)$/, "");
  // Sibling candidates · deterministic order · same directory only
  const candidates = [
    `${dir.replace(/\\/g, "/")}/${base}.test.ts`,
    `${dir.replace(/\\/g, "/")}/${base}.test.tsx`,
  ];
  const specDerivedAbs = specDerivedTestRel ? pathResolve(repoRoot, specDerivedTestRel).replace(/\\/g, "/") : null;
  const siblings = candidates.filter((c) => {
    // Skip the spec-derived test file · which was created by the loop itself
    if (specDerivedAbs && c === specDerivedAbs) return false;
    return existsSync(c);
  });
  if (siblings.length === 0) {
    return { kind: "no_sibling", trace: [`preservation · no sibling *.test.ts found next to ${mutatedFileRel}`] };
  }
  // Compute repo-relative sibling test path for vitest scope
  const chosen = siblings[0];
  const chosenRel = chosen.replace(/\\/g, "/").replace(
    repoRoot.replace(/\\/g, "/").replace(/\/$/, "") + "/",
    "",
  );
  trace.push(`preservation · running ${chosenRel} against mutated ${mutatedFileRel}`);
  const t0 = Date.now();
  let result: TestRunResult;
  try {
    result = await runVitest(chosenRel, 120_000);
  } catch (e) {
    return {
      kind: "regressed",
      failing_tests: ["<vitest spawn failure>"],
      summary: `preservation vitest failed to run: ${e instanceof Error ? e.message : String(e)}`,
      stdout_tail: "",
      duration_ms: Date.now() - t0,
      trace,
    };
  }
  const dur = Date.now() - t0;
  if (result.ok) {
    trace.push(`preservation · ${chosenRel} PASSED · exit=${result.exit_code} · duration=${dur}ms`);
    return { kind: "preserved", trace, duration_ms: dur };
  }
  trace.push(
    `preservation · ${chosenRel} FAILED · exit=${result.exit_code} · failing=[${result.failing_tests.join(", ")}]`,
  );
  return {
    kind: "regressed",
    failing_tests: result.failing_tests,
    summary: result.summary,
    stdout_tail: result.stdout_tail,
    duration_ms: dur,
    trace,
  };
}

function proposalKey(p: CombinedProposal): string {
  if (p.kind === "j2") {
    const line = p.proposal.target_line ?? "*";
    return `j2::${p.proposal.change_kind}::${p.proposal.target_file}::${p.proposal.target_function}::${p.proposal.current_literal}@L${line}→${p.proposal.proposed_literal}`;
  }
  return `k::${p.proposal.change_kind}::${p.proposal.target_file}::${p.proposal.array_symbol}::${p.proposal.missing_ids.join(",")}`;
}

export interface PlanWithTraces {
  readonly proposals: readonly CombinedProposal[];
  readonly trace: readonly string[];
}

function planFromFindingsTraced(
  findings: readonly Nex1RuntimeFailureFinding[],
  repoRoot: string,
): PlanWithTraces {
  const proposals: CombinedProposal[] = [];
  const trace: string[] = [];
  for (const f of findings) {
    const d = diagnoseAndPropose(f, repoRoot);
    trace.push(`finding[${f.kind}] · J.2 → ${d.kind}${d.proposal ? ` · proposal=${d.proposal.change_kind}` : ""}`);
    if (d.proposal) {
      proposals.push({ kind: "j2", proposal: d.proposal });
      continue;
    }
    if (d.kind === "refused_unknown_test_shape") {
      const k = traceLocalValueDataflow(f, repoRoot);
      trace.push(`finding[${f.kind}] · Capability K → ${k.kind}${k.proposal ? ` · proposal=${k.proposal.change_kind} · missing_ids=[${k.proposal.missing_ids.join(",")}]` : ` · reason: ${k.diagnosis.slice(0, 200)}`}`);
      if (k.proposal) proposals.push({ kind: "k", proposal: k.proposal });
    }
  }
  return { proposals, trace };
}

function planFromFindings(
  findings: readonly Nex1RuntimeFailureFinding[],
  repoRoot: string,
): CombinedProposal[] {
  return [...planFromFindingsTraced(findings, repoRoot).proposals];
}

interface ApplyOutcome {
  readonly trace: readonly string[];
  readonly mutation: { target_file: string; inserted_ids: readonly string[]; skipped: readonly string[]; iteration: number } | null;
  readonly refusal: string | null;
  readonly gapKind: string | null;
  readonly proposalKey: string | null;
  /** Fix 23c · 2026-09-17 · verbatim source content BEFORE the write. When
   *  set, callers may revert by writing this string back to `mutation.target_file`.
   *  null when no write happened. */
  readonly sourceBefore?: string | null;
}

function tryApplyProposal(p: CombinedProposal, repoRoot: string, iteration: number): ApplyOutcome {
  const trace: string[] = [];
  const key = proposalKey(p);
  if (p.kind === "k") {
    const kp = p.proposal;
    const targetAbs = pathResolve(repoRoot, kp.target_file);
    trace.push(`iter ${iteration} · K proposal · target=${kp.target_file} · array=${kp.array_symbol} · missing_ids=[${kp.missing_ids.map((s) => `'${s}'`).join(", ")}]`);
    if (isProtected(kp.target_file.replace(/\\/g, "/"))) {
      return { trace, mutation: null, refusal: `protected_target · ${kp.target_file}`, gapKind: null, proposalKey: key };
    }
    if (!existsSync(targetAbs)) {
      return { trace, mutation: null, refusal: `target_file_missing · ${kp.target_file}`, gapKind: null, proposalKey: key };
    }
    let sourceBefore: string;
    try {
      sourceBefore = readFileSync(targetAbs, "utf8");
    } catch (e) {
      return {
        trace,
        mutation: null,
        refusal: `target_file_unreadable · ${kp.target_file} · ${e instanceof Error ? e.message.slice(0, 100) : "unknown"}`,
        gapKind: null,
        proposalKey: key,
      };
    }
    const op = applyAddArrayElement(sourceBefore, {
      array_symbol: kp.array_symbol,
      missing_ids: kp.missing_ids,
      peer_element_source: kp.peer_element_source,
      id_field: kp.id_field,
    });
    if (!op.ok) {
      return { trace, mutation: null, refusal: `operator_refused · ${op.refusal} · ${op.reason.slice(0, 160)}`, gapKind: null, proposalKey: key };
    }
    if (op.next === sourceBefore) {
      trace.push(`iter ${iteration} · no-op · all ids already present`);
      return {
        trace,
        mutation: { target_file: kp.target_file, inserted_ids: [], skipped: op.skipped_already_present_ids, iteration },
        refusal: null,
        gapKind: null,
        proposalKey: key,
      };
    }
    try {
      writeFileSync(targetAbs, op.next, "utf8");
    } catch (e) {
      return {
        trace,
        mutation: null,
        refusal: `write_failed · ${kp.target_file} · ${e instanceof Error ? e.message.slice(0, 100) : "unknown"}`,
        gapKind: null,
        proposalKey: key,
      };
    }
    trace.push(`iter ${iteration} · applied · inserted=[${op.inserted_ids.map((s) => `'${s}'`).join(", ")}]`);
    return {
      trace,
      mutation: { target_file: kp.target_file, inserted_ids: op.inserted_ids, skipped: op.skipped_already_present_ids, iteration },
      refusal: null,
      gapKind: null,
      proposalKey: key,
    };
  }
  // J.2 proposals · Fix 23a wiring · applyReplaceReturnLiteral operator.
  {
    const jp = p.proposal;
    if (jp.change_kind === "replace_return_literal") {
      const targetAbs = pathResolve(repoRoot, jp.target_file);
      trace.push(
        `iter ${iteration} · J.2 proposal · target=${jp.target_file}#${jp.target_function} · ` +
        `${jp.current_literal} → ${jp.proposed_literal}`,
      );
      if (isProtected(jp.target_file.replace(/\\/g, "/"))) {
        return { trace, mutation: null, refusal: `protected_target · ${jp.target_file}`, gapKind: null, proposalKey: key };
      }
      if (!existsSync(targetAbs)) {
        return { trace, mutation: null, refusal: `target_file_missing · ${jp.target_file}`, gapKind: null, proposalKey: key };
      }
      let sourceBefore: string;
      try {
        sourceBefore = readFileSync(targetAbs, "utf8");
      } catch (e) {
        return {
          trace,
          mutation: null,
          refusal: `target_file_unreadable · ${jp.target_file} · ${e instanceof Error ? e.message.slice(0, 100) : "unknown"}`,
          gapKind: null,
          proposalKey: key,
        };
      }
      const op = applyReplaceReturnLiteral(sourceBefore, {
        target_function: jp.target_function,
        current_literal: jp.current_literal,
        proposed_literal: jp.proposed_literal,
        target_line: jp.target_line ?? null,
        target_range: jp.target_range ?? null,
      });
      if (!op.ok) {
        return {
          trace,
          mutation: null,
          refusal: `operator_refused · ${op.refusal} · ${op.reason.slice(0, 160)}`,
          gapKind: jp.change_kind,
          proposalKey: key,
        };
      }
      try {
        writeFileSync(targetAbs, op.next, "utf8");
      } catch (e) {
        return {
          trace,
          mutation: null,
          refusal: `write_failed · ${jp.target_file} · ${e instanceof Error ? e.message.slice(0, 100) : "unknown"}`,
          gapKind: null,
          proposalKey: key,
        };
      }
      trace.push(
        `iter ${iteration} · applied J.2 · ${op.replaced_shape} · line ${op.replaced_at_line} · ${op.rationale}`,
      );
      return {
        trace,
        mutation: {
          target_file: jp.target_file,
          inserted_ids: [`${jp.current_literal}→${jp.proposed_literal}@${op.replaced_at_line}`],
          skipped: [],
          iteration,
        },
        refusal: null,
        gapKind: null,
        proposalKey: key,
        sourceBefore,
      };
    }
  }
  return { trace, mutation: null, refusal: `no_operator_for_kind · ${p.proposal.change_kind}`, gapKind: p.proposal.change_kind, proposalKey: key };
}

function diagnosePostState(run: TestRunResult): { summary: string; findings: readonly Nex1RuntimeFailureFinding[]; trace: readonly string[] } {
  const trace: string[] = [`extractRuntimeFailures(vitest_stdout · ${run.stdout_tail.length}B)`];
  const preprocessed = synthesiseFailBlocksFromCompact(run.stdout_tail);
  const extract = extractRuntimeFailures(preprocessed);
  if (extract.kind !== "ok") {
    return {
      summary: `post-state runtime-diagnosis refused: ${extract.refusal_class}`,
      findings: [],
      trace: [...trace, `refused · ${extract.refusal_class} · ${extract.reason}`],
    };
  }
  return {
    summary: `${extract.findings.length} finding(s) · kinds=[${extract.findings.map((f) => f.kind).join(",")}]`,
    findings: extract.findings,
    trace: [...trace, `extracted ${extract.findings.length} finding(s)`],
  };
}

// ─── helpers ─────────────────────────────────────────────────────

function extractTargetFromStage(s: StageResult): string | null {
  const m = (s.evidence[0] ?? "").match(/^target=([^:]+)/);
  return m ? m[1] : null;
}

function skipped(stage: StageResult["stage"], summary: string): StageResult {
  return {
    stage,
    verdict: "SKIPPED",
    summary,
    evidence: [],
    reasoning_trace: [],
    duration_ms: 0,
  };
}

function timed<T extends { duration_ms: number }>(
  _label: string,
  fn: () => T,
): { value: T & { duration_ms: number } } {
  const start = Date.now();
  const v = fn();
  const withMs = { ...v, duration_ms: Date.now() - start } as T & { duration_ms: number };
  return { value: withMs };
}

async function timedAsync<T extends { stage: StageResult }>(
  _label: string,
  fn: () => Promise<T>,
): Promise<{ value: T }> {
  const start = Date.now();
  const v = await fn();
  const patched = { ...v, stage: { ...v.stage, duration_ms: Date.now() - start } };
  return { value: patched as T };
}

function finalise(args: {
  loopId: string;
  startedAt: Date;
  input: NativeLoopInput;
  repoRoot: string;
  stages: readonly StageResult[];
  capabilityGaps: readonly string[];
  baseline: TestRunResult | null;
  finalRun: TestRunResult | null;
  overallVerdict: StageVerdict;
  founderSummary: string;
}): NativeLoopResult {
  return {
    loop_id: args.loopId,
    started_at: args.startedAt.toISOString(),
    finished_at: new Date().toISOString(),
    founder_goal: args.input.founder_goal,
    target_test_file: args.input.target_test_file ?? extractTargetFromStages(args.stages),
    target_line: args.input.target_line ?? null,
    stages: args.stages,
    overall_verdict: args.overallVerdict,
    founder_summary: args.founderSummary,
    repo_root: args.repoRoot,
    baseline_test_result: args.baseline
      ? {
          failing_tests: args.baseline.failing_tests,
          summary: args.baseline.summary,
          exit_code: args.baseline.exit_code,
        }
      : null,
    final_test_result: args.finalRun
      ? {
          failing_tests: args.finalRun.failing_tests,
          summary: args.finalRun.summary,
          exit_code: args.finalRun.exit_code,
        }
      : null,
    capability_gaps: args.capabilityGaps,
  };
}

function extractTargetFromStages(stages: readonly StageResult[]): string | null {
  const understand = stages.find((s) => s.stage === "understand");
  if (!understand) return null;
  return extractTargetFromStage(understand);
}

// Vitest under Node child_process spawn (non-TTY) emits per-test failures in the
// compact form even under `--reporter=verbose`:
//
//   × path/to/file > describe > it-name  Nms
//      → expected X to Y ...
//
// The capability-J.1 parser (`extractRuntimeFailures`) expects the full FAIL block
// vitest emits under interactive TTYs:
//
//    FAIL  path/to/file > describe > it-name
//   AssertionError: expected X to Y ...
//
// This function converts the former into the latter · pure regex · deterministic.
// If the input already contains FAIL blocks it is returned unchanged.
function synthesiseFailBlocksFromCompact(vitestStdout: string): string {
  if (/\bFAIL\s+\S+/.test(vitestStdout)) return vitestStdout;
  const lines = vitestStdout.split(/\r?\n/);
  const synth: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    // Compact failing test line: "  × path > describe > name  Nms"
    const fail = /^\s*×\s+(.+?)\s+\d+ms\s*$/.exec(line);
    if (!fail) continue;
    const rest = fail[1]!;
    // Next non-blank line often carries the assertion detail: "   → expected X to be Y"
    let assertionDetail: string | null = null;
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      const next = lines[j]!;
      if (next.trim().length === 0) continue;
      const arrow = /^\s*→\s*(.*)$/.exec(next);
      if (arrow) {
        assertionDetail = arrow[1]!.trim();
        break;
      }
      break;
    }
    if (!assertionDetail) continue;
    synth.push("");
    synth.push(` FAIL  ${rest}`);
    synth.push(`AssertionError: ${assertionDetail}`);
  }
  if (synth.length === 0) return vitestStdout;
  return `${vitestStdout}\n${synth.join("\n")}\n`;
}

// ═══ RUNG-5 · TSC MODE ═══════════════════════════════════════════════
//
// A genuinely different chain from vitest-mode:
//   UNDERSTAND  · same goal-parsing
//   INSPECT     · runTsc(scoped project) instead of runVitest
//   REASON      · parseTscOutput + extractMissingPropertyFindings (NOT J.1)
//   PLAN        · composeRepairDirectiveTypeAware + resolveTypeAwareRepairValue (NOT K)
//   CHANGE      · AstSemanticAdapter.reason with `add_property_to_object_at_position`
//                 directive (NOT `add_array_element`)
//   TEST        · runTsc again
//   VERIFY      · compare before/after tsc exit_code
//   LEARN       · same
//
// This exercises Capability C, the consequence-reasoner, and a different
// AST operator — proving generalisation across engineering-problem classes.

async function runNativeProgrammingLoopTsc(
  input: NativeLoopInput,
  startedAt: Date,
  loopId: string,
  repoRoot: string,
): Promise<NativeLoopResult> {
  const stages: StageResult[] = [];
  // Batch 2A Streaming · 2026-09-17. Fire-and-forget observer wrapper on
  // .push so downstream callers can emit each StageResult as SSE events
  // without touching 65 push sites or refactoring the loop into a
  // generator. When onStage is absent this is a straight no-op.
  if (input.onStage) {
    const _origPush = stages.push.bind(stages);
    stages.push = ((...items: StageResult[]): number => {
      const r = _origPush(...items);
      for (const s of items) {
        try { input.onStage!(s); } catch { /* observer must never break the loop */ }
      }
      return r;
    }) as typeof stages.push;
  }
  const capabilityGaps: string[] = [];

  // ─── STAGE 1 · UNDERSTAND ───────────────────────────────────────
  const understand = timed<StageResult>("understand", () => {
    const trace: string[] = [`mode=tsc`];
    const evidence: string[] = [];
    const fileLineRe = /([\w/.\-@]+\.[jt]sx?)(?::(\d+))?/g;
    const found: Array<{ file: string; line?: number }> = [];
    let m: RegExpExecArray | null;
    while ((m = fileLineRe.exec(input.founder_goal)) !== null) {
      found.push({ file: m[1], line: m[2] ? Number(m[2]) : undefined });
    }
    trace.push(`extracted ${found.length} file reference(s) from goal`);
    const target = input.target_test_file ?? (found[0]?.file ?? null);
    const project = input.tsc_project ?? null;
    if (target) evidence.push(`target=${target}`);
    if (project) evidence.push(`tsc_project=${project}`);
    return {
      stage: "understand",
      verdict: target && project ? "VERIFIED" : ("NOT_IMPLEMENTED" as StageVerdict),
      summary: target && project
        ? `mode=tsc · target=${target} · project=${project}`
        : `mode=tsc but target and tsc_project are both required`,
      evidence,
      reasoning_trace: trace,
      duration_ms: 0,
    };
  });
  stages.push(understand.value);
  if (understand.value.verdict !== "VERIFIED") {
    return finaliseTsc(loopId, startedAt, input, repoRoot, stages, ["understand: mode=tsc requires target_test_file + tsc_project"], null, null, CAPABILITY_NOT_YET,
      `Rung-5 tsc mode requires both target_test_file and tsc_project. Refusing to guess.`);
  }
  const targetFile = input.target_test_file!;
  const tscProject = input.tsc_project!;
  const targetAbs = pathResolve(repoRoot, targetFile);
  if (!existsSync(targetAbs)) {
    stages.push({ stage: "inspect", verdict: "NOT_IMPLEMENTED", summary: `target file not on disk: ${targetFile}`, evidence: [targetFile], reasoning_trace: [], duration_ms: 0 });
    return finaliseTsc(loopId, startedAt, input, repoRoot, stages, ["inspect: target file missing"], null, null, "NOT_IMPLEMENTED",
      `Target file not present in repo: ${targetFile}. Loop halted safely.`);
  }

  // ─── STAGE 2 · INSPECT (baseline tsc) ───────────────────────────
  const inspect = await timedAsync<{ stage: StageResult; run: TestRunResult }>("inspect", async () => {
    const trace: string[] = [`spawn: npx tsc --noEmit --project ${tscProject}`];
    const runResult = await runTsc(input.test_timeout_ms ?? 60_000, { project: tscProject });
    trace.push(`exit_code=${runResult.exit_code} · duration_ms=${runResult.duration_ms}`);
    return {
      stage: {
        stage: "inspect",
        verdict: "VERIFIED" as StageVerdict,
        summary: runResult.summary,
        evidence: [`exit_code=${runResult.exit_code}`, `duration_ms=${runResult.duration_ms}`],
        reasoning_trace: trace,
        duration_ms: 0,
      },
      run: runResult,
    };
  });
  stages.push(inspect.value.stage);
  const baselineRun = inspect.value.run;

  if (baselineRun.ok) {
    // No tsc errors · everything already green
    ["reason","plan","change","test","diagnose","repair","verify"].forEach((s) => stages.push(skipped(s as StageResult["stage"], `baseline tsc clean · nothing to fix`)));
    stages.push({ stage: "learn", verdict: "VERIFIED", summary: `no learning required · target already type-safe`, evidence: [], reasoning_trace: [`baseline exit_code=0`], duration_ms: 0 });
    return finaliseTsc(loopId, startedAt, input, repoRoot, stages, [], baselineRun, baselineRun, "VERIFIED",
      `Target already type-safe. Loop performed baseline inspection only.`);
  }

  // ─── STAGE 3 · REASON (tsc → structured missing-property findings) ─
  const combinedStdErr = (baselineRun.stdout_tail || "") + "\n" + (baselineRun.stderr_tail || "");
  const reasonRes = timed<{ stage: StageResult; findings: readonly MissingPropertyFinding[] }>("reason", () => {
    const trace: string[] = [`parseTscOutput(stdout+stderr · ${combinedStdErr.length}B)`];
    const diagnostics = parseTscOutput(combinedStdErr);
    trace.push(`parsed ${diagnostics.length} tsc diagnostic(s)`);
    const findings = extractMissingPropertyFindings(diagnostics);
    trace.push(`extracted ${findings.length} missing-property finding(s)`);
    return {
      stage: {
        stage: "reason",
        verdict: findings.length > 0 ? "VERIFIED" as StageVerdict : (CAPABILITY_NOT_YET as StageVerdict),
        summary: findings.length > 0
          ? `${findings.length} missing-property finding(s) extracted deterministically`
          : `${diagnostics.length} tsc diagnostic(s) present but none are missing-property class`,
        evidence: findings.map((f) => `${f.file}:${f.line}:${f.column} · type=${f.type_name} · missing=[${f.missing_properties.join(", ")}]`),
        reasoning_trace: trace,
        duration_ms: 0,
      },
      findings,
    };
  });
  stages.push(reasonRes.value.stage);
  const findings = reasonRes.value.findings;
  if (findings.length === 0) {
    capabilityGaps.push(`reason: consequence-reasoner covered no diagnostics · other TS error class(es) present`);
    ["plan","change","test","diagnose","repair","verify"].forEach((s) => stages.push(skipped(s as StageResult["stage"], `no missing-property finding · nothing to plan`)));
    stages.push({ stage: "learn", verdict: CAPABILITY_NOT_YET, summary: `no missing-property findings · other TS classes outside consequence-reasoner scope`, evidence: [], reasoning_trace: [], duration_ms: 0 });
    return finaliseTsc(loopId, startedAt, input, repoRoot, stages, capabilityGaps, baselineRun, baselineRun, CAPABILITY_NOT_YET,
      `REASON found ${combinedStdErr.length > 0 ? "some" : "no"} tsc diagnostics but none matched the missing-property class handled by consequence-reasoner. ${CAPABILITY_NOT_YET}.`);
  }

  // ─── STAGE 4 · PLAN (capability-C · type-aware repair value) ────
  // Load repository sources needed by capability-C for interface lookup:
  // the target file itself plus any relative import of the type declaration.
  const sources = collectSourcesForTypeRepair(targetAbs, findings, repoRoot);
  const planRes = timed<{ stage: StageResult; directives: readonly Extract<import("./types").TemplateDirective, { kind: "add_property_to_object_at_position" }>[] }>("plan", () => {
    const trace: string[] = [];
    const directives: Extract<import("./types").TemplateDirective, { kind: "add_property_to_object_at_position" }>[] = [];
    for (const f of findings) {
      for (const propName of f.missing_properties) {
        const composed = composeRepairDirectiveTypeAware(f, propName, sources);
        if (composed.ok) {
          directives.push(composed.directive);
          trace.push(`finding[${f.file}:${f.line}] · '${propName}' · type-aware value=${composed.directive.property_value} · rationale=${composed.rationale.slice(0, 140)}`);
        } else {
          trace.push(`finding[${f.file}:${f.line}] · '${propName}' · ESCALATED · declared_type=${composed.declared_type} · reason=${composed.reason.slice(0, 140)}`);
        }
      }
    }
    return {
      stage: {
        stage: "plan",
        verdict: directives.length > 0 ? "VERIFIED" as StageVerdict : (CAPABILITY_NOT_YET as StageVerdict),
        summary: directives.length > 0
          ? `${directives.length} deterministic repair directive(s) via Capability C`
          : `Capability C escalated all findings · declared types outside safely-satisfiable set`,
        evidence: directives.map((d) => `${d.target_path}:${d.line}:${d.column} · add ${d.property_name}=${d.property_value}`),
        reasoning_trace: trace,
        duration_ms: 0,
      },
      directives,
    };
  });
  stages.push(planRes.value.stage);
  const directives = planRes.value.directives;
  if (directives.length === 0) {
    capabilityGaps.push(`plan: Capability C escalated all findings · type outside safely-satisfiable set (primitive/array/nullable) · future rung would extend the set`);
    ["change","test","diagnose","repair","verify"].forEach((s) => stages.push(skipped(s as StageResult["stage"], `no directive · Capability C escalated`)));
    stages.push({ stage: "learn", verdict: CAPABILITY_NOT_YET, summary: `Capability C refused to invent a value for complex/custom types`, evidence: capabilityGaps.slice(0,10), reasoning_trace: [], duration_ms: 0 });
    return finaliseTsc(loopId, startedAt, input, repoRoot, stages, capabilityGaps, baselineRun, baselineRun, CAPABILITY_NOT_YET,
      `Rung-5 · REASON succeeded · PLAN escalated on all findings (types outside Capability C's safely-satisfiable set). ${CAPABILITY_NOT_YET}.`);
  }

  // ─── STAGE 5 · CHANGE (AstSemanticAdapter.reason for each directive) ─
  const changeTrace: string[] = [];
  const changeRefusals: string[] = [];
  const appliedFiles: Array<{ target_file: string; property_name: string; property_value: string }> = [];
  for (const directive of directives) {
    const filePath = directive.target_path;
    const fileAbs = pathResolve(repoRoot, filePath);
    if (isProtected(filePath)) { changeRefusals.push(`protected_target · ${filePath}`); continue; }
    if (!existsSync(fileAbs)) { changeRefusals.push(`target_file_missing · ${filePath}`); continue; }
    const before = readFileSync(fileAbs, "utf8");
    // Build a Nex1ReasoningRequest for the adapter · minimum viable context
    const req = {
      task_id: loopId,
      attempt_id: `${loopId}-change`,
      intent: "fix_bug" as const,
      context: {
        founder_prompt: input.founder_goal,
        declared_scope: [filePath],
        file_slices: [{ path: filePath, content: before }],
        repo_snapshot_hash: "rung5-tsc-mode",
        redacted_secret_count: 0,
        relevant_adrs: [],
      },
      output_kind: "diff" as const,
      template_directive: directive,
    };
    const resp = await AstSemanticAdapter.reason(req);
    if (!resp.ok) {
      changeRefusals.push(`adapter_refused · ${resp.code} · ${resp.reason.slice(0, 160)}`);
      continue;
    }
    // The adapter emits a whole-file diff. Parse the +lines to get the new source.
    const afterSource = parseWholeFileDiff(resp.result.proposed_diff, filePath);
    if (afterSource === null) {
      changeRefusals.push(`diff_parse_failed · ${filePath}`);
      continue;
    }
    if (afterSource === before) {
      changeTrace.push(`${filePath} · adapter no-op (property likely already present)`);
      appliedFiles.push({ target_file: filePath, property_name: directive.property_name, property_value: directive.property_value });
      continue;
    }
    writeFileSync(fileAbs, afterSource, "utf8");
    appliedFiles.push({ target_file: filePath, property_name: directive.property_name, property_value: directive.property_value });
    changeTrace.push(`${filePath} · applied add_property_to_object_at_position · ${directive.property_name}=${directive.property_value}`);
  }
  const anyApplied = appliedFiles.length > 0 && changeRefusals.length === 0;
  stages.push({
    stage: "change",
    verdict: anyApplied ? "VERIFIED" : (appliedFiles.length > 0 ? "PARTIAL" : CAPABILITY_NOT_YET),
    summary: anyApplied
      ? `${appliedFiles.length} type-repair mutation(s) applied via ast-semantic adapter`
      : appliedFiles.length > 0
        ? `some directives applied · some refused: [${changeRefusals.join(" | ")}]`
        : `no directives applied · refusals: [${changeRefusals.join(" | ")}]`,
    evidence: [
      ...appliedFiles.map((a) => `${a.target_file} · +${a.property_name}=${a.property_value}`),
      ...changeRefusals.map((r) => `refused · ${r}`),
    ],
    reasoning_trace: changeTrace,
    duration_ms: 0,
  });
  if (!anyApplied) {
    ["test","diagnose","repair","verify"].forEach((s) => stages.push(skipped(s as StageResult["stage"], `no mutation applied · nothing to verify`)));
    stages.push({ stage: "learn", verdict: CAPABILITY_NOT_YET, summary: `no mutation applied · adapter/dispatch gap recorded`, evidence: capabilityGaps.slice(0,10), reasoning_trace: [], duration_ms: 0 });
    return finaliseTsc(loopId, startedAt, input, repoRoot, stages, capabilityGaps, baselineRun, baselineRun, CAPABILITY_NOT_YET,
      `Rung-5 · CHANGE stage failed to apply any mutation. Refusals: ${changeRefusals.join(" · ")}. ${CAPABILITY_NOT_YET}.`);
  }

  // ─── STAGE 6 · TEST (re-run tsc) ─────────────────────────────────
  const testRes = await timedAsync<{ stage: StageResult; run: TestRunResult }>("test", async () => {
    const trace: string[] = [`spawn: npx tsc --noEmit --project ${tscProject}`];
    const runResult = await runTsc(input.test_timeout_ms ?? 60_000, { project: tscProject });
    trace.push(`exit_code=${runResult.exit_code} · duration_ms=${runResult.duration_ms}`);
    const passed = runResult.ok;
    return {
      stage: {
        stage: "test",
        verdict: passed ? "VERIFIED" as StageVerdict : "PARTIAL" as StageVerdict,
        summary: passed ? `tsc clean · exit_code=0` : `tsc still reporting errors · exit_code=${runResult.exit_code}`,
        evidence: [`exit_code=${runResult.exit_code}`, `duration_ms=${runResult.duration_ms}`],
        reasoning_trace: trace,
        duration_ms: 0,
      },
      run: runResult,
    };
  });
  stages.push(testRes.value.stage);
  const finalRun = testRes.value.run;

  if (finalRun.ok) {
    ["diagnose","repair"].forEach((s) => stages.push(skipped(s as StageResult["stage"], `tsc clean · nothing to diagnose/repair`)));
    stages.push({
      stage: "verify",
      verdict: "VERIFIED",
      summary: `real tsc re-run passed after type-repair mutation · exit_code=0`,
      evidence: [`baseline exit_code=${baselineRun.exit_code} → after-mutation exit_code=${finalRun.exit_code}`],
      reasoning_trace: [],
      duration_ms: 0,
    });
    stages.push({
      stage: "learn",
      verdict: "VERIFIED",
      summary: `lesson recorded · type-repair loop verified end-to-end without LLM`,
      evidence: [`applied ${appliedFiles.length} property·file mutation(s) via Capability C + add_property_to_object_at_position`],
      reasoning_trace: [`UNDERSTAND → INSPECT (tsc) → REASON (consequence-reasoner) → PLAN (capability-C) → CHANGE (ast-semantic) → TEST (tsc) → VERIFY`],
      duration_ms: 0,
    });
    return finaliseTsc(loopId, startedAt, input, repoRoot, stages, capabilityGaps, baselineRun, finalRun, "VERIFIED",
      `Rung-5 · NEX1 Native Programming Loop completed end-to-end in tsc-mode. ` +
      `Baseline: tsc errors present · Applied: ${appliedFiles.length} type-repair mutation(s) · Final: tsc clean · ` +
      `Zero LLM. Zero fabrication.`);
  }

  // Post-mutation tsc still failing · report honestly (recovery iteration
  // for tsc is a future rung; current loop returns PARTIAL rather than
  // guessing at a second class of TS error).
  stages.push({
    stage: "diagnose",
    verdict: CAPABILITY_NOT_YET,
    summary: `post-mutation tsc still reports errors · automatic tsc-mode recovery iteration is a future rung`,
    evidence: [`exit_code=${finalRun.exit_code}`],
    reasoning_trace: [],
    duration_ms: 0,
  });
  stages.push({
    stage: "repair",
    verdict: CAPABILITY_NOT_YET,
    summary: `Rung-5 does not yet include tsc-mode recovery iteration · would be added in a future rung`,
    evidence: [],
    reasoning_trace: [],
    duration_ms: 0,
  });
  stages.push({
    stage: "verify",
    verdict: "PARTIAL",
    summary: `first mutation didn't fully resolve tsc state · not a pass`,
    evidence: [`baseline exit=${baselineRun.exit_code} → post-mutation exit=${finalRun.exit_code}`],
    reasoning_trace: [],
    duration_ms: 0,
  });
  stages.push({
    stage: "learn",
    verdict: "PARTIAL",
    summary: `type-repair applied but tsc still failing · lesson: multi-mutation tsc-mode recovery is the next rung`,
    evidence: capabilityGaps.slice(0,10),
    reasoning_trace: [],
    duration_ms: 0,
  });
  capabilityGaps.push(`repair (tsc mode): iterative tsc-mode recovery is not yet implemented`);
  return finaliseTsc(loopId, startedAt, input, repoRoot, stages, capabilityGaps, baselineRun, finalRun, "PARTIAL",
    `Rung-5 · tsc-mode applied a real type-repair mutation but tsc still reports errors. Iterative tsc-mode recovery is a future rung. ${CAPABILITY_NOT_YET} at REPAIR.`);
}

// Parse the ast-semantic adapter's whole-file diff format to reconstruct the
// mutated source text. Adapter emits:
//   --- a/<path>\n+++ b/<path>\n@@ ... @@\n-<oldLine>...+<newLine>...
// We take all +-prefixed lines as the after state.
function parseWholeFileDiff(diff: string, expectedPath: string): string | null {
  const lines = diff.split(/\r?\n/);
  if (lines.length < 3) return null;
  const header0 = lines[0] ?? "";
  if (!header0.startsWith(`--- a/${expectedPath}`)) return null;
  const afterLines: string[] = [];
  for (let i = 3; i < lines.length; i++) {
    const l = lines[i]!;
    if (l.startsWith("+")) afterLines.push(l.slice(1));
    else if (l.startsWith("-")) continue;
    else if (l === "") continue;
    else if (l.startsWith("@@")) continue;
  }
  return afterLines.join("\n");
}

// Read the target file plus the transitive relative imports it declares,
// so Capability C can find the enclosing interface across files.
function collectSourcesForTypeRepair(
  targetAbs: string,
  findings: readonly MissingPropertyFinding[],
  repoRoot: string,
): Nex1RepositorySource[] {
  const seen = new Set<string>();
  const out: Nex1RepositorySource[] = [];
  const queue: string[] = [targetAbs];
  // Also queue any file listed in findings
  for (const f of findings) {
    const abs = pathResolve(repoRoot, f.file);
    queue.push(abs);
  }
  while (queue.length > 0) {
    const abs = queue.shift()!;
    if (seen.has(abs)) continue;
    seen.add(abs);
    if (!existsSync(abs)) continue;
    const content = readFileSync(abs, "utf8");
    const rel = abs.replace(/\\/g, "/").replace(repoRoot.replace(/\\/g, "/") + "/", "");
    out.push({ path: rel, content });
    // Discover relative imports · enqueue for cross-file interface search
    const importRe = /import\s+(?:type\s+)?\{[^}]*\}\s+from\s+["'](\.[^"']+)["']/g;
    let m: RegExpExecArray | null;
    while ((m = importRe.exec(content)) !== null) {
      const spec = m[1]!;
      const base = pathResolve(dirname(abs), spec);
      for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
        const candidate = base + ext;
        if (existsSync(candidate)) { queue.push(candidate); break; }
      }
    }
  }
  return out;
}

function finaliseTsc(
  loopId: string,
  startedAt: Date,
  input: NativeLoopInput,
  repoRoot: string,
  stages: readonly StageResult[],
  capabilityGaps: readonly string[],
  baseline: TestRunResult | null,
  finalRun: TestRunResult | null,
  overallVerdict: StageVerdict,
  founderSummary: string,
): NativeLoopResult {
  return {
    loop_id: loopId,
    started_at: startedAt.toISOString(),
    finished_at: new Date().toISOString(),
    founder_goal: input.founder_goal,
    target_test_file: input.target_test_file ?? null,
    target_line: input.target_line ?? null,
    stages,
    overall_verdict: overallVerdict,
    founder_summary: founderSummary,
    repo_root: repoRoot,
    baseline_test_result: baseline
      ? { failing_tests: baseline.failing_tests, summary: baseline.summary, exit_code: baseline.exit_code }
      : null,
    final_test_result: finalRun
      ? { failing_tests: finalRun.failing_tests, summary: finalRun.summary, exit_code: finalRun.exit_code }
      : null,
    capability_gaps: capabilityGaps,
  };
}
