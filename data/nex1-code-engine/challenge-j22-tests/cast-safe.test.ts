// J22.1 · imported call wrapped in a safe cast (number → number).
// Source disagrees with test literal · J.2.2 must PROPOSE the source repair.
import { describe, expect, it } from "vitest";
import { getAnswer } from "../challenge-j2/source-literal";
describe("j22-cast-safe", () => {
  it("expects 2 via number cast", () => {
    expect(getAnswer() as number).toBe(2);
  });
});
