// NEX1 · Self-directed engineering test · two failing tests.
// Deterministic · zero LLM · genuinely new · plain natural-language goal will
// point NEX1 at this file · NEX1 must determine everything else itself.

import { describe, it, expect } from "vitest";
import { dispatchPlugins } from "./plugin-dispatcher";

function request(kind: string) {
  return { kind };
}

describe("Self-direct plugin dispatch", () => {
  it("SD-1 · metrics plugin must be dispatched", () => {
    const requested = [request(`metrics`)];
    const handles = dispatchPlugins({ requested });
    expect(handles.size).toBe(1);
  });

  it("SD-2 · auth plugin must be dispatched", () => {
    const requested = [request(`auth`)];
    const handles = dispatchPlugins({ requested });
    expect(handles.size).toBe(1);
  });
});
