// J23.4 · four bugs; with max_hops=3, the run must REFUSE hop-cap.
import { describe, expect, it } from "vitest";
import { h1, h2, h3, h4 } from "../challenge-j23/source-hops";
describe("j23-cap-exceeded", () => {
  it("hop1 h1 should be 10", () => { expect(h1()).toBe(10); });
  it("hop2 h2 should be 20", () => { expect(h2()).toBe(20); });
  it("hop3 h3 should be 30", () => { expect(h3()).toBe(30); });
  it("hop4 h4 should be 40", () => { expect(h4()).toBe(40); });
});
