// Planner — pure classification tests.

import { describe, it, expect } from "vitest";
import { planForAsk } from "./planner";

describe("planForAsk", () => {
  it("returns empty steps when nothing matches", () => {
    const p = planForAsk("hello there");
    expect(p.steps).toEqual([]);
    expect(p.reason.toLowerCase()).toContain("didn't match");
  });

  it("'quote this extension' → estimating + procurement + finance + customer", () => {
    const p = planForAsk("Nex, quote this extension");
    const ids = new Set(p.steps.map((s) => s.agent_id));
    expect(ids.has("estimating")).toBe(true);
    expect(ids.has("procurement")).toBe(true);
    expect(ids.has("finance")).toBe(true);
    expect(ids.has("customer")).toBe(true);
  });

  it("'organise my next project' → estimating + procurement + sitebook + customer", () => {
    const p = planForAsk("Nex, organise my next project");
    const ids = new Set(p.steps.map((s) => s.agent_id));
    expect(ids.has("estimating")).toBe(true);
    expect(ids.has("procurement")).toBe(true);
    expect(ids.has("sitebook")).toBe(true);
    expect(ids.has("customer")).toBe(true);
  });

  it("'plan my week' → sitebook + customer + procurement", () => {
    const p = planForAsk("plan my week");
    const ids = new Set(p.steps.map((s) => s.agent_id));
    expect(ids.has("sitebook")).toBe(true);
    expect(ids.has("customer")).toBe(true);
    expect(ids.has("procurement")).toBe(true);
  });

  it("estimator step depends on procurement when both selected", () => {
    const p = planForAsk("Nex, quote this extension");
    const est = p.steps.find((s) => s.agent_id === "estimating")!;
    expect(est.depends_on).toContain("procurement");
  });

  it("finance step depends on estimating when both selected", () => {
    const p = planForAsk("Nex, quote this extension");
    const fin = p.steps.find((s) => s.agent_id === "finance")!;
    expect(fin.depends_on).toContain("estimating");
  });

  it("keyword-only asks add just the matching agents", () => {
    const p = planForAsk("what are the regulations for a staircase?");
    const ids = new Set(p.steps.map((s) => s.agent_id));
    expect(ids.has("regulations")).toBe(true);
    expect(ids.has("estimating")).toBe(false);
  });
});
