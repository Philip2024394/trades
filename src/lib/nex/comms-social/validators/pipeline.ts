// NEX Comms Centre · Social · validator pipeline orchestrator.
//
// Charter §S-VIII: Fact → Rights → Policy → Brand → Platform ·
// fail-closed on any stage · Rights + Policy re-check at T-adapter-call.
//
// The pipeline runs stages in strict fixed order. If a stage returns
// `reject` OR `fail_closed`, the pipeline terminates. Every run
// persists a row to nex.social_validator_runs and, when subject.draft_id
// is set, updates the draft's validator_run_id.

import { withTenantClient } from "../db";
import type { TenantId } from "../types";
import { createFactValidator } from "./fact";
import { createRightsValidator } from "./rights";
import { createPolicyValidator } from "./policy";
import { createBrandValidator } from "./brand";
import { createPlatformValidator } from "./platform";
import {
  DEFAULT_STAGE_TIMEOUTS_MS, VALIDATOR_STAGES,
  type PipelineRun, type SafetyValidator, type StageResult,
  type ValidatorStage, type ValidatorSubject,
} from "./interface";

// Adapter-call hook: Phase 4 worker calls this with re_check=true just
// before dispatching to the provider adapter. Only Rights + Policy
// re-run at this point (per charter). If either fails, publish aborts.
const RE_CHECK_STAGES: ReadonlySet<ValidatorStage> = new Set(["rights", "policy"]);

export interface RunPipelineInput {
  tenant_id:                 TenantId;
  subject:                   ValidatorSubject;
  subject_kind:              "draft" | "ad_hoc" | "at_adapter_call";
  stage_timeouts_ms?:        Partial<Record<ValidatorStage, number>>;
  re_check_at_adapter_call?: boolean;
}

export async function runValidatorPipeline(input: RunPipelineInput): Promise<PipelineRun> {
  const started_at_ms = Date.now();
  const started_at    = new Date(started_at_ms).toISOString();

  const stagesToRun: SafetyValidator[] = input.re_check_at_adapter_call
    ? [createRightsValidator(), createPolicyValidator()]
    : [createFactValidator(), createRightsValidator(), createPolicyValidator(), createBrandValidator(), createPlatformValidator()];

  const stageResults: StageResult[] = [];
  let final: "passed" | "rejected" | "failed_closed" = "passed";

  const runId = await withTenantClient(input.tenant_id, async (c) => {
    for (const v of stagesToRun) {
      // Defence in depth: even if a stage throws, treat as fail_closed.
      let sr: StageResult;
      try {
        sr = await v.run({
          client:                     c,
          subject:                    input.subject,
          timeout_ms:                 input.stage_timeouts_ms?.[v.stage] ?? DEFAULT_STAGE_TIMEOUTS_MS[v.stage],
          re_check_at_adapter_call:   input.re_check_at_adapter_call ?? false,
        });
      } catch (e) {
        sr = {
          stage: v.stage,
          outcome: "fail_closed",
          ms: 0,
          rejections: [],
          failed_closed_reason: e instanceof Error ? e.message : String(e),
        };
      }
      stageResults.push(sr);
      if (sr.outcome === "reject")       { final = "rejected"; break; }
      if (sr.outcome === "fail_closed")  { final = "failed_closed"; break; }
    }

    const completed_at_ms = Date.now();
    const total_ms = completed_at_ms - started_at_ms;
    const rejectionSummary = stageResults.flatMap((s) => s.rejections);

    // Persist run
    const insert = await c.query(
      `INSERT INTO nex.social_validator_runs
        (tenant_id, draft_id, subject, started_at, completed_at, total_ms, stages, outcome, rejection_summary)
       VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz, $6, $7::jsonb, $8, $9::jsonb)
       RETURNING run_id`,
      [
        input.tenant_id,
        input.subject.draft_id,
        input.subject_kind,
        started_at,
        new Date(completed_at_ms).toISOString(),
        total_ms,
        JSON.stringify(stageResults),
        final,
        JSON.stringify(rejectionSummary),
      ],
    );
    const new_run_id = String(insert.rows[0].run_id);

    // Update draft's latest validator_run_id if applicable
    if (input.subject.draft_id) {
      await c.query(
        `UPDATE nex.social_content_drafts SET validator_run_id = $1, updated_at = NOW()
          WHERE draft_id = $2`,
        [new_run_id, input.subject.draft_id],
      );
    }
    return new_run_id;
  });

  if (!runId) throw new Error("runValidatorPipeline: db unavailable");

  return {
    run_id:            runId,
    tenant_id:         input.tenant_id,
    draft_id:          input.subject.draft_id,
    subject:           input.subject_kind,
    started_at:        new Date(started_at_ms).toISOString(),
    completed_at:      new Date().toISOString(),
    total_ms:          Date.now() - started_at_ms,
    stages:            stageResults,
    outcome:           final,
    rejection_summary: stageResults.flatMap((s) => s.rejections),
  };
}

// Convenience for the Phase 4 worker (or Phase 3 tests): the at-adapter
// re-check runs only Rights + Policy.
export async function reCheckAtAdapterCall(
  tenant_id: TenantId,
  subject:   ValidatorSubject,
): Promise<PipelineRun> {
  return runValidatorPipeline({
    tenant_id,
    subject,
    subject_kind:             "at_adapter_call",
    re_check_at_adapter_call: true,
  });
}

// Expose the ordered stage list for tests / observability.
export { VALIDATOR_STAGES, RE_CHECK_STAGES };
