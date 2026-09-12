// J23.5 · hop 1 fixes h1 (safe). Hop 2 would fix h2 · but t3 currently
// PASSES because it also asserts h2. Changing h2 to satisfy hop 2 breaks
// t3 → regression · multi-hop must roll back all mutations.
import { describe, expect, it } from "vitest";
import { h1, h2 } from "../challenge-j23/source-hops";
describe("j23-regression-mid-chain", () => {
  it("hop1 h1 should be 10", () => { expect(h1()).toBe(10); });
  it("hop2 h2 should be 20", () => { expect(h2()).toBe(20); });
  it("t3 currently-passing h2 should be 2", () => { expect(h2()).toBe(2); });
});
