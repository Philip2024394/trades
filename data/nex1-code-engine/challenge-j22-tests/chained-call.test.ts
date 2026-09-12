// J22.4 · chained call. Adversarial · J.2.2 must REFUSE (low confidence).
import { describe, expect, it } from "vitest";
import { getBase } from "../challenge-j22/source-chained";
describe("j22-chained", () => {
  it("expects 8", () => {
    expect(getBase().compute()).toBe(8);
  });
});
