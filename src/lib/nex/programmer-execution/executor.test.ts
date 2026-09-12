// src/lib/nex/programmer-execution/executor.test.ts
//
// NEX Programmer Agent · Phase G · unit tests (§32)
// Philip 2026-09-06 · AUTHORIZE · PHASE G

import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

import type { TaskContract, RepairPlan, RepairSkill, AuditEntry, ExecutionRun } from "./types";
import { ALWAYS_PROTECTED_REPO_PATHS } from "./types";
import { baselineTaskContract, checkFileAccess, checkToolAllowed, validateTaskContract, safeResolve, taskContractHash } from "./contract";
import { createSandbox, discardSandbox, writeSandboxFile, readSandboxFile, deleteSandboxFile, listSandboxFiles } from "./sandbox";
import {
  executeTask,
  registerRepairSkill,
  getRegisteredRepairSkills,
  _clearRepairSkillsForTests,
} from "./executor";
import {
  persistExecutionRun,
  appendAuditEntry,
  auditEntryFromRun,
  readAuditIndex,
  readFullExecutionRun,
  programmerExecutionAuditDir,
  _resetAuditStoreForTests,
} from "./audit";

const REPO_ROOT = process.cwd();

// ─── Fixture helpers ──────────────────────────────────────────

let tmpRoot: string;
let sandboxParent: string;
beforeEach(() => {
  tmpRoot = mkdtempSync(path.join(os.tmpdir(), "phase-g-test-"));
  sandboxParent = path.join(tmpRoot, "sandbox-parent");
  mkdirSync(sandboxParent, { recursive: true });
  process.env.NEX_PROGRAMMER_EXECUTION_DIR = path.join(tmpRoot, "audit-store");
  _resetAuditStoreForTests();
  _clearRepairSkillsForTests();
});

function contract(over: Partial<TaskContract> = {}): TaskContract {
  return baselineTaskContract({
    task_id: over.task_id ?? "t1",
    sandbox_parent_dir: sandboxParent,
    ...over,
  });
}

function trivialPlan(relpath: string, content: string): RepairPlan {
  return { plan_id: "p_trivial", description: "write single file", operations: [{ op: "write", sandbox_relpath: relpath, content }] };
}

// ═════════════ Contract validation (§32.task-contract) ═════════════

describe("validateTaskContract · structural rules", () => {
  it("rejects empty task_id", () => {
    const c = contract({ task_id: "" });
    expect(validateTaskContract(c).ok).toBe(false);
  });
  it("rejects short objective", () => {
    const c = contract({ objective: "x" });
    expect(validateTaskContract(c).ok).toBe(false);
  });
  it("rejects out-of-range max_iterations", () => {
    expect(validateTaskContract(contract({ max_iterations: 0 })).ok).toBe(false);
    expect(validateTaskContract(contract({ max_iterations: 33 })).ok).toBe(false);
  });
  it("rejects out-of-range max_runtime_ms", () => {
    expect(validateTaskContract(contract({ max_runtime_ms: 50 })).ok).toBe(false);
    expect(validateTaskContract(contract({ max_runtime_ms: 999_999 })).ok).toBe(false);
  });
  it("rejects empty allowed_tools", () => {
    expect(validateTaskContract(contract({ allowed_tools: [] })).ok).toBe(false);
  });
  it("rejects contract that allows a protected path", () => {
    const c = contract({
      file_policy: [{ kind: "allow_prefix", prefix: "src/lib/nex/programmer-review" }],
    });
    const v = validateTaskContract(c);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toMatch(/allow_prefix_overlaps_protected/);
  });
});

describe("taskContractHash · deterministic", () => {
  it("identical contracts produce identical hash", () => {
    const a = contract({ task_id: "same" });
    const b = contract({ task_id: "same" });
    expect(taskContractHash(a)).toBe(taskContractHash(b));
  });
  it("different objectives produce different hash", () => {
    const a = contract({ objective: "objective one" });
    const b = contract({ objective: "objective two" });
    expect(taskContractHash(a)).not.toBe(taskContractHash(b));
  });
});

// ═════════════ File policy (§32.file-boundary) ═════════════

describe("checkFileAccess · policy enforcement", () => {
  it("rejects sandbox escape", () => {
    const sb = createSandbox(sandboxParent);
    const outside = path.resolve(tmpRoot, "outside.txt");
    const decision = checkFileAccess({
      sandbox_root: sb.root, repo_root: REPO_ROOT, absolute_path: outside,
      contract: contract({ file_policy: [{ kind: "allow_prefix", prefix: "" }] }),
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason).toBe("sandbox_escape");
  });
  it("rejects protected repo path even under permissive contract", () => {
    // Simulate an "inside sandbox" path that also happens to resolve to a
    // protected repo path (not physically possible but the guard should
    // still check). We test the protected-path guard directly by
    // constructing an absolute_path that IS inside a protected repo dir.
    const abs = path.resolve(REPO_ROOT, "src/lib/nex/programmer-review/reviewer.ts");
    const decision = checkFileAccess({
      // Use the protected repo dir as a "sandbox" (adversarial): the
      // protected-path guard runs AFTER the sandbox-escape check, so we
      // need the file to be "inside" the fake sandbox to reach step 2.
      sandbox_root: path.resolve(REPO_ROOT, "src/lib/nex/programmer-review"),
      repo_root: REPO_ROOT,
      absolute_path: abs,
      contract: contract({ file_policy: [{ kind: "allow_prefix", prefix: "" }] }),
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason).toBe("protected_path");
  });
  it("rejects when no allow rule matches (fails closed)", () => {
    const sb = createSandbox(sandboxParent);
    const abs = path.resolve(sb.root, "src/nope.ts");
    const decision = checkFileAccess({
      sandbox_root: sb.root, repo_root: REPO_ROOT, absolute_path: abs,
      contract: contract({ file_policy: [{ kind: "allow_prefix", prefix: "tests/" }] }),
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason).toBe("no_allow_rule_matched");
  });
  it("accepts sandbox-relative allowed prefix", () => {
    const sb = createSandbox(sandboxParent);
    const abs = path.resolve(sb.root, "src/hello.ts");
    const decision = checkFileAccess({
      sandbox_root: sb.root, repo_root: REPO_ROOT, absolute_path: abs,
      contract: contract({ file_policy: [{ kind: "allow_prefix", prefix: "src/" }] }),
    });
    expect(decision.ok).toBe(true);
  });
  it("forbid_prefix wins over subsequent allow_prefix (order matters)", () => {
    const sb = createSandbox(sandboxParent);
    const abs = path.resolve(sb.root, "src/danger/private.ts");
    const decision = checkFileAccess({
      sandbox_root: sb.root, repo_root: REPO_ROOT, absolute_path: abs,
      contract: contract({ file_policy: [
        { kind: "forbid_prefix", prefix: "src/danger/" },
        { kind: "allow_prefix", prefix: "src/" },
      ]}),
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason).toBe("forbid_prefix");
  });
});

describe("safeResolve · path-traversal rejection", () => {
  it("rejects absolute path", () => {
    expect(safeResolve("/root", "/etc/passwd")).toBeNull();
  });
  it("rejects .. escape", () => {
    expect(safeResolve("/root/sub", "../../etc/passwd")).toBeNull();
  });
  it("accepts nested path within root", () => {
    expect(safeResolve("/root/sub", "a/b/c.txt")).toBe(path.resolve("/root/sub/a/b/c.txt"));
  });
});

// ═════════════ Tool policy (§32.tool-boundary) ═════════════

describe("checkToolAllowed · whitelist enforcement", () => {
  it("allows tool listed in contract", () => {
    expect(checkToolAllowed(contract({ allowed_tools: ["read_sandbox_file"] }), "read_sandbox_file")).toBe(true);
  });
  it("rejects tool not listed", () => {
    expect(checkToolAllowed(contract({ allowed_tools: ["read_sandbox_file"] }), "write_sandbox_file")).toBe(false);
  });
});

// ═════════════ Sandbox lifecycle (§32.sandbox-isolation) ═════════════

describe("sandbox · createSandbox · discardSandbox", () => {
  it("creates fresh directory under parent", () => {
    const sb = createSandbox(sandboxParent);
    expect(existsSync(sb.root)).toBe(true);
    expect(sb.root.startsWith(sandboxParent + path.sep)).toBe(true);
  });
  it("discardSandbox removes contents", () => {
    const sb = createSandbox(sandboxParent);
    writeFileSync(path.join(sb.root, "x.txt"), "hi", "utf8");
    expect(existsSync(sb.root)).toBe(true);
    discardSandbox(sb);
    expect(existsSync(sb.root)).toBe(false);
  });
});

describe("writeSandboxFile / readSandboxFile / deleteSandboxFile", () => {
  it("writes under sandbox with allow policy", () => {
    const sb = createSandbox(sandboxParent);
    const r = writeSandboxFile({
      sandbox: sb, repo_root: REPO_ROOT,
      contract: contract({ file_policy: [{ kind: "allow_prefix", prefix: "src/" }], allowed_tools: ["write_sandbox_file"] }),
      relpath: "src/hi.txt", content: "hi",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(existsSync(r.absolute_path)).toBe(true);
  });
  it("refuses path traversal", () => {
    const sb = createSandbox(sandboxParent);
    const r = writeSandboxFile({
      sandbox: sb, repo_root: REPO_ROOT,
      contract: contract({ file_policy: [{ kind: "allow_prefix", prefix: "" }], allowed_tools: ["write_sandbox_file"] }),
      relpath: "../../etc/passwd", content: "hi",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("path_traversal");
  });
  it("refuses write against contract policy", () => {
    const sb = createSandbox(sandboxParent);
    const r = writeSandboxFile({
      sandbox: sb, repo_root: REPO_ROOT,
      contract: contract({ file_policy: [{ kind: "allow_prefix", prefix: "tests/" }], allowed_tools: ["write_sandbox_file"] }),
      relpath: "src/no.ts", content: "hi",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("no_allow_rule_matched");
  });
});

// ═════════════ Executor · plan application (§32.autonomous-coding) ═════════════

describe("executeTask · provided plan happy path", () => {
  it("verifies when file_contains success condition met by plan", () => {
    const c = contract({
      task_id: "provided_plan_happy",
      objective: "write hello.txt with content hello world for verification",
      file_policy: [{ kind: "allow_prefix", prefix: "src/" }],
      allowed_tools: ["write_sandbox_file", "read_sandbox_file"],
      max_iterations: 1,
      max_files_changed: 1,
      success_conditions: [
        { kind: "file_contains", sandbox_relpath: "src/hello.txt", needle: "hello world" },
      ],
      provided_plan: trivialPlan("src/hello.txt", "hello world content"),
    });
    const run = executeTask({ contract: c, repo_root: REPO_ROOT });
    expect(run.final_status).toBe("VERIFIED");
    expect(run.files_modified).toEqual(["src/hello.txt"]);
    expect(run.denied_operations).toEqual([]);
  });
});

describe("executeTask · file-boundary violation → BLOCKED (§32.file-boundary)", () => {
  it("write to forbidden path → BLOCKED", () => {
    const c = contract({
      task_id: "boundary_violation",
      objective: "attempt to write outside allowed prefix - blocked test",
      file_policy: [{ kind: "allow_prefix", prefix: "src/" }],
      allowed_tools: ["write_sandbox_file"],
      max_iterations: 1,
      max_files_changed: 1,
      success_conditions: [{ kind: "file_contains", sandbox_relpath: "tests/x.txt", needle: "hi" }],
      provided_plan: trivialPlan("tests/x.txt", "hi"),
    });
    const run = executeTask({ contract: c, repo_root: REPO_ROOT });
    expect(run.final_status).toBe("BLOCKED");
    expect(run.denied_operations.some((d) => d.detail.includes("file_denied") || d.detail.includes("no_allow_rule_matched"))).toBe(true);
  });
});

describe("executeTask · tool-boundary violation → BLOCKED (§32.tool-boundary)", () => {
  it("plan uses write_sandbox_file when tool is not allowed", () => {
    const c = contract({
      task_id: "tool_denied",
      objective: "provided plan requires write but write tool not authorised",
      file_policy: [{ kind: "allow_prefix", prefix: "src/" }],
      allowed_tools: ["read_sandbox_file"],   // no write
      max_iterations: 1,
      max_files_changed: 1,
      success_conditions: [{ kind: "file_contains", sandbox_relpath: "src/no.txt", needle: "hi" }],
      provided_plan: trivialPlan("src/no.txt", "hi"),
    });
    const run = executeTask({ contract: c, repo_root: REPO_ROOT });
    expect(run.final_status).toBe("BLOCKED");
    expect(run.denied_operations.some((d) => d.kind === "tool_denied")).toBe(true);
  });
});

describe("executeTask · protected path blocked even when contract permits (§14 §32)", () => {
  it("plan targeting src/lib/nex/programmer-review/* is refused", () => {
    // Contract validation refuses to allow_prefix a protected path,
    // so the malformed contract itself is BLOCKED.
    const c = contract({
      task_id: "protected_target",
      objective: "attempt to modify protected reviewer module",
      file_policy: [{ kind: "allow_prefix", prefix: "src/lib/nex/programmer-review/" }],
      allowed_tools: ["write_sandbox_file"],
      max_iterations: 1,
      max_files_changed: 1,
      success_conditions: [{ kind: "file_contains", sandbox_relpath: "src/lib/nex/programmer-review/x.ts", needle: "x" }],
      provided_plan: trivialPlan("src/lib/nex/programmer-review/x.ts", "x"),
    });
    const run = executeTask({ contract: c, repo_root: REPO_ROOT });
    expect(run.final_status).toBe("BLOCKED");
  });
});

describe("executeTask · bounded retry (§32.bounded-retries)", () => {
  it("stops after max_iterations even without success", () => {
    const c = contract({
      task_id: "no_success",
      objective: "success condition unreachable - test bounded retry limit",
      file_policy: [{ kind: "allow_prefix", prefix: "src/" }],
      allowed_tools: ["write_sandbox_file"],
      max_iterations: 3,
      max_files_changed: 1,
      success_conditions: [{ kind: "file_contains", sandbox_relpath: "src/only.txt", needle: "NEVER_APPEARS" }],
      provided_plan: trivialPlan("src/only.txt", "some content"),
    });
    const run = executeTask({ contract: c, repo_root: REPO_ROOT });
    expect(run.final_status).toBe("FAILED");
    expect(run.iterations.length).toBe(3);
  });
});

describe("executeTask · escalation when no plan available (§24)", () => {
  it("no provided_plan + no repair skills → ESCALATED", () => {
    const c = contract({
      task_id: "no_plan",
      objective: "no plan available should escalate rather than continue",
      file_policy: [{ kind: "allow_prefix", prefix: "src/" }],
      allowed_tools: ["write_sandbox_file"],
      max_iterations: 1,
      max_files_changed: 1,
      success_conditions: [{ kind: "file_contains", sandbox_relpath: "src/x.txt", needle: "y" }],
    });
    const run = executeTask({ contract: c, repo_root: REPO_ROOT });
    expect(run.final_status).toBe("ESCALATED");
  });
});

// ═════════════ RepairSkill registry (§25 learning integration) ═════════════

describe("RepairSkill registry", () => {
  it("registers + retrieves + clears", () => {
    const skill: RepairSkill = {
      skill_id: "write_greeting",
      description: "writes hello.txt with 'hello'",
      applies: () => true,
      build_plan: () => ({ plan_id: "p_g", description: "greet", operations: [{ op: "write", sandbox_relpath: "src/hello.txt", content: "hello" }] }),
    };
    registerRepairSkill(skill);
    expect(getRegisteredRepairSkills()).toContain("write_greeting");
    _clearRepairSkillsForTests();
    expect(getRegisteredRepairSkills()).toEqual([]);
  });
  it("executor uses a registered repair skill when no provided_plan", () => {
    registerRepairSkill({
      skill_id: "write_hi",
      description: "always writes hi.txt",
      applies: () => true,
      build_plan: () => ({ plan_id: "p_hi", description: "hi", operations: [{ op: "write", sandbox_relpath: "src/hi.txt", content: "hi world" }] }),
    });
    const c = contract({
      task_id: "use_skill",
      objective: "use registered repair skill to write hi world",
      file_policy: [{ kind: "allow_prefix", prefix: "src/" }],
      allowed_tools: ["write_sandbox_file", "read_sandbox_file"],
      max_iterations: 1,
      max_files_changed: 1,
      success_conditions: [{ kind: "file_contains", sandbox_relpath: "src/hi.txt", needle: "hi world" }],
      allowed_repair_skills: ["write_hi"],
    });
    const run = executeTask({ contract: c, repo_root: REPO_ROOT });
    expect(run.final_status).toBe("VERIFIED");
  });
});

// ═════════════ Audit trail (§32.audit-trail) ═════════════

describe("audit · append-only + fresh reads", () => {
  it("persistExecutionRun refuses non-null final_status_narrative", () => {
    const badRun: ExecutionRun = {
      run_id: "r1", task_id: "t1", environment_identifier: "node",
      started_at: "s", finished_at: "e", triggered_by: "test",
      sandbox_root: "", contract: contract(), iterations: [],
      files_modified: [], final_status: "VERIFIED",
      final_status_narrative: "SUCCESS" as never,
      denied_operations: [], execution_fingerprint: "f",
    };
    expect(() => persistExecutionRun(badRun)).toThrow(/Op-Truth/);
  });
  it("appendAuditEntry rejects duplicate run_id", () => {
    const entry: AuditEntry = {
      run_id: "r1", task_id: "t1", started_at: "s", finished_at: "e",
      final_status: "VERIFIED", sandbox_root: "", execution_fingerprint: "f",
      final_status_narrative: null,
      files_modified_count: 0, denied_operations_count: 0, iterations_count: 0,
    };
    appendAuditEntry(entry);
    expect(() => appendAuditEntry(entry)).toThrow(/historical_mutation_rejected/);
  });
  it("readFullExecutionRun returns null for missing id", () => {
    expect(readFullExecutionRun("does_not_exist")).toBeNull();
  });
});

// ═════════════ Fingerprint reproducibility (§32.reproducibility) ═════════════

describe("execution fingerprint · deterministic on identical inputs", () => {
  it("two identical runs produce identical execution_fingerprint (modulo runtime timing)", () => {
    // Same contract, same plan, distinct sandbox roots — the fingerprint
    // is over contract hash + files_modified + denied_ops + final_status +
    // iteration_count, NOT the sandbox root path. So it must match.
    const c = contract({
      task_id: "fp_test",
      objective: "identical runs should share fingerprint modulo timing",
      file_policy: [{ kind: "allow_prefix", prefix: "src/" }],
      allowed_tools: ["write_sandbox_file", "read_sandbox_file"],
      max_iterations: 1,
      max_files_changed: 1,
      success_conditions: [{ kind: "file_contains", sandbox_relpath: "src/fp.txt", needle: "OK" }],
      provided_plan: trivialPlan("src/fp.txt", "OK content"),
    });
    const r1 = executeTask({ contract: c, repo_root: REPO_ROOT, run_id_override: "run_A" });
    const r2 = executeTask({ contract: c, repo_root: REPO_ROOT, run_id_override: "run_A" }); // same override
    // Fingerprints include run_id, so runs with the same override + same
    // inputs should produce identical fingerprints.
    expect(r1.execution_fingerprint).toBe(r2.execution_fingerprint);
  });
});

// ═════════════ Rollback (§20 §32) ═════════════

describe("rollback · sandbox discarded on failure", () => {
  it("failed run with rollback_on_failure=true removes the sandbox", () => {
    const c = contract({
      task_id: "rollback_test",
      objective: "verify sandbox is discarded on failure per rollback policy",
      file_policy: [{ kind: "allow_prefix", prefix: "src/" }],
      allowed_tools: ["write_sandbox_file"],
      max_iterations: 1,
      max_files_changed: 1,
      success_conditions: [{ kind: "file_contains", sandbox_relpath: "src/x.txt", needle: "NEVER" }],
      provided_plan: trivialPlan("src/x.txt", "some data"),
      rollback_on_failure: true,
    });
    const run = executeTask({ contract: c, repo_root: REPO_ROOT });
    expect(run.final_status).toBe("FAILED");
    expect(existsSync(run.sandbox_root)).toBe(false);
  });
  it("successful run preserves the sandbox", () => {
    const c = contract({
      task_id: "preserve_success",
      objective: "verified runs should preserve the sandbox for audit",
      file_policy: [{ kind: "allow_prefix", prefix: "src/" }],
      allowed_tools: ["write_sandbox_file", "read_sandbox_file"],
      max_iterations: 1,
      max_files_changed: 1,
      success_conditions: [{ kind: "file_contains", sandbox_relpath: "src/ok.txt", needle: "OK" }],
      provided_plan: trivialPlan("src/ok.txt", "OK content"),
    });
    const run = executeTask({ contract: c, repo_root: REPO_ROOT });
    expect(run.final_status).toBe("VERIFIED");
    expect(existsSync(run.sandbox_root)).toBe(true);
  });
});

// ═════════════ Anti-gaming (§15 §32) ═════════════

describe("anti-gaming · protected paths cannot be modified via contract", () => {
  it("contract with allow_prefix over benchmark corpus → validation rejects", () => {
    const c = contract({
      file_policy: [{ kind: "allow_prefix", prefix: "tests/fixtures/programmer-benchmark-proof" }],
    });
    expect(validateTaskContract(c).ok).toBe(false);
  });
  it("all known-protected paths are declared in ALWAYS_PROTECTED_REPO_PATHS", () => {
    for (const p of [
      "src/lib/nex/programmer-review",
      "src/lib/nex/programmer-benchmark",
      "src/lib/nex/programmer-stability",
      "src/lib/nex/programmer-improvement",
      "src/lib/nex/programmer-execution",
      "tests/fixtures/programmer-benchmark-proof",
    ]) {
      expect(ALWAYS_PROTECTED_REPO_PATHS).toContain(p);
    }
  });
});

// ═════════════ Anti-autonomy audit (§35) ═════════════

describe("Phase-G module surface · no autonomy escape", () => {
  it("no exported symbol name matches forbidden prefixes", async () => {
    const modules: Record<string, unknown> = {
      types:      await import("./types"),
      contract:   await import("./contract"),
      sandbox:    await import("./sandbox"),
      executor:   await import("./executor"),
      audit:      await import("./audit"),
    };
    const forbidden = [
      "commit_to_production", "push_to_remote", "deploy",
      "modify_production_database", "alter_production_schema",
      "grant_access", "create_account",
      "read_production_secret", "unrestricted_network", "external_communication",
      "modify_reviewer", "modify_evaluator", "modify_benchmark_corpus",
      "modify_stability_module", "modify_execution_module",
      "modify_audit_log_in_place", "delete_audit_log",
      "modify_accommodation_data", "call_accommodation_adapter",
      "activate_accommodation_workforce",
      "modify_own_authority_model", "modify_own_security_boundary",
      "modify_own_governance_controls", "modify_own_operational_truth",
    ];
    for (const [name, mod] of Object.entries(modules)) {
      const keys = Object.keys(mod as Record<string, unknown>);
      for (const k of keys) {
        for (const bad of forbidden) {
          expect(k.toLowerCase(), `${name}.${k} matches forbidden "${bad}"`).not.toContain(bad.toLowerCase());
        }
      }
    }
  });

  it("no scheduler / cron / watcher primitive in executor.ts", () => {
    const __filename = fileURLToPath(import.meta.url);
    const src = readFileSync(path.join(path.dirname(__filename), "executor.ts"), "utf8");
    expect(src).not.toMatch(/setInterval\s*\(/);
    expect(src).not.toMatch(/setTimeout\s*\(\s*[^,]+,\s*\d{4,}/);   // long timers only
    expect(src).not.toMatch(/node-cron|node-schedule/);
    expect(src).not.toMatch(/fs\.watch\(/);
  });
});
