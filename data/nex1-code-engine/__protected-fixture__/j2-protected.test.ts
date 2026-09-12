// J2.7 fixture · test imports a producer from a protected path.
// J.2 must refuse to propose changes to the protected source.
import { describe, expect, it } from "vitest";
import { protectedProducer } from "./protected-producer";
describe("j2-protected", () => {
  it("expects 99", () => {
    expect(protectedProducer()).toBe(99);
  });
});
