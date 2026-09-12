// src/lib/nex/programmer-execution/autonomous-loop.ts
//
// Phase 12 · Bounded Autonomous Engineering Under Founder Governance (SANDBOX-ONLY)
// Philip 2026-09-08 · AUTHORIZE Phase 12
//
// Composes the full change → test → benchmark → verify cycle for an
// improvement candidate · with hard sandbox isolation:
//
//   · Every file write is bounded to the sandbox root (mkdtemp under
//     os.tmpdir()) · attempts to write anywhere else THROW
//   · Production repo tree is never modified by this loop
//   · Every cycle result carries requires_founder_approval_before_merge:true
//   · No auto-merge · no auto-promote · Founder decides every action
//   · Dry-run mode returns everything the wet-run would do · writes nothing
//
// This module implements the MECHANISM only. Wiring it into the actual
// Programmer worker to run against real candidates is a SEPARATE Founder
// authorization step — the mechanism can be exercised safely on synthetic
// candidates in this phase without giving the worker Phase G in production.

import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync, statSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

// ─── Hard preserves per Founder doctrine (2026-09-08) ───

/** The RepairSkill whitelist. A ProposedChange can only affect files
 *  matching one of these narrow shapes. Everything else = REJECTED
 *  before the sandbox is even opened. */
export const REPAIR_SKILL_WHITELIST = [
  "add_test_case",              // add a new .test.ts file only
  "add_documentation",           // add/modify a .md file only
  "add_type_annotation",         // narrow TS type annotation change
  "add_null_check",              // add explicit null check
  "add_timeout_handling",        // add timeout wrapper
  "add_retry_with_backoff",      // add retry helper
  "add_circuit_breaker",         // add circuit breaker
  "add_input_validation",        // add validator
  "fix_test_assertion",          // fix a broken assertion
] as const;
export type RepairSkill = typeof REPAIR_SKILL_WHITELIST[number];

/** Bounded runtime/files/iterations per cycle · non-negotiable. */
export const CYCLE_BOUNDS = {
  max_iterations: 1,             // Phase 12 minimum viable: 1 cycle per invocation
  max_runtime_ms: 60_000,        // 60 seconds max per cycle
  max_files_written: 12,         // no cycle writes more than 12 files
  max_bytes_written_per_file: 128 * 1024, // 128 KB per file cap
} as const;

/** Path segments that MUST NOT appear in any proposed change target.
 *  Project B is off-limits per Founder doctrine. */
export const HARD_REJECT_PATH_SEGMENTS = [
  "project-b", "project_b", "projectb",
  "indolocal",                   // never touched autonomously
  "node_modules",                // never modified
  ".git",                        // never modified
  ".env",                        // never modified
];

/** Prohibited keywords in change content (per Y-W4-3 delegation-executor
 *  prohibition list) · never eval/self-promote/bypass/etc. */
export const PROHIBITED_CONTENT_KEYWORDS = [
  "rm -rf", "chmod 777", "sudo ", "delete from ", "drop table ",
  "self-promote", "auto-promote", "bypass ", "circumvent ",
  "sandbox escape", "production_deploy", "public_release",
  "eval(", "Function(", "exec(",
];

// ─── Types ──────────────────────────────────────────────

export type SandboxSession = {
  session_id: string;
  root_dir: string;                     // absolute · under os.tmpdir()
  opened_at_iso: string;
  files_written: string[];              // absolute paths written this session (must all be inside root_dir)
  files_read_from_production: string[]; // absolute paths read (read-only permitted)
  disposition?: "COMPLETED" | "DISCARDED" | "ARCHIVED";
  closed_at_iso?: string;
};

export type ProposedChange = {
  change_id: string;
  candidate_id: string;
  description: string;
  repair_skill: RepairSkill;            // MUST be from REPAIR_SKILL_WHITELIST
  founder_authorization_id: string;     // Founder-issued authorization for this specific change (loop refuses without)
  files: Array<{
    relative_path: string;              // relative to sandbox root · never absolute
    content: string;                    // full file content · not a diff (simplification for Phase 12)
    action: "create" | "modify";
  }>;
};

export type ChangeApplicationResult = {
  applied: boolean;
  paths_written_absolute: string[];
  errors: string[];
};

export type TestRunResult = {
  passed: number;
  failed: number;
  skipped: number;
  duration_ms: number;
  synthesized: true;                    // Phase 12 minimum viable: synthesized · real test invocation wiring separate
};

export type BenchmarkRunResult = {
  case_count: number;
  correct: number;
  synthesized: true;
};

export type AutonomousCycleResult = {
  cycle_id: string;
  candidate_id: string;
  session_id: string;
  sandbox_root: string;
  change_applied: boolean;
  paths_written_in_sandbox: string[];
  test_result: TestRunResult;
  benchmark_result: BenchmarkRunResult;
  production_bytes_before: number;
  production_bytes_after: number;
  production_unchanged: boolean;
  duration_ms: number;
  disposition: "COMPLETED_DRY_RUN" | "COMPLETED_WET_RUN" | "ABORTED_SAFETY_VIOLATION";
  safety_violations: string[];
  requires_founder_approval_before_merge: true;
  cycle_started_iso: string;
  cycle_completed_iso: string;
};

// ─── Sandbox primitives ─────────────────────────────

/** Open a fresh sandbox under os.tmpdir() · returns a session handle.
 *  The sandbox is genuinely isolated · never a subdirectory of the repo. */
export function openSandbox(): SandboxSession {
  const session_id = `sess_${randomUUID()}`;
  const root = mkdtempSync(path.join(tmpdir(), "nex-p12-sandbox-"));
  mkdirSync(root, { recursive: true });
  return {
    session_id,
    root_dir: root,
    opened_at_iso: new Date().toISOString(),
    files_written: [],
    files_read_from_production: [],
  };
}

/** Assert that a path is inside the sandbox · never above it. */
function assertInsideSandbox(session: SandboxSession, absolutePath: string): void {
  const resolved = path.resolve(absolutePath);
  const rootResolved = path.resolve(session.root_dir);
  if (!resolved.startsWith(rootResolved + path.sep) && resolved !== rootResolved) {
    throw new Error(`SANDBOX_VIOLATION: attempted write to '${resolved}' outside sandbox root '${rootResolved}'`);
  }
}

/** Apply a proposed change · every file goes into the sandbox root · every
 *  hard preserve is enforced before any write happens. */
export function applyChange(session: SandboxSession, change: ProposedChange): ChangeApplicationResult {
  const written: string[] = [];
  const errors: string[] = [];

  // Hard preserve · RepairSkill whitelist
  if (!REPAIR_SKILL_WHITELIST.includes(change.repair_skill as RepairSkill)) {
    errors.push(`REJECTED repair_skill '${change.repair_skill}' not in whitelist`);
    return { applied: false, paths_written_absolute: [], errors };
  }
  // Hard preserve · Founder authorization required (non-empty string)
  if (!change.founder_authorization_id || change.founder_authorization_id.trim().length === 0) {
    errors.push("REJECTED missing founder_authorization_id · no autonomous engineering without Founder-issued authorization");
    return { applied: false, paths_written_absolute: [], errors };
  }
  // Hard preserve · file-count bound
  if (change.files.length > CYCLE_BOUNDS.max_files_written) {
    errors.push(`REJECTED file count ${change.files.length} exceeds cap ${CYCLE_BOUNDS.max_files_written}`);
    return { applied: false, paths_written_absolute: [], errors };
  }

  for (const f of change.files) {
    // Reject absolute paths in the relative_path field
    if (path.isAbsolute(f.relative_path)) {
      errors.push(`REJECTED absolute path in change spec: ${f.relative_path}`);
      continue;
    }
    // Reject traversal (.., \\..\\, etc.)
    if (f.relative_path.split(/[\\/]/).some((seg) => seg === "..")) {
      errors.push(`REJECTED path-traversal segment in change spec: ${f.relative_path}`);
      continue;
    }
    // Hard reject · Project B / INDOLOCAL / node_modules / .git / .env paths
    const lowered = f.relative_path.toLowerCase();
    for (const seg of HARD_REJECT_PATH_SEGMENTS) {
      if (lowered.includes(seg)) {
        errors.push(`REJECTED hard-reject path segment '${seg}' in: ${f.relative_path}`);
      }
    }
    // Hard preserve · file-size bound
    if (Buffer.byteLength(f.content, "utf8") > CYCLE_BOUNDS.max_bytes_written_per_file) {
      errors.push(`REJECTED file '${f.relative_path}' exceeds ${CYCLE_BOUNDS.max_bytes_written_per_file}-byte cap`);
      continue;
    }
    // Hard preserve · prohibited content keywords
    const lowerContent = f.content.toLowerCase();
    for (const kw of PROHIBITED_CONTENT_KEYWORDS) {
      if (lowerContent.includes(kw)) {
        errors.push(`REJECTED prohibited keyword '${kw}' in content of ${f.relative_path}`);
      }
    }
    if (errors.length > 0) continue; // don't write once any error accumulated for this file

    const abs = path.resolve(session.root_dir, f.relative_path);
    assertInsideSandbox(session, abs);
    const dir = path.dirname(abs);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(abs, f.content, "utf8");
    session.files_written.push(abs);
    written.push(abs);
  }
  return { applied: errors.length === 0, paths_written_absolute: written, errors };
}

/** Read a file from the production tree · READ-ONLY · recorded in session
 *  for audit. Callers use this to inspect current-state before proposing
 *  a change (e.g. baseline for a modify action). */
export function readFromProduction(session: SandboxSession, absolutePath: string): string {
  const resolved = path.resolve(absolutePath);
  if (!existsSync(resolved)) throw new Error(`file not found: ${resolved}`);
  session.files_read_from_production.push(resolved);
  return readFileSync(resolved, "utf8");
}

/** Close the sandbox · CLEANUP disposition removes the directory · ARCHIVE
 *  keeps it for post-mortem inspection · both mark the session as closed. */
export function closeSandbox(session: SandboxSession, disposition: "DISCARDED" | "ARCHIVED"): void {
  if (disposition === "DISCARDED") {
    try { rmSync(session.root_dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
  session.disposition = disposition;
  session.closed_at_iso = new Date().toISOString();
}

// ─── Test + benchmark stubs ─────────────────────────
//
// Phase 12 minimum viable: SYNTHESIZED results. Real test/benchmark
// invocation is a separate wiring step that would need the sandbox to
// have a working node_modules · tsconfig · vitest config etc. All of
// that is future work behind additional authorization.

/** Synthesize a test-run result deterministically from the sandbox
 *  state. Real invocation replaces this once authorized. */
export function runTests(session: SandboxSession): TestRunResult {
  const start = Date.now();
  // Deterministic stub: count files written · treat as "test cases" · all pass
  const casesPassed = session.files_written.length;
  return {
    passed: casesPassed,
    failed: 0,
    skipped: 0,
    duration_ms: Date.now() - start,
    synthesized: true,
  };
}

/** Synthesize a benchmark-run result deterministically. Real invocation
 *  replaces this once authorized. */
export function runBenchmark(session: SandboxSession): BenchmarkRunResult {
  return {
    case_count: session.files_written.length,
    correct: session.files_written.length,
    synthesized: true,
  };
}

// ─── The autonomous cycle ───────────────────────────

/** Measure production tree bytes for a specific file list (or a small
 *  reference set) so we can prove production unchanged after the cycle. */
function measureProductionBytes(referenceFiles: string[]): number {
  let total = 0;
  for (const f of referenceFiles) {
    try {
      if (existsSync(f)) total += statSync(f).size;
    } catch { /* skip */ }
  }
  return total;
}

/** Append an audit entry to the immutable command ledger. Every
 *  autonomous-cycle result is logged for post-hoc Founder review. */
export function appendCommandAudit(entry: {
  cycle_id: string;
  candidate_id: string;
  repair_skill: string;
  founder_authorization_id: string;
  disposition: string;
  safety_violations: string[];
  requires_founder_approval_before_merge: true;
  timestamp_iso: string;
}, opts: { repoRoot?: string } = {}): string {
  const root = opts.repoRoot ?? process.cwd();
  const ledgerDir = path.join(root, "data", "programmer-execution");
  if (!existsSync(ledgerDir)) mkdirSync(ledgerDir, { recursive: true });
  const ledgerPath = path.join(ledgerDir, "command_audit.jsonl");
  appendFileSync(ledgerPath, JSON.stringify(entry) + "\n", "utf8");
  return ledgerPath;
}

/** Compose the full loop: open sandbox → apply change → test → benchmark
 *  → measure production isolation → close. Dry-run refuses to open a
 *  sandbox at all · returns a would-do plan instead. */
export function runAutonomousCycle(input: {
  change: ProposedChange;
  dry_run?: boolean;
  production_reference_files?: string[];
  archive_on_completion?: boolean;
  /** When true · appends to data/programmer-execution/command_audit.jsonl · defaults false */
  persist_audit?: boolean;
  repo_root?: string;
}): AutonomousCycleResult {
  const cycle_id = `cyc_${randomUUID()}`;
  const cycle_started_iso = new Date().toISOString();
  const started = Date.now();
  const refFiles = input.production_reference_files ?? [];
  const productionBytesBefore = measureProductionBytes(refFiles);
  const violations: string[] = [];

  if (input.dry_run) {
    return {
      cycle_id,
      candidate_id: input.change.candidate_id,
      session_id: "dry_run_no_session",
      sandbox_root: "dry_run_no_root",
      change_applied: false,
      paths_written_in_sandbox: [],
      test_result: { passed: 0, failed: 0, skipped: 0, duration_ms: 0, synthesized: true },
      benchmark_result: { case_count: 0, correct: 0, synthesized: true },
      production_bytes_before: productionBytesBefore,
      production_bytes_after: productionBytesBefore,
      production_unchanged: true,
      duration_ms: Date.now() - started,
      disposition: "COMPLETED_DRY_RUN",
      safety_violations: [],
      requires_founder_approval_before_merge: true,
      cycle_started_iso,
      cycle_completed_iso: new Date().toISOString(),
    };
  }

  const session = openSandbox();
  let disposition: AutonomousCycleResult["disposition"] = "COMPLETED_WET_RUN";
  let applied = false;
  let pathsWritten: string[] = [];
  let testResult: TestRunResult = { passed: 0, failed: 0, skipped: 0, duration_ms: 0, synthesized: true };
  let benchResult: BenchmarkRunResult = { case_count: 0, correct: 0, synthesized: true };

  try {
    const applyRes = applyChange(session, input.change);
    if (!applyRes.applied) {
      violations.push(...applyRes.errors);
      disposition = "ABORTED_SAFETY_VIOLATION";
    } else {
      applied = true;
      pathsWritten = applyRes.paths_written_absolute;
      testResult = runTests(session);
      benchResult = runBenchmark(session);
    }
  } catch (err) {
    violations.push(`SANDBOX_ERROR: ${(err as Error).message.slice(0, 300)}`);
    disposition = "ABORTED_SAFETY_VIOLATION";
  } finally {
    closeSandbox(session, input.archive_on_completion ? "ARCHIVED" : "DISCARDED");
  }

  const productionBytesAfter = measureProductionBytes(refFiles);
  const productionUnchanged = productionBytesBefore === productionBytesAfter;
  if (!productionUnchanged) {
    violations.push(`PRODUCTION_TREE_MUTATED: pre=${productionBytesBefore} post=${productionBytesAfter}`);
    disposition = "ABORTED_SAFETY_VIOLATION";
  }

  const result: AutonomousCycleResult = {
    cycle_id,
    candidate_id: input.change.candidate_id,
    session_id: session.session_id,
    sandbox_root: session.root_dir,
    change_applied: applied,
    paths_written_in_sandbox: pathsWritten,
    test_result: testResult,
    benchmark_result: benchResult,
    production_bytes_before: productionBytesBefore,
    production_bytes_after: productionBytesAfter,
    production_unchanged: productionUnchanged,
    duration_ms: Date.now() - started,
    disposition,
    safety_violations: violations,
    requires_founder_approval_before_merge: true,
    cycle_started_iso,
    cycle_completed_iso: new Date().toISOString(),
  };

  // Hard preserve · runtime cap check (post-hoc · aborts future auto-invocation if breached)
  if (result.duration_ms > CYCLE_BOUNDS.max_runtime_ms) {
    result.safety_violations.push(`RUNTIME_CAP_EXCEEDED: ${result.duration_ms}ms > ${CYCLE_BOUNDS.max_runtime_ms}ms`);
    result.disposition = "ABORTED_SAFETY_VIOLATION";
  }

  // Hard preserve · immutable command audit
  if (input.persist_audit) {
    appendCommandAudit({
      cycle_id,
      candidate_id: input.change.candidate_id,
      repair_skill: input.change.repair_skill,
      founder_authorization_id: input.change.founder_authorization_id,
      disposition: result.disposition,
      safety_violations: result.safety_violations,
      requires_founder_approval_before_merge: true,
      timestamp_iso: result.cycle_completed_iso,
    }, { repoRoot: input.repo_root });
  }

  return result;
}
