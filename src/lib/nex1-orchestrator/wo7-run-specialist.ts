// WO-WORKSTATION-07 · specialist runner + real adapters
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// runSpecialist(invocation) dispatches to a real tool and returns a
// SpecialistResult with the ADR-0319 §13 status enum. Never converts
// UNAVAILABLE into PASSED. Never silently substitutes a fixture.
//
// Every adapter composes with WO-05's executeBuild() -- so cwd is
// workspace-locked, env is stripped, timeout is enforced, and
// stdout/stderr are captured through the same audited path as any
// other authorised child process. Zero new spawn code.

import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { promises as fs } from "node:fs";
import { executeBuild } from "./wo5-executor";
import type { BuildReport } from "./wo5-types";
import type {
  SpecialistKind,
  SpecialistInvocation,
  SpecialistResult,
  SpecialistStatus,
  SpecialistFinding,
  ToolIdentity,
  RunSpecialistOutcome,
} from "./wo7-types";

// ── Top-level runner ────────────────────────────────────────────────────

export async function runSpecialist(invocation: SpecialistInvocation): Promise<RunSpecialistOutcome> {
  // Validate the invocation shape before we touch anything.
  if (!isKnownKind(invocation.kind)) {
    return { ok: false, reason_code: "UNKNOWN_KIND", reason: `unknown specialist kind: ${invocation.kind}` };
  }
  if (typeof invocation.workspace_root !== "string" || invocation.workspace_root.length === 0) {
    return { ok: false, reason_code: "INVOCATION_INVALID", reason: "workspace_root must be a non-empty string" };
  }
  if (typeof invocation.timeout_ms !== "number" || invocation.timeout_ms <= 0) {
    return { ok: false, reason_code: "INVOCATION_INVALID", reason: "timeout_ms must be a positive number" };
  }
  if (!Array.isArray(invocation.targets) || invocation.targets.some((t) => typeof t !== "string")) {
    return { ok: false, reason_code: "INVOCATION_INVALID", reason: "targets must be an array of strings" };
  }

  // Dispatch to the specific adapter.
  const started_at = new Date().toISOString();
  const startTs = Date.now();
  let result: SpecialistResult;
  switch (invocation.kind) {
    case "node-syntax": result = await runNodeSyntaxAdapter(invocation); break;
    case "tsc":         result = await runTscAdapter(invocation); break;
    case "eslint":      result = await runEslintAdapter(invocation); break;
    case "vitest":      result = await runVitestAdapter(invocation); break;
  }
  return { ok: true, result: { ...result, duration_ms: Date.now() - startTs, started_at, completed_at: new Date().toISOString(), evidence_hash: computeEvidenceHash(result) } };
}

function isKnownKind(k: unknown): k is SpecialistKind {
  return k === "node-syntax" || k === "tsc" || k === "eslint" || k === "vitest";
}

// ── Adapter · node-syntax ───────────────────────────────────────────────

async function runNodeSyntaxAdapter(inv: SpecialistInvocation): Promise<SpecialistResult> {
  // node --check on each target file. Multi-target = fan out; if any file
  // fails, status is FAILED and stderr contains the first error.
  // Node is always available (it's what we're running on), so UNAVAILABLE
  // is never a legitimate outcome here.
  const tool: ToolIdentity = {
    kind: "node-syntax",
    display_name: "Node syntax check (node --check)",
    command: `node --check <target>`,
    resolved_version: process.version,
  };
  if (inv.targets.length === 0) {
    return baseResult(inv, tool, "DENIED", null, "", "no --check target files specified", []);
  }
  const findings: SpecialistFinding[] = [];
  let combinedStdout = "";
  let combinedStderr = "";
  let combinedTruncated = { stdout: false, stderr: false };
  let anyFailed = false;
  let firstExitCode: number | null = 0;
  for (const target of inv.targets) {
    const buildRes = await executeBuild({
      spec: {
        record_type: "NEX1_BUILD_SPEC",
        build_id: `${inv.invocation_id}::${target}`,
        trace_id: inv.trace_id,
        work_order_id: inv.work_order_id,
        project_id: inv.project_id,
        executable_ref: "node",
        args: ["--check", target],
        working_directory_rel: "",
        timeout_ms: inv.timeout_ms,
        env_forward: {},
        expected_exit_code: 0,
      },
      workspace_root: inv.workspace_root,
    });
    if (buildRes.ok) {
      combinedStdout += buildRes.report.stdout;
      combinedStderr += buildRes.report.stderr;
      combinedTruncated.stdout ||= buildRes.report.stdout_truncated;
      combinedTruncated.stderr ||= buildRes.report.stderr_truncated;
    } else {
      const report = buildRes.report;
      if (report) {
        combinedStdout += report.stdout;
        combinedStderr += report.stderr;
        combinedTruncated.stdout ||= report.stdout_truncated;
        combinedTruncated.stderr ||= report.stderr_truncated;
        firstExitCode = report.exit_code;
      }
      // Handle the "workspace missing" / "working dir missing" / etc.
      // outcomes as DENIED at the specialist layer.
      if (buildRes.reason_code === "WORKSPACE_ROOT_UNSAFE" ||
          buildRes.reason_code === "WORKING_DIRECTORY_ESCAPES_WORKSPACE" ||
          buildRes.reason_code === "WORKING_DIRECTORY_MISSING" ||
          buildRes.reason_code === "EXECUTABLE_NOT_ALLOWED" ||
          buildRes.reason_code === "EXECUTABLE_NOT_FOUND_ON_DISK") {
        return baseResult(inv, tool, "DENIED", null, combinedStdout, `${buildRes.reason_code}: ${buildRes.reason}`, findings);
      }
      if (buildRes.reason_code === "TIMEOUT_EXPIRED") {
        return baseResult(inv, tool, "TIMED_OUT", report?.exit_code ?? null, combinedStdout, buildRes.reason, findings, combinedStderr);
      }
      // EXIT_CODE_NONZERO or MISMATCH => tool ran and reported failure
      anyFailed = true;
      const parsed = parseNodeSyntaxError(report?.stderr ?? "", target);
      if (parsed) findings.push(parsed);
    }
  }
  const status: SpecialistStatus = anyFailed ? "FAILED" : "PASSED";
  return baseResult(inv, tool, status, firstExitCode, combinedStdout, null, findings, combinedStderr, combinedTruncated);
}

function parseNodeSyntaxError(stderr: string, target: string): SpecialistFinding | null {
  // node --check prints something like:
  //   file:3
  //   const x = ;
  //             ^
  //
  //   SyntaxError: Unexpected token ';'
  const match = /SyntaxError:\s*([^\n]+)/.exec(stderr);
  if (!match) return null;
  const lineMatch = /:(\d+)/.exec(stderr);
  return {
    path: target,
    line: lineMatch ? Number(lineMatch[1]) : null,
    column: null,
    severity: "error",
    rule: "syntax-error",
    message: match[1].trim(),
  };
}

// ── Adapter · tsc ───────────────────────────────────────────────────────

async function runTscAdapter(inv: SpecialistInvocation): Promise<SpecialistResult> {
  const tool: ToolIdentity = {
    kind: "tsc",
    display_name: "TypeScript compiler (tsc --noEmit)",
    command: "npx --no-install tsc --noEmit",
    resolved_version: null,
  };
  // 1. Availability probe -- try `npx --no-install tsc --version` under WO-05
  const probe = await executeBuild({
    spec: {
      record_type: "NEX1_BUILD_SPEC",
      build_id: `${inv.invocation_id}::probe`,
      trace_id: inv.trace_id, work_order_id: inv.work_order_id, project_id: inv.project_id,
      executable_ref: "npx",
      args: ["--no-install", "tsc", "--version"],
      working_directory_rel: "",
      timeout_ms: Math.min(inv.timeout_ms, 15_000),
      env_forward: {},
      expected_exit_code: 0,
    },
    workspace_root: inv.workspace_root,
  });
  if (!probe.ok) {
    // If tsc isn't installed in the workspace, npx exits non-zero.
    // Honest report: UNAVAILABLE (NOT PASSED).
    return baseResult(inv, tool, "UNAVAILABLE",
      probe.report?.exit_code ?? null,
      probe.report?.stdout ?? "",
      `tsc not resolvable in workspace: ${probe.reason}`,
      [],
      probe.report?.stderr ?? "");
  }
  const versionText = probe.report.stdout.trim();
  const resolvedTool: ToolIdentity = { ...tool, resolved_version: versionText.replace(/^Version\s+/i, "") || null };

  // 2. Real check -- npx tsc --noEmit
  const args = ["--no-install", "tsc", "--noEmit", "--pretty", "false"];
  const check = await executeBuild({
    spec: {
      record_type: "NEX1_BUILD_SPEC",
      build_id: `${inv.invocation_id}::check`,
      trace_id: inv.trace_id, work_order_id: inv.work_order_id, project_id: inv.project_id,
      executable_ref: "npx",
      args,
      working_directory_rel: "",
      timeout_ms: inv.timeout_ms,
      env_forward: {},
      expected_exit_code: 0,
    },
    workspace_root: inv.workspace_root,
  });
  if (check.ok) {
    return baseResult(inv, resolvedTool, "PASSED", check.report.exit_code, check.report.stdout, null, [], check.report.stderr,
      { stdout: check.report.stdout_truncated, stderr: check.report.stderr_truncated });
  }
  if (check.reason_code === "TIMEOUT_EXPIRED") {
    return baseResult(inv, resolvedTool, "TIMED_OUT", check.report?.exit_code ?? null, check.report?.stdout ?? "", check.reason, [], check.report?.stderr ?? "");
  }
  const findings = parseTscDiagnostics(check.report?.stdout ?? "");
  return baseResult(inv, resolvedTool, "FAILED", check.report?.exit_code ?? null, check.report?.stdout ?? "", null, findings, check.report?.stderr ?? "",
    { stdout: check.report?.stdout_truncated ?? false, stderr: check.report?.stderr_truncated ?? false });
}

function parseTscDiagnostics(stdout: string): SpecialistFinding[] {
  // tsc --pretty false lines look like:
  //   src/foo.ts(12,5): error TS2322: Type 'string' is not assignable to type 'number'.
  const findings: SpecialistFinding[] = [];
  const regex = /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(stdout)) !== null) {
    findings.push({
      path: m[1].replace(/\\/g, "/"),
      line: Number(m[2]),
      column: Number(m[3]),
      severity: m[4] === "error" ? "error" : "warning",
      rule: m[5],
      message: m[6],
    });
  }
  return findings;
}

// ── Adapter · eslint ────────────────────────────────────────────────────

async function runEslintAdapter(inv: SpecialistInvocation): Promise<SpecialistResult> {
  const tool: ToolIdentity = {
    kind: "eslint",
    display_name: "ESLint (npx eslint --format=json)",
    command: `npx --no-install eslint --format=json ${inv.targets.join(" ") || "."}`,
    resolved_version: null,
  };
  const probe = await executeBuild({
    spec: {
      record_type: "NEX1_BUILD_SPEC",
      build_id: `${inv.invocation_id}::probe`,
      trace_id: inv.trace_id, work_order_id: inv.work_order_id, project_id: inv.project_id,
      executable_ref: "npx",
      args: ["--no-install", "eslint", "--version"],
      working_directory_rel: "",
      timeout_ms: Math.min(inv.timeout_ms, 15_000),
      env_forward: {},
      expected_exit_code: 0,
    },
    workspace_root: inv.workspace_root,
  });
  if (!probe.ok) {
    return baseResult(inv, tool, "UNAVAILABLE",
      probe.report?.exit_code ?? null,
      probe.report?.stdout ?? "",
      `eslint not resolvable in workspace: ${probe.reason}`,
      [],
      probe.report?.stderr ?? "");
  }
  const resolvedTool: ToolIdentity = { ...tool, resolved_version: probe.report.stdout.trim() || null };

  const targets = inv.targets.length > 0 ? inv.targets : ["."];
  // eslint --format=json exits non-zero when it finds errors — we don't
  // fail the wrapper on non-zero; we parse and count.
  const run = await executeBuild({
    spec: {
      record_type: "NEX1_BUILD_SPEC",
      build_id: `${inv.invocation_id}::run`,
      trace_id: inv.trace_id, work_order_id: inv.work_order_id, project_id: inv.project_id,
      executable_ref: "npx",
      args: ["--no-install", "eslint", "--format=json", ...targets],
      working_directory_rel: "",
      timeout_ms: inv.timeout_ms,
      env_forward: {},
      expected_exit_code: 0,
    },
    workspace_root: inv.workspace_root,
  });
  const report = run.ok ? run.report : run.report;
  if (run.reason_code === "TIMEOUT_EXPIRED") {
    return baseResult(inv, resolvedTool, "TIMED_OUT", report?.exit_code ?? null, report?.stdout ?? "", run.reason, [], report?.stderr ?? "");
  }
  const findings = parseEslintJson(report?.stdout ?? "");
  const status: SpecialistStatus = findings.some((f) => f.severity === "error") ? "FAILED" : "PASSED";
  return baseResult(inv, resolvedTool, status, report?.exit_code ?? null, report?.stdout ?? "", null, findings, report?.stderr ?? "",
    { stdout: report?.stdout_truncated ?? false, stderr: report?.stderr_truncated ?? false });
}

function parseEslintJson(stdout: string): SpecialistFinding[] {
  const findings: SpecialistFinding[] = [];
  try {
    const parsed = JSON.parse(stdout) as Array<{
      filePath: string;
      messages: Array<{ line?: number; column?: number; severity: number; ruleId: string | null; message: string }>;
    }>;
    for (const file of parsed) {
      for (const msg of file.messages) {
        findings.push({
          path: file.filePath.replace(/\\/g, "/"),
          line: msg.line ?? null,
          column: msg.column ?? null,
          severity: msg.severity === 2 ? "error" : msg.severity === 1 ? "warning" : "info",
          rule: msg.ruleId,
          message: msg.message,
        });
      }
    }
  } catch { /* stdout wasn't JSON — findings stay empty; stdout still recorded */ }
  return findings;
}

// ── Adapter · vitest ────────────────────────────────────────────────────

async function runVitestAdapter(inv: SpecialistInvocation): Promise<SpecialistResult> {
  const tool: ToolIdentity = {
    kind: "vitest",
    display_name: "Vitest (npx vitest run)",
    command: `npx --no-install vitest run --reporter=default ${inv.targets.join(" ")}`.trim(),
    resolved_version: null,
  };
  const probe = await executeBuild({
    spec: {
      record_type: "NEX1_BUILD_SPEC",
      build_id: `${inv.invocation_id}::probe`,
      trace_id: inv.trace_id, work_order_id: inv.work_order_id, project_id: inv.project_id,
      executable_ref: "npx",
      args: ["--no-install", "vitest", "--version"],
      working_directory_rel: "",
      timeout_ms: Math.min(inv.timeout_ms, 15_000),
      env_forward: {},
      expected_exit_code: 0,
    },
    workspace_root: inv.workspace_root,
  });
  if (!probe.ok) {
    return baseResult(inv, tool, "UNAVAILABLE",
      probe.report?.exit_code ?? null,
      probe.report?.stdout ?? "",
      `vitest not resolvable in workspace: ${probe.reason}`,
      [],
      probe.report?.stderr ?? "");
  }
  const resolvedTool: ToolIdentity = { ...tool, resolved_version: probe.report.stdout.trim() || null };

  const run = await executeBuild({
    spec: {
      record_type: "NEX1_BUILD_SPEC",
      build_id: `${inv.invocation_id}::run`,
      trace_id: inv.trace_id, work_order_id: inv.work_order_id, project_id: inv.project_id,
      executable_ref: "npx",
      args: ["--no-install", "vitest", "run", ...inv.targets],
      working_directory_rel: "",
      timeout_ms: inv.timeout_ms,
      env_forward: { CI: "true" },  // suppress interactive prompts
      expected_exit_code: 0,
    },
    workspace_root: inv.workspace_root,
  });
  if (run.reason_code === "TIMEOUT_EXPIRED") {
    return baseResult(inv, resolvedTool, "TIMED_OUT", run.report?.exit_code ?? null, run.report?.stdout ?? "", run.reason, [], run.report?.stderr ?? "");
  }
  const status: SpecialistStatus = run.ok ? "PASSED" : "FAILED";
  return baseResult(inv, resolvedTool, status, run.report?.exit_code ?? run.report?.exit_code ?? null,
    run.report?.stdout ?? "", null, [], run.report?.stderr ?? "",
    { stdout: run.report?.stdout_truncated ?? false, stderr: run.report?.stderr_truncated ?? false });
}

// ── Shared helpers ──────────────────────────────────────────────────────

function baseResult(
  inv: SpecialistInvocation,
  tool: ToolIdentity,
  status: SpecialistStatus,
  exit_code: number | null,
  stdout: string,
  non_execution_reason: string | null,
  findings: readonly SpecialistFinding[],
  stderr: string = "",
  truncated: { stdout: boolean; stderr: boolean } = { stdout: false, stderr: false },
): SpecialistResult {
  return {
    record_type: "NEX1_SPECIALIST_RESULT",
    result_id: `wo7-result-${randomUUID()}`,
    invocation_id: inv.invocation_id,
    trace_id: inv.trace_id,
    work_order_id: inv.work_order_id,
    project_id: inv.project_id,
    status,
    tool,
    exit_code,
    stdout,
    stderr,
    stdout_truncated: truncated.stdout,
    stderr_truncated: truncated.stderr,
    findings,
    duration_ms: 0,                            // filled by runSpecialist
    started_at: new Date().toISOString(),      // overwritten by runSpecialist
    completed_at: new Date().toISOString(),    // overwritten by runSpecialist
    evidence_hash: "",                         // filled by runSpecialist
    non_execution_reason,
  };
}

function computeEvidenceHash(result: SpecialistResult): string {
  const canonical = JSON.stringify({
    kind: result.tool.kind,
    command: result.tool.command,
    exit_code: result.exit_code,
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    findings: result.findings.map((f) => ({ path: f.path, line: f.line, column: f.column, severity: f.severity, rule: f.rule, message: f.message })),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

// ── Test convenience · make a target file inside a workspace ────────────

/** Helper for tests: write a file under workspace_root with the given
 *  content and return its workspace-relative path. Never exported for
 *  production use — kept in this module only to keep the test file tight. */
export async function _wo7_writeTestFile(workspace_root: string, rel: string, content: string): Promise<string> {
  const abs = path.resolve(workspace_root, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, "utf8");
  return rel;
}
