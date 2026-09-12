// J23.1 · two bugs; both should be repaired in successive hops.
import { describe, expect, it } from "vitest";
import { h1, h2 } from "../challenge-j23/source-hops";
describe("j23-two-hop", () => {
  it("hop1 h1 should be 10", () => { expect(h1()).toBe(10); });
  it("hop2 h2 should be 20", () => { expect(h2()).toBe(20); });
});
