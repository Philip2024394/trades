// NEX App Builder · Chat · POST /api/nex-app-builder/build (Philip 2026-08-14).
//
// Runs the full orchestrator with Playwright QA on a customer's completed
// Blueprint. Returns:
//   - overall verdict (READY / PARTIAL / BLOCKED / FAILED)
//   - per-page assembly summary
//   - QA execution report (passes/fails/screenshots)
//   - provenance surface (what the customer must fix)
//
// Never fabricates. Never claims READY without a real orchestrator run.

import { NextResponse } from "next/server";
import { runBlueprintWorkers } from "@/lib/app-builder/workers/orchestrator";
import { toOperatorVerdicts } from "@/lib/app-builder/workers/verdict-surface";
import type { AppBlueprint } from "@/lib/app-builder/blueprint-schema";
import { join } from "node:path";

// Section registry must be populated before any Blueprint→pipeline assembly.
// Import once at module load — sections self-register on import.
import "@/lib/studio/sections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BuildBody = {
  blueprint: AppBlueprint;
  /** When true, run Playwright + screenshots. Off by default so plan-only builds are cheap. */
  executeQA?: boolean;
};

export async function POST(req: Request): Promise<Response> {
  let body: BuildBody;
  try {
    body = (await req.json()) as BuildBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  if (!body.blueprint || typeof body.blueprint !== "object") {
    return NextResponse.json({ ok: false, error: "missing-blueprint" }, { status: 400 });
  }

  // Screenshot dir · scoped by Blueprint id so different builds don't collide.
  const screenshotDir = join(
    process.cwd(),
    "tmp-nex-qa-screenshots-chat",
    body.blueprint.id ?? `build_${Date.now()}`
  );

  const result = await runBlueprintWorkers(body.blueprint, {
    executeQA: body.executeQA ?? true,
    screenshotDir
  });

  // Compact summary suitable for chat surface
  return NextResponse.json({
    ok: true,
    runId: result.runId,
    overall: result.overall,
    totalDurationMs: result.totalDurationMs,
    pages: Object.entries(result.assembly?.pages ?? {}).map(([id, layout]) => ({
      id,
      sectionCount: layout.sections.length
    })),
    qa: result.qaExecution
      ? {
          ran: result.qaExecution.ran,
          pass: result.qaExecution.pass,
          fail: result.qaExecution.fail,
          pending: result.qaExecution.pending,
          screenshots: result.qaExecution.screenshots.map((s) => ({
            pageId: s.pageId,
            viewport: s.viewport,
            url: `/api/nex-app-builder/screenshots/${encodeURIComponent(body.blueprint.id ?? "unknown")}/${encodeURIComponent(s.pageId + "__" + s.viewport + ".png")}`
          })),
          failures: result.qaExecution.updatedChecks
            .filter((c) => c.status === "FAIL")
            .slice(0, 20)
            .map((c) => ({ id: c.id, pageId: c.pageId, kind: c.kind, detail: c.evidence?.detail }))
        }
      : null,
    surface: result.workerReports.provenanceSurface?.data ?? null,
    // Phase 19C · UI-safe operator verdicts (8-state, per-worker).
    verdicts: toOperatorVerdicts(result)
  });
}
