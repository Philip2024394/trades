// FIXTURE · Fix 24 · adjacent failing assertion source.
import { describe, it, expect } from "vitest";
import { computeWorkerPool } from "./s1-niladic";
describe("computeWorkerPool", () => {
  it("returns { size: 3 }", () => {
    expect(computeWorkerPool().size).toBe(3);
  });
});
