import { describe, it, expect } from "vitest";
import { computeAnswer } from "./s2-single-arg";
describe("computeAnswer", () => {
  it("returns value 42 when called with 5", () => {
    expect(computeAnswer(5).value).toBe(42);
  });
});
