// J22.2 · imported call whose declared literal-type contract is bypassed
// with a widening cast. Test expects a value the contract cannot produce.
// J.2.2 must REFUSE (test may be wrong).
import { describe, expect, it } from "vitest";
import { getKind } from "../challenge-j2/source-contract";
describe("j22-cast-contract-break", () => {
  it("expects gadget", () => {
    expect(getKind() as string).toBe("gadget");
  });
});
