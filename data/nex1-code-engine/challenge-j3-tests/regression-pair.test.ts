// J3.3 · two tests with contradictory expectations on the same source.
// If J.2 proposes 1 → 2 (to fix test 1), test 2 will break · J.3 must
// detect the regression and roll back.
import { describe, expect, it } from "vitest";
import { getVal } from "../challenge-j3/shared-value";
describe("j3-regression", () => {
  it("test 1 · currently failing · asserts 2", () => {
    expect(getVal()).toBe(2);
  });
  it("test 2 · currently passing · asserts 1", () => {
    expect(getVal()).toBe(1);
  });
});
