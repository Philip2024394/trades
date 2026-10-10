// src/lib/nex-agent/code-engine/capability-verify-project-resolver.ts
//
// NEX1 · Verify → Project workspace resolver · Founder-authorised 2026-09-19
// Ledger B additive · Zero LLM · Deterministic
//
// PURPOSE
//   Pure function that decides where `runTypecheck/runLint/runTests`
//   should execute given a verify request. Extracts and encapsulates the
//   Project-binding logic so the /api/nex/agent/verify route can consume
//   it and unit tests can exercise it without spawning processes or
//   touching Postgres.
//
// ARCHITECTURE
//   Two truthful outcomes:
//     · PROJECT_BOUND · returns project.workspace_root as cwd
//     · LEGACY_INFRASTRUCTURE · returns cwd=null · caller runs against
//       NEX repo default (existing v1.2 baseline verification behaviour)
//
//   Three refusal outcomes:
//     · NOT_AVAILABLE / AMBIGUOUS / INVALID · all HTTP 409 in the route
//
// FOUNDER RULES HONOURED
//   · Rule 6 · resolver identifies · does not authorise execution
//   · Anti-fabrication · workspace_root comes from the canonical registry
//   · Legacy preservation · unbound tasks keep working without change
//   · Never returns process.cwd() as a "Project workspace"

import {
  resolveActiveProject,
  type NexProjectRecord,
} from "./capability-nex-project-registry";
import { getProjectForTask } from "./capability-task-project-binding";

export type VerifyResolutionOutcome =
  | {
      readonly outcome: "PROJECT_BOUND";
      readonly project_id: string;
      readonly project_name: string;
      readonly project_slug: string;
      readonly workspace_root: string;   // absolute · sanctioned · never process.cwd()
      readonly source: "explicit_hint" | "task_binding";
    }
  | {
      readonly outcome: "LEGACY_INFRASTRUCTURE";
      readonly reason: "no_project_hint_and_no_task_binding";
    }
  | {
      readonly outcome: "NOT_AVAILABLE";
      readonly reason: string;
      readonly attempted_project_id: string | null;
    }
  | {
      readonly outcome: "AMBIGUOUS";
      readonly reason: string;
      readonly candidates: readonly {
        readonly project_id: string;
        readonly project_name: string;
        readonly project_slug: string;
      }[];
    }
  | {
      readonly outcome: "INVALID";
      readonly project_id: string;
      readonly reason: string;
    };

export interface VerifyResolverInput {
  readonly active_project_id: string | null;
  readonly task_id: string | null;
}

export interface VerifyResolverDeps {
  readonly resolveActiveProject?: typeof resolveActiveProject;
  readonly getProjectForTask?: typeof getProjectForTask;
}

// ── Public entry ────────────────────────────────────────────────────────

export function resolveVerifyWorkspace(
  input: VerifyResolverInput,
  deps: VerifyResolverDeps = {},
): VerifyResolutionOutcome {
  const resolve = deps.resolveActiveProject ?? resolveActiveProject;
  const getBound = deps.getProjectForTask ?? getProjectForTask;

  // 1. Determine effective project_id from explicit hint OR task binding.
  //    Explicit active_project_id takes precedence over task_id-derived
  //    binding because the caller has explicitly stated the target.
  let effectiveId: string | null = null;
  let source: "explicit_hint" | "task_binding" = "explicit_hint";

  if (input.active_project_id && input.active_project_id.trim().length > 0) {
    effectiveId = input.active_project_id.trim();
    source = "explicit_hint";
  } else if (input.task_id && input.task_id.trim().length > 0) {
    const bound = getBound(input.task_id.trim());
    if (bound) {
      effectiveId = bound;
      source = "task_binding";
    }
  }

  // 2. If no effective id, this is a legacy/infrastructure verify.
  //    Preserve existing behaviour · caller runs against NEX repo.
  if (effectiveId === null) {
    return {
      outcome: "LEGACY_INFRASTRUCTURE",
      reason: "no_project_hint_and_no_task_binding",
    };
  }

  // 3. Resolve through the canonical registry.
  const r = resolve({ active_project_id: effectiveId });
  if (r.status === "NOT_AVAILABLE") {
    return { outcome: "NOT_AVAILABLE", reason: r.reason, attempted_project_id: effectiveId };
  }
  if (r.status === "AMBIGUOUS") {
    return {
      outcome: "AMBIGUOUS",
      reason: r.reason,
      candidates: r.candidates.map((c: NexProjectRecord) => ({
        project_id: c.project_id,
        project_name: c.project_name,
        project_slug: c.project_slug,
      })),
    };
  }
  if (r.status === "INVALID") {
    return { outcome: "INVALID", project_id: r.project_id, reason: r.reason };
  }

  // 4. RESOLVED · Project workspace is the truthful cwd for verification.
  return {
    outcome: "PROJECT_BOUND",
    project_id: r.project.project_id,
    project_name: r.project.project_name,
    project_slug: r.project.project_slug,
    workspace_root: r.project.workspace_root,
    source,
  };
}
