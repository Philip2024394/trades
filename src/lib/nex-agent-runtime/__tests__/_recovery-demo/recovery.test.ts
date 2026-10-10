// NEX1 · Rung-4 recovery-loop demonstration test.
// Deterministic · zero LLM · TWO failing assertions requiring TWO independent
// deterministic mutations. Baseline: both fail. After NEX1's recovery loop:
// iteration 1 fixes one, iteration 2 fixes the other, all green.
//
// This test intentionally starts red. It is not part of the production
// pipeline — it is the substrate NEX1's native programming loop exercises
// its recovery mechanism against.

import { describe, it, expect } from "vitest";
import { demoSupervise } from "./supervisor";

function bundle(id: string) {
  return { agent_id: id };
}

describe("Rung-4 recovery demonstration", () => {
  it("R-1 · missing-alpha-must-be-supervised", () => {
    const provisioned = [bundle(`recovery-alpha`)];
    const handles = demoSupervise({ provisioned });
    expect(handles.size).toBe(1);
  });

  it("R-2 · missing-beta-must-be-supervised", () => {
    const provisioned = [bundle(`recovery-beta`)];
    const handles = demoSupervise({ provisioned });
    expect(handles.size).toBe(1);
  });
});
