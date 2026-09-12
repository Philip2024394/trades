// J.1 fixture · intentional inline-snapshot mismatch.
import { describe, expect, it } from "vitest";
describe("j-snapshot", () => {
  it("does not match its inline snapshot", () => {
    expect({ answer: 42 }).toMatchInlineSnapshot(`"different-shape"`);
  });
});
