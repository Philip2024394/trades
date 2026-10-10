// NEX Coding Team · Orchestrator
// Sequential + parallel pipeline that dispatches the 15 agents in professional order,
// enforces gates, records artifacts, and stops honestly on any failure.
//
// This module is the CONTRACT layer. Actual agent dispatch happens via the
// `dispatch-agent.ts` runtime — this file only defines the pipeline shape,
// per-stage input assembly, and gate aggregation.

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import * as path from "node:path";
import type {
  AgentId,
  AgentResult,
  AgentVerdict,
  CodingRunManifest,
  DispatchRequest,
  PipelineStatus,
  RelevantGates,
} from "./types";
import { ALL_AGENT_IDS } from "./types";

const REPO_ROOT = process.cwd(); // Next.js runs from repo root
const RUNS_DIR = path.join(REPO_ROOT, "data", "nex-coding-team", "runs");

/** Create a fresh run directory and initial manifest. Idempotent per run_id. */
export function createRun(founderPrompt: string): CodingRunManifest {
  const run_id = `run-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const artifacts_dir = path.join(RUNS_DIR, run_id);
  if (!existsSync(artifacts_dir)) mkdirSync(artifacts_dir, { recursive: true });

  const empty_results: Record<AgentId, AgentResult | null> = {} as Record<AgentId, AgentResult | null>;
  for (const id of ALL_AGENT_IDS) empty_results[id] = null;

  const manifest: CodingRunManifest = {
    run_id,
    founder_prompt: founderPrompt,
    created_at: new Date().toISOString(),
    status: "created",
    current_stage: null,
    agent_results: empty_results,
    artifacts_dir: path.relative(REPO_ROOT, artifacts_dir).replace(/\\/g, "/"),
    commit_sha: null,
    rollback_command: null,
    governance_state: {
      v3_registry_frozen: true,
      historical_receipts_intact: true,
      protected_files_untouched: [],
    },
  };
  saveManifest(manifest);
  writeFileSync(path.join(artifacts_dir, "founder-prompt.txt"), founderPrompt, "utf8");
  return manifest;
}

export function saveManifest(m: CodingRunManifest): void {
  const p = path.join(RUNS_DIR, m.run_id, "manifest.json");
  writeFileSync(p, JSON.stringify(m, null, 2), "utf8");
}

export function loadManifest(run_id: string): CodingRunManifest | null {
  const p = path.join(RUNS_DIR, run_id, "manifest.json");
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as CodingRunManifest;
}

/** Inspect the spec output (once written by Architect) to decide which gates apply. */
export function computeRelevantGates(specText: string): RelevantGates {
  const specLower = specText.toLowerCase();
  const touches_ts = /\.tsx?\b/.test(specText) || /\btypescript\b/i.test(specText);
  const touches_migration = /supabase\/migrations|migration_notes|schema change/i.test(specText);
  const touches_ui = /\.tsx\b|\.jsx\b|component|page\.tsx|button|form|modal|role="/i.test(specText);
  const touches_api = /route\.ts|api\/|contract_impact|export function|export const/i.test(specText);
  return {
    types_guard: touches_ts,
    migration_reviewer: touches_migration,
    accessibility_reviewer: touches_ui,
    contract_reviewer: touches_api,
    technical_writer: true,
    telemetry: true,
  };
}

/** Pipeline stage plan · determines which agents run and in what order. */
export interface StagePlan {
  readonly stage_name: string;
  readonly agents: readonly AgentId[]; // agents that run in parallel within this stage
  readonly on_verdict: {
    readonly all_approve: "advance" | "complete";
    readonly any_reject: "halt" | "back_to" | "escalate_founder";
    readonly back_to_target?: AgentId; // for cycles like Debugger → Tester → Reviewer
  };
}

export function planPipeline(gates: RelevantGates): readonly StagePlan[] {
  const plan: StagePlan[] = [];

  // Stage 1 · PM
  plan.push({
    stage_name: "1-ingest",
    agents: ["pm"],
    on_verdict: { all_approve: "advance", any_reject: "escalate_founder" },
  });

  // Stage 2 · Architect
  plan.push({
    stage_name: "2-design",
    agents: ["architect"],
    on_verdict: { all_approve: "advance", any_reject: "escalate_founder" },
  });

  // Stage 3 · early gates that can run in parallel with Builder to catch spec-time issues
  const early_gate_agents: AgentId[] = [];
  if (gates.migration_reviewer) early_gate_agents.push("migration-reviewer");
  if (gates.accessibility_reviewer) early_gate_agents.push("accessibility-reviewer");
  if (gates.contract_reviewer) early_gate_agents.push("contract-reviewer");
  if (early_gate_agents.length > 0) {
    plan.push({
      stage_name: "3a-early-gates",
      agents: early_gate_agents,
      on_verdict: { all_approve: "advance", any_reject: "back_to", back_to_target: "architect" },
    });
  }

  // Stage 3b · Builder + Tester in parallel · they consume the same spec
  plan.push({
    stage_name: "3b-build-and-test",
    agents: ["builder", "tester"],
    on_verdict: { all_approve: "advance", any_reject: "back_to", back_to_target: "architect" },
  });

  // Stage 4 · test execution + type checking · gate before Reviewer
  const stage4_agents: AgentId[] = [];
  if (gates.types_guard) stage4_agents.push("types-guard");
  // Note: test execution is a runner (not an agent per se); orchestrator handles it and
  // routes to Debugger on failure.
  if (stage4_agents.length > 0) {
    plan.push({
      stage_name: "4-verify",
      agents: stage4_agents,
      on_verdict: { all_approve: "advance", any_reject: "back_to", back_to_target: "builder" },
    });
  }

  // Stage 5 · Reviewer
  plan.push({
    stage_name: "5-review",
    agents: ["reviewer"],
    on_verdict: { all_approve: "advance", any_reject: "back_to", back_to_target: "builder" },
  });

  // Stage 6 · Forensics + SecOps in parallel
  plan.push({
    stage_name: "6-audit",
    agents: ["forensics", "secops"],
    on_verdict: { all_approve: "advance", any_reject: "halt" },
  });

  // Stage 7 · Integrator
  plan.push({
    stage_name: "7-integrate",
    agents: ["integrator"],
    on_verdict: { all_approve: "advance", any_reject: "halt" },
  });

  // Stage 8 · post-merge parallel: Technical Writer + Telemetry
  plan.push({
    stage_name: "8-post-merge",
    agents: ["technical-writer", "telemetry"],
    on_verdict: { all_approve: "complete", any_reject: "escalate_founder" },
  });

  return plan;
}

/** Aggregate the verdicts of parallel agents within one stage. */
export function aggregateStageVerdict(
  results: readonly AgentResult[],
): "APPROVE" | "REJECT" | "FLAG" | "NEEDS_FOUNDER_INPUT" | "PENDING" {
  if (results.length === 0) return "PENDING";
  if (results.some((r) => r.verdict === "ERROR" || r.verdict === "NEEDS_FOUNDER_INPUT")) {
    return "NEEDS_FOUNDER_INPUT";
  }
  if (results.some((r) => r.verdict === "REJECT" || r.verdict === "FLAG")) {
    return "REJECT";
  }
  if (results.every((r) => r.verdict === "APPROVE" || r.verdict === "APPROVE_WITH_NOTES" || r.verdict === "SKIPPED_NOT_APPLICABLE")) {
    return "APPROVE";
  }
  return "PENDING";
}

/** Public status transitions the API surface exposes. Never mutate manifest directly. */
export function transitionStatus(m: CodingRunManifest, next: PipelineStatus): CodingRunManifest {
  const updated: CodingRunManifest = { ...m, status: next };
  saveManifest(updated);
  return updated;
}

/** Convenience for API: return the manifest's public view. */
export function publicManifestView(m: CodingRunManifest): Record<string, unknown> {
  return {
    run_id: m.run_id,
    founder_prompt: m.founder_prompt,
    created_at: m.created_at,
    status: m.status,
    current_stage: m.current_stage,
    agent_summary: Object.fromEntries(
      Object.entries(m.agent_results).map(([id, r]) => [
        id,
        r ? { verdict: r.verdict, summary: r.summary, blockers: r.blockers.length } : null,
      ]),
    ),
    artifacts_dir: m.artifacts_dir,
    commit_sha: m.commit_sha,
    rollback_command: m.rollback_command,
  };
}
