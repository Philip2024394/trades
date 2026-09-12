// J23.3 · hop 1 succeeds; hop 2's cause is a literal-typed contract
// (getMode's return is "on" | "off"). Test expects "invalid" · J.2
// must REFUSE the source repair mid-chain.
import { describe, expect, it } from "vitest";
import { h1, getMode } from "../challenge-j23/source-hops";
describe("j23-complex-mid-chain", () => {
  it("hop1 h1 should be 10", () => { expect(h1()).toBe(10); });
  it("hop2 mode should be invalid", () => { expect(getMode() as string).toBe("invalid"); });
});
