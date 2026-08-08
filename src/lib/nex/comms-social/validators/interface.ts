// NEX Comms Centre · Social · validator interface.
//
// Charter §S-VIII: five stages · fail-closed · Rights + Policy re-check
// at T-adapter-call. The interface below is stage-agnostic; each stage
// implements it, and the pipeline orchestrator calls them in fixed
// order.
//
// Fail-closed contract:
//   * `outcome='pass'`  → move to next stage.
//   * `outcome='reject'` → terminate pipeline · draft state 'rejected'.
//   * `outcome='fail_closed'` → terminate pipeline · draft state
//     'rejected' AND run.outcome='failed_closed' (distinct from a merit
//     rejection so audit can distinguish "policy said no" from "we
//     couldn't decide"). Timeouts · exceptions · missing configuration
//     all resolve to 'fail_closed'.

import type { PgClientLike } from "@/lib/nex/db";
import type { TenantId } from "../types";
import type { ContentDraft } from "../content/types";

// ── Stage identity ─────────────────────────────────────────────
export const VALIDATOR_STAGES = ["fact", "rights", "policy", "brand", "platform"] as const;
export type ValidatorStage = typeof VALIDATOR_STAGES[number];

// ── Subject shape ──────────────────────────────────────────────
//
// Validators operate on a normalized snapshot of the draft — never on
// arbitrary text. The snapshot is what the generator produced (or, in
// re-check mode, what was fetched from the DB immediately before an
// adapter call).
export interface ValidatorSubject {
  tenant_id:    TenantId;
  draft_id:     string | null;              // null for ad-hoc validation (dev/admin probe)
  platform:     string;
  caption:      string;
  hashtags:     string[];
  cta:          string | null;
  source_refs:  string[];
  provenance:   Record<string, { source_id: string; source_kind: string; source_path: string; value: string }>;
  claims:       ContentDraft["claims"];
}

// ── Stage result ───────────────────────────────────────────────
export interface StageRejection {
  code:              string;
  detail:            string;
  offending_claim?:  string;
  stage_specific?:   Record<string, unknown>;
}

export type StageOutcome = "pass" | "reject" | "fail_closed";

export interface StageResult {
  stage:            ValidatorStage;
  outcome:          StageOutcome;
  ms:               number;
  detail?:          string;
  rejections:       StageRejection[];
  failed_closed_reason?: string;
}

// ── Validator ─────────────────────────────────────────────────
export interface SafetyValidator {
  readonly stage: ValidatorStage;
  /**
   * MUST return within `timeout_ms`. If the implementation cannot make
   * a determination in time it MUST return outcome='fail_closed' with
   * a `failed_closed_reason`. Throwing from run() is treated by the
   * pipeline as fail_closed too (defence in depth).
   */
  run(input: {
    client:     PgClientLike;
    subject:    ValidatorSubject;
    timeout_ms: number;
    /**
     * When true, the stage runs its at-adapter-call check (subset of
     * responsibilities: Rights + Policy re-verify against current state).
     * Other stages MAY treat this as a hint or ignore it.
     */
    re_check_at_adapter_call?: boolean;
  }): Promise<StageResult>;
}

// ── Runner outcome ────────────────────────────────────────────
export interface PipelineRun {
  run_id:            string;
  tenant_id:         TenantId;
  draft_id:          string | null;
  subject:           "draft" | "ad_hoc" | "at_adapter_call";
  started_at:        string;
  completed_at:      string;
  total_ms:          number;
  stages:            StageResult[];
  outcome:           "passed" | "rejected" | "failed_closed";
  rejection_summary: StageRejection[];
}

// Default per-stage timeouts. Individual pipeline calls can override.
export const DEFAULT_STAGE_TIMEOUTS_MS: Record<ValidatorStage, number> = {
  fact:      2_000,
  rights:    1_500,
  policy:    1_000,
  brand:     1_000,
  platform:    500,
};
