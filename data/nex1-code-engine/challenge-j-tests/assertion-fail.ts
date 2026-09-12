// J.1 fixture · intentional assertion mismatch.
import { describe, expect, it } from "vitest";
describe("j-assertion", () => {
  it("expects 1 to be 2", () => {
    expect(1).toBe(2);
  });
});
