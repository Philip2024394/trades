// Orchestrator unit tests · pipeline planning, gate relevance, verdict
// aggregation, manifest lifecycle.

import { describe, it, expect, afterAll } from "vitest";
import { existsSync, rmSync } from "node:fs";
import * as path from "node:path";
import {
  createRun,
  loadManifest,
  planPipeline,
  computeRelevantGates,
  aggregateStageVerdict,
  publicManifestView,
} from "../orchestrator";
import type { AgentResult } from "../types";

const REPO_ROOT = process.cwd();
const CREATED_RUN_IDS: string[] = [];

afterAll(() => {
  for (const id of CREATED_RUN_IDS) {
    const p = path.join(REPO_ROOT, "data", "nex-coding-team", "runs", id);
    if (existsSync(p)) rmSync(p, { recursive: true, force: true });
  }
});

function fakeResult(verdict: AgentResult["verdict"], agent_id: AgentResult["agent_id"] = "pm"): AgentResult {
  return {
    agent_id,
    verdict,
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    duration_ms: 1,
    artifact_path: null,
    summary: "test",
    evidence: [],
    blockers: [],
    next_action: null,
    cycle_index: 0,
  };
}

describe("orchestrator · createRun / loadManifest", () => {
  it("creates a new run with a distinct id and a manifest on disk", () => {
    const m = createRun("test prompt");
    CREATED_RUN_IDS.push(m.run_id);
    expect(m.run_id).toMatch(/^run-/);
    expect(m.status).toBe("created");
    expect(m.artifacts_dir).toContain("data/nex-coding-team/runs/");
    const loaded = loadManifest(m.run_id);
    expect(loaded?.run_id).toBe(m.run_id);
  });

  it("initial agent_results has every agent as null", () => {
    const m = createRun("test 2");
    CREATED_RUN_IDS.push(m.run_id);
    for (const [id, r] of Object.entries(m.agent_results)) {
      expect(r, `agent ${id} should start null`).toBeNull();
    }
  });
});

describe("orchestrator · computeRelevantGates", () => {
  it("flags types_guard when spec mentions .ts", () => {
    const g = computeRelevantGates("touches src/lib/foo/index.ts");
    expect(g.types_guard).toBe(true);
  });

  it("flags migration_reviewer when spec mentions supabase/migrations", () => {
    const g = computeRelevantGates("adds supabase/migrations/20261001_new_table.sql");
    expect(g.migration_reviewer).toBe(true);
  });

  it("flags accessibility_reviewer when spec mentions .tsx", () => {
    const g = computeRelevantGates("edits src/app/page.tsx");
    expect(g.accessibility_reviewer).toBe(true);
  });

  it("flags contract_reviewer when spec mentions route.ts", () => {
    const g = computeRelevantGates("adds src/app/api/foo/route.ts");
    expect(g.contract_reviewer).toBe(true);
  });

  it("technical_writer + telemetry are always relevant", () => {
    const g = computeRelevantGates("");
    expect(g.technical_writer).toBe(true);
    expect(g.telemetry).toBe(true);
  });
});

describe("orchestrator · planPipeline", () => {
  it("always starts with PM then Architect", () => {
    const p = planPipeline({
      types_guard: false,
      migration_reviewer: false,
      accessibility_reviewer: false,
      contract_reviewer: false,
      technical_writer: true,
      telemetry: true,
    });
    expect(p[0]?.agents).toEqual(["pm"]);
    expect(p[1]?.agents).toEqual(["architect"]);
  });

  it("includes migration-reviewer in early gates when relevant", () => {
    const p = planPipeline({
      types_guard: false,
      migration_reviewer: true,
      accessibility_reviewer: false,
      contract_reviewer: false,
      technical_writer: true,
      telemetry: true,
    });
    const earlyGates = p.find((s) => s.stage_name === "3a-early-gates");
    expect(earlyGates?.agents).toContain("migration-reviewer");
  });

  it("always includes final integrate + post-merge stages", () => {
    const p = planPipeline({
      types_guard: false,
      migration_reviewer: false,
      accessibility_reviewer: false,
      contract_reviewer: false,
      technical_writer: true,
      telemetry: true,
    });
    const stageNames = p.map((s) => s.stage_name);
    expect(stageNames).toContain("7-integrate");
    expect(stageNames).toContain("8-post-merge");
  });
});

describe("orchestrator · aggregateStageVerdict", () => {
  it("empty results → PENDING", () => {
    expect(aggregateStageVerdict([])).toBe("PENDING");
  });

  it("all APPROVE → APPROVE", () => {
    expect(aggregateStageVerdict([fakeResult("APPROVE"), fakeResult("APPROVE_WITH_NOTES")])).toBe("APPROVE");
  });

  it("any REJECT → REJECT", () => {
    expect(aggregateStageVerdict([fakeResult("APPROVE"), fakeResult("REJECT")])).toBe("REJECT");
  });

  it("any FLAG → REJECT", () => {
    expect(aggregateStageVerdict([fakeResult("APPROVE"), fakeResult("FLAG")])).toBe("REJECT");
  });

  it("any ERROR → NEEDS_FOUNDER_INPUT", () => {
    expect(aggregateStageVerdict([fakeResult("APPROVE"), fakeResult("ERROR")])).toBe("NEEDS_FOUNDER_INPUT");
  });

  it("any NEEDS_FOUNDER_INPUT → NEEDS_FOUNDER_INPUT (regardless of others)", () => {
    expect(aggregateStageVerdict([fakeResult("APPROVE"), fakeResult("NEEDS_FOUNDER_INPUT")])).toBe("NEEDS_FOUNDER_INPUT");
  });

  it("SKIPPED_NOT_APPLICABLE counted as pass alongside APPROVE", () => {
    expect(aggregateStageVerdict([fakeResult("SKIPPED_NOT_APPLICABLE"), fakeResult("APPROVE")])).toBe("APPROVE");
  });
});

describe("orchestrator · publicManifestView", () => {
  it("collapses each agent to verdict + summary + blocker count · never leaks internal fields", () => {
    const m = createRun("view test");
    CREATED_RUN_IDS.push(m.run_id);
    const v = publicManifestView(m);
    expect(v.run_id).toBe(m.run_id);
    expect(v.agent_summary).toBeDefined();
    expect(Object.keys(v.agent_summary as object).length).toBe(15);
  });
});
