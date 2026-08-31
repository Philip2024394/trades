// Stage 3.29 · Phase 22 · Planning unit tests.

import { describe, it, expect } from "vitest";
import { buildPlan } from "./planning";

describe("buildPlan · non-accommodation intent", () => {
  it("returns empty plan for non-accommodation", () => {
    const r = buildPlan({ intent: "food" });
    expect(r.steps).toEqual([]);
    expect(r.currentStepIndex).toBe(-1);
    expect(r.summary).toContain("accommodation only v1");
  });
});

describe("buildPlan · fresh accommodation (no slots)", () => {
  it("all steps pending · current is narrow_location", () => {
    const r = buildPlan({ intent: "accommodation" });
    expect(r.goalKind).toBe("accommodation");
    expect(r.steps).toHaveLength(8);
    expect(r.steps[0].kind).toBe("narrow_location");
    expect(r.steps[0].status).toBe("current");
    expect(r.steps.slice(1).every((s) => s.status === "pending")).toBe(true);
    expect(r.currentStepIndex).toBe(0);
    expect(r.isPlanComplete).toBe(false);
  });
});

describe("buildPlan · progression", () => {
  it("location known → step 1 done, step 2 current (narrow_type)", () => {
    const r = buildPlan({ intent: "accommodation", slots: { location: "yogyakarta" } });
    expect(r.steps[0].status).toBe("done");
    expect(r.steps[1].status).toBe("current");
    expect(r.steps[1].kind).toBe("narrow_type");
    expect(r.currentStepIndex).toBe(1);
  });

  it("location + type + budget → step 4 (narrow_area) current", () => {
    const r = buildPlan({
      intent: "accommodation",
      slots: { location: "yogyakarta", type: "hotel", budget: "budget" },
    });
    expect(r.steps[0].status).toBe("done");
    expect(r.steps[1].status).toBe("done");
    expect(r.steps[2].status).toBe("done");
    expect(r.steps[3].status).toBe("current");
    expect(r.steps[3].kind).toBe("narrow_area");
  });

  it("all slots + candidates matched → step 6 (resolve_reference) current", () => {
    const r = buildPlan({
      intent: "accommodation",
      slots: { location: "yogyakarta", type: "hotel", budget: "budget", area: "malioboro" },
      realPropertiesMatched: 5,
    });
    // Steps 1-5 done (narrow_location, narrow_type, narrow_budget, narrow_area, present_candidates)
    for (let i = 0; i < 5; i++) expect(r.steps[i].status).toBe("done");
    expect(r.steps[5].status).toBe("current");
    expect(r.steps[5].kind).toBe("resolve_reference");
  });

  it("resolved reference → step 7 (confirm_action) current", () => {
    const r = buildPlan({
      intent: "accommodation",
      slots: { location: "yogyakarta", type: "hotel", budget: "budget", area: "malioboro" },
      realPropertiesMatched: 5,
      hasResolvedReference: true,
    });
    expect(r.steps[6].status).toBe("current");
    expect(r.steps[6].kind).toBe("confirm_action");
  });

  it("everything done → plan complete", () => {
    const r = buildPlan({
      intent: "accommodation",
      slots: { location: "yogyakarta", type: "hotel", budget: "budget", area: "malioboro" },
      realPropertiesMatched: 5,
      hasResolvedReference: true,
      didExecuteAction: true,
    });
    expect(r.isPlanComplete).toBe(true);
    expect(r.steps.every((s) => s.status === "done")).toBe(true);
    expect(r.turnsRemaining).toBe(0);
  });
});

describe("buildPlan · summary + turnsRemaining", () => {
  it("turnsRemaining decreases as state progresses", () => {
    const r0 = buildPlan({ intent: "accommodation" });
    const r1 = buildPlan({ intent: "accommodation", slots: { location: "yogyakarta" } });
    const r2 = buildPlan({ intent: "accommodation", slots: { location: "yogyakarta", type: "hotel" } });
    expect(r0.turnsRemaining).toBeGreaterThan(r1.turnsRemaining);
    expect(r1.turnsRemaining).toBeGreaterThan(r2.turnsRemaining);
  });

  it("summary describes progress", () => {
    const r = buildPlan({ intent: "accommodation", slots: { location: "yogyakarta" } });
    expect(r.summary).toContain("done");
    expect(r.summary).toContain("current");
  });
});
