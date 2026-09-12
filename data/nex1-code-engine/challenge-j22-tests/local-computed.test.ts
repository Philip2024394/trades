// J22.5 · locally-computed value · no imported producer.
// J.2.2 must REFUSE (unknown_test_shape).
import { describe, expect, it } from "vitest";
describe("j22-local", () => {
  it("expects 42", () => {
    const local = 5 + 3;
    expect(local).toBe(42);
  });
});
