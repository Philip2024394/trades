// NEX App Builder · Worker Orchestrator (Philip 2026-08-14).
//
// Runs the 6-worker DAG in order:
//   1. Validation (constitutional gate)
//   2. Data model
//   3. Integration
//   4. Design / image selection
//   5. Blueprint → pipeline adapter (existing · not a "worker" but part of the DAG)
//   6. Visual QA (plan-mode until Playwright runs the plan)
//   7. Provenance surface (aggregates every prior report)
//
// The orchestrator NEVER short-circuits on warnings — it collects every
// report and lets the Provenance Surface Worker produce the overall verdict.
// It DOES stop before running any downstream worker if validation FAILS
// (because subsequent workers reason about a valid Blueprint).

import type { AppBlueprint } from "../blueprint-schema";
import { assembleFromBlueprint, type BlueprintAssemblyResult } from "../blueprint-to-pipeline";
import type { WorkerContext, WorkerReport } from "./types";
import { runValidationWorker, type BlueprintValidationResult } from "./validation-worker";
import { runDataModelWorker, type DataModelPlan } from "./data-model-worker";
import { runIntegrationWorker, type IntegrationPlan } from "./integration-worker";
import { runDesignImageWorker, type DesignPlan } from "./design-image-worker";
import { runVisualQAWorker, type VisualQAPlan } from "./visual-qa-worker";
import { runProvenanceSurfaceWorker, type ProvenanceSurface } from "./provenance-surface-worker";
import { runQAPlanWithPlaywright, type PlaywrightRunReport } from "../qa/playwright-runner";

export type OrchestratorResult = {
  runId: string;
  ranAt: string;
  totalDurationMs: number;
  workerReports: {
    validation: WorkerReport<BlueprintValidationResult>;
    dataModel: WorkerReport<DataModelPlan> | null;
    integration: WorkerReport<IntegrationPlan> | null;
    design: WorkerReport<DesignPlan> | null;
    visualQA: WorkerReport<VisualQAPlan> | null;
    provenanceSurface: WorkerReport<ProvenanceSurface> | null;
  };
  /** The concrete assembled StudioLayoutJson per page (from the adapter). */
  assembly: BlueprintAssemblyResult | null;
  /** Optional Playwright execution report (populated when executeQA=true). */
  qaExecution: PlaywrightRunReport | null;
  /** Aggregated verdict. */
  overall: "READY" | "PARTIAL" | "BLOCKED" | "FAILED";
};

export type OrchestratorOptions = {
  /** When true and Playwright is installed, execute the QA plan against
   *  representative-rendered pages via headless Chromium. When false or
   *  Playwright missing, QA stays plan-only and checks remain PENDING. */
  executeQA?: boolean;
  /** Screenshot output directory (defaults to tmp-nex-qa-screenshots). */
  screenshotDir?: string;
};

export async function runBlueprintWorkers(
  bp: AppBlueprint,
  opts: OrchestratorOptions = {}
): Promise<OrchestratorResult> {
  const runId = `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const t0 = Date.now();
  const ctx: WorkerContext = { runId, blueprint: bp };

  // 1. Validation — CONSTITUTIONAL GATE
  const validation = runValidationWorker(ctx);
  if (validation.status === "failed") {
    return {
      runId,
      ranAt: new Date().toISOString(),
      totalDurationMs: Date.now() - t0,
      workerReports: {
        validation,
        dataModel: null,
        integration: null,
        design: null,
        visualQA: null,
        provenanceSurface: null
      },
      assembly: null,
      qaExecution: null,
      overall: "FAILED"
    };
  }

  // 2-4. Data model + Integration + Design/image run in parallel (independent)
  const [dataModel, integration, design] = await Promise.all([
    Promise.resolve(runDataModelWorker(ctx)),
    Promise.resolve(runIntegrationWorker(ctx)),
    runDesignImageWorker(ctx)
  ]);

  // 5. Assemble via existing pipeline adapter (proven in Phase 6 · 43/43)
  const assembly = assembleFromBlueprint(bp);

  // 6. Visual QA — always plan against the real assembly
  const visualQA = runVisualQAWorker(ctx, { assembledLayouts: assembly.pages });

  // 6b. If executeQA requested, run the plan through headless Chromium.
  // Constitutional rule: Playwright unavailable → PENDING (never PASS).
  let qaExecution: PlaywrightRunReport | null = null;
  if (opts.executeQA) {
    qaExecution = await runQAPlanWithPlaywright(bp, assembly.pages, visualQA.data, {
      screenshotDir: opts.screenshotDir
    });
    // Merge executed check statuses back into the plan report — this is
    // the ONLY place PENDING may become PASS or FAIL.
    if (qaExecution.ran) {
      visualQA.data.checks = qaExecution.updatedChecks;
      visualQA.data.totals = {
        total: qaExecution.totalChecks,
        pending: qaExecution.pending,
        pass: qaExecution.pass,
        fail: qaExecution.fail,
        skip: 0
      };
    }
  }

  // 7. Provenance surface — aggregates every report into the operator-visible status
  const provenanceSurface = runProvenanceSurfaceWorker(ctx, {
    validation,
    dataModel,
    integration,
    design,
    visualQA
  });

  const overall: OrchestratorResult["overall"] =
    provenanceSurface.data.overall === "READY" ? "READY"
      : provenanceSurface.data.overall === "PARTIAL" ? "PARTIAL"
      : "BLOCKED";

  return {
    runId,
    ranAt: new Date().toISOString(),
    totalDurationMs: Date.now() - t0,
    workerReports: {
      validation,
      dataModel,
      integration,
      design,
      visualQA,
      provenanceSurface
    },
    assembly,
    qaExecution,
    overall
  };
}
