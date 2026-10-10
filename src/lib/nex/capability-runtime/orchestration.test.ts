// src/lib/nex/capability-runtime/orchestration.test.ts
//
// Stage 13 acceptance · Goal / Workflow / Schedule contracts.
// §18 no-fake-completeness: the concrete scaffolding orbit MUST reference
// only real capabilities · a real activation env flag · sensible metric.

import { describe, it, expect } from "vitest";
import { KNOWN_CAPABILITIES } from "./contract";
import { KNOWN_EXECUTION_LEVELS } from "./execution-level";
import {
  SCAFFOLDING_HARVEST_GOAL,
  SCAFFOLDING_HARVEST_WORKFLOW,
  SCAFFOLDING_HARVEST_SCHEDULE,
  validateGoal,
  validateWorkflow,
  validateSchedule,
  type Goal,
  type Workflow,
  type Schedule,
} from "./orchestration";

describe("Goal contract · Stage 13", () => {
  it("SCAFFOLDING_HARVEST_GOAL is valid", () => {
    const v = validateGoal(SCAFFOLDING_HARVEST_GOAL);
    expect(v.ok).toBe(true);
    expect(v.problems).toEqual([]);
  });

  it("goal countries_in_scope covers 6 regions (Europe, N.America, S.America, Asia, Oceania, Africa)", () => {
    const c = SCAFFOLDING_HARVEST_GOAL.countries_in_scope;
    expect(c).toContain("GB");
    expect(c).toContain("US");
    expect(c).toContain("BR");
    expect(c).toContain("JP");
    expect(c).toContain("AU");
    expect(c).toContain("ZA");
  });

  it("goal execution_level is a valid ExecutionLevel", () => {
    expect(KNOWN_EXECUTION_LEVELS).toContain(SCAFFOLDING_HARVEST_GOAL.execution_level);
  });

  it("validateGoal rejects empty countries_in_scope", () => {
    const bad: Goal = { ...SCAFFOLDING_HARVEST_GOAL, countries_in_scope: [] };
    const v = validateGoal(bad);
    expect(v.ok).toBe(false);
    expect(v.problems.join(",")).toContain("countries_in_scope_empty");
  });

  it("validateGoal rejects empty categories_in_scope", () => {
    const bad: Goal = { ...SCAFFOLDING_HARVEST_GOAL, categories_in_scope: [] };
    const v = validateGoal(bad);
    expect(v.ok).toBe(false);
    expect(v.problems.join(",")).toContain("categories_in_scope_empty");
  });

  it("validateGoal rejects too-short outcome description", () => {
    const bad: Goal = { ...SCAFFOLDING_HARVEST_GOAL, outcome: "short" };
    const v = validateGoal(bad);
    expect(v.ok).toBe(false);
    expect(v.problems.join(",")).toContain("outcome_description_too_short");
  });
});

describe("Workflow contract · Stage 13", () => {
  it("SCAFFOLDING_HARVEST_WORKFLOW is valid against KNOWN_CAPABILITIES", () => {
    const v = validateWorkflow(SCAFFOLDING_HARVEST_WORKFLOW, KNOWN_CAPABILITIES);
    expect(v.ok).toBe(true);
    expect(v.problems).toEqual([]);
  });

  it("workflow references the concrete goal_id", () => {
    expect(SCAFFOLDING_HARVEST_WORKFLOW.goal_id).toBe(SCAFFOLDING_HARVEST_GOAL.goal_id);
  });

  it("every step's capability is a real KNOWN_CAPABILITIES value", () => {
    for (const s of SCAFFOLDING_HARVEST_WORKFLOW.steps) {
      expect(KNOWN_CAPABILITIES).toContain(s.capability);
    }
  });

  it("step ordinals are strictly 1..N in order", () => {
    for (let i = 0; i < SCAFFOLDING_HARVEST_WORKFLOW.steps.length; i++) {
      expect(SCAFFOLDING_HARVEST_WORKFLOW.steps[i].ordinal).toBe(i + 1);
    }
  });

  it("workflow has at least 5 steps (real orbit is not a trivial one-shot)", () => {
    expect(SCAFFOLDING_HARVEST_WORKFLOW.steps.length).toBeGreaterThanOrEqual(5);
  });

  it("validateWorkflow rejects a workflow with unknown capability", () => {
    const bad: Workflow = {
      ...SCAFFOLDING_HARVEST_WORKFLOW,
      steps: [
        { step_id: "s1", capability: "not_a_capability" as never, rationale: "test", ordinal: 1 },
      ],
    };
    const v = validateWorkflow(bad, KNOWN_CAPABILITIES);
    expect(v.ok).toBe(false);
    expect(v.problems.some((p) => p.includes("unknown capability"))).toBe(true);
  });

  it("validateWorkflow rejects out-of-order ordinals", () => {
    const bad: Workflow = {
      ...SCAFFOLDING_HARVEST_WORKFLOW,
      steps: [
        { step_id: "s1", capability: "source_probe", rationale: "x", ordinal: 5 },
        { step_id: "s2", capability: "website_walk", rationale: "x", ordinal: 6 },
      ],
    };
    const v = validateWorkflow(bad, KNOWN_CAPABILITIES);
    expect(v.ok).toBe(false);
    expect(v.problems.some((p) => p.includes("ordinal"))).toBe(true);
  });

  it("validateWorkflow rejects empty steps", () => {
    const bad: Workflow = { ...SCAFFOLDING_HARVEST_WORKFLOW, steps: [] };
    const v = validateWorkflow(bad, KNOWN_CAPABILITIES);
    expect(v.ok).toBe(false);
    expect(v.problems).toContain("workflow_has_no_steps");
  });
});

describe("Schedule contract · Stage 13", () => {
  it("SCAFFOLDING_HARVEST_SCHEDULE is valid", () => {
    const v = validateSchedule(SCAFFOLDING_HARVEST_SCHEDULE);
    expect(v.ok).toBe(true);
    expect(v.problems).toEqual([]);
  });

  it("schedule references the concrete workflow_id", () => {
    expect(SCAFFOLDING_HARVEST_SCHEDULE.workflow_id).toBe(SCAFFOLDING_HARVEST_WORKFLOW.workflow_id);
  });

  it("cadence is cron_gated with the real activation env flag", () => {
    expect(SCAFFOLDING_HARVEST_SCHEDULE.cadence.kind).toBe("cron_gated");
    if (SCAFFOLDING_HARVEST_SCHEDULE.cadence.kind === "cron_gated") {
      expect(SCAFFOLDING_HARVEST_SCHEDULE.cadence.env_flag).toBe("NEX_DISCOVERY_CRON_ACTIVATION");
      expect(SCAFFOLDING_HARVEST_SCHEDULE.cadence.interval_seconds).toBeGreaterThan(0);
    }
  });

  it("asia_last is true (mirrors real country scheduler hard-lock)", () => {
    expect(SCAFFOLDING_HARVEST_SCHEDULE.asia_last).toBe(true);
  });

  it("dormancy_env_flag matches the cron activation env", () => {
    expect(SCAFFOLDING_HARVEST_SCHEDULE.dormancy_env_flag).toBe("NEX_DISCOVERY_CRON_ACTIVATION");
  });

  it("validateSchedule rejects cron_gated cadence with zero interval", () => {
    const bad: Schedule = {
      ...SCAFFOLDING_HARVEST_SCHEDULE,
      cadence: { kind: "cron_gated", interval_seconds: 0, env_flag: "X" },
    };
    const v = validateSchedule(bad);
    expect(v.ok).toBe(false);
    expect(v.problems.some((p) => p.includes("interval_seconds"))).toBe(true);
  });

  it("validateSchedule rejects cron_gated cadence with empty env_flag", () => {
    const bad: Schedule = {
      ...SCAFFOLDING_HARVEST_SCHEDULE,
      cadence: { kind: "cron_gated", interval_seconds: 300, env_flag: "" },
    };
    const v = validateSchedule(bad);
    expect(v.ok).toBe(false);
    expect(v.problems.some((p) => p.includes("env_flag"))).toBe(true);
  });

  it("supports manual cadence", () => {
    const s: Schedule = {
      ...SCAFFOLDING_HARVEST_SCHEDULE,
      cadence: { kind: "manual" },
    };
    expect(validateSchedule(s).ok).toBe(true);
  });

  it("supports event_triggered cadence", () => {
    const s: Schedule = {
      ...SCAFFOLDING_HARVEST_SCHEDULE,
      cadence: { kind: "event_triggered", trigger_event_domain: "cycle" },
    };
    expect(validateSchedule(s).ok).toBe(true);
  });
});

describe("Goal + Workflow + Schedule composition · Stage 13", () => {
  it("goal → workflow → schedule references form a chain (each references the next up)", () => {
    expect(SCAFFOLDING_HARVEST_WORKFLOW.goal_id).toBe(SCAFFOLDING_HARVEST_GOAL.goal_id);
    expect(SCAFFOLDING_HARVEST_SCHEDULE.workflow_id).toBe(SCAFFOLDING_HARVEST_WORKFLOW.workflow_id);
  });

  it("goal.execution_level classifies this as E4 production operation (matching real orbit)", () => {
    expect(SCAFFOLDING_HARVEST_GOAL.execution_level).toBe("E4_PRODUCTION_OPERATION");
  });

  it("target_metric mentions measurement, not extrapolation (honesty)", () => {
    expect(SCAFFOLDING_HARVEST_GOAL.target_metric).toMatch(/measured/i);
    expect(SCAFFOLDING_HARVEST_GOAL.target_metric).not.toMatch(/extrapolat/i);
  });
});

describe("Stage 13 · anti-pattern surface", () => {
  it("module exports NO run/execute/dispatch/spawn/start FUNCTIONS", async () => {
    const mod: Record<string, unknown> = await import("./orchestration");
    for (const key of Object.keys(mod)) {
      if (typeof mod[key] !== "function") continue;
      expect(key.toLowerCase()).not.toMatch(
        /^(run|execute|dispatch|spawn|start|stop|activate|trigger|fire|invoke)/,
      );
    }
  });

  it("orchestration.ts source imports NO orbiting-agent or writer", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.join(process.cwd(), "src/lib/nex/capability-runtime/orchestration.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/from ["'].*aof\/agents\//);
    expect(src).not.toMatch(/from ["'].*harvest\/controller/);
    expect(src).not.toMatch(/from ["'].*harvest\/queue/);
    // No SQL writes
    expect(src).not.toMatch(/\bINSERT\b|\bUPDATE\b|\bDELETE\b/);
  });
});
