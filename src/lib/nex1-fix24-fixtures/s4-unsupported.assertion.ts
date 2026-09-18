// Uses toBeGreaterThan which is unsupported by Fix 24 v1 parser.
import { describe, it, expect } from "vitest";
import { s4Compute } from "./s4-unsupported";
describe("s4Compute", () => {
  it("returns total > 0", () => {
    expect(s4Compute().total).toBeGreaterThan(0);
  });
});
