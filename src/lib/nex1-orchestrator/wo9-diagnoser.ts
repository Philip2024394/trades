// WO-WORKSTATION-09 · deterministic failure diagnoser
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// Pure function -- reads a WO-08 EngineeringHistoryEntry stream and
// classifies every failure. No I/O. No LLM. Same input, same output.
//
// Signal extraction: a specialist FAILED result carries free-text
// findings; the diagnoser pattern-matches each finding into a
// structured SpecialistSignal so the corrector can dispatch on
// signal.kind rather than parse strings again.

import type { EngineeringHistoryEntry } from "./wo8-types";
import type {
  CycleDiagnosis,
  FailureDiagnosis,
  SpecialistSignal,
} from "./wo9-types";
import type { SpecialistFinding } from "./wo7-types";

// ── Public entry point ─────────────────────────────────────────────────

export function diagnoseHistory(input: {
  readonly trace_id: string;
  readonly history: readonly EngineeringHistoryEntry[];
}): CycleDiagnosis {
  const failures: FailureDiagnosis[] = [];
  let anyTransient = false;

  for (const entry of input.history) {
    if (entry.kind === "build") {
      const r = entry.report;
      if (r.exit_code === null || r.exit_code !== 0) {
        const isTransient = detectTransientBuild(r.stderr, r.signal);
        anyTransient = anyTransient || isTransient;
        failures.push({
          kind: "build_failed",
          report_id: r.report_id,
          build_id: r.build_id,
          exit_code: r.exit_code,
          signal: r.signal,
          is_transient: isTransient,
          stderr_excerpt: excerpt(r.stderr, 500),
        });
      }
    } else if (entry.kind === "runtime") {
      const r = entry.report;
      // Health is null if the process died before the check; success
      // is health.succeeded_at !== null AND response_status === 200
      const succeeded =
        r.health !== null &&
        r.health.succeeded_at !== null &&
        r.health.response_status !== null &&
        r.health.response_status >= 200 &&
        r.health.response_status < 300;
      if (!succeeded) {
        const failure_class = classifyRuntimeFailure(r);
        const isTransient = failure_class === "HEALTH_CHECK_TIMEOUT";
        anyTransient = anyTransient || isTransient;
        failures.push({
          kind: "runtime_failed",
          report_id: r.report_id,
          run_id: r.run_id,
          failure_class,
          is_transient: isTransient,
          stderr_excerpt: excerpt(r.stderr, 500),
        });
      }
    } else if (entry.kind === "specialist") {
      const r = entry.result;
      if (r.status === "FAILED") {
        failures.push({
          kind: "specialist_failed",
          result_id: r.result_id,
          tool: r.tool.kind,
          findings: r.findings,
          signals: extractSignals(r.findings),
        });
      } else if (r.status === "UNAVAILABLE") {
        // UNAVAILABLE is a distinct diagnosis -- corrector treats it
        // differently from FAILED (usually escalates because it means
        // the tool isn't installed, which requires setup, not a code fix).
        failures.push({
          kind: "specialist_unavailable",
          result_id: r.result_id,
          tool: r.tool.kind,
          non_execution_reason: r.non_execution_reason ?? "unknown",
        });
      } else if (r.status === "TIMED_OUT" || r.status === "DENIED") {
        // These we count as transient specialist failures. Treated like build.
        anyTransient = anyTransient || (r.status === "TIMED_OUT");
        failures.push({
          kind: "specialist_failed",
          result_id: r.result_id,
          tool: r.tool.kind,
          findings: r.findings,
          signals: [{ kind: "unrecognised", finding_message: `specialist ${r.status}: ${r.non_execution_reason ?? "(no detail)"}` }],
        });
      }
    } else if (entry.kind === "execution") {
      // Execution report failures show up as the ExecutionReport itself
      // being present in history. WO-04 currently only persists on
      // success (partial writes get rolled back). But if the caller
      // decides to record a failed execution, we surface it here.
      const observer = entry.report.observer;
      if (observer.verdict_kind !== "MATCH") {
        failures.push({
          kind: "execution_failed",
          report_id: entry.report.report_id,
          detail: `observer verdict ${observer.verdict_kind} with ${observer.findings.length} finding(s)`,
        });
      }
    }
  }

  return {
    record_type: "NEX1_CYCLE_DIAGNOSIS",
    trace_id: input.trace_id,
    has_failures: failures.length > 0,
    failures,
    any_transient: anyTransient,
    diagnosed_at: new Date().toISOString(),
  };
}

// ── Signal extraction from specialist findings ─────────────────────────

function extractSignals(findings: readonly SpecialistFinding[]): SpecialistSignal[] {
  const signals: SpecialistSignal[] = [];
  for (const f of findings) {
    // Message-pattern matches take precedence over rule-field matches.
    // The real specialists (WO-07 parseNodeSyntaxError) tag every node --check
    // error as rule="syntax-error", including "ENOENT: file not found", so
    // the rule field is not sufficient to distinguish. Content wins.

    // 1. Missing target file — Node --check "ENOENT" / "no such file" pattern
    const enoent = /ENOENT.*['"]([^'"]+)['"]|no such file or directory.*['"]([^'"]+)['"]/i.exec(f.message);
    if (enoent) {
      signals.push({ kind: "missing_target_file", path: enoent[1] ?? enoent[2] ?? f.path ?? "(unknown)", detail: f.message });
      continue;
    }
    // 2. TypeScript "Cannot find module"
    if (/^TS2307$/.test(f.rule ?? "") || /Cannot find module ['"]([^'"]+)['"]/.test(f.message)) {
      const m = /Cannot find module ['"]([^'"]+)['"]/.exec(f.message);
      signals.push({ kind: "unknown_module", module_name: m ? m[1] : "(unknown)", path: f.path, line: f.line });
      continue;
    }
    // 3. Syntax error (Node --check output)
    if (f.rule === "syntax-error" || /^SyntaxError/i.test(f.message)) {
      signals.push({ kind: "syntax_error", path: f.path, line: f.line, message: f.message });
      continue;
    }
    // 4. ESLint rule violation (rule id looks like eslint-plugin/rule or a bare rule name)
    if (f.rule && /^[a-z0-9-]+(?:\/[a-z0-9-]+)?$/i.test(f.rule) && f.rule !== "syntax-error") {
      signals.push({ kind: "lint_violation", rule: f.rule, path: f.path, line: f.line });
      continue;
    }
    // 5. Vitest test failure
    if (/test.*fail|expect.*to (?:be|equal|match)|AssertionError/i.test(f.message)) {
      signals.push({ kind: "test_failure", test_name: f.path ?? "(unknown)", detail: f.message });
      continue;
    }
    // 6. Fallback
    signals.push({ kind: "unrecognised", finding_message: f.message });
  }
  return signals;
}

// ── Transient-failure heuristics ───────────────────────────────────────

/** A build is "transient" when the failure looks like an environmental
 *  hiccup rather than a real defect. Only very specific patterns qualify. */
function detectTransientBuild(stderr: string, signal: string | null): boolean {
  if (signal === "SIGKILL") return true;                            // WO-05 timeout kill
  if (/ETIMEDOUT|ECONNRESET|EAI_AGAIN/.test(stderr)) return true;    // network flakes during npm install
  if (/spawn ENOENT/.test(stderr)) return false;                    // executable missing is NOT transient
  return false;
}

function classifyRuntimeFailure(r: import("./wo6-types").RuntimeReport):
  | "PROCESS_EXITED_EARLY"
  | "HEALTH_CHECK_TIMEOUT"
  | "HEALTH_UNEXPECTED_STATUS"
  | "HEALTH_UNEXPECTED_BODY" {
  if (!r.health) return "PROCESS_EXITED_EARLY";
  if (r.health.succeeded_at === null) {
    // Never got a response -- either child died or we ran out of poll time
    if (r.child_pid && r.termination?.exit_code_after_termination !== null) {
      return "PROCESS_EXITED_EARLY";
    }
    return "HEALTH_CHECK_TIMEOUT";
  }
  // Got a response but it wasn't 2xx
  if (r.health.response_status === null || r.health.response_status < 200 || r.health.response_status >= 300) {
    return "HEALTH_UNEXPECTED_STATUS";
  }
  return "HEALTH_UNEXPECTED_BODY";
}

function excerpt(s: string, cap: number): string {
  if (s.length <= cap) return s;
  return s.slice(0, cap) + "\n…[truncated]";
}
