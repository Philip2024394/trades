// J23.2 · three bugs; all should be repaired in three hops.
import { describe, expect, it } from "vitest";
import { h1, h2, h3 } from "../challenge-j23/source-hops";
describe("j23-three-hop", () => {
  it("hop1 h1 should be 10", () => { expect(h1()).toBe(10); });
  it("hop2 h2 should be 20", () => { expect(h2()).toBe(20); });
  it("hop3 h3 should be 30", () => { expect(h3()).toBe(30); });
});
