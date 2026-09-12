// WO-WORKSTATION-03 · deterministic Challenger
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// Runs after the generator produces CandidateFiles + Diff, before an
// AuthorisedDiffBundle is minted. Rejects anything that would let a
// generated diff escape the workspace, touch protected roots, or ship
// obviously dangerous runtime patterns.
//
// This is the Twin-Challenger role from P-T doctrine, implemented
// deterministically for WO-03 v0.1 (no separate reasoning-instance
// process yet — that's Phase 13). Rules-based, not LLM-based.
//
// Every finding carries a specific code so audit records the WHY.
// Multiple findings can be returned in a single pass — do not stop at
// the first defect. That way the caller (and eventually the founder)
// sees the full picture rather than a peel-the-onion sequence.

import path from "node:path";
import type {
  FilePlan,
  CandidateFile,
  ChallengeFinding,
  ChallengeResult,
} from "./wo3-types";
import { findTemplate } from "./wo3-templates";

// ── Protected roots · never generate into these regardless of workspace ─

const PROTECTED_ROOTS: readonly string[] = [
  ".git",
  "node_modules",
  ".next",
  ".vercel",
  ".env",
  ".env.local",
  ".env.production",
  "deploy/minio/data",
  "src/lib/nex-authority-broker",   // Broker code — cannot be modified via generation
  "src/lib/nex-controlled-hands",   // Controlled Hands — same
  "src/lib/nex/config",             // production-guard, pg config — do not regenerate
];

// ── Dangerous content patterns ──────────────────────────────────────────

interface DangerousPattern {
  readonly regex: RegExp;
  readonly code: ChallengeFinding["code"];
  readonly detail: string;
}

const DANGEROUS_PATTERNS: readonly DangerousPattern[] = [
  { regex: /\beval\s*\(/,                                     code: "DANGEROUS_PATTERN_EVAL",           detail: "eval() calls not permitted in generated code" },
  { regex: /new\s+Function\s*\(/,                             code: "DANGEROUS_PATTERN_FUNCTION_CTOR",  detail: "Function constructor calls not permitted in generated code" },
  { regex: /require\s*\(\s*['"]child_process['"]\s*\)/,       code: "DANGEROUS_PATTERN_CHILD_PROCESS",  detail: "child_process import not permitted in generated code" },
  { regex: /from\s+['"]child_process['"]/,                    code: "DANGEROUS_PATTERN_CHILD_PROCESS",  detail: "child_process ES import not permitted in generated code" },
];

// ── Main entry point ────────────────────────────────────────────────────

export function challenge(input: {
  readonly plan: FilePlan;
  readonly candidates: readonly CandidateFile[];
}): ChallengeResult {
  const findings: ChallengeFinding[] = [];

  // 1. Plan-level checks (each op)
  const seen_paths = new Set<string>();
  for (const op of input.plan.ops) {
    // Empty path
    if (!op.path || op.path.trim().length === 0) {
      findings.push({ code: "PATH_EMPTY", path: op.path, detail: "op has empty path" });
      continue;
    }
    // Absolute path
    if (path.isAbsolute(op.path)) {
      findings.push({ code: "PATH_ABSOLUTE", path: op.path, detail: `op path must be relative to workspace root, got absolute path` });
    }
    // Escapes via ..
    const normalised = path.posix.normalize(op.path.replace(/\\/g, "/"));
    if (normalised.startsWith("../") || normalised === ".." || normalised.split("/").includes("..")) {
      findings.push({ code: "PATH_ESCAPES_WORKSPACE", path: op.path, detail: `op path escapes workspace via '..'` });
    }
    // Protected roots
    for (const root of PROTECTED_ROOTS) {
      const rootPosix = root.replace(/\\/g, "/");
      if (normalised === rootPosix || normalised.startsWith(rootPosix + "/")) {
        findings.push({ code: "PATH_TOUCHES_PROTECTED_ROOT", path: op.path, detail: `op path touches protected root '${root}'` });
        break;
      }
    }
    // Duplicates
    if (seen_paths.has(op.path)) {
      findings.push({ code: "DUPLICATE_PATH_IN_PLAN", path: op.path, detail: `path appears more than once in plan` });
    }
    seen_paths.add(op.path);
    // Template required for create/modify
    if ((op.kind === "create" || op.kind === "modify")) {
      if (!op.template_ref) {
        findings.push({ code: "TEMPLATE_MISSING_FOR_CREATE", path: op.path, detail: `op kind ${op.kind} requires a template_ref` });
      } else if (!findTemplate(op.template_ref)) {
        findings.push({ code: "TEMPLATE_UNKNOWN", path: op.path, detail: `template_ref not registered: ${op.template_ref}` });
      }
    }
  }

  // 2. Candidate-level checks (content patterns)
  for (const candidate of input.candidates) {
    if (candidate.content.length === 0) {
      findings.push({ code: "CONTENT_EMPTY", path: candidate.path, detail: `candidate content is empty` });
    }
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.regex.test(candidate.content)) {
        findings.push({ code: pattern.code, path: candidate.path, detail: pattern.detail });
      }
    }
  }

  if (findings.length === 0) return { ok: true };
  return { ok: false, findings };
}
