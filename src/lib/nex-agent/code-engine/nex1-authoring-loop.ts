// src/lib/nex-agent/code-engine/nex1-authoring-loop.ts
//
// NEX1's owned programming loop. Amendment 1: every step is NEX1's decision.
// The adapter is invoked only for the code-proposal sub-step and its output is
// evaluated by NEX1 before anything is written anywhere.
//
// Sprint 1 · deterministic path only · template-only adapter · no LLM · no
// network. Files are proposed to an in-memory map · nothing lands on disk from
// this loop itself. A separate step (nex1-first-task runner) writes the
// verified diff after all checks pass, respecting worktree discipline.

import { randomUUID } from "node:crypto";
import type {
  Nex1IntentKind,
  Nex1ReasoningRequest,
  TemplateDirective,
} from "./types";
import { NEX1_ENGINE_ERRORS } from "./types";
import { Nex1ReasoningRegistry, nex1InvokeAdapter } from "./registry";
import { buildContext, sha256 } from "./context-builder";
import { normaliseDiff, applyWholeFileDiff } from "./diff-normaliser";
import { enforceScope } from "./scope-enforcer";
import { Nex1DecisionTrailBuilder } from "./nex1-decision-trail";
import { recordProvenance, type Nex1AttemptProvenance } from "./provenance-recorder";
import { appendAudit } from "./audit";

export interface Nex1TaskInput {
  readonly task_prompt: string;
  readonly intent: Nex1IntentKind;
  readonly declared_scope: readonly string[];
  readonly template_directive: TemplateDirective;
  readonly relevant_adrs?: readonly string[];
}

export interface Nex1TaskOutput {
  readonly ok: boolean;
  readonly task_id: string;
  readonly attempt_id: string;
  readonly reason?: string;
  readonly failure_code?: string;
  readonly proposed_diff?: string;
  readonly applied_files?: Record<string, string>;
  readonly provenance?: Nex1AttemptProvenance;
}

/**
 * @summary Run NEX1's owned programming loop for a single task via the given adapter registry.
 */
export async function runNex1AuthoringLoop(
  registry: Nex1ReasoningRegistry,
  input: Nex1TaskInput,
): Promise<Nex1TaskOutput> {
  const task_id = randomUUID();
  const attempt_id = randomUUID();
  const startedAt = Date.now();
  const trail = new Nex1DecisionTrailBuilder();

  // (1) NEX1 interprets the task
  const promptHash = sha256(input.task_prompt);
  trail.interpretTask(promptHash);

  // (2) NEX1 inspects the repository via context-builder (allowlist-scoped)
  trail.selectFiles(input.declared_scope);
  const ctxRes = buildContext({
    taskPrompt: input.task_prompt,
    declaredScope: input.declared_scope,
    relevantAdrs: input.relevant_adrs,
  });
  if (!ctxRes.ok || !ctxRes.context) {
    audit(task_id, attempt_id, "template-only", "fail", Date.now() - startedAt, 0, ctxRes.reason);
    return { ok: false, task_id, attempt_id, reason: ctxRes.reason, failure_code: NEX1_ENGINE_ERRORS.context_leak };
  }
  trail.composeContext(ctxRes.context.repo_snapshot_hash);

  // (3, 4) NEX1 composes the reasoning request and invokes an adapter for candidate diff
  const req: Nex1ReasoningRequest = {
    task_id,
    attempt_id,
    intent: input.intent,
    context: ctxRes.context,
    output_kind: "diff",
    template_directive: input.template_directive,
  };
  const resp = await nex1InvokeAdapter(registry, req);
  if (!resp.ok) {
    trail.acceptCandidate(false);
    audit(task_id, attempt_id, "unknown", "fail", Date.now() - startedAt, 0, resp.reason);
    return { ok: false, task_id, attempt_id, reason: resp.reason, failure_code: resp.code };
  }

  // (5) NEX1 evaluates the diff · normalise + scope
  const norm = normaliseDiff(resp.result.proposed_diff);
  if (!norm.ok) {
    trail.acceptCandidate(false);
    trail.evaluateDiff("failed");
    audit(task_id, attempt_id, resp.result.adapter_id, "fail", Date.now() - startedAt, 0, norm.reason);
    return { ok: false, task_id, attempt_id, reason: norm.reason, failure_code: NEX1_ENGINE_ERRORS.diff_malformed };
  }
  const scope = enforceScope(resp.result.proposed_diff, input.declared_scope);
  if (!scope.ok) {
    trail.acceptCandidate(false);
    trail.evaluateDiff("failed");
    audit(task_id, attempt_id, resp.result.adapter_id, "fail", Date.now() - startedAt, 0, `${scope.violation}:${scope.violated_path}`);
    return {
      ok: false,
      task_id,
      attempt_id,
      reason: `scope violation on ${scope.violated_path}`,
      failure_code: NEX1_ENGINE_ERRORS.scope_violation,
    };
  }
  // NEX1 accepts the candidate
  trail.acceptCandidate(true);
  trail.evaluateDiff("passed");

  // (6, 7, 8) test / diagnosis / repair happen OUTSIDE this in-memory loop · in Sprint 1 we return the applied file map for the caller (nex1-first-task runner) to actually write + test + verify
  const applied = applyWholeFileDiff(resp.result.proposed_diff);
  const appliedObj: Record<string, string> = {};
  for (const [k, v] of applied.entries()) appliedObj[k] = v;

  // (9) NEX1 records evidence
  trail.recordEvidence();

  // (10) NEX1 decides completion (of the authoring step · the caller decides real-world commit)
  trail.decideCompletion();

  const provenance = recordProvenance({
    taskId: task_id,
    attemptId: attempt_id,
    promptHash,
    contextHash: ctxRes.context.repo_snapshot_hash,
    result: resp.result,
    trail: trail.build(),
  });

  audit(task_id, attempt_id, resp.result.adapter_id, "ok", Date.now() - startedAt, provenance.diff_size_lines);
  return {
    ok: true,
    task_id,
    attempt_id,
    proposed_diff: resp.result.proposed_diff,
    applied_files: appliedObj,
    provenance,
  };
}

function audit(taskId: string, attemptId: string, adapterId: string, outcome: "ok" | "fail", ms: number, lines: number, failReason?: string): void {
  try {
    appendAudit({
      at: new Date().toISOString(),
      task_id: taskId,
      attempt_id: attemptId,
      adapter_id: adapterId,
      outcome,
      duration_ms: ms,
      diff_size_lines: lines,
      network_calls: 0,
      fail_reason: failReason,
      attempted_by: "nex1",
    });
  } catch { /* audit-write failures never break the engine */ }
}
