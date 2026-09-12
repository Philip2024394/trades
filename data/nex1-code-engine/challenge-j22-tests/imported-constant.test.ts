// J22.3 · imported constant. Source has ANSWER = 40, test expects 42.
// J.2.2 must PROPOSE replacing the constant literal.
import { describe, expect, it } from "vitest";
import { ANSWER } from "../challenge-j22/source-constant";
describe("j22-imported-const", () => {
  it("expects 42", () => {
    expect(ANSWER).toBe(42);
  });
});
