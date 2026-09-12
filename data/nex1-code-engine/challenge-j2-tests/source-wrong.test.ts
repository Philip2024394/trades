// J2.1 · this test represents the correct specification.
// The source's literal disagrees · J.2 should propose a source repair.
import { describe, expect, it } from "vitest";
import { getAnswer } from "../challenge-j2/source-literal";
describe("j2-source-wrong", () => {
  it("expects 2", () => {
    expect(getAnswer()).toBe(2);
  });
});
