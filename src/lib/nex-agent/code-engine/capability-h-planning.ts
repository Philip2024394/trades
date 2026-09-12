// src/lib/nex-agent/code-engine/capability-h-planning.ts
//
// NEX1 · CAPABILITY H.1 · TASK PLANNING · deterministic · zero LLM.
//
// taught_by = master_ai_engineer · 2026-09-12
// Teaching infrastructure only · NOT NEX1 independent authorship.
//
// Purpose: convert a structured engineering goal into a concrete
// TemplateDirective (or refusal) that the existing A + C + D + E + F + G
// machinery can execute. This is the first move from
// "execute a supplied directive" to "interpret a higher-level goal."
//
// Discipline:
//   · deterministic · zero LLM · zero network
//   · task-level `instruction` MUST NOT override constitutional safety
//   · protected-path targets → PLAN REFUSED (never mutate)
//   · ambiguous goals → PLAN REFUSED · NEX1 must not fabricate intent
//   · duplicate-symbol targets resolved via consumer import chain;
//     refuse when no consumer disambiguation is available
//   · natural-language input is EXPLICITLY OUT OF SCOPE for H.1 · this
//     module accepts structured goal records only
//
// Removing this module must not remove any NEX1-owned identity, memory,
// evidence, orchestration, ladder, audit, or safety mechanism.

import type { TemplateDirective } from "./types";
import type { Nex1DiscoveryScope } from "./capability-f-discovery";
import { discoverRelevantSources } from "./capability-f-discovery";
import { isProtected } from "./scope-enforcer";
import { relative } from "node:path";

/**
 * @summary Robust protection check that handles absolute paths returned by
 * discovery. Tries the raw path first, then a repo-relative form derived
 * from `process.cwd()`. Fails safe — if either form matches, the path is
 * treated as protected.
 */
function isProtectedPathRobust(fullPath: string): boolean {
  const norm = fullPath.replace(/\\/g, "/");
  if (isProtected(norm)) return true;
  try {
    const rel = relative(process.cwd(), fullPath).replace(/\\/g, "/");
    if (isProtected(rel)) return true;
  } catch {
    /* ignore */
  }
  return false;
}

export type Nex1DesiredKind =
  | "number"
  | "string"
  | "boolean"
  | "array"
  | "readonly_array"
  | "custom";

export interface Nex1GoalRecord {
  readonly goal: "add_field";
  readonly type_name?: string;
  readonly concept?: string;
  readonly desired_kind?: Nex1DesiredKind;
  readonly desired_type_text?: string;
  readonly instruction?: string;
}

export type Nex1PlanKind =
  | "planned"
  | "refused_ambiguous"
  | "refused_protected_path"
  | "refused_no_declaration"
  | "refused_duplicate_unresolved"
  | "refused_unknown_goal"
  | "refused_missing_field_type"
  | "refused_unsafe_instruction";

export interface Nex1PlanResult {
  readonly kind: Nex1PlanKind;
  readonly directive: TemplateDirective | null;
  readonly target_file: string | null;
  readonly reason: string;
  readonly taught_by: "master_ai_engineer";
  readonly considered_paths?: readonly string[];
  readonly ignored_instruction?: string;
}

/**
 * @summary Convert a structured goal record into a concrete directive.
 * Refuses cleanly rather than guessing.
 */
export function planGoalToDirective(goal: Nex1GoalRecord, scope: Nex1DiscoveryScope): Nex1PlanResult {
  // ── Guard 0 · Recognise the goal kind ──────────────────────────────
  if (goal.goal !== "add_field") {
    return refuse("refused_unknown_goal", `goal '${goal.goal}' is not yet planned by H.1 · only 'add_field' supported`, goal);
  }

  // ── Guard 1 · Detect unsafe instructions early ─────────────────────
  // Task-level 'instruction' fields must NEVER override constitutional
  // safety. If the instruction attempts to bypass protection, refuse.
  const instruction = goal.instruction?.toLowerCase() ?? "";
  const unsafeIntent =
    /ignore\s+protect/.test(instruction) ||
    /bypass/.test(instruction) ||
    /override\s+safety/.test(instruction) ||
    /disable\s+guard/.test(instruction) ||
    /disable\s+security/.test(instruction) ||
    /skip\s+auth/.test(instruction);
  if (unsafeIntent) {
    return {
      kind: "refused_unsafe_instruction",
      directive: null,
      target_file: null,
      reason:
        "the supplied task-level instruction attempts to override constitutional safety · " +
        "this planner NEVER accepts safety overrides at task-input time · founder authority only",
      taught_by: "master_ai_engineer",
      ignored_instruction: goal.instruction,
    };
  }

  // ── Guard 2 · Required goal fields ─────────────────────────────────
  const missing: string[] = [];
  if (!goal.type_name || goal.type_name.trim() === "") missing.push("type_name");
  if (!goal.concept || goal.concept.trim() === "") missing.push("concept");
  if (!goal.desired_kind && !goal.desired_type_text) missing.push("desired_kind or desired_type_text");
  if (missing.length > 0) {
    return refuse("refused_ambiguous", `underspecified goal · missing: ${missing.join(", ")} · NEX1 will not fabricate intent`, goal);
  }

  // ── Derive the concrete field_type from desired_kind/desired_type_text ─
  const fieldType = deriveFieldType(goal);
  if (fieldType === null) {
    return refuse(
      "refused_missing_field_type",
      `desired_kind='${goal.desired_kind}' requires an explicit desired_type_text (arrays/custom types cannot be assumed) · NEX1 will not fabricate a type`,
      goal,
    );
  }

  // ── Discovery · locate the declaring file(s) for the target type ───
  const discovery = discoverRelevantSources(goal.type_name!, scope);

  if (discovery.declaring_files.length === 0) {
    return refuse("refused_no_declaration", `no declaration of type '${goal.type_name}' found in the supplied scope`, goal);
  }

  // ── Guard · protected paths ────────────────────────────────────────
  const protectedHits = discovery.declaring_files.filter((f) => isProtectedPathRobust(f.path));
  if (protectedHits.length === discovery.declaring_files.length) {
    return {
      kind: "refused_protected_path",
      directive: null,
      target_file: protectedHits[0].path,
      reason: `every candidate declaring path for '${goal.type_name}' is protected · plan refused`,
      taught_by: "master_ai_engineer",
      considered_paths: protectedHits.map((f) => f.path),
      ignored_instruction: goal.instruction,
    };
  }

  // Filter out any protected candidates from further consideration
  const safeCandidates = discovery.declaring_files.filter((f) => !isProtectedPathRobust(f.path));

  // ── Duplicate-symbol resolution via consumer import chain ──────────
  let chosen: string | null = null;
  if (safeCandidates.length === 1) {
    chosen = safeCandidates[0].path;
  } else if (safeCandidates.length > 1) {
    // Use consumer-import resolution from Capability F: pick the declaring
    // path that at least one consumer's import resolves to.
    const consumerVotes = new Map<string, number>();
    for (const c of discovery.consuming_files) {
      if (c.matched_declaration_path && safeCandidates.some((s) => s.path === c.matched_declaration_path)) {
        consumerVotes.set(c.matched_declaration_path, (consumerVotes.get(c.matched_declaration_path) ?? 0) + 1);
      }
    }
    if (consumerVotes.size === 1) {
      chosen = Array.from(consumerVotes.keys())[0];
    } else if (consumerVotes.size > 1) {
      return {
        kind: "refused_duplicate_unresolved",
        directive: null,
        target_file: null,
        reason:
          `type '${goal.type_name}' has multiple declarations in the scope and consumers point to more than one · NEX1 will not choose without explicit disambiguation`,
        taught_by: "master_ai_engineer",
        considered_paths: safeCandidates.map((f) => f.path),
      };
    } else {
      return {
        kind: "refused_duplicate_unresolved",
        directive: null,
        target_file: null,
        reason:
          `type '${goal.type_name}' has multiple declarations in the scope and no consumer's import resolves to any of them · NEX1 will not choose`,
        taught_by: "master_ai_engineer",
        considered_paths: safeCandidates.map((f) => f.path),
      };
    }
  }

  if (chosen === null) {
    return refuse("refused_no_declaration", `no safe candidate found for '${goal.type_name}'`, goal);
  }

  // ── Compose the directive ──────────────────────────────────────────
  const directive: TemplateDirective = {
    kind: "add_interface_field",
    target_path: chosen.replace(/\\/g, "/"),
    target_interface: goal.type_name!,
    field_name: goal.concept!,
    field_type: fieldType,
  };
  return {
    kind: "planned",
    directive,
    target_file: chosen,
    reason: `planned add_interface_field(${goal.type_name}, ${goal.concept}, ${fieldType}) targeting ${chosen}`,
    taught_by: "master_ai_engineer",
    considered_paths: safeCandidates.map((f) => f.path),
  };
}

function deriveFieldType(goal: Nex1GoalRecord): string | null {
  if (goal.desired_type_text && goal.desired_type_text.trim().length > 0) {
    return goal.desired_type_text.trim();
  }
  switch (goal.desired_kind) {
    case "number":
      return "number";
    case "string":
      return "string";
    case "boolean":
      return "boolean";
    case "array":
    case "readonly_array":
    case "custom":
      return null;
    default:
      return null;
  }
}

function refuse(kind: Nex1PlanKind, reason: string, goal: Nex1GoalRecord): Nex1PlanResult {
  return {
    kind,
    directive: null,
    target_file: null,
    reason,
    taught_by: "master_ai_engineer",
    ignored_instruction: goal.instruction,
  };
}
