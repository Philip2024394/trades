// src/lib/nex-agent/code-engine/capability-fear.ts
//
// NEX1 · FEAR · Boundary agent · Founder-authorised 2026-09-18.
//
// PURPOSE
//   Deterministic assessment of the BLAST RADIUS of a proposed action.
//   Biological analogue: amygdala-mediated threat response. Engineering
//   translation: rule-based classifier that returns SAFE / ALERTED /
//   HIGH_FEAR based on whether the proposed action targets a protected
//   path, crosses a repo boundary, or performs a mutation without a
//   preservation baseline.
//
//   Zero LLM. Deterministic. Own rulebook (protected-paths list + rule
//   table) — per the boundary-agent principle: rules must live with the
//   enforcer, not in a shared doctrine.
//
// AUTHORITY SCOPE
//   Fear IS AUTHORISED to WITHHOLD promotion when HIGH_FEAR fires. It is
//   NOT authorised to override founder Turn-2 authorisation on legitimate
//   targets. It is NOT authorised to modify or execute anything.
//
//   The correct pattern: Fix 25 promotion gate consults fear; if
//   HIGH_FEAR, the gate holds and asks the founder for explicit
//   confirmation. This preserves the invariant that memory + inference
//   never bypass a boundary — they surface risk and let the founder
//   decide.
//
// PRESERVATION
//   Fix 23a/b/c · Q7/Q8 · Schema V1 · Fix 30/30B · Fix 17 · safety-
//   boundary UNCHANGED. This module adds a NEW deterministic gate; it
//   does not modify any existing gate.

export type FearLevel = "SAFE" | "ALERTED" | "HIGH_FEAR";

export type FearReasonCode =
  | "no_target"
  | "target_is_protected_path"
  | "target_is_protected_directory"
  | "cross_repo_write"
  | "mutation_without_preservation"
  | "safe_read_only"
  | "safe_mutation_in_bounds";

export interface FearAssessmentInput {
  /** Proposed target (repo-relative or absolute). Null for pure read. */
  readonly target: string | null;
  /** Kind of operation the caller is about to perform. */
  readonly operation_kind: "READ" | "MUTATION" | "EXECUTION" | "WRITE_NEW_FILE" | "DELETE";
  /** True when a preservation-check baseline (Fix 23c) will run before
   *  applying any mutation. Callers that cannot guarantee this pass false. */
  readonly preservation_baseline_available: boolean;
  /** Repo root (absolute). Used to detect cross-repo paths. */
  readonly repo_root: string;
}

export interface FearAssessment {
  readonly level: FearLevel;
  readonly reason_code: FearReasonCode;
  readonly reason: string;
  /** True when the level is HIGH_FEAR AND the caller should WITHHOLD action.
   *  Never true for ALERTED or SAFE. */
  readonly block_action: boolean;
  /** Deterministic informational tag: never authorises action. */
  readonly evidence_kind: "INFERRED";
  readonly policy_id: "NEX1_FEAR_POLICY";
  readonly policy_version: "v1";
}

// ── Protected-path rulebook (Fear's own executable rules) ────────────────
//
// A path is PROTECTED when its byte-identity is enforced by a founder-
// signed doctrine or product-constitution invariant. NEX1 may READ these
// files freely; mutation requires explicit founder authorisation via a
// path outside Fix 25's default promotion.

/** Exact-file protected list — byte-identity locked. */
const PROTECTED_FILES: ReadonlySet<string> = new Set([
  "src/lib/pricing.ts",
  "src/lib/tierCatalog.ts",
  "src/lib/nex-agent/safety-doctrine.ts",
  "src/lib/nex-agent/code-engine/safety-doctrine.ts",
  "CLAUDE.md",
  "docs/product-constitution/README.md",
]);

/** Directory-prefix protected list — anything inside these directories. */
const PROTECTED_DIRECTORIES: readonly string[] = [
  "docs/DECISIONS/",
  "docs/doctrine/",
  "docs/product-constitution/",
  ".claude/",
  "data/nex1-investigation-conclusions/",
];

function normalisePathSep(p: string): string {
  return p.replace(/\\/g, "/");
}

function isProtectedFile(rel: string): boolean {
  return PROTECTED_FILES.has(normalisePathSep(rel));
}

function isProtectedDirectory(rel: string): boolean {
  const n = normalisePathSep(rel);
  return PROTECTED_DIRECTORIES.some((d) => n.startsWith(d));
}

function isCrossRepo(target: string, repo_root: string): boolean {
  // A target is cross-repo when it is absolute AND does not start with repo_root.
  const t = normalisePathSep(target);
  const r = normalisePathSep(repo_root);
  if (!t.startsWith("/") && !/^[A-Za-z]:\//.test(t)) {
    // relative → in-repo by contract
    return false;
  }
  return !t.startsWith(r);
}

// ── Public API ──────────────────────────────────────────────────────────

export function assessFear(input: FearAssessmentInput): FearAssessment {
  const policy_id: "NEX1_FEAR_POLICY" = "NEX1_FEAR_POLICY";
  const policy_version: "v1" = "v1";
  const evidence_kind: "INFERRED" = "INFERRED";

  if (!input.target) {
    // READ with no target = safe (e.g. classifier-only turn).
    return {
      level: "SAFE",
      reason_code: "no_target",
      reason: "no target proposed · nothing to fear",
      block_action: false,
      evidence_kind,
      policy_id,
      policy_version,
    };
  }

  if (input.operation_kind === "READ") {
    return {
      level: "SAFE",
      reason_code: "safe_read_only",
      reason: "READ operation · never modifies the target",
      block_action: false,
      evidence_kind,
      policy_id,
      policy_version,
    };
  }

  // Mutation-class operations: MUTATION | EXECUTION | WRITE_NEW_FILE | DELETE
  if (isCrossRepo(input.target, input.repo_root)) {
    return {
      level: "HIGH_FEAR",
      reason_code: "cross_repo_write",
      reason: `target ${input.target} is outside repo ${input.repo_root} · cross-repo mutation`,
      block_action: true,
      evidence_kind,
      policy_id,
      policy_version,
    };
  }

  if (isProtectedFile(input.target)) {
    return {
      level: "HIGH_FEAR",
      reason_code: "target_is_protected_path",
      reason: `target ${input.target} is a byte-identity-locked protected file · founder authorisation required outside Fix 25 default`,
      block_action: true,
      evidence_kind,
      policy_id,
      policy_version,
    };
  }

  if (isProtectedDirectory(input.target)) {
    return {
      level: "HIGH_FEAR",
      reason_code: "target_is_protected_directory",
      reason: `target ${input.target} is under a protected directory · founder authorisation required outside Fix 25 default`,
      block_action: true,
      evidence_kind,
      policy_id,
      policy_version,
    };
  }

  if (input.operation_kind === "MUTATION" && !input.preservation_baseline_available) {
    return {
      level: "ALERTED",
      reason_code: "mutation_without_preservation",
      reason: "mutation proposed without preservation baseline · Fix 23c not available",
      block_action: false,
      evidence_kind,
      policy_id,
      policy_version,
    };
  }

  return {
    level: "SAFE",
    reason_code: "safe_mutation_in_bounds",
    reason: "in-repo target · not protected · preservation baseline available",
    block_action: false,
    evidence_kind,
    policy_id,
    policy_version,
  };
}

export const FEAR_VERSION = "fear.v1";

/** Exposed for tests. Do not mutate at runtime. */
export const _FEAR_INTERNAL = {
  PROTECTED_FILES,
  PROTECTED_DIRECTORIES,
};
