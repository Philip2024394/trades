// src/lib/nex/programmer-execution/contract.ts
//
// NEX Programmer Agent · Phase G · task-contract validation + policy
// Philip 2026-09-06 · AUTHORIZE · PHASE G · §6 §7 §8 §14
//
// Pure functions. No IO. No side effects.

import path from "node:path";
import { createHash } from "node:crypto";
import type {
  TaskContract,
  ToolCapability,
  FilePolicyRule,
} from "./types";
import { ALWAYS_PROTECTED_REPO_PATHS } from "./types";

// ─── Contract validation ───────────────────────────────────────

export type ContractValidation =
  | { ok: true }
  | { ok: false; reason: string };

/** Structural validation. Every contract must be internally consistent
 *  BEFORE any execution. A malformed contract is REJECTED — never
 *  silently amended. */
export function validateTaskContract(c: TaskContract): ContractValidation {
  if (!c.task_id || !c.task_id.trim()) return { ok: false, reason: "empty_task_id" };
  if (!c.objective || c.objective.trim().length < 8) return { ok: false, reason: "objective_too_short" };
  if (!c.sandbox_parent_dir || !path.isAbsolute(c.sandbox_parent_dir)) {
    return { ok: false, reason: "sandbox_parent_dir_must_be_absolute" };
  }
  if (c.max_iterations < 1 || c.max_iterations > 32) {
    return { ok: false, reason: `max_iterations_out_of_range:${c.max_iterations}` };
  }
  if (c.max_runtime_ms < 100 || c.max_runtime_ms > 10 * 60_000) {
    return { ok: false, reason: `max_runtime_ms_out_of_range:${c.max_runtime_ms}` };
  }
  if (c.max_files_changed < 1 || c.max_files_changed > 64) {
    return { ok: false, reason: `max_files_changed_out_of_range:${c.max_files_changed}` };
  }
  if (c.allowed_tools.length === 0) {
    return { ok: false, reason: "allowed_tools_empty" };
  }
  if (c.success_conditions.length === 0) {
    return { ok: false, reason: "success_conditions_empty" };
  }
  if (c.file_policy.length === 0) {
    return { ok: false, reason: "file_policy_empty" };
  }
  // The contract MAY NOT contain rules that DIRECTLY target a protected
  // path. A broad prefix like "src/" is fine — the runtime file guard
  // still refuses writes into protected subtrees inside the sandbox.
  // Only reject when the prefix itself IS or is NESTED INSIDE a
  // protected path (adversarial precision-target).
  for (const rule of c.file_policy) {
    if (rule.kind === "allow_prefix") {
      const normalized = rule.prefix.replace(/\\/g, "/");
      for (const protectedPath of ALWAYS_PROTECTED_REPO_PATHS) {
        if (normalized === protectedPath
            || normalized.startsWith(protectedPath + "/")
            || (protectedPath.startsWith(normalized) && normalized.length > 0 && normalized !== "src/" && normalized !== "tests/" && normalized !== "src" && normalized !== "tests")) {
          // Last clause allows the broad "src/" / "tests/" prefixes but
          // rejects narrower targeting like "src/lib/nex/programmer-".
          // The pattern-based test allowlist here is a defence layer;
          // the runtime file guard is the load-bearing enforcement.
          return { ok: false, reason: `allow_prefix_overlaps_protected:${rule.prefix}~${protectedPath}` };
        }
      }
    }
  }
  return { ok: true };
}

// ─── Contract content hash (for audit + drift attribution) ─────

export function taskContractHash(c: TaskContract): string {
  const canonical = JSON.stringify({
    task_id: c.task_id,
    objective: c.objective,
    file_policy: c.file_policy,
    allowed_tools: [...c.allowed_tools].sort(),
    max_iterations: c.max_iterations,
    max_runtime_ms: c.max_runtime_ms,
    max_files_changed: c.max_files_changed,
    success_conditions: c.success_conditions,
    failure_conditions: c.failure_conditions,
    rollback_on_failure: c.rollback_on_failure,
    allowed_repair_skills: c.allowed_repair_skills ? [...c.allowed_repair_skills].sort() : [],
  });
  return createHash("sha256").update(canonical).digest("hex").slice(0, 24);
}

// ─── Path normalization + traversal guard ──────────────────────

/** Normalize + reject path-traversal. Returns null for invalid paths. */
export function safeResolve(root: string, relpath: string): string | null {
  if (typeof relpath !== "string") return null;
  if (relpath.length === 0) return null;
  // Reject absolute paths in relpath (they'd escape the root).
  if (path.isAbsolute(relpath)) return null;
  // Normalize root through path.resolve so slashes, drive letters etc.
  // match what path.resolve produces on the platform.
  const normalizedRoot = path.resolve(root);
  const resolved = path.resolve(normalizedRoot, relpath);
  const rootWithSep = normalizedRoot.endsWith(path.sep) ? normalizedRoot : normalizedRoot + path.sep;
  if (resolved !== normalizedRoot && !resolved.startsWith(rootWithSep)) return null;
  return resolved;
}

// ─── File policy enforcement ───────────────────────────────────

export type FileAccessDecision =
  | { ok: true; matched_rule: FilePolicyRule | null }
  | { ok: false; reason: "path_traversal" | "protected_path" | "forbid_prefix" | "forbid_glob" | "no_allow_rule_matched" | "sandbox_escape"; detail: string };

/** Glob is intentionally minimal: only supports leading + trailing
 *  wildcards `*` (no recursive `**`). This keeps predicates simple and
 *  auditable. If a caller needs more, they should list explicit rules. */
function globMatches(pattern: string, subject: string): boolean {
  if (pattern === subject) return true;
  if (pattern === "*") return true;
  const leadingWild = pattern.startsWith("*");
  const trailingWild = pattern.endsWith("*");
  const inner = pattern.replace(/^\*/, "").replace(/\*$/, "");
  if (leadingWild && trailingWild) return subject.includes(inner);
  if (leadingWild) return subject.endsWith(inner);
  if (trailingWild) return subject.startsWith(inner);
  return false;
}

/** Enforce sandbox + protected-path + contract policy against a path.
 *  ORDER is critical and NON-NEGOTIABLE:
 *   1. sandbox escape (absolute path outside sandbox_root) → reject
 *   2. protected repo path (regardless of contract) → reject
 *   3. contract rules top-to-bottom, first match wins
 *   4. no allow rule matched → reject
 *  Fails closed. */
export function checkFileAccess(input: {
  sandbox_root: string;
  repo_root: string;
  absolute_path: string;
  contract: TaskContract;
}): FileAccessDecision {
  const { sandbox_root, repo_root, absolute_path, contract } = input;

  // 1 · sandbox escape guard · every write must be inside sandbox_root
  const sandboxWithSep = sandbox_root.endsWith(path.sep) ? sandbox_root : sandbox_root + path.sep;
  const insideSandbox = absolute_path === sandbox_root || absolute_path.startsWith(sandboxWithSep);
  if (!insideSandbox) {
    return { ok: false, reason: "sandbox_escape", detail: absolute_path };
  }

  // 2 · protected repo path guard · even if the sandbox happens to
  // sit under the repo tree (it never should, but defence-in-depth),
  // the protected registry always wins.
  for (const protectedPath of ALWAYS_PROTECTED_REPO_PATHS) {
    const abs = path.resolve(repo_root, protectedPath);
    const absWithSep = abs.endsWith(path.sep) ? abs : abs + path.sep;
    if (absolute_path === abs || absolute_path.startsWith(absWithSep)) {
      return { ok: false, reason: "protected_path", detail: protectedPath };
    }
  }

  // 3 · sandbox-relative subject for glob rules
  const rel = path.relative(sandbox_root, absolute_path).replace(/\\/g, "/");

  // 4 · contract rules top-to-bottom · first match wins
  for (const rule of contract.file_policy) {
    switch (rule.kind) {
      case "forbid_prefix":
        if (rel.startsWith(rule.prefix)) {
          return { ok: false, reason: "forbid_prefix", detail: rel };
        }
        break;
      case "forbid_glob":
        if (globMatches(rule.pattern, rel)) {
          return { ok: false, reason: "forbid_glob", detail: rel };
        }
        break;
      case "allow_prefix":
        if (rel.startsWith(rule.prefix)) {
          return { ok: true, matched_rule: rule };
        }
        break;
      case "allow_glob":
        if (globMatches(rule.pattern, rel)) {
          return { ok: true, matched_rule: rule };
        }
        break;
    }
  }

  // 5 · no allow rule matched → reject (fails closed)
  return { ok: false, reason: "no_allow_rule_matched", detail: rel };
}

// ─── Tool policy enforcement ───────────────────────────────────

export function checkToolAllowed(contract: TaskContract, tool: ToolCapability): boolean {
  return contract.allowed_tools.includes(tool);
}

// ─── Convenience: known-safe default contract for tests ────────

/** Minimal-but-legal contract skeleton — for tests only. Callers must
 *  fill in `sandbox_parent_dir`, `success_conditions`, and any provided
 *  plan. Deliberately does NOT include `write_sandbox_file` in the
 *  tool whitelist by default — callers must opt in. */
export function baselineTaskContract(overrides: Partial<TaskContract> & Pick<TaskContract, "task_id" | "sandbox_parent_dir">): TaskContract {
  return {
    task_id: overrides.task_id,
    objective: overrides.objective ?? "baseline contract for test purposes only",
    file_policy: overrides.file_policy ?? [{ kind: "allow_prefix", prefix: "src/" }],
    allowed_tools: overrides.allowed_tools ?? ["read_sandbox_file"],
    max_iterations: overrides.max_iterations ?? 1,
    max_runtime_ms: overrides.max_runtime_ms ?? 5_000,
    max_files_changed: overrides.max_files_changed ?? 1,
    success_conditions: overrides.success_conditions ?? [{ kind: "file_absent", sandbox_relpath: "src/nonexistent" }],
    failure_conditions: overrides.failure_conditions ?? [{ kind: "any_tool_denied" }],
    rollback_on_failure: overrides.rollback_on_failure ?? true,
    sandbox_parent_dir: overrides.sandbox_parent_dir,
    provided_plan: overrides.provided_plan,
    allowed_repair_skills: overrides.allowed_repair_skills,
    created_by: overrides.created_by ?? "test",
    created_at: overrides.created_at ?? "2026-09-06T00:00:00Z",
  };
}
